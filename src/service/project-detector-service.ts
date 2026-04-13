import * as fs from "fs";
import * as path from "path";
import {
  detectAimgrAvailable,
  detectBdCliAvailable,
  detectBeadsDirectory,
  detectPackageYaml,
  detectStealthMarker,
  type Logger,
  type VersionInfo,
  verifyAimgrResources,
} from "../core";
import { hasResourceIssues } from "./aimgr-service";
import { ProjectContextWriter } from "./project-context-writer";
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
   * Must be explicitly provided by the caller.
   */
  startupMode: Exclude<SavedPluginMode, "disabled">;
}

export interface ProjectDetectionFacts {
  gitInitialized: boolean;
  beadsInitialized: boolean;
  stealthMode: boolean;
  bdCliInstalled: boolean;
  aimgrInstalled: boolean;
  packageYaml: boolean;
  resourcesHealthy: boolean;
  runtimePhase: RuntimePhaseClassification;
  coderBeadsSkillAvailable: boolean;
  orchestratorAgentAvailable: boolean;
  beadsReady: boolean;
}

export type RuntimePhase = "bootstrap" | "normal";

export interface RuntimePhaseClassification {
  /** Runtime phase based on minimal core resource surfaces available on disk. */
  phase: RuntimePhase;
  /** Whether minimal coder-core runtime surfaces are available. */
  coreAvailable: boolean;
  /** Whether bootstrap fallback behavior is required this session. */
  bootstrapRequired: boolean;
  /** Missing required high-level resource surfaces for minimal core threshold. */
  missingRequiredSurfaces: string[];
  /** Whether runtime should register bootstrap /opencode-coder/init in this session. */
  shouldExposeBootstrapInit: boolean;
}

/**
 * Detected project context written to .coder/project.yaml during active startup.
 */
export interface ProjectContext {
  /** Overall operational mode for the active project state */
  mode: "stealth" | "team" | "uninitialized";

  /** Whether minimal coder-core runtime surfaces are available on disk. */
  coreAvailable: boolean;

  /** Whether runtime should stay in bootstrap mode and expose fallback init. */
  bootstrapRequired: boolean;

