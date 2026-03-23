Let me look at the project structure to understand what's already in place.

Now let me look at the existing topic docs and the skills to understand what's covered.

Let me check what skills are actually installed (vs in ai-resources) and whether any referenced skills are missing.

Good — I now have the full picture. Here's the breakdown:

## The Decision Rule

There are three states a topic can be in:

| State | When | What to do |
|---|---|---|
| **doc-backed** | Project-specific commands, config, or context exists | Create/maintain `docs/TOPIC.md` |
| **skill-only** | Generic workflow, skill covers everything, nothing project-specific | AGENTS.md routes to skill — no doc |
| **skill + doc** | Skill handles the generic flow, but project-specific details exist | Both: route to skill AND keep `docs/TOPIC.md` |

**A doc is hollow when it just restates what the skill already says generically.** A doc is legitimate when it has specific commands, env requirements, repo URLs, platform quirks, or project-specific checklists that the skill cannot know.

---

## Current State of Each Topic in This Repo

### Releases — skill + doc (correctly structured, keep as-is)
- `github-releases` skill is installed under `ai-resources/skills/github-releases/`
- `docs/RELEASING.md` is **not hollow** — it has specific bun commands, GitHub Packages auth notes, the exact `gh workflow run release.yml` invocation with project-specific inputs, rollback steps, and a detailed pre-release checklist
- The skill's SKILL.md explicitly says "read `docs/RELEASING.md`" to fill TODOs — it actively depends on this file
- **Action**: nothing to change here

### Monitoring — doc-backed (stale skill reference to fix)
- `docs/MONITORING.md` has substantial project-specific content: `.coder/logs/` paths, `scripts/log-analyzer` commands, session export via `coder()` calls, diagnostics bundle workflow
- The `observability-triage` skill referenced in `AGENTS.md` **does not exist** — no such skill is in `ai-resources/skills/`
- **Action**: remove the stale `observability-triage` skill line from AGENTS.md; MONITORING.md stands on its own

### Coding, Testing, Pull Requests, Overview
- All have local docs with real project-specific content — keep them as doc-backed topics
- No skill is referenced for these, routing is clean

### Issue Tracking (beads / opencode-coder skill)
- Routes to the `opencode-coder` skill — this is skill-only for the workflow, with no separate `docs/BEADS.md` — correct

---

## Summary: What to Create vs What to Route

**For this repo right now**, no new hollow docs need to be created. The only action is:

- **Fix** the `observability-triage` stale skill reference in `AGENTS.md` (line 30) — that skill doesn't exist; the Monitoring section should just point to `docs/MONITORING.md`

Do you want me to make that fix now?
