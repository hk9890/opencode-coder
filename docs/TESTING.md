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
bun run test:manual -- --mode=tui --fixture=empty-project

# inspect behavior in an interactive shell on a fixture
bun run test:manual -- --mode=shell --fixture=coder-skill-installed

# run directly in a real local project
bun run test:manual -- --mode=shell --project-path "$HOME/dev/some-project"

# compare installed plugin vs current local build in an interactive manual scenario
bun run test:manual -- --mode=shell --project-path "$HOME/dev/some-project" --plugin-source=installed-configured
bun run test:manual -- --mode=shell --project-path "$HOME/dev/some-project" --plugin-source=local-build

# launcher environment debugging only
bun run test:manual -- --mode=command --project-path "$HOME/dev/some-project" -- env
```

## Manual Testing Scenarios

Use these scenario labels consistently when discussing or documenting manual checks.

Scenario labels are not fixture directory names. They describe test intent, while fixture identity is the committed on-disk state (`empty-project`, `coder-mode-configured`, `coder-skill-installed`).

### Legacy fixture name mapping

| Legacy fixture name | Canonical fixture |
|---|---|
| `cli-smoke-project` | `empty-project` |
| `fresh-inactive-project` | `empty-project` |
| `local-startup-parity-project` | `coder-mode-configured` |
| `existing-active-project` | `coder-skill-installed` |

### Scenario A — Quick startup smoke

Use when:
- you want a fast sanity check that the launcher, plugin wiring, and CLI start at all

Recommended command:

```bash
bun run test:manual -- --mode=tui --fixture=empty-project
```

### Scenario B — Existing active project behavior

Use when:
- you want to inspect commands and behavior in an already-active project
- you are checking command availability, routing, or plugin startup shape

Recommended command:

```bash
bun run test:manual -- --mode=shell --fixture=coder-skill-installed
```

### Scenario C — Fresh inactive project behavior

Use when:
- you want to confirm init-only behavior
- docs lifecycle commands should remain gated

Recommended command:

```bash
bun run test:manual -- --mode=shell --fixture=empty-project
```

### Scenario D — Local startup parity

Use when:
- you want to compare real CLI startup behavior against the local parity fixture

Recommended command:

```bash
bun run test:manual -- --mode=shell --fixture=coder-mode-configured
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
3. compare outcomes semantically in the same manual scenario

Use an interactive/manual scenario (for example shell mode):

```bash
bun run test:manual -- --mode=shell --project-path "$HOME/dev/some-project" --plugin-source=installed-configured
bun run test:manual -- --mode=shell --project-path "$HOME/dev/some-project" --plugin-source=local-build
```

Automated coverage for the manual launcher remains limited to environment preparation + startup viability guardrails. Semantic checks (including auth/model-backed prompts such as `say hi`) are manual-only and should be judged interactively.

Precondition for `installed-configured`:
- host OpenCode config must contain exactly one configured `@dynatrace-oss/opencode-coder@...` plugin entry so the launcher can resolve and verify expected version.

`env` remains useful for checking isolated launcher environment wiring.

### Scenario G — Isolated `/simplify` semantic validation

Use when:
- you need reproducible `/simplify` semantic validation in an isolated workspace
- you want to verify standalone `code-simplify` skill routing

Why this matters:
- `/simplify` behavior is owned by standalone `code-simplify` and routed via command/skill composition.
- `coder-skill-installed` is an active-startup fixture baseline, but it does not guarantee the minimal normal-mode threshold (`opencode-coder/init` command + `opencode-coder` skill) or explicit standalone simplify package installation.

#### `local-build` runs (recommended for development)

The manual launcher's `seedAiResources()` automatically copies agents, commands, and skills from `ai-resources/` into the workspace `.opencode/`. This makes `/simplify` available immediately — no manual `aimgr` steps needed.

```bash
bun run test:manual -- --mode=shell --fixture=coder-skill-installed --plugin-source=local-build
# /simplify is available after OpenCode starts — no manual resource installation needed
```

#### `installed-configured` runs

Resources are not seeded automatically. Use `aimgr` to install them in the isolated shell:

1. Launch isolated shell on the fixture:

   ```bash
   bun run test:manual -- --mode=shell --fixture=coder-skill-installed --plugin-source=installed-configured
   ```

2. In that shell, bootstrap resources through `aimgr`:

   ```bash
    # coder-skill-installed already includes ai.package.yaml, so do not run `aimgr init` here
    aimgr repo add local:/absolute/path/to/your/opencode-coder/clone/ai-resources
    # Option A (full combined surface):
    aimgr install package/opencode-coder

    # Option B (targeted ownership check for standalone simplify):
    aimgr install package/code-simplify
    ```

3. Start OpenCode from the same shell and run `/simplify ...` for semantic validation.

Notes:
- `aimgr install package/opencode-coder` requires a repository source first; `aimgr repo add local:.../ai-resources` seeds that source in isolated runs.
- Use `package/code-simplify` when you explicitly want isolated validation of the standalone simplify owner without pulling the full combined package.
- If `aimgr` or required package access is unavailable in your environment, `/simplify` semantic validation cannot be completed in `installed-configured` mode.

## Beads Testing

Beads coverage uses a two-tier fixture model so tests stay reproducible without committing environment-specific runtime state. For fixture details, see [`tests/e2e/fixtures/README.md`](../tests/e2e/fixtures/README.md).

### Test patterns

| Pattern | Purpose | Typical level |
|---|---|---|
| Marker-only detection tests | Verify `.beads/` presence/phase detection behavior | Unit |
| Runtime `bd init` tests | Verify workspace bootstrap and initialization boundaries | Integration |
| Fixture workspace tests | Verify copied fixture + launcher/runtime behavior end-to-end | Integration / E2E |

### Fixture strategy

- Committed fixture state stays minimal: `.beads/.gitkeep` marker only.
- Test harness/runtime paths create functional beads state in copied workspaces using `bd init --skip-hooks --skip-agents --quiet`.
- This split keeps fixtures stable in git while still exercising real beads runtime behavior.

### Single-writer constraint

- Beads (embedded dolt backend) is single-writer per workspace.
- Parallel `bd` writes against the same `.beads/` directory can fail with exclusive-lock errors.
- Serialize write operations in tests/evals; see `opencode-coder-eupg` documentation references for the underlying constraint.

### Relevant test files

- `tests/unit/beads-service.test.ts`
- `tests/integration/beads-init-markdown-boundary.test.ts`
- `tests/integration/manual-launcher.test.ts` (beads fixture/init coverage)
- `tests/helpers/beads-fixture.ts`

### bd upgrade checklist

When `bd` version changes, validate all of the following:

1. Beads-related unit/integration/e2e coverage still passes.
2. Runtime bootstrap still works with `bd init --skip-hooks --skip-agents --quiet`.
3. `.beads/` runtime internal structure changes do not break the marker-only committed fixture contract (`.beads/.gitkeep` only).
4. Single-writer assumptions remain documented and respected in test/eval paths.

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
