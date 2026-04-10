# Project Doc Guidelines

Canonical authoring standard for project docs.

Use it together with these companion references:

- [project-setup.md](project-setup.md) explains which canonical docs should exist, what each one owns, and when an agent should load them.
- [project-doc-review-guidelines.md](project-doc-review-guidelines.md) is the reviewer-only companion for evaluating finished docs against the authoring standard and repository reality.

## Authoring goals

## Steering-doc defaults (canonical layer)

Apply these defaults to canonical steering docs (`AGENTS.md`, `CONTRIBUTING.md`, and standard topic docs under `docs/`):

| Rule | Requirement |
|---|---|
| Primary audience | Agent-first. Maintainers/contributors are expected to execute workflows through agents. |
| Authoring style | Scan-first + action-first by default (checklists, decision tables, commands, file paths). |
| Compatibility goal | Backward-compatible redirect files are **not** a default goal for steering docs. |
| Legacy steering docs | Non-standard filenames are consolidation candidates; keep only with explicit scoped justification. |

For keep/merge/split/delete execution details and evidence requirements, follow [project-docs-lifecycle.md](project-docs-lifecycle.md).

### 1. Write for action, not narration

Project docs should help a human or agent decide what to do next.

Prefer:

- commands
- file paths
- checklists
- decision tables
- short rationale for non-obvious rules

Avoid long prose that explains the same point multiple times.

### 2. Optimize for selective loading

Agents often load docs into context. Expensive docs are noisy docs.

Good defaults:

- short sections
- short paragraphs
- one idea per bullet
- links instead of repeated background
- small examples instead of long copied blocks

Bad signs:

- repeated definitions
- generic advice that could apply to any repo
- large pasted code samples when a file pointer would do

### 3. Describe how to achieve something in this project

Operational docs should describe how to do the work in the current repository.

They should answer questions such as:

- which command should be run?
- which file should be edited?
- which test should be used?
- which workflow or script is the real entrypoint?

They should not drift into generic explanations such as why releases or tests exist in principle.

Use real repository facts:

- actual commands
- actual paths
- actual workflow files
- actual tests

### 4. Prefer pointers over pasted code

For implementation guidance, it is usually better to point to:

- a real source file
- a real test
- a real workflow

than to paste a large example that will drift.

Good:

- "See `src/index.ts` for startup orchestration."
- "See `tests/integration/plugin.test.ts` for plugin-pipeline expectations."

Bad:

- pasting large excerpts from those files into the doc

### 5. Keep boundaries strict

Each document should stay on its own topic.

- `TESTING.md` should explain how to verify changes.
- `CODING.md` should explain implementation constraints.
- `RELEASING.md` should explain current repository-specific release work.

Link to another doc only when the reader must leave the current topic to continue correctly. Do not cross-link by habit.

### 6. Adapt docs to installed skills

Before writing or updating project docs, inspect which reusable skills or workflows are installed for the repository.

If a reusable skill already covers the generic workflow, the project doc should add only:

- repo-specific commands
- repo-specific constraints
- local file paths
- local failure modes
- local acceptance rules

Do not restate a full generic workflow unless this repository truly differs.

## Hard rules for canonical docs

All canonical docs MUST follow these rules.

### Required quality

1. Every actionable rule MUST include at least one repo-local anchor:
   - command
   - file path
   - test path
   - workflow or entrypoint path
2. Sections MUST be scan-first: short heading, bullets, tables, or checklists first; rationale only when needed.
3. Cross-topic content MUST be linked rather than duplicated.
4. Skill-backed topics MUST state local deltas and local constraints; they MUST NOT restate the full generic workflow.
5. Examples SHOULD be minimal. Prefer file pointers over pasted code.
6. Consolidation guidance MUST be decision-oriented (table/checklist) and MUST include explicit evidence criteria before keep/merge/split/delete decisions.

### Hard prohibitions

Canonical docs MUST NOT include:

