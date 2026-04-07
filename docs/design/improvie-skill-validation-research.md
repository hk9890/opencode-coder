# Improve Skill Validation Research

## Purpose

This note captures the problems observed during skill-validation and acceptance-review work for the additive split of `coder-core`, `coder-beads`, and `coder-docs`.

This document is intentionally limited to problem description. It does **not** propose fixes or solutions.

## Problem summary

The main issue is that skill validation is not failing for one single reason. It is failing because several different validation layers are mixed together and interpreted inconsistently:

- skill-behavior correctness
- eval-runner measurement behavior
- runtime-cost attribution
- acceptance-policy interpretation
- environment availability
- backlog/issue-management expectations

When these layers are checked together, the result is slow verification, unstable conclusions, and repeated disagreement about whether a result is a real product bug, an eval artifact, an environment limitation, or a bookkeeping problem.

## Observed problem areas

### 1. Acceptance checks are too broad and overloaded

The acceptance reviews for additive skills are not simple pass/fail checks. In practice they combine multiple different questions:

- did the skill route correctly?
- did functional evals pass?
- did repeated bounded trigger runs stay stable?
- were existing files untouched?
- do skipped environment-dependent tests count as blockers?
- should old recorded evidence be reused or rerun?
- if something looks wrong, is it a new bug or not?

Because all of these questions are bundled into one verification activity, the reviewer has to perform interpretation work instead of only checking evidence.

### 2. Acceptance criteria are not self-executing

Several acceptance criteria require interpretation before they can be applied.

Examples observed in this session:

- "Existing files remain untouched" could mean:
  - the current worktree must be clean, or
  - the original rollout delta must show no edits to protected existing surfaces
- "Acceptance checks pass" could mean:
  - every current test/eval command passes in the current shell, or
  - the accepted evidence set may combine prior validated artifacts plus current reruns for only the last blocker
- environment-gated e2e checks could mean:
  - a skipped test is a blocker, or
  - a skipped test is unverified but not a product defect

Because these interpretations are not embedded directly in the acceptance task itself, verification repeatedly drifts.

### 3. Validation mixes product bugs with measurement bugs

During this work, several apparent skill failures were actually caused by eval infrastructure rather than by the skill being validated.

Observed categories included:

- timeout classification bugs
- partial-signal extraction bugs
- repeated-run instability under bounded timeouts
- path/preflight issues for `opencode`
- functional-runner isolation/setup problems
- unrealistic or overly open-ended eval prompts

This creates a recurring ambiguity: a failed validation run does not clearly indicate whether the problem is in the skill or in the validation mechanism.

### 4. Trigger-eval results are hard to interpret under timeout pressure

Bounded trigger validation often produced mixed outcomes such as:

- `tool_use`
- `timeout_after_trigger`
- `timeout_without_trigger`
- `available_but_not_used`
- intermittent per-run disagreement across repeated runs

This means a query may appear stable at the query-summary level while still showing noisy per-run behavior. It also means negative prompts can appear fixed in one artifact but still reproduce intermittently in repeated runs.

As a result, validation requires detailed artifact interpretation rather than straightforward pass/fail reading.

### 5. Functional evals can accidentally measure workspace shape instead of skill quality

Some functional prompts behaved very differently depending on what the disposable workspace looked like.

Observed examples included:

- nearly empty workspaces causing the model to treat `.opencode/` as the target repo
- prompts that encouraged broad document creation instead of bounded setup reasoning
- environment/tool resolution affecting later evals in the same suite

In these cases, the eval failure was not purely about the skill instructions. It was also about whether the workspace and prompt shape created a realistic validation target.

### 5a. Functional eval slowness is real, but the cost is easy to misattribute

During follow-up investigation of `coder-beads` functional eval runtime, the full 8-eval suite took about 319 seconds total (roughly 5.3 minutes) when run sequentially. Individual evals ranged from about 16.8 seconds to 89.7 seconds, with an average of about 39.9 seconds and median of about 27.5 seconds.

The important observation is that the outer functional-eval runner itself was only a very small fraction of the total runtime. Measured against the captured artifacts:

