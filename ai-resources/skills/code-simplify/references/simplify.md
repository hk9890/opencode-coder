# Simplify Recent Changes

Use this workflow after implementing a feature or bug fix to clean up the most recently changed files without widening scope unnecessarily.

## Inputs

- Treat user-provided `/simplify ...` arguments as optional focus guidance.
- Good examples: `focus on memory efficiency`, `reduce duplication`, `make this easier to read`.
- Apply the guidance as a weighting signal, not as permission to rewrite unrelated code.

## Default Scope Selection

Start with recent git changes:

```bash
git diff --name-only --cached
git diff --name-only
```

1. Combine and deduplicate staged + unstaged file paths.
2. Ignore deleted files and avoid opportunistic cleanup outside this set.
3. If both commands return nothing, inspect the latest commit diff:

```bash
git diff --name-only HEAD~1..HEAD
```

4. If scope is still empty or ambiguous, ask the user for explicit files instead of guessing.

## Parallel Review Passes

Launch **three reviewer agents in parallel** against the same scoped file set.

### Reviewer 1 — Reuse & Duplication

Look for:
- duplicated logic that can be collapsed safely
- repeated literals or branching patterns
- small helper extraction opportunities within the changed area

### Reviewer 2 — Code Quality

Look for:
- naming clarity
- unnecessary complexity
- readability and maintainability problems
- weak structure that can be improved without changing behavior

### Reviewer 3 — Efficiency

Look for:
- wasteful recomputation
- unnecessary allocations or repeated parsing
- avoidable I/O or looping inefficiencies
- obvious algorithmic inefficiencies in the touched paths

Tell each reviewer to return:
- high-confidence findings only
- file references
- whether the change is safe to auto-apply or should be user-approved first

## Aggregate Before Editing

After the reviewers return:

1. Merge duplicate findings.
2. Prefer fixes that improve multiple dimensions at once.
3. Reject speculative or low-confidence refactors.
4. Keep changes centered on the recently changed files and directly adjacent helpers only when necessary.

## Safe Fixes vs Ask-First Changes

Apply **safe fixes directly** when they preserve behavior and stay local in scope, for example:

- removing obvious duplication in the touched code
- tightening naming and small structure improvements
- eliminating clearly unnecessary work
- extracting a tiny helper used only by the touched area

Ask the user before doing broader or riskier changes, for example:

- public API or schema changes
- moving files or large cross-module refactors
- changing core algorithms or data flow semantics
- edits that spread well beyond the touched area
- anything likely to require architectural discussion

If the best fix is substantial, explain the opportunity and ask before proceeding. If it becomes non-trivial follow-up work, create a follow-up task or issue in your team's tracker.

## Applying Changes

- Implement the approved simplifications directly.
- Keep behavior stable.
- Do not expand into a generic cleanup sweep.
- If no worthwhile improvements are found, say so clearly instead of forcing changes.

## Validation

Run the smallest relevant validation for the files you changed:

- targeted tests when obvious
- otherwise the narrowest sensible lint/build/typecheck command available

If no meaningful validation is available, state that explicitly.

## Implementation Notes

This workflow is prompt-driven through the hosting skill and command layer rather than a special built-in product feature.

Keep these invariants intact even if the surrounding runtime changes:

- default scope comes from recent changes, not a whole-repo cleanup sweep
- reuse, quality, and efficiency should be reviewed separately, in parallel when the environment supports it
- safe local simplifications can be applied directly
- broader refactors still require user confirmation

## Output Format

End with a concise summary that covers:

- **Scope** — which files or area were simplified
- **Focus** — any user-provided emphasis
- **Applied** — safe fixes that were made
- **Deferred / Ask-first** — broader ideas intentionally not applied
- **Validation** — what was run
- **Follow-up** — any new issue or recommendation
