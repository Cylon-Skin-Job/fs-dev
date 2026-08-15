#!/bin/bash
# Restart script for fusion-studio — project-scoped.
# Kills server, rebuilds, restarts server, and launches Electron.

set -e

PROJECT_DIR="$HOME/projects/fs-dev"
PID_FILE="/tmp/fusion-studio.pid"
LOG_FILE="/tmp/fusion-studio.log"
ELECTRON_PID_FILE="/tmp/fusion-electron.pid"
ELECTRON_LOG_FILE="${TMPDIR:-/tmp/}fusion-electron.log"
ELECTRON_APP="$PROJECT_DIR/fusion-studio-client/node_modules/electron/dist/Electron.app"
ELECTRON_BIN="$PROJECT_DIR/fusion-studio-client/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
ELECTRON_MAIN="$PROJECT_DIR/fusion-studio-client/electron/main.cjs"
ELECTRON_PORT_FILE="$HOME/Library/Application Support/Fusion Studio/server.port"

# 1. Kill previous standalone server by pidfile, if present.
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# 2. Kill previous Electron instance by pidfile, if present.
if [ -f "$ELECTRON_PID_FILE" ]; then
  OLD_ELECTRON_PID=$(cat "$ELECTRON_PID_FILE" 2>/dev/null || echo "")
  if [ -n "$OLD_ELECTRON_PID" ] && kill -0 "$OLD_ELECTRON_PID" 2>/dev/null; then
    kill -9 "$OLD_ELECTRON_PID" 2>/dev/null || true
  fi
  rm -f "$ELECTRON_PID_FILE"
fi

# 3. Fallback: kill any stray process running THIS project's server.js or Electron entrypoint.
pkill -9 -f "fusion-studio-server/server\.js" 2>/dev/null || true
pkill -9 -f "electron/main\.cjs" 2>/dev/null || true
pkill -9 -f "$ELECTRON_MAIN" 2>/dev/null || true
pkill -9 -f "$ELECTRON_BIN" 2>/dev/null || true

sleep 1

# 4. Clear Electron renderer caches/session storage so the app does not
#    restore a prior state on relaunch.
ELECTRON_USER_DATA="$HOME/Library/Application Support/Fusion Studio"
for cache_dir in "Cache" "Code Cache" "GPUCache" "Local Storage" "Session Storage"; do
  rm -rf "$ELECTRON_USER_DATA/$cache_dir"
done

# Build frontend (fails loudly if TypeScript errors)
cd "$PROJECT_DIR/fusion-studio-client" && npm run build

# Launch Electron directly. Electron owns the server process now and spawns it
# on a free port, writing that port through electron/port-file.cjs.
if [ ! -d "$ELECTRON_APP" ]; then
  echo "ERROR: Electron app not found at $ELECTRON_APP"
  exit 1
fi

: > "$ELECTRON_LOG_FILE"
rm -f "$ELECTRON_PORT_FILE"

# Launch through macOS LaunchServices. Running the Electron binary directly from
# a non-interactive script can leave us tracking a short-lived launcher process
# instead of the durable GUI application process.
open -n "$ELECTRON_APP" --args "$ELECTRON_MAIN"
osascript -e 'tell application "Electron" to activate' >/dev/null 2>&1 || true

SERVER_READY=""
for _ in {1..30}; do
  if [ -f "$ELECTRON_PORT_FILE" ]; then
    SERVER_READY=$(cat "$ELECTRON_PORT_FILE" 2>/dev/null || echo "")
    if [ -n "$SERVER_READY" ] && lsof -i:"$SERVER_READY" >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 1
done

ELECTRON_PID=$(pgrep -f "$ELECTRON_MAIN" | head -1 || true)
if [ -z "$ELECTRON_PID" ]; then
  ELECTRON_PID=$(pgrep -f "$ELECTRON_BIN" | head -1 || true)
fi
if [ -n "$ELECTRON_PID" ]; then
  echo "$ELECTRON_PID" > "$ELECTRON_PID_FILE"
else
  rm -f "$ELECTRON_PID_FILE"
fi

if [ -z "$SERVER_READY" ] || ! lsof -i:"$SERVER_READY" >/dev/null 2>&1; then
  echo "ERROR: Electron did not report a live server within 30 seconds. Last 80 lines of $ELECTRON_LOG_FILE:"
  tail -80 "$ELECTRON_LOG_FILE"
  exit 1
fi

if [ -n "$ELECTRON_PID" ]; then
  echo "Electron PID: $ELECTRON_PID  (written to $ELECTRON_PID_FILE)"
else
  echo "Electron PID: unknown"
fi
echo "Electron Log: $ELECTRON_LOG_FILE"
echo "Server URL:   http://localhost:$SERVER_READY"
