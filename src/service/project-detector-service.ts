import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { stringify } from "yaml";
import {
  AIMGR_COMMAND_TIMEOUT_MS,
  detectAimgrAvailable,
  detectBdCliAvailable,
  detectBeadsDirectory,
  detectPackageYaml,
  detectStealthMarker,
  isExecTimeoutError,
  type Logger,
  type VersionInfo,
  verifyAimgrResources,
} from "../core";
import { hasResourceIssues } from "./aimgr-service";
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
  /** Runtime phase based on minimal core resource surfaces available on disk. */
  phase: RuntimePhase;
  /** Missing required high-level resource surfaces for minimal core threshold. */
  missingRequiredSurfaces: string[];
  /** Whether runtime should register bootstrap /opencode-coder/init in this session. */
  shouldExposeBootstrapInit: boolean;
  /** Whether runtime should rely on resource-backed opencode-coder commands. */
  shouldUseResourceBackedCommands: boolean;
}

export interface RuntimeSurfaceDiagnostics {
  commandSurfaceAvailability: Record<string, boolean>;
  skillSurfaceAvailability: Record<string, boolean>;
  skillReferenceAvailability: Record<string, boolean>;
  optionalAgentAvailability: Record<string, boolean>;
  requiredSurfaceAvailability: Record<string, boolean>;
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
    return detectBeadsDirectory(this.workdir, this.logger);
  }

  /**
   * Check whether the stealth-mode marker is present in .git/info/exclude.
   */
  detectStealthMode(): boolean {
    return detectStealthMarker(this.workdir, this.logger);
  }

  /**
   * Check whether the bd CLI is available on PATH.
   */
  detectBdCliInstalled(): boolean {
    return detectBdCliAvailable(this.workdir, this.logger);
  }

  // ---------------------------------------------------------------------------
  // aimgr detection
  // ---------------------------------------------------------------------------

  /**
   * Check whether the aimgr CLI is available on PATH.
   */
  detectAimgrInstalled(): boolean {
    return detectAimgrAvailable(this.workdir, this.logger);
  }

  /**
   * Check whether ai.package.yaml exists in the working directory.
   */
  detectPackageYaml(): boolean {
    return detectPackageYaml(this.workdir, this.logger);
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

    const result = verifyAimgrResources(this.workdir, { logger: this.logger });
    if (result === null) {
      return false;
    }

    return !hasResourceIssues(result);
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
   * Normal mode = minimal core surfaces exist on disk,
   * specifically opencode-coder init command + opencode-coder skill marker,
   * regardless of whether they arrived via `aimgr install package/opencode-coder`
   * or equivalent manual copying.
   */
  classifyRuntimePhase(): RuntimePhaseClassification {
    const requiredSurfacesComplete =
      this.detectResourcePath(path.join(".opencode", "commands", "opencode-coder", "init.md")) &&
      this.detectResourcePath(path.join(".opencode", "skills", "opencode-coder", "SKILL.md"));
    const classification: RuntimePhaseClassification = {
      phase: requiredSurfacesComplete ? "normal" : "bootstrap",
      missingRequiredSurfaces: requiredSurfacesComplete ? [] : ["resource/opencode-coder"],
      shouldExposeBootstrapInit: !requiredSurfacesComplete,
      shouldUseResourceBackedCommands: requiredSurfacesComplete,
    };

    this.logger.info("Runtime phase classification resolved", {
      phase: classification.phase,
      missingRequiredSurfaces: classification.missingRequiredSurfaces,
      shouldExposeBootstrapInit: classification.shouldExposeBootstrapInit,
      shouldUseResourceBackedCommands: classification.shouldUseResourceBackedCommands,
    });
    return classification;
  }

  collectSurfaceDiagnostics(overrides?: RuntimePhaseDiagnosticsOverride): RuntimeSurfaceDiagnostics {
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

    const optionalAgentAvailability: Record<string, boolean> = {};
    for (const agent of PHASE2_OPTIONAL_AGENT_SURFACES) {
      optionalAgentAvailability[`agent/${agent}`] = this.detectResourcePath(path.join(".opencode", "agents", `${agent}.md`));
    }

    const aimgrAvailable = overrides?.aimgrAvailable ?? this.detectAimgrInstalled();
    const packageYamlAvailable = overrides?.packageYamlAvailable ?? this.detectPackageYaml();
    const coderPackageInstalled = overrides?.coderPackageInstalled ?? (aimgrAvailable ? this.detectCoderPackageInstalled() : false);
    const resourcesHealthy = overrides?.resourcesHealthy ?? (aimgrAvailable ? this.detectResourcesHealthy(aimgrAvailable) : false);

    return {
      commandSurfaceAvailability,
      skillSurfaceAvailability,
      skillReferenceAvailability,
      optionalAgentAvailability,
      requiredSurfaceAvailability: {
        "resource/opencode-coder":
          commandSurfaceAvailability["command/opencode-coder/init"] === true &&
          skillSurfaceAvailability["skill/opencode-coder"] === true,
      },
      diagnostics: {
        aimgrAvailable,
        packageYamlAvailable,
        coderPackageInstalled,
        resourcesHealthy,
        opencodeCoderSkillMarkerAvailable: Object.values(skillSurfaceAvailability).every(Boolean),
      },
    };
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
    const mode = options?.startupMode ?? (stealthMode ? "stealth" : beadsInitialized ? "team" : "uninitialized");
    const installReady = gitInitialized && bdCliInstalled && aimgrInstalled && coderPackageInstalled;
    const ecosystemReady = gitInitialized && beadsInitialized && aimgrInstalled && packageYaml && resourcesHealthy;
    const runtimePhase = this.classifyRuntimePhase();

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
