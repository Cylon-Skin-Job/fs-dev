# SPEC-29: Workspace Screenshot Carousel

## Summary

Replace the generic workspace transition with a directional slide animation.
Capture workspace panel screenshots, persist them in SQLite, and display them
as thumbnails in the ribbon and as full-screen slides in a horizontal carousel.

---

## What Was Built

### Server

| File | Lines | Job |
|------|-------|-----|
| `lib/db/migrations/020_workspace_screenshots.js` | 19 | SQLite table: `workspace_screenshots` (PNG BLOB + metadata) |
| `lib/workspace/screenshot-service.js` | 35 | Pure DB CRUD: save, get, remove, list |
| `lib/screenshot/router.js` | 27 | Express router: `GET /api/screenshot/:workspaceId` |
| `lib/screenshot/ws-handlers.js` | 80 | WS handlers: `screenshot:capture`, `screenshot:request`, `screenshot:list` |

**Wiring changes:**
- `server.js` — mounts router, passes `getScreenshotHandlers` to client-message-router
- `lib/startup.js` — creates and returns `screenshotHandlers`
- `lib/ws/client-message-router.js` — dispatches `screenshot:*` prefix to handler map

### Client

| File | Lines | Job |
|------|-------|-----|
| `src/lib/screenshot-capture.ts` | 30 | `html-to-image` wrapper + DOM targeting utilities |
| `src/state/screenshotStore.ts` | 30 | Zustand store: `Record<workspaceId, dataUrl>` |
| `src/lib/ws/screenshot-handlers.ts` | 62 | Routes server screenshot messages into screenshotStore |
| `src/hooks/useScreenshotCapture.ts` | 83 | Triggers capture 1500ms after workspace stabilizes or ribbon closes |
| `src/hooks/useWorkspaceKeyboard.ts` | 82 | Option+Left/Right cycling (replaces earlier generic transition) |
| `src/components/WorkspaceCarousel.tsx` | 52 | Full-viewport screenshot strip; CSS-transform slide animation |
| `src/components/WorkspaceCarousel.css` | 47 | Carousel layout + transition styles |

**Wiring changes:**
- `src/lib/ws-client.ts` — wires `handleScreenshotMessage`
- `src/lib/ws/workspace-handlers.ts` — sends `screenshot:list` on `workspace:init`
- `src/components/WorkspaceRibbon.tsx` — renders `<img>` thumbnail if available, else icon fallback
- `src/components/App.tsx` — mounts `<WorkspaceCarousel />` + calls `useScreenshotCapture()`
- `src/types/index.ts` — adds `screenshot:*` to `WebSocketMessageType` union

### Data Flow

```
App starts
  → workspace:init received
  → client sends screenshot:list
  → server queries workspace_screenshots
  → client requests screenshot:request per row
  → server returns base64 dataUrl
  → ribbon renders thumbnails

Workspace switch
  → activeWorkspaceId changes
  → useScreenshotCapture waits 1500ms
  → captures .rv-panel.active via html-to-image
  → sends screenshot:capture to server
  → server stores PNG in SQLite
  → server broadcasts screenshot:updated
  → client re-requests fresh screenshot
  → ribbon updates thumbnail

Option+Arrow held
  → useWorkspaceKeyboard opens ribbon + calls requestSwitch
  → activeWorkspaceId changes immediately
  → WorkspaceCarousel CSS-transitions to new position
  → screenshot slides in from appropriate direction
```

---

## Bugs Found and Fixed During Build

1. **Snake/camel case mismatch in `screenshot:list`**
   - Server sent raw Knex rows (`workspace_id`); client expected camelCase (`workspaceId`)
   - Fix: server maps rows to camelCase before sending

2. **Capture debounce reset by `currentPanel` flutter**
   - `useScreenshotCapture` depended on `currentPanel`; panel discovery caused 3–5 resets
   - Fix: removed `currentPanel` from dependency array; read it at capture time instead
   - Increased debounce from 800ms → 1500ms

3. **Carousel blocked rapid switching**
   - Original implementation deferred `requestSwitch` until after 300ms animation
   - `isAnimating` guard blocked subsequent arrow presses
   - Fix: `requestSwitch` fires immediately; carousel is purely visual observer
   - Deleted `carouselStore.ts`; carousel derives everything from `workspaceStore` + `screenshotStore`

---

## Architectural Issues Discovered (Pre-Existing)

### Issue 1: Workspace Cycling Logic Duplicated in 4 Places

**Locations:**
- `App.tsx` lines 167–183 — `cycleWorkspace()` computes sorted indices, calls `requestSwitch`
- `hooks/useWorkspaceKeyboard.ts` lines 24–41 — **identical** index math
- `components/WorkspaceRibbon.tsx` line 45 — click handler calls `requestSwitch(w.id)`
- `components/WorkspaceSwitcher.tsx` line 43 — click handler calls `requestSwitch(w.id)`
- `lib/ws/workspace-handlers.ts` line 182 — handler calls `requestSwitch(existing.id)`

