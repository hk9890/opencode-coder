# Testing Guide

For contributor onboarding and contribution workflow, see [`../CONTRIBUTING.md`](../CONTRIBUTING.md).  
For implementation architecture and build/development guidance, see [`CODING.md`](CODING.md).

## Test Levels

This project uses three test levels:

| Level | Location | When to Run | Command |
|-------|----------|-------------|---------|
| Unit | `tests/unit/` | During development | `bun test tests/unit` |
| Integration | `tests/integration/` | Before committing | `bun test tests/integration` |
| E2E | `tests/e2e/` | Before releases | `bun test tests/e2e` |

## Which workflow should I use? (decision matrix)

Use this quick matrix when triaging bugs or validating behavior:

| Situation | Best fit | Why |
|---|---|---|
| Verify pure logic (parser/config/service behavior) | Unit tests | Fast, isolated, no CLI/runtime dependencies |
| Verify plugin component interactions in-process | Integration tests | Exercises plugin pipeline without real `opencode` process |
| Verify real CLI startup/plugin wiring on known baseline project | E2E tests (`tests/e2e`) or manual launcher with `--fixture` | Uses committed fixture copied into temp workspace for repeatability |
| Reproduce issue from a real local project safely | Manual launcher with `--project-path` | Copies external project to temp workspace; avoids mutating source project |
| Compare installed published plugin vs current local implementation | Manual launcher with `--plugin-source=installed-configured` then rerun with default `local-build` | Same harness/project source, only plugin source changes |
| Investigate startup hang / host-specific behavior in real CLI path | Manual launcher (`--mode=tui`/`shell`/`command`) | Runs real `opencode` CLI with isolated HOME/XDG/OpenCode env |

If you are unsure, start with fixture-based manual launcher (`--fixture=cli-smoke-project`) and only move to external project reproduction when fixture runs cannot capture the issue.

## Integration Tests

**Location**: `tests/integration/`

Integration tests verify real component interactions without mocks:

- Tests the full plugin loading pipeline
- Uses actual knowledge-base files
- Verifies config merging, command loading
- Uses mock plugin input (not a real OpenCode server)

### What integration tests do **not** cover

Integration tests are **not** the right tool for validating real CLI startup/runtime behavior, for example:

- startup hangs from actual `opencode` CLI initialization
- behavior differences caused by real project layouts on disk
- installed-vs-local plugin loading differences

Use e2e tests or the manual isolated launcher for those scenarios.

```bash
bun test tests/integration    # Run integration tests
```

## Unit Tests

**Location**: `tests/unit/`

Unit tests verify isolated behavior with mocks and fast feedback:

- One test file per source module where practical
- Use shared helpers like `createMockLogger` and `createMockPluginInput`
- Cover edge cases and error handling

```bash
bun test tests/unit                     # Unit tests only
bun run test:unit                       # Package script equivalent
bun test tests/unit/parser.test.ts      # Single file
bun test --test-name-pattern "pattern"  # Filter by test name
```

## E2E Tests

**Location**: `tests/e2e/`

E2E tests run the full plugin lifecycle against the real OpenCode CLI startup path.

### Prerequisites

1. **Built plugin**: `bun run build` (creates `dist/opencode-coder.js`)
2. **OpenCode CLI**: Must be installed and available in PATH
3. **CLI startup time budget**: initial isolated startup may run one-time DB migrations

### How It Works

1. Selects a committed fixture from `tests/e2e/fixtures/`
2. Copies that fixture into a temporary workspace (`os.tmpdir`) so tests can mutate files safely
3. Ensures `dist/opencode-coder.js` exists (builds if necessary)
4. Initializes a fresh git repository in the temp workspace to anchor OpenCode project-root detection inside the fixture copy
5. Injects the built artifact into `<temp-workdir>/.opencode/plugins/opencode-coder.js` (canonical project plugin directory)
6. Creates isolated HOME/XDG/OpenCode roots for the test process and seeds a committed OpenCode config snapshot into `OPENCODE_CONFIG_DIR/opencode.json`:
   - `HOME`
   - `XDG_CONFIG_HOME`
   - `XDG_DATA_HOME`
   - `XDG_CACHE_HOME`
   - `OPENCODE_CONFIG_DIR`
   - `OPENCODE_DISABLE_DEFAULT_PLUGINS=true`
