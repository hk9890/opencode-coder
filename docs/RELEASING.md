# Release Companion

Start every release from `/opencode-coder-dev/release` or by loading the **github-releases** skill.

Do not use this document as a standalone release checklist; the skill owns the generic workflow, validation structure, and recovery flow.

Use this companion for the **repo-specific** checks, commands, and publishing quirks for `opencode-coder`.

## Supported Entrypoints

- `/opencode-coder-dev/release` when releasing from this repository
- the **github-releases** skill when you need the generic workflow directly

Read this file after starting from one of those entrypoints.

## Release Entrypoint

This repo releases through:

- `.github/workflows/release.yml`

Dispatch it with:

```bash
gh workflow run release.yml -f version="0.36.1" -f release_notes="## What's New
- ..."
```

The workflow:

- updates `package.json`
- creates tag `v<version>`
- pushes `main` and the tag
- publishes `@dynatrace-oss/opencode-coder` to GitHub Packages
- creates the GitHub release

## Local Prerequisites

- `bun install`
- `gh auth status`
- clean working tree
- permission to publish GitHub Packages

## Required Checks Before Dispatch

Run these locally before triggering the release workflow:

```bash
bun run typecheck
bun run build
bun run test:unit
bun run test:integration
bun test tests/integration/plugin.test.ts --test-name-pattern "no-.coder startup regression"
bun run validate:isolated-pins
bun run test:e2e
```

## Repo-Specific Release Checklist

- update [`../CHANGELOG.md`](../CHANGELOG.md) under `## [Unreleased]`
- confirm `main` is green: `gh run list --limit 1`
- prepare release notes for the workflow input
- do **not** pre-bump `package.json`; the workflow owns the version update

## Accepted Release Gap

`bun run test:e2e` and isolated manual harness checks currently depend on access to `@hk9890/opencode-dynatrace`.

That means:

- the checks are required for a real release environment
- GitHub Actions does not fully enforce that private-package-dependent coverage yet
- this gap is currently accepted and should be mentioned if release confidence is discussed

## Publishing and Auth Quirks

Package target:

- GitHub Packages
- registry: `https://npm.pkg.github.com`
- package: `@dynatrace-oss/opencode-coder`

Important auth note:

- `gh auth login` is not always sufficient for **npm package reads**
- installation verification may require a token with `read:packages`
- do not assume a token that works for GitHub CLI also works for `npm install`

## Post-Release Verification

Run these after the workflow completes:

```bash
gh release view "v<version>"
npm view @dynatrace-oss/opencode-coder@<version> --registry=https://npm.pkg.github.com
```

Also verify an authenticated install in a clean test project using a token with package read access:

```bash
TOKEN="<token-with-read:packages>"
printf '@dynatrace-oss:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' "$TOKEN" > .npmrc
npm install @dynatrace-oss/opencode-coder@<version>
```

## If the Release Fails

Use the generic recovery workflow from the **github-releases** skill, plus these repo-specific rules:

- if the workflow reports an existing tag, stop and inspect the existing tag/release before retrying
- if publish succeeds but install verification fails with `E403 permission_denied`, suspect token scope before assuming the release is broken
- if a bad release gets out, publish a new patch version; GitHub Packages does not support a simple npm unpublish rollback flow here

## Workflow Reference

When changing release behavior, review these files together:

- `.github/workflows/release.yml`
- `package.json`
- `CHANGELOG.md`
- this file
