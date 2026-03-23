---
description: Export full session data to private/session-dump/ folder
---

# Export Session Data

Use `/opencode-coder/dump-session` to export the current session's messages, tool calls, token usage, costs, and file diffs to a private local folder.

## Task

1. Call `coder session` to get the current session ID.
2. Export the session to `private/session-dump/<session-id>` with `coder session-export private/session-dump/<session-id>`.
3. Confirm that the export completed and that `session.json` was written.

## Report

Tell the user:

- the session ID
- the export path
- that the export may contain sensitive project or environment data and should be reviewed before sharing
