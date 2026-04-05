# Project Docs Lifecycle Workflow

Canonical workflow logic for `/opencode-coder/init-or-update-docs` and `/opencode-coder/improve-doc`.

This reference owns the lifecycle phases for project docs and AGENTS routing.
`/opencode-coder/init-or-update-docs` is the canonical initialize/update entrypoint and should stay a thin dispatcher that calls into this file.
`/opencode-coder/improve-doc` should also stay a thin dispatcher that calls into this file's improvement workflows.

## Command contract for `/opencode-coder/init-or-update-docs`

This command keeps the same lifecycle scope as the prior generic docs command.

- Scope is unchanged: **inspect → bootstrap/setup → refresh/update → audit/repair → slim/split → AGENTS refresh → verify/report**.
- Optional `$ARGUMENTS` are treated only as **focus/weighting guidance** (for example: "prioritize testing docs" or "focus on routing cleanup first").
- Optional `$ARGUMENTS` do **not** authorize widening lifecycle scope or skipping required phases.

## Lifecycle defaults (apply in every phase)

| Rule | Default behavior |
|---|---|
| Canonical steering audience | Agent-first. Canonical steering docs are optimized for agents; maintainers/contributors are expected to work through agents. |
| Compatibility policy | Backward-compatible redirect files are **not** a default goal for steering docs. |
| Legacy steering files | Treat non-standard files as consolidation candidates and decide keep/merge/split/delete before refresh work. |
| Completion bar | No stale links/routes and no duplicate/conflicting operating guidance across canonical and retained non-standard docs. |

## Phase 1 — Inspect

1. Load `project-structure.md` and resolve active mode/paths.
2. Discover existing docs at active `{docs}` path.
3. Discover installed skills under `.opencode/skills/` when present.
4. Classify topics as:
   - **doc-backed**: project-specific local doc exists
   - **skill-only**: no local doc, but a matching reusable skill/workflow is installed under `.opencode/skills/`
   - **neither**: no local doc and no relevant skill signal
5. Inventory non-standard docs (anything outside canonical steering filenames) as explicit consolidation candidates.

Standard topic set:

- `OVERVIEW.md`
- `CODING.md`
- `TESTING.md`
- `RELEASING.md`
- `MONITORING.md`
- `CHANGE-WORKFLOW.md`

For change-landing guidance, `CHANGE-WORKFLOW.md` is the canonical output target. Treat any non-standard change-workflow docs discovered during inspection as consolidation/removal candidates, not generated baseline outputs.

### Phase 1 output contract (required before consolidation)

For each non-standard candidate doc, capture:

- path and primary topic(s)
- current role: operating guidance vs notes/history/reference
- overlap with canonical docs
- overlap with installed skills
- initial migration risk (links/routes likely affected)

## Phase 1.5 — Non-standard Doc Consolidation (MANDATORY when candidates exist)

Run this phase **before** Bootstrap/Refresh edits when non-standard docs are present.

### Step A — Gather evidence (required)

For each non-standard doc, collect this checklist:

- [ ] topic fit to canonical taxonomy (`OVERVIEW`, `CODING`, `TESTING`, `RELEASING`, `MONITORING`, `CHANGE-WORKFLOW`, `CONTRIBUTING`, `AGENTS`)
- [ ] repo-specific operational value (commands/paths/constraints that are still true)
- [ ] overlap with canonical docs (none/partial/heavy)
- [ ] overlap with installed skills (none/partial/heavy)
- [ ] durability (stable operating guidance vs transient notes)
- [ ] content type (operational guidance vs notes/history/archive)

Do not choose keep/merge/split/delete without this evidence.

### Step B — Decision model (keep / merge / split / delete)

