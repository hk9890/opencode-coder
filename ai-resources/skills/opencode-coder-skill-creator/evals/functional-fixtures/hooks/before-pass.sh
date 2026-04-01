#!/usr/bin/env bash

set -euo pipefail

artifacts="${EVAL_ARTIFACTS_DIR:?EVAL_ARTIFACTS_DIR is required}"
mkdir -p "${artifacts}/hooks/before-pass"
printf 'before passed\n' >"${artifacts}/hooks/before-pass/marker.txt"
