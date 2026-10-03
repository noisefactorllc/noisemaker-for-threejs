#!/usr/bin/env bash
# Unit-test entrypoint (npm test). Resolves a usable Playwright
# chromium-headless-shell so the suite cannot hang on a browser-launch
# failure: HOME is often a noexec tmpfs in container harnesses, where the
# default browser path fails at launch with EACCES and node --test then waits
# forever on the still-open HTTP server.
#
# It also fetches the vendored PUBLISHED engine (vendor/noisemaker/, gitignored,
# never committed) when absent, exactly like CI's vendor fetch and the browser
# install below: without it the engine-dependent tests crash with
# ERR_MODULE_NOT_FOUND / ENOENT instead of skipping cleanly.
set -uo pipefail
cd "$(dirname "$0")/.."

CORE="vendor/noisemaker/noisemaker-shaders-core.esm.js"
if [ ! -f "$CORE" ]; then
  bash vendor/fetch.sh
fi
if [ ! -f "$CORE" ]; then
  echo "npm test requires the vendored engine at $CORE (vendor/fetch.sh failed)" >&2
  exit 1
fi

pick_browsers_path() {
  [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ] && { printf '%s' "$PLAYWRIGHT_BROWSERS_PATH"; return; }
  # /state/cache is an exec-mounted cache in this fleet's containers and HOME is
  # often a noexec tmpfs — a browser installed under HOME fails to launch with
  # EACCES. Prefer /state/cache/pw-browsers whenever /state/cache exists, even
  # when empty (the install below fills it); only fall back to HOME otherwise.
  if [ -d /state/cache ] && [ -w /state/cache ]; then
    mkdir -p /state/cache/pw-browsers
    printf '%s' "/state/cache/pw-browsers"
    return
  fi
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
exec env PLAYWRIGHT_BROWSERS_PATH="$BROWSERS" node --test --test-concurrency=1 test/*.test.mjs
