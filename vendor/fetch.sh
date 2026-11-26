#!/usr/bin/env bash
# vendor/fetch.sh — vendor the PUBLISHED Noisemaker shader engine from the production CDN.
#
# Fetch the published reference and effect bundles, then derive the stable core
# from the release source. The reviewed source overlay excludes experimental
# features. Engine bytes stay ignored, and no sibling checkout is required.
#
#   bash vendor/fetch.sh            # refresh from the pinned version
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-1.5.6}"
BASE="https://shaders.noisedeck.app/${VERSION}"
OUT="$HERE/noisemaker"
EFFECTS="$OUT/effects"

mkdir -p "$EFFECTS"
echo "[vendor] engine $BASE -> $OUT"

# 1. Engine core (exports Pipeline, compileGraph, Backend, WebGL2Backend, registerEffect, …).
curl -fsSL --max-time 60 "$BASE/noisemaker-shaders-core.esm.js" -o "$OUT/noisemaker-shaders-reference.esm.js"
curl -fsSL --max-time 30 "$BASE/deployment-meta.json" -o "$OUT/deployment-meta.json"
node "$HERE/build-stable-core.mjs"

# 2. Manifest (effect descriptors, keyed "<namespace>/<effect>").
curl -fsSL --max-time 30 "$BASE/effects/manifest.json" -o "$EFFECTS/manifest.json"

# 3. Per-effect mini-bundles (definition + GLSL/WGSL inline; self-contained ESM, Node-loadable).
codes=$(node -e 'const m=require(process.argv[1]); console.log(Object.keys(m).join("\n"))' "$EFFECTS/manifest.json")
n=0; ok=0
for id in $codes; do
  n=$((n+1))
  ns="${id%%/*}"; eff="${id##*/}"
  mkdir -p "$EFFECTS/$ns"
  if curl -fsSL --max-time 30 "$BASE/effects/$ns/$eff.js" -o "$EFFECTS/$ns/$eff.js"; then ok=$((ok+1)); else echo "[vendor]   MISS $id"; fi
done
echo "$VERSION" > "$OUT/VERSION"
echo "[vendor] done: core + manifest + $ok/$n mini-bundles (version $VERSION)"
