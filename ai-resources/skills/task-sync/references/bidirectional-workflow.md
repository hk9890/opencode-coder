# Bidirectional Workflow: Combined Sync with Conflict Detection

Detailed process for bidirectional synchronization between beads and external systems with conflict detection and resolution.

## Overview

Bidirectional sync combines import and export workflows with intelligent conflict detection. The goal is to keep both systems in sync while respecting user changes in both directions.

## High-Level Flow

```
1. Import Phase (External → Beads)
   ↓
2. Conflict Detection (Compare States)
   ↓
3. Export Phase (Beads → External)
   ↓
4. Conflict Resolution (Auto + User)
   ↓
5. Final Summary
```

## Prerequisites

Same as import and export workflows:
- Backend skill loaded and authenticated
- Both systems accessible
- User confirms bidirectional sync intent

## Phase 1: Import from External

Execute import workflow as documented in [import-workflow.md](import-workflow.md)

**Collect import results**:
- List of newly imported issues
- List of skipped issues (already imported)
- List of existing beads that match external issues (for conflict detection)

**Key data to track**:
- External issue ID → Bead ID mapping
- Status of each issue in external system
- Last modified timestamp (if available)
- Content snapshot (title, description, priority)

## Phase 2: Detect Potential Conflicts

Before proceeding to export, analyze issues that exist in both systems for conflicts.

### 2.1 Identify Synced Issues

Find beads that have external ID labels (already synced previously):

```bash
bd list --json | jq '.[] | select(.labels | contains(["system:ID"]))'
```

These issues exist in both systems and may have conflicts.

### 2.2 Fetch External State

For each synced issue, fetch current state from external system:

**Backend executes**: Fetch individual issue details (status, title, description, priority)

### 2.3 Compare States

For each synced issue, compare beads state vs external state:

#### Status Conflicts

| Beads Status | External Status | Conflict Type | Auto-Resolve? |
|--------------|-----------------|---------------|---------------|
| closed       | open            | Safe          | Yes - close external |
| open         | closed          | Conflict      | No - ask user |
| closed       | closed          | No conflict   | Yes - no action |
| open         | open            | No conflict   | Yes - continue to content check |

#### Content Conflicts

| Changed In   | Conflict Type | Auto-Resolve? |
|--------------|---------------|---------------|
| Beads only   | Safe          | Yes - update external |
| External only| Safe          | Yes - update beads |
| Both systems | Conflict      | No - ask user |
| Neither      | No conflict   | Yes - no action |

**Content to check**:
- Title
- Description/body
- Priority
- Labels (less critical - can merge)

#### Timestamp-Based Detection

If timestamps available:
- Compare last modified dates
- Recent changes (< 24h) may indicate active work
- Older changes safer to auto-resolve

### 2.4 Categorize Changes

Group detected issues into categories:

1. **Safe auto-updates**: Changed in only one system, no conflicts
2. **Conflict requires resolution**: Changed in both systems
3. **No action needed**: No changes detected

## Phase 3: Show Import + Conflict Summary

Before proceeding to export, show comprehensive summary:

### Summary Format

```
Bidirectional Sync: Import Phase Complete
==========================================

Import Results:
✅ Newly imported: <count> issues
⏭️  Already imported: <count> issues (checked for conflicts)

Conflict Analysis:
🟢 Safe auto-updates: <count> issues
   - Will be synchronized automatically
   
⚠️  Conflicts detected: <count> issues
   - Require user decision
   
✅ No changes: <count> issues
   - Already in sync

Safe Auto-Updates:
┌─────────┬──────────────┬────────────────────────────────┬────────────┐
│ Bead ID │ External ID  │ Change                         │ Action     │
├─────────┼──────────────┼────────────────────────────────┼────────────┤
│ oc-abc1 │ github:123   │ Closed in beads                │ Close ext  │
│ oc-def2 │ github:124   │ Priority changed in beads      │ Update ext │
└─────────┴──────────────┴────────────────────────────────┴────────────┘

Conflicts Detected:
┌─────────┬──────────────┬────────────────────────────────────────────┐
│ Bead ID │ External ID  │ Conflict Description                       │
├─────────┼──────────────┼────────────────────────────────────────────┤
│ oc-ghi3 │ github:125   │ Title changed in both systems              │
│ oc-jkl4 │ github:126   │ Closed in external, open in beads          │
└─────────┴──────────────┴────────────────────────────────────────────┘

Ready to proceed with export phase and conflict resolution.
```

## Phase 4: Export to External

Execute export workflow as documented in [export-workflow.md](export-workflow.md)

**Additional considerations for bidirectional**:
- Skip issues with unresolved conflicts (handle separately)
- Include safe auto-updates from conflict detection
- Export new beads that don't exist externally

## Phase 5: Resolve Conflicts

For each conflict detected in Phase 2, apply resolution strategy:

### 5.1 Auto-Resolve Safe Changes

Apply safe changes automatically without user input:

#### Safe Pattern 1: Close External Issue
**Scenario**: Bead is closed, external is open
**Action**: Close external issue with comment
```bash
backend_command close <external-id> --comment "Closed in beads"
```

#### Safe Pattern 2: Update External Content
**Scenario**: Content changed in beads only, external unchanged
**Action**: Update external issue title/description/priority
```bash
backend_command update <external-id> --title "..." --body "..." --priority "..."
```

