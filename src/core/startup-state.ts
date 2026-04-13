import type {
  PluginModeResolution,
  ProjectContext,
  RuntimePhaseClassification,
  SavedPluginMode,
} from "../service";

export interface StartupState {
  startupMode: PluginModeResolution;
  activeMode: Exclude<SavedPluginMode, "disabled"> | null;
  isActive: boolean;
  runtimeCapability: RuntimePhaseClassification;
  shouldRunProjectStartupFlow: boolean;
  shouldEnableCoderTool: boolean;
}

export type DefaultAgentDecision =
  | "set-orchestrator"
  | "inactive-mode"
  | "project-context-unavailable"
  | "beads-not-ready";

export interface StartupResolvedState {
  startup: StartupState;
  projectContext: ProjectContext | null;
  projectContextAvailable: boolean;
  timedOut: boolean;
  degraded: boolean;
  runtimeCapability: RuntimePhaseClassification;
  shouldExposeBootstrapInit: boolean;
  defaultAgentDecision: DefaultAgentDecision;
  shouldSetDefaultAgent: boolean;
}

const FALLBACK_RUNTIME_CAPABILITY: RuntimePhaseClassification = {
  phase: "bootstrap",
  coreAvailable: false,
  bootstrapRequired: true,
  missingRequiredSurfaces: ["project-context-unavailable"],
  shouldExposeBootstrapInit: true,
};

export function createStartupState({
  startupMode,
  runtimeCapability,
}: {
  startupMode: PluginModeResolution;
  runtimeCapability: RuntimePhaseClassification;
}): StartupState {
  const activeMode =
    startupMode.mode === "stealth" || startupMode.mode === "team"
      ? startupMode.mode
      : null;

  return {
    startupMode,
    activeMode,
    isActive: activeMode !== null,
    runtimeCapability,
    shouldRunProjectStartupFlow: activeMode !== null,
    shouldEnableCoderTool: activeMode !== null,
  };
}

export function resolveStartupState({
  startup,
  projectContext,
  timedOut,
}: {
  startup: StartupState;
  projectContext: ProjectContext | null;
  timedOut: boolean;
}): StartupResolvedState {
  const projectContextAvailable = projectContext !== null;
  const runtimeCapability = projectContext?.runtimePhase ?? FALLBACK_RUNTIME_CAPABILITY;
  const shouldExposeBootstrapInit = !startup.isActive || runtimeCapability.shouldExposeBootstrapInit;
  const defaultAgentDecision = resolveDefaultAgentDecision({ startup, projectContext });

  return {
    startup,
    projectContext,
    projectContextAvailable,
    timedOut,
    degraded: timedOut,
    runtimeCapability,
    shouldExposeBootstrapInit,
    defaultAgentDecision,
    shouldSetDefaultAgent: defaultAgentDecision === "set-orchestrator",
  };
}

function resolveDefaultAgentDecision({
  startup,
  projectContext,
}: {
  startup: StartupState;
  projectContext: ProjectContext | null;
}): DefaultAgentDecision {
  if (!startup.isActive) {
    return "inactive-mode";
  }

  if (!projectContext) {
    return "project-context-unavailable";
  }

  if (!projectContext.beadsReady) {
    return "beads-not-ready";
  }

  return "set-orchestrator";
}

export function getFallbackRuntimeCapability(): RuntimePhaseClassification {
  return { ...FALLBACK_RUNTIME_CAPABILITY };
}
