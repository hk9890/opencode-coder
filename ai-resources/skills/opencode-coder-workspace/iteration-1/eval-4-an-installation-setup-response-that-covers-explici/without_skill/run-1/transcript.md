# Validation Transcript

## Mode

without_skill

## Eval Prompt

I'm onboarding a fresh repo to opencode-coder and need to decide between stealth and team mode. Explain the explicit enablement model, what /opencode-coder/init should do, and the practical file-path or git-visibility differences that matter when choosing.

## Tool Calls

1. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/commands/opencode-coder/init.md"}`
2. **Glob** `{"pattern": "src/**/*.ts", "path": "/home/hans/dev/github/opencode-coder"}`
3. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/src/service/plugin-mode-service.ts"}`
4. **Glob** `{"pattern": "ai-resources/skills/opencode-coder/references/*.md", "path": "/home/hans/dev/github/opencode-coder"}`
5. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/installation-setup.md"}`
6. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/project-structure.md"}`

## Final Response

Here's a complete picture based on the actual source:

---

## Explicit Enablement Model

Nothing is auto-created for a fresh repo. The plugin starts in **not-yet-enabled** state and stays there until you explicitly choose a mode. The single source of truth is `.coder/opencode-coder.yaml`.

**Four resolved states** (`plugin-mode-service.ts:8`):

| State | Meaning |
|---|---|
| `not-enabled` | No saved mode file, no legacy markers — fresh project |
| `disabled` | Saved `mode: disabled` — inactive but `/opencode-coder/init` still works |
| `stealth` | Active, local-only |
| `team` | Active, shared |
| `hard-disabled` | `OPENCODE_CODER_DISABLED=true` env var — plugin fully absent, no commands exposed |

The key distinction: saved `disabled` ≠ `OPENCODE_CODER_DISABLED`. The env var kills even `/opencode-coder/init`. Saved disabled just suppresses startup generation while keeping the command available.

---

## What `/opencode-coder/init` Does

It's the only setup entry point. On each run it:

1. **Detects state** — reads `.coder/opencode-coder.yaml`, falls back to legacy heuristics if missing, migrates legacy state to the explicit file immediately
2. **Asks what to do** — never proceeds autonomously past this checkpoint (question for fresh/disabled, or refresh/switch/disable for active)
3. **Writes `.coder/opencode-coder.yaml`** before creating any other files
4. **Runs mode-specific setup** — beads init, git exclusion setup, AGENTS.md generation
5. **Optionally runs docs setup** — asks separately; skippable

It's safe to re-run. Re-runs refresh rather than reinstall.

---

## File-Path and Git-Visibility Differences

| Concern | Stealth | Team |
|---|---|---|
| Saved mode | `.coder/opencode-coder.yaml` | `.coder/opencode-coder.yaml` |
| AGENTS file | `.coder/AGENTS.md` | `AGENTS.md` (repo root) |
| Docs | `.coder/docs/` | `docs/` |
| Beads data | `.beads/` | `.beads/` |
| AI manifest | `ai.package.yaml` | `ai.package.yaml` |

**Git visibility:**

- **Stealth**: all opencode-coder artifacts (`.beads/`, `.opencode/`, `.coder/`, `ai.package.yaml`) go into `.git/info/exclude` — machine-local, never committed, invisible to teammates
- **Team**: `.coder/` goes into `.gitignore`; everything else (`.beads/`, `.opencode/`, `AGENTS.md`, `docs/`, `ai.package.yaml`) is committed and shared

---

## Choosing

**Pick stealth when:**
- you're using opencode-coder on a repo owned by others or a team that hasn't adopted it
- you don't want AI tooling artifacts appearing in PRs or team history
- you need per-developer personal setup

**Pick team when:**
- the whole team uses opencode-coder
- you want `AGENTS.md`, docs, and issue tracking shared via git
- you want `bd ready` / shared beads state for collaboration

The mode is easily switchable later via `/opencode-coder/init` → "Switch modes". The transition reference (`mode-transition.md`) covers the cleanup steps between modes.
