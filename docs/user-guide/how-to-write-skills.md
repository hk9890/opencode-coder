# How to Write OpenCode Skills

## Purpose

This guide defines what belongs in runtime `SKILL.md` files versus authoring/maintenance docs.

Use it together with [`how-to-write-commands.md`](how-to-write-commands.md):

- command = thin entrypoint
- skill = runtime routing + decisions
- reference docs = deep durable procedure

## The Three Content Layers

| Layer | Put this here | Do **not** put this here |
|---|---|---|
| Runtime guidance (`SKILL.md`) | workflow selection, branching logic, safety constraints, argument handling, required output shape, reference routing | contributor process notes, repo history, editorial rationale, long procedures better placed in references |
| Authoring guidance (`docs/`, CONTRIBUTING-facing docs) | how contributors should structure commands/skills/docs, review heuristics, style rules, maintenance policy | runtime instructions meant for the invoked model |
| Reference-detail content (`references/*.md`) | long step-by-step workflows, edge-case handling, policy detail, larger examples | command-wrapper boilerplate or repository maintenance chatter |

## Sentence-Level Runtime-Value Test

Evaluate each sentence in `SKILL.md`:

**Keep** it in runtime skill text if it changes one of these at execution time:

1. routing (which workflow/reference is used)
2. decisions (branching conditions, ask-first behavior)
3. constraints (scope/safety limits)
4. outputs (required response/report structure)

**Move** it out of `SKILL.md` if it is mainly repository/editorial guidance (history, contributor reminders, refactor notes, style commentary) and does not change runtime behavior.

## Important Nuance: Some Meta-Sounding Text Is Valid

Text that sounds meta can still belong in `SKILL.md` when it constrains runtime behavior.

Example (valid runtime constraint from `ai-resources/skills/code-simplify/SKILL.md`):

> For `/simplify` requests, run the simplify workflow in `code-simplify/references/simplify.md`. Treat command arguments as optional focus weighting and keep scope centered on recently changed files unless the user explicitly expands it.

Why this stays in runtime text: it directly constrains routing and scope decisions during execution.

## Repo-Grounded Good/Bad Examples

### `/simplify` + `code-simplify` examples

**Good (runtime skill content):**

From `ai-resources/skills/code-simplify/SKILL.md`:

> Optional free-text focus via `$ARGUMENTS`; apply as weighting guidance, not scope expansion permission.

Why good: this controls runtime decision boundaries and scope.

**Good (reference-detail content):**

From `ai-resources/skills/code-simplify/references/simplify.md`:

> Launch three reviewer agents in parallel... merge duplicate findings... ask before broader refactors.

Why good: this is detailed workflow procedure and belongs in references, not duplicated in command wrappers.

**Bad in a skill (authoring/editorial text):**

> "This skill was heavily refactored in Q2 to reduce prompt size; see old design notes for history."

Why bad: repository history does not change runtime behavior.

**Bad in a skill (command-wrapper mechanics copied into runtime layer):**

Content like the wrapper-oriented text in `ai-resources/commands/simplify.md`:

> "Use the skill tool... Then run the simplify workflow..."

Why bad (inside `SKILL.md`): this is command-entrypoint authoring guidance, not runtime decision logic.

## Consistency Rules with Command Guidance

Keep layering consistent with [`how-to-write-commands.md`](how-to-write-commands.md):

1. Commands load skills; they do not restate full workflows.
2. Skills own workflow routing and constraints.
3. References own deep procedural detail.

If you see duplication across layers, remove it from the higher-level wrapper first (usually command), then tighten skill routing text.

## Runtime Skill Review Checklist

Use this before merging skill changes:

- [ ] Each sentence in `SKILL.md` passes the runtime-value test (routing, decisions, constraints, or outputs).
- [ ] Contributor/editorial guidance is moved to `docs/` (or CONTRIBUTING docs), not left in runtime skill text.
- [ ] Detailed step-by-step instructions live in reference docs and are linked from the skill.
- [ ] Command wrappers stay thin and only load the skill + pass arguments.
- [ ] `/simplify` routing boundaries remain explicit (`code-simplify` routes and constrains scope, reference owns detailed procedure).

## Quick Placement Heuristic

When writing a new sentence, ask:

"If I delete this sentence, does runtime behavior change?"

- **Yes** → keep in `SKILL.md`.
- **No** → move to docs/reference material.
