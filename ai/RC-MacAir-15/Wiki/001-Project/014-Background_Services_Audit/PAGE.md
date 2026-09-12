# Background Services Audit

Audit date: 2026-05-30

This page inventories startup pullers, timers, watchers, connector syncs, background jobs, and client boot requests that can touch external systems or fragile local resources.

## Executive Summary

The largest startup risk was Google Calendar sync because it ran on server boot, reached into macOS Keychain through `/usr/bin/security`, and originally allowed an async rejection to escape. That path is now guarded in `fusion-studio-server/lib/calendar/google/poller.js`.

The remaining high-risk automatic paths are:

- The clipboard monitor starts on renderer boot and polls the system clipboard every second. New clipboard text is sent to the server and written to macOS Keychain.
- Calendar adapters still start from server boot even though calendar is incomplete product surface. Google is guarded but still probes Keychain every five minutes. Apple starts when the local Calendar DB exists.
- Harness status revalidation starts on server boot and client mount. It probes local binaries and may spawn installed CLIs for `--version`.
- Cron triggers, when configured in workspace `TRIGGERS.md`, start automatically and can create tickets without user action.
- Screenshot capture runs automatically after workspace activation in Electron and stores panel images in SQLite.

One safety patch was applied during this audit:

- `fusion-studio-server/lib/watch/core.js` now catches rejected promises returned by watcher subscribers.
- `fusion-studio-server/lib/watch/calendar-watcher.js` now returns the Apple sync promise so `WatchCore` can catch it.

Follow-up patch applied the same day:

- Added `fusion-studio-server/lib/background-services/safety.js` as the shared crash boundary for background timers, watchers, and event-bus listeners.
- Added `fusion-studio-server/lib/background-services/config.js` for fail-closed background service opt-ins.
- Added `fusion-studio-server/lib/background-services/log.js`; non-fatal background failures are appended to `fusion-studio-server/data/background-services.log` as JSON lines.
- Calendar Apple and Google adapters are disabled by default.
- Clipboard system polling was split into `fusion-studio-client/src/clipboard/clipboard-monitor.ts` and is disabled by default.
- Event bus listeners, watcher subscribers, cron timers, runner heartbeat, thread idle timers, and hold timers now run through the shared safety boundary.

## Server Boot Services

| Service | Starts From | External Touches | Assumptions | Failure Handling | Recommendation |
|---|---|---|---|---|---|
| DB initialization | `lib/startup.js` -> `initDb()` | SQLite files under `fusion-studio-server/data/` | DB path writable, migrations valid | Startup rejects and server exits | Keep required. Add clearer fatal log if migrations fail. |
| Audit subscriber cleanup | `lib/startup.js` -> `startAuditSubscriber()` | Thread history/SQLite on chat events | Event payloads have valid thread data | Per-turn save errors are caught; cleanup timer is simple | Keep enabled. No external connector risk. |
| Wire broadcaster | `lib/startup.js` -> `createWireBroadcaster()` | WebSocket clients only | Event bus listeners stay healthy | No catch around `ws.send`, but open-state is checked | Keep enabled. Consider central safe bus listener wrapper. |
| Thread lifecycle controller | `lib/startup.js` -> `startThreadLifecycle()` | Timers only | Event payloads contain thread IDs | Timer callback is simple, no catch | Keep enabled. Low risk. |
| Workspace broadcaster | `lib/startup.js` -> `createWorkspaceBroadcaster()` | Reads workspace CSS/themes on `workspace:switched` | Workspace path readable | Most reads catch; async listener rejection is not centrally caught | Keep enabled. Wrap async event-bus listeners. |
| Harness broadcaster | `lib/startup.js` -> `createHarnessBroadcaster()` | WebSocket clients only | None beyond connected clients | No catch around `ws.send`, open-state checked | Keep enabled. Low risk. |
| Calendar broadcaster | `lib/startup.js` -> `createCalendarBroadcaster()` | WebSocket clients only | Calendar sync events are well-formed | No catch around `ws.send`, open-state checked | Keep enabled only if calendar remains enabled. |
| Theme handlers | `lib/startup.js` -> `createThemeHandlers()` | Workspace theme files on request | Active workspace has style tree | Handler-level catches vary | Request-driven, not a boot puller. |
| Secrets handlers | `lib/startup.js` -> `createSecretsHandlers()` | macOS Keychain on request | `/usr/bin/security`, Keychain access | Request router catches thrown handler errors | Request-driven. Do not call from boot. |
| Clipboard handlers | `lib/startup.js` -> `createClipboardHandlers()` | macOS Keychain on clipboard requests | `/usr/bin/security`, Keychain access | Expected backend errors handled; unknown errors bubble to router | Request-driven server side, but client currently drives it automatically. |
| Calendar adapters | `lib/startup.js` -> `calendar.start()` | Apple Calendar SQLite, Google bridge, Keychain, network | Calendar DB path, `GOOGLE_BRIDGE_URL`, `GOOGLE_BRIDGE_KEY`, network | Google poller catches; watcher async rejections now caught by patch | Make calendar sync opt-in. Disable by default until calendar write/read UX is productized. |
| Harness status revalidation | `lib/startup.js` -> `harnessStatusService.revalidateAll()` | Filesystem binary catalog, `npm prefix -g`, `brew --prefix`, CLI `--version` | Local package managers and CLIs may exist | Per-harness errors caught; version child may continue past 150ms budget | Keep non-fatal. Use resolved binary path and hard process timeout for version checks. |
| Workspace controller | `lib/startup.js` -> `workspaceController.start()` | Filesystem paths from workspace registry | Registered repos still exist and have `ai/<machine>/System/Views/` | Startup logs and broadcasts unavailable registered workspaces without deleting registry rows; unexpected DB/FS errors still reject | Keep required. Missing or structurally stale workspaces stay registered so the ribbon/system UI can still surface them. |
| Boot theme CSS generation | `lib/startup.js` -> `themesService.generateCss()` | Active workspace style files | Active theme exists | Promise catch logs warning | Keep guarded. |
| CLI config ensure | `lib/startup.js` -> `ensureWorkspaceFile()` | Active workspace `ai/<machine>/System/config/cli.json` | Workspace writable | Promise catch logs warning | Keep guarded. |

