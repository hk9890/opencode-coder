# Project Doc Review Guidelines

> **Synced copy notice**
>
> This file is the repo-local synced copy of:
> `ai-resources/skills/opencode-coder/references/project-doc-review-guidelines.md`
>
> Canonical source: published skill reference file above.
> Update the canonical file first, then mirror changes here in the same change.

Reviewer-only companion for evaluating canonical project docs.

Use it together with these companion references:

- [project-setup.md](project-setup.md) explains which canonical docs should exist, what each one owns, and when an agent should load them.
- [project-doc-guidelines.md](project-doc-guidelines.md) defines the authoring rules the reviewed doc must satisfy.

This file is for review passes, not first-draft authoring. A reviewer should validate both writing quality and repository truth.

## Review goals

A project-doc review should confirm that the doc:

- belongs in the right file
- is scoped to the right topic
- is useful for the current repository rather than generic
- matches installed skill coverage
- is factually correct against the repository state
- is concise enough for selective loading

## Required review workflow

1. Load the target doc.
2. Load `project-setup.md` to confirm the file role and task-loading expectations.
3. Load `project-doc-guidelines.md` to apply the authoring rules.
4. Inspect installed skills and reusable workflows that affect the topic.
5. Inspect relevant repository sources before judging the doc:
   - commands and scripts
   - workflow files
   - source locations
   - tests
   - dashboards, logs, or observability entrypoints when relevant
6. Validate the document against the safety tiers below.
7. Return concrete findings with severity, evidence, and a specific fix.

Do not review markdown in isolation when repository facts can be checked directly.

## Reviewer output format

Use this format for each finding:

`[SEVERITY] <file>:<section> — <rule-id> — <violation> — <evidence> — <suggested fix>`

Severity:

- `BLOCKER`: violates a MUST or MUST NOT rule, or relies on unsafe or unverified operational claims
- `MAJOR`: wrong scope, missing important repo-local anchors, or materially incomplete guidance
- `MINOR`: clarity, scanability, or wording issue that does not change correctness

Rule IDs:

- `R1` repo-local anchor required
- `R2` scan-first structure
- `R3` topic boundary respected
- `R4` skill-aware local delta only
- `R5` current-project actionability
- `P1` no self-descriptive opening or audience restatement
- `P2` no design history in operational docs
- `P3` no roadmap or temporal planning language
- `P4` no generic advice without commands or paths
- `P5` no large pasted code blocks when a pointer is enough
- `P6` no standalone generic workflow in a skill-backed doc
- `V1` correct validation tier used
- `V2` repository reality checked

## Validation safety tiers

### Tier A — Safe commands (default)

Run freely during review:

- read-only inspection such as `git status`, `git diff`, path listing, and file reads
- deterministic checks with no side effects such as unit or integration tests
- link, path, and file-existence checks

Use Tier A whenever it can prove the documented claim directly.

### Tier B — Expensive but safe commands

Run when the reviewed doc depends on them:

- full test suites
- e2e or harness runs
- heavier diagnostics or environment validation

Use Tier B when a doc claim cannot be trusted without the higher-cost check.

### Tier C — Destructive or irreversible commands

Do not execute during normal document review.

Examples:

- publish or release operations
- irreversible repository state changes
- writes to external systems that are not safely reversible

For Tier C, verify indirectly by checking:

- workflow files and scripts
- command presence and parameter contracts
- documented preconditions
- rollback or safety notes when those are required

## Review checklist by file type

Use the questions below as a focused checklist. Not every question applies to every repository, but the reviewer should consider the relevant ones before passing the doc.

### `README.md`

Questions for the reviewer:

- Is it clear what the project does and who it is for?
- Is the high-level usage or entrypoint information clear?
- Does it point readers to the right deeper docs instead of trying to be the whole handbook?
- Is contributor setup kept out of `README.md` unless it is truly part of the front-door experience?

### `AGENTS.md`

Questions for the reviewer:

- Does it route clearly to the right docs and skills for the main task types?
- Is it small enough to be safe as default context?
- Does it avoid duplicating full procedures from topic docs?
- Are the listed paths, skills, and routing targets real?

### `docs/OVERVIEW.md`

Questions for the reviewer:

- Does it explain the project, domain language, and high-level architecture clearly?
- Does it help an agent find the right area of the repo quickly?
- Are any linked external references genuinely useful for understanding the project?
- Does it avoid drifting into implementation checklists or release/PR policy?

### `docs/CODING.md`

Questions for the reviewer:

- Is it clear where common changes should be made in this repository?
- Are the build, typecheck, and development commands accurate?
- Does it capture repository-specific invariants and implementation constraints?
- Does it avoid generic language or framework tutorial content?

### `docs/TESTING.md`

Questions for the reviewer:

- Is it clear how to trigger the different tests?
- Is it clear when the agent should run which tests?
- Are the different test types in the project described properly?
- Is it clear how to do manual testing when manual checks are required?
- Is it clear how to set up resources or dependencies for tests?
- Is it clear whether tests can run in parallel and whether they produce side effects?
- Do the documented test commands and paths actually exist?

### `docs/RELEASING.md`

Questions for the reviewer:

- Does it describe the current repository-specific release work rather than release-system philosophy?
- Is the required skill, command, or workflow entrypoint clear?
- Are irreversible steps and safety checks explicit?
- Does it avoid roadmap language, design discussion, and generic release tutorials?
- Do the documented workflow files, commands, and artifact paths actually exist?

### `docs/MONITORING.md`

Questions for the reviewer:

- Is it clear where the agent should get monitoring evidence for this project?
- Are the relevant logs, dashboards, queries, traces, or correlation keys documented?
- Is it clear how to access production and development monitoring data when both matter?
- Does it explain how investigation should proceed in this repository rather than giving generic observability advice?

### `docs/PULL-REQUESTS.md`

Questions for the reviewer:

- Are branch naming and PR creation rules clear?
- Are review expectations and merge rules explicit?
- Does it explain what an agent should do when opening or updating a PR?
- Does it avoid generic git training or duplicated test catalogs?

### `CONTRIBUTING.md`

Questions for the reviewer:

- Is the local development setup flow clear and complete?
- Are prerequisites, credentials, local services, and environment assumptions explicit?
- Is the path from first checkout to first contribution clear?
- Does it route deeper coding, testing, and PR details to the right files instead of duplicating them?

## Final pass before approval

Before passing a reviewed doc:

1. Confirm the file is the right home for the guidance.
2. Confirm installed skills were considered and the local doc is not duplicating a reusable baseline.
3. Confirm the repo-local commands, paths, workflows, and tests are real.
4. Confirm the doc tells the reader how to do the work in this repository.
5. Confirm no `BLOCKER` findings remain.
