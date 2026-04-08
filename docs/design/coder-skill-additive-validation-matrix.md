# Additive Validation Matrix for `coder-core`, `coder-beads`, and `coder-docs`

Epic: `opencode-coder-3mv8`  
Task: `opencode-coder-3mv8.2`

## 1) Hard rollout contract (normative)

This matrix implements the frozen contract from `docs/design/coder-skill-additive-split-boundaries.md` and is **mandatory** for child epics `.3`, `.4`, and `.5`.

> **Amendment (2026-04-08, epic `opencode-coder-wlpd`)**
> This matrix remains a historical additive-rollout record for `opencode-coder-3mv8`. The simplify ownership aspect referenced below is superseded for current-state ownership: base `/simplify` moved from `coder-core` to standalone `code-simplify` once compatibility-surface routing was migrated.

- Exact new skills: `coder-core`, `coder-beads`, `coder-docs`
- Additive only; no edits to existing assets
- Old combined `opencode-coder` remains unchanged during this phase
- New skills are evaluated via direct skill loading / isolated package installation only
- No new command wrappers; no command routing changes
- Intentional forks (not tracked mirrors)
- No hidden cross-skill runtime dependencies
- Ownership split remains frozen for additive rollout history (including health/troubleshooting, simplify follow-up behavior, AGENTS/docs lifecycle, bug-reporting split, debugging-logs split)

## 2) File-creation-only rules for packaging/testing

Allowed in this rollout phase:

- New skill directories/files under `ai-resources/skills/coder-core/**`, `ai-resources/skills/coder-beads/**`, `ai-resources/skills/coder-docs/**`
- New package manifests under `ai-resources/packages/*.package.json` for the three new skills
- New eval assets under each new skill's own `evals/**`
- New integration/e2e test files
- New verification reports/artifacts under new skill paths

Not allowed:

- Any edit to root `ai.package.yaml`
- Any edit to existing package manifests (including `ai-resources/packages/opencode-coder.package.json`)
- Any edit to existing commands/agents/`src/**`
- Any edit to existing project docs
- Any edit to existing tests/evals

## 3) Validation matrix (authoritative paths and command families)

| Skill | New package manifest path | Isolated loading path (no root manifest edits) | Eval path | Trigger-eval path | Verification artifacts | New deterministic test path(s) | New isolated e2e path(s) |
|---|---|---|---|---|---|---|---|
| `coder-core` | `ai-resources/packages/coder-core.package.json` | Disposable workspace with its own `ai.package.yaml` (or fixture-scoped workspace), `aimgr repo add local:<repo>/ai-resources`, then `aimgr install package/coder-core` | `ai-resources/skills/coder-core/evals/evals.json` | `ai-resources/skills/coder-core/evals/trigger-evals.json` | `ai-resources/skills/coder-core/evals/verification/*.md`; run artifacts under `ai-resources/skills/coder-core/eval-artifacts/**` | `tests/integration/coder-core-additive-load.test.ts` plus shared guard `tests/integration/additive-rollout-no-touch-guard.test.ts` | `tests/e2e/coder-core-additive-isolated-load.test.ts` |
| `coder-beads` | `ai-resources/packages/coder-beads.package.json` | Disposable workspace with its own `ai.package.yaml` (or fixture-scoped workspace), `aimgr repo add local:<repo>/ai-resources`, then `aimgr install package/coder-beads` | `ai-resources/skills/coder-beads/evals/evals.json` | `ai-resources/skills/coder-beads/evals/trigger-evals.json` | `ai-resources/skills/coder-beads/evals/verification/*.md`; run artifacts under `ai-resources/skills/coder-beads/eval-artifacts/**` | `tests/integration/coder-beads-additive-load.test.ts` plus shared guard `tests/integration/additive-rollout-no-touch-guard.test.ts` | `tests/e2e/coder-beads-additive-isolated-load.test.ts` |
| `coder-docs` | `ai-resources/packages/coder-docs.package.json` | Disposable workspace with its own `ai.package.yaml` (or fixture-scoped workspace), `aimgr repo add local:<repo>/ai-resources`, then `aimgr install package/coder-docs` | `ai-resources/skills/coder-docs/evals/evals.json` | `ai-resources/skills/coder-docs/evals/trigger-evals.json` | `ai-resources/skills/coder-docs/evals/verification/*.md`; run artifacts under `ai-resources/skills/coder-docs/eval-artifacts/**` | `tests/integration/coder-docs-additive-load.test.ts` plus shared guard `tests/integration/additive-rollout-no-touch-guard.test.ts` | `tests/e2e/coder-docs-additive-isolated-load.test.ts` |

## 4) Isolated loading strategy (maintainers and external users)

Because root `ai.package.yaml` is frozen, **all packaging/load checks must run in an isolated workspace**.

### Maintainer/local isolation flow

1. Create disposable workspace (manual launcher fixture workspace or scratch temp dir).
2. Ensure workspace-local config excludes legacy combined package/commands for this field test.
3. Add local resource repo source:
   - `aimgr repo add local:/absolute/path/to/opencode-coder/ai-resources`
4. Install only the target new package:
   - `aimgr install package/<coder-core|coder-beads|coder-docs>`
5. Validate target workflows in that isolated workspace.

### External-user isolation flow

Same as above, but from an external clone/path. The user must never edit this repository's root `ai.package.yaml` to test additive packages.

## 5) Evals vs deterministic tests (strict boundary)

This rollout uses a hard separation:

- **Evals** (`evals/evals.json`, `evals/trigger-evals.json`): semantic/behavior quality checks for skill guidance and trigger routing.
- **Integration/e2e tests** (new `tests/integration/**` and `tests/e2e/**`): deterministic structural checks (loadability, packaging wiring, coexistence/no-touch, isolated installation behavior).