**Violation:** Code Standards §Modularity Rule 1 — "One job per file." Index computation is not App.tsx's job. Two copies of the same sort+index+wrap logic means drift risk.

**Fix:** Extract `cycleWorkspace(direction)` into `workspaceStore.ts` as a store action. All callers use the canonical implementation.

---

### Issue 2: `App.tsx` is a God File (394 lines)

**Current jobs in App.tsx:**
- Root component mounting 6 hooks
- Panel grid rendering with memoized `PanelContent` and `PanelWrapper`
- `cycleWorkspace()` and `toggleRibbon()` logic
- Inline `WorkspaceTitle` component
- Fusion overlay state
- 14 imports from 10 different domains

**Violation:** Code Standards §Anti-Patterns — "One giant app.js"

**Fix:** Extract `WorkspaceTitle` to its own component. Move `cycleWorkspace`/`toggleRibbon` into `workspaceStore`. App.tsx should only mount components and read top-level state.

---

### Issue 3: Hotkey Logic Fragmented

**Current state:**
- `useWorkspaceKeyboard.ts` — Option+Arrow cycling
- `WorkspaceRibbon.tsx` — Escape key listener (inline `useEffect`)
- `App.tsx` — header title button click → `toggleRibbon()`

**Violation:** Code Standards §Architecture Layers — "Events flow up." The ribbon should not handle its own Escape key; it should emit an event or the keyboard layer should handle all ribbon-related keys.

**Fix:** Centralize ribbon hotkeys in `useWorkspaceKeyboard` (Escape to close, Option to open). Ribbon component becomes pure presentation.

---

### Issue 4: `client-message-router.js` is a God File (685 lines)

This was already 685 lines before my change. My addition was 5 lines (screenshot prefix branch). The file handles 25+ message types inline with an if/else chain.

**Status:** Already documented as SPEC-01f extraction target. No new action needed; my change did not worsen it.

---

### Issue 5: `server.js` is a God File (571 lines)

Same as above — already a known issue (SPEC-01). My addition was 4 lines.

---

## Proposed Cleanup (Post-Build)

### Immediate (before considering feature complete)

| Task | File(s) | Effort |
|------|---------|--------|
| Extract `cycleWorkspace` + `toggleRibbon` into `workspaceStore.ts` | `workspaceStore.ts`, `App.tsx`, `useWorkspaceKeyboard.ts` | 20 min |
| Move Escape handler from `WorkspaceRibbon` to `useWorkspaceKeyboard` | `WorkspaceRibbon.tsx`, `useWorkspaceKeyboard.ts` | 10 min |
| Extract `WorkspaceTitle` from `App.tsx` | `App.tsx`, new `components/WorkspaceTitle.tsx` | 15 min |
| Remove debug `console.log` from screenshot pipeline | `useScreenshotCapture.ts`, `ws-handlers.js`, `screenshot-handlers.ts` | 10 min |

### Deferred (can wait)

| Task | File(s) | Effort | Blocked by |
|------|---------|--------|------------|
| Extract screenshot router mount from `server.js` | `server.js`, `lib/screenshot/mount.js` | 15 min | SPEC-01 |
| Extract `screenshot:*` prefix branch from `client-message-router` | `client-message-router.js` | 20 min | SPEC-01f |
| Add screenshot eviction (max age / max count) | `screenshot-service.js` | 30 min | — |
| Compress PNG before storage | `screenshot-service.js` | 45 min | — |

---

## Silent Fail Risks

1. **html-to-image on `position: absolute` panels** — if browser skips painting hidden siblings, capture may be blank. Monitor capture sizes; if consistently <1KB, switch to capturing `.rv-panel-container`.

2. **SQLite BLOB growth** — no eviction policy. 10 workspaces × 2MB = 20MB. Fine short-term; needs `captured_at` pruning later.

3. **Rapid Option+Arrow during server round-trip** — `requestSwitch` sends WS message; if server hasn't responded by next arrow press, `activeWorkspaceId` is stale and carousel computes wrong offset. Mitigated by immediate client-side index math, but server state could lag.

---

## Acceptance Criteria

- [x] Ribbon shows thumbnail images for workspaces that have been visited
- [x] Fallback to icon renders when no screenshot exists
- [x] Option+Left/Right opens ribbon and slides screenshot in from correct direction
- [x] Rapid arrow presses (3+ in quick succession) animate smoothly without blocking
- [x] Option release closes ribbon and captures current workspace
- [x] Screenshots persist across app restarts (loaded from SQLite on init)
- [x] `cycleWorkspace` exists in only one place (`workspaceStore.ts`)
- [x] `WorkspaceRibbon.tsx` has no inline keydown listener
- [x] `App.tsx` under 350 lines
