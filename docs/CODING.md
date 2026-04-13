# Coding Guidelines

For contributor workflow, see [`../CONTRIBUTING.md`](../CONTRIBUTING.md).  
For test selection and commands, see [`TESTING.md`](TESTING.md).

Use this guide when changing this repo.

## Build & Development Commands

| Command | Purpose |
|---|---|
| `bun run build` | Build the plugin artifact at `dist/opencode-coder.js` |
| `bun run dev` | Watch-mode local development |
| `bun run typecheck` | TypeScript safety check |
| `bun run opencode:dev` | Build, then start OpenCode with DEBUG logging |

## Change-Type Matrix

| Change type | Edit here first | Usually update together |
|---|---|---|
| Startup or mode behavior | `src/index.ts` | `src/service/plugin-mode-service.ts`, `src/service/project-detector-service.ts`, `docs/OVERVIEW.md` if behavior changes |
| Service or helper logic | `src/service/`, `src/core/`, `src/config/` | matching unit tests under `tests/unit/` |
| Published commands / skills / agents | `ai-resources/` | matching skill references, command wrappers, and user docs if behavior changed |
| Installed runtime resources under `.opencode/` | Do **not** edit `.opencode/` directly; update the owning source in `ai-resources/`, `src/`, or test fixtures instead | only inspect `.opencode/` to verify runtime/install state after updating the real source |
| `coder` tool or session export | `src/tool/coder-tool.ts` | `src/service/session-export-service.ts`, diagnostics docs/tests |
| Logs / diagnostics / manual harness | `scripts/`, `src/core/opencode-log-paths.ts` | `docs/MONITORING.md`, `docs/TESTING.md`, matching unit/integration tests |
| Docs lifecycle / project setup guidance | `ai-resources/skills/coder-docs/references/` (and `ai-resources/skills/coder-docs/SKILL.md` when the docs-lifecycle entrypoint itself changes) | keep the matching copies under `docs/user-guide/` aligned with the canonical source; do **not** edit `.opencode/` |

