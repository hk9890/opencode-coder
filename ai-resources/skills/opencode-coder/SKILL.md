---
name: opencode-coder
description: "Reference hub for opencode-coder planning, setup, project-doc guidance, simplify, debugging, and support workflows. Use this skill when the AI assistant needs to plan beads work, set up project docs, run the /simplify workflow, install or initialize bd or opencode-coder, switch stealth/team modes, check health, analyze logs, troubleshoot plugin behavior, generate AGENTS.md guidance, or help report opencode-coder bugs."
---

`opencode-coder` is the canonical workflow hub for the opencode-coder command set.

Command files should stay thin wrappers that only:

1. load this skill
2. pass meaningful `$ARGUMENTS` when needed
3. ask this skill to run the matching workflow

Command bodies should not enumerate reference files. Reference routing is owned here.

## Command-backed workflow contract

| Workflow | Typical entrypoint | Use when | Argument expectations | Source of truth |
|---|---|---|---|---|
| Simplify recently changed code | `/simplify` | After implementation work to clean up the most recently changed files without widening scope | Optional free-text focus via `$ARGUMENTS`; apply as weighting guidance, not scope expansion permission. | [references/simplify.md](references/simplify.md) |
| Init / enablement | `/opencode-coder/init` | Enable, disable, refresh, or switch project mode | No required free-text argument. Use interactive questions for mode/action decisions. | [references/installation-setup.md](references/installation-setup.md), [references/project-structure.md](references/project-structure.md), [references/mode-transition.md](references/mode-transition.md), [references/project-docs-lifecycle.md](references/project-docs-lifecycle.md), [references/agents-md-template.md](references/agents-md-template.md) |
| Docs lifecycle | `/opencode-coder/docs` | Inspect/bootstrap/refresh/audit/slim/verify project docs and AGENTS routing | No required argument. Infer from repo state and user goal. | [references/project-docs-lifecycle.md](references/project-docs-lifecycle.md), [references/project-structure.md](references/project-structure.md) |
| Incident-driven docs improvement | `/opencode-coder/improve-doc` | A failure happened because guidance was missing/stale/unclear/misrouted | Optional free-text incident context via `$ARGUMENTS`; if empty/vague, ask follow-ups. | [references/project-docs-lifecycle.md](references/project-docs-lifecycle.md), [references/project-structure.md](references/project-structure.md) |
| Status snapshot | `/opencode-coder/status` | Quick current plugin/project status and immediate health signal summary | Optional focus via `$ARGUMENTS` (for example: mode, hooks, aimgr). | [references/status-health.md](references/status-health.md), [references/project-structure.md](references/project-structure.md) |
| Doctor / troubleshooting | `/opencode-coder/doctor` | Setup appears broken or unhealthy and deeper diagnosis is needed | No required argument. Ask before repair actions. | [references/status-health.md](references/status-health.md), [references/troubleshooting-patterns.md](references/troubleshooting-patterns.md), [references/troubleshooting-installation-init.md](references/troubleshooting-installation-init.md), [references/troubleshooting-runtime-config.md](references/troubleshooting-runtime-config.md), [references/troubleshooting-agents-git-performance.md](references/troubleshooting-agents-git-performance.md) |
| Plugin bug reporting | `/opencode-coder/report-bug` | Problem appears to be in the plugin rather than only in user project code | Optional bug context via `$ARGUMENTS`; ask for missing evidence before filing. | [references/bug-reporting.md](references/bug-reporting.md), [references/debugging-logs.md](references/debugging-logs.md) |
| Session dump export | `/opencode-coder/dump-session` | User needs current session exported for diagnostics/support | No required argument. Export to private session-dump path and warn about sensitive data. | [references/session-dump.md](references/session-dump.md) |

## Additional supported workflows

| Need | Source of truth |
|---|---|
| Create epics/tasks/acceptance tasks and execution plans | [references/planning.md](references/planning.md) |
| Understand docs setup model and project-doc content boundaries | [references/project-setup.md](references/project-setup.md) |
| Analyze plugin logs and debugging signals | [references/debugging-logs.md](references/debugging-logs.md) |
| Generate AGENTS.md structure/content skeleton | [references/agents-md-template.md](references/agents-md-template.md) |

## Ownership boundary

For `/simplify`, this skill is authoritative and routes to `references/simplify.md`.
The command file `ai-resources/commands/simplify.md` must remain a thin wrapper and must not duplicate simplify workflow steps.

For project-doc lifecycle orchestration, this skill is authoritative. Route to `references/project-docs-lifecycle.md`.
