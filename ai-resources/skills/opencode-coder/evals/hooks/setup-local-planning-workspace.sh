#!/usr/bin/env bash

set -euo pipefail

workspace_root="${EVAL_WORKSPACE:-$(pwd)}"
artifacts_root="${EVAL_ARTIFACTS_DIR:-./eval-artifacts}"
hook_artifacts_dir="${artifacts_root}/hooks/setup-local-planning-workspace"

mkdir -p "${hook_artifacts_dir}"

if ! command -v git >/dev/null 2>&1; then
  printf 'ERROR: git is required but was not found on PATH\n' >"${hook_artifacts_dir}/failure.log"
  exit 1
fi

if ! command -v bd >/dev/null 2>&1; then
  printf 'ERROR: bd is required but was not found on PATH\n' >"${hook_artifacts_dir}/failure.log"
  exit 1
fi

if [ "$(pwd)" != "${workspace_root}" ]; then
  printf 'ERROR: hook must run inside EVAL_WORKSPACE\n' >"${hook_artifacts_dir}/failure.log"
  printf 'pwd=%s\nworkspace_root=%s\n' "$(pwd)" "${workspace_root}" >>"${hook_artifacts_dir}/failure.log"
  exit 1
fi

if [ ! -d .git ]; then
  git init >/dev/null 2>&1
fi

if [ ! -d .beads ]; then
  bd init --skip-hooks --skip-agents --quiet
fi

touch README.md
git add README.md
git commit -m "seed eval workspace" >/dev/null 2>&1 || true

{
  printf 'hook=setup-local-planning-workspace\n'
  printf 'phase=%s\n' "${EVAL_PHASE:-before_run}"
  printf 'eval_id=%s\n' "${EVAL_ID:-unknown}"
  printf 'eval_name=%s\n' "${EVAL_NAME:-unknown}"
  printf 'cwd=%s\n' "$(pwd)"
  printf 'workspace_root=%s\n' "${workspace_root}"
  printf 'artifacts_root=%s\n' "${artifacts_root}"
  printf 'git_dir_exists=%s\n' "$( [ -d .git ] && printf yes || printf no )"
  printf 'beads_dir_exists=%s\n' "$( [ -d .beads ] && printf yes || printf no )"
} >"${hook_artifacts_dir}/workspace-proof.txt"

git rev-parse --is-inside-work-tree >"${hook_artifacts_dir}/git-rev-parse.txt"
git status --short >"${hook_artifacts_dir}/git-status-short.txt"
bd where >"${hook_artifacts_dir}/bd-where.txt"
bd status >"${hook_artifacts_dir}/bd-status.txt"
bd list --status open >"${hook_artifacts_dir}/bd-open-issues-before.txt"