7. Executes real `opencode run ...` commands from the temp workspace
8. Runs assertions against resulting workspace/config state
9. Captures diagnostics on startup failure under `tests/e2e/.artifacts/`
10. Cleans up the temp workspace

This isolation model prevents accidental double-loading from globally installed or legacy plugin copies.
It also prevents tests from drifting when your personal `~/.config/opencode/opencode.json` changes.

The committed shared config fixture intentionally keeps the `plugin` array empty to avoid startup noise from unavailable external packages in isolated runs. The `opencode-coder` plugin itself is **not** loaded from `opencode.json` in this harness; the plugin under test is the locally built artifact wired into `.opencode/plugins/opencode-coder.js`.

### Fixture Layout

Fixture roots live in `tests/e2e/fixtures/`:

- `existing-active-project/`
- `cli-smoke-project/`
- `fresh-inactive-project/`
- `local-startup-parity-project/`

See `tests/e2e/fixtures/README.md` for fixture intent.

### Harness Helpers

Shared e2e helpers are in `tests/e2e/helpers/harness.ts`.

Core helpers:

- `createFixtureWorkspace()` — copy committed fixture to temp workdir
- `wireBuiltPluginArtifact()` — ensure build + symlink built plugin into `.opencode/plugins`
- `createIsolatedOpenCodePaths()` — create isolated HOME/XDG/OpenCode directories and env map
- `withEnvironment()` — scoped env overrides during startup
- `runOpencodeCli()` — run real `opencode` CLI commands with explicit isolated env/cwd
- `writeFailureArtifacts()` — write summary/stdout/stderr/notes on failure

### Manual Isolated Launcher (shared with e2e harness)

Use the manual launcher when you want ad-hoc testing with the **same setup model** as automated e2e runs (fixture copy, plugin wiring, isolated HOME/XDG/OpenCode roots, committed config snapshot seeded into isolated `OPENCODE_CONFIG_DIR`, and auth copied into isolated XDG data).

This is the preferred workflow for both **you** and the **assistant** when reproducing behavior manually, because it keeps manual checks aligned with automated tests.

Entry point:

```bash
bun run test:manual -- --help
```

### Source modes: project under test

The launcher supports two project-source modes:

1. **Committed fixture (default)**
   - `--fixture=<name>` (defaults to `cli-smoke-project`)
   - copies `tests/e2e/fixtures/<name>` into a temp workspace
2. **External project path**
   - `--project-path <absolute-or-relative-path>`
   - copies that directory into a temp workspace (excluding existing `.git` contents), then initializes a fresh git repo in the temp copy

`--fixture` and `--project-path` are mutually exclusive.

### Source modes: plugin under test

The launcher supports two plugin-source modes:

1. **`local-build` (default)**
   - builds/uses this repository's `dist/opencode-coder.js`
   - wires symlink into `<temp-workdir>/.opencode/plugins/opencode-coder.js`
   - sets `OPENCODE_DISABLE_DEFAULT_PLUGINS=true` in isolated env to avoid double-loading
2. **`installed-configured`**
   - resolves exactly one `@dynatrace-oss/opencode-coder@...` entry from host `opencode.json`
   - deterministically prepares that package in the temp workspace (`.opencode`) before launch
   - wires `.opencode/plugins/opencode-coder.js` to the prepared installed artifact
   - keeps `OPENCODE_DISABLE_DEFAULT_PLUGINS=true` so startup does **not** depend on runtime plugin installation
   - records expected installed version and requires post-run load proof

`installed-configured` uses host config only to resolve package spec/version. If preparation fails (missing package, install error, entrypoint missing, version mismatch), launcher setup fails loudly before comparison runs.

