The `.coder/opencode-coder.yaml` actually does exist. Let me read it along with the init command to understand what happened.

Here's what it should do with your current state:

**Step 1 — State detection:** Finds `.coder/opencode-coder.yaml` with `mode: team`. This is an active team project — no legacy migration needed.

**Step 2 — Action prompt:** Since the project is already active, it should ask (via `question()`) with three options:
- `Refresh team setup`
- `Switch modes`
- `Disable startup`

It must not assume refresh — it waits for your choice.

**If you chose Refresh:**

- **Step 3a:** Loads the `ai-resource-manager` skill for recommendations
- **Step 3b:** Runs `bd init && bd hooks install`, ensures `.gitignore` includes `.coder/`
- **Step 3c:** Regenerates or updates `AGENTS.md` (team mode → root `AGENTS.md`)
- **Step 4:** Checks if `/opencode-coder/docs` is available, then inspects `docs/` for standard topic files (`OVERVIEW.md`, `CODING.md`, `TESTING.md`, etc.), classifies each topic, shows you the decision matrix, and asks what to do with a `Skip for now` option
- **Step 5:** Reports what was created/updated/skipped/routed

One thing worth noting: your project has a stealth marker in `.git/info/exclude` but is saved as `mode: team`. That's not necessarily a problem (the stealth marker may be a leftover from a previous mode), but init should not act on it since the explicit yaml wins.

Is the command behaving differently from what you expect?
