---
description: Check health of opencode-coder plugin setup
---

# Coder Doctor

Use `/opencode-coder/doctor` when the plugin setup may be broken, incomplete, or unhealthy.

## Task

Load the `opencode-coder` skill:

```
skill({ name: "opencode-coder" })
```

Then use the health and troubleshooting references to:

1. Check the current plugin/project status.
   - plugin disabled vs active
   - beads status
   - git hooks
   - git sync state when relevant

2. Run `bd doctor` when beads is initialized.

3. Run the aimgr resource health check described below.

4. Summarize what is healthy, what is broken, what was repaired, and what still needs user action.

## aimgr Resource Health

Run this check:

```bash
aimgr verify --format json
```

Interpret the result and respond accordingly:

- **If the command is not found** (aimgr not installed): report "aimgr not installed — skipping resource health check" and continue.
- **If no issues are found** (empty issues/errors arrays, or `status` is `"ok"` / `"healthy"`): report "aimgr resources: all healthy".
- **If issues are found** (non-empty `issues` or `errors` arrays, or a non-ok `status` field):
  1. Display the issues clearly to the user.
  2. Ask the user via `question()`: **"Resource issues detected. Want me to attempt repair?"**
      - **YES**: Run `aimgr repair --format json` and parse the result:
        - Report `summary.fixed` resources repaired (list items from the `fixed` array — each has `resource`, `tool`, `issue_type`, `description`)
        - If `summary.failed > 0`: show the failed items and suggest `aimgr uninstall <resource>` for resources that could not be repaired automatically
        - If `hints` array is non-empty: show the hints to the user (each has `resource`, `description`)
      - **NO**: Acknowledge and continue with the remaining doctor checks.

## Report

End with a concise doctor summary:

- healthy components
- failed or missing components
- repairs attempted and their outcome
- next recommended actions
