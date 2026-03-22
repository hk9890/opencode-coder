# Project Setup

> **Canonical-source rule (testable)**
>
> - This file (`ai-resources/skills/opencode-coder/references/project-setup.md`) is the canonical source for project-setup guidance in the published skill.
> - `docs/user-guide/project-setup.md` is a synced repo-local copy for this repository's own docs.
> - Any content change to the shared guidance must be made here first, then mirrored to the repo-local copy in the same change.

This guide describes a simple, tool-agnostic documentation structure for projects that want clear routing and controlled context for humans and coding agents.

## Core idea

Use a small `AGENTS.md` at the repository root and put detailed guidance in focused files under `docs/`.

- `AGENTS.md` provides the minimum shared routing context
- `docs/OVERVIEW.md` explains what the project is
- `docs/` contains the real operating guidance
- each document owns one topic
- agents should load only the documents needed for the current task
- standard file names make the structure predictable
- create topic docs only when they contain real project-specific guidance

## Recommended structure

```text
AGENTS.md
CONTRIBUTING.md
docs/
  OVERVIEW.md
  CODING.md
  TESTING.md
  RELEASING.md
  MONITORING.md
  PULL-REQUESTS.md
```

These are the standard file names to use **when the project actually needs those topics documented**.
They are not mandatory.

If a topic is already fully covered by a reusable skill or workflow and the project has no extra local rules for it, do not create a duplicate project doc for that topic.
In that case, `AGENTS.md` can simply route the reader to the relevant skill or workflow.

Projects can also add extra focused docs when they have real, repository-specific guidance that does not fit the standard set.

Only create the files that have real content. A minimal but strong setup is often:

```text
AGENTS.md
docs/
  OVERVIEW.md
  CODING.md
  TESTING.md
```

## Standard file names

### `AGENTS.md`

The routing document. It should stay short and mostly link to the deeper docs.

**Recommended size:** no more than 100-200 lines.

Why this matters: agents often read `AGENTS.md` by default. Anything placed here becomes broad shared context, even for tasks that do not need it.

Include:

- a short summary of the project
- the tech stack
- a link to `docs/OVERVIEW.md`
- links to the relevant docs in `docs/`
- any critical session-end or workflow rules

Do not duplicate large amounts of content from the topic-specific docs. Put only the minimum routing information here, then send readers to the right specialized document.

### `docs/OVERVIEW.md`

The project overview.

Typical content:

- the main concepts and domain language
- high-level architecture
- links to deeper docs

### `docs/CODING.md`

The main engineering guide, if the project has local coding guidance to record.

Typical content:

- build commands
- repository structure
- architecture notes
- coding conventions
- important implementation patterns

### `docs/TESTING.md`

The testing guide, if the project has local testing guidance to record.

Typical content:

- test commands
- test levels and when to run them
- local setup requirements
- fixtures, helpers, and debugging tips

### `docs/RELEASING.md`

The release guide, if the project has local release guidance to record.

Typical content:

- versioning rules
- release commands
- validation steps
- publish checklist

### `docs/MONITORING.md`

The observability and operations guide, if the project has local monitoring or triage guidance to record.

Typical content:

- log and metric locations
- dashboards or tools
- incident inspection workflow
- triage guidance

### `docs/PULL-REQUESTS.md`

The collaboration guide, if the project has local collaboration rules to record.

Typical content:

- branch strategy
- PR expectations
- review checklist
- merge rules

### `CONTRIBUTING.md`

The contributor onboarding guide.

Typical content:

- how to set up the project locally
- how to propose changes
- contribution workflow
- links to `docs/CODING.md` and `docs/TESTING.md`

### Optional focused docs beyond the standard names

You can add extra docs under `docs/` when they contain real project-specific guidance that does not fit the standard set.

Example use cases:

- repository-specific deployment or operations notes that do not fit the standard files
- project-specific workflows that need a durable home outside `AGENTS.md`
- domain-specific concepts or support procedures that deserve their own focused document

