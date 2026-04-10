import { type Plugin } from "@opencode-ai/plugin";
import {
  createConfigHook,
  createLogger,
  getVersionInfo,
  runProjectStartupFlow,
} from "./core";
import {
  AimgrService,
  BeadsService,
  PluginModeService,
  ProjectDetectorService,
  SessionExportService,
  type ProjectContext,
} from "./service";
import { createCoderTool } from "./tool";

const PROJECT_CONTEXT_TIMEOUT_MS = 30_000;

export const OpencodeCoder: Plugin = async ({ client, worktree }) => {
  const log = createLogger(client, worktree);
  const startTime = Date.now();

  log.info("OpencodeCoder plugin loading...");

  const pluginModeService = new PluginModeService({ logger: log, workdir: worktree });
  const startupMode = pluginModeService.resolveStartupMode();
  if (startupMode.mode === "hard-disabled") {
    return {};
  }

  const activeMode = startupMode.mode === "stealth" || startupMode.mode === "team" ? startupMode.mode : null;
  if (activeMode) {
    log.enableFileLogging();
    log.info("Runtime diagnostic signal", {
      signal: "runtime.log_sink.project_local_enabled",
      startupMode: activeMode,
      projectLogDir: ".coder/logs",
      openCodeLogSink: true,
      projectLocalLogSink: true,
    });
    log.info("Resolved active opencode-coder startup mode", { mode: activeMode, source: startupMode.source });
    log.info("Runtime diagnostic signal", {
      signal: "runtime.startup_mode.resolved",
      active: true,
      startupMode: activeMode,
      source: startupMode.source,
    });
  } else {
    log.info("Resolved inactive opencode-coder startup mode", { mode: startupMode.mode, source: startupMode.source });
    log.info("Runtime diagnostic signal", {
      signal: "runtime.startup_mode.resolved",
      active: false,
      startupMode: startupMode.mode,
      source: startupMode.source,
      openCodeLogSink: true,
      projectLocalLogSink: false,
    });
  }

  const projectDetector = new ProjectDetectorService({ logger: log, workdir: worktree });
  const beadsService = new BeadsService({ logger: log, client, workdir: worktree });
  const aimgrService = new AimgrService({ logger: log, client, workdir: worktree });
  const versionInfo = await getVersionInfo();
  const sessionExportService = new SessionExportService({ logger: log, client });
  const coderTool = createCoderTool({ sessionExportService, versionInfo });

  const projectContextPromise: Promise<ProjectContext | null> = activeMode
    ? runProjectStartupFlow({ logger: log, activeMode, versionInfo, projectDetector, aimgrService })
    : Promise.resolve(null);

  if (!activeMode) {
    log.info("Project not explicitly enabled for active startup; exposing init entry point only", {
      mode: startupMode.mode,
      source: startupMode.source,
    });
  } else {
    void beadsService.checkBeadsAvailability().catch((err) => {
      log.error("Failed to check beads availability", { error: String(err) });
    });
  }

  log.info("OpencodeCoder plugin loaded", {
    durationMs: Date.now() - startTime,
    beadsEnabled: beadsService.isBeadsEnabled(),
  });

  return {
    ...(activeMode ? { tool: { coder: coderTool } } : {}),
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
    config: createConfigHook({
      logger: log,
      client,
      worktree,
      startupMode,
      activeMode,
      projectContextPromise,
      projectContextTimeoutMs: PROJECT_CONTEXT_TIMEOUT_MS,
    }),
  };
};
