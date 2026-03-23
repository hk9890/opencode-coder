Here is the full structured plan using the skill's conventions.

---

## Docs-Lifecycle Improvement — Beads Plan

### 1. Create the Epic

```bash
cat << 'EOF' | bd create --title="Docs Lifecycle Improvement" --type=epic --priority=2 --body-file -
## Description
Audit, repair, and improve project documentation across its full lifecycle:
create, update, audit/repair, slim/split, and incident-driven improve.

## Goals
- All project docs are accurate, current, and correctly scoped
- No orphaned, stale, or duplicated doc files
- Lifecycle workflows are tested and repeatable

## Success Criteria
- [ ] All child tasks closed
- [ ] Acceptance review task passed
- [ ] No docs flagged during /opencode-coder/doctor run
EOF
```

---

### 2. Create Execution Tasks

Run these in parallel (independent of each other):

```bash
# Task 1 — Audit existing docs
cat << 'EOF' | bd create --title="Audit all project docs for staleness and scope drift" --type=task --priority=2 --body-file -
## Description
Walk every doc in the project and flag files that are stale, out-of-scope,
orphaned, or duplicated. This is the discovery pass before repair begins.

## Instructions
1. Run `bd doctor` and capture output
2. List every markdown file under docs/ and ai-resources/
3. For each file, record: path, last-modified date, and status
   (current | stale | orphaned | duplicate | too-large)
4. Write findings to a scratch note (bd remember or inline notes)

## Acceptance Criteria
- [ ] Every doc file reviewed and tagged with a status
- [ ] List of files needing repair is documented in task notes
- [ ] bd doctor shows no sync errors
- [ ] No new files created — audit only
EOF

# Task 2 — Repair stale or incorrect docs
cat << 'EOF' | bd create --title="Repair stale and incorrect project docs" --type=task --priority=2 --body-file -
## Description
Apply fixes found in the audit task. Update content that is wrong or outdated.
Do not restructure or split files in this task (see slim/split task).

## Instructions
1. Retrieve findings from the audit task notes
2. For each stale/incorrect file:
   a. Read the current file
   b. Identify specific wrong sections
   c. Rewrite only the incorrect sections with accurate content
3. Commit after each file to keep diffs small

## Files to Modify
- Determined by audit findings (update this task's notes after audit closes)

## Acceptance Criteria
- [ ] No doc contains factually incorrect information
- [ ] All changes committed
- [ ] Tests pass (if any doc references test commands, verify they still work)
EOF

# Task 3 — Slim or split oversized docs
cat << 'EOF' | bd create --title="Slim or split oversized and over-scoped doc files" --type=task --priority=3 --body-file -
## Description
Files flagged as too-large or containing mixed scope should be split or trimmed.
Each resulting file must have a single clear responsibility.

## Instructions
1. Retrieve "too-large" and "scope-mixed" flags from audit notes
2. For each candidate:
   a. Read the file in full
   b. Identify natural split boundaries
   c. Split into new focused files OR trim non-essential content
   d. Update any cross-references / links to the old file
3. Delete original only after all references are updated

## Acceptance Criteria
- [ ] No doc file exceeds the project's line limit (check SKILL.md / project rules)
- [ ] Each remaining file covers exactly one topic
- [ ] No broken internal links
- [ ] All changes committed
EOF
```

---

### 3. Create the Acceptance Review Task

```bash
cat << 'EOF' | bd create --title="Acceptance Review: Docs Lifecycle Improvement" --type=task --priority=1 --body-file -
## Description
Gate check before the epic is closed. Verify that the docs lifecycle improvement
achieved its stated goals with no regressions.

## Instructions
1. Run `bd list --parent <epic-id>` — confirm all tasks are closed
2. Run `/opencode-coder/doctor` — confirm clean output
3. Spot-check 3–5 repaired docs against the audit notes to confirm accuracy
4. Confirm no orphaned files remain
5. If issues found: create new bug/task issues (do NOT reopen closed tasks)

## Acceptance Criteria
- [ ] All implementation tasks closed
- [ ] bd doctor reports no errors
- [ ] Spot-check passes (0 factual errors in sampled docs)
- [ ] No orphaned doc files
- [ ] If clean: close this task and then close the epic
EOF
```

Then link the acceptance review task as a blocker on the epic:

```bash
bd dep add <epic-id> <acceptance-review-task-id>
```

---

### 4. Set Task Dependencies

Repair and slim/split depend on the audit finishing first:

```bash
bd dep add <repair-task-id>    <audit-task-id>
bd dep add <slim-task-id>      <audit-task-id>
bd dep add <acceptance-review-task-id> <repair-task-id>
bd dep add <acceptance-review-task-id> <slim-task-id>
```

---

### 5. Tasks That Need Discussion First

If any task cannot be fully scoped yet — for example, the approach to splitting docs hasn't been decided — use this pattern at creation time:

```bash
cat << 'EOF' | bd create --title="Decide split strategy for AGENTS.md vs CLAUDE.md" --type=task --priority=2 --labels=needs:discussion --body-file -
## Description
There is overlap between AGENTS.md and CLAUDE.md content. A decision is needed
before the slim/split task can cover these files.

## Open Questions
- [ ] Should AGENTS.md and CLAUDE.md remain separate files or be merged?
- [ ] What is the canonical home for agent-routing rules?
- [ ] Who owns the final structure decision?

## Why This Needs Discussion
A tasker who attempts this without a decision will guess and produce a
result that may be immediately reverted. Block it until resolved.

## Instructions
(blocked until open questions above are answered)
EOF

# Immediately block it — keeps it out of bd ready
bd update <id> --status=blocked
```

**How to unblock it when discussion resolves:**

```bash
bd update <id> --status=open --remove-label needs:discussion
# Then add the resolved decision as notes:
bd update <id> --notes="Decision: keep files separate; AGENTS.md owns routing only."
```

---

## Summary of the Pattern

| Situation | Label | Status | Appears in `bd ready`? |
|---|---|---|---|
| Ready to execute | _(none)_ | `open` | Yes |
| Minor open question, mostly ready | `has:open-questions` | `blocked` | No |
| Needs design/scoping discussion first | `needs:discussion` | `blocked` | No |
| Acceptance review gate | _(none, task type)_ | `open` after deps close | Yes |

The key rule from the skill: **if a tasker would have to guess, block it.** It is always cheaper to block-for-discussion than to redo work after an agent guesses wrong.
