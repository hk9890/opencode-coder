---
name: coder-beads
description: "Use this skill for beads-centric planning, issue structure, execution orchestration, acceptance review gates, beads setup/runtime troubleshooting, beads health checks, and beads follow-up bug/task filing. This skill is self-contained for tracker workflows and does not require coder-core or coder-docs at runtime."
---

# coder-beads

Standalone beads workflow surface.

This skill owns:

- planning and issue decomposition for beads work
- issue/task structure and labels
- execution orchestration across ready/blocked work
- acceptance-review gate patterns
- beads setup/runtime troubleshooting and health checks
- beads follow-up behavior (creating bugs/tasks for discovered issues)

This skill does **not** own docs lifecycle or AGENTS generation workflows.

## Workflow routing

| Need | Source of truth |
|---|---|
| Build an epic + tasks plan (including planning surface) | [references/planning.md](references/planning.md) |
| Structure issues, labels, dependencies, and task readiness | [references/beads-issue-workflow.md](references/beads-issue-workflow.md) |
| Run execution orchestration (ready queue, parallelization, blockers) | [references/execution-orchestration.md](references/execution-orchestration.md) |
| Run acceptance-review and close criteria | [references/beads-acceptance-review.md](references/beads-acceptance-review.md) |
| Fix setup/init/tooling problems for beads | [references/beads-setup-troubleshooting.md](references/beads-setup-troubleshooting.md) |
| Diagnose runtime/beads database workflow failures | [references/beads-runtime-troubleshooting.md](references/beads-runtime-troubleshooting.md) |
| Perform quick status/health verification | [references/beads-status-health.md](references/beads-status-health.md) |
| File tracker follow-ups / bug reports with evidence | [references/beads-bug-reporting.md](references/beads-bug-reporting.md) |

## Optional companions (not required)

Use other skills only when scope extends beyond beads ownership:

- docs lifecycle or AGENTS authoring tasks
- plugin-core/runtime internals outside beads workflow ownership

These are optional companions, never prerequisites for using `coder-beads`.
