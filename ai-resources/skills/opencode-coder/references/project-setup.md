# Project Setup

This guide defines a project-doc structure that keeps routing simple and context controlled for humans and coding agents.

The goal is selective loading: an agent should not load the full project handbook for every task. Split durable project knowledge into focused docs so the agent can load only what the current task needs. For example, an agent running integration tests often needs `AGENTS.md` and `docs/TESTING.md`, not the full project overview or coding guide.

For detailed authoring standards, see
[project-doc-guidelines.md](project-doc-guidelines.md).

## Core idea

- `README.md` is the user-facing entry point for the repository.
- `AGENTS.md` is the routing layer, not the handbook.
- Topic docs under `docs/` hold the durable project-specific guidance.
- Create a topic doc only when it has real repository-specific rules to preserve.
- If a reusable skill already covers a topic and the project has no local additions, route to the skill instead of creating a duplicate project doc.

## Standard file set

Use these names when the project actually needs each topic:

```text
README.md
AGENTS.md
CONTRIBUTING.md
docs/
  OVERVIEW.md
  CODING.md
  TESTING.md
  RELEASING.md
  MONITORING.md
  CHANGE-WORKFLOW.md
```

These are standard slots, not required files. A valid minimal setup can be:

```text
README.md
AGENTS.md
docs/
  OVERVIEW.md
  CODING.md
  TESTING.md
```

## Ownership boundaries by file

### `README.md`

- User-facing repository entry point.
- Explains what the project is, what it is for, and how to use it at a high level.
- Links to the main setup, contributor, and deeper technical docs.
- Load when the task needs front-door project context, public-facing usage context, or the repository's main entrypoint.

### `AGENTS.md`

- Entry point and router for coding agents.
- Links to the right docs and skills for the current task.
- Keeps only short project summary, critical workflow rules, and routing pointers.
- Load first when deciding which other docs or skills are needed.

### `docs/OVERVIEW.md`

- Project/domain overview.
- High-level architecture, core concepts, and a high-level repo map that helps the agent find relevant areas quickly.
- May include relevant external references when they are important for understanding the project.
- Load for research, architecture analysis, domain understanding, and unfamiliar-code investigation.

### `docs/CODING.md`

- Repository-specific implementation rules, invariants, and coding conventions.
- Build/dev commands, important edit boundaries, and common implementation patterns.
- Load when changing production code, refactoring, or planning implementation work.

### `docs/TESTING.md`

- Repository-specific test strategy and commands.
- Test prerequisites, test layers, minimum checks, manual-test guidance, and workflow details.
- Load when validating changes, deciding which tests to run, or preparing verification work.

### `docs/RELEASING.md`

- Current repository-specific release steps, constraints, automation entrypoints, and validation rules.
- Load for release execution, release-process changes, or release troubleshooting.

### `docs/MONITORING.md`

- Repository-specific observability, evidence gathering, and triage guidance.
- Explains where logs, dashboards, traces, queries, or other monitoring data live and how to access them for this project.
- Load for incident investigation, monitoring analysis, or operational debugging.

### `docs/CHANGE-WORKFLOW.md`

- Repository-specific change-landing expectations for direct-to-main and branch-based flows.
- Covers commit/push policy, branch creation, pull-request rules when used, review expectations, and merge behavior.
- Load when deciding commit, push, branch, PR, review, or merge actions.

### `CONTRIBUTING.md`

- Contributor onboarding and local development setup flow.
- Covers prerequisites, workspace setup, and the path from first checkout to first landed change.
- Links to `docs/CODING.md`, `docs/TESTING.md`, and `docs/CHANGE-WORKFLOW.md` when those deeper docs exist.
- Load when setting up the project for development or helping a contributor get started.

## Skills vs project docs

- Skills provide reusable baseline workflows.
- Project docs provide repository-local memory: commands, paths, conventions, constraints, and local failure modes.
- When both are used, local project-doc rules should be consistent with and refine the skill baseline.
- Writers and reviewers should inspect the installed skills and adapt the doc set to them.
- If no local rules exist for a topic, skip the project doc and route from `AGENTS.md` to the skill.

## Routing model

Treat `AGENTS.md` as a map:

1. Identify the task type.
2. Route to the relevant topic doc(s) and/or skill.
3. Load only what is needed for that task.

Typical routing examples:

- `AGENTS.md` → `docs/OVERVIEW.md` for project research and architecture context
- `AGENTS.md` → `docs/CODING.md` for implementation work
- `AGENTS.md` → `docs/TESTING.md` for validation work
- `AGENTS.md` → `docs/CHANGE-WORKFLOW.md` for commit/push/branch/PR/review/merge decisions
- `AGENTS.md` → skill + matching local topic doc when both apply

This keeps shared default context small while preserving durable local guidance in focused files.

## Minimal bootstrap order

1. Create `README.md` if the repository does not already have a useful user-facing entrypoint.
2. Create `AGENTS.md` as the routing layer.
3. Create `docs/OVERVIEW.md`.
4. Create `docs/CODING.md`.
5. Add `docs/TESTING.md` once a repeatable test workflow exists.
6. Add `CONTRIBUTING.md` when the project has a real contributor setup flow to preserve.
7. Add other standard topic docs only when real local guidance appears.
8. Keep links between `README.md`, `AGENTS.md`, topic docs, and skills current.
