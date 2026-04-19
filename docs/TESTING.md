# Testing Guide

For contributor workflow, see [`../CONTRIBUTING.md`](../CONTRIBUTING.md).  
For implementation architecture and build guidance, see [`CODING.md`](CODING.md).

## Core Policy

- Pick the **lowest test level that gives meaningful confidence**.
- **Unit tests are for pure TypeScript logic only**.
- **Do not unit test the content or semantic behavior of published skills, commands, or agents.**
- For skills, commands, and agents:
  - use **integration tests** for registration, gating, loading, and plugin-pipeline behavior
  - use **runtime-integration tests** for automated checks that need the real `opencode` runtime but are narrower than full e2e CLI scenario coverage
  - use **e2e tests** for real CLI exposure and runtime wiring
  - use **manual testing** for semantic quality and human judgment

## Test Levels

| Level | Best for | Command |
|---|---|---|
| Unit | Pure logic in parsers, services, helpers, config logic | `bun test tests/unit` |
| Integration | In-process plugin behavior, resource loading, config merging, command registration/gating | `bun test tests/integration` |
| Runtime integration | Automated launcher/runtime checks that need real `opencode` host tooling but not human judgment | `bun test tests/runtime-integration` |
| E2E | Real `opencode` CLI startup, plugin wiring, runtime behavior in isolated workspaces | `bun run test:e2e` |
| Manual | Human/agent validation of prompt-heavy or agent-mediated behavior | `bun run test:manual -- --help` |

## Decision Matrix

| Situation | Best fit |
|---|---|
| Verify pure logic or edge cases in source modules | Unit tests |
| Verify plugin component interactions without the real CLI | Integration tests |
| Verify real `opencode` runtime startup/launcher viability without broad CLI scenario coverage | Runtime integration tests |
| Verify real CLI startup/plugin wiring on canonical runtime fixtures | E2E tests |
| Validate slash commands, agents, or skills semantically | Manual testing |
| Reproduce an issue from a real local project | Manual testing with `--project-path` |
| Compare installed published plugin vs current local implementation | Manual testing with `--plugin-source=installed-configured` then `local-build` |

## Change-Type Matrix

| Change type | Minimum checks | Usually add |
|---|---|---|
| Pure service/helper logic | `bun run typecheck`, targeted `bun test tests/unit/...` | adjacent unit tests for touched modules |
| Startup / mode / detection changes | `bun run typecheck`, touched service unit tests, `bun test tests/integration/plugin.test.ts` | targeted e2e/manual check if CLI-visible behavior changed |
| Real OpenCode startup / launcher viability / SDK wiring changes | `bun run typecheck`, `bun run test:runtime-integration` | targeted `bun run test:e2e` scenario and manual launcher validation when user-facing flow changed |
| Published commands / skills / agents | `bun run typecheck`, `bun test tests/integration/plugin.test.ts` | targeted `bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario ..."` and manual semantic validation |
| Split-skill ownership/routing docs changes | targeted `bun test tests/integration/plugin.test.ts` | `bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario [1-4]"` and manual checks for split package install flows |
| Docs lifecycle / init / improve-doc guidance (`coder-docs` canonical refs + `docs/user-guide/` copies) | `bun test tests/unit/docs-lifecycle-contract.test.ts`, `bun test tests/integration/plugin.test.ts` | targeted e2e scenarios and manual acceptance |
| Manual launcher / isolated harness changes that do not require real `opencode` startup | `bun test tests/integration/manual-launcher.test.ts`, `bun run validate:isolated-pins` | targeted runtime-integration/e2e/manual run on a representative fixture if the change crosses into real runtime behavior |
| Logs / diagnostics changes | targeted unit tests such as `tests/unit/log-analyzer.test.ts`, `tests/unit/collect-diagnostics.test.ts`, `tests/unit/coder-tool-logs.test.ts` | manual evidence collection if output shape changed |

Use the smallest matrix row that still gives meaningful confidence. If a change spans multiple rows, run the union of their checks.

## Unit Tests

Use unit tests for isolated code behavior with mocks.

Good fit:
- parser behavior
- service logic
- error handling
- helper utilities

Not allowed as unit-test targets:
- published skill content
- published slash-command prompt content
- agent prompt/content behavior
- semantic quality of AI-facing resources

Commands:

```bash
bun test tests/unit
bun run test:unit
bun test tests/unit/<file>.test.ts
```

## Integration Tests

Integration tests run the plugin pipeline in-process.

