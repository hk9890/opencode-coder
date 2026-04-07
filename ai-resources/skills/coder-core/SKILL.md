---
name: coder-core
description: "Use this skill for core opencode-coder plugin/runtime workflows that do not require beads-specific tracker operations: init/setup guidance, mode/runtime behavior, plugin-runtime status and doctor troubleshooting, baseline /simplify workflow, plugin/runtime debug log analysis, plugin/runtime bug reporting, and session dump export. Do not use this skill for beads health (bd doctor, hooks, tracker diagnostics/follow-up) or docs lifecycle/AGENTS generation workflows."
---

## Core workflow routing (direct skill surface)

| Workflow | Use when | Source of truth |
|---|---|---|
| Init/setup guidance | You need to enable or configure plugin runtime behavior in a project | [references/installation-setup.md](references/installation-setup.md), [references/mode-runtime.md](references/mode-runtime.md) |
| Mode/runtime guidance | You need to reason about saved mode vs hard-disable and runtime phase behavior | [references/mode-runtime.md](references/mode-runtime.md) |
| Status/doctor (plugin/runtime scope) | Startup or command exposure looks wrong and you need non-beads checks first | [references/status-doctor.md](references/status-doctor.md), [references/troubleshooting-runtime.md](references/troubleshooting-runtime.md) |
| Simplify baseline workflow | You want to simplify recently changed code without widening scope | [references/simplify.md](references/simplify.md) |
| Debugging logs (plugin/runtime) | You need OpenCode/opencode-coder logs for troubleshooting evidence | [references/debugging-logs.md](references/debugging-logs.md), [references/troubleshooting-runtime.md](references/troubleshooting-runtime.md) |
| Bug reporting (plugin/runtime) | The issue appears to be in plugin/runtime behavior | [references/bug-reporting.md](references/bug-reporting.md), [references/debugging-logs.md](references/debugging-logs.md), [references/session-dump.md](references/session-dump.md) |
| Session dump export | You need to export current session diagnostics safely | [references/session-dump.md](references/session-dump.md) |

## Explicit boundaries

- In scope: plugin/runtime operations that still apply when beads is absent.
- Out of scope: beads tracker health, `bd doctor`, hooks, tracker diagnostics, issue filing/follow-up workflows, docs lifecycle, and AGENTS generation.
- If a request asks for docs lifecycle or AGENTS generation, do not execute that work in coder-core. Decline and delegate to `coder-docs` instead.
- If `coder-docs` is unavailable in the current runtime, explicitly state that limitation and stop at delegation guidance rather than attempting docs-lifecycle execution.
- For docs-lifecycle/AGENTS requests, return a short boundary response only: no `read`, `write`, `edit`, `bash`, `task`, or issue-tracker actions.

### Required response pattern for docs-lifecycle / AGENTS requests

When the user asks for docs lifecycle work or AGENTS generation, use this exact behavior:

1. State this is out-of-scope for `coder-core`.
2. Delegate to `coder-docs`.
3. If `coder-docs` is unavailable, say so and stop.

Do not perform any workspace/tool actions for these requests.

## Optional companion skills

- If you specifically need tracker diagnostics or tracker workflows, load `coder-beads` (optional companion).
- If you specifically need docs lifecycle or AGENTS generation workflows, load `coder-docs` (optional companion).
