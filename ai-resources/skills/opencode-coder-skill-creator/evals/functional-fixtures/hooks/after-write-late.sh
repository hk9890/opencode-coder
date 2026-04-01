#!/usr/bin/env bash

set -euo pipefail

artifacts="${EVAL_ARTIFACTS_DIR:?EVAL_ARTIFACTS_DIR is required}"
mkdir -p "${artifacts}/hooks/after-write-late"
printf 'late after hook executed\n' >"${artifacts}/hooks/after-write-late/marker.txt"
