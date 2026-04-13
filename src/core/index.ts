// Logger
export { createLogger, SERVICE_NAME } from "./logger";
export type { Logger } from "./logger";

// OpenCode helpers
export { showToast } from "./opencode";
export type { OpencodeClient, ToastOptions } from "./opencode";

// Exec helpers
export {
  AIMGR_COMMAND_TIMEOUT_MS,
  COMMAND_CHECK_TIMEOUT_MS,
  getCommandAvailabilityStatus,
  isCommandAvailable,
  isExecTimeoutError,
} from "./exec";
export type { CommandAvailabilityStatus } from "./exec";

// Version
export { getVersionInfo } from "./version";
export type { VersionInfo } from "./version";

// OpenCode log locations
export {
  getOpenCodeLogDirectoryCandidates,
  resolveOpenCodeLogDirectory,
  summarizeOpenCodeLogDirectory,
} from "./opencode-log-paths";
export type {
  OpenCodeLogDirectoryCandidateOptions,
  OpenCodeLogDirectoryResolutionOptions,
  OpenCodeLogDirectorySummaryOptions,
} from "./opencode-log-paths";

// Project detection
export {
  STEALTH_MARKER,
  detectAimgrAvailable,
  detectBdCliAvailabilityStatus,
  detectBdCliAvailable,
  detectBeadsDirectory,
  detectPackageYaml,
  detectStealthMarker,
  verifyAimgrResources,
} from "./project-detection";
export type { DetectionLogger, VerifyAimgrResourcesOptions } from "./project-detection";

// Startup/config orchestration helpers
export {
  createStartupState,
  getFallbackRuntimeCapability,
  resolveStartupState,
} from "./startup-state";
export type {
  DefaultAgentDecision,
  StartupResolvedState,
  StartupState,
} from "./startup-state";
export { runProjectStartupFlow } from "./startup";
export type { StartupFlowDependencies } from "./startup";
export {
  createConfigHook,
  DOCS_LIFECYCLE_COMMANDS,
  LEGACY_DOCS_COMMAND,
} from "./config-hook";
export type { ConfigHookDependencies } from "./config-hook";
export { withTimeout } from "./with-timeout";
