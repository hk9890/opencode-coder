import { type Plugin } from "@opencode-ai/plugin";
import { access } from "fs/promises";
import { join } from "path";
import { createLogger, getVersionInfo, showToast } from "./core";
import {
  BeadsService,
  AimgrService,
  SessionExportService,
  ProjectDetectorService,
  PluginModeService,
  type RuntimePhaseClassification,
  type ProjectContext,
} from "./service";
import { createCoderTool } from "./tool";
import { getInstallGuideTemplate } from "./templates";

const PROJECT_CONTEXT_TIMEOUT_MS = 30_000;
const PROJECT_CONTEXT_TIMEOUT = Symbol("project-context-timeout");
const DOCS_LIFECYCLE_COMMANDS = ["opencode-coder/init-or-update-docs", "opencode-coder/improve-doc"] as const;
const LEGACY_DOCS_COMMAND = "opencode-coder/update-agent-md" as const;

export const OpencodeCoder: Plugin = async ({ client, worktree }) => {
  const log = createLogger(client, worktree);
  const startTime = Date.now();
  const emitRuntimeSignal = (signal: string, extra: Record<string, unknown>) => {
    log.info("Runtime diagnostic signal", {
      signal,
      ...extra,
    });
  };

  log.info("OpencodeCoder plugin loading...");

  const pluginModeService = new PluginModeService({ logger: log, workdir: worktree });
  const startupMode = pluginModeService.resolveStartupMode();

  if (startupMode.mode === "hard-disabled") {
    return {};
  }

  const projectDetector = new ProjectDetectorService({ logger: log, workdir: worktree });
  const activeMode = startupMode.mode === "stealth" || startupMode.mode === "team" ? startupMode.mode : null;

  if (activeMode) {
    log.enableFileLogging();
    emitRuntimeSignal("runtime.log_sink.project_local_enabled", {
      startupMode: activeMode,
      projectLogDir: ".coder/logs",
      openCodeLogSink: true,
      projectLocalLogSink: true,
    });
    log.info("Resolved active opencode-coder startup mode", {
      mode: activeMode,
      source: startupMode.source,
    });
    emitRuntimeSignal("runtime.startup_mode.resolved", {
      active: true,
      startupMode: activeMode,
      source: startupMode.source,
    });
  } else {
    log.info("Resolved inactive opencode-coder startup mode", {
      mode: startupMode.mode,
      source: startupMode.source,
    });
    emitRuntimeSignal("runtime.startup_mode.resolved", {
      active: false,
      startupMode: startupMode.mode,
      source: startupMode.source,
      openCodeLogSink: true,
      projectLocalLogSink: false,
    });
  }

  // 2. Create beads service
  const beadsStart = Date.now();
  const beadsService = new BeadsService({
    logger: log,
    client,
    workdir: worktree,
  });
  log.debug("BeadsService created", { durationMs: Date.now() - beadsStart });

  // 3. Create aimgr service
  const aimgrStart = Date.now();
  const aimgrService = new AimgrService({
    logger: log,
    client,
    workdir: worktree,
  });
  log.debug("AimgrService created", { durationMs: Date.now() - aimgrStart });

  // 4. Create session export service and coder tool
  const versionInfo = await getVersionInfo();
  const sessionExportService = new SessionExportService({ logger: log, client });
  const coderTool = createCoderTool({ sessionExportService, versionInfo });
  log.debug("Coder tool created");

  // 5. Only perform project-local startup management in active modes.
  const aimgrInitStart = Date.now();
  const projectContextPromise: Promise<ProjectContext | null> = !activeMode
    ? Promise.resolve(null)
    : (() => {
        const startupRuntimePhase = projectDetector.classifyRuntimePhase({
          aimgrAvailable: aimgrService.isAimgrAvailable(),
          packageYamlAvailable: aimgrService.hasPackageYaml(),
        });

        emitRuntimeSignal("runtime.phase.classified", {
          startupMode: activeMode,
          runtimePhase: startupRuntimePhase.phase,
          missingRequiredSurfaces: startupRuntimePhase.missingRequiredSurfaces,
          shouldBootstrap: startupRuntimePhase.shouldExposeBootstrapInit,
        });

        const contextPromise = startupRuntimePhase.phase === "normal"
          ? Promise.resolve()
              .then(() => {
                log.info("Runtime phase already normal from required resource surfaces; skipping startup bootstrap", {
                  runtimePhase: startupRuntimePhase.phase,
                  missingRequiredSurfaces: startupRuntimePhase.missingRequiredSurfaces,
                });
                return projectDetector.detectAndWrite(versionInfo, {
                  startupMode: activeMode,
                });
              })
          : aimgrService.autoInitialize()
              .then(() => {
                log.debug("aimgr autoInitialize completed", { durationMs: Date.now() - aimgrInitStart });
              })
              .catch((err) => {
                log.error("Failed to auto-initialize aimgr", { error: String(err) });
              })
              .then(() => aimgrService.verifyAndAutoRepairResources())
              .then((health) => {
                log.debug("aimgr verify/repair startup flow completed", {
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
            emitRuntimeSignal("runtime.project_context.available", {
              startupMode: activeMode,
              mode: ctx.mode,
              installReady: ctx.installReady,
              ecosystemReady: ctx.ecosystemReady,
              runtimePhase: ctx.runtimePhase.phase,
              missingRequiredSurfaces: ctx.runtimePhase.missingRequiredSurfaces,
              resourcesHealthy: ctx.aimgr.resourcesHealthy,
              coderPackageInstalled: ctx.aimgr.coderPackageInstalled,
            });
            log.debug("Project context written to .coder/project.yaml", { ecosystemReady: ctx.ecosystemReady });
            return ctx;
          })
          .catch((err) => {
            log.error("Project detection failed", { error: String(err) });
            return null;
          });
      })();

  if (!activeMode) {
    log.info("Project not explicitly enabled for active startup; exposing init entry point only", {
      mode: startupMode.mode,
      source: startupMode.source,
    });
  }

  // 6. Check beads availability and show toast if needed
  // Runs in the background and doesn't block plugin loading
  if (activeMode) {
    const beadsCheckStart = Date.now();
    beadsService.checkBeadsAvailability()
      .then(() => {
        log.debug("checkBeadsAvailability completed", { durationMs: Date.now() - beadsCheckStart });
      })
      .catch((err) => {
        log.error("Failed to check beads availability", { error: String(err) });
      });
  }

  // 7. Log plugin load completion with timing
  const loadDurationMs = Date.now() - startTime;
  log.info("OpencodeCoder plugin loaded", { durationMs: loadDurationMs, beadsEnabled: beadsService.isBeadsEnabled() });

  return {
    ...(activeMode
      ? {
          tool: {
            coder: coderTool,
          },
        }
      : {}),
    "command.execute.before": async (
      input: { command: string; sessionID: string; arguments: string },
      output: { parts: Array<any> }
    ) => {
      if (!input.arguments || !input.arguments.trim()) return;
      output.parts.push({
        type: "text",
        text: `<command-arguments>\nThe user provided these arguments when running this command:\n${input.arguments}\n</command-arguments>`,
      });
    },
    config: async (input) => {
      if (activeMode === "stealth") {
        const agentsPath = join(worktree, ".coder", "AGENTS.md");
        try {
          await access(agentsPath);
          input.instructions = input.instructions ?? [];
          input.instructions.push(".coder/AGENTS.md");
          log.info("Injected .coder/AGENTS.md into instructions");
        } catch {
          // File doesn't exist — no-op
        }
      }

      input.command = input.command ?? {};

      // Await project context once for default_agent decisions only.
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const projectContextResult = await Promise.race<ProjectContext | null | typeof PROJECT_CONTEXT_TIMEOUT>([
        projectContextPromise,
        new Promise<typeof PROJECT_CONTEXT_TIMEOUT>((resolve) => {
          timeoutHandle = setTimeout(() => resolve(PROJECT_CONTEXT_TIMEOUT), PROJECT_CONTEXT_TIMEOUT_MS);
        }),
      ]).finally(() => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      });

      const projectContext = projectContextResult === PROJECT_CONTEXT_TIMEOUT ? null : projectContextResult;
      if (projectContextResult === PROJECT_CONTEXT_TIMEOUT) {
        log.warn("Project context startup timed out; continuing in degraded mode", {
          timeoutMs: PROJECT_CONTEXT_TIMEOUT_MS,
        });
        emitRuntimeSignal("runtime.project_context.timeout", {
          timeoutMs: PROJECT_CONTEXT_TIMEOUT_MS,
          degradedMode: true,
          projectContextAvailable: false,
        });
      }

      const runtimePhase: RuntimePhaseClassification = projectContext?.runtimePhase ?? {
        phase: "bootstrap",
        missingRequiredSurfaces: ["project-context-unavailable"],
        shouldExposeBootstrapInit: true,
        shouldUseResourceBackedCommands: false,
        requiredSurfaceAvailability: {},
        optionalAgentAvailability: {},
        diagnostics: {
          aimgrAvailable: projectContext?.aimgr.installed ?? false,
          packageYamlAvailable: projectContext?.aimgr.packageYaml ?? false,
          coderPackageInstalled: projectContext?.aimgr.coderPackageInstalled ?? false,
          resourcesHealthy: projectContext?.aimgr.resourcesHealthy ?? false,
          opencodeCoderSkillMarkerAvailable: false,
        },
      };

      if (runtimePhase.shouldExposeBootstrapInit || !activeMode) {
        input.command["opencode-coder/init"] = {
          template: getInstallGuideTemplate(),
          description: "Bootstrap prerequisites for opencode-coder resources",
        };
      } else if (input.command["opencode-coder/init"]?.template === getInstallGuideTemplate()) {
        delete input.command["opencode-coder/init"];
      }

      const docsLifecycleResourcesAvailable = activeMode !== null && runtimePhase.shouldUseResourceBackedCommands;
      if (docsLifecycleResourcesAvailable) {
        emitRuntimeSignal("runtime.command_registration.docs_lifecycle", {
          startupMode: activeMode,
          action: "registered",
          projectContextAvailable: projectContext !== null,
          runtimePhase: runtimePhase.phase,
          missingRequiredSurfaces: runtimePhase.missingRequiredSurfaces,
          resourcesHealthy: projectContext?.aimgr.resourcesHealthy ?? null,
        });
      } else {
        for (const commandName of DOCS_LIFECYCLE_COMMANDS) {
          if (input.command[commandName]) {
            delete input.command[commandName];
          }
        }

        emitRuntimeSignal("runtime.command_registration.docs_lifecycle", {
          startupMode: activeMode,
          action: "suppressed",
          projectContextAvailable: projectContext !== null,
          runtimePhase: runtimePhase.phase,
          missingRequiredSurfaces: runtimePhase.missingRequiredSurfaces,
          resourcesHealthy: projectContext?.aimgr.resourcesHealthy ?? null,
        });
      }

      if (activeMode && !docsLifecycleResourcesAvailable) {
        log.info("Docs lifecycle commands not registered because runtime phase is bootstrap", {
          mode: activeMode,
          runtimePhase: runtimePhase.phase,
          missingRequiredSurfaces: runtimePhase.missingRequiredSurfaces,
          projectContextAvailable: projectContext !== null,
          resourcesHealthy: projectContext?.aimgr.resourcesHealthy ?? null,
        });
      }

      if (input.command[LEGACY_DOCS_COMMAND]) {
        delete input.command[LEGACY_DOCS_COMMAND];
      }

      if (runtimePhase.shouldExposeBootstrapInit || !activeMode) {
        log.info("Registered runtime Phase 1 /opencode-coder/init bootstrap template", {
          activeMode,
          runtimePhase: runtimePhase.phase,
        });
      } else {
        log.info("Runtime /opencode-coder/init bootstrap suppressed in Phase 2", {
          activeMode,
          runtimePhase: runtimePhase.phase,
        });
      }

      // Set orchestrator as default agent when ecosystem is fully ready
      // and user hasn't explicitly configured a different default agent.
      // Note: default_agent is supported at runtime (OpenCode ≥1.2.15) but the
      // plugin SDK's v1 Config type definition hasn't been updated yet.
      const cfg = input as Record<string, unknown>;
      if (cfg["default_agent"]) {
        log.info("default_agent already configured, not overriding", {
          existingDefaultAgent: String(cfg["default_agent"]),
        });
      } else if (!activeMode) {
        log.info("Plugin startup mode is inactive, not setting default_agent", {
          mode: startupMode.mode,
        });
      } else if (!projectContext) {
        log.info("Project context unavailable, not setting default_agent");
      } else if (!projectContext.ecosystemReady) {
        log.info("ecosystemReady=false, not setting default_agent to orchestrator", {
          ecosystemReady: projectContext.ecosystemReady,
        });
        void showToast(client, log, {
          title: "Orchestrator not enabled",
          message: "Orchestrator was not made the default agent because the project is not fully ready yet. Check aimgr/beads setup or run /opencode-coder/doctor.",
          variant: "warning",
          duration: 8000,
        }, "Failed to show orchestrator readiness toast");
      } else {
        cfg["default_agent"] = "orchestrator";
        log.info("Set default_agent to orchestrator (ecosystem ready)");
      }
    },
  };
};
