---
description: Inspect, bootstrap, refresh, audit, and verify project docs lifecycle
---

# Project Docs Lifecycle

Use `/opencode-coder/docs` as the primary docs lifecycle entry point.

## Task

Load the `opencode-coder` skill, then use:

- `references/project-structure.md`
- `references/project-docs-lifecycle.md`

## Dispatcher Flow (thin)

### 1) Detect mode and canonical paths

Determine active mode from `.coder/opencode-coder.yaml` first, then fallback to legacy markers.

Apply canonical paths from `project-structure.md`:

- team → `AGENTS.md`, `docs/`
- stealth → `.coder/AGENTS.md`, `.coder/docs/`

### 2) Inspect high-level state

Gather only high-level signals:

- whether AGENTS file exists at the active path
- whether docs directory exists at the active path
- which standard docs exist (`OVERVIEW`, `CODING`, `TESTING`, `RELEASING`, `MONITORING`, `PULL-REQUESTS`)
- whether `.opencode/skills/` exists for skill routing candidates

### 3) Dispatch lifecycle mode

Select primary mode and run the shared workflow in `project-docs-lifecycle.md`:

- no active AGENTS/docs baseline → **bootstrap**
- baseline exists and needs normal maintenance → **refresh**
- user asks for doc health cleanup or stale link repair → **audit**
- user asks to reduce oversized docs/context footprint → **slim**
- AGENTS-only routing refresh request → run **AGENTS phase** within lifecycle

Always run **inspect** first and **verify/report** last.

### 4) Report

Return a concise summary:

- mode and active paths used
- phases executed
- files changed
- files skipped (and why)
- skill-only routed topics (no local doc created)

## Rules

- Do not inline the full lifecycle workflow here
- Keep lifecycle logic in `references/project-docs-lifecycle.md`
- Treat AGENTS updates as one lifecycle phase, not a separate command family
