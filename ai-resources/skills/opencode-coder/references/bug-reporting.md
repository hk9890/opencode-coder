# Reporting Issues

Guide for reporting **plugin** bugs in opencode-coder clearly and with useful evidence.

## What to report

Report issues with plugin behavior, for example:

- `bd` CLI behavior in plugin workflows
- skill/command/agent loading and routing
- beads agent workflow behavior
- plugin docs gaps that block normal usage

Do **not** report your project-code bugs, local build/test failures unrelated to the plugin, or general coding mistakes.

## Before creating an issue

1. Reproduce once with debug logging enabled.
2. Run health checks (`bd doctor`, `/opencode-coder/status`).
3. Capture expected vs actual behavior and minimal reproduction steps.

## Evidence checklist

Include:

1. **Component** affected (command/skill/agent/runtime)
2. **Expected vs actual** behavior
3. **Reproduction steps**
4. **Environment**
   - OS
   - `node --version`
   - `bd --version`
   - plugin version/build (if available)
5. **Logs/diagnostics** relevant to the failure

## Collecting evidence

### Diagnostics bundle (preferred for runtime/setup issues)

```bash
bun run diagnostics:collect
```

With session context:

```bash
bun run diagnostics:collect \
  --session=<session-id> \
  --session-export=private/session-dump/<session-id>
```

Attach/share:

1. `manifest.json` (required)
2. `README.md` (privacy checklist + summary)
3. relevant logs and sanitized session export (if present)

### Session export (best for conversation/tool-chain failures)

Use when the issue is hard to explain without exact interaction history.

```text
coder("session")
coder("session-export private/session-dump/<id>")
```

Review `session.json` before sharing and redact sensitive data.

### System info helper

```bash
bash <skill-dir>/scripts/collect-system-info.sh
```

Use output for the Environment section.

## Creating the GitHub issue

Repository: https://github.com/dynatrace-oss/opencode-coder

Use bundled template:

```bash
cp <skill-dir>/assets/bug-report-template.md /tmp/bug-report.md
gh issue create --repo dynatrace-oss/opencode-coder \
  --title "[component] Short summary" \
  --body-file /tmp/bug-report.md
```

For quick reports:

```bash
gh issue create --repo dynatrace-oss/opencode-coder \
  --title "[component] Short summary" \
  --body "<problem, steps, expected, actual, environment>"
```

## Fast quality rules

- One issue per problem
- Title includes component and concrete symptom
- Prefer minimal reproducible steps
- Sanitize logs/session exports before sharing

If unsure whether it is a plugin issue, open a discussion first:
https://github.com/dynatrace-oss/opencode-coder/discussions
