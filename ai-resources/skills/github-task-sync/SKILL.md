---
name: github-task-sync
description: "GitHub backend for task synchronization. Syncs beads issues with GitHub issues bidirectionally using gh CLI. Use when: (1) User wants to sync with GitHub specifically, (2) Task-sync skill delegates to GitHub backend, (3) User mentions 'GitHub issues', 'gh sync', or 'import from GitHub'. Implements import (GitHub → beads), export (beads → GitHub), and bidirectional workflows."
---

# GitHub Task Sync

GitHub-specific backend for bidirectional task synchronization using gh CLI.

**Important**: Load `task-sync` skill for workflow orchestration guidance. If not loaded, load it first:

```
skill({ name: "task-sync" })
```

The task-sync skill provides system-agnostic workflow guidance, while this skill implements GitHub-specific commands.

## Prerequisites

Before any sync operation, verify environment prerequisites by running:

```bash
bash scripts/check-gh-auth.sh
```

This script checks:
1. **GitHub CLI authenticated**: `gh auth status` succeeds
2. **Beads CLI available**: `bd stats` works
3. **Repository detected**: Git remote points to GitHub repo

**If prerequisites fail**: The script provides clear error messages and resolution steps.

**For error scenarios**: See [references/error-handling.md](references/error-handling.md)

## Import: GitHub → Beads

Import open GitHub issues into beads tracking system.

### High-Level Workflow

1. **Run prerequisites check**: Ensure environment is ready
2. **Fetch open issues**: Get all open GitHub issues from repository
3. **For each issue**:
   - Check if already imported (deduplication via labels)
   - Determine priority from GitHub labels
   - Create bead with labels: `source:external`, `github:<number>`
4. **Show import summary**: Report imported count, skipped count, and details

### Commands Reference

**Fetch issues**:
```bash
gh issue list --repo $REPO --state open --json number,title,body,labels,createdAt --limit 100
```

**Check for existing bead**:
```bash
bd list --json | jq '.[] | select(.labels[]? == "github:<number>")'
```

**Create bead**:
```bash
bd create \
  --title="<title> (github:#<number>)" \
  --type=bug \
  --priority=<mapped-priority> \
  --label="source:external" \
  --label="github:<number>"
```

**For detailed gh commands**: See [references/gh-commands.md](references/gh-commands.md)

**For priority mapping**: See [references/label-mapping.md](references/label-mapping.md)

**For complete workflow**: See task-sync/references/import-workflow.md

### Import Summary Format

```
Import Results
==============

✅ Imported 3 new issues
⏭️  Skipped 5 issues (already in beads)

New Issues:
┌─────────┬──────────────┬────────────────────────────────┬──────────┐
│ Bead ID │ GitHub #     │ Title                          │ Priority │
├─────────┼──────────────┼────────────────────────────────┼──────────┤
│ oc-abc1 │ github:123   │ Fix login timeout              │ P1       │
│ oc-def2 │ github:124   │ Add dark mode                  │ P2       │
└─────────┴──────────────┴────────────────────────────────┴──────────┘
```

## Export: Beads → GitHub

Export beads issues to GitHub (create GitHub issues from beads).

### High-Level Workflow

1. **Find eligible beads**: Beads without `github:` label (not yet exported)
2. **Show summary to user**: Count and list of beads to export
3. **Ask confirmation**: User selects which beads to export
4. **For each selected bead**:
   - Map priority and type to GitHub labels
   - Create GitHub issue with metadata footer and `beads:<id>` back-reference label
   - Capture GitHub issue number
   - Add `github:<number>` label to bead
5. **Show export summary**: Report exported count and GitHub URLs

### Commands Reference

**Find eligible beads**:
```bash
bd list --json | jq '.[] | select(any(.labels[]?; startswith("github:")) | not)'
```

**Create GitHub issue**:
```bash
gh issue create --repo $REPO \
  --title "<bead-title>" \
  --body "<bead-description>\n---\n*Created from beads issue: <bead-id>*\n*Priority: P<priority>*\n*Type: <type>*" \
  --label "<priority-label>" \
  --label "<type-label>" \
  --label "beads:<bead-id>"
```

