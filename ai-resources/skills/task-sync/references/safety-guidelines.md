# Safety Guidelines: Conflict Resolution & Agentic Decisions

Guidelines for safe, user-centric conflict resolution during task synchronization.

## Core Safety Principles

### Principle 1: Never Override Without Checking

Always compare states before making changes. Blindly overwriting data is unsafe.

**Safe pattern**:
```
1. Fetch current state from both systems
2. Compare states
3. Detect differences
4. Show preview of changes
5. Execute update
```

**Unsafe pattern** (never do this):
```
❌ Fetch external issues
❌ Immediately overwrite beads without checking
❌ No preview, no comparison
```

### Principle 2: Agentic Decision Making

The AI model should make autonomous decisions for safe, obvious cases while asking the user for ambiguous situations.

**When to proceed automatically**:
- Only one system changed
- Change is non-destructive (adding data, closing already-closed)
- Clear precedence rule applies
- No data loss risk

**When to ask user**:
- Both systems changed same field
- Destructive operation (deletion, major modification)
- Ambiguous precedence
- Data loss risk

### Principle 3: Show Before Sync

Always preview changes before executing:

**For import**: Show what will be created/updated
**For export**: Show what will be pushed to external
**For bidirectional**: Show all conflicts and planned resolutions

User should always know what's about to happen.

## Safe Change Patterns

These patterns can be auto-resolved without user input:

### Pattern 1: Closing Already-Closed Issue

**Scenario**: Both systems show issue as closed
**Action**: No-op (nothing to do)
**Risk**: None
**Auto-resolve**: Yes

```
Beads: status = closed
External: status = closed
→ Already in sync, skip
```

### Pattern 2: Adding Comment to Existing Issue

**Scenario**: Comment exists in one system, not in other
**Action**: Add comment to system that's missing it
**Risk**: Low (additive, not destructive)
**Auto-resolve**: Yes

```
Beads: has comment "Fixed in PR #123"
External: no comments
→ Add comment to external system
```

### Pattern 3: Updating Metadata (Labels, Priority)

**Scenario**: Labels or priority changed in one system only
**Action**: Update the other system to match
**Risk**: Low (metadata change, not content)
**Auto-resolve**: Yes

```
Beads: priority changed from P2 to P1
External: still P2
→ Update external priority to P1
```

### Pattern 4: Closing Open Issue

**Scenario**: Issue closed in beads, still open in external
**Action**: Close external issue with comment
**Risk**: Low (closing is recoverable, can reopen)
**Auto-resolve**: Yes

```
Beads: status = closed
External: status = open
→ Close external with comment "Closed in beads"
```

Rationale: Beads is source of truth for status. User closed it intentionally.

### Pattern 5: Merging Labels

**Scenario**: Different labels added in each system
**Action**: Union of labels (add all to both)
**Risk**: None (additive)
**Auto-resolve**: Yes

```
Beads labels: ["bug", "priority:high"]
External labels: ["bug", "needs-investigation"]
→ Merge to: ["bug", "priority:high", "needs-investigation"] in both
```

## Unsafe Patterns (Ask User)

These patterns require user decision:

### Pattern 1: Title Changed in Both Systems

**Scenario**: Title modified in both beads and external
**Risk**: High (content conflict, unclear which is correct)
**Auto-resolve**: No

```
Beads title: "Fix authentication timeout"
External title: "Fix login timeout"
→ Ask user which to keep or edit manually
```

**Question to ask**:
```
Title conflict detected for issue <ID>

Beads title: "<beads title>"
External title: "<external title>"

Which version should we keep?
1. Use beads title
2. Use external title  
3. Edit manually (provide new title)
4. Skip this issue
```

### Pattern 2: Issue Closed Externally, Open in Beads

**Scenario**: External system closed issue, beads still open
**Risk**: Medium (may indicate external team decision)
**Auto-resolve**: No

```
Beads: status = open
External: status = closed
→ Ask user which status to honor
```

**Question to ask**:
```
Status conflict detected for issue <ID>

The issue is closed in <external system> but open in beads.

What should we do?
1. Close in beads (respect external closure) - Recommended
2. Reopen in external (respect beads status)
3. Skip this issue (leave as-is)
```

Rationale: External closure may represent team decision or external workflow. Safer to ask.

### Pattern 3: Description Changed in Both

**Scenario**: Description modified in both systems
**Risk**: High (content conflict, both may have valuable info)
**Auto-resolve**: No

```
Beads description: "<beads version>"
External description: "<external version>"
→ Ask user which to keep or merge
```

**Question to ask**:
```
Description conflict detected for issue <ID>

Both systems have modified descriptions.

What should we do?
1. Use beads description
2. Use external description
3. Merge both (combine into single description)
4. Skip this issue
```

If user chooses "merge", create combined description:
```markdown
## Description from Beads
<beads description>

## Description from External System
<external description>

---
*Merged during sync on <date>*
```

### Pattern 4: Priority Changed in Both

**Scenario**: Priority modified in both systems to different values
**Risk**: Medium (priority conflict, business decision)
**Auto-resolve**: No

```
Beads priority: P1 (changed from P2)
External priority: P3 (changed from P2)
→ Ask user which priority to use
```

**Question to ask**:
```
Priority conflict detected for issue <ID>

Beads priority: P1 (High)
External priority: P3 (Low)

Which priority should we use?
1. Use beads priority (P1)
2. Use external priority (P3)
3. Skip this issue
```

