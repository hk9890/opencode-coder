# Simplify Recent Changes (Baseline)

Use this workflow after implementation to simplify the most recently changed files without widening scope.

## Inputs

- Treat `/simplify ...` arguments as optional focus guidance.
- Use guidance as weighting, not as permission to rewrite unrelated code.

## Default scope selection

Start from recent git changes:

```bash
git diff --name-only --cached
git diff --name-only
```

1. Combine and deduplicate staged + unstaged file paths.
2. Ignore deleted files.
3. If empty, inspect latest commit diff:

```bash
git diff --name-only HEAD~1..HEAD
```

4. If still ambiguous, ask for explicit files instead of guessing.

## Parallel review passes

Run three review lenses in parallel against the same scope:

1. **Reuse & duplication** — remove safe duplication.
2. **Code quality** — improve clarity and structure without behavior change.
3. **Efficiency** — remove obvious unnecessary work.

Each pass should return high-confidence findings with file references.

## Aggregate before editing

1. Merge duplicate findings.
2. Prefer low-risk fixes with multi-dimensional benefit.
3. Reject speculative refactors.
4. Keep edits local to touched files (plus minimal adjacent helpers only if necessary).

## Safe fixes vs ask-first changes

Apply directly when behavior-preserving and local:

- obvious local duplication removal
- small naming/structure cleanup
- clearly unnecessary recomputation/allocation

Ask first for broader changes:

- public API/schema changes
- large cross-module refactors
- major algorithm/data-flow changes

## Validation

Run the smallest relevant validation for changed files:

- targeted tests when available
- otherwise narrowest sensible lint/build/typecheck command

If meaningful validation is unavailable, state that explicitly.

## Output summary

Conclude with:

- Scope
- Focus
- Applied changes
- Deferred ask-first ideas
- Validation run