Decision for downstream dependencies:

- Deterministic tests **must not** validate eval-asset correctness or semantic quality.
- Therefore `.X.4` tasks do **not** depend on `.X.3` tasks for artifact correctness.

## 6) Coexistence definition for additive phase (concrete, testable)

For this epic, "coexistence" means all of the following pass:

1. New skill/package files are additive-only (no edits to existing files).
2. Existing unchanged combined `opencode-coder` skill/command flows remain served by `opencode-coder` as before.
3. Existing integration/e2e regression coverage still passes unchanged.
4. New skill package manifests parse/load in isolated workspaces.
5. No path/name collisions with existing skill directories.

No-touch guard decision:

- Use **one shared integration test**: `tests/integration/additive-rollout-no-touch-guard.test.ts`.
- Do not duplicate identical no-touch assertions in each per-skill test.

## 7) Trigger-eval coverage and overlap judgment

Each new skill must ship trigger evals containing both:

- Positive routing cases (`should_trigger: true`) for that skill's owned scope
- Negative routing cases (`should_trigger: false`) for adjacent/non-owned scopes

Minimum required trigger-eval shape per new skill:

- At least 8 positive queries
- At least 8 negative queries
- At least 2 negative queries that are near-miss overlaps with unchanged `opencode-coder`

Overlap judgment rule during additive phase:

- Overlap with unchanged `opencode-coder` is **allowed** and not an automatic failure.
- Blocking failures are:
  - isolated new-skill trigger evals miss expected positives, or
  - isolated new-skill trigger evals incorrectly trigger on expected negatives.
- Coexistence overlap is judged as informational unless it causes isolated new-skill routing regression.

## 8) Eval runner mechanism and minimum pass criteria

Runner pattern is fixed to the existing runner family used in-repo:

- Functional evals: `python3 -m scripts.run_functional_eval`
- Trigger evals: `python3 -m scripts.run_eval`

Execution convention (per skill):

- Run from `ai-resources/skills/opencode-coder-skill-creator` (runner module location)
- Pass target skill via `--skill-path <repo>/ai-resources/skills/<skill>`
- Pass eval set via `--eval-set <repo>/ai-resources/skills/<skill>/evals/<...>.json`
- Write artifacts under target skill `eval-artifacts/**`

Canonical command family (replace `<skill>`):

```bash
# functional/semantic evals
python3 -m scripts.run_functional_eval \
  --skill-path "/abs/repo/ai-resources/skills/<skill>" \
  --eval-set "/abs/repo/ai-resources/skills/<skill>/evals/evals.json" \
  --artifacts-dir "/abs/repo/ai-resources/skills/<skill>/eval-artifacts/functional/<stamp>" \
  --timeout 120

# trigger routing evals
python3 -m scripts.run_eval \
  --skill-path "/abs/repo/ai-resources/skills/<skill>" \
  --eval-set "/abs/repo/ai-resources/skills/<skill>/evals/trigger-evals.json" \
  --runs-per-query 1 \
  --num-workers 1 \
  --timeout 120 \
  --artifacts-dir "/abs/repo/ai-resources/skills/<skill>/eval-artifacts/trigger/<stamp>"
```

Minimum pass criteria per skill:

- Functional eval set: `summary.failed == 0`
- Trigger eval set: all queries match expected `should_trigger` outcome
- Verification report committed under `ai-resources/skills/<skill>/evals/verification/*.md` with command lines + artifact locations

Discovery/index rule:

- Evals are discovered by per-skill directory convention (`ai-resources/skills/<skill>/evals/...`).
- No central eval index edits are allowed in additive phase.

## 9) Integration/e2e command requirements per implementation epic

Each implementation epic (`.3`, `.4`, `.5`) must provide and run:

1. Skill-specific integration deterministic test:
   - `bun test tests/integration/<skill>-additive-load.test.ts`
2. Shared additive no-touch guard:
   - `bun test tests/integration/additive-rollout-no-touch-guard.test.ts`
3. Skill-specific isolated e2e loadability check:
   - `bun test tests/e2e/<skill>-additive-isolated-load.test.ts`

Final unchanged-behavior regression run (required after adding new skill directories):

```bash
bun test tests/integration/plugin.test.ts
bun test tests/e2e/opencode.test.ts --test-name-pattern "scenario [1-4]"
```

The acceptance-review epic additionally runs full repo regression as needed.

## 10) Manual isolated field test (final gate)

Manual field tests must run in a disposable workspace where the old combined package/commands are removed from that workspace config, then install **only** the new skill package under test.

Required per-skill minimum workflow coverage:

- `coder-core`
  - load/install `coder-core`
  - execute one init/setup-or-doctor style workflow
  - confirm guidance is self-contained without requiring `coder-beads`/`coder-docs`
- `coder-beads`
  - load/install `coder-beads`
  - execute one planning/tracker workflow (`bd`-oriented)
  - confirm beads guidance is self-contained without requiring `coder-core` runtime docs
- `coder-docs`
  - load/install `coder-docs`
  - execute one docs-lifecycle or improve-doc workflow
  - confirm docs guidance is self-contained without requiring old combined skill routing

Manual evidence requirement per skill:

- one verification note under `ai-resources/skills/<skill>/evals/verification/*.md`
- include workspace setup steps, package install command, tested prompts/workflows, and observed outcome

## 11) Additive-phase evaluation path statement (explicit)

During additive rollout, evaluation is performed through:

- direct skill loading, or
- isolated package installation in disposable workspaces

It is **not** performed through existing slash-command routing, because command wrappers remain unchanged and continue to target unchanged `opencode-coder`.
