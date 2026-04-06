# Session Dump Workflow

Use this workflow to export the current OpenCode session for diagnostics/support.

## Steps

1. Run `coder session` and capture the session ID.
2. Export with `coder session-export private/session-dump/<session-id>`.
3. Confirm `private/session-dump/<session-id>/session.json` exists.

## Report back

Include:

- session ID
- export path
- confirmation of successful export
- privacy warning that exports may include sensitive data and must be reviewed before sharing
