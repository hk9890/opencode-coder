import { describe, expect, it } from "bun:test";
import { createStartupState, getFallbackRuntimeCapability, resolveStartupState } from "../../src/core/startup-state";
import type { PluginModeResolution, ProjectContext, RuntimePhaseClassification } from "../../src/service";

function startupMode(mode: PluginModeResolution["mode"], source: PluginModeResolution["source"] = "saved"): PluginModeResolution {
  return {
    mode,
    source,
    stateFilePath: "/tmp/.coder/opencode-coder.yaml",
  };
}

function runtimePhase(overrides?: Partial<RuntimePhaseClassification>): RuntimePhaseClassification {
  return {
    phase: "normal",
    coreAvailable: true,
    bootstrapRequired: false,
    missingRequiredSurfaces: [],
    shouldExposeBootstrapInit: false,
    ...overrides,
  };
}

function projectContext(overrides?: Partial<ProjectContext>): ProjectContext {
  return {
    mode: "team",
    coreAvailable: true,
    bootstrapRequired: false,
    beadsReady: true,
    git: { initialized: true },
    beads: {
      initialized: true,
      stealthMode: false,
      bdCliInstalled: true,
      coderBeadsSkillAvailable: true,
      orchestratorAgentAvailable: true,
    },
    aimgr: {
      installed: true,
      packageYaml: true,
      resourcesHealthy: true,
    },
    pluginVersion: "1.0.0",
    runtimePhase: runtimePhase(),
    ...overrides,
  };
}

describe("startup-state", () => {
  it("createStartupState() marks team and stealth as active", () => {
    const team = createStartupState({ startupMode: startupMode("team"), runtimeCapability: runtimePhase() });
    const stealth = createStartupState({ startupMode: startupMode("stealth"), runtimeCapability: runtimePhase() });

    expect(team.isActive).toBe(true);
    expect(team.activeMode).toBe("team");
    expect(team.shouldRunProjectStartupFlow).toBe(true);
    expect(team.shouldEnableCoderTool).toBe(true);

    expect(stealth.isActive).toBe(true);
    expect(stealth.activeMode).toBe("stealth");
    expect(stealth.shouldRunProjectStartupFlow).toBe(true);
    expect(stealth.shouldEnableCoderTool).toBe(true);
  });

  it("createStartupState() keeps disabled/not-enabled/hard-disabled inactive", () => {
    const disabled = createStartupState({ startupMode: startupMode("disabled"), runtimeCapability: runtimePhase() });
    const notEnabled = createStartupState({ startupMode: startupMode("not-enabled"), runtimeCapability: runtimePhase() });
    const hardDisabled = createStartupState({ startupMode: startupMode("hard-disabled", "env"), runtimeCapability: runtimePhase() });

    expect(disabled.isActive).toBe(false);
    expect(disabled.activeMode).toBeNull();
    expect(disabled.shouldRunProjectStartupFlow).toBe(false);
    expect(disabled.shouldEnableCoderTool).toBe(false);

    expect(notEnabled.isActive).toBe(false);
    expect(notEnabled.activeMode).toBeNull();
    expect(notEnabled.shouldRunProjectStartupFlow).toBe(false);
    expect(notEnabled.shouldEnableCoderTool).toBe(false);

    expect(hardDisabled.isActive).toBe(false);
    expect(hardDisabled.activeMode).toBeNull();
    expect(hardDisabled.shouldRunProjectStartupFlow).toBe(false);
    expect(hardDisabled.shouldEnableCoderTool).toBe(false);
  });

  it("resolveStartupState() keeps inactive startup in bootstrap-init mode", () => {
    const startup = createStartupState({
      startupMode: startupMode("not-enabled", "fresh"),
      runtimeCapability: runtimePhase({ phase: "bootstrap", shouldExposeBootstrapInit: true }),
    });

    const resolved = resolveStartupState({ startup, projectContext: null, timedOut: false });

    expect(resolved.shouldExposeBootstrapInit).toBe(true);
    expect(resolved.defaultAgentDecision).toBe("inactive-mode");
    expect(resolved.shouldSetDefaultAgent).toBe(false);
    expect(resolved.projectContextAvailable).toBe(false);
    expect(resolved.timedOut).toBe(false);
    expect(resolved.degraded).toBe(false);
  });

  it("resolveStartupState() sets orchestrator only for active projects with beads ready", () => {
    const startup = createStartupState({ startupMode: startupMode("team"), runtimeCapability: runtimePhase() });

    const ready = resolveStartupState({ startup, projectContext: projectContext(), timedOut: false });
    expect(ready.defaultAgentDecision).toBe("set-orchestrator");
    expect(ready.shouldSetDefaultAgent).toBe(true);
    expect(ready.shouldExposeBootstrapInit).toBe(false);

    const notReady = resolveStartupState({
      startup,
      projectContext: projectContext({ beadsReady: false }),
      timedOut: false,
    });
    expect(notReady.defaultAgentDecision).toBe("beads-not-ready");
    expect(notReady.shouldSetDefaultAgent).toBe(false);
  });

  it("resolveStartupState() fixture-representative decision path keeps stage-2 non-default and stage-3 default-on-startup", () => {
    const startup = createStartupState({ startupMode: startupMode("team"), runtimeCapability: runtimePhase() });

    const stage2Context = projectContext({
      beadsReady: false,
      beads: {
        initialized: false,
        stealthMode: false,
        bdCliInstalled: true,
        coderBeadsSkillAvailable: false,
        orchestratorAgentAvailable: false,
      },
    });
    const stage2Decision = resolveStartupState({ startup, projectContext: stage2Context, timedOut: false });
    expect(stage2Decision.defaultAgentDecision).toBe("beads-not-ready");
    expect(stage2Decision.shouldSetDefaultAgent).toBe(false);

    const stage3Context = projectContext({
      beadsReady: true,
      beads: {
        initialized: true,
        stealthMode: false,
        bdCliInstalled: true,
        coderBeadsSkillAvailable: true,
        orchestratorAgentAvailable: true,
      },
    });
    const stage3Decision = resolveStartupState({ startup, projectContext: stage3Context, timedOut: false });
    expect(stage3Decision.defaultAgentDecision).toBe("set-orchestrator");
    expect(stage3Decision.shouldSetDefaultAgent).toBe(true);
  });

  it("resolveStartupState() degrades safely when project context is unavailable/timeout", () => {
    const startup = createStartupState({ startupMode: startupMode("team"), runtimeCapability: runtimePhase() });

    const resolved = resolveStartupState({ startup, projectContext: null, timedOut: true });
    const fallback = getFallbackRuntimeCapability();

    expect(resolved.timedOut).toBe(true);
    expect(resolved.degraded).toBe(true);
    expect(resolved.projectContextAvailable).toBe(false);
    expect(resolved.defaultAgentDecision).toBe("project-context-unavailable");
    expect(resolved.shouldSetDefaultAgent).toBe(false);
    expect(resolved.shouldExposeBootstrapInit).toBe(true);
    expect(resolved.runtimeCapability).toEqual(fallback);
  });
});