| Outcome | Choose when | Required action |
|---|---|---|
| **Keep (justified)** | File is not canonical steering guidance but has durable scoped value (for example archive, design-history, or narrow reference) that should remain separate | Keep file, label scope explicitly, ensure AGENTS/routes do not present it as canonical steering doc |
| **Merge** | Most useful operating content maps to one canonical file | Move content into one canonical target, remove duplicate sections from source, delete source when fully absorbed |
| **Split** | Useful operating content belongs in multiple canonical files | Distribute content by topic into canonical targets, leave source only if justified residual scope remains; otherwise delete |
| **Delete** | Redundant, obsolete, generic, historical-only, or fully absorbed content | Remove file and clean stale references/links/routes |

### Step C — Compatibility rule during execution

- Do not create backward-compatible redirect files by default for steering docs.
- Only keep compatibility artifacts if the user explicitly asks for them.

### Step D — Execution checklist

- [ ] canonical targets selected per decision
- [ ] migrated content rewritten into scan-first action-first canonical style
- [ ] duplicate/conflicting guidance removed
- [ ] AGENTS/README/CONTRIBUTING routes updated to canonical targets
- [ ] stale links to removed legacy docs cleaned

## User Communication During Docs Setup

When the init flow reaches the docs step (especially with existing non-standard docs), communicate in **plain language** rather than internal terminology.

**Do this:**
> "I found some existing markdown files in your docs/ folder, but they don't follow the standard topic layout. I can inspect what's there and propose how to organize it — or you can skip this step for now and set up docs later."

**Do NOT do this:**
> "Detected doc-backed and skill-only classification mismatch in lifecycle Phase 1. Proceed with migration flow?"

When proposing next steps, frame them as clear questions the user can answer without understanding plugin internals.

## Phase 2 — Bootstrap / Setup

Use when active baseline is missing (no AGENTS and no lifecycle-aligned docs at active paths).

1. Create minimal docs structure only where real project-specific content exists.
2. Do not create hollow topic files for topics already covered by installed skills — if a skill under `.opencode/skills/` handles a topic (e.g., releases, monitoring), AGENTS.md should route to the skill instead of creating an empty `docs/RELEASING.md`.
3. Do not create hollow topic files for topics with no project-specific content at all — omit them entirely.
4. Preserve mode-specific path rules from `project-structure.md`.
5. Continue into AGENTS phase so routing reflects created/available docs and skills.

### Skipping the Docs Step

The docs step during init is optional. If the user skips it:

- **AGENTS.md still works** — it will be created/refreshed with routing entries to whatever already exists (installed skills, existing docs).
- **Docs can be created later** — the user can run `/opencode-coder/init-or-update-docs` at any time to revisit the docs lifecycle.
- **No loss of functionality** — beads tracking, mode selection, and all other plugin features work independently of the docs step.
- **The skip is non-destructive** — existing docs are not modified or removed.

Always offer "skip for now" as an explicit option when presenting the docs step.

## Phase 3 — Refresh / Update

Use when baseline exists and needs normal maintenance.

1. Refresh existing docs in place.
2. Update routing links and topic coverage in AGENTS.
3. Avoid blind recreation of files; preserve custom sections and existing project-specific content.
4. Keep docs-skill boundaries clear (project-specific in docs, reusable flow in skills).
5. Apply Phase 1.5 consolidation decisions before considering refresh complete.

## Phase 3.5 — Canonical Doc Authoring Loop (MANDATORY when canonical docs change)

> **This loop is mandatory for canonical doc creation/update work.** Do not stop after drafting.

### Scope

This loop is required when canonical docs are created or updated through:

- `/opencode-coder/init-or-update-docs`
- `/opencode-coder/improve-doc`

This is also the expected standard for any broader opencode-coder-guided canonical doc work, even when entered through another command or nested workflow.

### Required loop

1. **Draft/update pass**
   - Create or update the target canonical doc.
2. **Reviewer pass against `project-doc-review-guidelines.md`**
   - Run a rule-based review using `project-doc-guidelines.md` for authoring rules, `project-setup.md` for file-role boundaries, and `project-doc-review-guidelines.md` for reviewer workflow and file-specific checklists.