  /**
   * True when beads-specific runtime behavior is safe to activate.
   *
   * Formula:
   * coder-beads skill marker && orchestrator agent marker && bd CLI installed && .beads initialized
   */
  beadsReady: boolean;

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
    /** Whether coder-beads skill marker is available */
    coderBeadsSkillAvailable: boolean;
    /** Whether orchestrator agent markdown is available */
    orchestratorAgentAvailable: boolean;
  };

  /** aimgr AI-resource-manager status */
  aimgr: {
    /** Whether the aimgr CLI is available on PATH */
    installed: boolean;
    /** Whether ai.package.yaml exists */
    packageYaml: boolean;
    /** Whether aimgr verify reports no issues (false when aimgr is not installed) */
    resourcesHealthy: boolean;
  };

  /** Plugin version string */
  pluginVersion: string;

  /** Explicit two-phase runtime classification for command registration/gating. */
  runtimePhase: RuntimePhaseClassification;
}

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
  private readonly projectContextWriter: ProjectContextWriter;

  constructor(options: ProjectDetectorServiceOptions) {
    this.logger = options.logger;
    this.workdir = options.workdir ?? process.cwd();
    this.projectContextWriter = new ProjectContextWriter({
      logger: this.logger,
      workdir: this.workdir,
    });
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
   * specifically opencode-coder init command + coder-core skill marker,
   * regardless of whether they arrived via `aimgr install package/coder-core`
   * or equivalent manual copying.
   */
  classifyRuntimePhase(): RuntimePhaseClassification {
    const initCommandAvailable = this.detectResourcePath(path.join(".opencode", "commands", "opencode-coder", "init.md"));
    const coderCoreSkillAvailable = this.detectResourcePath(path.join(".opencode", "skills", "coder-core", "SKILL.md"));
    const coreAvailable = initCommandAvailable && coderCoreSkillAvailable;
    const bootstrapRequired = !coreAvailable;

    const missingRequiredSurfaces: string[] = [];
    if (!initCommandAvailable) {
      missingRequiredSurfaces.push("command/opencode-coder/init");
    }
    if (!coderCoreSkillAvailable) {
      missingRequiredSurfaces.push("skill/coder-core");
    }

    const classification: RuntimePhaseClassification = {
      phase: coreAvailable ? "normal" : "bootstrap",
      coreAvailable,
      bootstrapRequired,
      missingRequiredSurfaces,
      shouldExposeBootstrapInit: bootstrapRequired,
    };

    this.logger.info("Runtime phase classification resolved", {
      phase: classification.phase,
      coreAvailable: classification.coreAvailable,
      bootstrapRequired: classification.bootstrapRequired,
      missingRequiredSurfaces: classification.missingRequiredSurfaces,
      shouldExposeBootstrapInit: classification.shouldExposeBootstrapInit,
    });
    return classification;
  }

  collectFacts(options?: { resourcesHealthyOverride?: boolean }): ProjectDetectionFacts {
    const gitInitialized = this.detectGitInitialized();
    const beadsInitialized = this.detectBeadsInitialized();
    const stealthMode = this.detectStealthMode();
    const bdCliInstalled = this.detectBdCliInstalled();

    const aimgrInstalled = this.detectAimgrInstalled();
    const packageYaml = this.detectPackageYaml();
    const resourcesHealthy =
      options?.resourcesHealthyOverride !== undefined
        ? options.resourcesHealthyOverride
        : aimgrInstalled
          ? this.detectResourcesHealthy(aimgrInstalled)
          : false;

    const runtimePhase = this.classifyRuntimePhase();

    const coderBeadsSkillAvailable = this.detectResourcePath(path.join(".opencode", "skills", "coder-beads", "SKILL.md"));
    const orchestratorAgentAvailable = this.detectResourcePath(path.join(".opencode", "agents", "orchestrator.md"));
    const beadsReady = coderBeadsSkillAvailable && orchestratorAgentAvailable && bdCliInstalled && beadsInitialized;

    return {
      gitInitialized,
      beadsInitialized,
      stealthMode,
      bdCliInstalled,
      aimgrInstalled,
      packageYaml,
      resourcesHealthy,
      runtimePhase,
      coderBeadsSkillAvailable,
      orchestratorAgentAvailable,
      beadsReady,
    };
  }

  assembleContext(args: {
    startupMode: Exclude<SavedPluginMode, "disabled">;
    versionInfo: VersionInfo;
    facts: ProjectDetectionFacts;
  }): ProjectContext {
    const { startupMode, versionInfo, facts } = args;

    return {
      mode: startupMode,
      coreAvailable: facts.runtimePhase.coreAvailable,
      bootstrapRequired: facts.runtimePhase.bootstrapRequired,
      beadsReady: facts.beadsReady,
      git: {
        initialized: facts.gitInitialized,
      },
      beads: {
        initialized: facts.beadsInitialized,
        stealthMode: facts.stealthMode,
        bdCliInstalled: facts.bdCliInstalled,
        coderBeadsSkillAvailable: facts.coderBeadsSkillAvailable,
        orchestratorAgentAvailable: facts.orchestratorAgentAvailable,
      },
      aimgr: {
        installed: facts.aimgrInstalled,
        packageYaml: facts.packageYaml,
        resourcesHealthy: facts.resourcesHealthy,
      },
      pluginVersion: versionInfo.version,
      runtimePhase: facts.runtimePhase,
    };
  }

  writeProjectContext(context: ProjectContext): void {
    this.projectContextWriter.write(context);
  }

  // ---------------------------------------------------------------------------
  // Main orchestration
  // ---------------------------------------------------------------------------

  /**
   * Detect all project facts, build a `ProjectContext` object, and write it
   * to `.coder/project.yaml`.
   *
   * This method is designed to be called from plugin startup. All errors
   * during individual detections are caught internally; startup mode must
   * be provided explicitly by the caller.
   *
   * @returns The detected project context.
   */
  detectAndWrite(versionInfo: VersionInfo, options: ProjectDetectionOptions): ProjectContext {
    if (!options || !options.startupMode) {
      throw new Error("ProjectDetectorService.detectAndWrite requires an explicit startupMode");
    }

    const start = Date.now();
    this.logger.debug("Starting project detection", { workdir: this.workdir });

    const facts = this.collectFacts(
      options.resourcesHealthyOverride !== undefined
        ? { resourcesHealthyOverride: options.resourcesHealthyOverride }
        : undefined
    );

    const context = this.assembleContext({
      startupMode: options.startupMode,
      versionInfo,
      facts,
    });

    this.writeProjectContext(context);

    this.logger.info("Project runtime context snapshot updated", {
      mode: context.mode,
      coreAvailable: context.coreAvailable,
      bootstrapRequired: context.bootstrapRequired,
      beadsReady: context.beadsReady,
      resourcesHealthy: context.aimgr.resourcesHealthy,
      runtimePhase: context.runtimePhase.phase,
      missingRequiredSurfaces: context.runtimePhase.missingRequiredSurfaces,
      projectContextFile: ".coder/project.yaml",
    });

    this.logger.debug("Project detection completed", {
      durationMs: Date.now() - start,
      mode: context.mode,
      coreAvailable: context.coreAvailable,
      bootstrapRequired: context.bootstrapRequired,
      beadsReady: context.beadsReady,
    });

    return context;
  }
}
