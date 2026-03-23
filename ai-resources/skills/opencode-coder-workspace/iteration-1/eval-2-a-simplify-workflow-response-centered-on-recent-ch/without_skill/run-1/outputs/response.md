Let me read the relevant context first.

Here's exactly how I'd run it, grounded in the workflow definition at `ai-resources/skills/opencode-coder/references/simplify.md`:

---

## Scope

First I'd resolve the file set from git state:

```bash
git diff --name-only --cached   # staged
git diff --name-only            # unstaged
```

From the current status that gives:
- `src/index.ts`
- `src/templates/init-install-guide.ts`
- `ai-resources/commands/opencode-coder/*.md` (7 files)
- `docs/TESTING.md`
- `tests/unit/init-install-guide.test.ts`

Because your focus is **duplication**, the review is weighted toward Reviewer 1 but all three passes still run.

---

## Review Passes (parallel)

**Reviewer 1 — Reuse & Duplication** *(weighted by your focus)*
- Duplicated logic across `src/index.ts` and the service files
- Repeated string literals or branching patterns in `init-install-guide.ts`
- Copy-pasted sections in the `.md` command files (they share structure — `docs.md`, `doctor.md`, etc.)
- Any setup/teardown repetition between the test file and its subject

**Reviewer 2 — Code Quality**
- Naming clarity in the changed functions
- Unnecessary complexity or dead branches
- Readability problems introduced by the feature

**Reviewer 3 — Efficiency**
- Wasteful recomputation in `src/index.ts` entry paths
- Repeated parsing in the template generation

---

## What I'd apply directly (no confirmation needed)

These are local, behavior-preserving, clearly safe:
- Extracting a duplicated string literal into a named constant within the touched file
- Collapsing two near-identical branches into one when the delta is trivial
- Pulling a repeated 2–3 line block into a small private helper **used only within the changed area**
- Deduplicating any repeated markdown boilerplate in the command docs if it's identical copy-paste
- Removing dead assignments or redundant conditionals introduced by the feature

---

## What I'd ask you about first

These cross module boundaries, touch public API, or require architectural judgment:
- Extracting a shared helper into a new file (even if obvious — it changes the public surface of the module)
- Merging overlapping logic between two service files (e.g. `beads-service.ts` and another service)
- Changing the template generation contract in `init-install-guide.ts` if the duplication is in the signature/shape rather than implementation
- Any refactor that would touch files outside the scoped set (e.g. pulling something into `src/core/index.ts`)
- If the best fix is a cross-module abstraction, I'd explain the opportunity and create a beads issue rather than applying it unilaterally

---

## Validation

After applying safe fixes, I'd run the narrowest available validation — given `tests/unit/init-install-guide.test.ts` is in scope:

```bash
bun test tests/unit/init-install-guide.test.ts
```

Plus a typecheck if the changed files are TypeScript:

```bash
bun tsc --noEmit
```

---

## How to invoke it

Just say `/simplify focus on duplication` (or "run simplify with focus on duplication") and I'll execute this plan: resolve scope from git, run the three reviewers in parallel, apply safe deduplication fixes directly, surface any bigger opportunities for your decision, validate, and end with the summary format from the workflow.