**Update bead with GitHub label**:
```bash
bd update <bead-id> --label "github:<number>"
```

**For detailed gh commands**: See [references/gh-commands.md](references/gh-commands.md)

**For priority mapping**: See [references/label-mapping.md](references/label-mapping.md)

**For complete workflow**: See task-sync/references/export-workflow.md

### Export Summary Format

```
Export Results
==============

✅ Exported 2 beads to GitHub

Exported Issues:
┌─────────┬──────────────┬────────────────────────────────────────────────────┐
│ Bead ID │ GitHub #     │ URL                                                │
├─────────┼──────────────┼────────────────────────────────────────────────────┤
│ oc-abc3 │ github:125   │ https://github.com/owner/repo/issues/125           │
│ oc-def4 │ github:126   │ https://github.com/owner/repo/issues/126           │
└─────────┴──────────────┴────────────────────────────────────────────────────┘
```

## Bidirectional Sync

Combined import + export with conflict detection and resolution.

### High-Level Workflow

1. **Run import workflow**: GitHub → beads (fetch external changes first)
2. **Detect conflicts**: Compare beads vs GitHub for existing synced issues
3. **Run export workflow**: Beads → GitHub (push local changes)
4. **Resolve conflicts**: Auto-resolve safe changes, ask user for conflicts

### Conflict Detection

For issues that exist in both systems (have `github:` label):

**Status conflicts**:
- Bead closed, GitHub open → Auto-close GitHub
- Bead open, GitHub closed → Ask user

**Content conflicts**:
- Title changed in beads only → Auto-update GitHub
- Title changed in GitHub only → Auto-update beads
- Title changed in both → Ask user

**Priority conflicts**:
- Priority changed in one system → Auto-update other
- Priority changed in both → Ask user

### Commands Reference

**Close GitHub issue**:
```bash
gh issue close <number> --repo $REPO --comment "Closed in beads"
```

**Update GitHub issue**:
```bash
gh issue edit <number> --repo $REPO --title "<new-title>" --body "<new-description>"
```

**Update GitHub labels**:
```bash
gh issue edit <number> --repo $REPO --remove-label "old-priority" --add-label "new-priority"
```

**For GitHub-specific conflicts**: See [references/bidirectional-workflow.md](references/bidirectional-workflow.md)

**For orchestration workflow**: See task-sync/references/bidirectional-workflow.md

**For conflict resolution patterns**: See task-sync/references/safety-guidelines.md

### Bidirectional Summary Format

```
Bidirectional Sync Complete
============================

Import: ✅ 3 new, ⏭️ 5 already imported
Export: ✅ 2 new, ⏭️ 4 already exported

Conflicts Resolved:
  🟢 Auto-resolved: 3 conflicts
     - Closed 2 GitHub issues (closed in beads)
     - Updated 1 GitHub title (changed in beads)
  
  ⚠️  User-resolved: 1 conflict
     - Issue #123: Title conflict (used beads version)

All systems in sync ✅
```

## Error Handling

Common error scenarios and resolutions:

### gh CLI Errors

- **Not installed**: Install from https://cli.github.com
- **Not authenticated**: Run `gh auth login`
- **Rate limiting**: Wait ~60 min or check `gh api rate_limit`
- **404 Not Found**: Verify repository exists and is accessible
- **403 Forbidden**: Check permissions (need write access)

### bd CLI Errors

- **Not found**: Install beads CLI
- **Not in beads project**: Run `bd init --skip-agents` (or `bd init --stealth --skip-agents`) or navigate to a beads project
- **Create failed**: Check bead parameters and .beads/ permissions

### Sync Errors

- **Duplicate import**: Skip (already imported) - expected behavior
- **Failed to create bead**: Log error, continue with remaining issues
- **Failed to create GitHub issue**: Show error, offer retry

**For complete error guide**: See [references/error-handling.md](references/error-handling.md)
