#!/usr/bin/env bash
# parity/run.sh <name> [tol] [ssim_min] [size] [time] [frames]
#
# End-to-end parity for one program: ensure the reference golden exists, render the
# noisemaker-three candidate (three.js + ThreeBackend), and compare. Both sides run
# the SAME reused compiler on the SAME ANGLE/Metal GL backend, so this measures the
# backend's rendering fidelity.
#
# Goldens are produced by the reference (parity/export-golden.mjs); candidates by
# parity/render-candidate.mjs. compare.py needs numpy+Pillow — point NM_PY at a venv
# python (defaults to the sibling port's venv).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:?usage: run.sh <name> [tol] [ssim_min] [size] [time] [frames]}"
TOL="${2:-2.001}"
SSIM="${3:-0.98}"
SIZE="${4:-256}"
TIME="${5:-0.25}"
FRAMES="${6:-8}"
PY="${NM_PY:-$ROOT/parity/.venv/bin/python}"

PROG="$ROOT/parity/programs/$NAME.dsl"
GOLD="$ROOT/parity/out/$NAME.golden.png"
CAND="$ROOT/parity/out/$NAME.candidate.png"

[ -f "$PROG" ] || { echo "missing program: $PROG"; exit 2; }

if [ ! -f "$GOLD" ]; then
  echo "[run] golden missing — generating via reference harness"
  node "$ROOT/parity/export-golden.mjs" "$PROG" "$ROOT/parity/out" --size "$SIZE" --time "$TIME" --backend webgl2
fi

node "$ROOT/parity/render-candidate.mjs" "$PROG" "$ROOT/parity/out" --size "$SIZE" --time "$TIME" --frames "$FRAMES"

"$PY" "$ROOT/parity/compare.py" "$GOLD" "$CAND" \
  --name "$NAME" --tolerance "$TOL" --ssim-min "$SSIM" \
  --report "$ROOT/parity/out/$NAME.report.json"
