/**
 * Phase 1 bootstrap template for runtime /opencode-coder/init.
 *
 * This is a command template — it contains instructions for the AI agent
 * (not the user directly). It intentionally handles only bootstrap concerns:
 * prerequisite detection, install guidance, and early mode capture.
 */
export function getInstallGuideTemplate(): string {
  return `
# opencode-coder Bootstrap Init (Phase 1)

Use this template only for Phase 1 runtime bootstrap, before full opencode-coder markdown resources are available.

## Scope

You MUST only do these Phase 1 responsibilities:
1. Detect prerequisites and current startup mode.
2. Ask the user for desired mode early (stealth, team, remain inactive/disabled).
3. Guide or perform installation steps for missing prerequisites/resources.
4. If resources become available, stop and hand off to Phase 2 by instructing restart/reopen.

Do NOT run durable Phase 2 workflow here (no docs lifecycle, no AGENTS generation, no beads setup orchestration, no long mode-transition procedures).

## Step 1 — Confirm desired mode early

Before installation actions, use \`question()\` to capture what the user wants:
- For fresh/not-enabled: \`Enable stealth mode\`, \`Enable team mode\`, \`Remain inactive\`
- For saved disabled: \`Enable stealth mode\`, \`Enable team mode\`, \`Remain disabled\`
- For active mode: \`Keep current mode\`, \`Switch mode\`, \`Disable startup\`

Persist only minimal mode intent in \`.coder/opencode-coder.yaml\` when the user chooses an explicit mode change.

If user chooses to remain inactive/disabled, stop and clearly report degraded Phase 1 state.

## Step 2 — Prerequisite checks and interactive guidance

Use project context facts (git, bd CLI, aimgr, package status, runtime phase/missing surfaces).

### Git
If git is missing, ask whether to run \`git init\`.

### bd CLI
If \`bd\` is missing, provide install command:
\`\`\`
npm install -g beads
\`\`\`

### aimgr missing
If \`aimgr\` is missing, explain both paths:
- Standard path (recommended): install aimgr, then use \`aimgr init\` and \`aimgr install package/opencode-coder\`
- Manual equivalent path: copy/install required resources manually under \`.opencode/\`:
  - required skill entrypoint: \`.opencode/skills/opencode-coder/SKILL.md\`
  - required commands: \`.opencode/commands/opencode-coder/{init,docs,improve-doc,doctor,status,report-bug,dump-session}.md\`
  - required skill references: \`.opencode/skills/opencode-coder/references/{agents-md-template,bug-reporting,debugging-logs,installation-setup,mode-transition,planning,project-docs-lifecycle,project-setup,project-structure,session-dump,simplify,status-health,troubleshooting-patterns}.md\`
  - optional (helpful, not Phase 2 required): \`.opencode/agents/{orchestrator,tasker,reviewer,verifier}.md\`

Do not auto-install aimgr. Ask user what path they want.

### aimgr available but package missing
If aimgr is available and \`package/opencode-coder\` is missing, MUST ask via \`question()\` whether to run:
\`\`\`
aimgr init && aimgr install package/opencode-coder
\`\`\`

If user declines, provide the same complete manual resource list above (required skill entrypoint + required commands + required references; optional agents optional) and explicitly state degraded Phase 1 continues until required surfaces are present.

## Step 3 — Bootstrap handoff

After any install/copy actions, re-check required resource surfaces.

If required surfaces are now available:
- Report Phase 1 bootstrap succeeded.
- Instruct user to restart/reopen OpenCode.
- Instruct user to run \`/opencode-coder/init\` again so Phase 2 markdown/resource-backed init takes over.
- Do NOT attempt to execute Phase 2 workflow in this same runtime template.

If required surfaces are still missing:
- Report which required surfaces are still missing.
- Keep guidance concise and interactive.
- Clarify plugin remains in degraded Phase 1 state until resources are installed.
`.trim();
}
