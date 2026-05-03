# GitHub-Specific Bidirectional Workflow

GitHub-specific implementation details for bidirectional synchronization with beads.

## Table of Contents

- [Overview](#overview)
- [GitHub-Specific Flow](#github-specific-flow)
- [Phase 1: Import from GitHub](#phase-1-import-from-github)
- [Phase 2: GitHub-Specific Conflict Detection](#phase-2-github-specific-conflict-detection)
- [Phase 3: Export to GitHub](#phase-3-export-to-github)
- [Phase 4: GitHub-Specific Conflict Resolution](#phase-4-github-specific-conflict-resolution)
- [GitHub-Specific Conflict Examples](#github-specific-conflict-examples)
- [Error Handling in GitHub Commands](#error-handling-in-github-commands)

## Overview

This document covers GitHub-specific aspects of bidirectional sync. For general workflow guidance, see `task-sync/references/bidirectional-workflow.md`.

## GitHub-Specific Flow

```
1. Import: GitHub → Beads
   └─ Use: gh issue list --state open
   
2. Detect Conflicts (GitHub-specific)
   └─ Use: gh issue view for individual issues
   └─ Compare with bd list --json
   
3. Export: Beads → GitHub  
   └─ Use: gh issue create for new issues
   └─ Use: gh issue close for closure sync
   
4. Resolve Conflicts (GitHub commands)
   └─ Use: gh issue edit for updates
   └─ Use: gh issue comment for notes
```

## Phase 1: Import from GitHub

### Step 1.1: Fetch GitHub Issues

```bash
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
gh issue list --repo $REPO --state open --json number,title,body,labels,createdAt,updatedAt --limit 100
```

**Store output as** `GITHUB_ISSUES` JSON array

### Step 1.2: Process Each GitHub Issue

For each issue in `GITHUB_ISSUES`:

**Check for existing bead**:
```bash
GITHUB_NUM="<issue.number>"
EXISTING=$(bd list --json | jq -r ".[] | select(.labels[]? == \"github:$GITHUB_NUM\") | .id")
```

**If existing bead found**:
- Issue was previously imported
- Store for conflict detection: `{github_num, bead_id, github_data}`
- Skip creation (already imported)

**If not found**:
- New issue to import
- Create bead following import workflow
- Add labels: `source:external`, `github:<number>`

**Track**:
- `NEW_IMPORTS[]` - Newly created beads
- `SYNCED_ISSUES[]` - Issues that exist in both systems (for conflict detection)

## Phase 2: GitHub-Specific Conflict Detection

For each issue in `SYNCED_ISSUES`:

### Step 2.1: Fetch Current GitHub State

```bash
GH_STATE=$(gh issue view $GITHUB_NUM --repo $REPO --json state,title,body,labels,updatedAt)
```

Extract:
- `gh_state` - "OPEN" or "CLOSED"
- `gh_title` - Current title
- `gh_body` - Current description
- `gh_labels` - Array of label names
- `gh_updated` - Last updated timestamp

### Step 2.2: Fetch Current Beads State

```bash
BEAD_STATE=$(bd show $BEAD_ID --json)
```

Extract:
- `bead_status` - open, in_progress, blocked, closed, done
- `bead_title` - Current title
- `bead_description` - Current description
- `bead_priority` - 0-4
- `bead_updated` - Last updated timestamp

### Step 2.3: Detect Status Conflicts

**Map beads status to GitHub state**:
```bash
if [[ "$bead_status" == "closed" || "$bead_status" == "done" ]]; then
  bead_mapped_state="CLOSED"
else
  bead_mapped_state="OPEN"
fi
```

**Compare**:
```
if [ "$bead_mapped_state" != "$gh_state" ]; then
  # Status conflict detected
fi
```

**Categorize**:

| Beads Status | GitHub State | Conflict Type | Auto-Resolve |
|--------------|--------------|---------------|--------------|
| closed/done | OPEN | Safe | Yes - close GitHub |
| open/in_progress/blocked | CLOSED | Unsafe | No - ask user |
| closed/done | CLOSED | No conflict | Skip |
| open/in_progress/blocked | OPEN | No conflict | Skip |

### Step 2.4: Detect Content Conflicts

**Title comparison**:
```bash
# Remove GitHub reference from bead title for comparison
BEAD_TITLE_CLEAN=$(echo "$bead_title" | sed 's/ (github:#[0-9]\+)$//')

if [ "$BEAD_TITLE_CLEAN" != "$gh_title" ]; then
  # Title differs - check timestamps or ask user
  :
fi
```

**Description comparison**:
```bash
# Extract original description from bead (ignore import footer)
BEAD_DESC_ORIGINAL=$(echo "$bead_description" | sed '/^---$/,$d' | sed '/^## Original GitHub Issue$/,/^## Description$/d')

if [ "$BEAD_DESC_ORIGINAL" != "$gh_body" ]; then
  # Description differs
  :
fi
```

**Timestamp-based resolution** (if available):
```bash
if [[ "$bead_updated" > "$gh_updated" ]]; then
  # Beads changed more recently → use beads version
  RESOLUTION="use_beads"
elif [[ "$gh_updated" > "$bead_updated" ]]; then
  # GitHub changed more recently → use GitHub version
  RESOLUTION="use_github"
else
  # Both changed at same time (unlikely) → ask user
  RESOLUTION="ask_user"
fi
```

### Step 2.5: Detect Priority Conflicts

**Extract GitHub priority from labels**:
```bash
# Check labels for priority indicators (see label-mapping.md)
GH_PRIORITY=2  # default
for label in "${gh_labels[@]}"; do
  case "${label,,}" in
    critical|p0) GH_PRIORITY=0 ;;
    high|p1) GH_PRIORITY=1 ;;
    low|p3) GH_PRIORITY=3 ;;
    backlog|p4) GH_PRIORITY=4 ;;
  esac
done
```

**Compare with beads priority**:
```bash
if [ "$bead_priority" != "$GH_PRIORITY" ]; then
  # Priority conflict
  :
fi
```

## Phase 3: Export to GitHub

### Step 3.1: Identify Beads for Export

Find beads without `github:` label (not yet exported):

```bash
bd list --json | jq -r '.[] | select(any(.labels[]?; startswith("github:")) | not) | .id'
```

### Step 3.2: Create GitHub Issues

For each bead to export:

```bash
# Map priority to GitHub label
case "$bead_priority" in
  0) PRIORITY_LABEL="critical" ;;
  1) PRIORITY_LABEL="high" ;;
  2) PRIORITY_LABEL="medium" ;;
  3) PRIORITY_LABEL="low" ;;
  4) PRIORITY_LABEL="backlog" ;;
esac

# Map type to GitHub label
case "$bead_type" in
  bug) TYPE_LABEL="bug" ;;
  feature) TYPE_LABEL="enhancement" ;;
  task) TYPE_LABEL="task" ;;
  chore) TYPE_LABEL="chore" ;;
esac

# Create issue
RESULT=$(gh issue create --repo $REPO \
  --title "$bead_title" \
  --body "$(cat <<EOF
$bead_description

---
*Created from beads issue: $bead_id*
*Priority: P$bead_priority*
*Type: $bead_type*
EOF
)" \
  --label "$TYPE_LABEL" \
  --label "$PRIORITY_LABEL" \
  --label "beads:$bead_id")

# Extract GitHub issue number
GITHUB_NUM=$(echo "$RESULT" | grep -oP '(?<=#)\d+' | head -1)

# Update bead with GitHub label
bd update $bead_id --label "github:$GITHUB_NUM"
```

### Step 3.3: Sync Closed Beads

For beads that are closed and have GitHub labels:

```bash
# Find closed beads with GitHub links
CLOSED_BEADS=$(bd list --status closed,done --json | jq -r '.[] | select(.labels[]? | startswith("github:")) | {id, github: (.labels[] | select(startswith("github:")))}')

for entry in $CLOSED_BEADS; do
  BEAD_ID=$(echo "$entry" | jq -r '.id')
  GITHUB_LABEL=$(echo "$entry" | jq -r '.github')
  GITHUB_NUM=${GITHUB_LABEL#github:}
  
  # Check if GitHub issue is still open
  GH_STATE=$(gh issue view $GITHUB_NUM --repo $REPO --json state -q '.state')
  
  if [ "$GH_STATE" = "OPEN" ]; then
    # Close GitHub issue
    gh issue close $GITHUB_NUM --repo $REPO --comment "Closed in beads (bead: $BEAD_ID)"
    echo "Closed GitHub #$GITHUB_NUM (bead: $BEAD_ID)"
  fi
done
```

## Phase 4: GitHub-Specific Conflict Resolution

### Auto-Resolve: Close GitHub Issue

**When**: Bead is closed, GitHub is open

```bash
gh issue close $GITHUB_NUM --repo $REPO --comment "Closed in beads via sync"
```

**Track**: Add to auto-resolved list

### Auto-Resolve: Update GitHub Title

**When**: Title changed in beads only, GitHub unchanged

```bash
gh issue edit $GITHUB_NUM --repo $REPO --title "$bead_title"
```

**Track**: Add to auto-resolved list

### Auto-Resolve: Update GitHub Description

**When**: Description changed in beads only, GitHub unchanged

```bash
gh issue edit $GITHUB_NUM --repo $REPO --body "$bead_description"
```

**Track**: Add to auto-resolved list

### Auto-Resolve: Update GitHub Priority

**When**: Priority changed in beads only, GitHub unchanged

```bash
# Remove old priority label
for old_label in critical high medium low backlog; do
  gh issue edit $GITHUB_NUM --repo $REPO --remove-label "$old_label" 2>/dev/null || true
done

# Add new priority label
gh issue edit $GITHUB_NUM --repo $REPO --add-label "$new_priority_label"
```

### Auto-Resolve: Update Beads from GitHub

**When**: Content changed in GitHub only, beads unchanged

```bash
# Update beads title (remove GitHub reference first if present)
bd update $BEAD_ID --title "$gh_title (github:#$GITHUB_NUM)"

# Update beads description
bd update $BEAD_ID --description "$gh_body"

# Update beads priority
bd update $BEAD_ID --priority $gh_priority
```

### Ask User: Title Conflict

**When**: Title changed in both systems

```javascript
# Present conflict to user via question tool
question({
  questions: [{
    header: "Title Conflict: $BEAD_ID / github:$GITHUB_NUM",
    question: "Title was changed in both systems. Which version should we keep?",
    options: [
      { label: "Use beads title", description: "$bead_title" },
      { label: "Use GitHub title", description: "$gh_title" },
      { label: "Edit manually", description: "Provide custom title" },
      { label: "Skip", description: "Don't sync this issue" }
    ]
  }]
})
```

**Apply user choice**:
```bash
case $USER_CHOICE in
  "use_beads")
    gh issue edit $GITHUB_NUM --repo $REPO --title "$bead_title"
    ;;
  "use_github")
    bd update $BEAD_ID --title "$gh_title (github:#$GITHUB_NUM)"
    ;;
  "edit_manually")
    # Prompt for new title, apply to both
    gh issue edit $GITHUB_NUM --repo $REPO --title "$new_title"
    bd update $BEAD_ID --title "$new_title (github:#$GITHUB_NUM)"
    ;;
  "skip")
    # No action
    ;;
esac
```

### Ask User: Status Conflict (GitHub Closed, Beads Open)

**When**: GitHub is closed but beads is open

```javascript
question({
  questions: [{
    header: "Status Conflict: $BEAD_ID / github:$GITHUB_NUM",
    question: "Issue is closed in GitHub but open in beads. What should we do?",
    options: [
      { label: "Close in beads (recommended)", description: "Respect GitHub closure" },
      { label: "Reopen in GitHub", description: "Respect beads status" },
      { label: "Skip", description: "Leave as-is" }
    ]
  }]
})
```

**Apply user choice**:
```bash
case $USER_CHOICE in
  "close_beads")
    bd close $BEAD_ID --reason "Closed in GitHub via sync"
    ;;
  "reopen_github")
    gh issue reopen $GITHUB_NUM --repo $REPO
    gh issue comment $GITHUB_NUM --repo $REPO --body "Reopened to match beads status"
    ;;
  "skip")
    # No action
    ;;
esac
```

## GitHub-Specific Conflict Examples

### Example 1: Bead Closed, GitHub Open

**Detection**:
```bash
BEAD_STATUS="closed"
GH_STATE="OPEN"
```

**Resolution**: Auto-resolve (safe)
```bash
gh issue close $GITHUB_NUM --repo $REPO --comment "Closed in beads"
```

**Result**: GitHub issue #123 closed

### Example 2: GitHub Closed, Bead Open

**Detection**:
```bash
BEAD_STATUS="open"
GH_STATE="CLOSED"
```

**Resolution**: Ask user (conflict)

**User chooses**: "Close in beads"

**Action**:
```bash
bd close $BEAD_ID --reason "Closed in GitHub (issue #$GITHUB_NUM)"
```

### Example 3: Title Changed in Both

**Detection**:
```bash
BEAD_TITLE="Fix authentication timeout"
GH_TITLE="Fix login timeout"
# Both differ from original: "Fix timeout issue"
```

**Resolution**: Ask user (conflict)

**User chooses**: "Use beads title"

**Action**:
```bash
gh issue edit $GITHUB_NUM --repo $REPO --title "Fix authentication timeout"
```

### Example 4: Priority Changed in Beads

**Detection**:
```bash
BEAD_PRIORITY=1  # P1
GH_LABELS=["bug", "medium"]  # P2 inferred
```

**Resolution**: Auto-resolve (safe)

**Action**:
```bash
gh issue edit $GITHUB_NUM --repo $REPO --remove-label "medium" --add-label "high"
```

## Error Handling in GitHub Commands

### Handle Issue Already Closed

```bash
if ! gh issue close $GITHUB_NUM --repo $REPO 2>&1; then
  # Check if already closed
  STATE=$(gh issue view $GITHUB_NUM --repo $REPO --json state -q '.state')
  if [ "$STATE" = "CLOSED" ]; then
    echo "✓ Issue #$GITHUB_NUM already closed (no action needed)"
  else
    echo "✗ Failed to close issue #$GITHUB_NUM"
  fi
fi
```

### Handle Label Doesn't Exist

```bash
if ! gh issue edit $GITHUB_NUM --repo $REPO --add-label "high" 2>&1; then
  echo "Warning: Label 'high' may not exist in repository"
  echo "GitHub will auto-create it, or issue was created without label"
fi
```

### Handle Network Errors

```bash
if ! gh issue list --repo $REPO --state open 2>&1; then
  echo "Error: Failed to fetch GitHub issues"
  echo "Check network connectivity and try again"
  exit 1
fi
```
