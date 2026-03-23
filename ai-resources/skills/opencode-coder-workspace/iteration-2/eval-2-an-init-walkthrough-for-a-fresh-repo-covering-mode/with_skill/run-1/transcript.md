# Validation Transcript

## Mode

with_skill

## Eval Prompt

I just cloned my project and want to set up opencode-coder for the first time. Run /opencode-coder/init and walk me through what should happen. This is a fresh repo with no prior opencode-coder setup.

## Tool Calls

1. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/SKILL.md"}`
2. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/installation-setup.md"}`
3. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/project-structure.md"}`
4. **Glob** `{"pattern": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/project-setup.md"}`
5. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/project-setup.md"}`

## Final Response

Here's what happens when you run `/opencode-coder/init` on a fresh repo:

---

## Step 1: Prerequisites check

Before doing anything else, verify:

```bash
git status     # repo must be initialized
bd --version   # beads CLI must be installed
```

If `bd` is missing: `npm install -g beads`

---

## Step 2: Mode selection

Since your repo has no `.coder/opencode-coder.yaml` and no legacy markers (no `.beads/`, no `AGENTS.md`, no `.git/info/exclude` stealth block), the plugin sees this as **not yet enabled** and prompts you to choose a mode:

| Mode | What it means |
|------|---------------|
| **stealth** | All generated files live under `.coder/` and `.beads/` — kept local via `.git/info/exclude`, never committed |
| **team** | Files go to standard repo paths (`AGENTS.md`, `docs/`, `.beads/`) and are committed |
| **disabled** | Writes `.coder/opencode-coder.yaml` with `mode: disabled` — stays inactive until you re-run init |

**Choose stealth** if you want opencode-coder for yourself without affecting the repo for others. **Choose team** if the whole team will use it.

---

## Step 3: What gets created (per mode)

### Stealth mode
```bash
mkdir -p .coder
echo 'mode: stealth' > .coder/opencode-coder.yaml
bd init --stealth && bd hooks install
mkdir -p .coder/docs
# .git/info/exclude gets a block covering .beads/ .opencode/ .coder/ ai.package.yaml
```

### Team mode
```bash
mkdir -p .coder
echo 'mode: team' > .coder/opencode-coder.yaml
bd init && bd hooks install
echo '.coder/' >> .gitignore
# AGENTS.md and docs/ created at repo root
```

---

## Step 4: Docs setup (optional prompt)

Init will offer to run a docs setup step. This creates the project's AGENTS routing file and any standard docs that have real content:

- `AGENTS.md` (or `.coder/AGENTS.md` in stealth) — short routing table, not a handbook
- `docs/OVERVIEW.md` (or `.coder/docs/`) — what the project is
- Additional docs (`CODING.md`, `TESTING.md`, etc.) only if the project has real content for them

---

## Step 5: Verify

After init completes:

- `.coder/opencode-coder.yaml` exists with the correct mode
- `bd ready` runs without errors
- The AGENTS file is at the mode-correct path
- Git visibility matches your chosen mode (stealth = excluded, team = committed)

---

## First steps after setup

```bash
bd create "Setup project" --type task
bd ready
```

---

**Bottom line for a fresh clone**: the only thing init does automatically is ask you which mode you want — it will not create any files until you explicitly choose. That's the explicit enablement model. Nothing is activated by just opening the project.
