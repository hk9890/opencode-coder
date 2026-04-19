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
| Verify real CLI startup/plugin wiring on canonical runtime fixtures | E2E tests |
| Validate slash commands, agents, or skills semantically | Manual testing |
| Reproduce an issue from a real local project | Manual testing with `--project-path` |
| Compare installed published plugin vs current local implementation | Manual testing with `--plugin-source=installed-configured` then `local-build` |

## Change-Type Matrix

| Change type | Minimum checks | Usually add |
|---|---|---|
| Pure service/helper logic | `bun run typecheck`, targeted `bun test tests/unit/...` | adjacent unit tests for touched modules |
| Startup / mode / detection changes | `bun run typecheck`, touched service unit tests, `bun test tests/integration/plugin.test.ts` | targeted e2e/manual check if CLI-visible behavior changed |
| Published commands / skills / agents | `bun run typecheck`, `bun test tests/integration/plugin.test.ts` | targeted `bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario ..."` and manual semantic validation |
| Split-skill ownership/routing docs changes | targeted `bun test tests/integration/plugin.test.ts` | `bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario [1-4]"` and manual checks for split package install flows |
| Docs lifecycle / init / improve-doc guidance (`coder-docs` canonical refs + `docs/user-guide/` copies) | `bun test tests/unit/docs-lifecycle-contract.test.ts`, `bun test tests/integration/plugin.test.ts` | targeted e2e scenarios and manual acceptance |
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

Launcher/e2e/integration preflight uses the shared host prerequisite helper before suite-specific setup. The helper verifies host availability and reports resolved executable/bin-dir details, but does **not** mutate `process.env.PATH` or inject tools into generated isolated/manual environments implicitly.

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
| `bun run test:e2e` | Build first, then run e2e |
| `bun run test:e2e:raw` | Lower-level raw e2e run |
| `bun run test:manual -- --help` | Manual testing launcher help |
| `bun run validate:isolated-pins` | Validate isolated harness pin consistency |
| `bun run test:coverage` | Coverage run |