- about 99.2% of total suite time was spent inside `opencode run`
- about 0.8% was spent in outer runner work such as workspace setup, skill injection, artifact writing, snapshotting, and cleanup

Within `opencode run`, there was also repeated cold-start work on every eval because each run uses a fresh isolated workspace and isolated OpenCode environment. Logs repeatedly showed:

- one-time database migration
- dependency checking / `node_modules` reifying
- skill initialization
- fresh session and tool-registry bootstrap

However, that repeated bootstrap was still not the dominant cost in the measured run. Estimated from log timing, the repeated OpenCode startup path was only about 1.8-2.2 seconds per eval (roughly 5% of total suite time). The much larger share was actual session execution: model reasoning, tool usage, shell commands, and in some cases subagent waits.

Observed examples from the measured run:

- one slow eval consumed about 89 seconds while issuing around 20 bash calls during planning work
- another slow eval consumed about 73 seconds even with little direct tool activity because most time was spent waiting on a spawned subagent result

This creates a recurring interpretation problem: functional validation feels "runner slow," but the evidence shows that most of the wall-clock cost comes from actual OpenCode session behavior rather than from the Python wrapper around it.

### 6. Environment-dependent tests do not map cleanly to product status

The additive isolated e2e tests depend on environment tooling such as `aimgr` being available. In this session, those tests could be skipped because the tool was not installed in the current environment.

That creates an unresolved interpretation problem:

- the product may be correct
- the test may be correct
- but the current environment cannot execute the test

This makes it unclear whether the result should be treated as:

- a blocker
- an unverified criterion
- an environment limitation
- or a follow-up issue

### 7. Backlog hygiene and verification logic are entangled

Acceptance review often led directly to issue creation, issue closure, dependency changes, or scope reinterpretation. That means verification is not only validating evidence; it is also mutating backlog structure.

Observed effects included:

- new bugs being filed from verifier findings
- later bugs being closed as non-bugs after broader context review
- duplicate or stale blockers being carried forward until manually corrected
- blocker sets changing during the same acceptance lane

This makes verification results harder to trust as stable outputs because the reviewer is simultaneously auditing, triaging, and redefining the problem set.

### 8. Historical precedent matters, but it is not encoded where verification happens

The additive-skill acceptance reviews relied on prior accepted precedent, especially for how to interpret the no-touch requirement and how to reuse already-recorded evidence.

However, that precedent was captured across comments and prior issue history rather than embedded cleanly into the active acceptance task. As a result, each fresh verification had to rediscover or reinterpret the precedent.

This led to repeated re-litigation of questions that had already been answered elsewhere.

### 9. Large verifier tasks are brittle

Broad verification attempts repeatedly became slow or unproductive because they required the verifier to do too many things at once:

- inspect many issues
- inspect many artifacts
- compare current state to historical state
- decide policy interpretation
- decide whether something is a blocker
- decide whether a new issue should exist
- produce closure guidance

The larger the verification scope became, the more likely it was to drift, stall, or produce questionable blocker logic.

### 10. Full-suite functional validation encourages expensive reruns even when only one scenario changed

The functional runner processes selected evals sequentially, and when no eval-id filter is used it runs the entire suite. In the measured `coder-beads` case, that meant paying the full multi-minute cost across all 8 evals even though the expensive portion was dominated by per-eval OpenCode execution.

Because runtime cost is not obvious from the command surface, it is easy to treat a full rerun as a routine validation step instead of as a relatively expensive evidence-gathering action. This increases the chance of repeated broad reruns during discussion, debugging, and acceptance work, which in turn makes validation feel disproportionately heavy compared with the actual scope of the question being checked.

## Overall finding

The core problem is not just that some evals fail. The larger problem is that the current skill-validation process combines evidence gathering, runtime measurement, measurement interpretation, policy interpretation, and backlog mutation into one activity.

Because of that, validation is slower than it should be, repeated verifier passes can disagree with each other, runtime cost is often blamed on the wrong layer, and progress appears to stall even when implementation work is actually moving forward.
