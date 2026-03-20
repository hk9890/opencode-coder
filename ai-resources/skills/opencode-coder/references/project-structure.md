# Project Structure & File Rules

Canonical layout for opencode-coder explicit enablement, AGENTS generation, and `/opencode-coder/init` refreshes.

## 1. Detect Saved Mode First

Use `.coder/opencode-coder.yaml` as the primary source of truth when it exists.

Saved modes:

- `disabled`
- `stealth`
- `team`

If the saved mode file is missing, use legacy detection only to preserve older initialized projects.

### Legacy detection order

1. stealth marker in `.git/info/exclude`
2. legacy `.coder/project.yaml` with `mode: stealth` or `mode: team`
3. shared team markers: `.beads/`, `AGENTS.md`, and `ai.package.yaml`

When legacy active state is inferred, persist `.coder/opencode-coder.yaml` immediately.

### Fresh project rule

If no saved mode or legacy active markers are found:

- the project is **not yet enabled**
- startup must not create `.coder/`
- startup must expose only `/opencode-coder/init`

### Hard-disable rule

`OPENCODE_CODER_DISABLED=true` is outside the saved mode model.

- hard override active → plugin returns nothing
- saved `disabled` → plugin remains project-inactive but `/opencode-coder/init` is still available

## 2. Canonical Locations

| Concern | Team mode | Stealth mode | Disabled / not yet enabled |
|---|---|---|---|
| Saved plugin mode | `.coder/opencode-coder.yaml` | `.coder/opencode-coder.yaml` | `.coder/opencode-coder.yaml` only for saved `disabled` |
| AGENTS file | `AGENTS.md` | `.coder/AGENTS.md` | none required |
| Standard docs | `docs/` | `.coder/docs/` | none required |
| Beads data | `.beads/` | `.beads/` | none required |
| Plugin runtime | `.coder/` | `.coder/` | absent for fresh projects; may exist for saved disabled |
| Plugin resources | `.opencode/` | `.opencode/` | none required |
| AI manifest | `ai.package.yaml` | `ai.package.yaml` | none required |

## 3. Git Visibility Rules

### Team mode

- Commit: `.beads/` (except `beads.db`), `.opencode/`, `ai.package.yaml`, `AGENTS.md`, and generated docs in `docs/`
- Ignore: `.coder/`
- Ensure `.gitignore` contains:

```bash
grep -qF '.coder/' .gitignore 2>/dev/null || echo '.coder/' >> .gitignore
```

### Stealth mode

- Keep opencode-coder artifacts local via `.git/info/exclude`
- The exclusion block should cover:
  - `.beads/`
  - `.opencode/`
  - `.coder/`
  - `ai.package.yaml`

### Disabled / not-yet-enabled

- Fresh projects should not have generated artifacts yet
- Saved disabled projects may retain `.coder/opencode-coder.yaml`, but startup must not regenerate active runtime files or docs

## 4. Standard Docs Contract

Use these file names under the active docs directory:

| Topic | Standard file | Rule |
|---|---|---|
| Coding | `CODING.md` | Always required for active setups |
| Testing | `TESTING.md` | Create only if relevant |
| Releases | `RELEASING.md` | Create only if relevant |
| Monitoring | `MONITORING.md` | Create only if relevant |
| Pull Requests | `PULL-REQUESTS.md` | Create only if relevant |

**Create a standard doc only when it has real content.** If a section is active only because a skill exists, AGENTS.md can reference the skill without creating a hollow doc.

## 5. AGENTS.md Rules

- AGENTS.md is a **routing table**, not a handbook
- Keep it short; point to files and skills instead of inlining guidance
- Inline only:
  - Project Overview
  - Landing the Plane / session completion block
- Always use mode-correct paths
- In stealth mode, write only `.coder/AGENTS.md` — never overwrite the team root `AGENTS.md`
- In disabled or not-yet-enabled states, do not generate or refresh AGENTS files as part of startup

### If a team `AGENTS.md` already exists

In stealth mode:

- Read the root `AGENTS.md` for project context
- Write opencode-coder additions to `.coder/AGENTS.md`
- Supplement the team file; do not duplicate or rewrite it

## 6. Writing Rules

### When writing docs or AGENTS

- Detect saved/active mode first
- In stealth mode:
  - write docs only under `.coder/docs/`
  - write AGENTS only to `.coder/AGENTS.md`
  - never create generated files under `docs/` or root `AGENTS.md`
- In team mode:
  - write docs under `docs/`
  - write AGENTS to `AGENTS.md`
  - do not place generated docs under `.coder/docs/`
- In saved `disabled` or fresh not-yet-enabled states:
  - do not run active startup generation
  - only update `.coder/opencode-coder.yaml` when the user explicitly changes saved mode

### When refreshing `/opencode-coder/init`

- Use the saved mode file first
- If a legacy active project is detected, materialize the saved mode before continuing
- Refresh generated docs in the active docs directory only for active modes
- Refresh the active AGENTS file only for active modes
- Preserve any committed team `AGENTS.md`
- Report what changed

## 7. Minimal Mental Model

- **Team mode** = shared project assets live at standard repo paths
- **Stealth mode** = same concepts, but generated artifacts live under `.coder/` and stay local
- **Disabled mode** = project-local startup is suppressed until re-enabled via `/opencode-coder/init`
- **Not yet enabled** = fresh project with no saved mode yet
- **The mode decides the paths and behavior**; `.coder/` existence alone does not
