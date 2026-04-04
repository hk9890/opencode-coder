# GitHub-Task-Sync Skill Design Document

## Overview

The `github-task-sync` skill is a GitHub-specific backend for task synchronization. It implements bidirectional sync between beads and GitHub issues using the gh CLI, following workflows defined in the task-sync orchestrator skill.

## Skill Metadata

**Name**: `github-task-sync`

**Description**:
```yaml
description: "GitHub backend for task synchronization. Syncs beads issues with GitHub issues bidirectionally using gh CLI. Use when: (1) User wants to sync with GitHub specifically, (2) Task-sync skill delegates to GitHub backend, (3) User mentions 'GitHub issues', 'gh sync', or 'import from GitHub'. Implements import (GitHub → beads), export (beads → GitHub), and bidirectional workflows."
```

## SKILL.md Structure (~150-200 lines)

### Section Breakdown

1. **Frontmatter** (lines 1-4)
   - YAML with name and description
   - No other fields

2. **Introduction** (lines 6-20, ~15 lines)
   - Brief overview of GitHub backend
   - Note: "Ensure task-sync skill loaded for workflow guidance"
   - Relationship to task-sync orchestrator
   - Prerequisites overview

3. **Prerequisites Section** (lines 22-45, ~25 lines)
   - gh CLI authentication check
   - bd CLI availability check
   - Repository detection
   - Reference check-gh-auth.sh script

4. **Import Implementation** (lines 47-85, ~40 lines)
   - High-level import steps (GitHub → beads)
   - Reference gh-commands.md for command details
   - Reference label-mapping.md for priority logic
   - Reference task-sync/references/import-workflow.md for workflow

5. **Export Implementation** (lines 87-120, ~35 lines)
   - High-level export steps (beads → GitHub)
   - Reference gh-commands.md for `gh issue create`
   - Reference label-mapping.md for priority → label conversion
   - Reference task-sync/references/export-workflow.md for workflow

6. **Bidirectional Sync** (lines 122-155, ~35 lines)
   - Combined import + export
   - Reference task-sync/references/bidirectional-workflow.md
   - Reference own references/bidirectional-workflow.md for GitHub specifics

7. **Error Handling** (lines 157-180, ~25 lines)
   - Common error scenarios
   - Reference error-handling.md for details

8. **Reference Files Index** (lines 182-195, ~15 lines)
   - List all reference files
   - When to load each one

**Total**: ~190 lines (under 200 target)

### Example SKILL.md Outline

```markdown
---
name: github-task-sync
description: "GitHub backend for task synchronization. Syncs beads issues with GitHub..."
---

# GitHub Task Sync

GitHub-specific backend for bidirectional task synchronization.

## About This Skill

This skill implements GitHub sync using gh CLI. It:
- Syncs beads issues with GitHub issues
- Supports import, export, and bidirectional workflows
- Follows workflow guidance from task-sync skill
- Can be invoked directly or via task-sync delegation

**Important**: Ensure `task-sync` skill is loaded for workflow orchestration guidance. If not loaded, load it first using the skill tool.

## Prerequisites

Before syncing, verify:

1. **GitHub CLI authenticated**: Run scripts/check-gh-auth.sh
2. **Beads CLI available**: `bd stats` must work
3. **Repository detected**: Must be in a git repo with GitHub remote

**Prerequisites script**: See scripts/check-gh-auth.sh

**For error handling**: See [references/error-handling.md](references/error-handling.md)

## Import: GitHub → Beads

High-level steps:

1. Run prerequisites check
2. Fetch open GitHub issues: `gh issue list --repo $REPO --state open`
3. For each issue:
   - Check if already imported (deduplication via labels)
   - Determine priority from GitHub labels
   - Create bead with labels: source:external, github:<number>
4. Show import summary

**For detailed gh commands**: See [references/gh-commands.md](references/gh-commands.md)

**For priority mapping**: See [references/label-mapping.md](references/label-mapping.md)

**For complete workflow**: See task-sync/references/import-workflow.md

## Export: Beads → GitHub

High-level steps:

1. Find eligible beads (no github:XXX label)
2. Show summary and ask user confirmation
3. For each selected bead:
   - Map priority to GitHub label
   - Create GitHub issue: `gh issue create --repo $REPO --title "..." --body "..." --label "..."`
   - Capture issue number
   - Add github:<number> label to bead
4. Show export summary

**For detailed gh commands**: See [references/gh-commands.md](references/gh-commands.md)

**For priority mapping**: See [references/label-mapping.md](references/label-mapping.md)

**For complete workflow**: See task-sync/references/export-workflow.md

## Bidirectional Sync

High-level steps:

1. Run import workflow (GitHub → beads)
2. Detect conflicts between systems
3. Run export workflow (beads → GitHub)
4. Resolve conflicts per task-sync safety guidelines

**For orchestration**: See task-sync/references/bidirectional-workflow.md

**For GitHub specifics**: See [references/bidirectional-workflow.md](references/bidirectional-workflow.md)

**For conflict resolution**: See task-sync/references/safety-guidelines.md

## Error Handling

Common error scenarios:

- gh CLI not authenticated → Run `gh auth login`
- Repository not found → Check git remote
- API rate limiting → Wait and retry
- Network errors → Check connectivity

**For complete error guide**: See [references/error-handling.md](references/error-handling.md)

## Reference Files

GitHub-specific documentation:

- **[gh-commands.md](references/gh-commands.md)** - All gh CLI commands used
- **[label-mapping.md](references/label-mapping.md)** - Priority and label mappings
- **[error-handling.md](references/error-handling.md)** - GitHub error scenarios
- **[bidirectional-workflow.md](references/bidirectional-workflow.md)** - GitHub-specific bidirectional logic

See task-sync skill for workflow orchestration guidance.
```

