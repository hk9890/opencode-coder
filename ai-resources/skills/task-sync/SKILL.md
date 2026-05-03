---
name: task-sync
description: "Bidirectional synchronization between beads and external task systems (GitHub, Jira, etc.). Use when: (1) User wants to sync tasks or issues with external systems, (2) Import external issues into beads, (3) Export beads to external systems, (4) User mentions 'sync', 'GitHub issues', 'Jira tickets', 'import bugs', or 'export tasks'. Orchestrates workflow and delegates to backend-specific skills."
---

# Task Sync

Orchestrate bidirectional synchronization between beads and external task tracking systems.

## Decision Tree

When this skill loads, follow these steps:

### 1. Determine Sync Direction

Identify what the user wants:

- **Import** (external → beads): User wants to fetch issues from external system into beads
- **Export** (beads → external): User wants to push beads issues to external system
- **Bidirectional**: User wants to sync both directions with conflict resolution

If unclear from context, use question tool to ask user:

```
question({
  questions: [{
    header: "Sync Direction",
    question: "What type of sync would you like to perform?",
    options: [
      { label: "Import (external → beads)", description: "Fetch external issues into beads" },
      { label: "Export (beads → external)", description: "Push beads issues to external system" },
      { label: "Bidirectional", description: "Sync both directions with conflict detection" }
    ]
  }]
})
```

### 2. Detect Backend System

Check which backend skills are available:

- Look for a skill that syncs with GitHub Issues
- Look for a skill that syncs with Jira (future)
- Look for other task system sync skills

If exactly one backend available → use it automatically
If multiple backends available OR none → ask user which system to sync with

### 3. Load Backend Skill

Load the appropriate backend skill for the detected task system using the skill tool.

Pass context about sync direction to backend. Backend follows workflows defined in reference files.

## Import Workflow

High-level steps for importing external issues into beads:

1. Backend fetches open issues from external system
2. Check for duplicates (skip issues already imported by checking labels)
3. Map external data to beads format (priority, labels, metadata)
4. Create beads with appropriate labels (`source:external`, `system:ID`)
5. Show import summary to user (count, table of imported issues)

**For detailed workflow**: Load [references/import-workflow.md](references/import-workflow.md)

## Export Workflow

High-level steps for exporting beads issues to external system:

1. Identify eligible beads (no external ID label, appropriate types)
2. Show summary to user with count and table
3. Ask user confirmation: "Export all? Select specific? Cancel?"
4. For each selected bead:
   - Map beads data to external format
   - Create external issue (backend-specific command)
   - Capture external ID and add label to bead
5. Show export summary (count, mappings, any errors)

**For detailed workflow**: Load [references/export-workflow.md](references/export-workflow.md)

## Bidirectional Workflow

High-level steps for bidirectional sync with conflict detection:

1. Run import workflow (external → beads)
2. Collect import results
3. Detect potential conflicts between systems:
   - Status conflicts (closed in one, open in other)
   - Content conflicts (title/description changed in both)
   - Metadata conflicts (priority changed in both)
4. Show import summary including conflicts detected
5. Run export workflow (beads → external)
6. Resolve conflicts using safety guidelines:
   - Auto-resolve safe changes
   - Ask user for conflict resolution
7. Show final summary (import + export counts, conflicts resolved)

**For detailed workflow**: Load [references/bidirectional-workflow.md](references/bidirectional-workflow.md)

## Safety Principles

### Rule 1: Never Override Without Checking

Always compare states before updating. Show user what will change before applying sync.

Safe pattern:
```
Current state: GitHub issue #123 is open
Beads state: Issue is closed
Action: Close GitHub issue
```

Unsafe pattern:
```
❌ Blindly overwriting without showing preview
❌ No comparison of states
```

### Rule 2: Agentic Decision Making

Model should make decisions autonomously for safe changes, but ask user for conflicts:

**Auto-proceed (safe changes)**:
- Closing already-closed issue (no-op)
- Adding comments to existing issue
- Updating metadata (labels, priority) when only one side changed

**Ask user (conflicts)**:
- Both systems changed same field (title, description)
- Status conflicts (closed vs open in different systems)
- Priority conflicts (changed in both systems)
- Deleting or major destructive operations

### Rule 3: Show Summary Before Sync

Always preview before executing:

- What will be imported (count, list)
- What will be exported (count, list)
- Any conflicts detected (with options for resolution)

Example preview:
```
Import Summary:
  - 5 new issues to import from GitHub
  - 2 issues already imported (skipped)
  
Export Summary:
  - 3 beads eligible for export
  - 1 bead already exported (skipped)
  
Conflicts Detected:
  - Issue #123: Title changed in both systems
  - Issue #456: Closed in beads, open in GitHub
```

**For conflict resolution guide**: Load [references/safety-guidelines.md](references/safety-guidelines.md)

## Metadata Conventions

### Label Patterns

- `source:external` - Issue was imported from external system
- `github:123` - Links to GitHub issue #123
- `jira:PROJ-456` - Links to Jira ticket PROJ-456
- (Pattern: `system:id` for any external system)

### Direction Tracking

How to determine sync direction from labels:

- Has `source:external` + `system:ID` → Imported FROM external (import source)
- Has `system:ID` only (no source label) → Created in beads, exported TO external

### External ID Capture

When exporting beads to external system:

1. Create external issue using backend-specific command
2. Capture external ID from response
3. Add label `system:ID` to bead (e.g., `github:123`)
4. Do NOT add `source:external` label (indicates direction)
