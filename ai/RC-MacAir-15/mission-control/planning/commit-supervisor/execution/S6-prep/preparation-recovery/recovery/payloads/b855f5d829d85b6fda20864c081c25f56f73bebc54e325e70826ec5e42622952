#!/bin/bash
# Canonical development restart. All target selection precedes runtime mutation.
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd -P)
exec node "$SCRIPT_DIR/scripts/fusion-restart.mjs" --script-repo "$SCRIPT_DIR" "$@"
