# Session dump workflow

Use this workflow to export the current OpenCode session for diagnostics or support.

## Steps

1. Run `coder session` and capture the current session ID.
2. Export using `coder session-export private/session-dump/<session-id>`.
3. Confirm `private/session-dump/<session-id>/session.json` exists.

## Output

Report:

- session ID
- export path
- confirmation that export completed
- privacy warning that the export may include sensitive project or environment data and must be reviewed before sharing