- self-descriptive openings (`"This file is..."`, `"This document explains..."`)
- audience declarations that only restate the filename's purpose
- design history or system history inside operational docs
- roadmap or temporal planning language (`v1`, `first rollout`, `later we plan`, `future phase`)
- generic advice without repo commands or paths (`"follow best practices"`, `"test thoroughly"`)
- large pasted code blocks when a path reference is enough
- skill-backed docs that read as standalone generic runbooks
- compatibility redirect-file instructions as a default expectation for steering docs

## Canonical scope contracts (per file)

### `README.md`

MUST:

- explain what the project is and what it is for
- provide high-level usage or entrypoint information when applicable
- link to the main deeper docs for contributors or operators

MUST NOT:

- become the full contributor setup guide
- duplicate detailed coding, testing, or release procedures

### `AGENTS.md`

MUST:

- route tasks to the right canonical docs and skills
- include short project summary, tech stack, and routing map
- include critical session-end and issue-tracking rules when the project needs them

MUST NOT:

- duplicate full coding, testing, release, or monitoring procedures
- become a long handbook

### `docs/OVERVIEW.md`

MUST:

- define project identity and core concepts
- explain high-level architecture
- provide a high-level repo map that helps an agent find the right area quickly
- include relevant external references when they are important for understanding the project

MUST NOT:

- include operational checklists that belong in other docs
- include detailed source listings or large code excerpts

### `docs/CODING.md`

MUST:

- define repository-specific implementation constraints and invariants
- provide build and typecheck commands when relevant
- map common change types to edit locations and related files or tests

MUST NOT:

- provide generic language or framework tutorials
- paste large code excerpts from source files

### `docs/TESTING.md`

MUST:

- define test levels and test-selection rules
- include exact commands and prerequisites
- map change types to minimum checks
- explain manual testing, setup resources, parallelism, or side effects when those matter in this repo

MUST NOT:

- rely on vague directives such as `run relevant tests`
- duplicate contributor onboarding workflow

### `docs/RELEASING.md`

MUST:

- document current repository-specific release constraints, files, automation, and checks
- reference the required skill or command entrypoint when a reusable baseline exists
- focus on what must be done now, not on future plans for the release system

MUST NOT:

- read as a full generic release tutorial
- include roadmap language or release-system design discussion unless the file is explicitly a design doc
- imply safe release execution without the required skill or automation path

### `docs/MONITORING.md`

MUST:

- provide the fastest evidence path for this repository
- include concrete commands, paths, dashboards, queries, or correlation keys
- explain how to access the monitoring data used by this project, including production and development variants when both matter

MUST NOT:

- include generic observability theory without repo-local action

### `docs/CHANGE-WORKFLOW.md`

MUST:

- define how changes land for both direct-to-main and branch/PR paths
- define commit/push policy, branch creation rules, review expectations, and merge behavior
- explain what an agent or contributor should do for commit, push, branch, PR, review, and merge decisions

MUST NOT:

- duplicate full test command catalogs
- include generic git training material

### `CONTRIBUTING.md`

MUST:

- define onboarding prerequisites and local setup
- define the contributor flow from first checkout to first landed change
- route to `docs/CODING.md`, `docs/TESTING.md`, and `docs/CHANGE-WORKFLOW.md` when those deeper docs exist

MUST NOT:

- duplicate deep architecture rules from `docs/CODING.md`
- duplicate full testing strategy from `docs/TESTING.md`

## Validation basics for authors

Before finalizing a canonical doc change:

1. Confirm that the commands, paths, tests, workflows, and links you wrote are real.
2. Run safe verification commands when possible.
3. For destructive or irreversible commands, validate indirectly by checking scripts, workflow files, parameter contracts, and prerequisites instead of executing them.
4. If a topic is skill-backed, confirm that the local doc really adds repository-specific value.

For full reviewer workflow, severity rules, and per-file review checklists, use [project-doc-review-guidelines.md](project-doc-review-guidelines.md).

## Maintenance requirements

When behavior changes, update matching canonical docs in the same change when feasible.

At minimum, review affected docs when changing:

- commands
- file paths
- directory structure
- coding, testing, release, monitoring, or change-workflow expectations
- installed skill coverage for the topic

If a repeated failure mode appears in writing or review, add an explicit rule here.
