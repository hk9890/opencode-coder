---
description: Explicitly enable, refresh, or reconfigure opencode-coder for this project
---

# Initialize Coder Project

Use `/opencode-coder/init` as the single entry point for first-time enablement, refresh, disablement, and mode switching.

## Task

Load the opencode-coder skill for detailed guidance:

```
skill({ name: "opencode-coder" })
```

Use these references as the source of truth:

- `references/installation-setup.md` — explicit enablement model and init flow
- `references/project-setup.md` — project-doc structure and project-specific-content rules
- `references/project-docs-lifecycle.md` — shared docs lifecycle phases and reporting model
- `references/project-structure.md` — mode detection, saved state, paths, file-writing rules
- `references/mode-transition.md` — switching between stealth and team
- `references/agents-md-template.md` — AGENTS generation workflow

Then follow this 5-step command flow:

---

### Step 1: Detect startup state

Check the following in order before creating files:

1. Saved mode file: `.coder/opencode-coder.yaml`
   - `mode: disabled` → saved disabled project
   - `mode: stealth` → active stealth project
   - `mode: team` → active team project
   - invalid/unreadable → warn and treat as not explicitly enabled yet
2. Legacy markers when the saved mode file is missing:
   - stealth marker in `.git/info/exclude`
   - or legacy `.coder/project.yaml` with `mode: stealth` or `mode: team`
   - or shared team markers: `.beads/`, `AGENTS.md`, and `ai.package.yaml`
3. Otherwise treat the project as not yet enabled

Rules:

- Do **not** treat `.coder/` existence alone as activation
- Do **not** create `.coder/` during detection for a fresh project
- If legacy active state is inferred, persist `.coder/opencode-coder.yaml` immediately so future startups use explicit state
- `OPENCODE_CODER_DISABLED=true` is a hard override and prevents this command from existing at all in that session

---

### Step 2: Choose enablement action

#### Fresh / not-yet-enabled

Use `question()` and offer:

- `Enable stealth mode` — local-only setup
- `Enable team mode` — shared setup
- `Remain inactive` — leave startup inactive

Rules:

- If the user chooses `Remain inactive`, stop after explaining that the project stays inactive until `/opencode-coder/init` is run later
- If the user chooses an enable option, create `.coder/` only then and write `.coder/opencode-coder.yaml` with the chosen mode before continuing

#### Saved disabled

Use `question()` and offer:

- `Enable stealth mode`
- `Enable team mode`
- `Remain disabled`

Rules:

- `Remain disabled` keeps `mode: disabled` and stops without active startup work
- Enabling updates `.coder/opencode-coder.yaml` before continuing

#### Active stealth or team (including legacy-migrated)

Use `question()` and offer:

- `Refresh <current> setup`
- `Switch modes`
- `Disable startup`

Rules:

- Do not assume refresh on re-runs
- `Disable startup` writes `.coder/opencode-coder.yaml` with `mode: disabled`, explains that this is different from `OPENCODE_CODER_DISABLED`, and stops
- A mode switch follows `references/mode-transition.md`, updates `.coder/opencode-coder.yaml`, and then continues with AGENTS/docs in the new mode

---

### Step 3: Skill discovery and core setup work

For enabled or refreshed modes, continue with setup in the same session.

#### 3a. Skill discovery

Load the `ai-resource-manager` skill and use its recommend-resources workflow.

If `.coder/project.yaml` does not exist yet because startup was inactive, continue anyway — detect context directly as needed.

#### 3b. Beads initialization or refresh

Initialize or refresh beads for the selected mode.

Use canonical mode/path rules from `references/project-structure.md`.

- Stealth mode:
  - `bd init --stealth && bd hooks install`
  - `mkdir -p .coder/docs`
  - ensure the stealth exclusion block exists in `.git/info/exclude`
- Team mode:
  - `bd init && bd hooks install`
  - ensure `.gitignore` includes `.coder/`

When switching modes, follow `references/mode-transition.md` and then continue with the target mode's paths.

#### 3c. AGENTS.md creation

Generate or update AGENTS.md using:

- `references/project-structure.md`
- `references/agents-md-template.md`

Key rules:

- team mode writes `AGENTS.md`
- stealth mode writes `.coder/AGENTS.md`
- AGENTS.md is a routing table, not a handbook

---

### Step 4: Optional project-doc setup or review (inspect first)

After mode selection and core setup, first check whether `/opencode-coder/docs` is available in this session.

- If `/opencode-coder/docs` is available, inspect the project's docs state, ask the user what to do, apply the chosen action, and verify the result.
- If `/opencode-coder/docs` is not available, do not run project-doc setup/update in this session; explain that plainly and continue init.

Rules when docs follow-through is available:

- Follow these references:
  - `references/project-docs-lifecycle.md`
  - `references/project-setup.md`
  - `references/project-structure.md`
