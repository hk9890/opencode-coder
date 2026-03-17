import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { stringify } from "yaml";
import {
  AIMGR_COMMAND_TIMEOUT_MS,
  hasResourceIssues,
  isCommandAvailable,
  isExecTimeoutError,
  type Logger,
  type VersionInfo,
} from "../core";

/**
 * Options for ProjectDetectorService
 */
export interface ProjectDetectorServiceOptions {
  /** Logger for reporting status and errors */
  logger: Logger;
  /** Working directory (defaults to process.cwd()) */
  workdir?: string;
}

export interface ProjectDetectionOptions {
  /**
   * Optional authoritative aimgr resource health from startup verify/repair flow.
   * When provided, detectAndWrite uses this value instead of running aimgr verify.
   */
  resourcesHealthyOverride?: boolean;
}

/**
 * Detected project context written to .coder/project.yaml on every startup.
 */
export interface ProjectContext {
  /** Overall operational mode */
  mode: "stealth" | "team" | "uninitialized";

  /**
   * True when all prerequisites for running /init are in place:
   * git initialized, bd CLI installed, aimgr installed, and
   * package/opencode-coder is listed in ai.package.yaml.
   *
   * Used by the plugin /init command to gate the installation flow.
   */
  installReady: boolean;

  /**
   * True when all ecosystem components are installed and operational:
   * git initialized, beads initialized, aimgr installed with package yaml,
   * and all declared resources healthy.
   *
   * Used by the plugin config hook to set the default agent to orchestrator.
   */
  ecosystemReady: boolean;

  /** Git repository information */
  git: {
    /** Whether a .git directory exists */
    initialized: boolean;
  };

  /** Beads issue-tracker status */
  beads: {
    /** Whether .beads/ directory exists */
    initialized: boolean;
    /** Whether the stealth-mode marker is present in .git/info/exclude */
    stealthMode: boolean;
    /** Whether the bd CLI is available on PATH */
    bdCliInstalled: boolean;
  };

  /** aimgr AI-resource-manager status */
  aimgr: {
    /** Whether the aimgr CLI is available on PATH */
    installed: boolean;
    /** Whether ai.package.yaml exists */
    packageYaml: boolean;
    /** Whether aimgr verify reports no issues (false when aimgr is not installed) */
    resourcesHealthy: boolean;
    /** Whether package/opencode-coder is listed in ai.package.yaml */
    coderPackageInstalled: boolean;
  };

  /** Plugin version string */
  pluginVersion: string;
}

/**
 * Marker string embedded by `bd init --stealth` in .git/info/exclude.
 * We search for this line to determine whether the project is in stealth mode.
 */
const STEALTH_MARKER = "# opencode-coder stealth mode";

/**
 * Service that detects facts about the current project and writes them
 * to `.coder/project.yaml` on every plugin startup.
 *
 * All detection methods are synchronous filesystem / CLI checks that are
 * cheap enough to run on every startup without perceptible overhead.
 */
export class ProjectDetectorService {
  private readonly logger: Logger;
  private readonly workdir: string;

  constructor(options: ProjectDetectorServiceOptions) {
    this.logger = options.logger;
    this.workdir = options.workdir ?? process.cwd();
  }

  // ---------------------------------------------------------------------------
  // .coder detection
  // ---------------------------------------------------------------------------

