# Project Docs Lifecycle Workflow

Canonical workflow logic for `/opencode-coder/docs` and `/opencode-coder/improve-doc`.

This reference owns the lifecycle phases for project docs and AGENTS routing.
`/opencode-coder/docs` should stay a thin dispatcher that calls into this file.
`/opencode-coder/improve-doc` should also stay a thin dispatcher that calls into this file's incident-improvement section.

## Ownership and Non-Overlap Policy

This file is the canonical source for **project documentation lifecycle** in this repo.

- Includes: project-doc synchronization, AGENTS lifecycle maintenance, lifecycle verification/audit checks.
- Excludes: single-file editorial cleanup that is not lifecycle orchestration.

When overlap exists with older guidance (for example prior `fix-documentation` project-wide workflows), this reference wins and should be treated as the source of truth.

## Phase 1 — Inspect

1. Load `project-structure.md` and resolve active mode/paths.
2. Discover existing docs at active `{docs}` path.
3. Discover installed skills under `.opencode/skills/` when present.
4. Classify topics as:
   - **doc-backed**: project-specific local doc exists
   - **skill-only**: no local doc, but a matching reusable skill/workflow exists
   - **neither**: no local doc and no relevant skill signal

Standard topic set:

- `OVERVIEW.md`
- `CODING.md`
- `TESTING.md`
- `RELEASING.md`
- `MONITORING.md`
- `PULL-REQUESTS.md`

## Phase 2 — Bootstrap / Setup

Use when active baseline is missing (no AGENTS and no lifecycle-aligned docs at active paths).

1. Create minimal docs structure only where real project-specific content exists.
2. Do not create hollow topic files for skill-only topics.
3. Preserve mode-specific path rules from `project-structure.md`.
4. Continue into AGENTS phase so routing reflects created/available docs and skills.

## Phase 3 — Refresh / Update

Use when baseline exists and needs normal maintenance.

1. Refresh existing docs in place.
2. Update routing links and topic coverage in AGENTS.
3. Avoid blind recreation of files; preserve custom sections and existing project-specific content.
4. Keep docs-skill boundaries clear (project-specific in docs, reusable flow in skills).

## Phase 4 — Audit / Repair

Use for documentation health cleanup.

1. Check AGENTS/doc links for broken paths.
2. Identify stale references to removed/renamed docs, commands, or skills.
3. Detect duplicated guidance where skill baseline and project doc repeat the same generic workflow.
4. Repair links/references and tighten routing so AGENTS points to canonical current sources.
5. For README/CONTRIBUTING/AGENTS synchronization, validate cross-doc consistency (commands, path references, and routing terminology) before applying broad edits.

## Phase 5 — Slim / Split

Use when docs are oversized or noisy.

1. Detect topic docs that exceed local size guidelines.
2. Propose targeted reductions or splitting into focused files.
3. Keep AGENTS concise and routing-oriented.
4. Prefer links to deeper files over inlining long guidance blocks.

## Phase 6 — AGENTS Refresh (within lifecycle)

Treat AGENTS as one lifecycle phase, not a standalone command family.

1. Use `agents-md-template.md` only for template/format constraints.
2. Regenerate or update AGENTS routing entries from inspected docs/skills.
3. Keep custom non-template sections unless clearly obsolete.
4. Ensure mode-correct location:
   - team: `AGENTS.md`
   - stealth: `.coder/AGENTS.md`
5. Treat AGENTS maintenance here as the canonical workflow; do not route AGENTS lifecycle updates to deprecated standalone AGENTS-fix workflows.

## Phase 7 — Verify / Report

Before completion:

- verify all referenced local file paths exist
- verify AGENTS routes only to real docs/skills
- verify skill-only topics are reported as routed-through-skill (no hollow doc implied)
- verify mode/path consistency from `project-structure.md`
- verify documented commands referenced by lifecycle-touched docs are still valid in this project
- verify cross-reference links and anchors across lifecycle-touched docs resolve correctly
- verify no stale references remain to retired lifecycle routes

Final report should include:

- mode and active paths
- executed phases
- created/updated/skipped files with reason
- unresolved follow-ups (if any)

## Incident-Driven Improvement (for `/opencode-coder/improve-doc`)

Use this flow when a failure happened because guidance was missing, unclear, stale, or routed to the wrong place.

### Input model

- optional free-text incident context
- optional issue/reference identifier
- prompt fallback when input is missing or too vague

The command should combine both sources when available.

### Workflow

1. **Capture incident context**
   - Normalize what failed, where it failed, and expected behavior.
   - If an issue/reference ID is provided, pull relevant details from the tracked record.
   - If information is insufficient, ask concise follow-up questions before proposing doc changes.

2. **Map the guidance gap destination**
   - Determine whether the missing/weak guidance belongs in:
     - project docs (mode-correct active docs path)
     - AGENTS routing (mode-correct AGENTS file)
     - opencode-coder skill/reference content
     - or a combination

3. **Analyze why prevention failed**
   - Identify the specific failure mode, for example:
     - required step not documented (for example forgetting `validate-before-release.sh`)
     - documented step exists but AGENTS did not route to it
     - routing exists but points to stale/missing target
     - guidance exists but is too ambiguous to trigger correct action

4. **Propose recurrence-prevention updates**
   - Propose targeted, concrete changes that make the correct action easier to discover and apply next time.
   - Prioritize fixes that improve routing and decision points, not cosmetic edits.

5. **Apply/prepare updates with lifecycle consistency**
   - Reuse the same mode/path and verification rules from phases above.
   - Ensure AGENTS references only real docs/skills.
   - Ensure updated guidance clearly indicates when a step is required.

6. **Report prevention outcome**
   - Summarize incident input used, mapped destination(s), root cause, and proposed/applied changes.
   - Explicitly state how the updates reduce recurrence risk.

### Non-goal

This flow is not for generic editorial cleanup (typos/grammar-only changes) that are unrelated to an observed failure.
