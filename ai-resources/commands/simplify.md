---
description: Simplify recently changed files with the opencode-coder workflow
---

# Simplify Recent Changes

Thin wrapper: load the `opencode-coder` skill and ask it to run the simplify workflow.

Use the skill tool:

```javascript
skill({ name: "opencode-coder" })
```

Then run the simplify workflow routed by `ai-resources/skills/opencode-coder/SKILL.md`.

Treat `$ARGUMENTS` as optional focus guidance for the simplify pass.
