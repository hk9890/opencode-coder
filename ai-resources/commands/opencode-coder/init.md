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

### Step 4: Optional project-doc setup/refresh

After mode selection and core setup, explicitly ask the user:

- `Set up project docs now`
- `Skip for now`

Rules:

- If the user chooses `Skip for now`, do not create/refresh docs in this run
- If the user chooses `Set up project docs now`, use the shared lifecycle model from:
  - `references/project-docs-lifecycle.md`
  - `references/project-setup.md`
  - `references/project-structure.md`
- Do not define or invent a second docs lifecycle inside init

#### 4a. Inspection (explicit, required before write actions)

Run lifecycle **Phase 1 — Inspect** with these explicit checks:

1. Resolve active docs directory from mode (`project-structure.md`):
   - team: `docs/`
   - stealth: `.coder/docs/`
2. Inspect existing standard topic docs in the active docs directory:
   - `OVERVIEW.md`
   - `CODING.md`
   - `TESTING.md`
   - `RELEASING.md`
   - `MONITORING.md`
   - `PULL-REQUESTS.md`
3. Inspect installed skills/workflows relevant to these topics (for example `.opencode/skills/` when present)
4. Classify each topic as exactly one of:
   - `existing doc` (project-specific local doc exists)
   - `skill-only` (no local doc, but relevant reusable skill/workflow exists)
   - `neither` (no local doc and no relevant skill/workflow signal)
5. Show the topic decision matrix to the user **before** creating or refreshing docs

#### 4b. Apply lifecycle phases for docs

After presenting the matrix, execute lifecycle phases from `project-docs-lifecycle.md` as appropriate:

- bootstrap/setup when active baseline is missing
- refresh/update when baseline exists
- AGENTS phase as part of lifecycle (not a separate command family)
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
