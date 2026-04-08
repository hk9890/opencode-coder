# Testing Guide

For contributor workflow, see [`../CONTRIBUTING.md`](../CONTRIBUTING.md).  
For implementation architecture and build guidance, see [`CODING.md`](CODING.md).

## Core Policy

- Pick the **lowest test level that gives meaningful confidence**.
- **Unit tests are for pure TypeScript logic only**.
- **Do not unit test the content or semantic behavior of published skills, commands, or agents.**
- For skills, commands, and agents:
  - use **integration tests** for registration, gating, loading, and plugin-pipeline behavior
  - use **e2e tests** for real CLI exposure and runtime wiring
  - use **manual testing** for semantic quality and human judgment

## Test Levels

| Level | Best for | Command |
|---|---|---|
| Unit | Pure logic in parsers, services, helpers, config logic | `bun test tests/unit` |
| Integration | In-process plugin behavior, resource loading, config merging, command registration/gating | `bun test tests/integration` |
| E2E | Real `opencode` CLI startup, plugin wiring, runtime behavior in isolated workspaces | `bun run test:e2e` |
| Manual | Human/agent validation of prompt-heavy or agent-mediated behavior | `bun run test:manual -- --help` |

## Decision Matrix

| Situation | Best fit |
|---|---|
| Verify pure logic or edge cases in source modules | Unit tests |
| Verify plugin component interactions without the real CLI | Integration tests |
| Verify real CLI startup/plugin wiring on committed fixtures | E2E tests |
| Validate slash commands, agents, or skills semantically | Manual testing |
| Reproduce an issue from a real local project | Manual testing with `--project-path` |
| Compare installed published plugin vs current local implementation | Manual testing with `--plugin-source=installed-configured` then `local-build` |

## Change-Type Matrix

| Change type | Minimum checks | Usually add |
|---|---|---|
| Pure service/helper logic | `bun run typecheck`, targeted `bun test tests/unit/...` | adjacent unit tests for touched modules |
| Startup / mode / detection changes | `bun run typecheck`, touched service unit tests, `bun test tests/integration/plugin.test.ts` | targeted e2e/manual check if CLI-visible behavior changed |
| Published commands / skills / agents | `bun run typecheck`, `bun test tests/integration/plugin.test.ts` | targeted `bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario ..."` and manual semantic validation |
| Docs lifecycle / init / improve-doc guidance | `bun test tests/unit/docs-lifecycle-contract.test.ts`, `bun test tests/integration/plugin.test.ts` | targeted e2e scenarios and manual acceptance |
| Manual launcher / isolated harness changes | `bun test tests/integration/manual-launcher.test.ts`, `bun run validate:isolated-pins` | targeted e2e/manual run on a representative fixture |
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

## E2E Tests

E2E tests run the real `opencode` CLI against isolated temporary workspaces.

Use them for:
- real plugin startup/load proof
- command exposure in runtime
- isolated environment behavior
- fixture-based CLI regression coverage

Prerequisites:
- built plugin artifact (`bun run build`)
- `opencode` available on `PATH`
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

Entry point:

```bash
bun run test:manual -- --help
```

### Execution models

- `--fixture=<name>`
  - copies a committed fixture into a disposable workspace
  - safest default for reproducible launcher testing
- `--project-path <path>`
  - runs directly in the provided project path
  - does **not** copy the project
  - still uses isolated HOME/XDG/OpenCode state under `.manual-test-runs/`
  - may mutate the target project, so use a clean branch, worktree, or disposable project when needed

### Key options

- `--mode=tui|shell|command` — choose interactive vs one-shot execution
- `--plugin-source=local-build` — test the current local implementation
- `--plugin-source=installed-configured` — compare against the installed configured plugin
- `--auth <path>` — seed auth into isolated OpenCode data when model-backed behavior is needed

### Recommended workflow

1. Start with deterministic checks if relevant.
2. Choose the manual scenario that matches the question you are asking.
3. Prefer fixtures for reproducible launcher/debug work.
4. Use `--project-path` when you need to validate against a real project.
5. Judge the outcome semantically, not by string fragments.

### Example commands