## Scripts

### scripts/check-gh-auth.sh (~40-60 lines)

**Purpose**: Verify environment prerequisites for GitHub sync

**Content**:
```bash
#!/bin/bash
# Check GitHub CLI authentication and environment

set -e

echo "🔍 Checking prerequisites..."

# Check 1: gh CLI authentication
echo -n "  GitHub CLI: "
if ! command -v gh &> /dev/null; then
    echo "❌ Not installed"
    echo ""
    echo "Error: gh CLI not found. Install from https://cli.github.com"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated"
    echo ""
    echo "Error: GitHub CLI not authenticated. Run: gh auth login"
    exit 1
fi
echo "✅ Authenticated"

# Check 2: bd CLI availability
echo -n "  Beads CLI: "
if ! command -v bd &> /dev/null; then
    echo "❌ Not found"
    echo ""
    echo "Error: bd CLI not found. Ensure beads is installed."
    exit 1
fi

if ! bd stats &> /dev/null; then
    echo "❌ Not available"
    echo ""
    echo "Error: bd stats failed. Are you in a beads project? Run: bd init --skip-agents"
    exit 1
fi
echo "✅ Available"

# Check 3: Repository detection
echo -n "  Repository: "
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ Not detected"
    echo ""
    echo "Error: Could not detect GitHub repository. Ensure git remote is set."
    exit 1
fi
echo "✅ $REPO"

echo ""
echo "✅ All prerequisites met"
echo "   Repository: $REPO"
exit 0
```

**Test scenarios**:
- gh not installed
- gh not authenticated
- bd not available
- Not in git repo
- All checks pass

## Reference Files

### 1. references/gh-commands.md (~150-200 lines)

**Purpose**: Complete gh CLI command reference for sync operations

**Content**:

**Fetch Open Issues**:
```bash
gh issue list --repo $REPO --state open --json number,title,body,labels,createdAt --limit 100
```

**View Issue Details**:
```bash
gh issue view <number> --repo $REPO --json state,title,body,labels -q '.'
```

**Create Issue**:
```bash
gh issue create --repo $REPO \
  --title "Issue title" \
  --body "Issue description" \
  --label "priority-label"
```
Capture issue number from output: `Created issue <org/repo>#123`

**Close Issue**:
```bash
gh issue close <number> --repo $REPO --comment "Closed via beads sync"
```

**Reopen Issue**:
```bash
gh issue reopen <number> --repo $REPO
```

**Add Comment**:
```bash
gh issue comment <number> --repo $REPO --body "Comment text"
```

**Update Labels**:
```bash
gh issue edit <number> --repo $REPO --add-label "new-label"
```

**Error Handling**:
- Command not found → gh CLI not installed
- Authentication errors → Not logged in
- 404 errors → Repository or issue not found
- 403 errors → No permission
- Rate limiting → Too many requests, wait

**Extracting Data**:
- Use `--json` flag for structured output
- Use `-q` with jq syntax for filtering
- Parse `createdAt` for timestamps
- Extract labels from JSON array

**Examples from sync-issues.md** (extract lines 165-170, 220-240, 360-410)

### 2. references/label-mapping.md (~100-150 lines)

**Purpose**: Bidirectional mapping between GitHub labels and beads metadata

**Content**:

**GitHub Labels → Beads Priority**:

