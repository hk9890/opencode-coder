# Export Workflow: Beads → External

Detailed step-by-step process for exporting beads issues to external systems.

## Prerequisites

Before starting export:

1. Backend skill must be loaded and ready
2. Backend must verify authentication and connectivity  
3. User should confirm target external system

## Step 1: Identify Eligible Beads

Query beads to find issues that can be exported:

### Eligibility Criteria

**Must have**:
- Valid issue type (bug, feature, task, chore)
- Not already exported (no external ID label like `github:123`)

**Optional filters** (based on user request):
- Specific priority levels
- Specific status (open, in_progress, blocked)
- Specific labels or assignees
- Created within date range

### Query Command

```bash
bd list --json --type bug,feature,task,chore --status open,in_progress,blocked
```

Then filter out issues that already have external ID labels:
```bash
# Check if issue has any system:ID labels (github:*, jira:*, etc.)
# Skip if found - already exported
```

**Track results**:
- Count of eligible beads for export
- List of eligible beads with IDs, types, priorities, titles

## Step 2: Show Summary to User

Present export preview before executing:

### Preview Format

```
Export Preview
==============

Found <count> beads eligible for export to <system>:

┌─────────┬──────┬──────────┬────────────────────────────────────────┐
│ Bead ID │ Type │ Priority │ Title                                  │
├─────────┼──────┼──────────┼────────────────────────────────────────┤
│ oc-abc1 │ bug  │ P1       │ Fix login timeout                      │
│ oc-def2 │ feat │ P2       │ Add export feature                     │
│ oc-ghi3 │ task │ P3       │ Update documentation                   │
└─────────┴──────┴──────────┴────────────────────────────────────────┘

What would you like to do?
1. Export all <count> beads
2. Select specific beads to export
3. Cancel
```

## Step 3: User Decision

Use question tool to get user choice:

```
question({
  questions: [{
    header: "Export Selection",
    question: "How would you like to proceed with export?",
    options: [
      { label: "Export all", description: "Export all eligible beads to external system" },
      { label: "Select specific", description: "Choose which beads to export" },
      { label: "Cancel", description: "Don't export anything" }
    ]
  }]
})
```

### If "Export all"
Proceed with all eligible beads

### If "Select specific"
Show follow-up question with multi-select:
```
question({
  questions: [{
    header: "Select Beads",
    question: "Which beads would you like to export?",
    multiple: true,
    options: [
      { label: "oc-abc1: Fix login timeout", description: "P1 bug" },
      { label: "oc-def2: Add export feature", description: "P2 feature" },
      ...
    ]
  }]
})
```

### If "Cancel"
Abort export and return

## Step 4: Export Each Selected Bead

For each bead selected for export:

### 4.1 Map Beads Data to External Format

**Title mapping**: Use bead title as-is (no modification needed)

**Body mapping**: Transform beads description for external system
```markdown
<bead description content>

---
*Created from beads issue: <bead-id>*
*Priority: P<priority>*
*Type: <type>*
```

**Priority mapping**: Convert beads priority to external labels
- P0 → critical/blocker
- P1 → high
- P2 → medium
- P3 → low
- P4 → backlog

Backend-specific mappings documented in backend references.

**Label mapping**: Convert beads labels to external labels (backend-specific)

### 4.2 Create External Issue

Backend executes system-specific create command:

**What to include**:
- Mapped title
- Mapped body with metadata footer
- Mapped priority label
- Any additional labels

**Backend responsibility**: Execute appropriate API/CLI command

Example for GitHub:
```bash
gh issue create --repo $REPO \
  --title "<title>" \
  --body "<mapped body>" \
  --label "<priority-label>"
```

### 4.3 Capture External ID

Parse external system response to extract issue ID:

**GitHub example**: `Created issue owner/repo#123` → Extract `123`
**Jira example**: `Issue created: PROJ-456` → Extract `PROJ-456`

**Error handling**: If ID extraction fails, log error and skip adding label

### 4.4 Add External ID Label to Bead

Update bead with external ID label:

```bash
bd update <bead-id> --label "system:ID"
```

Examples:
- `bd update oc-abc1 --label "github:123"`
- `bd update oc-def2 --label "jira:PROJ-456"`

**Important**: Do NOT add `source:external` label - that indicates imported issues only

**Error handling**: If label update fails, log warning (external issue created but not tracked)

## Step 5: Show Export Summary

Present results to user:

### Summary Format

```
Export Summary
==============

✅ Successfully exported: <count> beads
❌ Failed: <count> beads

Exported Issues:
┌─────────┬──────────────┬────────────────────────────────────────┐
│ Bead ID │ External ID  │ Title                                  │
├─────────┼──────────────┼────────────────────────────────────────┤
│ oc-abc1 │ github:123   │ Fix login timeout                      │
│ oc-def2 │ github:124   │ Add export feature                     │
└─────────┴──────────────┴────────────────────────────────────────┘

External URLs:
- oc-abc1: https://github.com/owner/repo/issues/123
- oc-def2: https://github.com/owner/repo/issues/124
```

If failures occurred:
```
Failed Exports:
- oc-ghi3: Failed to create external issue (authentication error)
- oc-jkl4: Created external issue but failed to update bead label
```

### User Confirmation

After showing summary, ask if user wants to:
1. Continue with next sync operation (if bidirectional)
2. View exported issues
3. Done

## Error Scenarios

### External API/CLI Errors

**Authentication failure**:
- Show error: "Not authenticated to <system>"
- Suggest: "Run authentication command"
- Abort export for this bead, continue with others

**Permission error**:
- Show error: "No permission to create issues in <system>"
- Suggest: "Check repository/project permissions"
- Abort export

**Rate limiting**:
- Show error: "API rate limit exceeded"
- Suggest: "Wait and retry failed exports"
- Abort remaining exports, show partial results

**Network error**:
- Show error: "Failed to connect to <system>"
- Suggest: "Check connectivity"
- Abort export

### Beads Update Errors

**Label update failed**:
- Log warning: "Created external issue but couldn't update bead label"
- Continue with remaining exports
- Show warning in summary

**Invalid bead data**:
- Show error: "Bead <id> has invalid data for export"
- Skip this bead
- Continue with remaining exports

## Status Sync After Export

After successfully exporting a bead, consider syncing status:

### If Bead is Closed

After export, if bead status is `closed` or `done`:
- Optionally close the newly created external issue
- Show in summary that issue was created and closed
- Follow closure sync workflow if implemented

### If Bead is In Progress

No immediate status sync needed - bidirectional sync will handle future updates
