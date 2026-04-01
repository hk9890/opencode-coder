#!/usr/bin/env bash

set -euo pipefail

artifacts="${EVAL_ARTIFACTS_DIR:?EVAL_ARTIFACTS_DIR is required}"
mkdir -p "${artifacts}/hooks/after-success"
printf 'after_run success\n' >"${artifacts}/hooks/after-success/marker.txt"
