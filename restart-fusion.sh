#!/bin/bash
# Restart script for fusion-studio — project-scoped.
# Kills server, rebuilds, restarts server, and launches Electron.

set -e

SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd -P)
PROJECT_DIR="$SCRIPT_DIR"
MACHINE_ID=""
DRY_RUN=0

usage() {
  echo "Usage: $0 [--repo /absolute/repository/path] [--machine machine-id] [--dry-run]"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      [ "$#" -ge 2 ] || { usage >&2; exit 2; }
      PROJECT_DIR="$2"
      shift 2
      ;;
    --machine)
      [ "$#" -ge 2 ] || { usage >&2; exit 2; }
      MACHINE_ID="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ ! -d "$PROJECT_DIR" ]; then
  echo "ERROR: repository does not exist: $PROJECT_DIR" >&2
  exit 1
fi
PROJECT_DIR=$(cd -- "$PROJECT_DIR" && pwd -P)

if [ ! -d "$PROJECT_DIR/fusion-studio-client" ] \
  || [ ! -d "$PROJECT_DIR/fusion-studio-server" ] \
  || [ ! -f "$PROJECT_DIR/restart-fusion.sh" ]; then
  echo "ERROR: not a Fusion Studio repository: $PROJECT_DIR" >&2
  exit 1
fi

REPOSITORY_ROOT=$(git -C "$PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null || true)
if [ "$REPOSITORY_ROOT" != "$PROJECT_DIR" ]; then
  echo "ERROR: --repo must name the resolved Git worktree root: $PROJECT_DIR" >&2
  exit 1
fi

if [ -z "$MACHINE_ID" ]; then
  if [ -d "$PROJECT_DIR/ai/RC-MacAir-15/System" ]; then
    MACHINE_ID="RC-MacAir-15"
  else
    echo "ERROR: --machine is required when RC-MacAir-15 is not present" >&2
    exit 1
  fi
fi
case "$MACHINE_ID" in
  ''|*[!A-Za-z0-9._-]*|.*|..*)
    echo "ERROR: invalid machine identity" >&2
    exit 1
    ;;
esac
if [ ! -d "$PROJECT_DIR/ai/$MACHINE_ID/System" ]; then
  echo "ERROR: machine System tree not found: ai/$MACHINE_ID/System" >&2
  exit 1
fi

PID_FILE="/tmp/fusion-studio.pid"
LOG_FILE="/tmp/fusion-studio.log"
ELECTRON_PID_FILE="/tmp/fusion-electron.pid"
ELECTRON_LOG_FILE="${TMPDIR:-/tmp/}fusion-electron.log"
ELECTRON_APP="$PROJECT_DIR/fusion-studio-client/node_modules/electron/dist/Electron.app"
ELECTRON_BIN="$PROJECT_DIR/fusion-studio-client/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
ELECTRON_MAIN="$PROJECT_DIR/fusion-studio-client/electron/main.cjs"
ELECTRON_PORT_FILE="$HOME/Library/Application Support/Fusion Studio/server.port"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Repository:   $PROJECT_DIR"
  echo "Machine:      $MACHINE_ID"
  echo "Electron:     $ELECTRON_APP"
  echo "Electron main:$ELECTRON_MAIN"
  echo "Profile:      $HOME/Library/Application Support/Fusion Studio"
  exit 0
fi

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
env -u FUSION_APP_USER_DATA FUSION_LOCAL_MACHINE="$MACHINE_ID" \
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
echo "Repository:   $PROJECT_DIR"
echo "Machine:      $MACHINE_ID"