For required checks, use the change-type matrix in [`TESTING.md`](TESTING.md#change-type-matrix).

## Repository Structure

```text
src/
  index.ts                 plugin startup and mode orchestration
  core/                    shared low-level helpers
  config/                  env/config loading
  service/                 domain services
  tool/                    exposed tool implementations
  templates/               generated setup/init text
ai-resources/              published commands, skills, and agents
.opencode/                 repo-local development resources (not published)
scripts/                   diagnostics, harness, and maintenance tooling
tests/                     unit, integration, and e2e coverage
docs/                      canonical repo docs, user guides, and reference material
```

## Architecture Boundaries

### 1. Keep `src/index.ts` orchestration-only

`src/index.ts` should stay small and startup-focused.

It should:

- resolve startup mode
- wire services together
- decide whether the plugin is active
- sequence startup side effects

It should **not** absorb domain logic that belongs in services.

### 2. Startup side effects happen only after mode is resolved

When changing startup behavior, preserve these invariants:

- hard-disabled state wins over saved mode
- fresh or saved-disabled projects must not trigger active side effects
- inactive startup paths must not create active-project artifacts by accident
- project detection should use the final startup health result, not a stale pre-repair snapshot
- startup/config branching should derive from the shared startup-state model
  (`src/core/startup-state.ts`) rather than recomputing mode/phase decisions in multiple files

Start with:

- `src/index.ts`
- `src/service/plugin-mode-service.ts`
- `src/service/project-detector-service.ts`
- `src/service/aimgr-service.ts`

Check against:

- `tests/unit/service/plugin-mode-service.test.ts`
- `tests/unit/service/project-detector-service.test.ts`
- `tests/unit/service/aimgr-service.test.ts`
- `tests/integration/plugin.test.ts`

### 3. Import through package indexes

When a package has an `index.ts`, import through the package boundary rather than internal files.

Good:

```ts
import { createLogger } from "./core"
```

Avoid:

```ts
import { createLogger } from "./core/logger"
```

Keep public exports explicit and keep implementation details private.

### 4. Keep published and local resources separate

- `ai-resources/` ships with the plugin
- `.opencode/` contains aimgr-managed installed runtime resources for this repository

If a change should affect plugin users, edit `ai-resources/`.
Do **not** edit `.opencode/skills/` or `.opencode/commands/` directly.

### 5. Keep commands thin and workflow logic in skills/references

If a command and a skill cover the same workflow:

- command file = thin entrypoint
- `SKILL.md` = workflow routing
- reference docs = durable detail

See [`user-guide/how-to-write-commands.md`](user-guide/how-to-write-commands.md).
For runtime skill content boundaries, see [`user-guide/how-to-write-skills.md`](user-guide/how-to-write-skills.md).

### 6. Respect canonical doc sources and copied user-guide entrypoints

Docs lifecycle work in this repo follows split ownership:

- published canonical references under `ai-resources/skills/coder-docs/references/`
- the published docs-lifecycle entrypoint at `ai-resources/skills/coder-docs/SKILL.md`
- plugin-coupled runtime/bootstrap entrypoint at `ai-resources/skills/coder-core/SKILL.md`
- contributor-facing copies under `docs/user-guide/`

The `coder-docs` references are the source of truth for docs-lifecycle content. If the docs-lifecycle skill entrypoint itself must change, edit `ai-resources/skills/coder-docs/SKILL.md`.

The plugin runtime should track only bootstrap/core availability and beads readiness. Keep this ownership split explicit in docs:

- `coder-core` = plugin-coupled runtime/bootstrap owner
- `coder-beads` = plugin-integrated only for defaults/activation when beads is ready
- `coder-docs` and `code-simplify` = standalone skill owners

Do **not** edit `.opencode/skills/` or `.opencode/commands/` directly; they are installed runtime surfaces derived from the published sources.

In this repo:

- `docs/user-guide/project-setup.md` is a copy of the canonical source
- `docs/user-guide/project-doc-guidelines.md` is a copy of the canonical source
- `docs/user-guide/project-doc-review-guidelines.md` is a copy of the canonical source

When you change one of these areas:

1. update the canonical source under `ai-resources/skills/coder-docs/references/`
2. keep the matching `docs/user-guide/` copy in sync
3. do not edit `.opencode/`; update the published source and matching user-guide copy together

Examples:

- `ai-resources/skills/coder-docs/references/project-setup.md` ↔ `docs/user-guide/project-setup.md`
- `ai-resources/skills/coder-docs/references/project-doc-guidelines.md` ↔ `docs/user-guide/project-doc-guidelines.md`
- `ai-resources/skills/coder-docs/references/project-doc-review-guidelines.md` ↔ `docs/user-guide/project-doc-review-guidelines.md`

## How to Change This Repo Safely

### Startup / mode / detection work

Edit here first:

- `src/index.ts`
- `src/service/plugin-mode-service.ts`
- `src/service/project-detector-service.ts`

Also inspect:

- `src/service/aimgr-service.ts`
- `tests/integration/plugin.test.ts`
- `docs/OVERVIEW.md` or `README.md` if behavior visible to users changed

Good rule: if startup behavior changes, verify both the pure service logic and the end-to-end plugin path.

### Published command / skill / agent work

Edit here first:

- `ai-resources/commands/`
- `ai-resources/skills/`

Also inspect:

- `tests/integration/plugin.test.ts`
- `tests/e2e/opencode.test.ts`
- `docs/user-guide/how-to-write-commands.md`
- `docs/user-guide/how-to-write-skills.md`
- user docs if user-facing behavior changed

Good rule: do not copy large workflow logic into command wrappers when the skill should own it.

### Service logic work

Edit here first:

- `src/service/*.ts`
- `src/core/*.ts`
- `src/config/*.ts`

Also inspect:

- `tests/unit/service/*.test.ts`
- adjacent unit tests such as `tests/unit/parser.test.ts`, `tests/unit/env.test.ts`, `tests/unit/logger.test.ts`

Good rule: make the smallest domain-local change you can before widening behavior elsewhere.

### `coder` tool / session export work

Edit here first:

- `src/tool/coder-tool.ts`
- `src/service/session-export-service.ts`

Also inspect:

- `tests/unit/service/session-export-service.test.ts`
- `tests/unit/coder-tool-logs.test.ts`
- `docs/MONITORING.md`

### Diagnostics / logging / harness work

Edit here first:

- `src/core/opencode-log-paths.ts`
- `scripts/log-analyzer/`
- `scripts/collect-diagnostics/`
- `scripts/manual-test/`

Also inspect:

- `tests/unit/log-analyzer.test.ts`
- `tests/unit/collect-diagnostics.test.ts`
- `tests/unit/opencode-log-paths.test.ts`
- `tests/integration/manual-launcher.test.ts`
- `tests/unit/validate-isolated-pins.test.ts`

Good rule: if a change affects isolated harness behavior or pins, run `bun run validate:isolated-pins`.

### Docs lifecycle / project-doc work

Edit here first:

- `ai-resources/skills/coder-docs/references/`
- `ai-resources/skills/coder-docs/SKILL.md` when the docs-lifecycle entrypoint wording changes
- `ai-resources/skills/coder-core/SKILL.md` when plugin-coupled bootstrap/runtime guidance wording changes

Also inspect:

- `tests/unit/docs-lifecycle-contract.test.ts`
- `docs/OVERVIEW.md`
- `AGENTS.md`

Good rule: keep routing docs short, move deep detail into focused docs, and never edit the `.opencode/` installed runtime copies.

## Files That Often Change Together

| If you touch | Also check |
|---|---|
| `src/index.ts` | `src/service/plugin-mode-service.ts`, `src/service/project-detector-service.ts`, `tests/integration/plugin.test.ts` |
| `src/service/aimgr-service.ts` | `src/service/project-detector-service.ts`, `tests/unit/service/aimgr-service.test.ts`, startup-related docs |
| `src/tool/coder-tool.ts` | `src/service/session-export-service.ts`, `docs/MONITORING.md`, unit tests |
| `scripts/log-analyzer/` | `docs/MONITORING.md`, `tests/unit/log-analyzer.test.ts` |
| `scripts/validate-isolated-pins.ts` or harness setup | `docs/TESTING.md`, `tests/unit/validate-isolated-pins.test.ts`, `tests/integration/manual-launcher.test.ts` |
| `ai-resources/skills/coder-docs/references/project-setup.md` | `docs/user-guide/project-setup.md` |
| `ai-resources/skills/coder-docs/references/project-doc-guidelines.md` | `docs/user-guide/project-doc-guidelines.md` |
| `ai-resources/skills/coder-docs/references/project-doc-review-guidelines.md` | `docs/user-guide/project-doc-review-guidelines.md` |

## Representative References

- `tests/integration/plugin.test.ts` — plugin registration, gating, and startup behavior
- `tests/integration/manual-launcher.test.ts` — manual launcher/harness integration behavior
- `tests/e2e/opencode.test.ts` — real CLI startup and runtime exposure
- `tests/unit/service/*.test.ts` — service-level unit patterns
- `docs/user-guide/how-to-write-commands.md` — command-authoring conventions
- `docs/user-guide/how-to-write-skills.md` — runtime skill-authoring boundaries
- `docs/OVERVIEW.md` — project overview, repo map, and doc routes

If you change behavior that a maintainer would need to remember later, update the matching canonical doc in the same change.
