import type { Logger, OpencodeClient } from "../core";
import {
  AIMGR_COMMAND_TIMEOUT_MS,
  detectAimgrAvailable,
  detectPackageYaml,
  showToast,
  verifyAimgrResources,
} from "../core";
import { execSync } from "child_process";
import {
  interpretAimgrRepairHealth,
  interpretAimgrVerifyHealth,
  type AimgrRepairHealth,
  type AimgrVerifyHealth,
} from "./aimgr-health";

const PUBLIC_AIMGR_MANIFEST_URL =
  "https://raw.githubusercontent.com/dynatrace-oss/opencode-coder/main/ai-resources/ai.repo.yaml";

export type AimgrRepoPackageStateType =
  | "uninitialized"
  | "empty-no-source"
  | "package-available"
  | "package-unavailable"
  | "failure";

export interface AimgrRepoPackageState {
  packageRef: string;
  packageName: string;
  state: AimgrRepoPackageStateType;
  message?: string;
}

export interface AimgrOptionalPackage {
  packageRef: string;
  packageName: string;
  description: string;
}

export interface AimgrStartupHealthResult {
  verify: AimgrVerifyHealth;
  repair: AimgrRepairHealth;
}

export function hasResourceIssues(result: unknown): boolean {
  return interpretAimgrVerifyHealth(result).hasIssues;
}

/**
 * Options for AimgrService
 */
export interface AimgrServiceOptions {
  /** Logger for reporting status and errors */
  logger: Logger;
  /** OpenCode client for showing toasts */
  client: OpencodeClient;
  /** Working directory (defaults to process.cwd()) */
  workdir?: string;
}

/**
 * Service that handles aimgr integration for auto-discovering and installing AI resources.
 *
 * Features:
 * - Detects if aimgr CLI is installed
 * - Checks for ai.package.yaml existence
 * - Runs aimgr init and installs coder-core package automatically
 * - Shows user notifications for auto-initialization
 */
export class AimgrService {
  private readonly logger: Logger;
  private readonly client: OpencodeClient;
  private readonly workdir: string;
  private aimgrAvailable: boolean | undefined;

  constructor(options: AimgrServiceOptions) {
    this.logger = options.logger;
    this.client = options.client;
    this.workdir = options.workdir ?? process.cwd();
  }

  /**
   * Check if aimgr command is available on PATH
   */
  isAimgrAvailable(): boolean {
    if (this.aimgrAvailable !== undefined) {
      return this.aimgrAvailable;
    }

    this.aimgrAvailable = detectAimgrAvailable(this.workdir, this.logger);

    return this.aimgrAvailable;
  }

  /**
   * Check if ai.package.yaml exists in the working directory
   */
  hasPackageYaml(): boolean {
    return detectPackageYaml(this.workdir, this.logger);
  }

  /**
   * Run aimgr init in the working directory
   */
  initializeAimgr(): void {
    try {
      this.logger.debug("Running aimgr init", { workdir: this.workdir });
      execSync("aimgr init", {
        cwd: this.workdir,
        stdio: "ignore",
        timeout: AIMGR_COMMAND_TIMEOUT_MS,
      });
      this.logger.info("aimgr init completed successfully");
    } catch (error) {
      this.logger.error("Failed to run aimgr init", { error: String(error) });
      throw error;
    }
  }

  /**
   * Check if a package is available in the aimgr repository
   */
  isPackageAvailable(packageName: string): boolean {
    return this.getRepoPackageState(packageName).state === "package-available";
  }

