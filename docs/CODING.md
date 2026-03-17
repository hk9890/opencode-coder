# Coding Guidelines

## 1. Source Architecture Overview

### Minimal Entry Point Pattern

- `src/index.ts` is intentionally minimal (~167 lines)
- Delegates ALL functionality to domain packages
- Only orchestrates initialization order and wires dependencies

### Package Structure

```
src/
├── index.ts           # Plugin entry - minimal, delegates to packages
├── core/              # Foundation utilities (logger, version, parser)
├── config/            # Configuration loading and schema
├── service/           # Main services (AimgrService, BeadsService, ProjectDetectorService, SessionExportService)
├── templates/         # Template generation for init guides
├── tool/              # OpenCode tool definitions (coder tool)
└── beads/             # Beads integration (detector)
```

## 2. Package Index Pattern

Every package has an `index.ts` that exposes its public interface:

```typescript
// Example from src/core/index.ts
export { createLogger, SERVICE_NAME } from "./logger";
export type { Logger } from "./logger";

export { getVersionInfo } from "./version";
export type { VersionInfo } from "./version";

export { parseFrontmatter } from "./parser";
export type { Frontmatter, ParsedDocument } from "./parser";

```

### Rules

- Import from package index, not internal files: `import { Logger } from "./core"` ✅
- Never import from internal files: `import { Logger } from "./core/logger"` ❌
- Export both values AND types explicitly
- Keep implementation details private (not exported)

## 3. Unit Testing

One test file per source module (e.g., `config.test.ts` → `src/config/`):

- Use mocks via helpers (`createMockLogger`, `createMockPluginInput`)
- Test edge cases and error handling
- Fast, no external dependencies

```bash
bun test                                # All tests
bun test tests/unit                     # Unit tests only
bun test tests/unit/parser.test.ts      # Single test file
bun test --test-name-pattern "pattern"  # Pattern match
```

For integration tests, e2e tests, fixtures, and test helpers, see [TESTING.md](TESTING.md).


## AimgrService

### Purpose

The `AimgrService` provides automatic integration with aimgr (AI Resource Manager) for discovering and installing AI resources when the plugin starts.

### Key Features

- **Auto-detection**: Checks if aimgr CLI is installed on PATH
- **Auto-initialization**: Runs `aimgr init` if no `ai.package.yaml` exists
- **Package installation**: Installs `opencode-coder` package if available
- **Resource verification**: Runs `aimgr verify` to check resource health
- **Resource repair**: Runs `aimgr repair` to fix resource issues
- **User notifications**: Shows toast messages for initialization status
- **Graceful degradation**: All errors are logged but don't prevent plugin loading

### Architecture

```typescript
class AimgrService {
  // Detection methods (synchronous)
  isAimgrAvailable(): boolean
  hasPackageYaml(): boolean
  isPackageAvailable(packageName: string): boolean

  // Action methods (synchronous, throw on error)
  initializeAimgr(): void
  installPackage(packageName: string): void

  // Resource health methods (synchronous, return null when aimgr unavailable)
  verifyResources(): any   // runs `aimgr verify --format json`
  repairResources(): any   // runs `aimgr repair --format json`
  verifyAndAutoRepairResources(): Promise<AimgrStartupHealthResult>

  // Main orchestration (async, catches all errors)
  autoInitialize(): Promise<void>
}
```

### Integration Pattern

The service is instantiated in `src/index.ts` and participates in startup sequencing:

```typescript
// Create service
const aimgrService = new AimgrService({ logger: log, client, workdir });

// Startup flow
await aimgrService.autoInitialize();
const health = await aimgrService.verifyAndAutoRepairResources();
detectorService.detectAndWrite(versionInfo, {
  resourcesHealthyOverride: health.verifyResult === null ? undefined : health.resourcesHealthy,
});
```

This sequencing ensures that:
- project detection uses the final startup health result
- automatic `aimgr repair` can affect `ecosystemReady`
- the config hook sees the current readiness state instead of a stale snapshot

### Testing

- All methods are unit tested with mocks for `execSync` and `fs.existsSync`
- Tests verify both success and failure scenarios
- `autoInitialize` is tested for all code paths (skip, init, install, error)
- `verifyAndAutoRepairResources` is tested for healthy, repaired, and still-unhealthy flows
- See `tests/unit/service/aimgr-service.test.ts`

### Error Handling

- Individual methods (`initializeAimgr`, `installPackage`) throw errors
- `verifyResources` and `repairResources` return `null` instead of throwing
- `verifyAndAutoRepairResources` returns the post-repair verification result as the authoritative startup health signal
- `autoInitialize` catches all errors and logs them
- Plugin continues loading even if aimgr operations fail
- This ensures aimgr is optional and doesn't break the plugin


