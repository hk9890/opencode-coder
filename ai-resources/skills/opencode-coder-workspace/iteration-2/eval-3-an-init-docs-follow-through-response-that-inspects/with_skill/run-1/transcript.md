# Validation Transcript

## Mode

with_skill

## Eval Prompt

I ran /opencode-coder/init on my project and it is now asking me about project docs. My repo already has a docs/ folder with some existing markdown files but they are not in the standard opencode-coder format. What should happen next?

## Tool Calls

1. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/SKILL.md"}`
2. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/installation-setup.md"}`
3. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/project-docs-lifecycle.md"}`
4. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/project-setup.md"}`

## Final Response

Based on the skill guidance, here's what should happen:

## What `/opencode-coder/init` does with your existing docs

When init asks about project docs and you have existing markdown files that aren't in the standard format, the correct behavior is **inspect-first, not recreate**.

### The init flow for your situation

1. **Inspect** — init should discover what you already have in `docs/` and classify each file as:
   - Covers a standard topic (`OVERVIEW`, `CODING`, `TESTING`, `RELEASING`, `MONITORING`, `PULL-REQUESTS`)
   - Covers a project-specific topic with no standard equivalent
   - Redundant with a reusable skill

2. **Bootstrap/Refresh** — init should map your existing files to the standard structure rather than overwriting them. It won't create hollow duplicate files for topics your existing docs already cover, even if the filenames differ.

3. **AGENTS.md** — init will create (or update) `AGENTS.md` with routing links pointing to your actual docs (existing files), not hypothetical standard-named ones.

### What you should tell the prompt

When init asks, clarify:
- You have existing docs and want them **preserved and incorporated**, not replaced
- You want `AGENTS.md` to route to your existing files where they cover the relevant topics
- If any standard topics are genuinely missing from your existing docs, init can create those gap-files

### What init should NOT do

- Recreate files wholesale just to match standard filenames
- Create hollow/empty stub files for topics already covered
- Overwrite existing project-specific content with generic boilerplate

The standard names (`CODING.md`, `TESTING.md`, etc.) are a convention, not a requirement. `AGENTS.md` can route to whatever your files are actually called. Only if there's a genuine content gap (a topic not covered at all) should new files be created.
