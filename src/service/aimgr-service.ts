import type { Logger, OpencodeClient } from "../core";
import {
  AIMGR_COMMAND_TIMEOUT_MS,
  detectAimgrAvailable,
  detectPackageYaml,
  showToast,
  verifyAimgrResources,
} from "../core";
import { execSync } from "child_process";

export interface AimgrStartupHealthResult {
  verifyResult: any | null;
  resourcesHealthy: boolean;
  repairAttempted: boolean;
  repairSucceeded: boolean;
}

export function hasResourceIssues(result: unknown): boolean {
  if (!result || typeof result !== "object") return true;

  const verifyResult = result as {
    issues?: unknown[];
    errors?: unknown[];
    error?: unknown;
    status?: unknown;
  };

  return (
    (Array.isArray(verifyResult.issues) && verifyResult.issues.length > 0) ||
    (Array.isArray(verifyResult.errors) && verifyResult.errors.length > 0) ||
    (typeof verifyResult.error === "string" && verifyResult.error !== "") ||
    (typeof verifyResult.status === "string" && verifyResult.status !== "ok" && verifyResult.status !== "healthy")
  );
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
    try {
      this.logger.debug("Checking if package is available", { packageName });
      const stdout = execSync("aimgr repo list --format=json", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: AIMGR_COMMAND_TIMEOUT_MS,
      });
      const data = JSON.parse(stdout);
      
      // Check if package exists in any of the resource lists
      const packages = data.packages || [];
      const found = packages.some((pkg: any) => pkg.name === packageName);
      
      this.logger.debug("Package availability check", { packageName, found });
      return found;
    } catch (error) {
      this.logger.error("Failed to check package availability", { packageName, error: String(error) });
      return false;
    }
  }

  /**
   * Install a package using aimgr
   */
  installPackage(packageName: string): void {
    try {
      this.logger.debug("Installing package", { packageName, workdir: this.workdir });
      execSync(`aimgr install package/${packageName}`, {
        cwd: this.workdir,
        stdio: "ignore",
        timeout: AIMGR_COMMAND_TIMEOUT_MS,
      });
      this.logger.info("Package installed successfully", { packageName });
    } catch (error) {
      this.logger.error("Failed to install package", { packageName, error: String(error) });
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
  verifyResources(): any {
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
  repairResources(): any {
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
    const initialVerify = this.verifyResources();

    if (initialVerify === null) {
      return {
        verifyResult: null,
        resourcesHealthy: false,
        repairAttempted: false,
        repairSucceeded: false,
      };
    }

    if (!hasResourceIssues(initialVerify)) {
      return {
        verifyResult: initialVerify,
        resourcesHealthy: true,
        repairAttempted: false,
        repairSucceeded: false,
      };
    }

    this.logger.info("aimgr verify found resource issues, attempting automatic repair");
    this.repairResources();

    const postRepairVerify = this.verifyResources();
    const postRepairHealthy = postRepairVerify !== null && !hasResourceIssues(postRepairVerify);

    if (postRepairHealthy) {
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

    return {
      verifyResult: postRepairVerify,
      resourcesHealthy: postRepairHealthy,
      repairAttempted: true,
      repairSucceeded: postRepairHealthy,
    };
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
      const packageAvailable = this.isPackageAvailable("coder-core");
      if (!packageAvailable) {
        this.logger.debug("coder-core package not available in repo");
        await showToast(this.client, this.logger, {
          title: "aimgr Initialized",
          message: "Created ai.package.yaml. Run 'aimgr repo search coder-core' to discover resources.",
          variant: "info",
          duration: 6000,
        });
        return;
      }

      // Step 5: Install coder-core package
      this.installPackage("coder-core");

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
}
