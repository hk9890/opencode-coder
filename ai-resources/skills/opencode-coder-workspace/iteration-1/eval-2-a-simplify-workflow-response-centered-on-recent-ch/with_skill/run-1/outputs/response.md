Here is exactly how I would execute the simplify workflow for your session, with focus on duplication:

---

## Scope selection

Run these two commands first:

```bash
git diff --name-only --cached
git diff --name-only
```

Combine and deduplicate the results. From your git status I can already see the candidate set:

- `ai-resources/commands/opencode-coder/*.md` (6 files)
- `docs/TESTING.md`
- `src/index.ts`
- `src/templates/init-install-guide.ts`
- `tests/unit/init-install-guide.test.ts`

Deleted files are excluded. Untracked directories (`ai-resources/skills/opencode-coder-workspace/`, `ai-resources/skills/opencode-coder/evals/`) are out of scope — those are new additions, not recently changed code.

---

## Three parallel review passes

I launch all three reviewers simultaneously against that file set.

**Reviewer 1 — Reuse & Duplication** (your stated focus, weighted highest):
- Look for repeated logic patterns across the 6 command `.md` files
- Look for duplicated scaffolding or shared boilerplate in `src/index.ts` and the template file
- Look for repeated test setup or assertion patterns in the test file

**Reviewer 2 — Code Quality**:
- Naming clarity, unnecessary complexity, weak structure in the touched `.ts` files

**Reviewer 3 — Efficiency**:
- Wasteful recomputation, unnecessary allocations, repeated parsing in `src/index.ts`

Each reviewer returns only high-confidence findings with file references and a safe/ask-first flag.

---

## Aggregation

After reviewers return, I merge duplicates, prefer fixes that address multiple dimensions at once, and discard speculative or low-confidence findings.

---

## What I apply directly (safe fixes)

- Collapsing identical or near-identical blocks in the command `.md` files into shared phrasing
- Removing duplicated logic within `src/index.ts` that is entirely local to the touched functions
- Extracting a tiny helper if the same expression appears 3+ times within the changed area
- Small naming or structure improvements inside the changed scope

---

## What I ask you about first

- Any deduplication that requires changing how the command `.md` files are structured at a higher level (e.g. extracting a shared partial or template file) — that is a cross-file architectural decision
- Moving or renaming exports in `src/index.ts` that affect the public API
- Pulling shared logic out of `init-install-guide.ts` into a new utility module — new file creation warrants a question
- Anything that would touch files outside the scoped set, even if the duplication clearly originates there

If a worthwhile opportunity is too large to apply as a safe fix, I describe it clearly and, if beads tracking is active, offer to create an issue for it.

---

## Validation

After applying safe fixes, I run the narrowest relevant check — likely:

```bash
bun test tests/unit/init-install-guide.test.ts
```

or if a broader typecheck is warranted:

```bash
bun run typecheck
```

I state explicitly if nothing meaningful is available to validate.

---

**To actually run this now**: say `/simplify focus on duplication` and I will execute the scope detection, launch the parallel reviewers, and proceed.