## Post-Listen Pipeline

| Service | Starts From | External Touches | Assumptions | Failure Handling | Recommendation |
|---|---|---|---|---|---|
| Workspace watcher | `_startPipeline()` -> `createWatcher(projectRoot)` | Chokidar over active workspace | Workspace tree readable; symlink traversal is acceptable | WatchCore logs watcher errors and now catches async subscriber rejections | Keep enabled, but document recursive watcher cost. Consider opt-out for very large workspaces. |
| Built-in watcher filters | `_startPipeline()` -> `loadFilters()` | Workspace filesystem, optional ticket creation, modal broadcasts | Filter files parse correctly | Load errors caught; action errors are caught by watcher loop | Keep. Validate dangerous actions such as `drop-file` more strictly before use. |
| Component loader | `_startPipeline()` -> `loadComponents()` | `ai/components` files | Optional component folders may exist | Need separate audit if components can throw on malformed config | Keep non-fatal if possible. |
| Agent trigger loader | `_startPipeline()` -> `loadTriggers()` | Recursive scan of `ai/<machine>/Agents`, `ai/<machine>/System/Views`, `ai/components` | `registry.json` exists for agent triggers | Outer startup catch logs failure | Keep, but make trigger automation workspace-config opt-in. |
| Event bus triggers | `loadTriggers()` registers listeners | May run actions on chat/ticket/agent/system events; webhooks can touch network | Trigger definitions are trusted workspace automation | Webhook fetch catches; event bus does not catch async listener rejections centrally | Add `safeOn(name, handler)` or catch promises inside `event-bus.emit()`. |
| Cron triggers | `createCronScheduler().start()` | Timers; ticket files when jobs fire | Cron definitions valid; issues-viewer writable | Timer callback lacks a top-level try/catch | Wrap each cron tick and retry callback. Consider a global `BACKGROUND_AUTOMATION_ENABLED` guard. |
| Hold registry | `createHoldRegistry()` | Ticket markdown files after 9 minutes | Issues directory writable | Release errors caught per ticket | Keep. Add `holdRegistry.stop()` to shutdown path. |
| Runner heartbeat | `_startPipeline()` -> `checkHeartbeats()` | Active run folders; can write to child process stdin or kill child process | Active run map entries are valid | Timer callback lacks a top-level try/catch | Wrap heartbeat tick and callbacks. Keep disabled until active runs exist if possible. |

## Calendar Connectors

