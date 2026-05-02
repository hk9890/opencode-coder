---
name: code-simplify
description: "Use this skill when the AI assistant should simplify recently changed files after implementation work, using recent-change scope guardrails and parallel reuse/quality/efficiency review lenses. Do not use this skill for whole-repository cleanup sweeps, architecture rewrites."
---

## Workflow routing (standalone skill surface)

| Workflow | Use when | Argument expectations | Source of truth |
|---|---|---|---|
| Simplify recently changed code | After feature/bugfix implementation to clean up the most recently changed files without widening scope | Optional free-text focus via `$ARGUMENTS`; treat as weighting guidance, not permission to expand scope | [references/simplify.md](references/simplify.md) |

## Boundaries

- Start from recently changed files, not a whole-repo cleanup pass.
- Keep edits local and behavior-preserving unless the user explicitly approves broader changes.
- If higher-impact opportunities are found, summarize and ask first instead of applying by default.