Examples:

```bash
# 1) Open interactive OpenCode TUI in isolated fixture workspace
bun run test:manual -- --mode=tui --fixture=cli-smoke-project

# 2) Open an interactive shell in isolated fixture workspace
bun run test:manual -- --mode=shell --fixture=existing-active-project

# 3) Run one-shot command in isolated fixture workspace
bun run test:manual -- --mode=command --fixture=cli-smoke-project -- env

# 4) Seed auth from explicit file path (copied into isolated XDG data)
bun run test:manual -- --mode=command --auth "$HOME/.local/share/opencode/auth.json" -- opencode run --command "pwd" --format json

# 5) Preserve workspace for inspection
bun run test:manual -- --mode=command --keep -- opencode run --command "pwd" --format json

# 6) Reproduce from an external project safely (copied into temp workspace)
bun run test:manual -- --mode=command --project-path "$HOME/dev/some-project" --keep -- opencode run --command "pwd" --format json

# 7) Compare same project with installed configured plugin first
bun run test:manual -- --mode=command --project-path "$HOME/dev/some-project" --plugin-source=installed-configured --keep -- opencode run --command "pwd" --format json

# 8) Re-run same project with current local build
bun run test:manual -- --mode=command --project-path "$HOME/dev/some-project" --plugin-source=local-build --keep -- opencode run --command "pwd" --format json
```

Recommended shared workflow:

- Start here for quick smoke checks: `bun run test:manual -- --mode=tui --fixture=cli-smoke-project`
- Use `--mode=shell` when you want to run several commands in the same isolated temp project
- Use `--mode=command -- ...` when you want a reproducible one-shot command that mirrors automated runs
- Let auth fall back to `~/.local/share/opencode/auth.json` in normal local use; pass `--auth <path>` only when you want to test with a different auth file
- Use `--keep` when debugging; otherwise successful runs clean up automatically
- Do **not** run manual tests directly in the real fixture or repo workspace if you want parity with e2e behavior — use the launcher so the fixture is copied into a temp project first

### Installed-vs-local comparison workflow ("is this already fixed?")

1. Run the failing scenario in `installed-configured` mode on the target project (`--fixture` or `--project-path`) and capture the behavior.
2. Re-run the **same command** with the **same project source** but `--plugin-source=local-build`.
3. Compare outcomes:
   - if installed fails but local succeeds, the issue is likely already fixed in current implementation
   - if both fail the same way, local implementation likely does **not** fix it yet
   - if both succeed, the original report may be environment/version-specific; use preserved workspaces/logs to refine
4. Validate proof lines in launcher output for installed-configured runs:
   - `Expected installed plugin version: <x.y.z>`
   - `Loaded plugin version: <x.y.z>`
   - `Installed plugin load proof: valid`
   If proof is missing/invalid (for example `Loaded plugin version: fixture`), launcher exits non-zero and prints `INVALID_COMPARISON`.
5. Keep both runs with `--keep` while debugging, then inspect the printed `Environment preserved at:` directories.

Tip: compare launcher summary lines (`Plugin source`, `Resolved installed package`, `Expected installed plugin version`, `Loaded plugin version`, `Installed plugin load proof`) to confirm you actually switched plugin source and achieved real installed-plugin load.

### Safety model and current limits

- External project reproduction is copy-based: launcher never runs in place on your source project.
- For `--project-path`, existing `.git` contents are not copied; harness creates a fresh git repo in temp workspace for root detection.
- Host OpenCode config is **not** reused directly during isolated runs. It is read only to resolve installed package spec in `installed-configured` mode, then isolated config is written under temp `OPENCODE_CONFIG_DIR`.
- Exact in-place reproduction against a live project directory is intentionally out of scope for this iteration.

Auth precedence for the launcher:

1. `--auth <path>` explicit file
2. fallback `~/.local/share/opencode/auth.json` (if present)

