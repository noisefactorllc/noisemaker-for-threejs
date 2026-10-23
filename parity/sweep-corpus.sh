#!/usr/bin/env bash
# sweep-corpus.sh — parity-validate every fetched real corpus program (parity/corpus/*.dsl)
# through the dual-backend time-series harness (golden = reference WebGL2, candidate =
# ThreeBackend, identical deterministic time stepping). Corpus programs are complex,
# emergent, and frequently stateful (navierStokes, particles, reaction-diffusion), so
# time-series sampling is the correct test. Fetch first with: node parity/fetch-corpus.mjs
#
# Usage: bash parity/sweep-corpus.sh [frames] [capture] [size] [--shard i/N]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAMES="${1:-20}"; CAPTURE="${2:-10}"; SIZE="${3:-128}"
SHARD=""
if [ "${4:-}" = "--shard" ]; then
  SHARD="${5}"
  if ! [[ "$SHARD" =~ ^[0-9]+/[0-9]+$ ]] || [ "$((10#${SHARD%%/*}))" -ge "$((10#${SHARD##*/}))" ]; then
    echo "ERR  invalid --shard ${SHARD} (expected i/N with i < N)"; exit 2
  fi
fi
# Every corpus program must render on both sides: any ERR, golden or candidate,
# fails the gate. Programs that call user.* effects carry their published
# definitions in <code>.effects.json, which timeseries.mjs registers.
mkdir -p "$ROOT/parity/out"
CORPUS_DSL=("$ROOT"/parity/corpus/*.dsl)
if [ -n "$SHARD" ]; then
  # Round-robin partition of the sorted corpus list, same convention as
  # sweep-programs.mjs --shard: index-based so shard unions are disjoint.
  SHARD_IDX="$((10#${SHARD%%/*}))"; SHARD_TOTAL="$((10#${SHARD##*/}))"
  filtered=(); i=0
  for prog in "${CORPUS_DSL[@]}"; do
    [ $((i % SHARD_TOTAL)) -eq "$SHARD_IDX" ] && filtered+=("$prog")
    i=$((i+1))
  done
  CORPUS_DSL=("${filtered[@]}")
  OUT="$ROOT/parity/out/CORPUS.shard${SHARD_IDX}of${SHARD_TOTAL}.txt"
else
  OUT="$ROOT/parity/out/CORPUS.txt"
fi
: > "$OUT"
pass=0; fail=0; err=0; worst=0; rc=0
for prog in "${CORPUS_DSL[@]}"; do
  [ -e "$prog" ] || { echo "no corpus — run: node parity/fetch-corpus.mjs"; exit 1; }
  name=$(basename "$prog" .dsl)
  status=0
  out=$(node "$ROOT/parity/timeseries.mjs" "$prog" --frames "$FRAMES" --capture "$CAPTURE" --size "$SIZE" 2>&1) || status=$?
  line=$(echo "$out" | grep -E "worst max-abs-diff" | tail -1)
  if [ "$status" -ne 0 ] || [ -z "$line" ]; then
    printf '%s\n' "$out"
    reason=$(echo "$out" | grep -v '^PARITY-CONSOLE ' | grep -iE "error|not yet|undefined|register" | head -1 | cut -c1-80)
    echo "ERR  $name | ${reason:-no result; child exit=$status}" | tee -a "$OUT"; err=$((err+1)); rc=1
    continue
  fi
  m=$(echo "$line" | grep -oE "= [0-9]+([.][0-9]+)?$" | cut -d ' ' -f 2)
  if ! echo "$out" | grep -E '^\[FAIL\]' >/dev/null && awk "BEGIN{exit !(${m:-99}<=2.001)}"; then
    echo "PASS $name (worst=$m)" | tee -a "$OUT"; pass=$((pass+1))
  else
    echo "FAIL $name (worst=$m)" | tee -a "$OUT"; fail=$((fail+1)); rc=1
  fi
  awk "BEGIN{exit !(${m:-0}>$worst)}" && worst=$m
done
echo "" | tee -a "$OUT"
echo "==== CORPUS SWEEP: PASS=$pass FAIL=$fail ERR=$err worst=$worst (frames=$FRAMES capture=$CAPTURE size=$SIZE${SHARD:+ shard=$SHARD_IDX of $SHARD_TOTAL}) ====" | tee -a "$OUT"
exit $rc
