# Initialize and Set Up Project Docs

Use this when a project needs its docs baseline and AGENTS routing set up or refreshed.

## Setup

1. Detect the project mode and the correct AGENTS path for that mode.
2. Inspect the existing docs baseline and current AGENTS state.
3. If the docs baseline is missing, establish it using:
   - [project-setup.md](project-setup.md)
   - [project-docs-lifecycle.md](project-docs-lifecycle.md)
4. If the docs baseline already exists, refresh it in place using the docs lifecycle workflow.
5. Materialize guidance in the correct location for the project mode:
   - `team` mode → project-shared path such as `AGENTS.md`
   - `stealth` mode → local path such as `.coder/AGENTS.md`
6. Verify that docs routes, AGENTS routes, and lifecycle-touched files are consistent.

Only create or update the docs and routing files that are actually needed for the project.