## ProjectDetectorService

### Purpose

The `ProjectDetectorService` detects facts about the current project environment and writes them to `.coder/project.yaml` on every plugin startup.

### Key Features

- **Git detection**: Checks for `.git/` directory
- **Beads detection**: Checks for `.beads/` directory, stealth mode, and bd CLI availability
- **aimgr detection**: Checks for aimgr CLI, `ai.package.yaml`, and resource health
- **Mode derivation**: Derives `stealth | team | uninitialized` from beads state
- **Context writing**: Writes full `ProjectContext` to `.coder/project.yaml` as YAML

### Architecture

```typescript
class ProjectDetectorService {
  // Git detection (synchronous)
  detectGitInitialized(): boolean

  // Beads detection (synchronous)
  detectBeadsInitialized(): boolean
  detectStealthMode(): boolean
  detectBdCliInstalled(): boolean

  // aimgr detection (synchronous)
  detectAimgrInstalled(): boolean
  detectPackageYaml(): boolean
  detectCoderPackageInstalled(): boolean
  detectResourcesHealthy(aimgrInstalled?: boolean): boolean

  // Mode derivation (synchronous, pure)
  deriveMode(beadsInitialized: boolean, stealthMode: boolean): "stealth" | "team" | "uninitialized"
  deriveEcosystemReady(...): boolean
  deriveInstallReady(...): boolean

  // YAML writing (synchronous)
  writeProjectContext(context: ProjectContext): void

  // Main orchestration (synchronous, never throws)
  detectAndWrite(versionInfo: VersionInfo, options?: ProjectDetectionOptions): ProjectContext
}
```

### ProjectContext Shape

```typescript
interface ProjectContext {
  mode: "stealth" | "team" | "uninitialized";
  installReady: boolean;   // all prereqs for /init in place
  ecosystemReady: boolean; // all ecosystem components installed and healthy
  git: {
    initialized: boolean;
  };
  beads: {
    initialized: boolean;
    stealthMode: boolean;
    bdCliInstalled: boolean;
  };
  aimgr: {
    installed: boolean;
    packageYaml: boolean;
    resourcesHealthy: boolean;
    coderPackageInstalled: boolean;
  };
  pluginVersion: string;
}
```

### Integration Pattern

The service is called from `src/index.ts` during plugin startup:

```typescript
const detectorService = new ProjectDetectorService({ logger: log });
const health = await aimgrService.verifyAndAutoRepairResources();
const projectContext = detectorService.detectAndWrite(versionInfo, {
  resourcesHealthyOverride: health.verifyResult === null ? undefined : health.resourcesHealthy,
});
```

When `resourcesHealthyOverride` is provided, the detector uses that value instead of running
its own `aimgr verify` call. This keeps startup health evaluation authoritative and avoids
double-checking resources after repair. When `detectAndWrite` already knows whether aimgr is
installed, it passes that result through to `detectResourcesHealthy` so startup does not shell
out to `command -v aimgr` a second time.

### Testing

- See `tests/unit/service/project-detector-service.test.ts`


## SessionExportService

### Purpose

The `SessionExportService` fetches session data from the OpenCode SDK and serializes it to JSON files on disk. Used by the `coder` tool and `/dump-session` command.

### Key Features

- **Session info**: Fetches metadata (id, title, timestamps, summary)
- **Message history**: Fetches full conversation with all message parts
- **File diffs**: Fetches file diffs made during the session
- **Token summary**: Aggregates token usage and cost across all assistant messages
- **Full export**: Writes session data to `session.json` in a specified directory
- **Formatted output**: Human-readable formatters for info, tokens, and session list

### Architecture

```typescript
class SessionExportService {
  // Data fetching (async)
  getSessionInfo(sessionID: string): Promise<unknown>
  getSessionMessages(sessionID: string): Promise<unknown[]>
  getSessionDiffs(sessionID: string): Promise<unknown>
  getTokenSummary(sessionID: string): Promise<TokenSummary>
  listSessions(): Promise<unknown[]>

  // Export (async)
  exportSession(sessionID: string, outputDir: string): Promise<ExportResult>

  // Formatting (async, returns human-readable strings)
  formatSessionInfo(sessionID: string): Promise<string>
  formatTokenSummary(sessionID: string): Promise<string>
  formatSessionList(): Promise<string>
}
```

### Key Types

```typescript
interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  totalReasoning: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalCost: number;
}

interface ExportResult {
  outputPath: string;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
}
```

### Integration Pattern

```typescript
const sessionExportService = new SessionExportService({ logger: log, client });

// Export current session to disk
const result = await sessionExportService.exportSession(sessionID, outputDir);
// result.outputPath → path to written session.json
```

### Testing

- See `tests/unit/service/session-export-service.test.ts`
