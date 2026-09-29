#!/usr/bin/env bash
# Runs one rendered-parity gate command, tees its full output to a log, and on
# failure emits diagnostic lines as ::error annotations. GitHub keeps only the
# FIRST ~10 annotations per step, so the budget is spent in priority order:
# the sweep summary, then FAIL/ERR case lines, then the final log lines (where
# a crash's message lives). Emission is capped at 10 lines total; full logs
# are preserved by the rendered-parity artifact upload.
# Usage: bash scripts/gate-step.sh <logfile> <command> [args...]
set -uo pipefail
log=$1; shift
"$@" 2>&1 | tee "$log"
rc=${PIPESTATUS[0]}
if [ "$rc" -ne 0 ]; then
  echo "GATE FAILED (rc=$rc): $*" >&2
  {
    grep -E '^==== ' "$log" | tail -n 2
    grep -E '^(FAIL|ERR) ' "$log" | head -n 5
    # Failing-test detail: node:test's spec reporter prints the error message
    # and stack under each ✖ entry — put it ahead of the bare tail so a
    # Windows-only unit-test failure is diagnosed in the annotation budget.
    grep -A4 '^✖ ' "$log" | head -n 30
    tail -n 12 "$log"
  } | awk '!seen[$0]++' | head -n 10 | while IFS= read -r line; do
    printf '::error::%s\n' "$line"
  done
  exit "$rc"
fi
