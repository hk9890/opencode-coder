---
name: coder-beads
description: "Use this skill for beads-centric planning, issue structure, execution orchestration, acceptance review gates, beads setup/runtime troubleshooting, beads health checks, and beads follow-up bug/task filing when users ask to capture tracker bugs/tasks (for example with repro and expected vs actual), even without explicitly saying beads. Trigger only for beads tracker workflow requests. Do not trigger for opencode-coder mode/runtime controls (stealth mode, team mode, OPENCODE_CODER_DISABLED), observability or production-log triage into bugs, external task-sync/import-export workflows (GitHub issues/Jira), docs lifecycle/taxonomy cleanup, simplify cleanup, GitHub releases, or general coding tasks."
---

# coder-beads

## Workflow routing

| Need | Source of truth |
|---|---|
| Build an epic + tasks plan (including planning surface) | [references/planning.md](references/planning.md) |
| Structure issues, labels, dependencies, and task readiness | [references/beads-issue-workflow.md](references/beads-issue-workflow.md) |
| Run execution orchestration (ready queue, parallelization, blockers) | [references/execution-orchestration.md](references/execution-orchestration.md) |
| Run acceptance-review and close criteria | [references/beads-acceptance-review.md](references/beads-acceptance-review.md) |
| Initialize and set up beads | [references/beads-init.md](references/beads-init.md) |
| Troubleshoot broken beads setup/runtime | [references/beads-setup-troubleshooting.md](references/beads-setup-troubleshooting.md) |
| Diagnose runtime/beads database workflow failures | [references/beads-runtime-troubleshooting.md](references/beads-runtime-troubleshooting.md) |
| Perform quick status/health verification | [references/beads-status-health.md](references/beads-status-health.md) |
| File tracker follow-ups / bug reports with evidence | [references/beads-bug-reporting.md](references/beads-bug-reporting.md) |

## Additional routing

- For docs lifecycle or AGENTS authoring work, route to `coder-docs`.
- For plugin runtime/bootstrap/status/doctor workflows, route to `coder-core`.
