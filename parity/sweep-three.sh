#!/usr/bin/env bash
# parity/sweep-three.sh [tol] [ssim]
#
# Breadth sweep: for every parity program with a golden, render the noisemaker-three
# candidate and compare. Classifies each effect PASS / FAIL (rendered, wrong pixels) /
# ERR (backend feature not yet implemented, or compile/registration error). Writes a
# machine-readable tally to parity/out/SWEEP.txt.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="${NM_PY:-$ROOT/parity/.venv/bin/python}"
TOL="${1:-2.001}"; SSIM="${2:-0.98}"; SIZE=256; TIME=0.25; FRAMES=8
OUT="$ROOT/parity/out/SWEEP.txt"
: > "$OUT"

pass=0; fail=0; err=0; skip=0
for prog in "$ROOT"/parity/programs/*.dsl; do
  name=$(basename "$prog" .dsl)
  gold="$ROOT/parity/out/$name.golden.png"
  cand="$ROOT/parity/out/$name.candidate.png"

  # STATEFUL effects: the snapshot golden (shade-mcp) renders at a FIXED paused time while
  # the candidate steps frames — unfair for state accumulation, so these look divergent here.
  # They are bit-exact (max-abs-diff=0.000) under the fair, identically-stepped time-series
  # harness — see parity/sweep-stateful.sh. (Note: this includes reactionDiffusion, which the
  # sibling Metal-vs-Vulkan ports skip; on our shared ANGLE/Metal driver it is bit-exact.)
  case "$name" in
    reactionDiffusion|navierStokes|convolutionFeedback|temporalAberration|\
    synth3d_cellularAutomata3d|synth3d_reactionDiffusion3d|filter3d_flow3d|\
    agent_buddhabrot|agent_dla|agent_physarum|agent_physical)
      echo "SKIP $name | stateful — bit-exact via parity/sweep-stateful.sh (snapshot is fixed-time/unfair)" | tee -a "$OUT"
      skip=$((skip+1)); continue ;;
  esac

  # Generate the reference golden on demand (new effects without one yet).
  if [ ! -f "$gold" ]; then
    if ! node "$ROOT/parity/export-golden.mjs" "$prog" "$ROOT/parity/out" --size "$SIZE" --time "$TIME" --backend webgl2 >/dev/null 2>&1; then
      echo "ERR  $name | golden generation failed (likely needs special input/params)" | tee -a "$OUT"
      err=$((err+1)); continue
    fi
  fi

  rout=$(node "$ROOT/parity/render-candidate.mjs" "$prog" "$ROOT/parity/out" --size $SIZE --time $TIME --frames $FRAMES 2>&1)
  if ! echo "$rout" | grep -q "wrote"; then
    err=$((err+1))
    reason=$(echo "$rout" | grep -oE "not yet implemented[^\"]*|render error: [^\"]*" | head -1 | cut -c1-70)
    echo "ERR  $name | ${reason:-render failed}" | tee -a "$OUT"
    continue
  fi
  cout=$("$PY" "$ROOT/parity/compare.py" "$gold" "$cand" --name "$name" --tolerance "$TOL" --ssim-min "$SSIM" 2>&1)
  if echo "$cout" | grep -q "\[PASS\]"; then
    pass=$((pass+1)); echo "PASS $name" | tee -a "$OUT"
  else
    fail=$((fail+1))
    echo "FAIL $(echo "$cout" | grep -oE 'max-abs-diff=[0-9.]+ mean-abs-diff=[0-9.]+ ssim=[0-9.]+') $name" | tee -a "$OUT"
  fi
done

echo "" | tee -a "$OUT"
echo "==== SWEEP SUMMARY: PASS=$pass FAIL=$fail ERR=$err SKIP=$skip (tol=$TOL ssim=$SSIM) ====" | tee -a "$OUT"
