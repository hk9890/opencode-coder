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
import type { SavedPluginMode } from "./plugin-mode-service";

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

  /**
   * Resolved active startup mode chosen by the plugin entry point.
   * When provided, this mode overrides detector-derived mode inference.
   */
  startupMode?: Exclude<SavedPluginMode, "disabled">;
}

export type RuntimePhase = "bootstrap" | "normal";

export interface RuntimePhaseClassification {
  /** Runtime phase based on actual required resource surfaces available on disk. */
  phase: RuntimePhase;
  /** Missing required high-level resource surfaces for Phase 2. */
  missingRequiredSurfaces: string[];
  /** Whether runtime should register bootstrap /opencode-coder/init in this session. */
  shouldExposeBootstrapInit: boolean;
  /** Whether runtime should rely on resource-backed opencode-coder commands. */
  shouldUseResourceBackedCommands: boolean;
  /** User-visible required resource availability (collapsed to high-level signals). */
  requiredSurfaceAvailability: Record<string, boolean>;
  /** Optional resource availability (diagnostic only; does not control phase). */
  optionalAgentAvailability: Record<string, boolean>;
  /** Supporting diagnostics; these are secondary to resource-surface checks. */
  diagnostics: {
    aimgrAvailable: boolean;
    packageYamlAvailable: boolean;
    coderPackageInstalled: boolean;
    resourcesHealthy: boolean;
    opencodeCoderSkillMarkerAvailable: boolean;
  };
}

export interface RuntimePhaseDiagnosticsOverride {
  aimgrAvailable?: boolean;
  packageYamlAvailable?: boolean;
  coderPackageInstalled?: boolean;
  resourcesHealthy?: boolean;
}

/**
 * Detected project context written to .coder/project.yaml during active startup.
 */
export interface ProjectContext {
  /** Overall operational mode for the active project state */
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

  /** Explicit two-phase runtime classification for command registration/gating. */
  runtimePhase: RuntimePhaseClassification;
}

/**
 * Marker string embedded by `bd init --stealth` in .git/info/exclude.
 * We search for this line to determine whether the project is in stealth mode.
 */
const STEALTH_MARKER = "# opencode-coder stealth mode";

const PHASE2_REQUIRED_COMMAND_SURFACES = [
  "opencode-coder/init",
  "opencode-coder/init-or-update-docs",
  "opencode-coder/improve-doc",
  "opencode-coder/doctor",
  "opencode-coder/status",
  "opencode-coder/report-bug",
  "opencode-coder/dump-session",
] as const;

const PHASE2_REQUIRED_SKILL_SURFACES = ["opencode-coder"] as const;

const PHASE2_REQUIRED_SKILL_REFERENCE_SURFACES = [
  "agents-md-template.md",
  "bug-reporting.md",
  "debugging-logs.md",
  "installation-setup.md",
  "mode-transition.md",
  "planning.md",
  "project-docs-lifecycle.md",
  "project-setup.md",
  "project-structure.md",
  "session-dump.md",
  "simplify.md",
  "status-health.md",
  "troubleshooting-patterns.md",
] as const;

const PHASE2_OPTIONAL_AGENT_SURFACES = ["orchestrator", "tasker", "reviewer", "verifier"] as const;

