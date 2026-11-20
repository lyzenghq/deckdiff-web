#!/bin/sh
# SPDX-License-Identifier: GPL-2.0-only

CDPATH='' cd -P "$(dirname "$0")" || exit 1

node_exe=$(command -v node)
if [ -z "$node_exe" ]; then
  # Check common macOS install locations when node is not on PATH.
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "$candidate" ]; then
      node_exe=$candidate
      break
    fi
  done
fi

if [ -z "$node_exe" ]; then
  printf '%s\n' 'Node.js was not found. Install Node.js 22.9.0 or newer and make sure node is on your PATH.' \
    'Download: https://nodejs.org/en/download' >&2
  exit 1
fi

if ! "$node_exe" -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  process.exit(major > 22 || (major === 22 && minor >= 9) ? 0 : 1);
'; then
  printf '%s\n' 'Node.js 22.9.0 or newer is required. Please update Node.js.' \
    'Download: https://nodejs.org/en/download' >&2
  exit 1
fi

printf 'Using Node.js: %s\n' "$node_exe"
exec "$node_exe" --env-file-if-exists=.env server.mjs
