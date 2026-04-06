---
name: coder-docs
description: "Use this skill for project-doc setup/taxonomy guidance, docs lifecycle workflows (init/update/audit/slim/verify), targeted doc improvement, AGENTS.md generation guidance, and project-doc review guidance. This skill is standalone and does not require coder-core or coder-beads command routing."
---

## Standalone workflow contract

This skill is intentionally focused on docs lifecycle ownership.

- Primary scope: project-doc setup, taxonomy, lifecycle maintenance, AGENTS generation guidance, and project-doc review guidance.
- Optional companion topics (issue tracking or diagnostics) may be referenced only as context pointers and are never required prerequisites for docs lifecycle execution.
- Change-landing guidance belongs to `CHANGE-WORKFLOW.md` in the project-doc taxonomy.

## Workflow routing

| Workflow | Use when | Source of truth |
|---|---|---|
| Project-doc setup and taxonomy | Defining the canonical doc set and file ownership boundaries | [references/project-setup.md](references/project-setup.md), [references/project-structure.md](references/project-structure.md) |
| Docs lifecycle (init/update/audit/slim/verify) | Running end-to-end doc lifecycle work for a repository | [references/project-docs-lifecycle.md](references/project-docs-lifecycle.md), [references/project-doc-guidelines.md](references/project-doc-guidelines.md), [references/project-doc-review-guidelines.md](references/project-doc-review-guidelines.md), [references/project-structure.md](references/project-structure.md) |
| Improve-doc workflow | Performing incident-driven or discussion-first doc improvements | [references/project-docs-lifecycle.md](references/project-docs-lifecycle.md), [references/project-doc-guidelines.md](references/project-doc-guidelines.md), [references/project-doc-review-guidelines.md](references/project-doc-review-guidelines.md) |
| AGENTS generation guidance | Creating/updating AGENTS as a routing surface aligned to docs taxonomy | [references/agents-md-template.md](references/agents-md-template.md), [references/project-setup.md](references/project-setup.md), [references/project-structure.md](references/project-structure.md) |
| Project-doc review | Reviewing canonical docs for quality, scope, and repo-truth correctness | [references/project-doc-review-guidelines.md](references/project-doc-review-guidelines.md), [references/project-doc-guidelines.md](references/project-doc-guidelines.md), [references/project-setup.md](references/project-setup.md) |

## Ownership boundary

This skill owns:

- docs lifecycle guidance and execution model
- AGENTS generation guidance/template for docs routing
- project-doc setup and taxonomy guidance
- project-doc content review guidance

This skill does not primarily own:

- plugin bug-reporting workflows
- debugging-log triage workflows
- external tracker synchronization workflows

If those topics are relevant in a docs conversation, treat them as optional companion references only.
