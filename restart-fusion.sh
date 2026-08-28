#!/usr/bin/env bash

# Canonical Fusion Studio development restart.
# Always rebuilds, stops the selected development profile, clears renderer and
# session caches, relaunches the requested checkout, and verifies readiness.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: restart-fusion.sh [options]

  --repo PATH       Fusion Studio checkout/worktree (default: this script's checkout)
  --machine NAME    FUSION_LOCAL_MACHINE identity (auto-detected when unambiguous)
  --dry-run         Resolve and print the restart target without changing anything
  -h, --help        Show this help

There are no partial restart modes. A normal run rebuilds the client, stops the
selected Fusion development app, removes regenerable renderer/session state,
relaunches Electron, and verifies the renderer/server connection.
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

append_pid() {
  local pid_list="$1"
  local candidate_pid="$2"
  case " $pid_list " in
    *" $candidate_pid "*) echo "$pid_list" ;;
    *) echo "${pid_list:+$pid_list }$candidate_pid" ;;
  esac
}

pid_in_list() {
  local candidate_pid="$1"
  local pid_list="$2"
  case " $pid_list " in
    *" $candidate_pid "*) return 0 ;;
    *) return 1 ;;
  esac
}

pid_count() {
  local pid_list="$1"
  if [ -z "$pid_list" ]; then
    echo 0
    return
  fi
  set -- $pid_list
  echo "$#"
}

first_pid() {
  local pid_list="$1"
  set -- $pid_list
  echo "${1:-}"
}

command_has_argument() {
  local command_text="$1"
  local expected_argument="$2"
  case "$command_text" in
    "$expected_argument"|"$expected_argument "*|*" $expected_argument"|*" $expected_argument "*) return 0 ;;
    *) return 1 ;;
  esac
}

command_has_option_value() {
  local command_text="$1"
  local option_name="$2"
  local expected_value="$3"
  case "$command_text" in
    "$option_name=$expected_value"|"$option_name=$expected_value --"*|*" $option_name=$expected_value"|*" $option_name=$expected_value --"*) return 0 ;;
    *) return 1 ;;
  esac
}

process_cwd() {
  local process_pid="$1"
  lsof -a -p "$process_pid" -d cwd -Fn 2>/dev/null \
    | awk '/^n/ { value = substr($0, 2) } END { print value }'
}

wait_for_exit() {
  local wait_pid="$1"
  local wait_count=0
  while kill -0 "$wait_pid" 2>/dev/null && [ "$wait_count" -lt 40 ]; do
    sleep 0.25
    wait_count=$((wait_count + 1))
  done
  ! kill -0 "$wait_pid" 2>/dev/null
}

repo=""
machine="${FUSION_LOCAL_MACHINE:-}"
dry_run=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      [ "$#" -ge 2 ] || fail "--repo requires a path"
      repo="$2"
      shift 2
      ;;
    --machine)
      [ "$#" -ge 2 ] || fail "--machine requires a value"
      machine="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

if [ -z "$repo" ]; then
  repo=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
fi
repo=$(git -C "$repo" rev-parse --show-toplevel 2>/dev/null) \
  || fail "target is not inside a Git checkout: $repo"
repo=$(cd "$repo" && pwd -P)

case "$repo" in
  *"Fusion-Studio-Alpha-Source"*)
    fail "Alpha source checkout detected; follow the repository's Alpha restart workflow"
    ;;
esac

client="$repo/fusion-studio-client"
server="$repo/fusion-studio-server"
electron_main="$client/electron/main.cjs"
server_main="$server/server.js"
server_log="$server/server-live.log"

[ -f "$electron_main" ] || fail "missing $electron_main"
[ -f "$server_main" ] || fail "missing $server_main"
[ -f "$client/package.json" ] || fail "missing $client/package.json"

