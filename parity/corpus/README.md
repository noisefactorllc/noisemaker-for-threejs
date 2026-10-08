# Corpus fixtures

Real DSL programs from the public noisedeck gallery (the test corpus named in the
project brief), pinned here so `parity/sweep-corpus.sh` is reproducible offline.

- Source: `blaster.noisedeck.app/api/feed` (codes) → `sharing.noisedeck.app/api/composition/:code` (DSL).
- Refresh / extend: `node parity/fetch-corpus.mjs [count] [--page N]` (read-only, public).
- Validate: `bash parity/sweep-corpus.sh` (dual-backend time-series; all bit-exact).

`manifest.json` maps code → file → title.

A program that calls `user.*` effects needs their Portable definitions, which the gallery
publishes with the share. `<code>.effects.json` holds them (`source` names the share record);
the harness registers them before compiling, the golden through the reference engine's
`CanvasRenderer.registerPortableEffect` and the candidate through the adapter. 4bm9AA, PmJyUQ,
fKPUww and liTYEg are no longer published; they use the `chromeicosahedroninterior` definition
the same author published with B5oBsA. 8KMvAg and WyalUg called a `vaporwaveflyover` effect that
no published share carries, so 7INvow and d-MpwA replaced them.
