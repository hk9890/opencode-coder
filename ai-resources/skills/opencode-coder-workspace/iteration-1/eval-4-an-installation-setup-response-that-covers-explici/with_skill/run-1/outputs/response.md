The task spans installation/init and mode selection. I need both references.

Also pulling the project-structure reference since it covers file paths in detail.

Here is a complete answer drawn directly from the skill references.

---

## Explicit Enablement Model

opencode-coder does **nothing automatically** on a fresh repo. Until you run `/opencode-coder/init`, startup exposes only that one command and creates no files.

There are three persisted states, written to `.coder/opencode-coder.yaml`:

| State | Behaviour |
|---|---|
| *(file absent)* | Not yet enabled — no startup work, only `/opencode-coder/init` available |
| `mode: disabled` | Saved disabled — startup stays inactive, but `/opencode-coder/init` is still available to re-enable |
| `mode: stealth` | Active, local-only |
| `mode: team` | Active, shared |

These are distinct from the **hard override** `OPENCODE_CODER_DISABLED=true`, which cuts off the plugin entirely — no commands, no init.

---

## What `/opencode-coder/init` Does

It is idempotent (safe to re-run) and handles every enablement lifecycle transition:

- Enable a fresh project in `stealth` or `team`
- Keep a project in saved `disabled`
- Refresh an already-active `stealth` or `team` setup
- Switch between `stealth` and `team`
- Switch an active project back to saved `disabled`
- Migrate legacy projects that pre-date the explicit model (infers active state from `.git/info/exclude`, legacy `.coder/project.yaml`, or presence of `.beads/` / `AGENTS.md` / `ai.package.yaml`, then writes the saved mode file)
- Optionally run a docs setup/refresh step

---

## File-Path and Git-Visibility Differences

This is the crux of the stealth vs team choice:

| Concern | Team mode | Stealth mode |
|---|---|---|
| Saved mode file | `.coder/opencode-coder.yaml` | `.coder/opencode-coder.yaml` |
| AGENTS file | `AGENTS.md` (repo root) | `.coder/AGENTS.md` |
| Standard docs | `docs/` | `.coder/docs/` |
| Beads data | `.beads/` | `.beads/` |
| Plugin resources | `.opencode/` | `.opencode/` |
| AI manifest | `ai.package.yaml` | `ai.package.yaml` |

### Team mode git visibility
Commit: `.beads/` (minus runtime/credential files), `.opencode/`, `ai.package.yaml`, `AGENTS.md`, `docs/`  
Ignore: `.coder/` (add to `.gitignore`)

### Stealth mode git visibility
All opencode-coder artifacts are kept **out of git** via `.git/info/exclude` — that file is local-only and never shared, so collaborators never see the exclusion block. The block covers:

```
.beads/
.opencode/
.coder/
ai.package.yaml
```

---

## Practical Decision Rule

| Situation | Choose |
|---|---|
| Solo work, experimentation, private AI context | **Stealth** |
| Team wants shared docs, shared AGENTS, shared beads state | **Team** |

**Switching later is supported but has a cost:** stealth → team is straightforward. Team → stealth creates a visible commit that removes shared artifacts — coordinate with collaborators first.