But the rule stays the same: only create the file if it contains project-specific guidance.
If a reusable skill or workflow already covers the topic and the project has no extra local rules, let `AGENTS.md` route to that skill instead of creating a duplicate doc.

## How the routing works

Think of `AGENTS.md` as the entry page.

Its job is to route the current task to the right documents, not to preload every rule in the repository.

It should answer:

- what this project is
- where to find the fuller project overview
- which document covers coding
- which document covers testing
- which document covers releases, monitoring, and PR workflow

Example routing pattern:

- `AGENTS.md` → `docs/OVERVIEW.md` for project context and domain understanding
- `AGENTS.md` → `docs/CODING.md` for code conventions and build commands
- `AGENTS.md` → `docs/TESTING.md` for test execution and test strategy
- `AGENTS.md` → `docs/PULL-REQUESTS.md` for branch and review rules

This keeps the top-level guide small while the detailed docs stay focused, so each session can load the right context instead of all context.

## Why split the docs this way

Agents often read `AGENTS.md` first. That means anything placed there tends to become default context for many sessions and sub-agents.

So `AGENTS.md` should stay small and act as a router, not a handbook.

The deeper documents exist so each agent can load only the context it actually needs and avoid carrying unrelated instructions into the task.

## Project docs as project memory

The files under `docs/` are the project's memory files.

They should capture the repository-specific rules, commands, assumptions, and conventions that an agent or maintainer needs to remember later.

That means they should usually:

- record local commands and paths that actually exist in the repo
- capture project-specific decisions and conventions
- be updated when the project changes
- avoid restating generic workflow instructions that already live in reusable skills

If someone discovers a recurring issue in coding, testing, releasing, monitoring, or collaboration, update the matching project doc so the local rule is preserved in the right place.

### Example workflow

Imagine you are building a new feature.

#### 1. Design conversation

You start a session to explore the feature and discuss the design.

That agent likely needs:

- `AGENTS.md`
- `docs/OVERVIEW.md`
- relevant code it wants to inspect

That agent usually does **not** need `docs/CODING.md` yet, because it is still understanding the problem and shaping the design rather than writing code. Loading coding rules too early adds context that is not useful for the current job.

#### 2. Implementation session

Next, you create a design note or task document that describes exactly what should be built.

Now you start a new implementation session.

That agent likely needs:

- `AGENTS.md`
- the feature design or task document
- `docs/CODING.md`

This time the agent does need the coding guide, because it is making code changes and must follow the project's implementation conventions. It may not need to reread the full project overview if the task document already provides enough context.

#### 3. Testing or verification session

After implementation, you might use a dedicated testing or verification agent.

That agent likely needs:

- `AGENTS.md`
- the feature design or task document
- `docs/TESTING.md`

That agent may not need `docs/CODING.md` if its job is to run, inspect, and verify tests rather than author new production code. Again, the goal is to load the right context for the job, not every available document.

## What this achieves

- `AGENTS.md` stays a small routing layer instead of becoming oversized default context
- each session loads only the documents relevant to its task
- design work, implementation work, and testing work can use different context
- project knowledge is easier to maintain because each file has a clear purpose

## How this works with skills

This document structure works well together with reusable skills.

You should still use reusable skills for broad workflows such as:

- releases
- pull requests
- testing
- coding patterns
- observability or incident triage

The project documents should then contain the **project-specific** instructions for those areas.

Think of the relationship like this:

- the skill provides the reusable baseline workflow
- the project docs provide the repository-specific memory and local rules
- the project docs should fine-tune or extend the skill, not restate it

For example:

- a release skill provides the general release workflow
- `docs/RELEASING.md` provides the repository-specific release details when the project has any

Likewise:

- a pull-request skill can provide general PR workflow guidance
- `docs/PULL-REQUESTS.md` should describe the project's own branch rules, review expectations, and merge requirements when the project has any

