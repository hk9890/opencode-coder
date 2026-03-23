# Validation Transcript

## Mode

with_skill

## Eval Prompt

My project is set up in team mode and I want opencode-coder to generate or update AGENTS.md and the standard topic docs. Some topics like releases are fully handled by an installed skill and I do not want hollow docs for those. Walk me through what should be created versus what should just route to skills.

## Tool Calls

1. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/SKILL.md"}`
2. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/agents-md-template.md"}`
3. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/project-docs-lifecycle.md"}`

## Final Response

Here is the rule from the skill, stated directly:

**If a topic is covered entirely by an installed skill and has no project-specific local content, do not create a topic doc. Route AGENTS.md to the skill instead.**

---

## The Decision Matrix

| Situation | What to create |
|-----------|---------------|
| Topic has project-specific content (commands, conventions, project paths, etc.) | Create `docs/TOPIC.md`, reference it in AGENTS.md |
| Topic is fully handled by an installed skill, no local content | **No doc.** AGENTS.md routes directly to the skill |
| Topic has both a skill and project-specific additions | Create `docs/TOPIC.md` for the project-specific parts, AGENTS.md references both |
| Topic has no skill and no project content | Omit the section entirely from AGENTS.md |

---

## Your Releases Case Specifically

For a topic like Releases where a skill is installed and fully handles it, the correct AGENTS.md entry is:

```markdown
## Releases

Load the **your-release-skill** skill for the release workflow.
```

No `docs/RELEASING.md` is created. The skill guidance explicitly calls this out (Step 4 of `agents-md-template.md`):

> "If a section is active only because a skill/workflow is installed (no project-specific doc content found), reference the skill/workflow in AGENTS.md and **do not create a hollow topic doc**."

---

## What AGENTS.md Always Gets

- **Project Overview** — always inline (name, description, tech stack)
- **Landing the Plane** — always inline if beads is installed
- Everything else — conditional, pointers only, no inlined content

---

## Running This

The skill executes this as a lifecycle workflow. The right command is:

```
/opencode-coder/docs
```

It will inspect your installed skills, classify each topic as `doc-backed` / `skill-only` / `neither`, and only create files where real local content exists. For Releases (and any other skill-only topics), it will write the skill-routing line in AGENTS.md and stop there.
