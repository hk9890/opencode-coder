import { access } from "fs/promises";
import { join } from "path";
import { getInstallGuideTemplate } from "../templates";
import { showToast, type OpencodeClient } from "./opencode";
import { withTimeout } from "./with-timeout";
import type { Logger } from "./logger";
import type {
  PluginModeResolution,
  ProjectContext,
  RuntimePhaseClassification,
  SavedPluginMode,
} from "../service";

export const DOCS_LIFECYCLE_COMMANDS = ["opencode-coder/init-or-update-docs", "opencode-coder/improve-doc"] as const;
export const LEGACY_DOCS_COMMAND = "opencode-coder/update-agent-md" as const;

interface ConfigInput {
  instructions?: string[];
  command?: Record<string, { template?: string; description?: string }>;
  [key: string]: unknown;
}

export interface ConfigHookDependencies {
  logger: Logger;
  client: OpencodeClient;
  worktree: string;
  startupMode: PluginModeResolution;
  activeMode: Exclude<SavedPluginMode, "disabled"> | null;
  projectContextPromise: Promise<ProjectContext | null>;
  projectContextTimeoutMs: number;
}

export function createConfigHook({
  logger,
  client,
  worktree,
  startupMode,
  activeMode,
  projectContextPromise,
  projectContextTimeoutMs,
}: ConfigHookDependencies) {
  return async (input: ConfigInput): Promise<void> => {
    if (activeMode === "stealth") {
      const agentsPath = join(worktree, ".coder", "AGENTS.md");
      try {
        await access(agentsPath);
        input.instructions = input.instructions ?? [];
        input.instructions.push(".coder/AGENTS.md");
        logger.info("Injected .coder/AGENTS.md into instructions");
      } catch {
        // File doesn't exist — no-op
      }
    }

    input.command = input.command ?? {};

    const projectContextWrapper = await withTimeout(
      projectContextPromise.then((context) => ({ context })),
      projectContextTimeoutMs,
    );

    const timedOut = projectContextWrapper === null;
    const projectContext = projectContextWrapper?.context ?? null;

    if (timedOut) {
      logger.warn("Project context startup timed out; continuing in degraded mode", {
        timeoutMs: projectContextTimeoutMs,
      });
      logger.info("Runtime diagnostic signal", {
        signal: "runtime.project_context.timeout",
        timeoutMs: projectContextTimeoutMs,
        degradedMode: true,
        projectContextAvailable: false,
      });
    }

    const runtimePhase: RuntimePhaseClassification = getRuntimePhase(projectContext);

    if (runtimePhase.shouldExposeBootstrapInit || !activeMode) {
      input.command["opencode-coder/init"] = {
        template: getInstallGuideTemplate(),
        description: "Bootstrap prerequisites for opencode-coder resources",
      };
    } else if (input.command["opencode-coder/init"]?.template === getInstallGuideTemplate()) {
      delete input.command["opencode-coder/init"];
    }

    logger.info("Runtime diagnostic signal", {
      signal: "runtime.command_registration.docs_lifecycle",
      startupMode: activeMode,
      action: "not-gated",
      projectContextAvailable: projectContext !== null,
      runtimePhase: runtimePhase.phase,
      missingRequiredSurfaces: runtimePhase.missingRequiredSurfaces,
      resourcesHealthy: projectContext?.aimgr.resourcesHealthy ?? null,
    });

    if (input.command[LEGACY_DOCS_COMMAND]) {
      delete input.command[LEGACY_DOCS_COMMAND];
    }

    if (runtimePhase.shouldExposeBootstrapInit || !activeMode) {
      logger.info("Registered runtime Phase 1 /opencode-coder/init bootstrap template", {
        activeMode,
        runtimePhase: runtimePhase.phase,
      });
    } else {
      logger.info("Runtime /opencode-coder/init bootstrap suppressed in Phase 2", {
        activeMode,
        runtimePhase: runtimePhase.phase,
      });
    }

    const cfg = input as Record<string, unknown>;
    if (cfg["default_agent"]) {
      logger.info("default_agent already configured, not overriding", {
        existingDefaultAgent: String(cfg["default_agent"]),
      });
    } else if (!activeMode) {
      logger.info("Plugin startup mode is inactive, not setting default_agent", {
        mode: startupMode.mode,
      });
    } else if (!projectContext) {
      logger.info("Project context unavailable, not setting default_agent");
    } else if (!projectContext.beadsReady) {
      logger.info("beadsReady=false, not setting default_agent to orchestrator", {
        beadsReady: projectContext.beadsReady,
      });
      void showToast(
        client,
        logger,
        {
          title: "Orchestrator not enabled",
          message:
            "Orchestrator was not made the default agent because beads runtime prerequisites are not ready yet. Check coder-beads/orchestrator markers, bd setup, or run /opencode-coder/doctor.",
          variant: "warning",
          duration: 8000,
        },
        "Failed to show orchestrator readiness toast",
      );
    } else {
      cfg["default_agent"] = "orchestrator";
      logger.info("Set default_agent to orchestrator (beads ready)");
    }
  };
}

function getRuntimePhase(projectContext: ProjectContext | null): RuntimePhaseClassification {
  return projectContext?.runtimePhase ?? {
    phase: "bootstrap",
    coreAvailable: false,
    bootstrapRequired: true,
    missingRequiredSurfaces: ["project-context-unavailable"],
    shouldExposeBootstrapInit: true,
  };
}
