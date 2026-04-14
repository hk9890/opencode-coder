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

Runtime ownership is capability-split:

Treat this as the canonical short explanation of that split. Other contributor docs should link here instead of restating the same ownership breakdown.

- plugin runtime is limited to bootstrap/core availability checks and beads readiness detection
- `coder-core` is plugin-coupled and owns core runtime/bootstrap guidance
- `coder-beads` is plugin-integrated only for runtime defaults/activation when beads is ready
- `coder-docs` is standalone and owns docs lifecycle/project-doc references
- `code-simplify` is standalone and owns `/simplify` workflow guidance

Startup decisions are centralized in a single startup-state model (`src/core/startup-state.ts`).
That model is the shared source-of-truth for resolved mode (active/inactive), runtime capability
(resource-surface based), bootstrap `/opencode-coder/init` exposure, degraded/timeout handling,
and default-agent eligibility.

For implementation details, conventions, and architecture rules, see the focused coding guide instead of this overview.

## Common change areas

- **Startup and mode behavior** — `src/index.ts`, `src/service/plugin-mode-service.ts`, `src/service/project-detector-service.ts`
- **Published commands, skills, and agents** — `ai-resources/`
- **Installed runtime resources (inspect only; do not edit directly)** — `.opencode/`
- **Diagnostics and log tooling** — `src/core/opencode-log-paths.ts`, `scripts/log-analyzer/`, `scripts/collect-diagnostics/`
- **Testing harness and fixtures** — `tests/`, `scripts/manual-test/`, `docs/TESTING.md`
- **Docs lifecycle and project-doc guidance** — canonical references in `ai-resources/skills/coder-docs/references/`, the published docs-lifecycle skill entrypoint at `ai-resources/skills/coder-docs/SKILL.md`, and copied user-guide entrypoints in `docs/user-guide/`

## Doc routes

Use these docs by task:

- [Agent routing entrypoint](../AGENTS.md)
- [Contributor workflow](../CONTRIBUTING.md)
- [Coding guide](./CODING.md)
- [Testing guide](./TESTING.md)
- [Release companion](./RELEASING.md)
- [Monitoring and triage](./MONITORING.md)
- [Change workflow](./CHANGE-WORKFLOW.md)
- [Getting started guide](./user-guide/getting-started.md)
- [Project doc structure guide](./user-guide/project-setup.md)

Doc roles in this repo stay simple:

- `README.md` is the front door for users and installation
- `AGENTS.md` is the routing layer for agents
- `docs/*.md` are focused operating guides by topic
- `docs/user-guide/` contains focused contributor or user references
- `docs/testing/` and parts of `docs/design/` are secondary evidence/history, not default operating guidance

For end-user plugin usage and feature highlights, see the [README](../README.md).
