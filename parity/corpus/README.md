# Corpus fixtures

Real DSL programs from the public noisedeck gallery (the test corpus named in the
project brief), pinned here so `parity/sweep-corpus.sh` is reproducible offline.

- Source: `blaster.noisedeck.app/api/feed` (codes) → `sharing.noisedeck.app/api/composition/:code` (DSL).
- Refresh / extend: `node parity/fetch-corpus.mjs [count] [--page N]` (read-only, public).
- Validate: `bash parity/sweep-corpus.sh` (dual-backend time-series; all bit-exact).

`manifest.json` maps code → file → title.
