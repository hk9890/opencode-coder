---
description: Inspect, bootstrap, refresh, audit, and verify project docs lifecycle
---

# Project Docs Lifecycle

Use `/opencode-coder/docs` when you want help setting up, reviewing, refreshing, repairing, slimming, or verifying a project's docs and AGENTS routing.

## Task

Load the `opencode-coder` skill, then use:

- `references/project-structure.md`
- `references/project-docs-lifecycle.md`

Then help with the project's docs lifecycle:

1. Resolve the active mode and canonical paths before changing anything.
   - team → `AGENTS.md`, `docs/`
   - stealth → `.coder/AGENTS.md`, `.coder/docs/`

2. Inspect the current docs state before proposing edits.
   - Check whether AGENTS exists at the active path.
   - Check whether the active docs directory exists.
   - Check which standard topic docs already exist.
   - Check whether installed skills should be routed through AGENTS instead of duplicated in local docs.

3. Choose the lifecycle work that matches the repo state or the user's request.
   - bootstrap when no lifecycle-aligned baseline exists yet
   - refresh when docs already exist and need normal maintenance
   - audit when links, routing, references, or coverage look stale or broken
   - slim when docs are oversized or noisy
   - AGENTS refresh as one phase within the docs lifecycle when routing needs to be updated

4. Apply only the phases the project actually needs.
   - Create docs only when they contain real project-specific guidance.
   - Do not create hollow topic docs for skill-only topics.
   - Keep AGENTS concise and routing-oriented.

5. Finish with verification and a concise report.

## Report

Summarize:

- mode and active paths used
- phases executed
- files created or updated
- files skipped (and why)
- topics routed through skills instead of local docs
- any unresolved follow-ups

## Requirements

- Always inspect before editing.
- Use the lifecycle rules in `references/project-docs-lifecycle.md` as the source of truth.
- Treat AGENTS maintenance as part of the same docs lifecycle work.