#### Safe Pattern 3: Update Beads Content
**Scenario**: Content changed in external only, beads unchanged
**Action**: Update bead
```bash
bd update <bead-id> --title "..." --description "..." --priority X
```

#### Safe Pattern 4: Merge Labels
**Scenario**: Labels added in both systems
**Action**: Union of labels (add external labels to beads, beads labels to external)

**Show in summary**: List of auto-resolved changes

### 5.2 Ask User for Conflict Resolution

For real conflicts where both systems changed the same field:

#### Conflict 1: Title Changed in Both

```
question({
  questions: [{
    header: "Title Conflict: oc-ghi3 / github:125",
    question: "Title was changed in both systems. Which version should we keep?",
    options: [
      { label: "Use beads title", description: "Fix authentication timeout (changed 2h ago)" },
      { label: "Use external title", description: "Fix login timeout (changed 5h ago)" },
      { label: "Edit manually", description: "Provide a custom title" },
      { label: "Skip this issue", description: "Don't sync this issue" }
    ]
  }]
})
```

If "Edit manually" selected, prompt for new title and apply to both systems.

#### Conflict 2: Status Conflict (External Closed, Beads Open)

```
question({
  questions: [{
    header: "Status Conflict: oc-jkl4 / github:126",
    question: "Issue is closed in external system but open in beads. What should we do?",
    options: [
      { label: "Close in beads", description: "Respect external closure (recommended)" },
      { label: "Reopen in external", description: "Respect beads open status" },
      { label: "Skip this issue", description: "Leave as-is for now" }
    ]
  }]
})
```

#### Conflict 3: Description Changed in Both

```
question({
  questions: [{
    header: "Description Conflict: oc-mno5 / github:127",
    question: "Description was modified in both systems. Which version should we use?",
    options: [
      { label: "Use beads description", description: "View current beads description" },
      { label: "Use external description", description: "View current external description" },
      { label: "Merge both", description: "Combine both descriptions" },
      { label: "Skip this issue", description: "Don't sync this issue" }
    ]
  }]
})
```

If "Merge both" selected:
```markdown
## Description from Beads
<beads description>

## Description from External System
<external description>

---
*Merged during bidirectional sync on <date>*
```

Apply merged description to both systems.

#### Conflict 4: Priority Changed in Both

```
question({
  questions: [{
    header: "Priority Conflict: oc-pqr6 / github:128",
    question: "Priority was changed in both systems. Which should we use?",
    options: [
      { label: "Use beads priority", description: "P1 (High)" },
      { label: "Use external priority", description: "P2 (Medium)" },
      { label: "Skip this issue", description: "Don't sync this issue" }
    ]
  }]
})
```

### 5.3 Apply User Decisions

After collecting user choices, apply each resolution:

1. Update beads if needed
2. Update external system if needed
3. Track which conflicts were resolved
4. Track which were skipped

## Phase 6: Final Summary

Show comprehensive results of entire bidirectional sync:

### Final Summary Format

```
Bidirectional Sync Complete
============================

Import Phase:
  ✅ Newly imported: 3 issues
  ⏭️  Already imported: 12 issues

Export Phase:
  ✅ Newly exported: 2 beads
  ⏭️  Already exported: 8 beads

Conflict Resolution:
  🟢 Auto-resolved: 5 conflicts
     - 3 closed in beads → closed in external
     - 2 updated content from beads → external
     
  ⚠️  User-resolved: 3 conflicts
     - 1 title conflict (used beads version)
     - 1 status conflict (closed in beads)
     - 1 priority conflict (used external version)
     
  ⏭️  Skipped: 1 conflict
     - oc-xyz9 / github:999 (user chose to skip)

All Systems In Sync ✅

Total issues synced: 15
Total new issues: 5 (3 imported, 2 exported)
```

## Conflict Detection Logic

### Decision Tree

```
For each synced issue:
  ├─ Fetch external state
  ├─ Compare with beads state
  │
  ├─ Status differs?
  │  ├─ Beads closed, External open → Auto-resolve: close external
  │  └─ Beads open, External closed → Ask user
  │
  ├─ Title differs?
  │  ├─ Changed in beads only → Auto-resolve: update external
  │  ├─ Changed in external only → Auto-resolve: update beads
  │  └─ Changed in both → Ask user
  │
  ├─ Description differs?
  │  ├─ Changed in beads only → Auto-resolve: update external
  │  ├─ Changed in external only → Auto-resolve: update beads
  │  └─ Changed in both → Ask user
  │
  ├─ Priority differs?
  │  ├─ Changed in beads only → Auto-resolve: update external
  │  ├─ Changed in external only → Auto-resolve: update beads
  │  └─ Changed in both → Ask user
  │
  └─ Labels differ?
     └─ Merge (union) → Auto-resolve
```

## Error Handling

### Partial Failures

If conflict resolution fails midway:
- Show what was completed successfully
- Show what failed
- Allow retry of failed resolutions
- Don't rollback successful resolutions

### User Cancellation

If user cancels during conflict resolution:
- Save progress of resolved conflicts
- Mark unresolved conflicts as pending
- Show what was completed
- Allow resume later
