#!/usr/bin/env bash
# Runs one rendered-parity gate command, tees its full output to a log, and on
# failure emits the log tail as ::error annotations. GitHub keeps only the
# FIRST ~10 annotations per step, so the most diagnostic lines go first: the
# sweep summary, then FAIL/ERR case lines, then the plain log tail. Full logs
# are preserved by the rendered-parity artifact upload.
# Usage: bash scripts/gate-step.sh <logfile> <command> [args...]
set -uo pipefail
log=$1; shift
"$@" 2>&1 | tee "$log"
rc=${PIPESTATUS[0]}
if [ "$rc" -ne 0 ]; then
  echo "GATE FAILED (rc=$rc): $*" >&2
  {
    grep -E '^==== ' "$log" | tail -n 3
    grep -E '^(FAIL|ERR) ' "$log" | head -n 8
    tail -n 40 "$log"
  } | awk '!seen[$0]++' | head -n 10 | while IFS= read -r line; do
    printf '::error::%s\n' "$line"
  done
  exit "$rc"
fi