| GitHub Label | Beads Priority | Priority Value |
|--------------|----------------|----------------|
| `critical`, `P0`, `severity:critical` | P0 | 0 |
| `high`, `P1`, `severity:high` | P1 | 1 |
| `medium`, `P2`, `severity:medium` | P2 | 2 |
| (no priority label) | P2 (default) | 2 |
| `low`, `P3`, `severity:low` | P3 | 3 |
| `backlog`, `P4` | P4 | 4 |

**Algorithm**:
1. Check issue labels for priority keywords (case-insensitive)
2. Use highest priority found
3. Default to P2 if no priority label

**Beads Priority → GitHub Label**:

| Beads Priority | GitHub Label |
|----------------|--------------|
| P0 (0) | `critical` |
| P1 (1) | `high` |
| P2 (2) | `medium` |
| P3 (3) | `low` |
| P4 (4) | `backlog` |

**Label Tracking**:

- `source:external` - Issue imported from GitHub
- `github:<number>` - Links to GitHub issue #<number>

**Direction Tracking**:

- Has `source:external` + `github:123` → Imported FROM GitHub
- Has `github:123` only → Created in beads, exported TO GitHub

**Title Format**:

For imported issues: `<Original title> (github:#<number>)`

**Body Format**:

For imported issues:
```markdown
## Original GitHub Issue

**GitHub**: <org/repo>#<number>
**Created**: <created date>
**URL**: https://github.com/<org/repo>/issues/<number>

## Description

<body from GitHub issue>

---
*Imported from GitHub*
```

For exported issues:
```markdown
<bead body content>

---
*Created from beads issue: <bead-id>*
```

**Type Mapping**:

Imported issues are always type `bug` in beads.

Exported beads can be any type (bug, feature, task, chore).

### 3. references/error-handling.md (~150-200 lines)

**Purpose**: Common error scenarios and resolutions

**Content**:

**gh CLI Errors**:

**Error: gh not found**
```
Error: GitHub CLI not installed
Solution: Install from https://cli.github.com
Command: brew install gh (macOS) or see website for other platforms
```

**Error: Not authenticated**
```
Error: gh auth status failed
Solution: Authenticate with GitHub
Command: gh auth login
Follow: Interactive authentication flow
```

**Error: Repository not found**
```
Error: gh repo view returned 404
Cause: Not in a git repo with GitHub remote
Solution: Check git remote -v
Add remote: git remote add origin https://github.com/owner/repo.git
```

**Error: API rate limiting**
```
Error: API rate limit exceeded
Cause: Too many requests to GitHub API
Solution: Wait ~60 minutes or authenticate for higher rate limit
Check: gh api rate_limit
```

**Error: Network connectivity**
```
Error: Failed to fetch from GitHub
Cause: Network issues, firewall, or GitHub outage
Solution: Check internet connection, try again later
Status: https://www.githubstatus.com/
```

**Error: Permission denied**
```
Error: 403 Forbidden
Cause: No permission to access repository or issues
Solution: Verify repository access, check if issues are enabled
```

**bd CLI Errors**:

**Error: bd not found**
```
Error: bd command not found
Cause: Beads not installed or not in PATH
Solution: Install beads CLI
Check: bd doctor
```

**Error: Not in beads project**
```
Error: bd stats failed - no .beads directory
Cause: Not in a beads-initialized project
Solution: Run bd init --skip-agents
```

Manual/direct beads init in this workflow is tracker/hooks setup only. It must not be treated as project markdown generation or refresh.

**Error: bd create failed**
```
Error: Failed to create bead
Cause: Invalid parameters or database issue
Solution: Check bd create syntax, verify .beads/ is writable
```

**Sync-Specific Errors**:

**Error: Duplicate detection failed**
```
Error: Could not check for existing bead
Cause: bd list or jq command failed
Solution: Verify bd list --json works, ensure jq is installed
```

**Error: Label parsing failed**
```
Error: Could not extract priority from GitHub labels
Cause: Unexpected label format
Solution: Use default priority P2, log warning
```

**Conflict Scenarios** (reference task-sync/references/safety-guidelines.md):

- Title changed in both → Ask user
- Status changed in both → Ask user
- Comments added in both → Safe, add both
- Issue closed in beads, open in GitHub → Safe, close GitHub
- Issue closed in GitHub, open in beads → Ask user

### 4. references/bidirectional-workflow.md (~100-150 lines)

**Purpose**: GitHub-specific bidirectional sync implementation

**Content**:

**High-Level Flow**:
1. Import GitHub → beads (follow import workflow)
2. Detect GitHub-specific conflicts
3. Export beads → GitHub (follow export workflow)
4. Apply GitHub-specific conflict resolution

