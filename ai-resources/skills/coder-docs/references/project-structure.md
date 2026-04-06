# Project-Doc Structure Guidance

This reference defines structure rules that docs lifecycle workflows should apply.

## Mode-aware locations

Determine active mode/path rules before writing docs.

| Concern | Team mode | Stealth mode |
|---|---|---|
| AGENTS file | `AGENTS.md` | `.coder/AGENTS.md` |
| Topic docs directory | `docs/` | `.coder/docs/` |

Use placeholders during planning:

- `{agents_md}` for mode-correct AGENTS file
- `{docs}` for mode-correct docs directory

## Standard docs contract

Topic files should use canonical names when created:

- `OVERVIEW.md`
- `CODING.md`
- `TESTING.md`
- `RELEASING.md`
- `MONITORING.md`
- `CHANGE-WORKFLOW.md`

Create a topic file only when it has real repository-specific content.

If a topic is skill-only (no local delta), route via AGENTS to the installed skill and skip hollow doc creation.

## AGENTS routing rules

- AGENTS is a routing surface, not a handbook.
- Keep AGENTS concise and pointer-based.
- Preserve custom non-template sections unless obsolete.
- Ensure every route points to a real file or installed skill.

## Consolidation orientation

When non-standard docs exist, classify and decide keep/merge/split/delete before declaring refresh complete.

- Prefer canonical steering docs as operating layer.
- Keep non-standard files only with explicit scoped justification.
- Clean stale routes after merges/deletions.
