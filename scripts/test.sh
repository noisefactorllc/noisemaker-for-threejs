#!/usr/bin/env bash
# Unit-test entrypoint (npm test). Resolves a usable Playwright
# chromium-headless-shell so the suite cannot hang on a browser-launch
# failure: HOME is often a noexec tmpfs in container harnesses, where the
# default browser path fails at launch with EACCES and node --test then waits
# forever on the still-open HTTP server.
set -uo pipefail
cd "$(dirname "$0")/.."

pick_browsers_path() {
  [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ] && { printf '%s' "$PLAYWRIGHT_BROWSERS_PATH"; return; }
  local c
  for c in /state/cache/pw-browsers "$HOME/.cache/ms-playwright"; do
    [ -n "$(ls -d "$c"/chromium_headless_shell-* 2>/dev/null)" ] && { printf '%s' "$c"; return; }
  done
  printf '%s' "${HOME}/.cache/ms-playwright"
}

BROWSERS="$(pick_browsers_path)"
mkdir -p "$BROWSERS"
if [ -z "$(ls -d "$BROWSERS"/chromium_headless_shell-* 2>/dev/null)" ]; then
  PLAYWRIGHT_BROWSERS_PATH="$BROWSERS" node node_modules/@playwright/test/cli.js install chromium-headless-shell
fi
exec env PLAYWRIGHT_BROWSERS_PATH="$BROWSERS" node --test test/*.test.mjs