| Connector | Auto Start | External System | Config/Secret Dependency | Current Failure Mode | Recommendation |
|---|---:|---|---|---|---|
| Apple Calendar | No, opt-in | Apple Calendar SQLite DB | Calendar DB readable by process; SQLite schema compatible | `SQLITE_BUSY` returns null; watcher and sync failures are caught through the background safety boundary | Keep opt-in. Add UI/status surfacing when disabled, unavailable, or permission denied. |
| Google Calendar | No, opt-in | Apps Script bridge over network; macOS Keychain | `GOOGLE_BRIDGE_URL`, `GOOGLE_BRIDGE_KEY` | Poller catches and logs skip; no Keychain lookup occurs unless enabled | Keep opt-in. Add UI/status surfacing for missing or rotated bridge credentials. |
| Calendar HTTP reads | Only when Calendar UI mounts | Local SQLite `calendar_*` tables | DB initialized | Route catches and returns 500 | Keep request-driven. UI should show "not connected" instead of implying write support. |

Current opt-in config:

```json
{
  "settings": {
    "backgroundServices": {
      "calendar": {
        "apple": { "enabled": true },
        "google": { "enabled": true }
      }
    }
  }
}
```

Environment overrides:

```sh
FUSION_CALENDAR_APPLE_ENABLED=1
FUSION_CALENDAR_GOOGLE_ENABLED=1
```

## Client Boot Pullers

| Client Path | Starts From | External Touches | Assumptions | Failure Handling | Recommendation |
|---|---|---|---|---|---|
| WebSocket connect/reconnect | `useWebSocket()` -> `connectWs()` | Server WebSocket | Server is available | Auto-reconnect every 3s | Keep. Avoid repeated `initialize` error before thread open if noisy. |
| Panel discovery | `ws.onopen` -> `loadAllPanels()` | Workspace filesystem via WS | `ai/<machine>/System/Views` and optional `ai/apps` readable | Per-file timeouts/catches | Keep, but discovery probes many files per panel. Cache or batch if startup is slow. |
| Shared style loading | `useSharedWorkspaceStyles()` | Workspace style files via WS | `ai/<machine>/System/styles` optional | Catch logs error | Keep. Server already includes styles in `workspace:init`, so avoid redundant refetch where possible. |
| Per-view layout loading | `useViewLayoutStyles(panelId)` | WS file reads plus `/api/view-config` HTTP | View settings files optional | Catches and warns | Keep request-driven. |
| Harness status fetch | `useHarnessStatuses()` | `/api/harnesses`, which can trigger server revalidation | Server DB ready; local CLIs/package managers available | Client catches silently; server catches revalidation | Keep, but avoid duplicating startup revalidation immediately after boot. |
| Screenshot list | `workspace:init` handler sends `screenshot:list` | SQLite screenshot table; follow-up image payloads | Screenshot blobs may exist | Handlers catch through router | Keep if ribbon needs it. Consider lazy-loading thumbnails when ribbon opens. |
| Screenshot capture | `useScreenshotCapture()` | Electron `capturePage`, SQLite screenshot table | Electron API available; active panel exists | Client catches silently; server handler catches | Make opt-in or rate-limit. It captures UI automatically after workspace activation. |
| Clipboard monitor | `main.tsx` -> `initializeClipboardMonitorFromConfig()` | System clipboard, server WS, macOS Keychain | Clipboard permission; Keychain access; `/usr/bin/security` | Read errors ignored; server handler errors reported | Highest client-side risk. Now default off; add a user-facing toggle before relying on it. |
| View activity and recents | Capture/Office/Wiki/File Explorer open/navigation actions | Per-view `state/state.json`, file content preloads | View state loaded; panel paths exist | State writer and content requests catch | Keep request-driven. Do not revive the old Recent Docs SQLite path for view-local recents. |
| Bookmarks list | `BookmarksBar` mount | Server SQLite; rendered favicons call Google favicon service | Browser panel active; network for favicons | Handler catches; image errors hidden | Avoid Google favicon service by default or proxy/cache explicitly. |
| Calendar UI fetch | `CalendarViewer` mount | Local calendar API routes | Calendar tables populated | Store catches and logs | Keep request-driven, but hide Calendar panel unless connector is enabled or data exists. |

Current clipboard monitor opt-in:

```js
localStorage.setItem('fusion.clipboard.monitor.enabled', 'true');
```

When this key is absent or not `true`, the renderer subscribes to clipboard broadcasts but does not poll the system clipboard.

