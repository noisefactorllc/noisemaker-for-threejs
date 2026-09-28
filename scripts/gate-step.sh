#!/usr/bin/env bash
# Runs one rendered-parity gate command, tees its full output to a log, and on
# failure emits the log tail as ::error annotations (check-run annotations are
# the only readable failure channel in this CI; full logs are preserved by the
# rendered-parity artifact upload).
# Usage: bash scripts/gate-step.sh <logfile> <command> [args...]
set -uo pipefail
log=$1; shift
"$@" 2>&1 | tee "$log"
rc=${PIPESTATUS[0]}
if [ "$rc" -ne 0 ]; then
  echo "GATE FAILED (rc=$rc): $*" >&2
  tail -n 40 "$log" | while IFS= read -r line; do
    printf '::error::%s\n' "$line"
  done
  exit "$rc"
fi
