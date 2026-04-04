#!/bin/bash
# Check GitHub CLI authentication and environment prerequisites
# Returns 0 if all checks pass, 1 otherwise

set -e

echo "🔍 Checking prerequisites for GitHub sync..."
echo ""

# Check 1: GitHub CLI installation and authentication
echo -n "  GitHub CLI: "
if ! command -v gh &> /dev/null; then
    echo "❌ Not installed"
    echo ""
    echo "Error: gh CLI not found. Install from https://cli.github.com"
    echo ""
    echo "Installation:"
    echo "  macOS:   brew install gh"
    echo "  Linux:   See https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  Windows: See https://github.com/cli/cli#installation"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated"
    echo ""
    echo "Error: GitHub CLI is not authenticated."
    echo ""
    echo "Please run: gh auth login"
    echo "Then retry this command."
    exit 1
fi
echo "✅ Authenticated"

# Check 2: Beads CLI availability
echo -n "  Beads CLI: "
if ! command -v bd &> /dev/null; then
    echo "❌ Not found"
    echo ""
    echo "Error: bd CLI not found. Ensure beads is installed."
    echo ""
    echo "Check installation: bd doctor"
    exit 1
fi

if ! bd stats &> /dev/null; then
    echo "❌ Not available"
    echo ""
    echo "Error: bd stats failed. Are you in a beads project?"
    echo ""
    echo "If not in a beads project, run: bd init --skip-agents"
    echo "Manual beads init only sets up beads state/hooks; it does not create project markdown docs."
    echo "Then retry this command."
    exit 1
fi
echo "✅ Available"

# Check 3: Repository detection
echo -n "  Repository: "
if ! REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>&1); then
    echo "❌ Not detected"
    echo ""
    echo "Error: Could not detect GitHub repository."
    echo ""
    echo "This directory doesn't appear to have a GitHub remote configured."
    echo ""
    echo "Check your git remote:"
    echo "  git remote -v"
    echo ""
    echo "If not set up, add a GitHub remote:"
    echo "  git remote add origin https://github.com/owner/repo.git"
    exit 1
fi
echo "✅ $REPO"

# All checks passed
echo ""
echo "✅ All prerequisites met"
echo "   Repository: $REPO"
echo ""
exit 0
