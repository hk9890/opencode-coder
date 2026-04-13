import type { Logger } from "./logger";
import { getFallbackRuntimeCapability, type StartupState } from "./startup-state";
import type { VersionInfo } from "./version";
import type {
  AimgrService,
  ProjectContext,
  ProjectDetectorService,
  RuntimePhaseClassification,
} from "../service";

export interface StartupFlowDependencies {
  logger: Logger;
  startupState: StartupState;
  versionInfo: VersionInfo;
  projectDetector: ProjectDetectorService;
  aimgrService: AimgrService;
}

export async function runProjectStartupFlow({
  logger,
  startupState,
  versionInfo,
  projectDetector,
  aimgrService,
}: StartupFlowDependencies): Promise<ProjectContext | null> {
  const activeMode = startupState.activeMode;
  if (!activeMode) {
    return null;
  }

  const aimgrInitStart = Date.now();
  const startupRuntimePhase = startupState.runtimeCapability;

  logger.info("Runtime diagnostic signal", {
    signal: "runtime.phase.classified",
    startupMode: startupState.activeMode,
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
            verifyAvailable: health.verify.available,
            repairAttempted: health.repair.attempted,
            repairHealthy: health.repair.healthy,
            resourcesHealthy: health.verify.healthy,
          });
          if (!health.verify.available) {
            return projectDetector.detectAndWrite(versionInfo, {
              startupMode: activeMode,
            });
          }

          return projectDetector.detectAndWrite(versionInfo, {
            startupMode: activeMode,
            resourcesHealthyOverride: health.verify.healthy,
          });
        });

  return contextPromise
    .then((ctx) => {
      logger.info("Runtime diagnostic signal", {
        signal: "runtime.project_context.available",
        startupMode: startupState.activeMode,
        mode: ctx.mode,
        coreAvailable: ctx.coreAvailable,
        bootstrapRequired: ctx.bootstrapRequired,
        beadsReady: ctx.beadsReady,
        runtimePhase: ctx.runtimePhase.phase,
        missingRequiredSurfaces: ctx.runtimePhase.missingRequiredSurfaces,
        resourcesHealthy: ctx.aimgr.resourcesHealthy,
      });
      logger.debug("Project context written to .coder/project.yaml", {
        coreAvailable: ctx.coreAvailable,
        bootstrapRequired: ctx.bootstrapRequired,
        beadsReady: ctx.beadsReady,
      });
      return ctx;
    })
    .catch((err) => {
      logger.error("Project detection failed", { error: String(err) });
      return null;
    });
}

export function getFallbackRuntimePhase(projectContext: ProjectContext | null): RuntimePhaseClassification {
  return projectContext?.runtimePhase ?? getFallbackRuntimeCapability();
}
