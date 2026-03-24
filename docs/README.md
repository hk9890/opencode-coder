# Documentation Map

This repository has multiple kinds of markdown files. They do **not** all have the same status.

Use this index to decide which docs are canonical operating guidance and which are reference, history, or artifacts.

## Canonical Operating Docs

These are the default project-memory docs for day-to-day work.

| File | Purpose | Load when |
|---|---|---|
| `../AGENTS.md` | Agent routing and critical session rules | Starting any task in the repo |
| `../README.md` | User-facing project overview and install path | Understanding plugin usage or entrypoints |
| `../CONTRIBUTING.md` | Contributor setup and baseline workflow | Onboarding or preparing a PR |
| `OVERVIEW.md` | Project identity, concepts, repo map | Understanding what the repo does |
| `CODING.md` | Safe change guidance and architecture boundaries | Editing code, resources, or repo workflows |
| `TESTING.md` | Test selection and execution guidance | Verifying any change |
| `RELEASING.md` | Repo-specific release rules | Cutting or validating a release |
| `MONITORING.md` | Logs, diagnostics, and evidence workflow | Debugging incidents or runtime behavior |
| `PULL-REQUESTS.md` | Branch, PR, review, and merge rules | Opening or reviewing a PR |

These files should stay concise, current, and strongly scoped.

## Secondary Reference Docs

These are useful supporting docs, but they are not the default operating layer for every task.

| Path | Purpose |
|---|---|
| `user-guide/` | End-user setup and usage guidance |
| `user-guide/project-setup.md` | Recommended project-doc structure |
| `user-guide/project-doc-guidelines.md` | What each canonical project doc should contain |
| `design/how-to-write-commands.md` | Active contributor reference for command-authoring conventions |
| `design/*-skill-design.md` | Design notes or planning references for specific skills |

Use these when the task specifically needs deeper context.

## Notes, Archive, and Evidence Docs

These are valuable, but they are **not** default policy docs.

| Path | What it is |
|---|---|
| `brainstorming/` | Exploration, proposals, and thinking history |
| `testing/` | Smoke reports, evidence files, and validation artifacts |
| parts of `design/` | Design history that may no longer reflect current implementation |

Do not treat these files as canonical operating rules unless a task explicitly asks for them.

## How to Use This Taxonomy

- If a canonical doc and a note/history doc disagree, the canonical doc wins.
- If a secondary reference becomes required operational guidance, promote the rule into a canonical doc.
- If a brainstorming or evidence doc contains an important durable rule, move that rule into the right canonical doc.
- Keep `AGENTS.md` small: route to canonical docs instead of copying their content.

## Related Guidance

- [Project overview](OVERVIEW.md)
- [Project setup guide](user-guide/project-setup.md)
- [Project doc guidelines](user-guide/project-doc-guidelines.md)