And the same pattern applies elsewhere:

- generic coding guidance can live in a skill
- project-specific coding conventions belong in `docs/CODING.md` when the project has any

## Skills and project docs must agree

When an agent uses a skill and a project document for the same task, it will follow both.

For example, if a release skill is used, the agent may:

- load the release skill
- read `docs/RELEASING.md`

That means the two instruction sources should not contradict each other.

The project owner should understand what a skill does, then add only the project-specific material that belongs in the matching document.

So `docs/RELEASING.md` should usually answer questions like:

- which branch is released
- which commands this repository uses
- which checks must pass here
- where artifacts are published from

It should not try to redefine the entire generic release workflow if the skill already covers that.

The same idea applies to other topics:

- generic PR behavior in a skill, project-specific PR rules in `docs/PULL-REQUESTS.md`
- generic coding guidance in a skill, project-specific conventions in `docs/CODING.md`
- generic testing workflow in a skill, project-specific test commands and environments in `docs/TESTING.md`

The same principle applies to all docs, not just optional ones. If a topic is already fully covered by a reusable skill and the project has no extra local rules for it, you do not need a project doc for that topic at all. Let `AGENTS.md` route to the skill instead.

## Priority of instructions

Good skills should explicitly state that project-specific instructions take precedence over the generic guidance in the skill.

That lets skills stay reusable across many repositories while still respecting local project rules.

In practice, the model should be:

- the skill provides the reusable baseline
- the project document provides the local rules
- the local project rules win when there is tension

Because of that, project docs and skills should be maintained together. If a corresponding skill changes in a way that affects local usage, the matching project doc should be reviewed and updated so they stay aligned.

## Suggested bootstrap order

1. Create `AGENTS.md`
2. Create `docs/OVERVIEW.md`
3. Create `docs/CODING.md`
4. Add `docs/TESTING.md` once testing workflow exists
5. Add the other standard docs only when the project has real guidance for them
6. Keep cross-links between these files up to date

## Best practices for writing these documents

### 1. Keep each doc narrowly scoped

One file should own one topic. Avoid mixing testing, coding, release, and PR rules in the same document.

This makes it easier to load only the document needed for a specific task.

### 2. Prefer instructions over prose

Write for action:

- good: `bun test tests/unit`
- weaker: `unit tests can generally be run in several ways depending on context`

### 3. Put commands near the rule they support

If a document says “run tests before opening a PR,” include the exact commands right there.

### 4. Optimize for scanning

Use short sections, bullets, and small examples. Avoid long uninterrupted paragraphs.

This also helps agents pull the relevant instruction from a document without dragging in unnecessary surrounding detail.

As a practical rule, keep topic docs such as `CODING.md`, `TESTING.md`, `RELEASING.md`, and similar files under **500 lines**. If a doc grows beyond that, split it into more focused documents.

### 5. Avoid duplication

If guidance belongs in `docs/TESTING.md`, link to it from `AGENTS.md` instead of repeating it.

Duplication increases the chance that too much context is loaded and that conflicting instructions appear in multiple places.

### 6. Record assumptions explicitly

If a command requires Docker, Bun, Node, a local service, or credentials, say so clearly.

### 7. Include the “why” for non-obvious rules

Short rationale helps future maintainers and agents follow conventions correctly.

### 8. Keep examples realistic

Use commands, paths, and workflows that actually exist in the repository.

### 9. Update docs with code changes

Documentation should change when workflows, commands, directory structure, or release process changes.

This also includes skill changes: if a skill evolves and the project keeps local instructions for the same area, update the project doc so the local guidance still complements the skill instead of drifting or duplicating it.

### 10. Keep `AGENTS.md` especially disciplined

If `AGENTS.md` starts growing into a handbook, move the details into `docs/` and leave a pointer behind.

Treat `AGENTS.md` as the minimal routing layer that every agent sees, not the place to store all project knowledge.
