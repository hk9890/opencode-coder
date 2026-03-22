---
description: Turn a documentation/routing incident into targeted recurrence-prevention updates
---

# Incident-Driven Docs Improvement

Use `/opencode-coder/improve-doc` when something went wrong because guidance was missing, unclear, stale, or routed incorrectly.

## Task

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

## Dispatcher Flow (thin)

### 1) Normalize incident inputs

- Capture the free-text context when provided.
- Capture issue/reference ID when provided.
- If issue/reference is present, fetch incident context from the tracker.
- If context is still incomplete, ask focused follow-up questions for what failed and where guidance was expected.

### 2) Dispatch to shared incident-improvement lifecycle

Run the incident-improvement workflow in `references/project-docs-lifecycle.md`.

Do not duplicate lifecycle decision logic here.

### 3) Return recurrence-prevention plan

Summarize:

- root cause of why current docs/routing failed
- destination of fixes (project doc, AGENTS routing, skill/reference, or combination)
- concrete updates proposed/applied to prevent recurrence
- open follow-ups (if any)

## Rules

- This command is for incident-driven recurrence prevention.
- It is **not** a generic typo/grammar/editorial cleanup command.
- Keep this file as a dispatcher; lifecycle logic stays in `references/project-docs-lifecycle.md`.