if [ -z "$machine" ]; then
  machine_candidates=""
  machine_candidate_count=0
  for machine_system in "$repo"/ai/*/System; do
    [ -d "$machine_system" ] || continue
    machine_name=$(basename "$(dirname "$machine_system")")
    machine_candidates="${machine_candidates:+$machine_candidates }$machine_name"
    machine_candidate_count=$((machine_candidate_count + 1))
  done
  if [ "$machine_candidate_count" -eq 1 ]; then
    machine="$machine_candidates"
  elif [ "$machine_candidate_count" -eq 0 ]; then
    fail "no ai/<machine>/System tree found; pass --machine"
  else
    echo "Available machine identities: $machine_candidates" >&2
    fail "multiple machine identities found; pass --machine"
  fi
fi
[ -d "$repo/ai/$machine" ] || fail "machine tree does not exist: $repo/ai/$machine"

profile_env_explicit=0
if [ -n "${FUSION_APP_USER_DATA:-}" ]; then
  profile_env_explicit=1
  profile="$FUSION_APP_USER_DATA"
else
  profile="$HOME/Library/Application Support/Fusion Studio"
fi

profile_leaf=$(basename "$profile")
case "$profile_leaf" in
  "."|"..")
    fail "refusing unsafe profile leaf: $profile_leaf"
    ;;
esac

if [ -e "$profile" ]; then
  [ -d "$profile" ] || fail "profile exists but is not a directory: $profile"
  profile=$(cd "$profile" && pwd -P)
else
  profile_parent=$(dirname "$profile")
  [ -d "$profile_parent" ] || fail "profile parent does not exist: $profile_parent"
  profile=$(cd "$profile_parent" && pwd -P)/$profile_leaf
fi

case "$profile" in
  "/"|"/Users"|"/private"|"/private/tmp"|"/tmp"|"$HOME"|*"Fusion Studio Alpha"*)
    fail "refusing to clear unsafe or Alpha profile path: $profile"
    ;;
esac

port_file="$profile/server.port"
if [ "$profile_env_explicit" -eq 1 ]; then
  server_log="$profile/server-live.log"
fi

target_electron_app="$client/node_modules/electron/dist/Electron.app"
electron_app=""
if [ -d "$target_electron_app" ]; then
  electron_app="$target_electron_app"
else
  while IFS= read -r worktree_path; do
    candidate_app="$worktree_path/fusion-studio-client/node_modules/electron/dist/Electron.app"
    if [ -d "$candidate_app" ]; then
      electron_app="$candidate_app"
      break
    fi
  done < <(git -C "$repo" worktree list --porcelain | sed -n 's/^worktree //p')
fi
[ -n "$electron_app" ] || fail "no Electron runtime found in this repository's worktrees; install client dependencies"

main_process_uses_profile() {
  local expected_main_pid="$1"
  local expected_profile="$2"
  while read -r child_pid child_ppid child_command; do
    if [ "$child_ppid" = "$expected_main_pid" ] \
      && command_has_option_value "$child_command" '--user-data-dir' "$expected_profile"; then
      return 0
    fi
  done < <(ps -axo pid=,ppid=,command=)
  return 1
}

main_targets_checkout() {
  local expected_main_pid="$1"
  local main_command="$2"
  if command_has_argument "$main_command" "$electron_main"; then
    return 0
  fi
  if command_has_argument "$main_command" 'electron/main.cjs' \
    && [ "$(process_cwd "$expected_main_pid")" = "$client" ]; then
    return 0
  fi
  return 1
}

profile_main_pids=""
target_main_pids=""
owned_server_pids=""
target_renderer_pids=""

discover_runtime() {
  profile_main_pids=""
  target_main_pids=""
  owned_server_pids=""
  target_renderer_pids=""

  while read -r process_pid process_ppid process_command; do
    if command_has_argument "$process_command" '--type=renderer' \
      && command_has_option_value "$process_command" '--user-data-dir' "$profile"; then
      profile_main_pids=$(append_pid "$profile_main_pids" "$process_ppid")
    fi
  done < <(ps -axo pid=,ppid=,command=)

  # A stale port file must not make another profile's Fusion process eligible.
  if [ -s "$port_file" ]; then
    profile_port=$(tr -d '[:space:]' < "$port_file")
    if [ -n "$profile_port" ]; then
      listener_pids=$({ lsof -nP -t -iTCP:"$profile_port" -sTCP:LISTEN 2>/dev/null || true; } | tr '\n' ' ')
      for listener_pid in $listener_pids; do
        listener_command=$(ps -p "$listener_pid" -o command= 2>/dev/null || true)
        listener_ppid=$({ ps -p "$listener_pid" -o ppid= 2>/dev/null || true; } | tr -d '[:space:]')
        listener_parent_command=$(ps -p "$listener_ppid" -o command= 2>/dev/null || true)
        if command_has_argument "$listener_command" "$server_main" \
          && main_targets_checkout "$listener_ppid" "$listener_parent_command" \
          && main_process_uses_profile "$listener_ppid" "$profile"; then
          profile_main_pids=$(append_pid "$profile_main_pids" "$listener_ppid")
        fi
      done
    fi
  fi

  for main_pid in $profile_main_pids; do
    main_command=$(ps -p "$main_pid" -o command= 2>/dev/null || true)
    if main_targets_checkout "$main_pid" "$main_command"; then
      target_main_pids=$(append_pid "$target_main_pids" "$main_pid")
    fi
  done

  while read -r process_pid process_ppid process_command; do
    if pid_in_list "$process_ppid" "$target_main_pids"; then
      if command_has_argument "$process_command" "$server_main"; then
        owned_server_pids=$(append_pid "$owned_server_pids" "$process_pid")
      fi
      if command_has_argument "$process_command" '--type=renderer' \
        && command_has_option_value "$process_command" '--user-data-dir' "$profile" \
        && command_has_option_value "$process_command" '--app-path' "$client/electron"; then
        target_renderer_pids=$(append_pid "$target_renderer_pids" "$process_pid")
      fi
    fi
  done < <(ps -axo pid=,ppid=,command=)
}

discover_runtime

echo "Fusion Studio full restart"
echo "Checkout:         $repo"
echo "Machine:          $machine"
echo "Profile:          $profile"
echo "Electron runtime: $electron_app"
echo "Readiness log:    $server_log"
echo "Reset:            Cache, Code Cache, GPUCache, Local Storage, Session Storage"
if [ -n "$profile_main_pids" ]; then
  echo "Profile processes to stop:"
  for main_pid in $profile_main_pids; do
    echo "  $main_pid $(ps -p "$main_pid" -o command= 2>/dev/null || true)"
  done
else
  echo "Profile processes to stop: none"
fi

if [ "$dry_run" -eq 1 ]; then
  exit 0
fi

# Build before stopping the running app so a compile error leaves it available.
(cd "$client" && npm run build)

# The build can take long enough for the running app to change. Refresh targets
# immediately before sending signals or removing any profile entries.
discover_runtime

if [ -n "$profile_main_pids" ]; then
  for main_pid in $profile_main_pids; do
    if main_process_uses_profile "$main_pid" "$profile"; then
      kill -TERM "$main_pid" 2>/dev/null || true
    else
      fail "profile ownership changed before stopping Electron PID $main_pid"
    fi
  done
  for main_pid in $profile_main_pids; do
    if ! wait_for_exit "$main_pid"; then
      echo "Electron PID $main_pid did not stop gracefully; force stopping it"
      kill -KILL "$main_pid" 2>/dev/null || true
      wait_for_exit "$main_pid" || fail "Electron PID $main_pid did not stop"
    fi
  done
fi

clear_profile_entry() {
  local entry_name="$1"
  local entry_path="$profile/$entry_name"
  if [ -e "$entry_path" ]; then
    rm -rf -- "$entry_path"
    echo "Cleared:          $entry_path"
  fi
}

clear_profile_entry "Cache"
clear_profile_entry "Code Cache"
clear_profile_entry "GPUCache"
clear_profile_entry "Local Storage"
clear_profile_entry "Session Storage"
clear_profile_entry "server.port"

log_start_lines=0
if [ -f "$server_log" ]; then
  log_start_lines=$(wc -l < "$server_log" | tr -d '[:space:]')
fi

if [ "$profile_env_explicit" -eq 1 ]; then
  env FUSION_APP_USER_DATA="$profile" FUSION_LOCAL_MACHINE="$machine" \
    open -n "$electron_app" --args "$electron_main"
else
  env FUSION_LOCAL_MACHINE="$machine" \
    open -n "$electron_app" --args "$electron_main"
fi

log_has_since() {
  local log_needle="$1"
  awk -v first="$((log_start_lines + 1))" -v needle="$log_needle" '
    NR >= first && index($0, needle) { found = 1 }
    END { exit(found ? 0 : 1) }
  ' "$server_log"
}

log_has_exact_suffix_since() {
  local log_suffix="$1"
  awk -v first="$((log_start_lines + 1))" -v suffix="$log_suffix" '
    NR >= first && length($0) >= length(suffix) && substr($0, length($0) - length(suffix) + 1) == suffix { found = 1 }
    END { exit(found ? 0 : 1) }
  ' "$server_log"
}

fresh_log_ready() {
  [ -f "$server_log" ] || return 1
  log_has_exact_suffix_since "activeRoot: $repo" || return 1
  log_has_since 'workspace:init' || return 1
  log_has_since "ai/$machine/" || return 1
}

listener_matches_server() {
  local listener_port="$1"
  local expected_server_pid="$2"
  local listener_pids
  [ -n "$listener_port" ] || return 1
  listener_pids=$({ lsof -nP -t -iTCP:"$listener_port" -sTCP:LISTEN 2>/dev/null || true; } | tr '\n' ' ')
  pid_in_list "$expected_server_pid" "$listener_pids"
}

electron_client_connected() {
  local expected_main_pid="$1"
  local connection_port="$2"
  local connection_pids
  connection_pids=$({ lsof -nP -t -iTCP:"$connection_port" -sTCP:ESTABLISHED 2>/dev/null || true; } | tr '\n' ' ')
  for connection_pid in $connection_pids; do
    connection_ppid=$({ ps -p "$connection_pid" -o ppid= 2>/dev/null || true; } | tr -d '[:space:]')
    connection_command=$(ps -p "$connection_pid" -o command= 2>/dev/null || true)
    if [ "$connection_ppid" = "$expected_main_pid" ] \
      && command_has_option_value "$connection_command" '--user-data-dir' "$profile"; then
      return 0
    fi
  done
  return 1
}

ready_count=0
stable_count=0
verified_port=""
verified_main_pid=""
verified_server_pid=""

while [ "$ready_count" -lt 160 ]; do
  discover_runtime
  runtime_ok=1
  [ "$(pid_count "$target_main_pids")" -eq 1 ] || runtime_ok=0
  [ "$(pid_count "$owned_server_pids")" -eq 1 ] || runtime_ok=0
  [ "$(pid_count "$target_renderer_pids")" -ge 1 ] || runtime_ok=0

  if [ "$runtime_ok" -eq 1 ]; then
    candidate_main_pid=$(first_pid "$target_main_pids")
    candidate_server_pid=$(first_pid "$owned_server_pids")
    candidate_port=""
    if [ -s "$port_file" ]; then
      candidate_port=$(tr -d '[:space:]' < "$port_file")
    fi
    listener_matches_server "$candidate_port" "$candidate_server_pid" || runtime_ok=0
    electron_client_connected "$candidate_main_pid" "$candidate_port" || runtime_ok=0
    fresh_log_ready || runtime_ok=0
  fi

  if [ "$runtime_ok" -eq 1 ]; then
    stable_count=$((stable_count + 1))
    verified_port="$candidate_port"
    verified_main_pid="$candidate_main_pid"
    verified_server_pid="$candidate_server_pid"
    if [ "$stable_count" -ge 8 ]; then
      break
    fi
  else
    stable_count=0
  fi

  sleep 0.25
  ready_count=$((ready_count + 1))
done

[ "$stable_count" -ge 8 ] \
  || fail "Fusion did not reach stable renderer/server readiness within 40 seconds; inspect $server_log"

osascript -e "tell application \"System Events\" to set frontmost of first process whose unix id is $verified_main_pid to true" >/dev/null 2>&1 || true

echo "Electron PID:     $verified_main_pid"
echo "Server PID:       $verified_server_pid"
echo "Server URL:       http://localhost:$verified_port"
echo "Restart complete: build, full cache/session reset, relaunch, and health verification succeeded"
