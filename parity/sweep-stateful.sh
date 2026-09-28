#!/usr/bin/env bash
# parity/sweep-stateful.sh — authoritative parity for STATEFUL/continuous effects.
#
# The snapshot sweep (sweep-three.sh) renders the reference golden at a fixed paused time
# (shade-mcp) while the candidate steps frames — fine for stateless effects, but UNFAIR for
# stateful ones (the two sides accumulate different state). The time-series harness drives
# BOTH the golden (vendored reference WebGL2 backend) and the candidate (ThreeBackend) with
# the IDENTICAL deterministic time sequence, so it is the correct test for statefuls.
#
# All of these are bit-exact (max-abs-diff=0.000) — including reactionDiffusion, which the
# snapshot harness made look divergent.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EFFECTS="${*:-navierStokes convolutionFeedback temporalAberration reactionDiffusion cellularAutomata feedback synth3d_cellularAutomata3d synth3d_reactionDiffusion3d filter3d_flow3d agent_buddhabrot agent_dla agent_physarum agent_physical}"
worst=0; pass=0; fail=0; err=0
for name in $EFFECTS; do
  status=0
  out=$(node "$ROOT/parity/timeseries.mjs" "$ROOT/parity/programs/$name.dsl" --frames 30 --capture 15 --size 128 2>&1) || status=$?
  line=$(echo "$out" | grep -E "worst max-abs-diff" | tail -1)
  m=$(echo "$line" | grep -oE "= [0-9]+([.][0-9]+)?$" | cut -d ' ' -f 2)
  if [ "$status" -ne 0 ] || [ -z "$m" ]; then
    printf '%s\n' "$out"
    echo "ERR  $name | child exit=$status; valid summary required"
    err=$((err+1)); continue
  fi
  echo "$line" | sed "s|\[ts\] ||"
  if echo "$out" | grep -E '^\[FAIL\]' >/dev/null || ! awk "BEGIN{exit !($m==0)}"; then
    fail=$((fail+1))
  else
    pass=$((pass+1))
  fi
  awk "BEGIN{exit !($m>$worst)}" && worst=$m
done
echo "==== STATEFUL SWEEP: PASS=$pass FAIL=$fail ERR=$err worst max-abs-diff = $worst (0 = all bit-exact) ===="
[ "$pass" -gt 0 ] && [ "$fail" -eq 0 ] && [ "$err" -eq 0 ]
