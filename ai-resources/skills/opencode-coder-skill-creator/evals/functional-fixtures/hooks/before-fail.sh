#!/usr/bin/env bash

set -euo pipefail

artifacts="${EVAL_ARTIFACTS_DIR:?EVAL_ARTIFACTS_DIR is required}"
mkdir -p "${artifacts}/hooks/before-fail"
printf 'intentional before failure\n' >"${artifacts}/hooks/before-fail/marker.txt"
exit 1