/**
 * Service that detects facts about the current project and writes them
 * to `.coder/project.yaml` during active startup.
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
   * exists or when the user explicitly creates it via `/opencode-coder/init`.
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

  private detectResourcePath(relativePath: string): boolean {
    const resourcePath = path.join(this.workdir, relativePath);
    const exists = fs.existsSync(resourcePath);
    this.logger.debug("Resource surface check", { relativePath, exists });
    return exists;
  }

  /**
   * Detect runtime phase using resource surfaces as source-of-truth.
   *
   * Phase 2 = all required markdown command + skill surfaces exist on disk,
   * regardless of whether they arrived via `aimgr install package/opencode-coder`
   * or equivalent manual copying.
   *
   * aimgr/package metadata remains diagnostic only and must not be the sole phase gate.
   */
  classifyRuntimePhase(overrides?: RuntimePhaseDiagnosticsOverride): RuntimePhaseClassification {
    const commandSurfaceAvailability: Record<string, boolean> = {};

    for (const command of PHASE2_REQUIRED_COMMAND_SURFACES) {
      commandSurfaceAvailability[`command/${command}`] = this.detectResourcePath(
        path.join(".opencode", "commands", "opencode-coder", `${command.replace("opencode-coder/", "")}.md`),
      );
    }

    const skillSurfaceAvailability: Record<string, boolean> = {};
    for (const skill of PHASE2_REQUIRED_SKILL_SURFACES) {
      skillSurfaceAvailability[`skill/${skill}`] = this.detectResourcePath(
        path.join(".opencode", "skills", skill, "SKILL.md"),
      );
    }

    const skillReferenceAvailability: Record<string, boolean> = {};
    for (const reference of PHASE2_REQUIRED_SKILL_REFERENCE_SURFACES) {
      skillReferenceAvailability[`skill-reference/opencode-coder/${reference}`] = this.detectResourcePath(
        path.join(".opencode", "skills", "opencode-coder", "references", reference),
      );
    }

    const rawOptionalAgentAvailability: Record<string, boolean> = {};
    for (const agent of PHASE2_OPTIONAL_AGENT_SURFACES) {
      rawOptionalAgentAvailability[`agent/${agent}`] = this.detectResourcePath(
        path.join(".opencode", "agents", `${agent}.md`),
      );
    }

    const opencodeCoderSkillMarkerAvailable = Object.values(skillSurfaceAvailability).every(Boolean);

    const requiredSurfacesComplete = [
      ...Object.values(commandSurfaceAvailability),
      ...Object.values(skillSurfaceAvailability),
      ...Object.values(skillReferenceAvailability),
    ].every(Boolean);

    const optionalAgentsComplete = Object.values(rawOptionalAgentAvailability).every(Boolean);

    const requiredSurfaceAvailability: Record<string, boolean> = {
      "resource/opencode-coder": requiredSurfacesComplete,
    };

    const optionalAgentAvailability: Record<string, boolean> = {
      "resource/opencode-coder/optional-agents": optionalAgentsComplete,
    };

    const missingRequiredSurfaces = requiredSurfacesComplete ? [] : ["resource/opencode-coder"];

    const phase: RuntimePhase = missingRequiredSurfaces.length === 0 ? "normal" : "bootstrap";
    const shouldExposeBootstrapInit = phase === "bootstrap";
    const shouldUseResourceBackedCommands = phase === "normal";

    const aimgrAvailable = overrides?.aimgrAvailable ?? this.detectAimgrInstalled();
    const packageYamlAvailable = overrides?.packageYamlAvailable ?? this.detectPackageYaml();
    const coderPackageInstalled = overrides?.coderPackageInstalled ?? (aimgrAvailable ? this.detectCoderPackageInstalled() : false);
    const resourcesHealthy = overrides?.resourcesHealthy ?? (aimgrAvailable ? this.detectResourcesHealthy(aimgrAvailable) : false);

    const classification: RuntimePhaseClassification = {
      phase,
      missingRequiredSurfaces,
      shouldExposeBootstrapInit,
      shouldUseResourceBackedCommands,
      requiredSurfaceAvailability,
      optionalAgentAvailability,
      diagnostics: {
        aimgrAvailable,
        packageYamlAvailable,
        coderPackageInstalled,
        resourcesHealthy,
        opencodeCoderSkillMarkerAvailable,
      },
    };

    this.logger.info("Runtime phase classification resolved", {
      phase: classification.phase,
      missingRequiredSurfaces: classification.missingRequiredSurfaces,
      shouldExposeBootstrapInit: classification.shouldExposeBootstrapInit,
      shouldUseResourceBackedCommands: classification.shouldUseResourceBackedCommands,
      aimgrAvailable: classification.diagnostics.aimgrAvailable,
      coderPackageInstalled: classification.diagnostics.coderPackageInstalled,
      resourcesHealthy: classification.diagnostics.resourcesHealthy,
    });

    return classification;
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
    const mode = options?.startupMode ?? this.deriveMode(beadsInitialized, stealthMode);
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
    const runtimePhase = this.classifyRuntimePhase({
      aimgrAvailable: aimgrInstalled,
      packageYamlAvailable: packageYaml,
      coderPackageInstalled,
      resourcesHealthy,
    });

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
      runtimePhase,
    };

    this.writeProjectContext(context);

    this.logger.info("Project runtime context snapshot updated", {
      mode: context.mode,
      installReady: context.installReady,
      ecosystemReady: context.ecosystemReady,
      resourcesHealthy: context.aimgr.resourcesHealthy,
      coderPackageInstalled: context.aimgr.coderPackageInstalled,
      runtimePhase: context.runtimePhase.phase,
      missingRequiredSurfaces: context.runtimePhase.missingRequiredSurfaces,
      projectContextFile: ".coder/project.yaml",
    });

    this.logger.debug("Project detection completed", {
      durationMs: Date.now() - start,
      mode,
      installReady,
      ecosystemReady,
    });

    return context;
  }
}
