---
description: Update the AGENTS.md routing table for the current project
---

# Update AGENTS.md

Regenerate or update the project's AGENTS.md file based on current documentation and installed skills.

This is a lightweight alternative to `/opencode-coder/init` — it only touches AGENTS.md, skipping skill discovery and beads initialization.

## Instructions

### Step 0: Detect Mode

Before doing anything else, detect the active mode:

```bash
grep -q "# opencode-coder stealth mode" .git/info/exclude 2>/dev/null && echo "STEALTH_ACTIVE"
```

- If output is `STEALTH_ACTIVE` → stealth mode is active
- If no output → use team mode paths

Load `references/project-structure.md` for the canonical path and file-writing rules, then carry that context into the template workflow.

### Step 1: Run the Template Workflow

1. **Load the references** — Load the `opencode-coder` skill and read:
   - `references/project-structure.md`
   - `references/agents-md-template.md`
2. **Follow the workflow** — Execute all steps from the template (it will re-confirm the mode via its own detection, which is consistent with what you detected above):
   - Step 1: Gather Context (spawn explore agent)
   - Step 2: Map existing docs to sections
   - Step 3: Migration decision (ask user if non-standard names found)
   - Step 4: Create missing standard files
   - Step 5: Generate AGENTS.md
   - Step 6: Verify
3. **Report completion** — Show what sections were created/updated and what files were referenced or created

## Key Rules

- **MUST ask the user** before migrating files to standard names — never auto-migrate
- **MUST ask the user** before creating new files (like `docs/CODING.md`) — confirm the content is correct
- If AGENTS.md already exists, follow the "Updating an Existing AGENTS.md" section from the template
- Preserve any custom sections the user added manually
- Follow `project-structure.md` for mode-specific paths and write locations
