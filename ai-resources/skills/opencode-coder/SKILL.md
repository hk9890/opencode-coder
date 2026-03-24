---
name: opencode-coder
description: "Reference hub for opencode-coder planning, setup, project-doc guidance, simplify, debugging, and support workflows. Use this skill when the AI assistant needs to plan beads work, set up project docs, run the /simplify workflow, install or initialize bd or opencode-coder, switch stealth/team modes, check health, analyze logs, troubleshoot plugin behavior, generate AGENTS.md guidance, or help report opencode-coder bugs."
---

# opencode-coder Skill

Reference hub for the opencode-coder plugin. Load specific documents based on what you need.

## Ownership Boundary

`opencode-coder` is the canonical home for **project-document lifecycle work** in initialized projects:

- setup/bootstrap
- create
- fix/update
- audit/repair
- slim/split
- incident-driven improve after failures

For this lifecycle scope, route to `references/project-docs-lifecycle.md` and do not split responsibility across other skills.

`fix-documentation` may still be used for narrowly scoped, single-file editorial cleanup (typos/grammar/clarity), but not for project-wide lifecycle orchestration.

## When to Load What

| Need | Load |
|------|------|
| Create epics, tasks, acceptance review tasks, plan work | [references/planning.md](references/planning.md) — includes execution expectations |
| Install or initialize beads/plugin | [references/installation-setup.md](references/installation-setup.md) |
| Run project docs lifecycle or incident-driven docs improvement (`/opencode-coder/docs`, `/opencode-coder/improve-doc`) | [references/project-docs-lifecycle.md](references/project-docs-lifecycle.md) — always run Phase 7 verification |
| Understand project layout, paths, and file rules | [references/project-structure.md](references/project-structure.md) |
| Simplify recently changed code after implementation work | [references/simplify.md](references/simplify.md) |
| Switch between stealth and team modes | [references/mode-transition.md](references/mode-transition.md) |
| Debug plugin or analyze logs | [references/debugging-logs.md](references/debugging-logs.md) |
| Check system/plugin health | [references/status-health.md](references/status-health.md) |
| Report a plugin bug | [references/bug-reporting.md](references/bug-reporting.md) |
| Troubleshoot common problems | [references/troubleshooting-patterns.md](references/troubleshooting-patterns.md) |
| Generate AGENTS.md format/content skeleton | [references/agents-md-template.md](references/agents-md-template.md) |

This skill is both a reference hub and a workflow hub: commands like `/simplify` can load it and follow the appropriate reference workflow.