3. **Factual verification pass**
   - Verify repository facts for the edited guidance:
     - links
     - file paths
     - anchors
     - workflows/entrypoints
     - scripts
     - documented commands
4. **Fix pass**
   - Apply fixes for all blocker findings.
5. **Repeat**
   - Re-run review + factual verification until blocker issues are gone.

### Reviewer output contract

The reviewer must return actionable findings in this structure:

`[SEVERITY] <file>:<section> — <rule-id> — <violation> — <evidence> — <suggested fix>`

- `SEVERITY` must be one of `BLOCKER`, `MAJOR`, `MINOR`.
- `rule-id` should use guideline IDs (for example `R1`, `P2`, `V1`).
- `evidence` must point to concrete text, path, or command mismatch.
- `suggested fix` must be specific enough to apply without guessing.

### Factual verifier contract

The factual verifier must check:

1. Referenced local paths exist.
2. Referenced links and anchors resolve.
3. Mentioned scripts/entrypoints exist at documented locations.
4. Documented workflows still match the current repository structure and routing.
5. Documented commands are valid under the safety policy below.

### Command safety policy (for factual verification)

- **Tier A (safe/read-only):** execute normally.
- **Tier B (expensive but safe):** execute when required to verify a claim.
- **Tier C (destructive/irreversible):** **must not be executed** during doc verification.

For Tier C claims, verify indirectly by checking script/workflow presence, parameter contracts, preconditions, and rollback/safety notes.

### Orchestration model

This loop may be:

- **main-agent-led** (single agent performs review + factual checks), or
- **nested-subagent-assisted** (review/verification delegated)

In either model, the orchestrating/main agent is accountable for enforcing the mandatory loop, consolidating findings, applying fixes, and proving blocker-free completion before handoff.

## Phase 4 — Audit / Repair

Use for documentation health cleanup.

1. Check AGENTS/doc links for broken paths.
2. Identify stale references to removed/renamed docs, commands, or skills.
3. Detect duplicated guidance where skill baseline and project doc repeat the same generic workflow.
4. Repair links/references and tighten routing so AGENTS points to canonical current sources.
5. For README/CONTRIBUTING/AGENTS synchronization, validate cross-doc consistency (commands, path references, and routing terminology) before applying broad edits.
6. Confirm non-standard retained docs have explicit scoped justification and are not treated as canonical steering docs.
7. Confirm migrated/split content landed in the intended canonical files.

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

## Phase 7 — Verify / Report (MANDATORY)

> **This phase is not optional.** Every docs lifecycle run MUST end with verification. Skipping it is the most common failure mode — the baseline often catches stale references and broken links that skill users miss because they stop after Phase 6.

For runs that create/update canonical docs, Phase 7 is **fed by Phase 3.5 outputs** and remains the final lifecycle gate. It is not replaced. Instead:

- Phase 3.5 enforces iterative doc-authoring review/factual checks during authoring.
- Phase 7 confirms lifecycle-wide integrity after all edits (including AGENTS routing and cross-doc consistency).

Completion requires both: (1) Phase 3.5 blocker-free loop for canonical doc edits, and (2) Phase 7 final verification/report.

Before completion, verify:

1. **File paths** — all referenced local file paths exist (glob or ls each path mentioned in AGENTS and docs)
2. **AGENTS routes** — every route in AGENTS.md points to a real doc or installed skill (check `.opencode/skills/` for skill references)
3. **Skill-only topics** — topics routed to skills have no hollow doc created; confirm the skill actually exists
4. **Mode/path consistency** — file locations match the active mode from `project-structure.md`
5. **Command validity** — documented commands referenced by lifecycle-touched docs still work in this project
6. **Cross-reference links and anchors** — links and anchors across lifecycle-touched docs resolve correctly
7. **No stale references** — no references remain to retired routes, renamed files, or removed skills
8. **Skill-backed docs are not standalone traps** — when a topic depends on an installed skill (for example `RELEASING.md`), the doc clearly says to start with the skill or command entrypoint and does not read like a complete generic workflow
9. **Canonical-doc loop completion** — if canonical docs were created/updated, include reviewer + factual-verifier results and confirm no `BLOCKER` findings remain
10. **Canonicality and exceptions** — canonical steering docs are the operating layer; any retained non-standard doc has explicit scoped justification
11. **Consolidation correctness** — merge/split outcomes landed in the correct canonical files with no conflicting duplicate guidance
12. **Migration cleanup** — removed legacy files have no stale routes, broken links, or compatibility redirects unless explicitly requested by the user

