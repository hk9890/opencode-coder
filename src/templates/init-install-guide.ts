/**
 * Template for the /opencode-coder/init command when explicit enablement,
 * prerequisites, or mode transitions need guidance.
 *
 * This is a command template — it contains instructions for the AI agent
 * (not the user directly).
 */
export function getInstallGuideTemplate(): string {
  return `
# Project Setup Required

Use this workflow for:
- first-time explicit enablement
- refreshing an active setup
- switching between saved \`disabled\`, \`stealth\`, and \`team\`
- preserving legacy initialized projects on upgrade

The plugin must NOT treat \`.coder/\` alone as activation.
The only hard-disable is the \`OPENCODE_CODER_DISABLED=true\` environment variable. When that env var is set, the plugin returns no commands at all, so \`/opencode-coder/init\` is not available in that session.

If this command is available, continue initialization in this same session after resolving prerequisites.

## Task

1. Detect the current opencode-coder startup state BEFORE creating or changing files.
2. Resolve missing prerequisites using the guidance below.
3. Once prerequisites are satisfied, continue directly with enablement, refresh, or mode switching in THIS SAME SESSION.
4. Do NOT stop after installing aimgr resources. Do NOT tell the user to re-run \`/opencode-coder/init\`.
5. Only mention restart at the very end when explaining when newly installed commands or agents become available in future sessions.

### Step 1: Detect startup state

Check the following in order:

1. Saved mode file: \`.coder/opencode-coder.yaml\`
   - If it contains \`mode: disabled\` → saved disabled project
   - If it contains \`mode: stealth\` → active stealth project
   - If it contains \`mode: team\` → active team project
   - If it exists but is invalid or unreadable → warn the user and treat the project as not explicitly enabled yet
2. Legacy markers from older versions when the saved mode file is missing:
   - stealth marker in \`.git/info/exclude\` → legacy stealth project
   - or legacy \`.coder/project.yaml\` with \`mode: stealth\` or \`mode: team\`
   - or shared team markers (\`.beads/\`, root \`AGENTS.md\`, and \`ai.package.yaml\` all present)
   - when a legacy active mode is inferred, write \`.coder/opencode-coder.yaml\` with the inferred mode before continuing so future startups use explicit state
3. Otherwise treat the project as not explicitly enabled yet

Important rules:
- DO NOT create \`.coder/\` during detection for a fresh project
- DO NOT treat \`.coder/\` existence by itself as activation
- Distinguish saved \`disabled\` mode from the env-var hard override

---

### Git Repository

If \`git.initialized\` is \`false\`:
- Use \`question()\` to ask the user:
  > "This project doesn't have a git repository yet. Would you like me to run \`git init\`?"
- If the user confirms, run \`git init\` in the project root.
- If they decline, note that git is required for beads to track tasks.

---

### Beads CLI

If \`beads.bdCliInstalled\` is \`false\`:
- Inform the user:
  > "The beads CLI (\`bd\`) is not installed. Install it with:"
  > \`\`\`
  > npm install -g beads
  > \`\`\`
- Do not run this automatically — provide the command and let the user install it.

---

### aimgr (AI Resource Manager)

If \`aimgr.installed\` is \`false\`:
- Inform the user:
  > "aimgr is not installed. You can install it from:"
  > https://github.com/hk9890/ai-config-manager
- Do not run this automatically — provide the link and let the user install it.

---

### opencode-coder Package

If \`aimgr.coderPackageInstalled\` is \`false\`:
- Use \`question()\` to ask the user:
  > "The opencode-coder package is not installed via aimgr. Should I run \`aimgr init && aimgr install package/opencode-coder\` for you so \`/opencode-coder/init\` can finish setup in this session?"
- If the user confirms, run \`aimgr init && aimgr install package/opencode-coder\` in the project root.
- If they decline, provide the commands for them to run manually.

After the package is installed during this session:
- continue with the initialization workflow below immediately
- do NOT stop just because new commands or agents may require a restart in future sessions
- if the \`opencode-coder\` skill is available now, load it and use its references
- if the skill is not yet available in this session, follow the fallback workflow below

---

## Continue Initialization Now

After prerequisites are addressed, continue with the remaining setup now.

### Step 2: Choose enablement action

#### Fresh or not-yet-enabled project

Explain that opencode-coder is currently inactive for this project and no project-local startup behavior will run until the user explicitly enables it.

MUST use the \`question()\` tool to ask what to do next:
- \`Enable stealth mode\` — local-only setup
- \`Enable team mode\` — shared setup
- \`Remain inactive\` — keep startup inactive and make no setup changes

Rules:
- If the user chooses \`Remain inactive\`, stop after summarizing that the plugin remains inactive and can be enabled later with \`/opencode-coder/init\`
- If the user chooses an enable option, create \`.coder/\` only then and write \`.coder/opencode-coder.yaml\` with the chosen mode before continuing

#### Saved disabled project

MUST use the \`question()\` tool to ask what to do next:
- \`Enable stealth mode\`
- \`Enable team mode\`
- \`Remain disabled\`

Rules:
- If the user chooses \`Remain disabled\`, keep or write \`.coder/opencode-coder.yaml\` with \`mode: disabled\` and stop after summarizing that project-local startup remains suppressed
- If the user chooses an enable option, update \`.coder/opencode-coder.yaml\` with the new mode before continuing

#### Active or legacy-migrated project

If the current project is active in \`stealth\` or \`team\`, MUST use the \`question()\` tool to ask what the user wants to do next.

- If current mode is **stealth**, offer:
  - \`Refresh stealth setup\` — keep stealth mode, refresh generated docs/AGENTS
  - \`Switch to team mode\` — move shared artifacts to repo-visible paths
  - \`Disable startup\` — persist \`mode: disabled\` and stop active startup next session
- If current mode is **team**, offer:
  - \`Refresh team setup\` — keep team mode, refresh generated docs/AGENTS
  - \`Switch to stealth mode\` — move generated artifacts under \`.coder/\` and restore stealth exclusions
  - \`Disable startup\` — persist \`mode: disabled\` and stop active startup next session

Rules:
- DO NOT assume a refresh when the repo is already initialized
- DO NOT assume the user wants to keep the current mode
- If the user chooses \`Disable startup\`, write \`.coder/opencode-coder.yaml\` with \`mode: disabled\`, explain that this is different from \`OPENCODE_CODER_DISABLED\`, and stop without running active startup work
- If the user chooses a switch, perform the matching transition workflow below and then continue to **Step 3: Beads Initialization** using the new mode's paths
- If the user chooses refresh, continue with the current mode's paths

### Step 3: Beads Initialization

#### Smart Detection (run before anything else)

**Detection Step 1 — Check for active stealth mode:**

\`\`\`bash
grep -q "# opencode-coder stealth mode" .git/info/exclude 2>/dev/null && echo "STEALTH_ACTIVE"
\`\`\`

- If output is \`STEALTH_ACTIVE\` → stealth is already configured.

**Detection Step 2 — Check for full team configuration:**

Check whether \`.beads/\` exists, \`AGENTS.md\` exists at the project root, and \`ai.package.yaml\` exists at the project root.

- If all three exist and stealth marker was NOT found → team mode is already configured.

**Detection Step 3 — Fresh beads setup:**

- If neither condition above matched → initialize beads using the already chosen enablement mode

#### Beads mode question for fresh enablement only

If the project is not yet beads-initialized after the enablement decision above, ask the user which beads mode to use only when needed.

Map the enablement choice directly:
- \`Enable stealth mode\` → use stealth beads setup
- \`Enable team mode\` → use team beads setup

Do NOT ask a second redundant mode question if the user already chose the opencode-coder mode in Step 2.

#### Stealth Mode Path

Run:

\`\`\`bash
bd init --stealth && bd hooks install
mkdir -p .coder/docs
\`\`\`

Then ensure this exclusion block exists in \`.git/info/exclude\`:

\`\`\`bash
if ! grep -q "# opencode-coder stealth mode" .git/info/exclude 2>/dev/null; then
  cat >> .git/info/exclude << 'STEALTH'

# opencode-coder stealth mode
.beads/
.opencode/
.coder/
ai.package.yaml
STEALTH
fi
\`\`\`

#### Team Mode Path

Run:

\`\`\`bash
bd init && bd hooks install
grep -qF '.coder/' .gitignore 2>/dev/null || echo '.coder/' >> .gitignore
\`\`\`

#### Transition Workflow: Stealth → Team

When the user chooses to switch from stealth to team:

1. Copy generated docs from \`.coder/docs/\` to \`docs/\` when they exist
2. Move or merge \`.coder/AGENTS.md\` into root \`AGENTS.md\`
3. Rewrite AGENTS doc paths from \`.coder/docs/\` to \`docs/\`
4. Remove the stealth exclusion block from \`.git/info/exclude\`
5. Delete the old stealth workspace only when the shared files are safely in place
6. Ensure \`.coder/\` is gitignored via \`.gitignore\`
7. Update \`.coder/opencode-coder.yaml\` to \`mode: team\`

#### Transition Workflow: Team → Stealth

When the user chooses to switch from team to stealth:

1. Create \`.coder/docs/\`
2. Copy generated docs from \`docs/\` to \`.coder/docs/\` when they exist
3. Copy or derive \`.coder/AGENTS.md\` from root \`AGENTS.md\`
4. Rewrite AGENTS doc paths from \`docs/\` to \`.coder/docs/\`
5. Add the stealth exclusion block to \`.git/info/exclude\`
6. If the user wants the setup to become local-only, remove shared opencode-coder artifacts from the git index as a normal change
7. Update \`.coder/opencode-coder.yaml\` to \`mode: stealth\`

### Step 4: AGENTS.md Creation

Generate or update AGENTS.md for the active mode.

Preferred path:
- if the \`opencode-coder\` skill is available, load it and follow its AGENTS generation references

Fallback path if the skill is not yet available in this session:

1. Detect the active mode first
   - team mode writes \`AGENTS.md\`
   - stealth mode writes \`.coder/AGENTS.md\`
2. Use the correct docs directory for the mode
   - team mode uses \`docs/\`
   - stealth mode uses \`.coder/docs/\`
3. Inspect the project for:
   - project name, description, tech stack
   - build, test, lint, and type-check commands
   - existing docs in \`docs/\`, \`.coder/docs/\`, and relevant root files like \`CONTRIBUTING.md\`
   - release, monitoring, testing, and pull request guidance
4. Before migrating docs to standard names or creating new standard docs, ask the user once for confirmation
5. Generate a small AGENTS.md routing table that:
   - includes **Project Overview** inline
   - includes **Coding** and points to the coding docs
   - includes **Testing**, **Releases**, **Monitoring**, and **Pull Requests** only when relevant docs or skills exist
   - includes **Landing the Plane** only if beads is installed
   - uses mode-correct paths everywhere
   - stays concise and points to files/skills instead of copying their content

Key AGENTS rules:
- AGENTS.md is a routing table, not a handbook
- In stealth mode, write only \`.coder/AGENTS.md\`
- In team mode, write only root \`AGENTS.md\`
- If a team \`AGENTS.md\` already exists and the repo is in stealth mode, read it for context but write only \`.coder/AGENTS.md\`

### Step 5: Optional Project-doc Follow-through (Inspect First)

After AGENTS setup, first check whether \`/opencode-coder/docs\` is available in this session.

- If \`/opencode-coder/docs\` is available, run the same lifecycle model used by \`/opencode-coder/docs\`: \`inspect -> decide -> apply -> verify/report\`.
- If \`/opencode-coder/docs\` is not available, do not run project-doc setup/update in this session; explain that plainly and continue init safely.

When \`/opencode-coder/docs\` is available, inspection is required before asking what to do:

1. Resolve active mode paths:
   - team mode: docs at \`docs/\`, AGENTS at \`AGENTS.md\`
   - stealth mode: docs at \`.coder/docs/\`, AGENTS at \`.coder/AGENTS.md\`
2. Inspect standard topic docs in the active docs path:
   - \`OVERVIEW.md\`, \`CODING.md\`, \`TESTING.md\`, \`RELEASING.md\`, \`MONITORING.md\`, \`PULL-REQUESTS.md\`
3. Inspect project-specific guidance outside standard topic files (migration signals), including mixed content in broader files such as:
   - \`README.md\`
   - \`CONTRIBUTING.md\`
   - non-standard docs filenames under \`docs/\` or \`.coder/docs/\`
4. Inspect installed skills/workflows relevant to these topics (for example \`.opencode/skills/\` when present).
5. Classify each topic as exactly one of:
   - \`existing doc\` (project-specific local doc exists)
   - \`skill-only\` (no local doc, but relevant reusable skill/workflow exists)
   - \`neither\` (no local doc and no relevant skill/workflow signal)
6. Classify docs state as one of these three scenarios before asking the user:
    - \`No standard baseline exists yet\`
    - \`Standard baseline already exists\`
    - \`Docs exist in non-standard layout and may need migration\`
7. Show the topic decision matrix and overall state to the user before asking the Step 5 question or creating/refreshing docs.

Define migration concretely:
- Migration means project-specific guidance exists outside the standard topic files, or mixed into broad files, and should be inspected before proposing extraction, relocation, renaming, or AGENTS routing updates.

Then use \`question()\` with user-facing wording that matches the detected scenario:

- Scenario A — bootstrap/setup (no standard baseline):
  - Example wording: "I couldn't find the standard project docs layout yet. I can inspect this repo and set up topic docs plus an AGENTS routing document where there is real project-specific guidance. Do you want me to do that now?"
- Scenario B — review/update (standard baseline exists):
  - Example wording: "I found the standard docs layout already in place. I can review, refresh, and verify those docs and update AGENTS routing as needed. Do you want me to run that review now?"
- Scenario C — migration/proposal (non-standard layout):
  - Example wording: "I found project documentation, but it is not organized in the standard topic layout. I can inspect what exists and propose a migration/routing plan before making changes. Do you want that proposal now?"

For every scenario, include \`Skip for now\` as an option.

If the user chooses to proceed in any scenario, run the docs step through the shared lifecycle without inventing a second init-only docs workflow.

When project-doc work is unavailable because \`/opencode-coder/docs\` is missing:
- Skip this docs step safely
- Use plain language, for example: "Project-doc setup/update isn't available in this session because \`/opencode-coder/docs\` is unavailable right now. I'll continue init without changing project docs."
- Continue and complete init without failing the no-skill/no-resource path

### Step 6: Report Completion

Summarize what happened:

> **Initialization Complete!**
>
> ✓ Prerequisites checked and resolved
> ✓ Explicit plugin mode saved or refreshed
> ✓ Beads initialized or refreshed in the selected mode when enabled
> ✓ Git hooks installed
> ✓ AGENTS.md created or refreshed for the active mode
> ✓ Docs step handled intentionally (run now, skipped by user, or unavailable in this session)

If this run installed new commands or agents via aimgr, add:

> New commands and agents will be available in your next OpenCode session. To use them later, restart OpenCode.
`.trim();
}