- Inspection is required before asking the user what to do next
- Ask the user with scenario-aware wording and include `Skip for now` in every branch
- If the user chooses `Skip for now`, do not create/refresh docs in this run

Fallback rules when docs follow-through is unavailable:

- Use plain language, for example: "Project-doc setup/update isn't available in this session because `/opencode-coder/docs` is unavailable right now. I'll continue init without changing project docs."
- Continue and complete init without failing the no-skill/no-resource path

#### 4a. Inspection and state classification (explicit, required before prompts or write actions)

Run lifecycle **Phase 1 — Inspect** with these explicit checks:

1. Resolve active docs directory from mode (`project-structure.md`):
    - team: `docs/`
    - stealth: `.coder/docs/`
   Resolve active AGENTS path from mode:
    - team: `AGENTS.md`
    - stealth: `.coder/AGENTS.md`
2. Inspect existing standard topic docs in the active docs directory:
   - `OVERVIEW.md`
   - `CODING.md`
   - `TESTING.md`
   - `RELEASING.md`
   - `MONITORING.md`
   - `PULL-REQUESTS.md`
3. Inspect project-specific guidance outside the standard topic files (migration signals), including mixed content in broader files and non-standard docs names, for example:
   - `README.md`
   - `CONTRIBUTING.md`
   - non-standard files in `docs/` or `.coder/docs/`
4. Inspect installed skills/workflows relevant to these topics (for example `.opencode/skills/` when present)
5. Classify each topic as exactly one of:
    - `existing doc` (project-specific local doc exists)
    - `skill-only` (no local doc, but relevant reusable skill/workflow exists)
    - `neither` (no local doc and no relevant skill/workflow signal)
6. Classify overall docs state as exactly one of:
   - `No standard baseline exists yet`
   - `Standard baseline already exists`
   - `Docs exist in non-standard layout and may need migration`
7. Show the topic decision matrix and overall state to the user **before** asking the Step 4 question or creating/refreshing docs

Define migration concretely:

- Migration means project-specific guidance exists outside the standard topic docs or is mixed into broader files and should be inspected before proposing extraction, relocation, renaming, or AGENTS routing updates.

Ask the user what to do using wording that matches what was found:

- Bootstrap/setup (no standard baseline):
  - Example wording: "I couldn't find the standard project docs layout yet. I can inspect this repo and set up topic docs plus an AGENTS routing document where there is real project-specific guidance. Do you want me to do that now?"
- Review/update (standard baseline exists):
  - Example wording: "I found the standard docs layout already in place. I can review, refresh, and verify those docs and update AGENTS routing as needed. Do you want me to run that review now?"
- Migration/proposal (non-standard layout):
  - Example wording: "I found project documentation, but it is not organized in the standard topic layout. I can inspect what exists and propose a migration/routing plan before making changes. Do you want that proposal now?"

For every scenario, include `Skip for now` as an option.

#### 4b. Apply the matching docs workflow

After presenting the matrix, choose and run the lifecycle work that matches the project state:

- bootstrap/setup when active baseline is missing
- refresh/update when baseline exists
- update AGENTS routing as part of the docs work
- verify/report phase before completion

Docs-writing rules:

- Create/update docs only in the active mode path:
  - team: `docs/`
  - stealth: `.coder/docs/`
- Create only docs with real project-specific content
- For `skill-only` topics with no extra local project rules, do **not** create hollow docs; route those topics through mode-correct AGENTS:
  - team: `AGENTS.md`
  - stealth: `.coder/AGENTS.md`

---

### Step 5: Report completion

Summarize the run clearly:

> **Initialization Complete!**
>
> ✓ Explicit plugin mode saved or refreshed
> ✓ Prerequisites checked and resolved
> ✓ Beads initialized or refreshed when enabled
> ✓ Git hooks installed
> ✓ AGENTS.md created or refreshed for the active mode
> ✓ Docs step: created/updated/skipped/routed topics reported

When docs step is executed, include a compact docs summary with:

- `created`: docs newly created with project-specific content
- `updated`: existing docs refreshed
- `skipped`: topics not created/changed (with short reason)
- `routed via skills only`: topics routed through AGENTS without local doc creation

If the user chose inactive or disabled instead, summarize that no active project-local startup behavior will run until they re-enable the project with `/opencode-coder/init`.

## Guidelines for Agents

### Critical interaction rules

- **Never proceed autonomously past a checkpoint** — stop and wait for the user's response
- **Must use `question()`** at every marked interaction point
- **Do not make decisions for the user**
- **Do not skip the distinction** between saved `disabled` mode and `OPENCODE_CODER_DISABLED`

### Workflow rules

- `/opencode-coder/init` is the **only** setup entry point to document and recommend
- Fresh projects must not create `.coder/` until the user explicitly enables the plugin
- Re-running the command is safe and should refresh the active mode rather than assuming a fresh install
- Legacy initialized projects should be migrated to explicit saved mode as soon as they are detected
