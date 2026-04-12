# Coder Skill Additive Split Boundaries (Epic `opencode-coder-3mv8`) (Historical)

> **Status (2026-04-12): Historical reference only.**
>
> This document freezes the old additive-only split contract and is not the active runtime/package validation contract after split bootstrap migration (`opencode-coder-9dfx`).
> Keep for design history; do not treat its no-touch/coexistence constraints as current validation requirements.

## Purpose

This document freezes the implementation contract for the additive rollout of three new skills:

- `coder-core`
- `coder-beads`
- `coder-docs`

The contract is intentionally decisive so child implementation epics can execute without hidden assumptions or cross-skill coupling.

> **Amendment (2026-04-08, epic `opencode-coder-wlpd`)**
> This document remains a historical frozen contract for additive rollout under epic `opencode-coder-3mv8`. The simplify ownership decision in Section B is superseded for current-state ownership: base `/simplify` workflow ownership moved from `coder-core` to standalone `code-simplify` after compatibility-surface routing changed.

---

## Phase Scope (Additive Only)

This rollout is additive-only. It introduces new skill surfaces and planning artifacts without changing existing runtime or published behavior.

### No-Touch Rule (Hard Constraint)

During this rollout, the following remain unchanged:

- existing `ai-resources/skills/opencode-coder/**`
- existing package manifests (including `ai.package.yaml` and existing package files)
- existing command wrappers (`ai-resources/commands/**`)
- existing agents (`ai-resources/agents/**`)
- plugin/runtime code (`src/**`)
- existing project docs (including current `docs/user-guide/**` entrypoints)
- existing tests/evals

Only additive new files are created by the implementation epics.

---

## Skill Surface Contract

### New Skills Introduced

1. `coder-core`
   - Owns general plugin/runtime operational guidance that is not beads-specific.
   - Owns core troubleshooting that applies even when beads is not present.

2. `coder-beads`
   - Owns all beads tracker setup, health, and workflow guidance.
   - Owns beads follow-up and issue-filing behavior.

3. `coder-docs`
   - Owns docs lifecycle and AGENTS generation guidance.
   - Owns project-doc setup/review guidance used by docs lifecycle workflows.

### Existing Skill During Additive Overlap

`opencode-coder` remains unchanged and remains the currently routed/default combined experience during this phase. The new skills are parallel, directly loadable evaluation surfaces only.

---

## Direct Loading Contract (No Command Wrapper Changes)

For this phase, new skills are exposed only through direct skill/package loading (e.g., aimgr install/load paths). No new command wrappers are added, and no existing command wrappers are changed.

Implications:

- no `/coder-core/...`, `/coder-beads/...`, `/coder-docs/...` command-wrapper work in this rollout
- no command routing changes
- no plugin registration changes under `src/**`

---

## Ownership Map for Mixed/Overlapping Content

The current `opencode-coder` references include mixed core + beads material. This section resolves ownership explicitly so child tasks do not make inconsistent decisions.

### A. Health and Troubleshooting Split

| Topic Area | `coder-core` owns | `coder-beads` owns | `opencode-coder` (unchanged) during overlap |
|---|---|---|---|
| Plugin/runtime health | plugin startup/runtime health checks, mode health not requiring beads, aimgr/plugin runtime diagnostics | n/a | retains existing mixed guidance unchanged |
| Beads health | n/a | `.beads/` state checks, `bd doctor`, hooks/install and tracker-health troubleshooting | retains existing mixed guidance unchanged |
| Troubleshooting docs with mixed content today | copy/adapt only core/runtime sections into `coder-core` references | copy/adapt beads/tracker sections into `coder-beads` references | remains mixed and untouched |
| Installation/setup where mixed today | plugin/runtime setup steps only | beads install/setup and tracker bootstrap steps | remains mixed and untouched |

Decision: split plugin/runtime health from beads health. Do not preserve mixed ownership in new skills.

### B. Simplify Guidance Ownership

> **Historical note (superseded for current-state ownership):** The table and decision below capture the additive-phase decision as originally frozen under `opencode-coder-3mv8`.

| Topic | Owner |
|---|---|
| Base `/simplify` workflow and non-tracker behavior | `coder-core` |
| Beads-specific follow-up when tracking is active (e.g., create/follow issue behavior) | `coder-beads` |
| Existing combined simplify guidance | `opencode-coder` unchanged |

Decision: `coder-core` keeps simplify baseline; `coder-beads` owns tracker-integrated follow-up behavior. Cross-skill references are optional and explicit only.

**Current-state supersession (`opencode-coder-wlpd`):** Base `/simplify` ownership is now `code-simplify`; `coder-core` no longer owns simplify baseline workflow.

### C. AGENTS and Docs Lifecycle Ownership

| Topic | Owner |
|---|---|
| AGENTS generation guidance/templates and ownership rules | `coder-docs` |
| Project docs lifecycle setup/update/review guidance | `coder-docs` |
| Beads-specific task filing guidance used while operating docs workflows | `coder-beads` (tracker behavior), optionally referenced by `coder-docs` |
| Existing combined AGENTS/docs guidance | `opencode-coder` unchanged |