The launcher never requires raw auth JSON as CLI argument. Auth seeds are copied to isolated `XDG_DATA_HOME/opencode/auth.json`.

Behavior notes:

- Performs preflight checks for `opencode` availability and fixture validity
- Invalid `--auth` paths fail in preflight with a concise `Auth seed error: ...` message (no raw runtime stack trace)
- `--require-auth` fails fast when no auth seed source is available
- `--keep` preserves temp workspace always
- Non-zero exit or signal preserves temp workspace automatically (even without `--keep`)

Environment isolation policy for manual launcher child processes:

- **All modes** (`tui`, `shell`, `command`) use isolated OpenCode env (`HOME`, `XDG_*`, `OPENCODE_CONFIG_DIR`, `OPENCODE_DISABLE_DEFAULT_PLUGINS`) plus a small allowlist: `PATH`, `USER`/`LOGNAME`, `LANG`, and `LC_*` locale keys.
- **Interactive modes** (`tui`, `shell`) additionally allowlist terminal/session keys needed for usability (for example `TERM`, `COLORTERM`, `TERMINFO`, `DISPLAY`, `WAYLAND_DISPLAY`, `XDG_RUNTIME_DIR`, related XDG session keys, and `DBUS_SESSION_BUS_ADDRESS`).
- **Shell mode** additionally passes `SHELL`.
- The launcher intentionally does **not** inherit host `OPENCODE_*` variables beyond the isolated values it sets. Host values such as `OPENCODE_DEFAULT_OPTIONS`, `OPENCODE_LOG_RETENTION`, and `OPENCODE_PID` are excluded to prevent cross-talk with host state.

### Verified Isolation Assumptions (real CLI)

- **Plugin discovery path**: The harness now uses `.opencode/plugins/` (plural), matching canonical OpenCode plugin docs.
- **Plugin loaded proof**: e2e asserts that `.coder/project.yaml` is rewritten from fixture baseline (`pluginVersion: fixture`) to a real plugin version in the plugin-wired smoke path. A control test without plugin wiring keeps `pluginVersion: fixture`.
- **Root confinement**: fixture temp copies are `git init`-ed so OpenCode root traversal cannot walk back into the host repository.
- **Host-global isolation**: e2e verifies OpenCode state is created under isolated XDG roots (for example `XDG_DATA_HOME/opencode/opencode.db`) during CLI startup.
- **Undocumented env vars**: `OPENCODE_HOME` is not relied on; use documented HOME/XDG + `OPENCODE_CONFIG_DIR` controls only.

### LLM-capable isolated runs (minimum strategy)

For scenarios that need a real model call (for example `opencode run "hi"` with an assistant response):

1. Keep HOME/XDG isolation enabled (never reuse host OpenCode state)
2. Provide minimal model/provider config via `OPENCODE_CONFIG_CONTENT` (highest-precedence config override)
3. Source credentials from test-controlled env vars (for provider API keys), or write a synthetic isolated auth file under `XDG_DATA_HOME/opencode/auth.json` when provider flow requires it
4. Avoid provider flows that require interactive OAuth in CI unless explicitly provisioned

The initial smoke startup path does not require a real LLM call; it validates CLI startup, plugin loading, and environment isolation first.

#### Optional credential-gated LLM e2e scenario (GitHub Copilot, isolated auth)

`tests/e2e/opencode.test.ts` includes an optional model-backed CLI scenario (`scenario 5`) for GitHub Copilot that resolves auth seed input with this precedence:

1. `E2E_COPILOT_AUTH_JSON_PATH` (path to an auth JSON file)
2. `E2E_COPILOT_AUTH_JSON_CONTENT` (raw auth JSON content)
3. Default local OpenCode auth file: `~/.local/share/opencode/auth.json` (if present)

`E2E_COPILOT_MODEL` is optional and defaults to `github-copilot/gpt-5.3-codex`.

Behavior and contract:

