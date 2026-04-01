#!/usr/bin/env bash

set -euo pipefail

artifacts="${EVAL_ARTIFACTS_DIR:?EVAL_ARTIFACTS_DIR is required}"
mkdir -p "${artifacts}/hooks/after-on-before-failure"
printf 'after executed despite before failure\n' >"${artifacts}/hooks/after-on-before-failure/marker.txt"
