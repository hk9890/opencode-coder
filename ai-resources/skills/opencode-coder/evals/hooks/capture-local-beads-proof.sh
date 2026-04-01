#!/usr/bin/env bash

set -euo pipefail

workspace_root="${EVAL_WORKSPACE:-$(pwd)}"
artifacts_root="${EVAL_ARTIFACTS_DIR:-./eval-artifacts}"
hook_artifacts_dir="${artifacts_root}/hooks/capture-local-beads-proof"

mkdir -p "${hook_artifacts_dir}"

if [ "$(pwd)" != "${workspace_root}" ]; then
  printf 'ERROR: hook must run inside EVAL_WORKSPACE\n' >"${hook_artifacts_dir}/failure.log"
  printf 'pwd=%s\nworkspace_root=%s\n' "$(pwd)" "${workspace_root}" >>"${hook_artifacts_dir}/failure.log"
  exit 1
fi

if ! command -v bd >/dev/null 2>&1; then
  printf 'ERROR: bd is required but was not found on PATH\n' >"${hook_artifacts_dir}/failure.log"
  exit 1
fi

{
  printf 'hook=capture-local-beads-proof\n'
  printf 'phase=%s\n' "${EVAL_PHASE:-after_run}"
  printf 'eval_id=%s\n' "${EVAL_ID:-unknown}"
  printf 'eval_name=%s\n' "${EVAL_NAME:-unknown}"
  printf 'cwd=%s\n' "$(pwd)"
  printf 'workspace_root=%s\n' "${workspace_root}"
  printf 'artifacts_root=%s\n' "${artifacts_root}"
} >"${hook_artifacts_dir}/workspace-proof.txt"

bd where >"${hook_artifacts_dir}/bd-where.txt"
bd status >"${hook_artifacts_dir}/bd-status.txt"
bd list --status open >"${hook_artifacts_dir}/bd-open-issues-after.txt"

if [ -f .beads/tasks.jsonl ]; then
  cp .beads/tasks.jsonl "${hook_artifacts_dir}/workspace-tasks.jsonl"
fi

if command -v git >/dev/null 2>&1; then
  git status --short >"${hook_artifacts_dir}/git-status-short.txt"
fi
