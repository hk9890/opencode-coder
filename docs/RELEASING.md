# Release Process

Use the **github-releases** skill for the generic release workflow.
This file records the repository-specific commands, checks, and publishing details for this project.

## Prerequisites

- Bun installed (latest version)
- GitHub CLI authenticated: `gh auth status`
- GitHub Packages write access
- Clean working tree (no uncommitted changes)

## Build

```bash
bun install
bun run build
```

Output: `dist/opencode-coder.js` compiled JavaScript bundle.

## Tests

Run all test suites before releasing:

```bash
bun run test:unit          # Unit tests
bun run test:integration   # Integration tests
bun test tests/integration/plugin.test.ts --test-name-pattern "no-.coder startup regression"  # REQUIRED for startup no-.coder safeguard
bun run test:e2e          # End-to-end tests (optional, slower)
```

All tests must pass with no failures.

## Type Checking

```bash
bun run typecheck
```

Must complete with no type errors.

## Version Files

- `package.json` — version field (auto-updated by workflow)

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **Major (X.0.0)**: Breaking changes to plugin API or workflow
- **Minor (0.X.0)**: New features, backward compatible
- **Patch (0.0.X)**: Bug fixes, documentation updates

## Pre-Release Checklist

- [ ] All tests pass (`bun run test:unit && bun run test:integration`)
- [ ] Isolated pin consistency passes (`bun run validate:isolated-pins`)
- [ ] Startup no-`.coder` regression test passes locally (`bun test tests/integration/plugin.test.ts --test-name-pattern "no-.coder startup regression"`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] Build succeeds (`bun run build`)
- [ ] [`../CHANGELOG.md`](../CHANGELOG.md) updated with new version and changes
- [ ] No uncommitted changes (`git status`)
- [ ] CI green on main branch (`gh run list --limit 1`)
- [ ] Breaking changes documented with migration guide (if major/minor)

## Release Process

### Automated Release via GitHub Actions (Recommended)

1. **Determine version number** based on changes since last release:
   ```bash
   # View last release
   gh release view
   
   # Compare changes since last tag
   LAST_TAG=$(git describe --tags --abbrev=0)
   git log $LAST_TAG..HEAD --oneline
   ```

2. **Prepare release notes**:
   - Summarize key changes (features, fixes, breaking changes)
   - Use markdown format
   - Include migration guide if breaking changes exist

3. **Trigger release workflow**:
   ```bash
   gh workflow run release.yml \
     -f version="0.25.0" \
     -f release_notes="## What's New
   
   ### Added
   - New beads workflow features
   - Enhanced documentation
   
   ### Fixed
   - Bug fixes in CLI parsing
   
   ### Changed
   - Updated dependencies"
   ```

4. **Monitor workflow**:
   ```bash
   gh run watch
   ```

5. **Verify release**:
   ```bash
   gh release view v0.25.0
   ```

### Manual Release (Fallback)

Only use if GitHub Actions workflow fails or is unavailable.

```bash
# 1. Update version in package.json
NEW_VERSION="0.25.0"
bun -e "
  const pkg = await Bun.file('package.json').json();
  pkg.version = '$NEW_VERSION';
  await Bun.write('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# 2. Commit version bump
git add package.json
git commit -m "release: v$NEW_VERSION"

# 3. Create and push tag
git tag -a "v$NEW_VERSION" -m "v$NEW_VERSION"
git push origin main --follow-tags

# 4. Publish to GitHub Packages
npm publish

# 5. Create GitHub release
gh release create "v$NEW_VERSION" \
  --title "v$NEW_VERSION" \
  --notes "Release notes here..."
```

## Post-Release

After releasing:

1. **Verify package metadata is published (existence check, no auth validation)**:
   ```bash
   npm view @dynatrace-oss/opencode-coder --registry=https://npm.pkg.github.com
   ```

   This confirms the package/version is visible in GitHub Packages metadata.
   It does **not** prove your npm auth token has package read access.

2. **Check GitHub release**:
   ```bash
   gh release view
   ```

3. **Test authenticated installation** in a test project:
   ```bash
   # In a clean test directory, use a token with read:packages scope
   # (for GitHub Packages reads). Do not assume any gh auth token works.
   TOKEN="<token-with-read:packages>"
   printf '@dynatrace-oss:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' "$TOKEN" > .npmrc
   npm install @dynatrace-oss/opencode-coder@latest
   ```

   If your environment already has a known-good npm auth setup for `npm.pkg.github.com`,
   you may use that instead of writing a temporary token.

4. **Announce release** (if significant):
   - Update project [`../README.md`](../README.md) if needed
   - Post in relevant channels/forums
   - Update documentation site

## Rollback

If a release has critical issues:

### Unpublish from GitHub Packages

```bash
# Delete the release
gh release delete v0.25.0 -y

# Delete the tag locally and remotely
git tag -d v0.25.0
git push origin :refs/tags/v0.25.0

# Revert the version bump commit
git revert HEAD
git push origin main
```

**Note**: npm unpublish is NOT available for GitHub Packages. You must publish a patch version with the fix instead.

### Publish hotfix

```bash
# Fix the issue, then release a patch version
gh workflow run release.yml \
  -f version="0.25.1" \
  -f release_notes="## Hotfix

### Fixed
- Critical bug in v0.25.0"
```

## Troubleshooting

### Workflow fails: "Tag already exists"

```bash
# Check if tag exists
git tag -l "v0.25.0"

# Delete tag if needed
git tag -d v0.25.0
git push origin :refs/tags/v0.25.0
```

### Workflow fails: "Tests failed"

Fix the test failures before releasing:

```bash
# Run tests locally to reproduce
bun run test:unit
bun run test:integration

# Fix issues, commit, push, then retry release
```

### Workflow fails: "Type check failed"

```bash
# Run type check locally
bun run typecheck

# Fix type errors, commit, push, then retry
```

### Publish fails: Authentication error

Ensure GitHub Packages authentication is configured:

```bash
# Check authentication
gh auth status

# Re-authenticate if needed
gh auth login
```

Important: `gh auth login` / `gh auth token` is **not** universally sufficient for npm
GitHub Packages reads. The token used in `.npmrc` must include GitHub Packages read scope
(for example `read:packages`). If install fails with `E403 permission_denied` while
`npm view ... --registry=https://npm.pkg.github.com` succeeds, publication is likely fine
and the problem is token scope/auth configuration.

## Release Workflow Details

The GitHub Actions workflow (`.github/workflows/release.yml`) performs:

1. **Quality Gates**: Type check, build, unit tests, integration tests
2. **Version Validation**: Ensures semver format, checks tag doesn't exist
3. **Version Bump**: Updates package.json
4. **Git Operations**: Commits version bump, creates tag, pushes to remote
5. **Publish**: Publishes to GitHub Packages (@dynatrace-oss/opencode-coder)
6. **GitHub Release**: Creates release with provided notes

**Inputs:**
- `version` (required): Semver version (e.g., "0.25.0")
- `release_notes` (required): Markdown-formatted release notes

**Outputs:**
- Git tag: `v{version}`
- GitHub Release: `https://github.com/dynatrace-oss/opencode-coder/releases/tag/v{version}`
- NPM Package: `@dynatrace-oss/opencode-coder@{version}`
