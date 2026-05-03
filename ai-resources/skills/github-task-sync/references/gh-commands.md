# GitHub CLI Commands Reference

Complete reference for all `gh` CLI commands used in GitHub task synchronization.

## Table of Contents

- [Prerequisites Commands](#prerequisites-commands)
- [Import Commands](#import-commands)
- [Export Commands](#export-commands)
- [Update Commands](#update-commands)
- [Error Handling Patterns](#error-handling-patterns)
- [Command Cheat Sheet](#command-cheat-sheet)
- [Integration with Beads](#integration-with-beads)

## Prerequisites Commands

### Check Authentication Status

```bash
gh auth status
```

**Purpose**: Verify GitHub CLI is authenticated

**Output**: Authentication status and username

**Error codes**:
- Exit 0: Authenticated
- Exit 1: Not authenticated

**Error handling**: If fails, prompt user to run `gh auth login`

### Get Current Repository

```bash
gh repo view --json nameWithOwner -q '.nameWithOwner'
```

**Purpose**: Detect GitHub repository from git remote

**Output**: Repository in format `owner/repo` (e.g., `dynatrace-oss/opencode-coder`)

**Error codes**:
- Exit 0: Repository found
- Exit 1: Not in git repo or no GitHub remote

**Error handling**: If fails, prompt user to check `git remote -v` and add GitHub remote

<a id="import-commands"></a>
## Import Commands (GitHub → Beads)

### List Open Issues

```bash
gh issue list --repo $REPO --state open --json number,title,body,labels,createdAt --limit 100
```

**Purpose**: Fetch all open GitHub issues for import

**Parameters**:
- `--repo $REPO`: Target repository (owner/repo format)
- `--state open`: Only fetch open issues
- `--json <fields>`: Return structured JSON output
- `--limit 100`: Maximum issues to fetch (default)

**Output**: JSON array of issue objects

**Output format**:
```json
[
  {
    "number": 123,
    "title": "Fix login timeout",
    "body": "Users experiencing timeout after 30 seconds...",
    "labels": [
      {"name": "bug"},
      {"name": "high"}
    ],
    "createdAt": "2026-02-01T10:00:00Z"
  }
]
```

**Error scenarios**:
- Rate limiting: `API rate limit exceeded` - wait ~60 min or authenticate for higher limit
- Repository not found: `404 Not Found` - check repo name
- Issues disabled: `Issues are disabled for this repository`
- Network error: Connection timeout/refused

**Check rate limit**:
```bash
gh api rate_limit
```

### View Single Issue

```bash
gh issue view <number> --repo $REPO --json state,title,body,labels,closedAt
```

**Purpose**: Fetch detailed information for specific issue (used in conflict detection)

**Parameters**:
- `<number>`: GitHub issue number
- `--repo $REPO`: Target repository
- `--json <fields>`: Structured output

**Output**: JSON object with issue details

**Output format**:
```json
{
  "state": "OPEN",
  "title": "Fix login timeout",
  "body": "Description...",
  "labels": [{"name": "bug"}],
  "closedAt": null
}
```

**States**: `OPEN` or `CLOSED`

<a id="export-commands"></a>
## Export Commands (Beads → GitHub)

### Create Issue

```bash
gh issue create --repo $REPO \
  --title "Issue title" \
  --body "Issue description" \
  --label "priority-label" \
  --label "type-label" \
  --label "beads:<bead-id>"
```

**Purpose**: Create new GitHub issue from bead

**Parameters**:
- `--repo $REPO`: Target repository
- `--title "..."`: Issue title (required)
- `--body "..."`: Issue description (optional, but recommended)
- `--label "..."`: Add label (can use multiple times)

**Output**: Success message with issue URL

**Output format**:
```
Created issue owner/repo#123
https://github.com/owner/repo/issues/123
```

**Extracting issue number**:
Parse output to extract `#123` from `owner/repo#123`

**Using heredoc for multi-line body**:
```bash
gh issue create --repo $REPO \
  --title "Fix timeout" \
  --body "$(cat <<'EOF'
Multi-line description
with formatting

- Bullet points
- Preserved
EOF
)" \
  --label "bug" \
  --label "high"
```

**Error scenarios**:
- Permission denied: `403 Forbidden` - no write access to repository
- Issues disabled: Repository doesn't have issues enabled
- Invalid label: Label doesn't exist in repository (non-fatal, issue created without label)

<a id="update-commands"></a>
## Update Commands (Bidirectional Sync)

### Close Issue

```bash
gh issue close <number> --repo $REPO --comment "Closed via beads sync"
```

**Purpose**: Close GitHub issue when corresponding bead is closed

**Parameters**:
- `<number>`: GitHub issue number to close
- `--repo $REPO`: Target repository
- `--comment "..."`: Optional closing comment

**Output**: Success message

**Output format**:
```
✓ Closed issue #123
```

**Error scenarios**:
- Already closed: Non-fatal, command succeeds
- Issue not found: `404 Not Found`
- Permission denied: `403 Forbidden`

### Reopen Issue

```bash
gh issue reopen <number> --repo $REPO
```

**Purpose**: Reopen closed GitHub issue (rare, used in conflict resolution)

**Parameters**:
- `<number>`: GitHub issue number to reopen
- `--repo $REPO`: Target repository

**Output**: Success message

**Error scenarios**:
- Already open: Non-fatal, command succeeds
- Issue not found: `404 Not Found`

### Add Comment

```bash
gh issue comment <number> --repo $REPO --body "Comment text"
```

**Purpose**: Add comment to existing GitHub issue

**Parameters**:
- `<number>`: GitHub issue number
- `--repo $REPO`: Target repository
- `--body "..."`: Comment text

**Output**: Success message with comment URL

**Multi-line comment**:
```bash
gh issue comment 123 --repo $REPO --body "$(cat <<'EOF'
Multi-line comment
with formatting
EOF
)"
```

### Edit Issue

```bash
gh issue edit <number> --repo $REPO \
  --title "New title" \
  --body "New description" \
  --add-label "new-label" \
  --remove-label "old-label"
```

**Purpose**: Update existing GitHub issue (used in conflict resolution)

**Parameters**:
- `<number>`: GitHub issue number
- `--title "..."`: Update title (optional)
- `--body "..."`: Update description (optional)
- `--add-label "..."`: Add label (optional, repeatable)
- `--remove-label "..."`: Remove label (optional, repeatable)

**Note**: Only specified fields are updated, others remain unchanged

## Error Handling Patterns

### Authentication Errors

**Error**: `gh: command not found`
```
Solution: Install gh CLI from https://cli.github.com
```

**Error**: `To authenticate, please run: gh auth login`
```
Solution: Run `gh auth login` and follow interactive prompts
```

**Error**: `authentication token expired`
```
Solution: Re-authenticate with `gh auth refresh`
```

### API Errors

**Error**: `API rate limit exceeded`
```
Cause: Too many requests (60/hour unauthenticated, 5000/hour authenticated)
Solution: Wait or authenticate for higher limit
Check: gh api rate_limit
```

**Error**: `404 Not Found`
```
Cause: Repository or issue doesn't exist, or no access
Solution: Verify repository name and access permissions
```

**Error**: `403 Forbidden`
```
Cause: No permission to perform action
Solution: Check repository permissions, may need write access
```

**Error**: `422 Unprocessable Entity`
```
Cause: Invalid data (e.g., invalid label, malformed input)
Solution: Check command parameters, validate label names
```

### Network Errors

**Error**: `dial tcp: i/o timeout`
```
Cause: Network connectivity issue
Solution: Check internet connection, try again
```

**Error**: `failed to connect to github.com`
```
Cause: Firewall, proxy, or GitHub outage
Solution: Check network, verify GitHub status at https://www.githubstatus.com/
```

## Command Cheat Sheet

| Operation | Command |
|-----------|---------|
| List open issues | `gh issue list --repo $REPO --state open --json number,title,body,labels` |
| View issue | `gh issue view <num> --repo $REPO --json state,title,body` |
| Create issue | `gh issue create --repo $REPO --title "..." --body "..." --label "..."` |
| Close issue | `gh issue close <num> --repo $REPO --comment "..."` |
| Reopen issue | `gh issue reopen <num> --repo $REPO` |
| Add comment | `gh issue comment <num> --repo $REPO --body "..."` |
| Edit issue | `gh issue edit <num> --repo $REPO --title "..." --body "..."` |
| Check auth | `gh auth status` |
| Get repo | `gh repo view --json nameWithOwner -q '.nameWithOwner'` |
| Rate limit | `gh api rate_limit` |

## Integration with Beads

### Label Extraction

Extract GitHub issue number from beads label:

```bash
# Get all beads with github labels
bd list --json | jq -r '.[] | select(.labels[]? | startswith("github:")) | {id, github: (.labels[] | select(startswith("github:")))}'
```

### Issue Number Parsing

From label `github:123`, extract `123`:

```bash
LABEL="github:123"
NUMBER=${LABEL#github:}  # Result: 123
```

Or with jq:
```bash
NUMBER=$(echo "github:123" | sed 's/github://')
```