### Pattern 5: Deletion Requests

**Scenario**: User wants to delete issues or sync deletions
**Risk**: Very high (data loss, irreversible)
**Auto-resolve**: No

```
User: "Delete external issue #123"
→ Ask explicit confirmation
```

**Confirmation required**:
```
⚠️  DESTRUCTIVE OPERATION WARNING ⚠️

You're about to delete issue <ID> from <system>.
This action cannot be undone.

Are you sure?
1. Yes, delete permanently
2. No, cancel operation
```

Never delete without explicit, emphatic user confirmation.

## Agentic Decision Tree

Use this tree to decide whether to auto-resolve or ask user:

```
Conflict detected
│
├─ Is this a safe change pattern?
│  ├─ Yes → Check risk level
│  │  ├─ Risk = None/Low
│  │  │  └─ AUTO-RESOLVE ✅
│  │  └─ Risk = Medium/High
│  │     └─ ASK USER ⚠️
│  └─ No → Check if destructive
│     ├─ Destructive operation?
│     │  └─ Yes → ASK USER (+ strong warning) 🚨
│     └─ Content conflict in both systems?
│        └─ Yes → ASK USER ⚠️
│
└─ Unknown pattern?
   └─ ASK USER (safer default) ⚠️
```

### Risk Assessment Criteria

**None**: No data loss possible, easily reversible
- Examples: Adding labels, adding comments

**Low**: Minimal data loss, easily reversible  
- Examples: Closing issue (can reopen), updating priority

**Medium**: Potential data loss, reversible with effort
- Examples: Updating content, changing status

**High**: Data loss likely, difficult to reverse
- Examples: Overwriting descriptions, title conflicts

**Very High**: Irreversible data loss
- Examples: Deletion, permanent closure

## Conflict Resolution Examples

### Example 1: Safe Auto-Resolve

**Scenario**: Priority changed in beads, unchanged externally

```
Detection:
  Beads: priority = P1 (modified 2h ago)
  External: priority = P2 (unchanged)
  
Risk Assessment:
  - Only one system changed: ✓ Safe
  - Change type: Metadata update (low risk)
  - Reversible: Yes (can change back)
  
Decision: AUTO-RESOLVE
Action: Update external priority to P1
Message: "Auto-updated priority for issue #123 to match beads (P1)"
```

### Example 2: Ask User for Conflict

**Scenario**: Title changed in both systems

```
Detection:
  Beads: title = "Fix authentication timeout" (modified 1h ago)
  External: title = "Fix login timeout" (modified 3h ago)
  
Risk Assessment:
  - Both systems changed: ⚠️ Conflict
  - Change type: Content (high risk)
  - Unclear precedence
  
Decision: ASK USER
Question:
  "Title conflict for issue #123
   
   Beads: 'Fix authentication timeout' (1h ago)
   External: 'Fix login timeout' (3h ago)
   
   Which version should we keep?
   1. Use beads title
   2. Use external title
   3. Edit manually
   4. Skip this issue"
```

### Example 3: Ask User with Recommendation

**Scenario**: Issue closed externally, open in beads

```
Detection:
  Beads: status = open
  External: status = closed (2 days ago)
  
Risk Assessment:
  - Both systems differ: ⚠️ Conflict
  - External closure may be deliberate team decision
  - Recommendation: Respect external closure
  
Decision: ASK USER (with recommendation)
Question:
  "Status conflict for issue #123
   
   External system shows this issue was closed 2 days ago,
   but it's still open in beads.
   
   What should we do?
   1. Close in beads (recommended) ← External team may have closed it
   2. Reopen in external
   3. Skip this issue"
```

## Preview Format Standards

### For Auto-Resolved Changes

```
Auto-resolved <count> safe changes:
  ✅ oc-abc1: Closed external issue (already closed in beads)
  ✅ oc-def2: Updated external priority P2→P1 (changed in beads)
  ✅ oc-ghi3: Added comment to external (exists in beads)
```

### For User Conflicts

```
⚠️  <count> conflicts require your decision:
  
  [Conflict 1 of 3]
  Issue: oc-abc1 / github:123
  Type: Title conflict
  
  Beads: "Fix authentication timeout"
  External: "Fix login timeout"
  
  Your choice: ____
```

### For Destructive Operations

```
🚨 DESTRUCTIVE OPERATION WARNING 🚨

You're about to:
  - Delete issue #123 from GitHub
  - This will permanently remove the issue
  - This action CANNOT be undone
  
Are you absolutely sure?
Type 'DELETE' to confirm: ____
```

## Error Handling During Resolution

If resolution fails midway:

1. **Show partial success**: List what was completed
2. **Show failures**: List what failed with reasons
3. **Don't rollback**: Keep successful resolutions
4. **Offer retry**: Allow retry of failed resolutions only
5. **Log everything**: Track for debugging

Example:
```
Conflict Resolution: Partial Failure
=====================================

✅ Successfully resolved: 5 conflicts
❌ Failed to resolve: 2 conflicts

Failed Resolutions:
  - oc-abc1: Network error updating external system
  - oc-def2: Permission denied (can't modify external issue)
  
Would you like to retry the failed resolutions?
1. Yes, retry now
2. No, skip these
```