If clipboard monitoring is enabled and the browser denies `navigator.clipboard.readText()`, the renderer logs a throttled warning at most once per minute. In Electron this is visible in `/tmp/electron-renderer.log`.

## Non-Fatal Failure Logs

Server-side background failures caught by the shared safety boundary are logged to:

```text
fusion-studio-server/data/background-services.log
```

Each line is a JSON record:

```json
{"timestamp":"2026-05-30T00:00:00.000Z","level":"error","service":"Calendar:Google sync","message":"Keychain locked","code":"KEYCHAIN_LOCKED"}
```

These failures also go to stderr/console, but the JSONL file is the stable audit trail for cases where the server keeps running.

## On-Demand But Risky Paths

| Path | Trigger | External Touches | Failure Handling | Recommendation |
|---|---|---|---|---|
| Ticket GitLab sync | `lib/tickets/dispatch.js`, currently not wired into boot | GitLab HTTPS, `GITLAB_TOKEN` in Keychain | `syncPull`/`syncPush` catch and return errors; `request.js` uses synchronous Keychain lookup | Do not wire into boot without explicit opt-in. Replace `execFileSync('/usr/bin/security')` with async secrets wrapper and catch `spawn` errors. |
| Runner post-completion sync | Background agent run exits successfully | GitLab HTTPS, Keychain | Wrapped in `syncPush(...).catch()` | Make GitLab sync per-workspace opt-in. |
| Webhook action | Trigger action `webhook-post` | Arbitrary network URL from trigger definition | Fetch promise catches | Require explicit automation setting and log target URL only after redaction review. |
| Transcription | `/api/transcribe` | Temp files, `nodejs-whisper`, possible model download via `npx` | Route catches and returns 500 | Do not auto-download model from request path. Require setup step or explicit first-run consent. |
| Document export/email/print | User IPC action | Pandoc, AppleScript, Preview/Mail | IPC handlers generally return `{ success: false }` | Keep user-initiated. |
| Office versioning | Save with `session_end`, `checkpoint`, or `milestone` | `git` subprocess in document content dir | Caller catches commit failures | Keep user/edit initiated. Replace shell-string `exec` with `execFile` eventually. |

## Recommended Patch Plan

1. Add a `background-services` config surface with explicit booleans:
   - `calendar.apple.enabled`
   - `calendar.google.enabled`
   - `clipboard.monitor.enabled`
   - `screenshots.autoCapture.enabled`
   - `automation.triggers.enabled`
   - `automation.cron.enabled`
   - `sync.gitlab.enabled`

2. Change Calendar startup:
   - Only start Apple and Google adapters when enabled.
   - For Google, do not call `secrets.get()` unless the adapter is enabled.
   - Log one concise line per disabled or skipped adapter.

3. Harden timer callbacks:
   - Wrap cron scheduler interval and retry callbacks.
   - Wrap runner heartbeat `tick()`.
   - Catch `SessionManager` idle-timeout `onClose` rejections.
   - Add shutdown cleanup for hold-registry timers and cron scheduler timers.

4. Harden event bus listeners:
   - Add a safe listener helper that catches sync throws and promise rejections.
   - Use it for async listeners in `workspace-broadcaster`, trigger loader, audit subscriber, and future connector listeners.

5. Make client pullers lazy:
   - Move clipboard monitoring behind a user setting.
   - Request screenshot thumbnails only when the workspace ribbon/carousel opens.
   - Auto-capture screenshots only after user opt-in.
   - Avoid Google favicon requests unless browser bookmarks explicitly enable external favicons.

6. Document connector setup:
   - Calendar is currently read-only/incomplete and should be labeled as such.
   - Google Calendar requires Apps Script bridge setup plus `GOOGLE_BRIDGE_URL` and `GOOGLE_BRIDGE_KEY`.
   - GitLab ticket sync requires `GITLAB_TOKEN`.
   - Transcription requires local model setup and should not surprise-download from a normal request.

## Verification Checklist

After applying the recommended patches:

- Boot server with no Keychain access and confirm no `security` process is spawned.
- Boot server with no Apple Calendar permission and confirm no crash.
- Boot app with clipboard permission denied and confirm no server crash and no repeated Keychain writes.
- Boot app with no configured Google bridge and confirm no Google poller interval starts.
- Create a malformed trigger and confirm watcher/cron/event-bus errors are logged, not fatal.
- Run with missing CLIs and confirm harness status stays non-fatal.
- Switch workspaces and confirm missing style files remain non-fatal.
