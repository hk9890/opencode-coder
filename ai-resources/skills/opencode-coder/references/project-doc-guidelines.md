# Project Doc Guidelines

This guide explains how to write project documents that help both humans and coding agents.

Use it together with [project-setup.md](project-setup.md):

- `project-setup.md` explains **which files should exist** and how they relate to each other.
- this guide explains **what each file should contain** and how to write it well.

## Core Writing Rules

### 1. Write for action, not narration

Project docs should help someone decide what to do next.

Prefer:

- commands
- file paths
- checklists
- decision tables
- short rationale for non-obvious rules

Avoid long prose that explains the same point three different ways.

### 2. Optimize for token efficiency

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
- large pasted code samples when a file link would do

### 3. Be specific and local

Every important instruction should answer at least one of these:

- which command should be run?
- which file should be edited?
- which test should be used?
- which workflow file or reference shows the real pattern?

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

- pasting 80 lines from those files into the doc

### 5. Keep boundaries strict

Each document should own one topic.

- `AGENTS.md` routes
- `OVERVIEW.md` explains the project
- `CODING.md` explains safe implementation patterns
- `TESTING.md` explains how to verify changes
- `RELEASING.md` explains repo-specific release rules

When a rule belongs in another file, link to that file instead of duplicating it.

### 6. Document local rules, not reusable baseline workflow

If a reusable skill already covers the generic workflow, the project doc should add only:

- repo-specific commands
- repo-specific constraints
- local file paths
- local failure modes
- local acceptance rules

Do not restate a whole generic workflow unless this repo truly differs.

### 7. Make scanning easy

Use markdown that is easy to skim:

- clear headings
- bullet lists
- short tables
- fenced commands
- concise callouts

Avoid dense walls of text.

### 8. Mark non-canonical docs clearly

Not every markdown file should be treated as operating guidance.

Make the distinction clear between:

- canonical operating docs
- secondary reference docs
- brainstorming notes
- design history
- test evidence or reports

Agents should not have to guess which files are policy and which are archive.

## Markdown Style That Helps Agents

### Prefer these shapes

#### Good section shape

```md
## Startup change checklist

- Edit `src/index.ts` for startup orchestration changes.
- Update related service behavior under `src/service/`.
- Run `bun run typecheck`.
- Run `bun test tests/integration/plugin.test.ts`.
```

#### Good reference shape

```md
See `tests/unit/service/aimgr-service.test.ts` for service-level test patterns.
```

#### Good decision table shape