  /**
   * Check whether a .coder directory exists in the working directory.
   *
   * The plugin only performs project-local management when `.coder/` already
   * exists or when the user explicitly creates it via `/init`.
   */
  detectCoderDirectory(): boolean {
    const coderDir = path.join(this.workdir, ".coder");
    try {
      fs.accessSync(coderDir, fs.constants.F_OK);
      this.logger.debug("Coder directory detected", { path: coderDir });
      return true;
    } catch {
      this.logger.debug("Coder directory not found", { path: coderDir });
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Git detection
  // ---------------------------------------------------------------------------

  /**
   * Check whether a .git directory exists in the working directory.
   */
  detectGitInitialized(): boolean {
    const gitDir = path.join(this.workdir, ".git");
    try {
      fs.accessSync(gitDir, fs.constants.F_OK);
      this.logger.debug("Git directory detected", { path: gitDir });
      return true;
    } catch {
      this.logger.debug("Git directory not found", { path: gitDir });
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Beads detection
  // ---------------------------------------------------------------------------

  /**
   * Check whether .beads/ directory exists.
   */
  detectBeadsInitialized(): boolean {
    const beadsDir = path.join(this.workdir, ".beads");
    try {
      fs.accessSync(beadsDir, fs.constants.F_OK);
      this.logger.debug("Beads directory detected", { path: beadsDir });
      return true;
    } catch {
      this.logger.debug("Beads directory not found", { path: beadsDir });
      return false;
    }
  }

  /**
   * Check whether the stealth-mode marker is present in .git/info/exclude.
   */
  detectStealthMode(): boolean {
    const excludeFile = path.join(this.workdir, ".git", "info", "exclude");
    try {
      const content = fs.readFileSync(excludeFile, "utf-8");
      const isStealthy = content.includes(STEALTH_MARKER);
      this.logger.debug("Stealth mode detection", { stealthMode: isStealthy });
      return isStealthy;
    } catch {
      this.logger.debug("Could not read .git/info/exclude, assuming no stealth mode");
      return false;
    }
  }

  /**
   * Check whether the bd CLI is available on PATH.
   */
  detectBdCliInstalled(): boolean {
    return isCommandAvailable("bd", this.logger, {
      successMessage: "bd CLI is available",
      missingMessage: "bd CLI not found on PATH",
      timeoutMessage: "bd CLI availability check timed out",
    });
  }

  // ---------------------------------------------------------------------------
  // aimgr detection
  // ---------------------------------------------------------------------------

  /**
   * Check whether the aimgr CLI is available on PATH.
   */
  detectAimgrInstalled(): boolean {
    return isCommandAvailable("aimgr", this.logger, {
      successMessage: "aimgr CLI is available",
      missingMessage: "aimgr CLI not found on PATH",
      timeoutMessage: "aimgr CLI availability check timed out",
    });
  }

  /**
   * Check whether ai.package.yaml exists in the working directory.
   */
  detectPackageYaml(): boolean {
    const packagePath = path.join(this.workdir, "ai.package.yaml");
    const exists = fs.existsSync(packagePath);
    this.logger.debug("Checking for ai.package.yaml", { path: packagePath, exists });
    return exists;
  }

  /**
   * Check whether `package/opencode-coder` is installed via aimgr.
   *
   * Uses `aimgr list "package/opencode-coder" --format json` which returns
   * a JSON array of matching resources when found, or a human-readable
   * message (not JSON) when no match exists.
   *
   * Returns false if:
   * - aimgr is not installed
   * - the command fails or returns non-JSON output
   * - the result is an empty array
   */
  detectCoderPackageInstalled(): boolean {
    const command = 'aimgr list "package/opencode-coder" --format json';
    try {
      const stdout = execSync(command, {
        cwd: this.workdir,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: AIMGR_COMMAND_TIMEOUT_MS,
      });
      const parsed = JSON.parse(stdout);
      const found = Array.isArray(parsed) && parsed.length > 0;
      this.logger.debug("aimgr list package/opencode-coder", { found, count: parsed.length });
      return found;
    } catch (error) {
      if (isExecTimeoutError(error)) {
        this.logger.warn("aimgr list timed out while checking opencode-coder package", {
          command,
          timeoutMs: AIMGR_COMMAND_TIMEOUT_MS,
        });
        return false;
      }

      this.logger.debug("Could not detect opencode-coder package via aimgr list");
      return false;
    }
  }

  /**
   * Run `aimgr verify --format json` and return true when no issues are found.
   * Returns false when aimgr is not installed, the command fails, or issues exist.
   */
  detectResourcesHealthy(aimgrInstalled = this.detectAimgrInstalled()): boolean {
    if (!aimgrInstalled) {
      this.logger.debug("aimgr not available, skipping resource health check");
      return false;
    }

    try {
      const stdout = execSync("aimgr verify --format json", {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: AIMGR_COMMAND_TIMEOUT_MS,
      });
      const result = JSON.parse(stdout);
      const hasIssues = hasResourceIssues(result);
      this.logger.debug("aimgr verify completed", { healthy: !hasIssues });
      return !hasIssues;
    } catch (error) {
      this.logger.error("Failed to run aimgr verify", { error: String(error) });
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Mode derivation
  // ---------------------------------------------------------------------------

  /**
   * Derive the overall project mode from beads/stealth detection results.
   *
   * - stealth: stealth marker found in .git/info/exclude
   * - team: .beads/ exists but no stealth marker
   * - uninitialized: neither condition is met
   */
  deriveMode(beadsInitialized: boolean, stealthMode: boolean): "stealth" | "team" | "uninitialized" {
    if (stealthMode) return "stealth";
    if (beadsInitialized) return "team";
    return "uninitialized";
  }

  /**
   * Derive whether the full ecosystem is installed and operational.
   *
   * True when all of:
   * - git is initialized
   * - beads is initialized
   * - aimgr CLI is installed
   * - ai.package.yaml exists
   * - all declared resources are healthy (agents, commands, skills in sync)
   */
  deriveEcosystemReady(
    gitInitialized: boolean,
    beadsInitialized: boolean,
    aimgrInstalled: boolean,
    packageYaml: boolean,
    resourcesHealthy: boolean,
  ): boolean {
    return gitInitialized && beadsInitialized && aimgrInstalled && packageYaml && resourcesHealthy;
  }

  /**
   * Derive whether all prerequisites for running /init are in place.
   *
   * True when all of:
   * - git is initialized
   * - bd CLI is installed
   * - aimgr CLI is installed
   * - package/opencode-coder is listed in ai.package.yaml
   */
  deriveInstallReady(
    gitInitialized: boolean,
    bdCliInstalled: boolean,
    aimgrInstalled: boolean,
    coderPackageInstalled: boolean,
  ): boolean {
    return gitInitialized && bdCliInstalled && aimgrInstalled && coderPackageInstalled;
  }

  // ---------------------------------------------------------------------------
  // YAML writing
  // ---------------------------------------------------------------------------

  /**
   * Ensure `.coder/` exists and write `context` as YAML to `.coder/project.yaml`.
   *
   * Also creates `.coder/.gitignore` (containing `*`) if it does not already exist,
   * so that the entire `.coder/` directory is excluded from git in team mode.
   * This is the same pattern used by `.beads/.gitignore`.
   */
  writeProjectContext(context: ProjectContext): void {
    const coderDir = path.join(this.workdir, ".coder");
    fs.mkdirSync(coderDir, { recursive: true });

    const gitignorePath = path.join(coderDir, ".gitignore");
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, "*\n");
    }

    const outputPath = path.join(coderDir, "project.yaml");
    const yamlContent = stringify(context);
    fs.writeFileSync(outputPath, yamlContent, "utf-8");
    this.logger.debug("Project context written", { path: outputPath });
  }

  // ---------------------------------------------------------------------------
  // Main orchestration
  // ---------------------------------------------------------------------------

  /**
   * Detect all project facts, build a `ProjectContext` object, and write it
   * to `.coder/project.yaml`.
   *
   * This method is designed to be called from plugin startup. All errors
   * during individual detections are caught internally; the method itself
   * never throws.
   *
   * @returns The detected project context.
   */
  detectAndWrite(versionInfo: VersionInfo, options?: ProjectDetectionOptions): ProjectContext {
    const start = Date.now();
    this.logger.debug("Starting project detection", { workdir: this.workdir });

    // Git
    const gitInitialized = this.detectGitInitialized();
    // Beads
    const beadsInitialized = this.detectBeadsInitialized();
    const stealthMode = this.detectStealthMode();

    // Beads CLI
    const bdCliInstalled = this.detectBdCliInstalled();

    // aimgr
    const aimgrInstalled = this.detectAimgrInstalled();
    const packageYaml = this.detectPackageYaml();
    // Only check health when aimgr is installed (avoids double detection call)
    const resourcesHealthy =
      options?.resourcesHealthyOverride !== undefined
        ? options.resourcesHealthyOverride
        : aimgrInstalled
          ? this.detectResourcesHealthy(aimgrInstalled)
          : false;
    // Only check coder package when aimgr is installed (uses aimgr list CLI)
    const coderPackageInstalled = aimgrInstalled ? this.detectCoderPackageInstalled() : false;

    // Derived
    const mode = this.deriveMode(beadsInitialized, stealthMode);
    const installReady = this.deriveInstallReady(
      gitInitialized,
      bdCliInstalled,
      aimgrInstalled,
      coderPackageInstalled,
    );
    const ecosystemReady = this.deriveEcosystemReady(
      gitInitialized,
      beadsInitialized,
      aimgrInstalled,
      packageYaml,
      resourcesHealthy,
    );

    const context: ProjectContext = {
      mode,
      installReady,
      ecosystemReady,
      git: {
        initialized: gitInitialized,
      },
      beads: {
        initialized: beadsInitialized,
        stealthMode,
        bdCliInstalled,
      },
      aimgr: {
        installed: aimgrInstalled,
        packageYaml,
        resourcesHealthy,
        coderPackageInstalled,
      },
      pluginVersion: versionInfo.version,
    };

    this.writeProjectContext(context);

    this.logger.debug("Project detection completed", {
      durationMs: Date.now() - start,
      mode,
      installReady,
      ecosystemReady,
    });

    return context;
  }
}
