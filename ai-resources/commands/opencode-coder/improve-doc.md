---
description: Turn a documentation/routing incident into targeted recurrence-prevention updates
---

# Incident-Driven Docs Improvement

Use `/opencode-coder/improve-doc` when something went wrong because guidance was missing, unclear, stale, or routed incorrectly.

## Workflow

Load the `opencode-coder` skill, then use:

- `references/project-structure.md`
- `references/project-docs-lifecycle.md` (incident-improvement section)

## Input Contract (explicit)

This command accepts either or both:

1. **Optional free-text failure context** (command argument)
   - Example: `/opencode-coder/improve-doc "forgot to run validate-before-release.sh"`
2. **Optional issue/reference identifier** (issue-reference pattern)
   - Example: `/opencode-coder/improve-doc --issue opencode-coder-123`
   - Equivalent reference patterns are acceptable if they clearly identify a tracked issue.

If neither input is useful, prompt with `question()` for failure context and (optionally) an issue/reference ID before continuing.

## Task

Turn the incident into targeted documentation improvement work:

1. Capture the incident clearly.
   - Use the free-text context when provided.
   - Use the issue/reference when provided.
   - If context is incomplete, ask focused follow-up questions about what failed, where it failed, and where guidance was expected.

2. Follow the incident-improvement workflow in `references/project-docs-lifecycle.md`.
   - Inspect the relevant docs and routing first.
   - Determine whether the missing guidance belongs in a project doc, AGENTS routing, a skill/reference, or a combination.
   - Focus on recurrence prevention rather than cosmetic edits.

3. Propose or apply the smallest useful updates that would have prevented the incident.

4. Verify the resulting guidance is discoverable and correctly routed.

## Report

Summarize:

- root cause of why current docs/routing failed
- destination of fixes (project doc, AGENTS routing, skill/reference, or combination)
- concrete updates proposed/applied to prevent recurrence
- open follow-ups (if any)

## Requirements

- This command is for incident-driven recurrence prevention.
- It is **not** a generic typo/grammar/editorial cleanup command.
- Use mode-correct docs and AGENTS paths from `references/project-structure.md`.
