import { type Plugin } from "@opencode-ai/plugin";
import { access } from "fs/promises";
import { join } from "path";
import { createLogger, getVersionInfo, showToast } from "./core";
import { BeadsService, AimgrService, SessionExportService, ProjectDetectorService, type ProjectContext } from "./service";
import { createCoderTool } from "./tool";
import { isPluginDisabled } from "./config";
import { getInstallGuideTemplate } from "./templates";

const PROJECT_CONTEXT_TIMEOUT_MS = 30_000;
const PROJECT_CONTEXT_TIMEOUT = Symbol("project-context-timeout");

export const OpencodeCoder: Plugin = async ({ client, worktree }) => {
  const log = createLogger(client, worktree);
  const startTime = Date.now();

  log.info("OpencodeCoder plugin loading...");

  // 1. Check if plugin is disabled
  if (isPluginDisabled()) {
    log.info("OpencodeCoder plugin disabled via OPENCODE_CODER_DISABLED env var");
    return {};
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

  // 5. Only perform project-local startup management when .coder already exists.
  // This avoids creating files or mutating the project unless the user has
  // explicitly opted in via /init.
  const projectDetector = new ProjectDetectorService({ logger: log, workdir: worktree });
  const hasCoderDirectory = projectDetector.detectCoderDirectory();
  if (hasCoderDirectory) {
    log.enableFileLogging();
  }
  const aimgrInitStart = Date.now();
  const projectContextPromise: Promise<ProjectContext | null> = !hasCoderDirectory
    ? Promise.resolve(null)
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
            return projectDetector.detectAndWrite(versionInfo);
          }

          return projectDetector.detectAndWrite(versionInfo, {
            resourcesHealthyOverride: health.resourcesHealthy,
          });
        })
        .then((ctx) => {
          log.debug("Project context written to .coder/project.yaml", { ecosystemReady: ctx.ecosystemReady });
          return ctx;
        })
        .catch((err) => {
          log.error("Project detection failed", { error: String(err) });
          return null;
        });

  if (!hasCoderDirectory) {
    log.info(".coder directory not found, skipping startup project management");
  }

  // 6. Check beads availability and show toast if needed
  // Runs in the background and doesn't block plugin loading
  const beadsCheckStart = Date.now();
  beadsService.checkBeadsAvailability()
    .then(() => {
      log.debug("checkBeadsAvailability completed", { durationMs: Date.now() - beadsCheckStart });
    })
    .catch((err) => {
      log.error("Failed to check beads availability", { error: String(err) });
    });

  // 7. Log plugin load completion with timing
  const loadDurationMs = Date.now() - startTime;
  log.info("OpencodeCoder plugin loaded", { durationMs: loadDurationMs, beadsEnabled: beadsService.isBeadsEnabled() });

  return {
    tool: {
      coder: coderTool,
    },
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
      // Inject .coder/AGENTS.md into instructions (stealth mode support)
      const agentsPath = join(worktree, ".coder", "AGENTS.md");
      try {
        await access(agentsPath);
        input.instructions = input.instructions ?? [];
        input.instructions.push(".coder/AGENTS.md");
        log.info("Injected .coder/AGENTS.md into instructions");
      } catch {
        // File doesn't exist — no-op
      }

      // Always register /init so users can explicitly opt into setup.
      input.command = input.command ?? {};
      input.command["init"] = {
        template: getInstallGuideTemplate(),
        description: "Set up prerequisites for the opencode-coder plugin",
      };

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
      }
      log.info("Registered /init with installation guidance");

      // Set orchestrator as default agent when ecosystem is fully ready
      // and user hasn't explicitly configured a different default agent.
      // Note: default_agent is supported at runtime (OpenCode ≥1.2.15) but the
      // plugin SDK's v1 Config type definition hasn't been updated yet.
      const cfg = input as Record<string, unknown>;
      if (cfg["default_agent"]) {
        log.info("default_agent already configured, not overriding", {
          existingDefaultAgent: String(cfg["default_agent"]),
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
