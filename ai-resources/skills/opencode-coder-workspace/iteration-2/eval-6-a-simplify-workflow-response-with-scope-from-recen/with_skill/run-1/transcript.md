# Validation Transcript

## Mode

with_skill

## Eval Prompt

I just finished implementing a batch of changes across three files and want to run /simplify with a focus on duplication before I open a PR. Walk me through what happens.

## Tool Calls

1. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/SKILL.md"}`
2. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/simplify.md"}`

## Final Response

Here's what happens when you run `/simplify duplication` (or `/simplify` with a duplication focus):

---

## Step 1 — Scope Selection

The workflow reads your recent git changes, not the whole repo:

```bash
git diff --name-only --cached    # staged
git diff --name-only             # unstaged
```

Both lists are combined and deduplicated. Your three changed files become the scope. Deleted files are excluded. If nothing showed up it would fall back to `HEAD~1..HEAD`, and if still ambiguous it would ask you directly.

---

## Step 2 — Three Parallel Reviewer Agents

Three reviewers run simultaneously against those same files:

| Reviewer | Focus |
|----------|-------|
| **Reuse & Duplication** | duplicated logic, repeated literals/branching patterns, small helper extraction |
| **Code Quality** | naming, unnecessary complexity, readability |
| **Efficiency** | wasteful recomputation, unnecessary allocations, I/O inefficiencies |

Since you passed `duplication` as a focus, that's treated as a **weighting signal** — Reviewer 1's findings get priority in aggregation, but the other two still run and contribute if they find something high-confidence.

Each reviewer is asked to report: what it found, which file, and whether the fix is safe to apply directly or needs your approval first.

---

## Step 3 — Aggregate

After all three return, findings are merged (duplicates collapsed), multi-dimension improvements are preferred, and speculative/low-confidence ideas are dropped.

---

## Step 4 — Apply or Ask

- **Safe fixes** (local duplication collapse, tiny helper extraction, naming tightening) → applied directly without prompting you.
- **Riskier changes** (public API reshaping, cross-module moves, anything that spreads beyond your three files) → explained to you first, not touched until you say yes.
- If something non-trivial surfaces, a beads issue is created to track it rather than just describing it in chat.

---

## Step 5 — Validation

The narrowest sensible validation for the changed files runs — targeted tests if obvious, otherwise lint/build/typecheck. If nothing meaningful is available, that's stated explicitly rather than skipped silently.

---

## Step 6 — Summary

Output ends with a structured block covering: **Scope**, **Focus**, **Applied**, **Deferred/Ask-first**, **Validation**, and **Follow-up**.

---

Key thing to know: this is **not a whole-repo cleanup sweep**. The workflow is intentionally bounded to your recent changes and adjacent helpers only when strictly necessary.
