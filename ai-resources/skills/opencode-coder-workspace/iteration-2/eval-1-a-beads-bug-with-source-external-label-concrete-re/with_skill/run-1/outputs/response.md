Following the `External Bug Handling` pattern from `planning.md`: create the bug with `source:external`, then a linked post-mortem task.

**Step 1 — Create the bug:**

```bash
cat << 'EOF' | bd create --title="Checkout flow crashes when cart has more than 50 items" --type=bug --priority=1 --labels=source:external --body-file -
## Description
Customer reported that the checkout flow crashes when the cart contains more than 50 items. A screenshot and rough repro steps were provided.

## Steps to Reproduce
1. Add more than 50 items to the cart
2. Proceed to checkout
3. Observe: checkout flow crashes

## Expected Behavior
Checkout completes normally regardless of cart size.

## Actual Behavior
Checkout flow crashes. Exact error unknown — screenshot provided by customer, full stack trace not yet captured.

## Open Questions
- [ ] What is the crash error/stack trace? (needs repro in staging)
- [ ] Is the threshold exactly 50, or does it vary?
- [ ] Does it affect all users or specific account types?

## Notes
Source: customer report with screenshot + rough repro. Needs engineering repro to confirm root cause.
EOF
```

**Step 2 — Create the post-mortem task:**

```bash
cat << 'EOF' | bd create --title="Post-mortem: Checkout crash on large cart" --type=task --priority=3 --body-file -
## Description
Post-mortem for the customer-reported checkout crash when cart > 50 items. Run after the bug is fixed.

## Post-mortem Questions
- [ ] Why wasn't this caught in testing? (no test coverage for large carts?)
- [ ] Is there a missing load/stress test for cart size limits?
- [ ] Are there similar item-count thresholds elsewhere in the purchase flow (e.g. order summary, shipping calc)?
- [ ] What process change prevents similar regressions?

## Instructions
1. After bug fix is merged, hold a short post-mortem or async doc review
2. Answer each question above
3. Create follow-up tasks for any identified gaps (e.g. add integration test for 50+ item cart)
4. Update this issue with findings before closing
EOF
```

**Step 3 — Link post-mortem to bug (post-mortem depends on bug being fixed first):**

```bash
bd dep add <postmortem-id> <bug-id>
```

---

**Summary of what this creates:**

| Issue | Type | Priority | Labels |
|---|---|---|---|
| Checkout flow crashes when cart > 50 items | `bug` | P1 | `source:external` |
| Post-mortem: Checkout crash on large cart | `task` | P3 | _(none)_ |

The post-mortem is dependency-linked to the bug so it only appears in `bd ready` after the bug is closed. The bug has `has:open-questions` details inline but isn't blocked — an engineer can still start reproducing it immediately.

Run the three commands above substituting the real IDs from `bd create` output. Want me to run them directly?
