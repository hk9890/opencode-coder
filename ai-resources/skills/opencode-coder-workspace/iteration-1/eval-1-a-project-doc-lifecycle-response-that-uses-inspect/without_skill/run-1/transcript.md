# Validation Transcript

## Mode

without_skill

## Eval Prompt

Assume I'm in a team-mode repo where AGENTS.md and docs may be stale. Walk me through an /opencode-coder/docs style audit-and-refresh approach that decides what should stay in project docs versus what should route to reusable skills, and avoid creating hollow docs.

## Tool Calls

1. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/commands/opencode-coder/docs.md"}`
2. **Glob** `{"pattern": "ai-resources/skills/**/*.md", "path": "/home/hans/dev/github/opencode-coder"}`
3. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/project-docs-lifecycle.md"}`
4. **Read** `{"file_path": "/home/hans/dev/github/opencode-coder/ai-resources/skills/opencode-coder/references/project-structure.md"}`

## Final Response

Let me look at the relevant files first.

Here's the complete mental model for the audit-and-refresh approach:

---

## The Core Decision Framework

The entire approach is built on one rule: **a local doc must earn its existence**. If the only content it would have is generic workflow that a skill already covers, don't create it — route to the skill instead. A hollow doc is worse than no doc: it implies authoritative guidance exists, so agents read it, find nothing project-specific, and waste context.

---

## Phase 0: Resolve Mode and Paths First

Before touching anything, determine the active mode from `.coder/opencode-coder.yaml`:

| Mode | AGENTS lives at | Docs live at |
|---|---|---|
| team | `AGENTS.md` | `docs/` |
| stealth | `.coder/AGENTS.md` | `.coder/docs/` |

This is non-negotiable. If you write to the wrong path in stealth mode, you contaminate the team's shared files.

---

## Phase 1: Inspect (the only safe starting point)

Discover what actually exists before proposing anything:

1. **Enumerate existing docs** at the active path
2. **Enumerate installed skills** under `.opencode/skills/`
3. **Classify every topic** in the standard set (`OVERVIEW`, `CODING`, `TESTING`, `RELEASING`, `MONITORING`, `PULL-REQUESTS`):
   - `doc-backed` — a local doc exists
   - `skill-only` — no local doc, but an installed skill covers it
   - `neither` — no local doc, no skill

This classification drives every decision downstream. You can't audit what you haven't mapped.

---

## The Central Routing Question

For each topic, ask: **"What would this local doc say that the skill doesn't already say?"**

| Answer | Action |
|---|---|
| Project-specific rules, paths, or constraints | Create/keep a local doc |
| Nothing — the skill covers it completely | Delete the local doc (or don't create one), route AGENTS to the skill |
| Some overlap but also real local content | Keep local doc, trim the generic parts, add a reference to the skill for the rest |

The stale AGENTS.md problem in team repos is almost always this: docs were created during bootstrap as placeholders, never filled in with real content, and then AGENTS kept routing to them as if they were authoritative.

---

## Phase 2-5: Choose the Right Phase

| Repo state | Right phase |
|---|---|
| No AGENTS, no lifecycle-aligned docs | Bootstrap — create minimal structure |
| Docs exist, links stale, skills installed but not routed | Audit/repair |
| Docs exist and current, normal maintenance | Refresh |
| Docs are oversized, inlining generic guidance | Slim |

**In a team-mode repo with stale AGENTS.md**, you almost always need **Audit** first:
1. Check every path AGENTS references — does it still exist?
2. Check every skill-covered topic — does AGENTS route to skill or to a hollow local doc?
3. Check for duplicated guidance between local docs and skill references

---

## Avoiding Hollow Docs: The Practical Test

Before creating or keeping any topic doc, apply this test:

```
If I deleted this file, would an agent lose any project-specific knowledge?
  YES → the doc has real content, keep it
  NO  → it's hollow, delete it and route AGENTS to the skill
```

The key phrase in `project-structure.md:90` is: **"Route that topic from AGENTS to the skill/workflow instead."** AGENTS becomes the routing layer; skills become the knowledge layer; local docs are only for what can't live in either of those places.

---

## What Stays in Project Docs vs. Skills

| Belongs in local docs | Belongs in skills |
|---|---|
| Project-specific commands (e.g., `./validate-before-release.sh`) | Generic workflow steps |
| Repo-specific branch naming rules | Standard PR workflow |
| Environment setup for this specific stack | Generic testing patterns |
| "For this repo, always X before Y" rules | Reusable release checklists |
| Known gotchas in this codebase | Standard troubleshooting flows |

Skills are portable across projects. Docs are project-scoped. When something applies to more than one project, it's a skill.

---

## Phase 6: AGENTS as a Routing Table, Not a Handbook

The design constraint in `project-structure.md:99` is exact: **AGENTS is a routing table, not a handbook.** The only things that belong inline are:
- Project overview (a few lines)
- "Landing the Plane" / session-close block

Everything else should be a pointer: `→ docs/TESTING.md` or `→ skill: github-releases`. If you find paragraphs of inline guidance in AGENTS, that's a slim candidate — either move it to a local doc (if project-specific) or delete it (if the skill already says it).

---

## Phase 7: Verify Before Closing

Every audit ends with a link-walk:
- Every path AGENTS references → does the file exist at that exact path?
- Every skill reference → is the skill actually installed?
- No dead links, no stale topic names, no retired command references

The report explicitly calls out topics routed through skills instead of local docs — this is the paper trail that proves you avoided hollow docs deliberately rather than just forgetting to create them.

---

## Practical Walk-through for Your Stale Team Repo

```
1. Read .coder/opencode-coder.yaml → confirm team mode
2. List docs/ → note what exists
3. List .opencode/skills/ → note installed skills
4. For each standard topic: classify doc-backed / skill-only / neither
5. For each doc-backed topic: apply the "delete test" above
6. For each skill-only topic: verify AGENTS routes to it, not to a hollow local doc
7. Read AGENTS.md → check every file reference still resolves
8. Trim/delete hollow docs, update AGENTS routing
9. Verify all paths, write report
```

The report is the accountability artifact — it says explicitly which topics route through skills, which local docs were kept and why, and which were removed because they had no project-specific content.
