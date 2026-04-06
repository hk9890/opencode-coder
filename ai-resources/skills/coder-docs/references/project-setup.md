# Project-Doc Setup

Use this reference to establish a clean project-doc baseline that supports selective loading by humans and coding agents.

## Baseline model

- `README.md`: user-facing project entrypoint
- `AGENTS.md` (or mode-correct equivalent): routing layer
- `docs/` topic files: durable repo-specific operating guidance

Create topic docs only when the repository has real local guidance for that topic.

## Canonical topic set

Use these names when relevant:

```text
docs/
  OVERVIEW.md
  CODING.md
  TESTING.md
  RELEASING.md
  MONITORING.md
  CHANGE-WORKFLOW.md
```

Notes:

- `CHANGE-WORKFLOW.md` is the canonical location for change-landing guidance.
- If a reusable skill fully covers a topic and there is no local delta, do not create a hollow doc for that topic.

## File ownership boundaries

### `README.md`

- Project identity and front-door usage context
- Links to deeper docs

### `AGENTS.md`

- Routing table only
- Short project summary + task-to-doc/skill routes
- Avoid duplicating full procedures

### `docs/OVERVIEW.md`

- Architecture and domain orientation

### `docs/CODING.md`

- Repository-specific implementation constraints and edit patterns

### `docs/TESTING.md`

- Test-layer policy, commands, and minimum checks

### `docs/RELEASING.md`

- Repo-specific release constraints and entrypoints

### `docs/MONITORING.md`

- Repo-specific observability and evidence paths

### `docs/CHANGE-WORKFLOW.md`

- Commit/push/branch/PR/review/merge expectations

## Steering-doc defaults

- Agent-first writing for canonical steering docs
- Scan-first and action-first structure
- No default compatibility redirect files for steering docs
- Non-standard steering docs are consolidation candidates unless explicitly justified

## Routing pattern

1. Load AGENTS first.
2. Route to only the docs needed for the current task.
3. Route to reusable skills for generic workflow baselines.
4. Keep project docs focused on local deltas: commands, paths, constraints, and failure modes.
