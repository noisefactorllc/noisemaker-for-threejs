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
EFFECTS="${*:-navierStokes convolutionFeedback temporalAberration reactionDiffusion cellularAutomata feedback synth3d_cellularAutomata3d synth3d_reactionDiffusion3d filter3d_flow3d}"
worst=0
for name in $EFFECTS; do
  out=$(node "$ROOT/parity/timeseries.mjs" "$ROOT/parity/programs/$name.dsl" --frames 30 --capture 15 --size 128 2>&1)
  line=$(echo "$out" | grep -E "worst" | tail -1)
  echo "$line" | sed "s|\[ts\] ||"
  m=$(echo "$line" | grep -oE "= [0-9.]+" | grep -oE "[0-9.]+")
  [ -n "$m" ] && awk "BEGIN{exit !($m>$worst)}" && worst=$m
done
echo "==== STATEFUL SWEEP: worst max-abs-diff = $worst (0 = all bit-exact) ===="