Use them for:
- command registration and gating
- config merging
- loading real resource files
- deterministic plugin behavior without the real `opencode` CLI
- deterministic launcher/setup assertions that can tolerate missing `opencode`

They are **not** the right tool for real CLI startup/runtime issues or prompt quality.

Commands:

```bash
bun test tests/integration
bun run test:integration
```

Default integration coverage is public-safe. To opt into extended private launcher coverage locally:

```bash
OPENCODE_CODER_PRIVATE_TESTS=true bun run test:integration
```

## Runtime-Integration Tests

Runtime-integration tests are still automated tests, but they require a real host `opencode` runtime and therefore are **not part of default CI**.

Use them for:
- launcher-prepared runtime viability checks
- real OpenCode server/SDK probes that are narrower than full CLI scenario suites
- automation that depends on real runtime startup/auth/tooling but not on human judgment

Placement rule:
- if the test can pass meaningfully with `opencode` missing, it belongs in **integration**
- if it must start or query the real OpenCode runtime, it belongs in **runtime-integration**
- if it validates broader CLI scenario exposure across canonical fixtures, it belongs in **e2e**
- if it needs human semantic judgment, it belongs in **manual**

Commands:

```bash
bun test tests/runtime-integration
bun run test:runtime-integration
```

## E2E Tests

E2E tests run the real `opencode` CLI against isolated temporary workspaces.

Use them for:
- real plugin startup/load proof
- command exposure in runtime
- isolated environment behavior
- fixture-based CLI regression coverage

Prerequisites:
- built plugin artifact (`bun run build`)
- host prerequisites are checked before deeper bootstrap: required `opencode` + `git`; conditional `aimgr` for aimgr/additive coverage; conditional `bd` for beads bootstrap coverage
- host tool resolution checks `PATH` first, then common mise install locations (`~/.local/share/mise/installs/<tool>/...`)
- Private-package coverage (including `@hk9890/opencode-dynatrace`) is opt-in via `OPENCODE_CODER_PRIVATE_TESTS=true`. Default public-safe isolated runs skip private plugin installation.

Commands:

```bash
bun run test:e2e
bun run test:e2e:raw
bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario 2"
```

On failure, inspect `tests/e2e/.artifacts/`.

If you change isolated harness pins/config, also run:

```bash
bun run validate:isolated-pins
```

## Manual Testing Guide

Use manual testing for realistic debugging and for prompt-heavy or agent-mediated behavior that should be judged semantically by a human or by an agent acting as a human reviewer.

Entry points:

```bash
bun run test:manual -- --help
bun run test:launcher:preflight
```

Launcher/e2e/runtime-integration preflight uses the shared host prerequisite helper before suite-specific setup. The helper verifies host availability and reports resolved executable/bin-dir details, but does **not** mutate generated isolated/manual environments implicitly.

What launcher preflight proves:

- launcher/setup coverage runs under a stripped local environment
- installed-configured setup must use explicit workspace-local GitHub Packages registry wiring
- missing GitHub Packages auth for `@dynatrace-oss` installed-configured resolution fails clearly

What it does **not** prove:

- full CI/container parity
- semantic command or skill quality
- private-package paths gated by `OPENCODE_CODER_PRIVATE_TESTS=true`

For the detailed manual-launcher workflow, scenario guide, and isolated `/simplify` setup, use [`testing/manual-launcher.md`](testing/manual-launcher.md).

Fixture semantics stay canonical in [`../tests/e2e/fixtures/README.md`](../tests/e2e/fixtures/README.md).

## Current Test Inventory By Group

This section names the current notable tests so future contributors know where similar coverage belongs.

### Unit

- `docs lifecycle contract`
- `beads service`
- `startup state`
- `log analyzer`
- `validate isolated pins`
- `coder tool logs`
- `exec`
- `coder tool`
- `version`
- `config keys`
- `opencode log paths`
- `collect diagnostics`
- `logger`
- `env`
- `parser`

### Integration