Final report should include:

- mode and active paths
- executed phases
- created/updated/skipped files with reason
- verification results (all checks passed, or specific failures found)
- unresolved follow-ups (if any)

## `/opencode-coder/improve-doc` workflow modes

`/opencode-coder/improve-doc` supports two modes:

1. **Incident-driven targeted improvement** (preserved): use when a failure happened because guidance was missing, unclear, stale, or routed to the wrong place.
2. **Discussion-first improvement** (default when no strong incident context is provided): start with a docs-structure analysis before edits.

### Input model

- optional free-text incident/context input
- optional issue/reference identifier
- prompt fallback when input is missing or too vague

If strong incident context exists, run the incident-driven path.
If no strong incident context exists, run the discussion-first path first.

### Discussion-first default path (required without strong incident context)

1. **Analyze current docs structure first**
   - Inspect canonical docs, AGENTS routing, and notable non-standard docs.
   - Report:
     - current positives worth preserving
     - current negatives or risk areas
     - concrete improvement proposals

2. **Ask before editing**
   - Ask the user which proposals to pursue before making edits.
   - Do not begin edits until user selection/confirmation is provided.

3. **Require explicit confirmation for aggressive changes**
   - Before removal, consolidation, or deletion actions, ask for explicit confirmation.
   - Examples requiring confirmation: deleting non-standard files, collapsing multiple docs into one, removing substantial sections.

4. **Execute selected improvements with lifecycle consistency**
   - Reuse mode/path and verification rules from lifecycle phases.
   - If canonical docs are created/updated, run the full Phase 3.5 loop before completion.

### Incident-driven targeted path (preserved)

Use this flow when a failure happened because guidance was missing, unclear, stale, or routed to the wrong place.

The command should combine both incident text and issue/reference details when available.

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
    - For change-landing gaps (commit/branch/merge/PR flow), map canonical project-doc updates to `CHANGE-WORKFLOW.md` and consolidate or remove non-standard change-workflow docs.

3. **Analyze why prevention failed**
   - Identify the specific failure mode, for example:
     - required step not documented (for example forgetting `validate-before-release.sh`)
     - documented step exists but AGENTS did not route to it
     - routing exists but points to stale/missing target
     - guidance exists but is too ambiguous to trigger correct action

4. **Propose recurrence-prevention updates**
    - Propose targeted, concrete changes that make the correct action easier to discover and apply next time.
    - Prioritize fixes that improve routing and decision points, not cosmetic edits.
    - For skill-backed topics, prefer explicit "start here" entrypoints and clear warnings against standalone use.

5. **Ask/confirm before high-impact edits**
   - Ask the user which proposed changes to apply.
   - Require explicit confirmation before aggressive removals, consolidation, or deletion actions.

6. **Apply/prepare updates with lifecycle consistency**
     - Reuse the same mode/path and verification rules from phases above.
     - If canonical docs are created/updated, run the full Phase 3.5 loop before completion.
     - Ensure AGENTS references only real docs/skills.
     - Ensure updated guidance clearly indicates when a step is required.

7. **Report prevention outcome**
    - Summarize incident input used, mapped destination(s), root cause, and proposed/applied changes.
    - Explicitly state how the updates reduce recurrence risk.

### Non-goal

This flow is not for generic editorial cleanup (typos/grammar-only changes) that are unrelated to an observed failure.
