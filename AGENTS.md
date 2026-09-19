# Noisemaker for Three.js

Three.js adapter and backend for the Noisemaker shader platform.

## Strict Rules

HARD, PERMANENT, INVIOLABLE BAN: BANNED FROM SYMLINKS. Never create, introduce, or use symbolic links anywhere in checkouts, repositories, configuration, scripts, or documentation. All files must be regular files. Zero exceptions.

HARD, PERMANENT, INVIOLABLE BAN: Research documents must be written and presented strictly in the established technical whitepaper style. Banned from slop headlines, promotional/slogan headers, parenthetical subtitles in titles, stat cards, metric cards, decorative callouts, marketing-speak, and invented report layouts. Zero exceptions.

## Testing & Build

- **Unit tests**: `npm test` (or `node --test test/*.test.mjs`)
- **Lint**: `npm run lint`
- **Vendor fetch**: `npm run vendor` (or `bash vendor/fetch.sh`)
- **Parity sweep**: `npm run parity` (or `bash parity/sweep-corpus.sh`)