- `split capability package ownership > package/coder-core owns expected split resources`
- `split capability package ownership > package/coder-beads owns expected split resources`
- `split capability package ownership > package/coder-docs owns expected split resources`
- `split capability package ownership > package/coder-support owns expected split resources`
- `split capability package ownership > package/code-simplify owns expected split resources`
- `split capability package ownership > root ai.package.yaml keeps split packages and exposes the legacy combined package`
- `split capability package ownership > ships a legacy combined package manifest for backward compatibility`
- `OpencodeCoder Plugin Integration > plugin loading > ...` (all plugin-loading/config/runtime-state deterministic assertions in `tests/integration/plugin.test.ts`)
- `functional eval runner > covers bare workspace start, hook lifecycle edge-cases, and basename fallback naming`
- `functional eval runner > keeps functional eval workspace setup isolated from the live repo tracker`
- `functional eval runner > keeps trigger-eval automation on run_eval.py with trigger-evals.json`
- `bd init markdown boundary > bd init --non-interactive --skip-agents creates tracker state without creating or mutating markdown docs`
- `manual launcher preflight > seeds isolated .zshrc for zsh shell mode in empty HOME`
- `manual launcher preflight > does not overwrite existing .zshrc during zsh shell setup`
- `manual launcher preflight > does not create zsh startup files for non-zsh shells`
- `manual launcher preflight > uses interactive flags for common shells`
- `manual launcher preflight > does not add shell flags for unknown shells`
- `manual launcher preflight > activates wizard only when project source and mode are both implicit`
- `manual launcher preflight > fails clearly in non-tty contexts without explicit source and mode`
- `manual launcher preflight > runs command mode with stripped runtime/npm/auth env unless explicitly seeded`
- `manual launcher preflight > prints help with command-mode launcher usage and manual boundary notes`
- `manual launcher preflight > accepts beads-initialized as a fixture argument`
- `manual launcher preflight > createFixtureWorkspace(beads-initialized) auto-initializes metadata and enforces 0700 permissions`
- `manual launcher preflight > rejects removed --probe-plugin-load option`
- `manual launcher preflight > copies the committed OpenCode config fixture into isolated config`
- `manual launcher preflight > prewarms isolated OpenCode data baseline before first launcher command`
- `manual launcher preflight > reads isolated test manifest pins used by harness setup`
- `manual launcher preflight > fails clearly for unknown fixture`
- `manual launcher preflight > fails clearly for non-existent auth path`
- `manual launcher preflight > fails clearly when --project-path is missing a value`
- `manual launcher preflight > fails clearly for invalid --project-path directory`
- `manual launcher preflight > prepares shell workspaces with the same bootstrap state as TUI for empty-project`
- `manual launcher preflight > keeps coder-mode-configured minimally prepared at runtime`
- `manual launcher preflight > prepares coder-skill-installed as stage-2 non-beads runtime capability`
- `manual launcher preflight > fails clearly when --fixture and --project-path are both set`
- `manual launcher preflight > resolves host config path precedence`
- `manual launcher preflight > resolves installed-configured package when exactly one matching plugin is configured`
- `manual launcher preflight > fails when host config has no matching installed opencode-coder entry`
- `manual launcher preflight > fails when host config has multiple matching opencode-coder entries`
- `manual launcher preflight > seeds installed-configured isolated config without configured opencode-coder entry`
- `manual launcher preflight > skips private Dynatrace package prep when OPENCODE_CODER_PRIVATE_TESTS is unset/false`
- `manual launcher preflight > prepares workspace dependencies for installed-configured source`
- `manual launcher preflight > fails clearly when installed-configured auth token is not seeded`

### Runtime integration

- `manual launcher runtime-integration > avoids first-run migration log in fresh manual launcher invocations via prewarmed isolated data`
- `manual launcher runtime-integration > proves launcher-prepared local-build environment can start server and return structured SDK response`
- `manual launcher runtime-integration > proves launcher-prepared installed-configured environment can start server and return structured SDK response`

### E2E

- `additive isolated loadability > installs package/coder-core from coder-skill-installed baseline without requiring root manifest edits`
- `additive isolated loadability > installs package/coder-beads from coder-skill-installed baseline without requiring root manifest edits`
- `additive isolated loadability > installs package/coder-docs from coder-skill-installed baseline without requiring root manifest edits`
- `additive isolated loadability > installs package/coder-support from coder-skill-installed baseline without requiring root manifest edits`
- `additive isolated loadability > installs package/code-simplify from coder-skill-installed baseline without requiring root manifest edits`
- `OpencodeCoder E2E Tests > real startup scenario coverage > fixture-workspace contract: createFixtureWorkspace enforces runtime-visible baseline for all fixtures`
- `OpencodeCoder E2E Tests > real startup scenario coverage > scenario 1: should load once from coder-skill-installed active baseline`
- `OpencodeCoder E2E Tests > real startup scenario coverage > scenario 2: should prove startup from empty-project baseline via real-server semantic probe`
- `OpencodeCoder E2E Tests > real startup scenario coverage > scenario 3: should keep local startup parity from coder-mode-configured baseline via real-server semantic probe`
- `OpencodeCoder E2E Tests > real startup scenario coverage > scenario 4: should keep empty-project inactive and expose init behavior only via real-server semantic probe`
- `OpencodeCoder E2E Tests > real startup scenario coverage > scenario 4b: should enter normal mode from coder-mode-configured threshold and expose improve-doc only via real-server semantic probe`

