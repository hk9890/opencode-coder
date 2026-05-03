# Error Handling Guide

Common error scenarios and resolutions for GitHub task synchronization.

## Table of Contents

- [Prerequisites Errors](#prerequisites-errors)
- [GitHub API Errors](#github-api-errors)
- [Network Errors](#network-errors)
- [Beads CLI Errors](#beads-cli-errors)
- [Sync-Specific Errors](#sync-specific-errors)
- [Error Recovery Patterns](#error-recovery-patterns)
- [Logging and Debugging](#logging-and-debugging)
- [Error Message Templates](#error-message-templates)

## Prerequisites Errors

### gh CLI Not Installed

**Error**: `command not found: gh` or `gh: command not found`

**Cause**: GitHub CLI not installed on system

**Solution**:
```
Install gh CLI from https://cli.github.com

Installation methods:
- macOS:   brew install gh
- Linux:   apt install gh  (Ubuntu/Debian)
           dnf install gh  (Fedora/RHEL)
- Windows: choco install gh
           winget install GitHub.cli

Manual install: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
```

**Resolution**: Install gh, then retry sync operation

### gh CLI Not Authenticated

**Error**: `To authenticate, please run: gh auth login`

**Cause**: gh CLI installed but user not logged in

**Solution**:
```
Run authentication:
  gh auth login

Follow interactive prompts:
1. Choose: GitHub.com
2. Choose: HTTPS or SSH
3. Choose: Login with a web browser or paste token
4. Complete authentication in browser

Verify:
  gh auth status
```

**Resolution**: Authenticate, then retry sync operation

### Authentication Token Expired

**Error**: `authentication token expired` or `401 Unauthorized`

**Cause**: GitHub authentication token expired (rare with modern gh CLI)

**Solution**:
```
Refresh authentication:
  gh auth refresh

Or re-authenticate:
  gh auth login
```

**Resolution**: Refresh token, then retry

### bd CLI Not Found

**Error**: `command not found: bd` or `bd: command not found`

**Cause**: Beads CLI not installed or not in PATH

**Solution**:
```
Check if beads is installed:
  which bd

If not found:
1. Install beads CLI (check beads documentation)
2. Add to PATH if needed
3. Verify: bd doctor
```

**Resolution**: Install/configure bd CLI, then retry

### Not in Beads Project

**Error**: `bd stats` fails with "no .beads directory found"

**Cause**: Current directory is not a beads-initialized project

**Solution**:
```
Option 1: Navigate to beads project directory
  cd /path/to/beads/project

Option 2: Initialize beads in current directory
  bd init --skip-agents

Verify:
  bd stats
```

**Resolution**: Ensure in beads project, then retry

### Repository Not Detected

**Error**: `Could not determine GitHub repository` or `gh repo view` fails

**Cause**: Not in a git repository with GitHub remote, or remote doesn't point to GitHub

**Solution**:
```
Check git remotes:
  git remote -v

If no remote exists:
  git remote add origin https://github.com/owner/repo.git

If remote exists but not GitHub:
  git remote set-url origin https://github.com/owner/repo.git

Verify:
  gh repo view
```

**Resolution**: Configure GitHub remote, then retry

## GitHub API Errors

### Rate Limiting

**Error**: `API rate limit exceeded` or `403: rate limit exceeded`

**Cause**: Too many API requests in short time period

**Rate limits**:
- Unauthenticated: 60 requests/hour
- Authenticated: 5,000 requests/hour
- Search API: 30 requests/minute

**Solution**:
```
Check current rate limit:
  gh api rate_limit

Output shows:
- limit: Maximum requests per hour
- remaining: Requests left in current window
- reset: Unix timestamp when limit resets

Wait until reset time, or:
1. Authenticate for higher limit (if unauthenticated)
2. Reduce request frequency
3. Batch operations when possible
```

**Resolution**: Wait for rate limit reset, then retry

**Prevention**:
- Check rate limit before large batch operations
- Add delays between API calls if processing many issues

### 404 Not Found

**Error**: `404 Not Found` when accessing repository or issue

**Possible causes**:

1. **Repository doesn't exist**
   ```
   Solution: Verify repository name
     gh repo view owner/repo
   ```

2. **No access to repository**
   ```
   Solution: Check permissions
   - Repository may be private
   - Your GitHub account may not have access
   - Request access from repository owner
   ```

3. **Issue doesn't exist**
   ```
   Solution: Verify issue number
     gh issue view <number> --repo owner/repo
   ```

4. **Issues disabled**
   ```
   Solution: Enable issues in repository settings
   - Go to repository Settings
   - Check "Issues" feature is enabled
   ```

### 403 Forbidden

**Error**: `403 Forbidden` or `Resource not accessible by personal access token`

**Possible causes**:

1. **No write permission**
   ```
   Cause: Read-only access to repository
   Solution: Need write or admin access to:
   - Create issues
   - Close issues
   - Edit issues
   Request permissions from repository owner
   ```

2. **Token scope insufficient**
   ```
   Cause: Authentication token lacks required scopes
   Solution: Re-authenticate with correct scopes
     gh auth refresh -s repo
   
   Required scopes:
   - repo (full repo access)
   - Or public_repo (for public repos only)
   ```

3. **Organization restrictions**
   ```
   Cause: Organization blocks certain operations
   Solution: Contact organization admin
   ```

### 422 Unprocessable Entity

**Error**: `422 Unprocessable Entity` or validation errors

**Common causes**:

1. **Invalid label**
   ```
   Error: Label 'xyz' does not exist
   Solution: 
   - Create label in GitHub first
   - Or omit the label from request
   - gh will auto-create some labels (like priority labels)
   ```

2. **Invalid field format**
   ```
   Error: Title cannot be empty
   Solution: Ensure required fields are populated
   - Title must not be empty string
   - Body can be empty (optional)
   ```

3. **Issue already closed**
   ```
   Error: Cannot close an already closed issue
   Solution: Check issue state first
     gh issue view <num> --json state
   Handle gracefully (already in desired state)
   ```

### 500 Internal Server Error

**Error**: `500 Internal Server Error` or `502 Bad Gateway`

**Cause**: GitHub API temporary issue or outage

**Solution**:
```
1. Check GitHub status:
   https://www.githubstatus.com/

2. Wait a few minutes and retry

3. If persistent, check:
   - GitHub incident reports
   - GitHub status API: gh api https://www.githubstatus.com/api/v2/status.json
```

**Resolution**: Usually temporary, retry after short delay

## Network Errors

### Connection Timeout

**Error**: `dial tcp: i/o timeout` or connection timeout

**Cause**: Network connectivity issues

**Solution**:
```
1. Check internet connection:
   ping github.com

2. Check DNS resolution:
   nslookup github.com

3. Try alternative network (mobile hotspot, VPN)

4. Check firewall rules blocking GitHub
```

### Connection Refused

**Error**: `connection refused` or `failed to connect`

**Possible causes**:

1. **Proxy/Firewall blocking**
   ```
   Solution: Configure proxy settings
     export HTTP_PROXY=http://proxy:port
     export HTTPS_PROXY=http://proxy:port
   ```

2. **VPN required**
   ```
   Solution: Connect to corporate VPN if required
   ```

3. **GitHub blocked**
   ```
   Solution: Check with network administrator
   ```

## Beads CLI Errors

### bd create Failed

**Error**: `Failed to create bead` or validation errors from bd

**Possible causes**:

1. **Invalid parameters**
   ```
   Error: Invalid priority value
   Solution: Use priority 0-4
     bd create --priority 1 ...
   ```

2. **Missing required fields**
   ```
   Error: Title required
   Solution: Always provide --title
     bd create --title "..." --type bug
   ```

3. **Database error**
   ```
   Error: Cannot write to .beads directory
   Solution: Check permissions
     ls -la .beads/
     chmod u+w .beads/
   ```

### bd list Failed

**Error**: `Failed to list beads` or JSON parsing errors

**Possible causes**:

1. **Corrupted database**
   ```
   Solution: Check .beads/ integrity
     bd doctor
   ```

2. **Invalid JSON query**
   ```
   Solution: Verify jq syntax
   Test: bd list --json | jq '.'
   ```

### bd update Failed

**Error**: `Failed to update bead` or `Bead not found`

**Possible causes**:

1. **Invalid bead ID**
   ```
   Solution: Verify bead exists
     bd show <id>
   ```

2. **Concurrent modification**
   ```
   Solution: Retry update
   Race conditions are rare in single-user context
   ```

## Sync-Specific Errors

### Duplicate Import Prevention

**Error**: Issue already exists in beads (not actually an error, expected behavior)

**Detection**:
```bash
# Check for existing github:123 label
bd list --json | jq '.[] | select(.labels[]? == "github:123")'
```

**Handling**: Skip import, log as "already imported", show in summary

### Label Parsing Failed

**Error**: Cannot extract GitHub issue number from label

**Cause**: Invalid label format or missing label

**Solution**:
```
Expected format: github:123
Validate before parsing:
  if [[ "$label" =~ ^github:[0-9]+$ ]]; then
    NUMBER=${label#github:}
  else
    echo "Warning: Invalid label format: $label"
  fi
```

### GitHub Issue Create Failed During Export

**Error**: Created GitHub issue but failed to update bead with label

**Impact**: GitHub issue created but beads doesn't have tracking label

**Handling**:
```
1. Show warning to user
2. Log GitHub issue number
3. Provide manual recovery command:
   bd update <bead-id> --label "github:<number>"
4. Continue with remaining exports
```

**Prevention**: Validate bead is writable before creating GitHub issue

### Conflict Resolution Failure

**Error**: User chose resolution but failed to apply

**Cause**: Network error, permission error, or API error during resolution

**Handling**:
```
1. Show what was successfully resolved
2. Show what failed with reason
3. Don't rollback successful resolutions
4. Offer to retry failed resolutions
5. Allow user to skip failed items
```

## Error Recovery Patterns

### Partial Import Failure

**Scenario**: Imported 10/15 issues, 5 failed

**Recovery**:
```
1. Show success summary (10 imported)
2. Show failure summary (5 failed with reasons)
3. Keep successful imports (don't rollback)
4. Log failed issue numbers
5. Allow user to retry failed imports manually
```

### Partial Export Failure

**Scenario**: Exported 5/8 beads, 3 failed

**Recovery**:
```
1. Show success summary (5 exported with GitHub URLs)
2. Show failure summary (3 failed with reasons)
3. Keep successful exports (don't rollback)
4. Mark failed beads for manual review
5. Provide commands to retry failed exports
```

### Network Interruption Mid-Sync

**Scenario**: Network drops during bidirectional sync

**Recovery**:
```
1. Determine which phase was interrupted (import/export/resolution)
2. Show progress up to interruption
3. Provide resume command/option
4. Don't re-import already imported issues
5. Don't re-export already exported beads
```

## Logging and Debugging

### Enable Verbose Output

```bash
# gh CLI verbose mode
GH_DEBUG=api gh issue list --repo $REPO

# See full HTTP requests/responses
GH_DEBUG=1 gh issue create ...
```

### Log File Recommendations

Create sync log for debugging:
```bash
SYNC_LOG="sync-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$SYNC_LOG") 2>&1

# All output now logged to file
```

### Common Debug Checks

```bash
# Check authentication
gh auth status -h github.com

# Check API connectivity
gh api user

# Check repository access
gh api repos/owner/repo

# Check rate limit
gh api rate_limit

# List issues (test query)
gh issue list --repo owner/repo --limit 1 --json number

# Validate beads
bd stats
bd list --json | jq 'length'
```

## Error Message Templates

### For Users

Clear, actionable error messages:

```
❌ Error: <what went wrong>

Cause: <why it happened>

Solution: <how to fix>
  <specific commands to run>

<additional context if needed>
```

### For Logs

Detailed technical error messages:

```
[ERROR] <timestamp> - <operation>
  Command: <full command that failed>
  Exit code: <exit code>
  Error output: <stderr>
  Context: <relevant state information>
```