  /**
   * Detect repository/package state from `aimgr repo list --format=json`.
   *
   * `aimgr repo list --format=json` emits plaintext for empty states,
   * so this method intentionally handles both JSON and non-JSON outputs.
   */
  getRepoPackageState(packageName: string): AimgrRepoPackageState {
    const packageRef = normalizePackageRef(packageName);
    const normalizedPackageName = packageRefToName(packageRef);

    try {
      this.logger.debug("Checking aimgr repo package state", { packageRef });
      const stdout = execSync("aimgr repo list --format=json", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: AIMGR_COMMAND_TIMEOUT_MS,
      });

      return this.interpretRepoListOutput(stdout, {
        packageRef,
        packageName: normalizedPackageName,
      });
    } catch (error) {
      const commandOutput = extractCommandOutput(error);
      const interpreted = this.interpretRepoListOutput(commandOutput, {
        packageRef,
        packageName: normalizedPackageName,
      });

      if (interpreted.state !== "failure") {
        return interpreted;
      }

      this.logger.error("Failed to check package availability", {
        packageRef,
        error: String(error),
      });

      return {
        packageRef,
        packageName: normalizedPackageName,
        state: "failure",
        message: "Failed to query aimgr repository state",
      };
    }
  }

  /**
   * Discover optional public packages after core is installable.
   */
  listInstallableOptionalPackages(): AimgrOptionalPackage[] {
    const discovered = new Map<string, AimgrOptionalPackage>();

    const discoveredCoderPackages = this.listPackagesFromRepoPattern("package/coder*")
      .filter((pkg) => pkg.packageRef !== "package/coder-core")
      .filter((pkg) => pkg.packageRef !== "package/opencode-coder");

    for (const pkg of discoveredCoderPackages) {
      discovered.set(pkg.packageRef, pkg);
    }

    return [...discovered.values()].sort((a, b) => a.packageRef.localeCompare(b.packageRef));
  }

  /**
   * Install a package using aimgr
   */
  installPackage(packageName: string): void {
    const packageRef = normalizePackageRef(packageName);
    try {
      this.logger.debug("Installing package", { packageRef, workdir: this.workdir });
      execSync(`aimgr install ${packageRef}`, {
        cwd: this.workdir,
        stdio: "ignore",
        timeout: AIMGR_COMMAND_TIMEOUT_MS,
      });
      this.logger.info("Package installed successfully", { packageRef });
    } catch (error) {
      this.logger.error("Failed to install package", { packageRef, error: String(error) });
      throw error;
    }
  }

  /**
   * Run aimgr verify and return the parsed JSON result.
   *
   * Returns the raw parsed JSON object (typed as any so types can be tightened
   * later once the aimgr verify output format is stabilised), or null if aimgr
   * is not available or the command fails.
   */
  verifyResources(): unknown | null {
    if (!this.isAimgrAvailable()) {
      this.logger.debug("aimgr not available, skipping verifyResources");
      return null;
    }

    this.logger.debug("Running aimgr verify --format json");
    const result = verifyAimgrResources(this.workdir, { logger: this.logger });
    if (result !== null) {
      this.logger.debug("aimgr verify completed", { result });
    }
    return result;
  }

  /**
   * Run aimgr repair and return the parsed JSON result.
   *
   * Returns the raw parsed JSON object (typed as any so types can be tightened
   * later once the aimgr repair output format is stabilised), or null if aimgr
   * is not available or the command fails.
   *
   * Note: aimgr repair outputs human-readable text to stderr and JSON to stdout.
   * We capture stdout only via execSync.
   */
  repairResources(): unknown | null {
    if (!this.isAimgrAvailable()) {
      this.logger.debug("aimgr not available, skipping repairResources");
      return null;
    }

    try {
      this.logger.debug("Running aimgr repair --format json");
      const stdout = execSync("aimgr repair --format json", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: AIMGR_COMMAND_TIMEOUT_MS,
      });
      const result = JSON.parse(stdout);
      this.logger.debug("aimgr repair completed", { result });
      return result;
    } catch (error) {
      this.logger.error("Failed to run aimgr repair", { error: String(error) });
      return null;
    }
  }

  /**
   * Verify resources and automatically attempt repair when fixable issues exist.
   *
   * The post-repair verify result is authoritative when repair is attempted.
   */
  async verifyAndAutoRepairResources(): Promise<AimgrStartupHealthResult> {
    const initialVerifyHealth = interpretAimgrVerifyHealth(this.verifyResources());

    if (!initialVerifyHealth.available) {
      return {
        verify: initialVerifyHealth,
        repair: {
          attempted: false,
          healthy: false,
        },
      };
    }

    if (initialVerifyHealth.healthy) {
      return {
        verify: initialVerifyHealth,
        repair: {
          attempted: false,
          healthy: false,
        },
      };
    }

    this.logger.info("aimgr verify found resource issues, attempting automatic repair");
    this.repairResources();

    const postRepairVerify = this.verifyResources();
    const postRepairVerifyHealth = interpretAimgrVerifyHealth(postRepairVerify);
    const repair = interpretAimgrRepairHealth(postRepairVerify, true);

    await this.notifyAutoRepairOutcome(postRepairVerifyHealth.healthy);

    return {
      verify: postRepairVerifyHealth,
      repair,
    };
  }

  private async notifyAutoRepairOutcome(healthyAfterRepair: boolean): Promise<void> {
    if (healthyAfterRepair) {
      await showToast(this.client, this.logger, {
        title: "aimgr",
        message: "aimgr auto-repair fixed resource issues.",
        variant: "success",
        duration: 7000,
      });
      this.logger.info("aimgr auto-repair succeeded");
    } else {
      await showToast(this.client, this.logger, {
        title: "aimgr",
        message: "aimgr auto-repair was attempted, but issues remain. Run /opencode-coder/doctor for details.",
        variant: "warning",
        duration: 8000,
      });
      this.logger.warn("aimgr auto-repair attempted but resources are still unhealthy");
    }
  }

  /**
   * Main orchestration method for auto-initialization
   * 
   * This method:
   * 1. Checks if ai.package.yaml exists
   * 2. If not, checks if aimgr is available
   * 3. If available, runs aimgr init
    * 4. Checks if coder-core package is available
   * 5. If yes, installs it
   * 6. Shows user notification
   * 
   * All errors are caught and logged but do not throw.
   */
  async autoInitialize(): Promise<void> {
    const start = Date.now();
    
    try {
      // Step 1: Check if ai.package.yaml already exists
      if (this.hasPackageYaml()) {
        this.logger.debug("ai.package.yaml already exists, skipping auto-initialization");
        return;
      }

      // Step 2: Check if aimgr is available
      if (!this.isAimgrAvailable()) {
        this.logger.debug("aimgr not available, skipping auto-initialization");
        return;
      }

      // Step 3: Run aimgr init
      this.initializeAimgr();

      // Step 4: Check if coder-core package is available
      const coreState = this.getRepoPackageState("package/coder-core");
      if (coreState.state !== "package-available") {
        this.logger.debug("coder-core package not available in repo", {
          state: coreState.state,
        });
        await showToast(this.client, this.logger, {
          title: "aimgr Initialized",
          message:
            "Created ai.package.yaml. Configure public sources with 'aimgr repo apply-manifest " +
            `${PUBLIC_AIMGR_MANIFEST_URL}` +
            " && aimgr repo sync', then run 'aimgr install package/coder-core'.",
          variant: "info",
          duration: 9000,
        });
        return;
      }

      // Step 5: Install coder-core package
      this.installPackage("package/coder-core");

      // Step 6: Show success notification
      await showToast(this.client, this.logger, {
        title: "aimgr Initialized",
        message: "Detected aimgr and installed coder-core package",
        variant: "success",
        duration: 6000,
      });

      this.logger.info("aimgr auto-initialization completed", { durationMs: Date.now() - start });
    } catch (error) {
      this.logger.error("aimgr auto-initialization failed", { error: String(error), durationMs: Date.now() - start });
      // Don't throw - we want the plugin to load even if aimgr fails
    }
  }

  private interpretRepoListOutput(
    output: string,
    context: { packageRef: string; packageName: string }
  ): AimgrRepoPackageState {
    try {
      const data = JSON.parse(output) as { packages?: Array<{ name?: string; description?: string }> };
      const packages = data.packages ?? [];
      const found = packages.some((pkg) => {
        const repoName = (pkg.name ?? "").trim();
        if (!repoName) {
          return false;
        }

        return repoName === context.packageName || `package/${repoName}` === context.packageRef;
      });

      this.logger.debug("Package availability check", {
        packageRef: context.packageRef,
        found,
      });

      return {
        packageRef: context.packageRef,
        packageName: context.packageName,
        state: found ? "package-available" : "package-unavailable",
      };
    } catch {
      const normalized = output.trim();

      if (
        normalized.includes(
          "Run 'aimgr repo init' or 'aimgr repo apply-manifest <path-or-url>' to initialize the repository."
        )
      ) {
        return {
          packageRef: context.packageRef,
          packageName: context.packageName,
          state: "uninitialized",
          message: normalized,
        };
      }

      if (normalized.includes("Add resources with:")) {
        return {
          packageRef: context.packageRef,
          packageName: context.packageName,
          state: "empty-no-source",
          message: normalized,
        };
      }

      return {
        packageRef: context.packageRef,
        packageName: context.packageName,
        state: "failure",
        message: normalized,
      };
    }
  }

  private listPackagesFromRepoPattern(pattern: string): AimgrOptionalPackage[] {
    try {
      const stdout = execSync(`aimgr repo list "${pattern}" --format=json`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: AIMGR_COMMAND_TIMEOUT_MS,
      });
      const data = JSON.parse(stdout) as {
        packages?: Array<{ name?: string; description?: string }>;
      };
      const packages = data.packages ?? [];

      return packages
        .map((pkg) => {
          const packageName = (pkg.name ?? "").trim();
          if (!packageName) {
            return null;
          }
          return {
            packageRef: normalizePackageRef(packageName),
            packageName,
            description: (pkg.description ?? "").trim() || "No description available",
          };
        })
        .filter((pkg): pkg is AimgrOptionalPackage => pkg !== null);
    } catch (error) {
      this.logger.warn("Failed to list optional packages from aimgr repo", {
        pattern,
        error: String(error),
      });
      return [];
    }
  }
}

function normalizePackageRef(packageNameOrRef: string): string {
  const trimmed = packageNameOrRef.trim();
  return trimmed.startsWith("package/") ? trimmed : `package/${trimmed}`;
}

function packageRefToName(packageRef: string): string {
  return packageRef.replace(/^package\//, "");
}

function extractCommandOutput(error: unknown): string {
  const commandError = error as {
    stdout?: Buffer | string;
    stderr?: Buffer | string;
  };
  const stdout = toStringOutput(commandError?.stdout);
  const stderr = toStringOutput(commandError?.stderr);
  return [stdout, stderr].filter(Boolean).join("\n");
}

function toStringOutput(value: Buffer | string | undefined): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toString("utf-8");
}
