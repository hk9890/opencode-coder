# Reporting Issues

Complete guide for reporting bugs and issues with the opencode-coder plugin.

## Table of Contents

1. [What to Report](#what-to-report)
2. [Before Reporting](#before-reporting)
3. [Information to Include](#information-to-include)
4. [Creating a GitHub Issue](#creating-a-github-issue)
   - [Collecting System Information](#collecting-system-information)
   - [Session Export](#session-export)
5. [Issue Classification](#issue-classification)
6. [Getting Help](#getting-help)

---

## What to Report

When you encounter problems with the opencode-coder plugin itself (not your project code), you can report them to the plugin maintainers.

**Report issues with:**
- bd CLI commands and behavior
- Knowledge-base loading and commands
- Beads agents (planner, task, review, verify)
- Plugin documentation gaps
- Plugin features not working as expected

**Do NOT report:**
- Your own code bugs
- Build/test failures in your project
- General coding mistakes
- Configuration issues with your project

---

## Before Reporting

1. **Enable debug logging** (see the Debug Logging guide)
2. **Run health checks** (see the Status & Health Checks guide)
3. **Collect information**:
   - What command or feature you were using
   - What you expected to happen
   - What actually happened
   - Error messages or outputs
   - Steps to reproduce (if known)

---

## Information to Include

A good bug report includes:

1. **Component**: What part of the plugin (bd CLI, agent, command)
2. **Expected behavior**: What should have happened
3. **Actual behavior**: What actually happened
4. **Steps to reproduce**: How to trigger the issue
5. **Environment**:
   - Operating system
   - Node.js version (`node --version`)
   - bd version (`bd --version`)
   - Plugin version
6. **Logs**: Relevant log excerpts with debug logging enabled
7. **Context**: What you were trying to accomplish

---

## Creating a GitHub Issue

Issues should be reported to: https://github.com/dynatrace-oss/opencode-coder

### Bug Report Template

A structured template is bundled at [`../assets/bug-report-template.md`](../assets/bug-report-template.md) to help you include all necessary information.

> **Tip**: For complex issues that are hard to reproduce, consider including a session export (see Session Export section below) to provide full context of what happened.

### Choosing Evidence: Session Export vs Diagnostics Bundle

Use this quick rule:

- **Session export only** (`session.json`) when the main question is about one specific conversation flow/tool-call chain.
- **Diagnostics bundle** when the issue may involve runtime setup, plugin loading, logs, or environment/project context.
- **Both** for hard-to-reproduce failures: include a session export and run diagnostics with the session ID.

Project-level diagnostics collection (works without requiring a special plugin runtime command):

```bash
bun run diagnostics:collect
```

Session-focused bundle with an existing export:

```bash
bun run diagnostics:collect \
  --session=<session-id> \
  --session-export=private/session-dump/<session-id>
```

What to attach/share from diagnostics collection:

1. `manifest.json` (required; lists what was included/missing)
2. `README.md` (privacy checklist + human summary)
3. Session export JSON(s), if included and sanitized
4. Relevant log extracts from the bundle

### Collecting System Information

**Automated Collection:**

Run the helper script to automatically collect system information.
Replace `<skill-dir>` with the directory that contains this skill bundle:

```bash
bash <skill-dir>/scripts/collect-system-info.sh
```

This script collects:
- Operating system and version
- Node.js and npm versions
- bd CLI version
- Working directory
- Shell type
- Saved plugin mode (if `.coder/opencode-coder.yaml` exists)
- `bd doctor` output (if `.beads/` exists)

Copy the output and paste it into the Environment section of your bug report. If you also need plugin version/build details, use the AI-assisted or manual collection paths below.

**AI-Assisted Collection:**

When working with an AI assistant that has the opencode-coder plugin loaded, you can use the `coder` tool to collect information:

```
coder("version")   # Plugin version and build info
coder("plugin")    # Plugin loading status and configuration
coder("beads")     # Beads configuration and .beads/ status
coder("logs")      # Log directory location and available logs
```

The assistant can include this information directly in your bug report.

**Manual Collection:**

If you prefer to collect information manually:

```bash
# Operating System
uname -a                           # Linux/macOS
# or: systeminfo                   # Windows

# Node.js version
node --version

# bd CLI version
bd --version

# Plugin version
npm list opencode-coder

# Shell
echo $SHELL

# bd health check (if using beads)
bd doctor
```

### Session Export

For complex issues that are hard to reproduce or describe, you can export your entire session. This captures all messages, tool calls, and file changes made during the session.

**When to use session export:**
- Issue is hard to reproduce manually
- Multiple steps or interactions led to the problem
- You need to show exactly what happened, not just describe it
- The AI assistant made unexpected decisions

If you also need runtime/environment evidence (plugin logs, project context, OpenCode
session/log index), pair session export with diagnostics collection as shown above.

**How to export:**

Ask your AI assistant to export the session:

```
coder("session")                                    # Get current session ID
coder("session-export private/session-dump/<id>")  # Export to private directory
```

The export creates a `session.json` file containing:
- All messages exchanged during the session
- Every tool call and its result
- Token usage and cost information
- File diffs showing changes made

**Privacy considerations:**

> **Important**: Review the exported session data before sharing. The export may contain:
> - File contents from your project
> - Environment information
> - Paths and directory structures
> - Any sensitive data discussed in the session
>
> Sanitize or redact sensitive information before attaching to a bug report.

**Including in your report:**

For issues reported via GitHub:
1. Export the session to a private directory
2. Review the JSON for sensitive data
3. Either attach the file or include relevant excerpts
4. Reference the session in your bug report description

For diagnostics bundles, additionally:
5. Attach or link `manifest.json` and `README.md`
6. Mention any artifacts marked missing/error in the manifest so maintainers understand collection limits

### Quick Report Pattern

For simple, easily reproducible issues:

**Manual Issue Creation:**

1. Visit https://github.com/dynatrace-oss/opencode-coder/issues/new
2. Use a descriptive title with component in brackets:
   - `[bd ready] Returns empty when issues exist`
   - `[plugin] Knowledge-base fails to load custom commands`
   - `[agent] Task agent doesn't follow closing rules`
3. Fill in the key sections: Problem, Steps to Reproduce, Environment

**Using gh CLI:**

```bash
gh issue create --repo dynatrace-oss/opencode-coder \
  --title "[bd ready] Returns empty when issues exist" \
  --body "$(cat <<'EOF'
## Problem
Running `bd ready` returns no results even though open issues exist in .beads/

## Steps to Reproduce
1. Create issues with `bd create --title="Test" --type=task`
2. Verify issues exist with `bd list --status=open`
3. Run `bd ready`
4. No issues shown

## Environment
- OS: Ubuntu 22.04
- Node.js: v24.14.0
- bd version: 1.2.3
- Plugin version: 1.0.0

## Expected
Should show unblocked issues

## Actual
Returns empty list
EOF
)"
```

### Detailed Report Pattern

For complex issues requiring logs, reproduction steps, or additional context:

**Using the Bug Report Template:**

```bash
# Copy the template
cp <skill-dir>/assets/bug-report-template.md /tmp/bug-report.md

# Collect system info
bash <skill-dir>/scripts/collect-system-info.sh > /tmp/system-info.txt

# Edit the template, fill in all sections, paste system info
# Then create the issue

gh issue create --repo dynatrace-oss/opencode-coder \
  --title "[component] Short description" \
  --body-file /tmp/bug-report.md
```

**With Session Export (for complex issues):**

If the issue is hard to reproduce or involves complex AI assistant interactions:

```bash
# Ask the AI assistant to export the session first:
# coder("session-export private/session-dump/<session-id>")

# Review and sanitize the export
# Then include in your bug report

gh issue create --repo dynatrace-oss/opencode-coder \
  --title "[component] Short description" \
  --body "$(cat <<'EOF'
## Problem
[Description of the issue]

## Session Export
A session export is attached showing the full interaction.
See: private/session-dump/<session-id>/session.json

[Include relevant excerpts or attach the file]
EOF
)"
```

**Complete Example:**

```bash
gh issue create --repo dynatrace-oss/opencode-coder \
  --title "[agent] Task agent creates duplicate commits" \
  --body "$(cat <<'EOF'
## Problem
The tasker agent is creating duplicate git commits when closing tasks, resulting in redundant commit history.

## Expected Behavior
Task agent should create a single commit when closing a task, following the git safety protocol.

## Actual Behavior
Two identical commits are created for each task closure:
- First commit: "Implement feature X"
- Second commit: "Implement feature X" (duplicate)

## Steps to Reproduce
1. Create a task: `bd create --title="Test feature" --type=task`
2. Invoke task agent via OpenCode
3. Agent implements the task and closes it
4. Check git log: `git log --oneline -10`
5. Observe duplicate commits

## Environment
- OS: Ubuntu 22.04 LTS
- Node.js: v24.14.0
- bd CLI: 1.2.3
- Plugin: opencode-coder@1.0.0
- Shell: bash 5.1.16

## Logs

Debug logging enabled with `OPENCODE_CODER_DEBUG=1`

```
[opencode-coder:task-agent] Starting task execution for beads-xxx
[opencode-coder:task-agent] Changes detected, creating commit
[opencode-coder:git] Running: git add src/feature.ts
[opencode-coder:git] Running: git commit -m "Implement feature X"
[opencode-coder:git] Commit successful: a1b2c3d
[opencode-coder:task-agent] Task complete, closing beads-xxx
[opencode-coder:git] Running: git add src/feature.ts
[opencode-coder:git] Running: git commit -m "Implement feature X"
[opencode-coder:git] Commit successful: e4f5g6h
```

## Additional Context

This appears to happen consistently when:
- Task agent makes code changes
- No pre-commit hooks are configured
- Git status is clean before agent starts

Git log output:
```
e4f5g6h Implement feature X
a1b2c3d Implement feature X
```

Workaround: Manually squash duplicate commits with `git rebase -i HEAD~2`

Related: This might be connected to the session close protocol in AGENTS.md
EOF
)"
```

### Tips for Effective Bug Reports

1. **Use descriptive titles**: Include the component and a clear summary
   - Good: `[bd dolt push] Fails when .beads/ has merge conflicts`
   - Bad: `Sync doesn't work`

2. **Enable debug logging BEFORE reproducing**:
   ```bash
   export OPENCODE_CODER_DEBUG=1
   # Then reproduce the issue
   ```

3. **Include minimal reproduction steps**: The fewer steps, the easier to diagnose

4. **Attach relevant files**: If the issue involves configuration files, include sanitized versions

5. **Search existing issues**: Your issue might already be reported or resolved

6. **One issue per report**: Don't combine multiple unrelated problems

7. **Follow up**: If maintainers ask for more information, provide it promptly

---

## Issue Classification

Before creating an issue, determine if it's a plugin issue or a project issue:

**Plugin Issues** (create GitHub issue):
| Category | Examples |
|----------|----------|
| bd CLI errors | Command not found, invalid arguments, unexpected failures |
| Plugin errors | Knowledge-base loading failures, command execution failures |
| Agent behavior | Wrong actions, poor responses from beads agents |
| Documentation gaps | Unclear instructions, missing examples in plugin docs |

**Project Issues** (do NOT create GitHub issue):
| Category | Examples |
|----------|----------|
| User code bugs | Errors in your own source files |
| Build/test failures | npm/yarn errors, test failures in your project |
| Configuration issues | Your own config files, environment setup |
| General coding | Syntax errors, logic bugs in your code |

---

## Getting Help

If you're unsure whether something is a plugin issue:
1. Ask in the session: "Is this a plugin issue or a project issue?"
2. Run health checks to verify plugin setup
3. Check the troubleshooting guides
4. Create a GitHub discussion for questions: https://github.com/dynatrace-oss/opencode-coder/discussions
