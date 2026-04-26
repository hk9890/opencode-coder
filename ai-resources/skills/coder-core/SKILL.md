---
name: coder-core
description: "Use this skill for core opencode-coder plugin/runtime workflows like init/setup guidance, mode/runtime behavior, plugin-runtime status and doctor troubleshooting, plugin/runtime debug log analysis, plugin/runtime bug reporting, and session dump export."
---

## Core workflow routing (direct skill surface)

| Workflow                                           | Use when                                                           | Source of truth                                                      |
|----------------------------------------------------|--------------------------------------------------------------------|----------------------------------------------------------------------|
| Initialize and set up opencode-coder for a project | You need to initialize or finish setting up coder for a project    | [references/installation-setup.md](references/installation-setup.md) |
| Status/doctor (plugin/runtime scope)               | Startup or command exposure looks wrong and you need checks first  | [references/status-doctor.md](references/status-doctor.md)           |
| Debugging logs (plugin/runtime)                    | You need OpenCode/opencode-coder logs for troubleshooting evidence | [references/debugging-logs.md](references/debugging-logs.md)         |
| Bug reporting (plugin/runtime)                     | The issue appears to be in plugin/runtime behavior                 | [references/bug-reporting.md](references/bug-reporting.md)           |
| Session dump export                                | You need to export current session diagnostics safely              | [references/session-dump.md](references/session-dump.md)             |
