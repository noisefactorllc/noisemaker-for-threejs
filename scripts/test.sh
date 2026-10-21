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
  # NOISEMAKER_BROWSER_CACHE names a browser directory on an exec-mounted cache
  # in some CI containers, and HOME is often a noexec tmpfs — a browser
  # installed under HOME fails to launch with EACCES. Prefer
  # NOISEMAKER_BROWSER_CACHE whenever its cache directory exists and is
  # writable, even when empty (the install below fills it); only fall back to
  # HOME otherwise.
  local cache="${NOISEMAKER_BROWSER_CACHE:-}"
  if [ -n "$cache" ] && [ -d "$(dirname "$cache")" ] && [ -w "$(dirname "$cache")" ]; then
    mkdir -p "$cache"
    printf '%s' "$cache"
    return
  fi
  local c
  for c in ${cache:+"$cache"} "$HOME/.cache/ms-playwright"; do
    [ -n "$(ls -d "$c"/chromium_headless_shell-* 2>/dev/null)" ] && { printf '%s' "$c"; return; }
  done
  printf '%s' "${HOME}/.cache/ms-playwright"
}

BROWSERS="$(pick_browsers_path)"
mkdir -p "$BROWSERS"
if [ -z "$(ls -d "$BROWSERS"/chromium_headless_shell-* 2>/dev/null)" ]; then
  PLAYWRIGHT_BROWSERS_PATH="$BROWSERS" node node_modules/@playwright/test/cli.js install chromium-headless-shell
fi
# Operator changed-path mode: with NM_CHANGED_FILES set, run only the tests
# that exercise the changed paths. A test exercises a changed path when it is
# the changed file itself or its source references the changed file's
# basename. With the variable unset the entrypoint runs the whole suite
# exactly as before, and exact-source CI keeps the full run.
if [ -n "${NM_CHANGED_FILES:-}" ]; then
  selected=""
  while IFS= read -r changed; do
    [ -n "$changed" ] || continue
    case "$changed" in
      test/*) selected="$selected $changed" ;;
      *)
        base="$(basename "$changed")"
        for t in test/*.test.mjs; do
          grep -qF -- "$base" "$t" && selected="$selected $t"
        done
        ;;
    esac
  done <<EOF
$NM_CHANGED_FILES
EOF
  selected="$(printf '%s\n' $selected | sort -u)"
  if [ -z "$selected" ]; then
    echo "no unit test exercises the NM_CHANGED_FILES paths; nothing to run" >&2
    exit 0
  fi
  # shellcheck disable=SC2086
  exec env PLAYWRIGHT_BROWSERS_PATH="$BROWSERS" node --test --test-concurrency=1 $selected
fi

exec env PLAYWRIGHT_BROWSERS_PATH="$BROWSERS" node --test --test-concurrency=1 test/*.test.mjs
