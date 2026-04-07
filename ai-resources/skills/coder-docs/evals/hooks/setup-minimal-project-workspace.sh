#!/usr/bin/env bash

set -euo pipefail

workspace_root="${EVAL_WORKSPACE:-$(pwd)}"
artifacts_root="${EVAL_ARTIFACTS_DIR:-./eval-artifacts}"
hook_artifacts_dir="${artifacts_root}/hooks/setup-minimal-project-workspace"

mkdir -p "${hook_artifacts_dir}"

if [ "$(pwd)" != "${workspace_root}" ]; then
  printf 'ERROR: hook must run inside EVAL_WORKSPACE\n' >"${hook_artifacts_dir}/failure.log"
  printf 'pwd=%s\nworkspace_root=%s\n' "$(pwd)" "${workspace_root}" >>"${hook_artifacts_dir}/failure.log"
  exit 1
fi

if command -v git >/dev/null 2>&1 && [ ! -d .git ]; then
  git init >/dev/null 2>&1
fi

mkdir -p src

cat >README.md <<'EOF'
# Example Repo

This repository is being bootstrapped and needs standard project docs.
EOF

cat >package.json <<'EOF'
{
  "name": "example-repo",
  "private": true,
  "version": "0.0.0",
  "type": "module"
}
EOF

cat >src/index.ts <<'EOF'
export function main(): void {
  console.log("hello")
}
EOF

cat >.gitignore <<'EOF'
node_modules/
dist/
EOF

{
  printf 'hook=setup-minimal-project-workspace\n'
  printf 'phase=%s\n' "${EVAL_PHASE:-before_run}"
  printf 'eval_id=%s\n' "${EVAL_ID:-unknown}"
  printf 'eval_name=%s\n' "${EVAL_NAME:-unknown}"
  printf 'workspace_root=%s\n' "${workspace_root}"
  printf 'git_dir_exists=%s\n' "$( [ -d .git ] && printf yes || printf no )"
  printf 'seeded_files=README.md,package.json,src/index.ts,.gitignore\n'
} >"${hook_artifacts_dir}/workspace-proof.txt"
