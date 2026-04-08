---
name: coder-core
description: "Use this skill for core opencode-coder plugin/runtime workflows that do not require beads-specific tracker operations: init/setup guidance, mode/runtime behavior, plugin-runtime status and doctor troubleshooting, plugin/runtime debug log analysis, plugin/runtime bug reporting, and session dump export. Do not use this skill for beads health (bd doctor, hooks, tracker diagnostics/follow-up), docs lifecycle/AGENTS generation workflows, or /simplify cleanup requests (use code-simplify)."
---

## Core workflow routing (direct skill surface)

| Workflow | Use when | Source of truth |
|---|---|---|
| Init/setup guidance | You need to enable or configure plugin runtime behavior in a project | [references/installation-setup.md](references/installation-setup.md), [references/mode-runtime.md](references/mode-runtime.md) |
| Mode/runtime guidance | You need to reason about saved mode vs hard-disable and runtime phase behavior | [references/mode-runtime.md](references/mode-runtime.md) |
| Status/doctor (plugin/runtime scope) | Startup or command exposure looks wrong and you need non-beads checks first | [references/status-doctor.md](references/status-doctor.md), [references/troubleshooting-runtime.md](references/troubleshooting-runtime.md) |
| Debugging logs (plugin/runtime) | You need OpenCode/opencode-coder logs for troubleshooting evidence | [references/debugging-logs.md](references/debugging-logs.md), [references/troubleshooting-runtime.md](references/troubleshooting-runtime.md) |
| Bug reporting (plugin/runtime) | The issue appears to be in plugin/runtime behavior | [references/bug-reporting.md](references/bug-reporting.md), [references/debugging-logs.md](references/debugging-logs.md), [references/session-dump.md](references/session-dump.md) |
| Session dump export | You need to export current session diagnostics safely | [references/session-dump.md](references/session-dump.md) |
