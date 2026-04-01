#!/usr/bin/env bash

set -euo pipefail

workspace="${EVAL_WORKSPACE:?EVAL_WORKSPACE is required}"
artifacts="${EVAL_ARTIFACTS_DIR:?EVAL_ARTIFACTS_DIR is required}"

if [ "$(pwd)" != "${workspace}" ]; then
  printf 'hook must run from workspace root\n' >&2
  exit 1
fi

if [ -d .git ]; then
  printf 'workspace unexpectedly contains .git before hooks\n' >&2
  exit 1
fi

if [ -d .beads ]; then
  printf 'workspace unexpectedly contains .beads before hooks\n' >&2
  exit 1
fi

if [ ! -f "${workspace}/.opencode/skills/skill-creator/SKILL.md" ]; then
  printf 'runner did not inject runtime skill into workspace\n' >&2
  exit 1
fi

if [ ! -f "${workspace}/evals/functional-fixtures/input/hydrated.txt" ]; then
  printf 'expected hydrated eval file missing\n' >&2
  exit 1
fi

mkdir -p "${artifacts}/hooks/assert-bare-workspace"
printf 'bare workspace confirmed\n' >"${artifacts}/hooks/assert-bare-workspace/proof.txt"
