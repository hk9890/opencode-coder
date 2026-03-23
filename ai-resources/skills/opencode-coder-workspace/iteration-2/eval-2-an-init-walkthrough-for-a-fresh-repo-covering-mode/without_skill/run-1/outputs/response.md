Good. Now let me read the key skill reference files to give you an accurate walkthrough.

Here's what happens when you run `/opencode-coder/init` on a fresh repo with no prior setup:

---

## Step 1: State Detection

The command checks for `.coder/opencode-coder.yaml` first, then looks for legacy markers. Since this is a fresh repo, none will be found. **No files are created during detection.**

Result: project classified as **"not yet enabled"**.

---

## Step 2: Mode Selection (interactive)

You'll be asked to choose one of:

- **Enable stealth mode** — all AI artifacts stay local (`.coder/`, `.beads/`, etc. excluded via `.git/info/exclude`)
- **Enable team mode** — AI artifacts are committed to the repo (`.beads/`, `AGENTS.md`, `docs/`)
- **Remain inactive** — do nothing; you can re-run later

Only after you choose an active mode does `.coder/` get created and `.coder/opencode-coder.yaml` get written.

---

## Step 3: Core Setup

Depending on your choice:

**Stealth mode:**
```bash
mkdir -p .coder
echo 'mode: stealth' > .coder/opencode-coder.yaml
bd init --stealth && bd hooks install
mkdir -p .coder/docs
# Adds exclusion block to .git/info/exclude
```

**Team mode:**
```bash
mkdir -p .coder
echo 'mode: team' > .coder/opencode-coder.yaml
bd init && bd hooks install
echo '.coder/' >> .gitignore
```

Then it generates `AGENTS.md` (team → root `AGENTS.md`, stealth → `.coder/AGENTS.md`). This is a routing table, not a handbook.

---

## Step 4: Docs Setup (optional, inspect-first)

Before asking you anything, it runs a full inspection and shows you a matrix like:

| Topic | State |
|---|---|
| OVERVIEW.md | `neither` |
| CODING.md | `skill-only` |
| TESTING.md | `neither` |
| … | … |

Then asks: *"I couldn't find the standard project docs layout yet. I can inspect this repo and set up topic docs. Do you want me to do that now?"* (with a **Skip for now** option always available.)

If you proceed, it creates docs only for topics with real project-specific content. Skill-covered topics are routed via AGENTS without creating hollow docs.

---

## Step 5: Completion Summary

```
Initialization Complete!
✓ Explicit plugin mode saved
✓ Prerequisites checked
✓ Beads initialized
✓ Git hooks installed
✓ AGENTS.md created
✓ Docs: created X / skipped Y / routed via skills Z
```

---

**Prerequisites to have ready before running it:**
- `git` initialized (required)
- `bd` CLI installed: `npm install -g beads`
