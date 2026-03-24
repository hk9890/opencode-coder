---
description: Create a new release for opencode-coder
---

# Release

Create a new release for the opencode-coder plugin.

This is the canonical release entrypoint for this repository.

## Instructions

1. Load the `github-releases` skill
2. Treat `docs/RELEASING.md` as the opencode-coder-specific companion only; do not use it as a standalone checklist
3. Follow the skill's release workflow from references/release-workflow.md:
   - Quality gates (tests, lints, builds)
   - Version management (bump package.json)
   - Documentation validation (CHANGELOG, version consistency)
   - GitHub release creation
   - Post-release verification