**GitHub-Specific Conflict Detection**:

Compare GitHub issue state vs beads state:

**Status Conflicts**:
- GitHub: open, Beads: closed → Close GitHub issue
- GitHub: closed, Beads: open → Ask user (respect GitHub)
- Both: closed → No action

**Content Conflicts**:
- Title differs → Ask user which to keep
- Description differs → Ask user which to keep
- Labels differ → Merge labels (union)

**Comment Sync**:
- GitHub has new comments → Add to beads as comments
- Beads has new comments → Add to GitHub via `gh issue comment`
- Both have comments → Add both (chronological order if possible)

**Priority Conflicts**:
- GitHub label changed → Update beads priority
- Beads priority changed → Update GitHub label
- Both changed → Ask user

**Sync Algorithm**:

```
For each issue in both systems:
  1. Fetch GitHub state
  2. Fetch beads state
  3. Compare timestamps (if available)
  4. Categorize change:
     - Safe → Auto-apply
     - Conflict → Ask user
  5. Execute sync action
  6. Update labels to reflect sync
```

**GitHub-Specific Safe Changes**:
- Close GitHub issue when beads closed (and GitHub still open)
- Add labels to GitHub when beads labels changed
- Add comments from beads to GitHub

**GitHub-Specific Conflicts** (ask user):
- Title changed in both
- Description changed in both
- Status changed to conflicting states
- Priority changed in both

**Example Scenarios**:

**Scenario 1: Bead closed, GitHub open**
```
Action: Close GitHub issue
Command: gh issue close <number> --repo $REPO --comment "Closed in beads"
Result: GitHub issue closed
```

**Scenario 2: GitHub closed, bead open**
```
Action: Ask user
Options:
  1. Close bead (respect GitHub)
  2. Reopen GitHub (respect beads)
  3. Skip this issue
```

**Scenario 3: Both changed title**
```
Action: Ask user
Show:
  - GitHub title: "Fix login timeout"
  - Beads title: "Fix authentication timeout"
Options:
  1. Use GitHub title (update beads)
  2. Use beads title (update GitHub)
  3. Edit manually
```

## Directory Structure

```
github-task-sync/
├── SKILL.md                                 (~190 lines)
├── scripts/
│   └── check-gh-auth.sh                     (~50 lines)
└── references/
    ├── gh-commands.md                       (~180 lines)
    ├── label-mapping.md                     (~120 lines)
    ├── error-handling.md                    (~180 lines)
    └── bidirectional-workflow.md            (~120 lines)
```

## Key Design Decisions

1. **GitHub-specific implementation**: All gh CLI commands here, not in task-sync
2. **Progressive disclosure**: SKILL.md = high-level, references = detailed commands
3. **Prerequisites script**: check-gh-auth.sh handles all environment checks
4. **Reference task-sync**: Explicitly link to task-sync for workflow guidance
5. **Two invocation patterns**: Direct ("sync with GitHub") or via task-sync
6. **Extract from sync-issues.md**: Migrate and refactor existing logic
7. **Test scripts**: check-gh-auth.sh must be tested and work correctly

## Content Migration from sync-issues.md

**Extract from sync-issues.md** (~971 lines):

- Lines 23-93: Environment verification → scripts/check-gh-auth.sh
- Lines 94-152: Repository detection → scripts/check-gh-auth.sh
- Lines 154-249: Import workflow → references/gh-commands.md + SKILL.md import section
- Lines 199-216: Priority mapping → references/label-mapping.md
- Lines 325-420: Export closures → references/gh-commands.md + SKILL.md export section
- Lines 260-275: Error messages → references/error-handling.md
- Step 4 logic: Closure sync → Export workflow with closures

**New functionality** (not in sync-issues.md):
- Full export (create GitHub issues from beads)
- True bidirectional sync with conflict detection
- Agentic conflict resolution

## Integration with task-sync

This skill should:
1. Reference task-sync for workflow orchestration
2. Follow metadata conventions from task-sync
3. Use safety guidelines from task-sync
4. Load task-sync if invoked directly and it's not loaded
5. Implement GitHub-specific commands and mappings

## Success Criteria

- [ ] SKILL.md is ~150-200 lines (under 500 max)
- [ ] check-gh-auth.sh script tested and working
- [ ] All 4 reference files planned with clear purpose
- [ ] Content extraction plan from sync-issues.md complete
- [ ] Progressive disclosure pattern applied
- [ ] Follows skill-creator principles
- [ ] Integration with task-sync documented
- [ ] Both invocation patterns supported
