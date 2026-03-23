# Validation Transcript

## Mode

without_skill

## Eval Prompt

I want a structured beads plan for a docs-lifecycle improvement project. Break it into an epic, execution tasks, and an acceptance review task, and tell me how to handle any tasks that still need discussion before a tasker should touch them.

## Tool Calls

1. **Glob** `{"pattern": "docs/**/*"}`
2. **Glob** `{"pattern": "ai-resources/commands/opencode-coder/*.md"}`
3. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/commands/opencode-coder/docs.md"}`
4. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/commands/opencode-coder/improve-doc.md"}`
5. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/docs/OVERVIEW.md"}`
6. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/docs/TESTING.md"}`
7. **Glob** `{"pattern": "ai-resources/skills/opencode-coder*/**/*.md"}`
8. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/project-docs-lifecycle.md"}`

## Final Response

Let me review the current docs landscape first.

Here is the structured plan. I'll describe the full shape, then explain the "needs-discussion" handling pattern at the end.

---

## Docs-Lifecycle Improvement — Beads Plan

### Structure

```
Epic
 └── Task: Audit current state
 └── Task: Refresh command dispatchers
 └── Task: Refresh skill reference (project-docs-lifecycle.md)
 └── Task: Refresh and validate project docs (docs/)
 └── Task: AGENTS routing pass
 └── Task: [BLOCKED] Decide scope of slim/split for oversized docs   ← needs discussion
 └── Task: [BLOCKED] Decide if improve-doc should grow a dry-run mode ← needs discussion
 └── Task: Acceptance review (manual launcher + deterministic gates)
```

The acceptance review task **depends on all execution tasks** except the two blocked ones — those are decoupled until the discussion resolves.

---

### Epic

- **Title**: `Docs lifecycle: full audit and refresh pass`
- **Type**: `feature`
- **Description**: Bring commands, skill references, and project docs into consistent alignment. Cover inspect → refresh → audit → AGENTS → verify lifecycle phases. Acceptance is human-judged via manual launcher.
- **Priority**: `2` (medium)

---

### Execution Tasks (7 phases mapped to issues)

| # | Title | Type | Notes |
|---|---|---|---|
| 1 | `Docs lifecycle: audit current state and classify topics` | `task` | Phase 1 (Inspect). Output is a findings comment, not code. |
| 2 | `Docs lifecycle: refresh command dispatchers (docs.md, improve-doc.md, init.md)` | `task` | Phase 3/4. Depends on audit findings. |
| 3 | `Docs lifecycle: refresh project-docs-lifecycle.md skill reference` | `task` | Phase 3/4. Canonical source of truth — touch carefully. |
| 4 | `Docs lifecycle: refresh project docs (TESTING.md, CODING.md, etc.)` | `task` | Phase 3. Use audit output to scope edits. |
| 5 | `Docs lifecycle: AGENTS routing pass` | `task` | Phase 6. Depends on docs refresh being done. |
| 6 | `Docs lifecycle: cross-reference and link verification` | `task` | Phase 7 prep. Can run after docs+AGENTS settle. |

Dependencies:
```
2 → depends on → 1
3 → depends on → 1
4 → depends on → 1
5 → depends on → 4
6 → depends on → 5
```

---

### Needs-Discussion Tasks

Create these as normal issues but **block them on a dedicated discussion issue**. The tasker sees the blocker and knows not to start.

**Pattern:**
```bash
# Create the discussion issue first
bd create --title="Discuss: scope of slim/split for oversized project docs" \
  --description="Before a tasker touches docs size, we need to agree on size thresholds, which files qualify, and whether to split or just trim." \
  --type=task --priority=3

# Then create the blocked execution task
bd create --title="Docs lifecycle: slim oversized project docs" \
  --description="Phase 5 (slim/split). Execute once thresholds and target files are agreed in the discussion issue." \
  --type=task --priority=3

# Wire the dependency
bd dep add <slim-task-id> <discussion-id>
```

The same pattern applies to any other discussion-gated task. The `bd blocked` command will surface these clearly so no tasker picks them up by accident.

---

### Acceptance Review Task

Create this last, with dependencies on all execution tasks (not the blocked ones):

```bash
bd create --title="Docs lifecycle: acceptance review" \
  --description="Human acceptance gate. Run deterministic checks (plugin.test.ts, e2e scenarios 1-4), then run /opencode-coder/docs and /opencode-coder/improve-doc in a manual launcher workspace and judge semantically per TESTING.md criteria." \
  --type=task --priority=2

bd dep add <acceptance-id> <task-2-id>
bd dep add <acceptance-id> <task-3-id>
bd dep add <acceptance-id> <task-4-id>
bd dep add <acceptance-id> <task-5-id>
bd dep add <acceptance-id> <task-6-id>
```

This makes the acceptance task invisible to `bd ready` until all its blockers are closed.

---

### Discussion-Gated Task Summary

| Situation | What to do |
|---|---|
| Task needs a decision before work starts | Create a **discussion issue** + the **execution issue**, then `bd dep add <execution> <discussion>` |
| Decision has been made | `bd close <discussion-id>` — the execution task immediately appears in `bd ready` |
| Task is too vague even for a discussion | Leave it out of the plan; add it later when the question crystallizes |

The key principle: **never leave a task open and undecided with no blocker** — that's how a tasker silently picks it up and makes an undiscussed choice.

---

Want me to actually run the `bd create` commands to build this plan now?