- If no usable source is found from the precedence list above, Bun marks this scenario as skipped (`it.skipIf(...)`).
- The harness always seeds isolated auth storage at `XDG_DATA_HOME/opencode/auth.json` by copying resolved source content (including the default local auth-file fallback when used).
- The test keeps HOME/XDG isolation enabled and injects runtime config through `OPENCODE_CONFIG_CONTENT` with `enabled_providers: ["github-copilot"]`.
- The actual CLI run does **not** use host-global OpenCode auth/config in place during execution; it uses only isolated HOME/XDG paths.
- Auth JSON content must be valid JSON (for example, exported/copied from a prior `/connect` flow), and must never be committed to this repository.

Example (path-based seed):

```bash
E2E_COPILOT_AUTH_JSON_PATH="$HOME/.local/share/opencode/auth.json" \
E2E_COPILOT_MODEL="github-copilot/gpt-5.3-codex" \
bun test tests/e2e --timeout 180000
```

Example (raw-content seed):

```bash
E2E_COPILOT_AUTH_JSON_CONTENT="$(cat /secure/location/auth.json)" \
E2E_COPILOT_MODEL="github-copilot/gpt-5.3-codex" \
bun test tests/e2e --timeout 180000
```

### Running

```bash
bun test tests/e2e                     # Run with default timeout
bun test tests/e2e --timeout 60000     # Extended timeout (for CI)
bun run test:e2e                       # Package script equivalent
```

### Timeouts and hang detection

- `bun test --timeout <ms>` is a **per-test timeout**, not one timeout for the whole suite.
- In this repository, several e2e tests also set explicit test-level timeouts such as `120000` or `180000`, so the CLI flag mainly changes the default for tests that do not already specify their own timeout.
- The e2e harness also applies command-level timeouts inside `runOpencodeCli(...)`, so many stuck CLI runs fail before the outer Bun test timeout is reached.
- The e2e tests now print explicit progress lines such as `START scenario 2`, per-command `running opencode ...`, and `PASS` / `FAIL` summaries with elapsed time, so you can see which scenario is active before a timeout fires.

For faster local feedback, prefer:

```bash
bun test tests/e2e --bail=1 --timeout 60000
```

To narrow failure quickly to one scenario:

```bash
bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario 2" --bail=1 --timeout 60000
```

### Troubleshooting

If e2e tests skip with "opencode binary not found":

- Ensure OpenCode is installed (`which opencode`)
- If installed via mise, restart your shell/OpenCode to refresh PATH
- Check mise installs: `ls ~/.local/share/mise/installs/opencode/`

If startup fails in e2e setup, inspect `tests/e2e/.artifacts/` for:

- `summary.json`
- `stdout.log`
- `stderr.log`
- `notes.txt`

## Docs lifecycle acceptance validation (automated + manual)

For docs lifecycle changes (`/opencode-coder/docs`, `/opencode-coder/init` docs delegation behavior, `/opencode-coder/improve-doc`, and retirement of `/opencode-coder/update-agent-md`), split validation into two buckets:

- **Automated (deterministic):** registration/gating/template contract checks in test suites
- **Manual (agent-mediated):** end-to-end behavioral checks where output is semantically evaluated by a human reviewer

### Automated checks (deterministic coverage)

Run these first. They provide deterministic coverage for command registration, runtime gating, and lifecycle contract alignment.

```bash
bun test tests/unit/docs-lifecycle-contract.test.ts
bun test tests/integration/plugin.test.ts
bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario [1-4]"
```

Expected outcomes:

- Inactive modes (fresh, saved disabled): `opencode-coder/init` is available, docs lifecycle commands are not
- Active team and active stealth: both docs lifecycle commands are available
- Legacy `opencode-coder/update-agent-md` is not exposed

### Manual validation (acceptance review for non-deterministic behavior)

Use the isolated launcher with `--keep` so you can preserve evidence if behavior is wrong.

#### Prerequisite — use interactive mode + aimgr-ready workspace

The docs lifecycle slash commands in this section are agent-mediated. To observe real lifecycle behavior, each run must include:

- Interactive launcher mode (`--mode=shell` or `--mode=tui`) for slash-command execution
- An aimgr-initialized workspace where opencode-coder resources are installed and healthy (recommended: `--project-path` pointing to a real prepared project)
- An auth seed (`--auth <path>`)
- Provider config in the isolated run (for example `OPENCODE_CONFIG_CONTENT` with `enabled_providers`)

Do **not** use headless one-shot `--mode=command` as the primary acceptance path for these slash commands.

Without the prerequisites above, slash-command runs may exit `0` with no model output or workspace mutations. That is expected setup/gating behavior, not a docs lifecycle product bug.

Use the minimum strategy from [LLM-capable isolated runs (minimum strategy)](#llm-capable-isolated-runs-minimum-strategy).

Diagnostic checkpoint for every preserved run (`--keep`): inspect `.coder/project.yaml` in the preserved workspace and confirm runtime evidence such as:

- `aimgr.resourcesHealthy: true` when validating active docs lifecycle behavior
- `pluginVersion` rewritten from fixture placeholder to the loaded plugin version

If `aimgr.resourcesHealthy` remains `false` in an active-scenario run, treat that as failed prerequisites (commands may be gated), not command-behavior failure.

#### Scenario 1 — Team mode `/opencode-coder/docs`

- **Starting state**
  - Repository: this repo
  - Project source: aimgr-initialized team workspace (`--project-path`), copied by launcher into temp workspace
  - Expect docs lifecycle commands to be available
- **Command(s) to run**

  ```bash
  bun run test:manual -- --mode=shell --project-path "$HOME/dev/<aimgr-ready-team-project>" --keep --auth "$HOME/.local/share/opencode/auth.json"
  ```

  Then, inside the opened shell session:

  ```bash
  export OPENCODE_CONFIG_CONTENT='{"enabled_providers":["github-copilot"]}'
  opencode run --command "/opencode-coder/docs" --format json
  ```

- **Expected observable outcomes**
  - Command executes (no "unknown command" / gating suppression)
  - Response follows docs lifecycle flow for team mode (does not redirect to init-only flow)
  - No reference to retired `/opencode-coder/update-agent-md`
- **If wrong, capture this evidence**
  - Full terminal output (stdout/stderr)
  - Preserved temp path printed by launcher (`Environment preserved at: ...`)
  - `.coder/project.yaml` from preserved workspace
  - Any command list/suggestion output showing missing or wrong command exposure

#### Scenario 2 — Stealth mode `/opencode-coder/docs`

- **Starting state**
  - Repository: this repo
  - Project source: aimgr-initialized stealth workspace (`--project-path`), copied by launcher into temp workspace
  - Expect docs lifecycle commands to be available
- **Command(s) to run**

  ```bash
  bun run test:manual -- --mode=shell --project-path "$HOME/dev/<aimgr-ready-stealth-project>" --keep --auth "$HOME/.local/share/opencode/auth.json"
  ```

  Then, inside the opened shell session:

  ```bash
  export OPENCODE_CONFIG_CONTENT='{"enabled_providers":["github-copilot"]}'
  opencode run --command "/opencode-coder/docs" --format json
  ```

- **Expected observable outcomes**
  - Command executes in stealth mode (not suppressed)
  - Response remains docs-lifecycle oriented and mode-appropriate
  - No regression to legacy update-agent flow
- **If wrong, capture this evidence**
  - Full terminal output (stdout/stderr)
  - Preserved temp workspace path from launcher output
  - `.coder/project.yaml` and relevant generated docs artifacts in preserved workspace

#### Scenario 3 — `/opencode-coder/init` delegates into docs lifecycle

- **Starting state**
  - Repository: this repo
  - Project source/mode: run in both states below to validate branch behavior:
    1. aimgr-initialized active workspace via `--project-path` (docs resources available)
    2. `fresh-inactive-project` fixture (docs resources unavailable)
- **Command(s) to run**

  ```bash
  bun run test:manual -- --mode=shell --project-path "$HOME/dev/<aimgr-ready-active-project>" --keep --auth "$HOME/.local/share/opencode/auth.json"
  bun run test:manual -- --mode=shell --fixture=fresh-inactive-project --keep --auth "$HOME/.local/share/opencode/auth.json"
  ```

  Then, inside each opened shell session:

  ```bash
  export OPENCODE_CONFIG_CONTENT='{"enabled_providers":["github-copilot"]}'
  opencode run --command "/opencode-coder/init" --format json
  ```

- **Expected observable outcomes**
  - In active mode, init includes intentional docs-lifecycle follow-through guidance (for example setup-now vs skip-for-now decision)
  - In inactive mode, init explicitly handles docs lifecycle as unavailable and completes safely without runtime failure
  - Behavior is consistent with automated gating expectations above
- **If wrong, capture this evidence**
  - Both command outputs for side-by-side comparison
  - Preserved workspace paths for both runs
  - Any error text indicating failed delegation or incorrect mode handling

#### Scenario 4 — `/opencode-coder/improve-doc` with incident (missing `validate-before-release.sh`)

- **Starting state**
  - Repository: this repo
  - Project source: aimgr-initialized team workspace (`--project-path`), copied by launcher into temp workspace
  - Incident to simulate: required validation script missing from workspace (`scripts/validate-before-release.sh`)
- **Command(s) to run**

  ```bash
  bun run test:manual -- --mode=shell --project-path "$HOME/dev/<aimgr-ready-team-project>" --keep --auth "$HOME/.local/share/opencode/auth.json"
  ```

  Then, inside the opened shell session:

  ```bash
  export OPENCODE_CONFIG_CONTENT='{"enabled_providers":["github-copilot"]}'
  rm -f scripts/validate-before-release.sh
  opencode run --command "/opencode-coder/improve-doc docs/TESTING.md" --format json
  ```

- **Expected observable outcomes**
  - `/opencode-coder/improve-doc` still runs (no command registration failure)
  - Response surfaces the missing-script incident as actionable validation debt (or equivalent explicit warning), rather than silently claiming full validation success
  - Guidance remains scoped to docs lifecycle improvement and validation remediation
- **If wrong, capture this evidence**
  - Shell transcript including `rm` and `opencode run` output
  - Preserved workspace path and resulting file tree state
  - Any misleading "all checks passed" output despite missing script incident

## Test Fixtures

**Location**: `tests/fixtures/`

Organized by type:

- `configs/` — JSON config fixtures for testing configuration loading
- `markdown/` — Command/agent markdown fixtures for testing knowledge base loading

## Test Helpers

**Location**: `tests/helpers/`

### mock-logger

Creates a logger that captures all log calls for assertion:

```typescript
import { createMockLogger } from "../helpers/mock-logger";

const logger = createMockLogger();
// ... run code that logs ...

expect(logger.hasLogged("info", "expected message")).toBe(true);
expect(logger.getCallsByLevel("error")).toHaveLength(0);
logger.clear(); // Reset captured logs
```

### mock-client

Creates a mock OpenCode client and plugin input:

```typescript
import { createMockPluginInput, asMockPluginInput } from "../helpers/mock-client";

const mockInput = createMockPluginInput();
const hooks = await OpencodeCoder(asMockPluginInput(mockInput));
```

## Coverage

```bash
bun run test:coverage    # Run tests with coverage report
```

## Quick Command Reference

These commands map to `package.json` scripts and current test directories:

| Command | Purpose |
|---|---|
| `bun run test` | Run all tests |
| `bun run test:unit` | Run unit tests in `tests/unit` |
| `bun run test:integration` | Run integration tests in `tests/integration` |
| `bun run test:e2e` | Run e2e tests in `tests/e2e` (`--timeout 60000`) |
| `bun run test:manual -- --help` | Manual isolated launcher help |
| `bun run test:coverage` | Coverage run |