```md
| Change type | Minimum checks |
|---|---|
| Service logic | unit tests + typecheck |
| Plugin startup | integration tests + typecheck |
```
```

### Avoid these shapes

- long essays before the actionable rule appears
- repeated background in every section
- giant copied code blocks from the repo
- vague statements like "test thoroughly" without commands
- vague statements like "follow best practices"

## Doc Taxonomy

Use a clear separation like this:

| Category | Purpose | Typical examples |
|---|---|---|
| Canonical operating docs | Default guidance for working in the repo | `AGENTS.md`, `docs/OVERVIEW.md`, `docs/CODING.md`, `docs/TESTING.md`, `docs/RELEASING.md`, `docs/MONITORING.md`, `docs/PULL-REQUESTS.md`, `CONTRIBUTING.md`, `README.md` |
| Secondary reference docs | Helpful deeper guidance, not always default context | targeted design notes, command-writing guides, user guides |
| Notes / artifacts | Useful evidence or thinking history, not default instructions | brainstorming docs, smoke-test reports, archived design exploration |

If a file is not canonical operating guidance, say so explicitly.

## File-by-File Guidance

### `README.md`

**Purpose**: first stop for users deciding what this project is and how to start using it.

Include:

- what the project does
- who it is for
- install / enablement steps
- the shortest useful documentation map
- high-level feature summary

Avoid:

- deep contributor workflow details
- internal architecture walkthroughs
- long release/debugging instructions
- exhaustive internal catalogs unless they truly help first-time users

Good supporting links:

- `docs/OVERVIEW.md`
- `CONTRIBUTING.md`
- user-guide docs when present

### `AGENTS.md`

**Purpose**: routing layer for agents.

Include:

- one-sentence project summary
- tech stack
- links to canonical docs by task
- critical session-end rules
- issue-tracking rules if relevant
- optional note that brainstorming, archive, or evidence docs are not default task guidance

Avoid:

- handbook-style detail
- full testing or release procedures
- duplicated content from topic docs
- long reference catalogs that belong elsewhere

Good shape:

- short
- easy to scan
- mostly pointers

### `docs/OVERVIEW.md`

**Purpose**: explain what the project is and how it is organized.

Include:

- project identity and intended users
- key concepts and domain language
- high-level architecture
- repository map
- "where to go next" links
- optional "common change areas" section when the repo has distinct subsystems

Avoid:

- detailed coding rules
- detailed test commands
- release checklists
- exhaustive API or class inventories

### `CONTRIBUTING.md`

**Purpose**: onboard contributors quickly.

Include:

- prerequisites
- local setup
- baseline commands to run before opening a PR
- contributor workflow from issue to PR
- links to `docs/CODING.md`, `docs/TESTING.md`, and `docs/PULL-REQUESTS.md`
- common contribution paths if the repo has very different kinds of work

Avoid:

- deep architecture details already covered in `docs/CODING.md`
- long restatements of testing strategy
- user-facing installation details better suited for `README.md`

### `docs/CODING.md`

**Purpose**: help contributors make safe code changes in this repo.

Include:

- build and typecheck commands
- architecture boundaries and invariants
- repository structure with why it is split that way
- change guidance: where to edit for common change types
- files that usually change together
- links to real source files and tests that demonstrate patterns
- repo-specific coding conventions and gotchas

Prefer this kind of guidance:

- "Edit `src/index.ts` for startup orchestration changes."
- "See `tests/integration/plugin.test.ts` for plugin registration and gating expectations."
- "See `tests/unit/service/*.test.ts` for service-level test patterns."
- "See `docs/design/how-to-write-commands.md` for command-authoring conventions."

Avoid:

- large copied code samples
- long class inventories without explaining how to change them safely
- generic TypeScript advice that is not local to the repo

### `docs/TESTING.md`

**Purpose**: help contributors choose the right level of verification and run it correctly.

Include:

- test levels and when to use each one
- exact commands
- prerequisites and environment limits
- change-type-to-test matrix
- where artifacts and failure evidence appear
- debugging tips for common failures
- links to representative tests and harnesses

Good supporting references in this repo can include:

- `tests/integration/plugin.test.ts`
- `tests/integration/manual-launcher.test.ts`
- `tests/unit/docs-lifecycle-contract.test.ts`
- `tests/unit/service/*.test.ts`

Avoid:

- vague guidance like "run relevant tests"
- repeating contributor workflow already in `CONTRIBUTING.md`
- abstract testing philosophy without commands

### `docs/RELEASING.md`

**Purpose**: repo-specific release companion to the generic release workflow.

Include:

- exact pre-release checks for this repo
- workflow file or automation entrypoint used here
- version files and changelog rules
- publishing target and auth quirks
- accepted gaps or manual follow-ups
- rollback / hotfix rules that are specific to this repo

Good supporting references in this repo can include:

- `.github/workflows/release.yml`
- `package.json`
- `CHANGELOG.md`

Avoid:

- long generic explanations of release theory
- generic SemVer tutorial content beyond what is needed locally
- repeating the whole release skill inside the project doc

### `docs/MONITORING.md`

**Purpose**: help contributors debug incidents with the fastest evidence path.

Include:

- evidence sources in priority order
- fast triage checklist
- exact commands for logs and diagnostics
- artifact locations
- correlation keys such as timestamps, session IDs, or process IDs
- privacy or redaction reminders when evidence may be shared

Avoid:

- generic observability theory
- tool explanations without concrete repo paths or commands

### `docs/PULL-REQUESTS.md`

**Purpose**: define collaboration rules for branches, PRs, review, and merge.

Include:

- branch naming rules
- PR title / description expectations
- size guidance
- testing expectations before review
- review checklist and reviewer priorities
- merge strategy

Avoid:

- generic git tutorials
- duplicated test commands already listed in `docs/TESTING.md`
- duplicated contributor setup already in `CONTRIBUTING.md`

### Choosing whether to create `docs/RELEASING.md`, `docs/MONITORING.md`, or `docs/PULL-REQUESTS.md`

Create one of these docs only when the project has real local guidance.

If the topic is fully handled by a reusable skill and the repo adds nothing local, let `AGENTS.md` route to the skill instead.

## Maintenance Rules

When project behavior changes, update the matching doc in the same change whenever possible.

At minimum, review docs when you change:

- commands
- file paths
- directory structure
- build/test/release workflow
- startup behavior
- monitoring or diagnostics flow
- PR or merge policy

If a recurring mistake appears, add the fix to the document that should have prevented it.
