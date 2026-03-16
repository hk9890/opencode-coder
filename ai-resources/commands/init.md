---
description: Initialize project for opencode-coder plugin
---

# Initialize Coder Project

Complete project setup: skill discovery, beads initialization, and AGENTS.md creation.

## Task

Load the opencode-coder skill for detailed guidance:

```
skill({ name: "opencode-coder" })
```

Use these references as the source of truth:

- `references/installation-setup.md` — install and init flow
- `references/project-structure.md` — mode detection, paths, file-writing rules
- `references/mode-transition.md` — switching between stealth and team
- `references/agents-md-template.md` — AGENTS generation workflow

Then follow this 3-step command flow:

---

### Step 1: Skill Discovery

Load the `ai-resource-manager` skill and use its "Recommend Resources" workflow (Use Case 5).

The ai-resource-manager will:
1. Read `.coder/project.yaml` for project context (written by plugin on startup)
2. List available resources from aimgr repository
3. Filter out irrelevant resources based on project context
4. Present recommendations for user selection
5. Install only user-selected resources

> **If `.coder/project.yaml` doesn't exist yet**: The ai-resource-manager has a fallback detection flow. Proceed normally.

---

### Step 2: Beads Initialization

Initialize beads for issue tracking.

> Canonical mode and path rules live in `references/project-structure.md`. Keep this command focused on execution.

#### Smart Detection (run before anything else)

**Detection Step 1 — Check for active stealth mode:**

```bash
grep -q "# opencode-coder stealth mode" .git/info/exclude 2>/dev/null && echo "STEALTH_ACTIVE"
```

- If output is `STEALTH_ACTIVE` → **stealth is already configured**. Skip the mode question entirely. Proceed directly to the **Re-run / Update** flow below.

**Detection Step 2 — Check for full team configuration:**

Check whether `.beads/` exists, `AGENTS.md` exists at the project root, and `ai.package.yaml` exists at the project root.

- If **all three exist** and stealth marker was NOT found → already fully configured in team mode. Report status to the user and skip to **Step 3** for a refresh if needed.

**Detection Step 3 — Fresh setup:**

- If neither condition above matched → this is a fresh setup. Continue with the mode question below.

---

#### Fresh Setup: Choose Mode

**MANDATORY USER INTERACTION POINT - STOP HERE (if not initialized)**

MUST use the `question()` tool to ask:
- "Which beads mode would you like to use?"
- Options: "stealth" (local-only, excluded from git) and "team" (shared with team)
- DO NOT proceed until user selects a mode

---

#### Stealth Mode Path

Run beads init with stealth flag and install hooks:

```bash
bd init --stealth && bd hooks install
```

Create the stealth workspace for generated docs:

```bash
mkdir -p .coder/docs
```

Write the exclusion block to `.git/info/exclude` (idempotent — safe to run multiple times):

```bash
if ! grep -q "# opencode-coder stealth mode" .git/info/exclude 2>/dev/null; then
  cat >> .git/info/exclude << 'STEALTH'

# opencode-coder stealth mode
.beads/
.opencode/
.coder/
ai.package.yaml
STEALTH
fi
```

> **Note**: This uses `.git/info/exclude` (never `--skip-worktree`). The marker line `# opencode-coder stealth mode` is used for detection on re-runs.

Proceed to **Step 3**.

---

#### Team Mode Path

Run beads init and install hooks:

```bash
bd init && bd hooks install
```

Exclude runtime state from git (idempotent — safe to run multiple times):

```bash
# Exclude .coder/ runtime state from git (auto-created by plugin, not team artifacts)
grep -qF '.coder/' .gitignore 2>/dev/null || echo '.coder/' >> .gitignore

# The .beads/beads.db file is already handled by .beads/.gitignore (created by bd init)
```

> **Note**: `.coder/project.yaml` is regenerated on every plugin startup.
> The plugin also auto-creates `.coder/.gitignore` (containing `*`) on startup, so this step
> ensures the exclusion is explicit in `.gitignore` as well.

