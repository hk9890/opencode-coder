#!/usr/bin/env bash

set -euo pipefail

artifacts="${EVAL_ARTIFACTS_DIR:?EVAL_ARTIFACTS_DIR is required}"
mkdir -p "${artifacts}/hooks/after-fail"
printf 'intentional after failure\n' >"${artifacts}/hooks/after-fail/marker.txt"
exit 1
