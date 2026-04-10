import type { Logger } from "./logger";
import type { VersionInfo } from "./version";
import type {
  AimgrService,
  ProjectContext,
  ProjectDetectorService,
  RuntimePhaseClassification,
  SavedPluginMode,
} from "../service";

export interface StartupFlowDependencies {
  logger: Logger;
  activeMode: Exclude<SavedPluginMode, "disabled">;
  versionInfo: VersionInfo;
  projectDetector: ProjectDetectorService;
  aimgrService: AimgrService;
}

export async function runProjectStartupFlow({
  logger,
  activeMode,
  versionInfo,
  projectDetector,
  aimgrService,
}: StartupFlowDependencies): Promise<ProjectContext | null> {
  const aimgrInitStart = Date.now();
  const startupRuntimePhase = projectDetector.classifyRuntimePhase();

  logger.info("Runtime diagnostic signal", {
    signal: "runtime.phase.classified",
    startupMode: activeMode,
    runtimePhase: startupRuntimePhase.phase,
    missingRequiredSurfaces: startupRuntimePhase.missingRequiredSurfaces,
    shouldBootstrap: startupRuntimePhase.shouldExposeBootstrapInit,
  });

  const contextPromise = startupRuntimePhase.phase === "normal"
    ? Promise.resolve()
        .then(() => {
          logger.info("Runtime phase already normal from required resource surfaces; skipping startup bootstrap", {
            runtimePhase: startupRuntimePhase.phase,
            missingRequiredSurfaces: startupRuntimePhase.missingRequiredSurfaces,
          });
          return projectDetector.detectAndWrite(versionInfo, {
            startupMode: activeMode,
          });
        })
    : aimgrService.autoInitialize()
        .then(() => {
          logger.debug("aimgr autoInitialize completed", { durationMs: Date.now() - aimgrInitStart });
        })
        .catch((err) => {
          logger.error("Failed to auto-initialize aimgr", { error: String(err) });
        })
        .then(() => aimgrService.verifyAndAutoRepairResources())
        .then((health) => {
          logger.debug("aimgr verify/repair startup flow completed", {
            durationMs: Date.now() - aimgrInitStart,
            repairAttempted: health.repairAttempted,
            repairSucceeded: health.repairSucceeded,
            resourcesHealthy: health.resourcesHealthy,
          });
          if (health.verifyResult === null) {
            return projectDetector.detectAndWrite(versionInfo, {
              startupMode: activeMode,
            });
          }

          return projectDetector.detectAndWrite(versionInfo, {
            startupMode: activeMode,
            resourcesHealthyOverride: health.resourcesHealthy,
          });
        });

  return contextPromise
    .then((ctx) => {
      logger.info("Runtime diagnostic signal", {
        signal: "runtime.project_context.available",
        startupMode: activeMode,
        mode: ctx.mode,
        installReady: ctx.installReady,
        ecosystemReady: ctx.ecosystemReady,
        runtimePhase: ctx.runtimePhase.phase,
        missingRequiredSurfaces: ctx.runtimePhase.missingRequiredSurfaces,
        resourcesHealthy: ctx.aimgr.resourcesHealthy,
        coderPackageInstalled: ctx.aimgr.coderPackageInstalled,
      });
      logger.debug("Project context written to .coder/project.yaml", { ecosystemReady: ctx.ecosystemReady });
      return ctx;
    })
    .catch((err) => {
      logger.error("Project detection failed", { error: String(err) });
      return null;
    });
}

export function getFallbackRuntimePhase(projectContext: ProjectContext | null): RuntimePhaseClassification {
  return projectContext?.runtimePhase ?? {
    phase: "bootstrap",
    missingRequiredSurfaces: ["project-context-unavailable"],
    shouldExposeBootstrapInit: true,
    shouldUseResourceBackedCommands: false,
  };
}
