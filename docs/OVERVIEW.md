# Project Overview

`opencode-coder` is an OpenCode plugin for story-driven development. It gives teams a structured way to plan, implement, review, and verify work with specialized agents, reusable commands, and optional issue tracking integration.

## Who this project is for

- **Developers using OpenCode** who want repeatable workflows for planning and execution
- **Teams adopting AI-assisted delivery** and needing consistent project conventions
- **Maintainers of this plugin** who evolve commands, skills, and integration behavior

You can use the plugin with or without beads. Beads is optional, but when enabled it provides local-first issue tracking integrated into the workflow.

## Core concepts and domain language

- **OpenCode plugin**: This repository builds and ships the `@dynatrace-oss/opencode-coder` plugin.
- **Agents**: Role-focused assistants (for example orchestration, implementation, review, and verification).
- **Commands**: Reusable task entrypoints exposed in OpenCode (plugin commands and skill-backed commands).
- **Skills**: Focused workflow modules that provide domain-specific instructions (for example releases or monitoring triage).
- **Beads (`bd`) integration**: Optional issue-tracking workflow used for dependency-aware task execution.
- **Project modes**: The plugin supports inactive/disabled and active modes (including stealth/team behavior for beads-enabled setups).

## High-level architecture

At a high level, the codebase is organized as a small startup entry point plus focused domain packages:

- `src/index.ts` initializes plugin behavior and startup flow
- `src/core/` provides foundational utilities
- `src/config/` handles configuration loading and validation
- `src/service/` contains core services (startup, integration, detection, session export)
- `src/tool/` defines exposed tools
- `src/service/beads-service.ts` and related services contain beads-specific integration logic
- `src/templates/` contains template generation used by setup/init flows
- `ai-resources/` contains published, reusable AI resources (agents, commands, skills)
- `.opencode/` contains project-local resources for developing this plugin repository

### Packaged skill-creator integration

- Packaging is declared in `ai.package.yaml`
- This project references `skill/opencode-coder-skill-creator` (from the `open-coder` aimgr source)
- Contributors should install/repair resources with `aimgr install`, `aimgr verify`, and `aimgr repair`
- The installed OpenCode path for that resource is `.opencode/skills/opencode-coder-skill-creator/`

For implementation details, conventions, and architecture rules, see the focused coding guide instead of this overview.

## Where to go next

- [Agent routing entrypoint](../AGENTS.md)
- [Contributor workflow](../CONTRIBUTING.md)
- [Coding guide](./CODING.md)
- [Testing guide](./TESTING.md)
- [Release process](./RELEASING.md)
- [Monitoring and triage](./MONITORING.md)
- [Pull request workflow](./PULL-REQUESTS.md)
- [Project setup guide](./user-guide/getting-started.md)

For end-user plugin usage and feature highlights, see the [README](../README.md).
