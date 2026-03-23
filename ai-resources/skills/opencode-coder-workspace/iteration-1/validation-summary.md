# opencode-coder skill validation summary

## Overall assessment

- **Content quality:** strong
- **Behavior benchmark:** with-skill mean pass rate **0.91** vs baseline **0.68**
- **Runtime trigger validation:** failed in this environment (**0/10** should-trigger prompts fired)

## Strong areas

- Planning guidance materially improves beads-specific structure and conventions.
- Troubleshooting guidance materially improves plugin-vs-project classification and recovery advice.
- Docs lifecycle, simplify, and setup guidance are coherent and mostly complete.

## Gaps found

1. **Broken internal link**
   - `references/troubleshooting-patterns.md` links to `#reporting-issues`, but that anchor does not exist in the file.

2. **Planning response gap**
   - The skill-guided planning response did not surface `bd ready` / `bd blocked` as a pre-execution orientation step.

3. **Troubleshooting response gap**
   - The skill-guided troubleshooting response did not clearly distinguish **session export** vs **diagnostics bundle**.

4. **Simplify output-shape gap**
   - The response covered the required fields, but not as a clear final structured summary block.

5. **Triggerability risk**
   - Trigger evals produced 0/10 should-trigger hits. This may indicate description under-triggering and/or a harness mismatch for published `ai-resources` skills, so real installed-skill trigger testing is still required.

## Artifacts

- Benchmark: `ai-resources/skills/opencode-coder-workspace/iteration-1/benchmark.json`
- Review page: `ai-resources/skills/opencode-coder-workspace/iteration-1/review.html`
- Trigger evals: `ai-resources/skills/opencode-coder-workspace/trigger-eval-results.json`
- Evals: `ai-resources/skills/opencode-coder/evals/evals.json`
- Trigger eval set: `ai-resources/skills/opencode-coder/evals/trigger-evals.json`