### Manual

- `bun run test:manual -- ...` interactive launcher/debugging flows
- `bun run test:launcher:preflight` human-reviewed launcher preflight runs
- semantic quality checks for prompts, skills, commands, and agent behavior

## Beads Testing

Beads coverage uses a two-tier fixture model so tests stay reproducible without committing environment-specific runtime state. For fixture details, see [`tests/e2e/fixtures/README.md`](../tests/e2e/fixtures/README.md).

### Test patterns

| Pattern | Purpose | Typical level |
|---|---|---|
| Marker-only detection tests | Verify `.beads/` presence/phase detection behavior | Unit |
| Runtime `bd init` tests | Verify workspace bootstrap and initialization boundaries | Integration |
| Fixture workspace tests | Verify copied fixture + launcher/runtime behavior end-to-end | Integration / E2E |

### Beads testing notes

- Committed fixture state stays minimal: `.beads/.gitkeep` marker only.
- Test harness/runtime paths create functional beads state in copied workspaces using `bd init --non-interactive --skip-hooks --skip-agents --quiet`.
- This split keeps fixtures stable in git while still exercising real beads runtime behavior.
- Beads (embedded dolt backend) is single-writer per workspace, so serialize `bd` writes in tests and evals for the same `.beads/` directory.
- When `bd` changes, rerun beads-related coverage and confirm bootstrap still works with `bd init --non-interactive --skip-hooks --skip-agents --quiet`.
- Useful references: `tests/unit/beads-service.test.ts`, `tests/integration/beads-init-markdown-boundary.test.ts`, `tests/integration/manual-launcher.test.ts`, `tests/helpers/beads-fixture.ts`.

## Testing Skills, Commands, and Agents

This is the critical policy for AI-facing resources in this repo:

- **Do not add unit tests for the content of skills, commands, or agents.**
- **Do not treat string-fragment assertions as meaningful validation of prompt quality.**
- Test **registration and gating** in integration tests.
- Test **runtime exposure** in e2e tests.
- Test **semantic quality and usefulness** with manual testing.

For docs lifecycle changes such as `/opencode-coder/init-or-update-docs`, `/opencode-coder/init`, and `/opencode-coder/improve-doc`:

1. Run deterministic checks:

   ```bash
   bun test tests/integration/plugin.test.ts
   bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario [1-4]"
   ```

2. Run manual acceptance in an aimgr-ready interactive workspace.

3. Judge the result semantically:
   - was the command available when it should be?
   - was it suppressed when it should be?
   - did the response help the user well?
   - did it avoid legacy or incorrect flows?

### Skill eval preflight (required)

Before running any skill trigger evals or functional evals, first verify the deterministic runtime surfaces that those evals depend on.

1. Run the required deterministic checks first:

   ```bash
   bun test tests/integration/plugin.test.ts
   bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario [1-4]"
   ```

2. Only run skill evals after that preflight is green. If the deterministic checks fail, fix the infra/runtime problem first and only then rerun the evals.

3. Run the Python eval entrypoints from `ai-resources/skills/opencode-coder-skill-creator/` (or set `PYTHONPATH` to that directory) so `python3 -m scripts.run_eval` and `python3 -m scripts.run_functional_eval` resolve correctly.

4. Treat missing `opencode`, missing eval files, startup probe failures, and similar preflight errors as infra/setup failures rather than semantic skill failures.

## Quick Command Reference

| Command | Purpose |
|---|---|
| `bun run test` | Run all tests |
| `bun run test:unit` | Run unit tests |
| `bun run test:integration` | Run integration tests |
| `bun run test:runtime-integration` | Run real-runtime integration tests |
| `bun run test:e2e` | Build first, then run e2e |
| `bun run test:e2e:raw` | Lower-level raw e2e run |
| `bun run test:manual -- --help` | Manual testing launcher help |
| `bun run validate:isolated-pins` | Validate isolated harness pin consistency |
| `bun run test:coverage` | Coverage run |
