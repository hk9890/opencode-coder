---
description: Report issues with the opencode-coder plugin
---

# Coder Feedback

> **Purpose**: Report issues with the **opencode-coder plugin itself** - NOT general project issues.

## Task

Load the `opencode-coder` skill, then use its bug-reporting guidance to:

```
skill({ name: "opencode-coder" })
```

1. Classify the problem.
   - Decide whether this is a plugin issue or only a project issue.
   - If it is only a project issue, explain that clearly and do not create a GitHub issue.

2. Gather the evidence needed for a strong plugin report.
   - component or command involved
   - expected behavior
   - actual behavior
   - reproduction steps
   - error messages, logs, diagnostics, or session export details when relevant

3. Show the draft report to the user.
   - Clearly separate plugin issues from project issues.
   - Ask for confirmation before creating any GitHub issue.

4. If the user confirms, create the GitHub issue(s).
   - Use `gh issue create --repo dynatrace-oss/opencode-coder`.
   - Create one issue per distinct plugin problem.
   - Use the bundled template or other skill guidance when it improves the report.

## Requirements

- Do not file GitHub issues for the user's own project bugs.
- Ask before creating issues.
- Prefer high-signal evidence over vague summaries.
- If multiple unrelated plugin problems are found, split them into separate issues.
