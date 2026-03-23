Based on the init command definition, here's exactly what should happen:

**Step 4a (Inspection) runs first.** Before asking you anything, the init flow should:

1. Resolve the active docs directory based on your mode (`docs/` for team, `.coder/docs/` for stealth)
2. Check for each standard topic file: `OVERVIEW.md`, `CODING.md`, `TESTING.md`, `RELEASING.md`, `MONITORING.md`, `PULL-REQUESTS.md`
3. Inspect your existing non-standard docs as "migration signals" (checking `README.md`, `CONTRIBUTING.md`, and whatever's in your `docs/` folder)
4. Classify each topic as `existing doc`, `skill-only`, or `neither`
5. Classify the overall state — in your case: **"Docs exist in non-standard layout and may need migration"**

**Then it should show you a topic decision matrix** and ask with migration-specific wording, something like:

> "I found project documentation, but it is not organized in the standard topic layout. I can inspect what exists and propose a migration/routing plan before making changes. Do you want that proposal now?"

With `Skip for now` always available.

**Key thing to know:** If you say yes, it will only propose a migration plan first — it won't move or rename your files without your review. Actual writes only happen after you confirm. And it will only create standard topic docs where there's real project-specific content to put in them; topics with no local specifics get routed via AGENTS.md instead of creating empty placeholder files.
