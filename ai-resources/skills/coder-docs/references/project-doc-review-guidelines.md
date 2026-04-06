# Project-Doc Review Guidelines

Reviewer-focused companion for canonical project docs.

Use with:

- [project-setup.md](project-setup.md)
- [project-doc-guidelines.md](project-doc-guidelines.md)

## Review workflow

1. Load target doc.
2. Confirm file-role fit using `project-setup.md`.
3. Apply authoring rules from `project-doc-guidelines.md`.
4. Check installed skill coverage and ensure local docs only add local delta where applicable.
5. Verify repository facts (paths, commands, workflows, links).

## Required checks

- Canonical steering docs are the operating layer.
- Non-standard docs kept after consolidation have explicit scoped justification.
- No duplicate/conflicting operating guidance across canonical docs and retained non-standard docs.
- No stale routes after merge/split/delete actions.
- `CHANGE-WORKFLOW.md` is used for change-landing guidance.

## Findings format

Return findings as:

`[SEVERITY] <file>:<section> — <rule-id> — <violation> — <evidence> — <suggested fix>`

Severity:

- `BLOCKER`: must-fix correctness or policy violation
- `MAJOR`: high-impact scope/actionability gap
- `MINOR`: clarity/scanability improvement

Suggested rule IDs:

- `R1` repo-local anchor requirement
- `R2` scan-first structure
- `R3` topic boundary
- `R4` skill-aware local delta
- `R5` project actionability
- `V1` validation coverage

## Validation safety model

- Tier A (safe/read-only): run freely
- Tier B (expensive but safe): run as needed to verify meaningful claims
- Tier C (destructive/irreversible): do not execute during routine review; verify indirectly

## Pass criteria

Review passes when:

1. No `BLOCKER` findings remain.
2. Repo-truth checks succeeded for edited claims.
3. Consolidation and routing state is coherent.
