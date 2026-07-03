#!/bin/bash
# Restart Fusion Studio from a clean state.
# Kills any running server/electron processes, rebuilds the client bundle,
# relaunches the app, and verifies both processes are alive.

set -e

CLIENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_APP="${CLIENT_DIR}/node_modules/electron/dist/Electron.app"
MAIN_SCRIPT="${CLIENT_DIR}/electron/main.cjs"

echo "[restart] Stopping any running Fusion Studio processes..."
pkill -9 -f 'fusion-studio-server/server.js' || true
pkill -9 -f 'Electron.*electron/main.cjs' || true

# Give processes time to release ports/file handles.
sleep 2

echo "[restart] Building client bundle..."
cd "${CLIENT_DIR}"
npm run build

echo "[restart] Launching Electron..."
open -n -a "${ELECTRON_APP}" --args "${MAIN_SCRIPT}"

# Wait for the app and server to come up.
sleep 4

echo "[restart] Verifying processes..."
if pgrep -f 'Electron.*electron/main.cjs' >/dev/null && pgrep -f 'fusion-studio-server/server.js' >/dev/null; then
  echo "[restart] Fusion Studio restarted successfully."
else
  echo "[restart] ERROR: Fusion Studio did not start. Check /tmp/fusion-electron.log and server-live.log."
  exit 1
fi
