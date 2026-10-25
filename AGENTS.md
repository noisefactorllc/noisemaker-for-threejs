# Noisemaker for Three.js

Three.js adapter and backend for the Noisemaker shader platform.

## Rules

Never create, introduce or use symbolic links anywhere in checkouts, repositories, configuration, scripts or documentation. Every file is a regular file.

Write and present research documents in the established technical whitepaper style. Never use slop headlines, promotional or slogan headers, parenthetical subtitles in titles, stat cards, metric cards, decorative callouts, marketing-speak or invented report layouts.

## Testing & Build

- **Unit tests**: `npm test` (or `node --test test/*.test.mjs`)
- **Lint**: `npm run lint`
- **Vendor fetch**: `npm run vendor` (or `bash vendor/fetch.sh`)
- **Parity sweep**: `npm run parity` (or `bash parity/sweep-corpus.sh`)
