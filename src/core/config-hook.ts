import { access } from "fs/promises";
import { join } from "path";
import { getInstallGuideTemplate } from "../templates";
import { resolveStartupState, type StartupState } from "./startup-state";
import { showToast, type OpencodeClient } from "./opencode";
import { withTimeout } from "./with-timeout";
import type { Logger } from "./logger";
import type {
  ProjectContext,
} from "../service";

export const DOCS_LIFECYCLE_COMMANDS = [
  "opencode-coder/create-docs",
  "opencode-coder/init-or-update-docs",
  "opencode-coder/improve-doc",
  "opencode-coder/review-docs",
] as const;
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
  startupState: StartupState;
  projectContextPromise: Promise<ProjectContext | null>;
  projectContextTimeoutMs: number;
}

export function createConfigHook({
  logger,
  client,
  worktree,
  startupState,
  projectContextPromise,
  projectContextTimeoutMs,
}: ConfigHookDependencies) {
  return async (input: ConfigInput): Promise<void> => {
    if (startupState.activeMode === "stealth") {
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

    const resolvedState = resolveStartupState({
      startup: startupState,
      projectContext,
      timedOut,
    });

    if (resolvedState.timedOut) {
      logger.warn("Project context startup timed out; continuing in degraded mode", {
        timeoutMs: projectContextTimeoutMs,
      });
      logger.info("Runtime diagnostic signal", {
          signal: "runtime.project_context.timeout",
          timeoutMs: projectContextTimeoutMs,
          degradedMode: resolvedState.degraded,
          projectContextAvailable: resolvedState.projectContextAvailable,
        });
    }

    if (resolvedState.shouldExposeBootstrapInit) {
      input.command["opencode-coder/init"] = {
        template: getInstallGuideTemplate(),
        description: "Bootstrap prerequisites for opencode-coder resources",
      };
    } else if (input.command["opencode-coder/init"]?.template === getInstallGuideTemplate()) {
      delete input.command["opencode-coder/init"];
    }

    logger.info("Runtime diagnostic signal", {
      signal: "runtime.command_registration.docs_lifecycle",
      startupMode: startupState.activeMode,
      action: "not-gated",
      projectContextAvailable: resolvedState.projectContextAvailable,
      runtimePhase: resolvedState.runtimeCapability.phase,
      missingRequiredSurfaces: resolvedState.runtimeCapability.missingRequiredSurfaces,
      resourcesHealthy: resolvedState.projectContext?.aimgr.resourcesHealthy ?? null,
    });

    if (input.command[LEGACY_DOCS_COMMAND]) {
      delete input.command[LEGACY_DOCS_COMMAND];
    }

    if (resolvedState.shouldExposeBootstrapInit) {
      logger.info("Registered runtime Phase 1 /opencode-coder/init bootstrap template", {
        activeMode: startupState.activeMode,
        runtimePhase: resolvedState.runtimeCapability.phase,
      });
    } else {
      logger.info("Runtime /opencode-coder/init bootstrap suppressed in Phase 2", {
        activeMode: startupState.activeMode,
        runtimePhase: resolvedState.runtimeCapability.phase,
      });
    }

    const cfg = input as Record<string, unknown>;
    if (cfg["default_agent"]) {
      logger.info("default_agent already configured, not overriding", {
        existingDefaultAgent: String(cfg["default_agent"]),
      });
    } else {
      const beadsReadinessDetails = getBeadsReadinessDetails(resolvedState.projectContext);
      switch (resolvedState.defaultAgentDecision) {
        case "inactive-mode":
          logger.info("Plugin startup mode is inactive, not setting default_agent", {
            mode: startupState.startupMode.mode,
          });
          break;
        case "project-context-unavailable":
          logger.info("Project context unavailable, not setting default_agent");
          break;
        case "beads-not-ready":
          logger.info("beadsReady=false, not setting default_agent to orchestrator", {
            beadsReady: resolvedState.projectContext?.beadsReady ?? false,
            ...beadsReadinessDetails,
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
          break;
        case "set-orchestrator":
          cfg["default_agent"] = "orchestrator";
          logger.info("Set default_agent to orchestrator (beads ready)", {
            beadsReady: resolvedState.projectContext?.beadsReady ?? false,
            ...beadsReadinessDetails,
          });
          break;
      }
    }
  };
}

function getBeadsReadinessDetails(projectContext: ProjectContext | null): Record<string, unknown> {
  const beads = projectContext?.beads;

  if (!beads) {
    return {
      missingBeadsReadinessRequirements: ["project-context-unavailable"],
    };
  }

  const missingBeadsReadinessRequirements = [
    beads.coderBeadsSkillAvailable ? null : "skill/coder-beads",
    beads.orchestratorAgentAvailable ? null : "agent/orchestrator",
    beads.bdCliInstalled ? null : "bd-cli",
    beads.initialized ? null : ".beads",
  ].filter((value): value is string => value !== null);

  return {
    beadsInitialized: beads.initialized,
    bdCliInstalled: beads.bdCliInstalled,
    coderBeadsSkillAvailable: beads.coderBeadsSkillAvailable,
    orchestratorAgentAvailable: beads.orchestratorAgentAvailable,
    missingBeadsReadinessRequirements,
  };
}