Decision: AGENTS generation and docs lifecycle ownership are centralized in `coder-docs` for this rollout.

### D. `docs/user-guide/` Overlap During Additive Phase

`docs/user-guide/*` entrypoints remain pointed at the existing `opencode-coder` canonical sources during additive overlap.

Contract for this phase:

- do not edit existing `docs/user-guide/` symlinks/copies
- do not repoint user-guide entrypoints to the new skills yet
- accept overlap/divergence risk as temporary technical debt during additive rollout
- migration/repointing of `docs/user-guide/*` is explicitly out of scope for this epic and belongs to a later migration phase

### E. Bug Reporting Ownership

| Topic Area | `coder-core` owns | `coder-beads` owns | `coder-docs` owns | `opencode-coder` (unchanged) during overlap |
|---|---|---|---|---|
| Plugin/runtime bug reporting | plugin/runtime defect reporting guidance, reproduction evidence for plugin/runtime failures, and escalation paths not specific to beads tracker behavior | n/a | n/a (may optionally reference companion tracker guidance) | retains existing mixed guidance unchanged |
| Tracker/workflow issue filing | n/a | `bd` issue-filing workflow, beads metadata/fields usage, and tracker-specific follow-up for reported issues | n/a (may optionally reference companion tracker guidance where docs workflows mention filing) | retains existing mixed guidance unchanged |
| Mixed bug-reporting guidance in current references | copy/adapt non-beads bug-reporting sections into `coder-core` references | copy/adapt beads tracker filing/follow-up sections into `coder-beads` references | no primary ownership in this mixed area | remains mixed and untouched |

Decision: bug reporting is explicitly split. `coder-core` is the primary owner for plugin/runtime bug-reporting guidance; `coder-beads` is the primary owner for tracker/beads filing and workflow behavior. `coder-docs` has no primary ownership here.

### F. Debugging Logs Ownership

| Topic Area | `coder-core` owns | `coder-beads` owns | `coder-docs` owns | `opencode-coder` (unchanged) during overlap |
|---|---|---|---|---|
| Plugin/runtime log debugging | log locations, collection, and analysis for plugin/runtime diagnostics not requiring beads tracker internals | n/a | n/a (may optionally reference companion diagnostics skill areas) | retains existing mixed guidance unchanged |
| Beads/tracker diagnostics logs | n/a | beads/tracker-specific log or state diagnostics (including tracker-health evidence tied to `bd` workflows) | n/a (may optionally reference companion diagnostics where docs workflows intersect) | retains existing mixed guidance unchanged |
| Mixed debugging-log guidance in current references | copy/adapt non-beads log-debugging sections into `coder-core` references | copy/adapt beads/tracker diagnostic sections into `coder-beads` references | no primary ownership in this mixed area | remains mixed and untouched |

Decision: debugging/log-analysis ownership is explicitly split. `coder-core` is the primary owner for plugin/runtime log analysis; `coder-beads` is the primary owner for beads/tracker diagnostics. `coder-docs` has no primary ownership here.

No deferment is applied for bug-reporting or debugging-logs in this phase because downstream implementation tickets already treat both areas as split-sensitive. Explicit assignment is required to keep child task scope deterministic.

---

## Fork vs Mirror Policy

The new skills are **intentional additive forks** of relevant current content, not tracked mirrors.

Meaning:

- divergence from `opencode-coder` is allowed in this phase
- there is no mirror-sync guarantee between old and new references
- each new skill can evolve independently within its owned boundary

---

## Independence Contract (No Hidden Runtime Dependencies)

Goal: each new skill is independently loadable/useful within its boundary and must not require implicit runtime coupling to another new skill.

Rules:

1. No hidden dependency assumptions (e.g., "this step only works if another new skill was preloaded") unless explicitly stated.
2. Cross-skill references, if present, are optional companion links only, not required runtime prerequisites.
3. Required behavior for a skill must be fully documented inside that skill’s own scope.
4. No dependency enforcement via commands/agents/plugin code in this phase.

---

## What Remains Owned by `opencode-coder` in This Phase

Because the rollout is additive and no-touch, the unchanged `opencode-coder` skill remains owner of:

- current default combined guidance/routing behavior
- all existing command-wrapper-driven workflows
- all existing agent-routed behavior
- all currently published mixed-content references

The new skills are evaluation/parallel surfaces only until a later migration epic changes routing and canonical ownership.

---

## Implementation Readiness Checklist (for child epics)

- Use exact names: `coder-core`, `coder-beads`, `coder-docs`
- Keep rollout additive; create new files only
- Do not modify existing skill/manifests/commands/agents/src/docs/tests
- Use explicit split ownership above for mixed references
- Treat new content as forked, not mirror-synced
- Keep skill surfaces direct-load only (no command wrapper work)
- Avoid hidden cross-skill runtime dependencies

This checklist is normative for `opencode-coder-3mv8.*` implementation tasks.
