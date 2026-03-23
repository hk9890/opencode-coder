Here's the full audit-and-refresh walkthrough, grounded in the skill's lifecycle phases:

---

## Audit-and-Refresh: Docs vs. Skills Decision Framework

### Step 0: Establish mode and paths

Before touching anything, detect the active mode:

- Check `.coder/opencode-coder.yaml` first (primary source of truth)
- Fall back to legacy signals: `.beads/`, `AGENTS.md` at root, `ai.package.yaml`
- Mode determines all paths:
  - **team** → `docs/`, `AGENTS.md`
  - **stealth** → `.coder/docs/`, `.coder/AGENTS.md`

**Why**: Writing to the wrong path is silent corruption — it creates phantom docs no one reads.

---

### Step 1 — Inspect (Phase 1)

Run a structured discovery pass across the active docs path, root, and `.opencode/skills/`. For each standard topic (`CODING.md`, `TESTING.md`, `RELEASING.md`, `MONITORING.md`, `PULL-REQUESTS.md`), classify it:

| Classification | What it means |
|---|---|
| **doc-backed** | A local project doc exists at the active path |
| **skill-only** | No local doc, but a matching installed skill covers it |
| **neither** | No doc, no skill — topic is uncovered |

This classification drives every decision downstream. Do not skip it — AGENTS.md staleness almost always traces back to a missing or wrong classification from the last time someone touched docs.

---

### Step 2 — The core "stay vs. route" decision

**A topic doc should exist if and only if it has real project-specific content that a reusable skill cannot provide.**

Concrete tests:

| Signal | Decision |
|---|---|
| Content is generic "how to write tests" with no project commands/paths | Hollow doc → delete, route to skill |
| Content duplicates what an installed skill says verbatim | Duplicate → consolidate; skill wins for the generic part |
| Content includes actual commands (`pnpm test:unit`, `cargo clippy --fix`), project-specific paths, or team conventions | Keep as project doc |
| A skill exists and the only local additions are 2–3 project-specific notes | Merge notes into skill params or a thin "project overrides" section, not a full doc |
| No skill covers this topic at all | Project doc is appropriate even if thin |

The goal is **no hollow docs** — a file that exists only to say "run the tests" is worse than no file, because it creates a false sense of coverage.

---

### Step 3 — Audit AGENTS.md for staleness (Phase 4)

AGENTS.md in a team-mode repo is the most likely stale artifact. Check these specifically:

1. **Broken links**: Every `docs/FOO.md` reference must resolve to a real file. Dead links are common after docs refactors.
2. **Routing to skill-only topics without an installed skill**: If `AGENTS.md` says "Load the `observability` skill" but that skill isn't in `.opencode/skills/`, the route is broken.
3. **Duplicated guidance**: If AGENTS inline-explains something that a doc or skill already covers fully, the inline block is drift — it'll go stale and diverge.
4. **Size check**: Target is 30–60 lines. If it's grown past that, it's accumulating content that belongs in docs files.
5. **Custom sections**: Preserve non-template sections (team conventions, project-specific onboarding) unless they're clearly obsolete. Don't wipe them during a refresh.

---

### Step 4 — Avoid hollow docs (the key discipline)

The `/opencode-coder/docs` workflow has an explicit rule: **do not create a topic doc for a skill-only topic**. Instead, route AGENTS directly to the skill.

Practical pattern for AGENTS.md routing when a doc *should not* exist:

```markdown
## Testing

Load the **jest-patterns** skill for test conventions and commands.
```

vs. the hollow-doc anti-pattern:

```markdown
## Testing

Read `docs/TESTING.md` for test patterns.
```

...where `docs/TESTING.md` just says "use Jest and run `npm test`."

The second form looks complete but provides no real value and will drift.

---

### Step 5 — Refresh or repair (Phase 3/4)

Once you have classifications and have audited AGENTS:

- **For stale docs**: Update in-place. Preserve project-specific sections; replace generic content with skill routes.
- **For hollow docs**: Delete the file, update AGENTS to route to the skill (or remove the section if there's no skill either).
- **For missing docs with real content**: Create minimally — only the project-specific substance, no boilerplate padding.
- **For AGENTS routing**: Rewrite broken links. Remove sections for deleted docs. Add skill routes for skill-only topics.

---

### Step 6 — Verify before calling it done (Phase 7)

Before marking complete:

- Every path referenced in AGENTS actually exists
- No skill is referenced that isn't installed
- Skill-only topics are routed to skills, not implied to have a missing doc
- No doc file is under ~10 substantive lines (that's hollow)
- AGENTS is under 60 lines
- Mode-path consistency: team docs aren't referenced from a stealth AGENTS

---

### The one-sentence rule for doc vs. skill

> **If you removed everything project-specific from the doc and it still made sense, it belongs in a skill, not a doc.**

That test catches most hollow docs before they're written.