```bash
# quick fixture smoke check
bun run test:manual -- --mode=tui --fixture=cli-smoke-project

# inspect behavior in an interactive shell on a fixture
bun run test:manual -- --mode=shell --fixture=existing-active-project

# run directly in a real local project
bun run test:manual -- --mode=shell --project-path "$HOME/dev/some-project"

# compare installed plugin vs current local build on the same project
bun run test:manual -- --mode=command --project-path "$HOME/dev/some-project" --plugin-source=installed-configured -- opencode run --command "pwd" --format json
bun run test:manual -- --mode=command --project-path "$HOME/dev/some-project" --plugin-source=local-build -- opencode run --command "pwd" --format json
```

## Manual Testing Scenarios

Use these scenario labels consistently when discussing or documenting manual checks.

### Scenario A — Quick startup smoke

Use when:
- you want a fast sanity check that the launcher, plugin wiring, and CLI start at all

Recommended command:

```bash
bun run test:manual -- --mode=tui --fixture=cli-smoke-project
```

### Scenario B — Existing active project behavior

Use when:
- you want to inspect commands and behavior in an already-active project
- you are checking command availability, routing, or plugin startup shape

Recommended command:

```bash
bun run test:manual -- --mode=shell --fixture=existing-active-project
```

### Scenario C — Fresh inactive project behavior

Use when:
- you want to confirm init-only behavior
- docs lifecycle commands should remain gated

Recommended command:

```bash
bun run test:manual -- --mode=shell --fixture=fresh-inactive-project
```

### Scenario D — Local startup parity

Use when:
- you want to compare real CLI startup behavior against the local parity fixture

Recommended command:

```bash
bun run test:manual -- --mode=shell --fixture=local-startup-parity-project
```

### Scenario E — Real project reproduction in place

Use when:
- you need to validate against an actual local project
- fixtures are too synthetic
- you need to inspect semantic command behavior on realistic repo state

Recommended command:

```bash
bun run test:manual -- --mode=shell --project-path "$HOME/dev/some-project"
```

### Scenario F — Installed vs local comparison

Use when:
- you want to answer “is this already fixed locally?”

Recommended pattern:

1. run with `--plugin-source=installed-configured`
2. rerun the same scenario with `--plugin-source=local-build`
3. compare outcomes and plugin load proof

### Scenario G — Isolated `/simplify` semantic validation (no manual copying)

Use when:
- you need reproducible `/simplify` semantic validation in an isolated workspace
- you want to avoid ad hoc copying of command/skill files into `.opencode/`

Why this is needed:
- `/simplify` behavior is owned by standalone `code-simplify` and routed via command/skill composition.
- `existing-active-project` is an active-startup fixture baseline, but it does not guarantee the minimal normal-mode threshold (`opencode-coder/init` command + `opencode-coder` skill) or explicit standalone simplify package installation.
- A stock isolated run can therefore still start in bootstrap phase, where `/simplify` is not exposed yet.

Reproducible path:

1. Launch isolated shell on the fixture using local build:

   ```bash
   bun run test:manual -- --mode=shell --fixture=existing-active-project --plugin-source=local-build
   ```

2. In that shell, bootstrap resources through `aimgr` (repo-supported path):

   ```bash
    # existing-active-project already includes ai.package.yaml, so do not run `aimgr init` here
    aimgr repo add local:/absolute/path/to/your/opencode-coder/clone/ai-resources
    # Option A (full combined surface):
    aimgr install package/opencode-coder

    # Option B (targeted ownership check for standalone simplify):
    aimgr install package/code-simplify
    ```

3. Start OpenCode from the same shell and run `/simplify ...` for semantic validation.

Notes:
- This replaces manual file copying with a repeatable package install flow.
- `aimgr install package/opencode-coder` requires a repository source first; `aimgr repo add local:.../ai-resources` seeds that source in isolated runs.
- Use `package/code-simplify` when you explicitly want isolated validation of the standalone simplify owner without pulling the full combined package.
- If `aimgr` or required package access is unavailable in your environment, `/simplify` semantic validation cannot be completed in isolated mode.

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
| `bun run test:e2e` | Build first, then run e2e |
| `bun run test:e2e:raw` | Lower-level raw e2e run |
| `bun run test:manual -- --help` | Manual testing launcher help |
| `bun run validate:isolated-pins` | Validate isolated harness pin consistency |
| `bun run test:coverage` | Coverage run |
