# Mode Transition Guide

Canonical workflow for switching between active `stealth` and `team` modes.

## Before You Switch

- Make sure the repo is in a known good state
- Understand the visibility change:
  - **Stealth → Team** makes opencode-coder artifacts shared
  - **Team → Stealth** removes shared artifacts from git and is visible in history
- The stealth marker in `.git/info/exclude` is the source of truth for stealth detection
- The saved plugin mode file `.coder/opencode-coder.yaml` must be updated to match the target active mode

## Stealth → Team

Use this when the team is ready to share beads state, AGENTS.md, docs, and plugin resources.

1. Copy generated docs to `docs/`
2. Move or merge `.coder/AGENTS.md` into root `AGENTS.md`
3. Rewrite AGENTS paths from `.coder/docs/` to `docs/`
4. Remove the stealth block from `.git/info/exclude`
5. Delete the old stealth workspace: `rm -rf .coder/`
6. Ensure `.coder/` is gitignored
7. Recreate `.coder/opencode-coder.yaml` with `mode: team`
8. Stage shared artifacts and commit them:
   - `.beads/`
   - `ai.package.yaml`
   - `AGENTS.md`
   - `docs/`
   - `.opencode/` if present

### Verification

- No stealth marker remains in `.git/info/exclude`
- `AGENTS.md` is at the project root
- Standard docs live under `docs/`
- `.coder/` is ignored, not tracked
- `git status` shows shared artifacts ready to commit

## Team → Stealth

Use this when opencode-coder artifacts should become local-only again.

1. Create `.coder/docs/`
2. Copy standard docs into `.coder/docs/`
3. Copy or derive `.coder/AGENTS.md` from root `AGENTS.md`
4. Rewrite AGENTS paths from `docs/` to `.coder/docs/`
5. Add the stealth exclusion block to `.git/info/exclude`
6. Remove opencode-coder artifacts from the git index if they should no longer be shared:
   - `.beads/`
   - `ai.package.yaml`
   - `AGENTS.md`
   - generated docs under `docs/`
   - `.opencode/` if it was only used for local tooling
7. Ensure `.coder/opencode-coder.yaml` contains `mode: stealth`
8. Commit the removal as a normal git change

### Warning

Team → stealth creates a visible commit that removes shared AI tooling artifacts. Coordinate with collaborators first.

### Verification

- Stealth marker exists in `.git/info/exclude`
- `.coder/AGENTS.md` exists
- Generated docs live under `.coder/docs/`
- The shared artifacts are no longer tracked if that was the intent
- Re-running `/opencode-coder/init` detects stealth mode and does not re-ask the mode question

## Active → Disabled

Use this when the project should keep opencode-coder installed but suppress project-local startup behavior.

1. Write `.coder/opencode-coder.yaml` with `mode: disabled`
2. Do not run active startup generation after the mode change
3. Leave any existing docs or artifacts in place unless the user explicitly wants cleanup

### Verification

- `.coder/opencode-coder.yaml` contains `mode: disabled`
- Next startup exposes `/opencode-coder/init` but not active project-local plugin behavior
- This state is clearly distinguished from `OPENCODE_CODER_DISABLED=true`

## Practical Rule

- Prefer **stealth** for solo or local experimentation
- Prefer **team** when the team wants shared docs, shared AGENTS, and shared beads state
