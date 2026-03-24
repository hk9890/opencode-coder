# How to Write OpenCode Commands

## Purpose

OpenCode command files should stay lightweight. Treat them as user entrypoints, not as full workflow documents.

Target model:

- **Command**: small wrapper the user invokes
- **Skill**: reusable workflow logic
- **Reference docs**: deep, durable detail

## Command → Skill → Reference Layering

### What goes in each layer

**Command (thin wrapper):**

- brief human-facing frontmatter `description`
- direct instruction to load the right skill
- explicit argument wiring when user input matters
- tiny command-specific constraints only

**Skill (reusable logic):**

- workflow selection and branching
- decision rules and safety constraints
- reusable execution steps
- expected output/report shape

**Reference docs (source-of-truth detail):**

- long procedures
- edge-case handling
- policy detail
- larger examples and implementation notes

### Canonical flow

1. Command loads a skill.
2. Skill chooses and runs the right workflow.
3. Skill consults reference docs as needed.

Because of this, command bodies should usually **not enumerate reference files**. Reference routing belongs in skills.

### Canonical skill-loading convention

Use a direct instruction in the command body:

```md
Load the `<skill-name>` skill.
```

Keep it plain and consistent. Do not mix multiple invocation styles in command files.

## Why Commands Are Thin

Thin commands reduce token cost, avoid duplicated logic, and keep behavior consistent across entrypoints.

Practical thresholds for command **body** length (excluding frontmatter):

- **< 30 lines**: normal thin wrapper
- **> 50 lines**: likely leaking workflow logic from skill/reference layers
- **> 100 lines**: usually a workflow document, not a command

If a command grows, move reusable logic down into skills and references.

## Frontmatter Guidance

### `description` (required)

Always include a short human-facing description for command discovery.

- Good: `description: Check project health`
- Bad: multi-paragraph workflow instructions

### Rare overrides: `agent`, `subtask`, `model`

These are **rare** and should be deliberate:

- `agent`: only for true shortcut commands that must run with a specific agent
- `subtask: true`: mainly for isolated operations (for example, commit workflows)
- `model`: only for explicit, repeated cost/quality tradeoffs

Default for most commands: set `description`, leave the other three unset.

## Body Style Rules

### Ban this opening pattern

Do **not** start command bodies with “Use `/foo` when…”. The user already invoked the command; this wastes tokens.

Bad:

```md
Use `/review` when you want a code review.
```

Good:

```md
Load the `code-review` skill.
Run the standard review workflow.
```

### H1 headings are usually unnecessary

Skip `# Heading` in command bodies by default. The agent already knows which command ran, so headings are usually token overhead.

### Write for the invoked agent

Prefer short, actionable instructions over explanatory prose.

## Argument Wiring

If user input matters, wire it explicitly (`$ARGUMENTS`, or positional placeholders like `$1`, `$2`).

Concrete example:

```md
---
description: Review a target
---

Load the `code-review` skill.

Treat the following as the review target:

$ARGUMENTS

Follow the standard review workflow and return findings.
```

If the command does not need user input, omit argument placeholders.

## Recommended Baseline Shape

```md
---
description: Brief human-facing summary
# agent: specialized-agent-id
# subtask: true
# model: openai/gpt-4.1-mini
---

Load the `<skill-name>` skill.

Treat this as task context:

$ARGUMENTS

Follow the `<workflow-name>` workflow and return a concise report.
```

`agent`, `subtask`, and `model` are shown as commented rare overrides, not defaults.

## Note on Existing Commands

Some existing command files may predate this guidance and still be under refactor. Use this document as the target shape for new commands and incremental cleanup of older ones.
