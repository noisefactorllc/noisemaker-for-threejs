#!/usr/bin/env bash
# sweep-corpus.sh — parity-validate every fetched real corpus program (parity/corpus/*.dsl)
# through the dual-backend time-series harness (golden = reference WebGL2, candidate =
# ThreeBackend, identical deterministic time stepping). Corpus programs are complex,
# emergent, and frequently stateful (navierStokes, particles, reaction-diffusion), so
# time-series sampling is the correct test. Fetch first with: node parity/fetch-corpus.mjs
#
# Usage: bash parity/sweep-corpus.sh [frames] [capture] [size]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAMES="${1:-20}"; CAPTURE="${2:-10}"; SIZE="${3:-128}"
OUT="$ROOT/parity/out/CORPUS.txt"; : > "$OUT"
pass=0; fail=0; err=0; worst=0
for prog in "$ROOT"/parity/corpus/*.dsl; do
  [ -e "$prog" ] || { echo "no corpus — run: node parity/fetch-corpus.mjs"; exit 1; }
  name=$(basename "$prog" .dsl)
  out=$(node "$ROOT/parity/timeseries.mjs" "$prog" --frames "$FRAMES" --capture "$CAPTURE" --size "$SIZE" 2>&1)
  line=$(echo "$out" | grep -E "worst max-abs-diff" | tail -1)
  if [ -z "$line" ]; then
    reason=$(echo "$out" | grep -iE "error|not yet|undefined|register" | head -1 | cut -c1-80)
    echo "ERR  $name | ${reason:-no result}" | tee -a "$OUT"; err=$((err+1)); continue
  fi
  m=$(echo "$line" | grep -oE "= [0-9.]+" | grep -oE "[0-9.]+")
  if awk "BEGIN{exit !(${m:-99}<=2.001)}"; then
    echo "PASS $name (worst=$m)" | tee -a "$OUT"; pass=$((pass+1))
  else
    echo "FAIL $name (worst=$m)" | tee -a "$OUT"; fail=$((fail+1))
  fi
  awk "BEGIN{exit !(${m:-0}>$worst)}" && worst=$m
done
echo "" | tee -a "$OUT"
echo "==== CORPUS SWEEP: PASS=$pass FAIL=$fail ERR=$err worst=$worst (frames=$FRAMES capture=$CAPTURE size=$SIZE) ====" | tee -a "$OUT"
