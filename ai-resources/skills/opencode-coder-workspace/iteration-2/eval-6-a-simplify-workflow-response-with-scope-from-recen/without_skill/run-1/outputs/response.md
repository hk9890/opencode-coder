Here's what happens when you run `/simplify reduce duplication`:

**1. Scope detection**

It runs `git diff --name-only --cached` and `git diff --name-only`, deduplicates the results, and drops any deleted files. Since you have staged/unstaged changes across your three files, those become the exact scope — nothing more.

**2. Three parallel reviewer agents**

All three read the same scoped files simultaneously:

- **Reviewer 1 (Reuse & Duplication)** — weighted heavier because of your "duplication" focus. Looks for collapsed logic opportunities, repeated literals, branching patterns, small helper extractions.
- **Reviewer 2 (Code Quality)** — naming, unnecessary complexity, readability.
- **Reviewer 3 (Efficiency)** — wasteful recomputation, unnecessary allocations, avoidable loops.

Each returns only high-confidence findings with file references and a `safe-to-apply` vs `ask-first` flag.

**3. Aggregation**

Duplicate findings across reviewers are merged. The duplication focus acts as a weighting signal, so Reviewer 1's findings get priority when there's a tradeoff. Speculative or low-confidence items are dropped.

**4. Applying changes**

- **Safe fixes go directly** — removing obvious duplication, tightening names, eliminating clearly unnecessary work within your three files.
- **Ask-first** — anything touching public APIs, other modules, or requiring architectural discussion. If the best fix is substantial, you get an explanation and a prompt before it proceeds. If it would become real follow-up work, a beads issue gets created.

**5. Validation**

Narrowest sensible check for the changed files — targeted tests if obvious, otherwise lint/build/typecheck.

**6. Summary**

Ends with a structured output: Scope / Focus / Applied / Deferred / Validation / Follow-up.

The key constraint throughout: it never expands into a broader cleanup sweep. Your three files are the ceiling unless a fix requires touching a directly adjacent helper.
