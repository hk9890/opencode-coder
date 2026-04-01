#!/usr/bin/env bash

set -euo pipefail

artifacts="${EVAL_ARTIFACTS_DIR:?EVAL_ARTIFACTS_DIR is required}"
mkdir -p "${artifacts}/hooks/before-should-not-run"
printf 'this hook should not execute\n' >"${artifacts}/hooks/before-should-not-run/marker.txt"
