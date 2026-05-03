# Bug Reporting (Plugin/Runtime)

Guide for reporting opencode-coder plugin/runtime issues with actionable evidence.

## What belongs here

Report plugin/runtime problems such as:

- plugin not loading or unexpectedly inactive
- command/skill runtime exposure failures
- plugin startup/configuration regressions
- runtime behavior that contradicts expected mode semantics

Do not use this flow for unrelated project-code bugs.

## Before reporting

1. Reproduce once with debug logging enabled.
2. Capture expected vs actual behavior.
3. Gather minimal reproduction steps.
4. Collect relevant runtime logs and environment details.

## Evidence checklist

Include:

1. affected component/surface
2. expected vs actual behavior
3. concise reproduction steps
4. environment (OS, `node --version`, `npm --version`, plugin build/version if known)
5. relevant log excerpts
6. optional session export when conversation/tool-chain context matters

## Helpful collection paths

- Debug logs: [debugging-logs.md](debugging-logs.md)
- Session export: [session-dump.md](session-dump.md)

Optional diagnostics bundle for runtime/setup evidence:

```bash
bun run diagnostics:collect
```

## Report destination

GitHub repository:

```text
https://github.com/dynatrace-oss/opencode-coder
```

Keep reports focused: one issue per problem, specific title, sanitized attachments.

If you need tracker filing/follow-up workflow guidance, use the `coder-beads` skill.