Proceed to **Step 3**.

---

#### Re-run / Update Flow (stealth mode detected)

When `/init` is re-run and stealth is already active:

1. **Do NOT re-ask stealth vs team** — the marker in `.git/info/exclude` is the source of truth
2. Re-scan the codebase for changes (new docs, updated structure, new skills installed)
3. Refresh generated docs in the active docs directory for the mode
4. Check if the repo's committed `AGENTS.md` has changed since last run:
   ```bash
   git show HEAD:AGENTS.md 2>/dev/null
   ```
   If it has changed, incorporate the new content into the locally-managed version
5. Update the active AGENTS file for the mode
6. Report what was refreshed

---

### Step 3: AGENTS.md Creation

Generate or update AGENTS.md using the template:

1. Load the `opencode-coder` skill and read `references/agents-md-template.md`
   - Also read `references/project-structure.md` for canonical mode, path, and file-writing rules
2. Follow the full workflow from the template (explore → map docs → migration decision → generate)
3. This includes asking the user about migrating to standard file names if non-standard docs are found

**Key principle**: AGENTS.md is a routing table — each section points to the right docs and skills. Content lives in standard files, not in AGENTS.md itself.

All mode-specific path handling, stealth behavior, and coexistence with a team `AGENTS.md` are defined in `references/project-structure.md` and `references/agents-md-template.md`.

---

## Stealth-to-Team Transition

Canonical transition guidance lives in `references/mode-transition.md`.

If the user asks to switch modes during `/init` or after setup:

- follow `references/mode-transition.md`
- update AGENTS and docs to the target mode's paths
- update git visibility rules to match the target mode
- verify a re-run of `/init` detects the new mode correctly

---

## Step 4: Report Completion

Summarize the full initialization:

> **Initialization Complete!**
> 
> ✓ Skills discovered and installed via ai-resource-manager
> ✓ Beads initialized in the selected mode
> ✓ Git hooks installed
> ✓ AGENTS.md created or refreshed for the active mode
> 
> **Next steps:**
> - Run `bd ready` to find available work
> - Run `bd create "Task description" --type task` to create new issues
> - Review the active AGENTS file for project conventions
> - Re-run `/init` after installing new skills to update AGENTS.md

---

## Guidelines for Agents

### CRITICAL: User Interaction Requirements

- **NEVER proceed autonomously past a checkpoint** - STOP and WAIT for user response
- **MUST use `question()` tool** at every marked interaction point
- **DO NOT make decisions for the user** - present options and wait
- **DO NOT skip interaction points** even if you think you know the answer

### Workflow Rules

- **Follow the 3-step workflow**: Skill discovery → Beads init → AGENTS.md creation
- **AGENTS.md is skill-aware**: Sections adapt to what's installed
- **Use generic language**: Don't hardcode skill names in AGENTS.md
- **Skill discovery delegates to ai-resource-manager**: Load the skill and use its "Recommend Resources" workflow
- **Don't overwhelm**: Present 3-5 most relevant resources as options
- **Re-running is safe**: /init can be re-run to update AGENTS.md after changes
- **Stealth detection takes priority**: Always check for the stealth marker before asking mode questions
- **Restart messaging**:
  - After installing **skills only**: "The new skills are available immediately — just ask me to load them."
  - After installing **commands or agents**: "New commands and agents will be available in your next OpenCode session. To use them now, restart OpenCode."

### Using the question() Tool

At each **MANDATORY USER INTERACTION POINT**, structure your question call like:

```
question({
  questions: [{
    header: "Brief header",
    question: "Full question text",
    options: [
      { label: "Option 1", description: "What this does" },
      { label: "Option 2", description: "What this does" }
    ],
    multiple: true/false  // as appropriate
  }]
})
```

WAIT for the response before taking any further action.
