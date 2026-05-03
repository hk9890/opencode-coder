# Import Workflow: External → Beads

Detailed step-by-step process for importing issues from external systems into beads.

## Prerequisites

Before starting import:

1. Backend skill must be loaded and ready
2. Backend must verify authentication and connectivity
3. User should confirm which external system to import from

## Step 1: Fetch External Issues

Backend executes system-specific command to fetch open issues:

**What to fetch**:
- All open issues (or specific query if user requested filter)
- Issue metadata: ID, title, description, labels, priority, created date, status
- Use JSON output format for structured parsing

**Backend responsibility**: Execute appropriate API/CLI command for the external system.

## Step 2: Deduplication Check

For each fetched issue, check if already imported into beads:

**Check method**: Look for existing beads with external ID label
```bash
bd list --json | jq ".[] | select(.labels | contains([\"system:ID\"]))"
```

Replace `system:ID` with actual label pattern (e.g., `github:123`, `jira:PROJ-456`)

**If found**: Skip this issue (already imported)
**If not found**: Proceed to import

**Track results**:
- Count of new issues to import
- Count of skipped issues (already imported)
- List of new issues with IDs and titles

## Step 3: Map External Data to Beads Format

For each issue to import, transform external data:

### Priority Mapping

Map external priority/labels to beads priority (0-4):

**Common patterns**:
- Critical/P0/Blocker → Priority 0
- High/P1/Important → Priority 1
- Medium/P2/Normal → Priority 2 (default)
- Low/P3/Minor → Priority 3
- Backlog/P4 → Priority 4

Backend-specific mappings should be documented in backend skill references.

If no priority indicator → default to Priority 2

### Type Mapping

Determine beads issue type:

**Common patterns**:
- Issues labeled "bug" or "defect" → type: bug
- Issues labeled "feature" or "enhancement" → type: feature
- Issues labeled "task" → type: task
- Default → type: bug

### Title Format

Preserve original title with external reference:
```
<Original title> (system:#ID)
```

Example: `Fix login timeout (github:#123)`

### Body Format

Create structured body with metadata:
```markdown
## Original External Issue

**System**: <System name>
**ID**: <org/repo>#<number> or <project-key>
**Created**: <created date>
**URL**: <direct link to issue>

## Description

<body from external issue>

---
*Imported from <system> on <import date>*
```

### Labels to Apply

Add beads labels to track origin:

1. `source:external` - Marks issue as imported
2. `system:ID` - Links to external issue (e.g., `github:123`, `jira:PROJ-456`)
3. Any other relevant labels from external system

## Step 4: Create Beads

For each mapped issue, execute beads creation:

```bash
bd create \
  --title "<mapped title>" \
  --type <mapped type> \
  --priority <mapped priority> \
  --description "<mapped body>" \
  --label "source:external" \
  --label "system:ID"
```

**Error handling**:
- If creation fails, log error and continue with next issue
- Track failed imports separately
- Show errors in final summary

**Capture results**:
- Successfully created bead IDs
- Failed imports with error messages

## Step 5: Show Import Summary

Present results to user in clear format:

### Summary Format

```
Import Summary
==============

✅ Successfully imported: <count> issues
⏭️  Skipped (already imported): <count> issues
❌ Failed: <count> issues

New Issues Imported:
┌─────────┬──────────────┬──────────────────────────────────┬──────────┐
│ Bead ID │ External ID  │ Title                            │ Priority │
├─────────┼──────────────┼──────────────────────────────────┼──────────┤
│ oc-abc1 │ github:123   │ Fix login timeout                │ P1       │
│ oc-def2 │ github:124   │ Add export feature               │ P2       │
└─────────┴──────────────┴──────────────────────────────────┴──────────┘

Skipped Issues:
- github:100 (already imported as oc-xyz9)
- github:105 (already imported as oc-uvw8)
```

If failures occurred:
```
Failed Imports:
- github:130: Failed to create bead (invalid title format)
- github:135: API error (rate limit exceeded)
```

### User Confirmation

After showing summary, ask if user wants to:
1. Continue with next sync operation (if bidirectional)
2. Review imported issues
3. Done

## Error Scenarios

### External API/CLI Errors

**Authentication failure**:
- Show error: "Not authenticated to <system>"
- Suggest: "Run authentication command for <system>"
- Abort import

**Network error**:
- Show error: "Failed to fetch from <system>"
- Suggest: "Check connectivity and try again"
- Abort import

**Rate limiting**:
- Show error: "API rate limit exceeded"
- Suggest: "Wait <time> minutes and retry"
- Abort import

### Beads Creation Errors

**Invalid data**:
- Log error for specific issue
- Continue with remaining issues
- Report in summary

**Database error**:
- Show error: "Failed to create beads"
- Suggest: "Check .beads/ directory permissions"
- Abort import
