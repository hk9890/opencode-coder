Following the external bug pattern from the skill: bug with `source:external` label + linked post-mortem task.

I'll create the bug and post-mortem now. The bug is a customer-reported crash (P1), so I'll use `source:external` and link a post-mortem task.

First, create the bug:

```bash
cat << 'EOF' | bd create --title="Checkout flow crashes with cart > 50 items" --type=bug --priority=1 --labels=source:external --body-file -
## Description
Customer reported that the checkout flow crashes when the cart contains more than 50 items. Reproduced with a rough repro provided by the customer. A screenshot was also submitted.

## Steps to Reproduce
1. Add more than 50 items to the cart
2. Proceed to checkout
3. Observe: checkout flow crashes (exact error unknown — needs investigation)

## Expected Behavior
Checkout completes normally regardless of cart size.

## Actual Behavior
Checkout crashes when cart item count exceeds 50.

## Evidence
- Customer screenshot provided (attach to this issue)
- Rough repro provided by customer

## Open Questions
- [ ] What is the exact error/exception thrown?
- [ ] Does it crash at cart render, on submit, or during order creation?
- [ ] Is 50 a hard limit somewhere (pagination, API cap, array slice)?
- [ ] Is this reproducible in staging?

## Acceptance Criteria
- [ ] Root cause identified
- [ ] Fix applied and does not regress with 1, 10, 50, 51, 100 item carts
- [ ] Regression test added covering cart size > 50
- [ ] No new lint errors
EOF
```

Then, create the post-mortem task:

```bash
cat << 'EOF' | bd create --title="Post-mortem: Checkout crash for large carts" --type=task --priority=3 --body-file -
## Description
Post-mortem for the customer-reported checkout crash when cart exceeds 50 items.

## Post-mortem Questions
- [ ] Why wasn't this caught before reaching a customer?
- [ ] Is there a test coverage gap for large-cart scenarios?
- [ ] Are there similar off-by-one or size-cap issues elsewhere in the order flow?
- [ ] What process change prevents this class of bug from reaching production?

## Instructions
1. After the bug is fixed, review the fix and its root cause
2. Answer each post-mortem question above
3. Open follow-up chores for any systemic gaps found (e.g. missing cart size tests, missing input validation)
4. Document findings in this issue's notes

## Acceptance Criteria
- [ ] All post-mortem questions answered
- [ ] Any systemic gaps have follow-up issues created
- [ ] Findings documented
EOF
```

Then link the post-mortem to depend on the bug:

```bash
bd dep add <postmortem-id> <bug-id>
```

---

Since I can't execute shell commands directly, here is the exact sequence you (or an agent) should run — ready to copy-paste:

```bash
# 1. Create the bug
BUG_ID=$(cat << 'EOF' | bd create --title="Checkout flow crashes with cart > 50 items" --type=bug --priority=1 --labels=source:external --body-file - | grep -oP 'oc-\w+'
## Description
Customer reported that the checkout flow crashes when the cart contains more than 50 items. A screenshot and rough repro were provided.

## Steps to Reproduce
1. Add more than 50 items to the cart
2. Proceed to checkout
3. Observe: checkout flow crashes

## Expected Behavior
Checkout completes normally regardless of cart size.

## Actual Behavior
Checkout crashes when cart item count exceeds 50.

## Evidence
- Customer screenshot provided
- Rough repro provided by customer

## Open Questions
- [ ] Exact error/exception thrown?
- [ ] Does it crash at cart render, on submit, or during order creation?
- [ ] Is 50 a hard limit somewhere (pagination, API cap, array slice)?
- [ ] Reproducible in staging?

## Acceptance Criteria
- [ ] Root cause identified
- [ ] Fix applied; does not regress with 1, 10, 50, 51, 100 item carts
- [ ] Regression test added for cart size > 50
- [ ] No new lint errors
EOF
)

# 2. Create the post-mortem task
PM_ID=$(cat << 'EOF' | bd create --title="Post-mortem: Checkout crash for large carts" --type=task --priority=3 --body-file - | grep -oP 'oc-\w+'
## Description
Post-mortem for the customer-reported checkout crash when cart exceeds 50 items. Run after the bug is fixed.

## Post-mortem Questions
- [ ] Why wasn't this caught before reaching a customer?
- [ ] Is there a test coverage gap for large-cart scenarios?
- [ ] Are there similar size-cap issues elsewhere in the order flow?
- [ ] What process change prevents recurrence?

## Instructions
1. After the bug fix is merged, review root cause
2. Answer all post-mortem questions
3. Open follow-up chores for any systemic gaps found
4. Document findings in this issue's notes

## Acceptance Criteria
- [ ] All post-mortem questions answered
- [ ] Systemic gaps have follow-up issues created
- [ ] Findings documented
EOF
)

# 3. Link: post-mortem depends on bug fix
bd dep add $PM_ID $BUG_ID
```

**What this creates:**

| Issue | Type | Priority | Labels |
|---|---|---|---|
| Checkout flow crashes with cart > 50 items | `bug` | P1 | `source:external` |
| Post-mortem: Checkout crash for large carts | `task` | P3 | *(none)* |

The post-mortem is blocked on the bug, so it won't appear in `bd ready` until the bug is fixed. The bug's open questions (exact error, crash location, staging repro) are captured inline so an investigator knows exactly what to determine before writing a fix.
