# Calendar Viewer — Implementation Status & Performance Issue Report

**Date:** 2026-05-18
**Project:** fusion-studio-client (React 19 + TypeScript + Vite + Electron + JXA)
**Current Issue:** JXA `list-events` IPC times out after 60s; real Calendar events never load into the grid

---

## ✅ What Was Built (Code-Complete)

### Chunk A — IPC Bridge (`electron/main.cjs`, `electron/preload.cjs`)
- 5 IPC handlers: `list-calendars`, `list-events`, `create-event`, `update-event`, `delete-event`
- JXA (JavaScript for Automation) via `osascript -l JavaScript`
- `runJxa(script, timeoutMs)` helper (default 10s, configurable)
- Works with live Apple Calendar data; falls back to demo data on permission denial

### Chunk B — State Layer (`src/state/calendarStore.ts`)
- Zustand store with calendars, events, selectedDate, CRUD actions
- `fetchCalendars()` / `fetchEvents(start, end)` — IPC calls
- `toggleCalendarEnabled(id)` — client-side filtering
- `loadDemoData()` — 11 demo calendars + 21 demo events (April 2026)
- **Current fallback behavior:** loads demo data when IPC fails or returns empty

### Chunk C — Pure Components
- `EventBar`, `CalendarDayCell`, `MiniCalendar`, `ChecklistView`, `InboxView`, `CalendarListView`
- `CalendarViewer.css` — all styling via CSS variables with fallbacks

### Chunk D — Month Grid (`useCalendarGrid.ts`, `CalendarMonthView.tsx`)
- Dynamic month blocks (6 weeks each, trimmed to actual needed rows)
- `getEventPosition()` — `single | start | middle | end` for multi-day bars
- IntersectionObserver for sticky header month label
- Event positioning and overlap logic

### Chunk E — Header/Drawer/Viewer
- `CalendarHeader` — pill dropdown, nav buttons, drawer toggles
- `CalendarDrawer` — right-side slide-out (240px), calendar list + mini calendar
- `CalendarViewer` — orchestrator, wired into `ContentArea.tsx`

### Chunk F — Event Modal (`EventModal.tsx`)
- Create/edit/delete events
- Wired to store CRUD + optimistic updates

---

## 🎨 UI Polish Completed

| Change | Status |
|--------|--------|
| Full month names in separators & header | ✅ |
| Vertical grid lines between day columns | ✅ |
| Remove numbers/borders from other-month padding cells | ✅ |
| Trim extra empty rows (Feb → 4 rows, Apr → 5 rows, May → 6 rows) | ✅ |
| Last-day-of-month right border | ✅ |
| Month separator styling (single bottom border, chrome bg) | ✅ |
| Header + day-of-week ribbon share continuous chrome bg | ✅ |
| Calendar list drawer populated + toggleable | ✅ |
| Calendar toggle filtering in grid | ✅ |

---

## 🔴 The Core Problem: JXA Performance

### Symptom
Calendar grid renders but **no events appear**. Drawer shows 11 calendars correctly. Toggling calendars has no visible effect because the `events` array is empty.

### Root Cause Identified
The JXA script in `electron/main.cjs` for `calendar:list-events` iterates through **ALL events in ALL calendars**:

```js
var calendars = Calendar.calendars();
for (var i = 0; i < calendars.length; i++) {
  var cal = calendars[i];
  var events = cal.events();  // ← EVERY EVENT EVER
  for (var j = 0; j < events.length; j++) { ... }
}
```

### Evidence from Logs (`/tmp/fusion-electron.log`)
```
[IPC calendar:list-calendars] returned 11 calendars        ← works (fast)
[IPC calendar:list-events] JXA error: JXA script timed out after 60s  ← fails
```

### Manual Testing Results
Ran `osascript` directly on the user's machine:
- `Family` calendar: 4 events (fast)
- `Holidays in United States` calendar: **317 events** (took >120s to count — killed by timeout)

The `Holidays in United States` calendar alone has enough events to make naive iteration unusably slow.

---

## 🔧 Attempted Fixes & Outcomes

| Attempt | Outcome |
|---------|---------|
| Increase timeout from 10s → 60s | Still times out |
| Add `whose({ startDate: { _lessThan: end } })` pre-filter | Still times out after 60s |
| Call `fetchCalendars` + `fetchEvents` sequentially | `list-calendars` now works reliably; `list-events` still fails |
| Add logging at every layer (main, preload, store, component) | Confirmed data drops at JXA level |

---

## 🎯 What Needs to Happen Next

### Option A: Fix JXA with proper `whose` + month-by-month fetching
- Use correct `_and` syntax: `whose({ _and: [{ startDate: { _lessThan: end } }, { endDate: { _greaterThan: start } }] })`
- Fetch **one month at a time** instead of 12 months at once
- Progressive load: current month → next → previous → backfill → scroll expansion
- Store appends events per-month instead of replacing entire array
- **Risk:** `whose` date filtering may still be unreliable or slow per context notes

### Option B: Replace JXA with Swift + EventKit
- Write a small Swift script that uses `EKEventStore` with `predicateForEventsWithStartDate:endDate:calendars:`
- EventKit is designed for fast date-range queries (native, no iteration)
- Spawn Swift script from Node.js via `swift` CLI or compile to binary
- **Risk:** More complex build/setup; needs testing on user's machine

### Option C: Use `icalBuddy` CLI tool
- `icalBuddy` is a popular macOS tool for querying Calendar data
- Can filter by date range and calendar efficiently
- **Risk:** Requires installing `icalBuddy` (not present on user's system)

### Recommended Path
**Option A first** — fix the JXA `whose` syntax and implement month-by-month progressive loading. If `whose` still fails after syntax correction, **pivot to Option B (Swift/EventKit)**.

---

## 📁 Relevant Files

| File | Purpose |
|------|---------|
| `electron/main.cjs` | IPC handlers, JXA scripts, `runJxa()` helper |
| `electron/preload.cjs` | `window.electronAPI` bridge |
| `src/state/calendarStore.ts` | Zustand store, fetch logic, demo data |
| `src/components/calendar/CalendarMonthView.tsx` | Scrollable grid, event rendering |
| `src/components/calendar/useCalendarGrid.ts` | Grid generation, event filtering by enabled calendars |
| `src/components/calendar/CalendarViewer.tsx` | Orchestrator, drawer state, modal |
| `src/components/calendar/CalendarViewer.css` | All calendar styling |

---

## 🚀 Restart Script

```bash
~/projects/Fusion-Home/restart-fusion.sh
```

Builds client → starts server (:3001) → launches Electron.

---

## 📋 User Requirements (from conversation)

1. **No 60-second waits.** Events must load quickly.
2. **Progressive loading.** Current month first, then adjacent months, then backfill.
3. **Scroll expansion.** When user scrolls near edge and new months render, fetch those months' events on-the-fly.
4. **RAM cache.** Keep fetched events in store; don't re-fetch already-loaded months.
5. **Do NOT add more demo events.** Fix the real Calendar connection.
