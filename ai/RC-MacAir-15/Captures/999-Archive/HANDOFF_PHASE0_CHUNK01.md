# Handoff: Phase 0, Chunks 0.1–0.5 — Session Debris Cleanup

**Roadmap:** `docs/CODE_STANDARDS_CLEANUP_ROADMAP.md`
**Baseline commit:** `2bac568` (working tree clean, 2026-05-18)
**Goal:** delete leftover comments, stub files, and untracked logs from the Gemini incident session. No logic changes. No CSS. No risk.

---

## Context for the incoming agent

This project is `fs-dev` at `/Users/rccurtrightjr./projects/fs-dev`.
- Client: `fusion-studio-client/` (React 19 + TypeScript + Vite)
- Server: `fusion-studio-server/` (Node.js + Express + WebSocket on port 3001)
- Restart: `unset ELECTRON_RUN_AS_NODE && ~/projects/Fusion-Home/restart-fusion.sh`
- Build only: `cd fusion-studio-client && npm run build`

The Calendar UI is intentionally disconnected. `fusion-studio-client/src/components/calendar/` and related state/type files are **excluded from TypeScript compilation** via `tsconfig.app.json`. Do not remove that exclusion — the calendar data layer is being reengineered separately.

---

## Operating rules (non-negotiable)

1. Before touching any file, read it from disk with the Read tool. Never work from memory.
2. Verify current line counts match this document before acting. If they differ, stop and report.
3. Every chunk ends with the smoke test below before committing.
4. Commit each chunk separately. Do not batch chunks into one commit.
5. After all 5 chunks, write a one-paragraph summary of what changed and what (if anything) didn't match expectations.

---

## Smoke test (run after each chunk)

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client && npm run build
```

The build must exit 0 with no TypeScript errors. That is the only gate for Phase 0 — no Electron launch needed since nothing visual changes.

---

## Chunk 0.1 — Delete commented-out calendar debris in `CalendarMonthView.tsx`

**Why:** the code-standards rule says "Delete, don't deprecate." Commented code is dead code. The calendar folder is excluded from tsc, so nobody reads these comments. Git history preserves the original intent.

**File:** `fusion-studio-client/src/components/calendar/CalendarMonthView.tsx`
**Current line count:** 147 lines (verify before acting)

**Exact lines to delete** (verify text matches before deleting):

Lines 34–37 — commented-out store destructure:
```
  // FIXME(calendar-store-refactor): fetchEventsForMonth was added to the consumers
  // but never landed on the store. Re-enable once the store exposes it.
  // const fetchEventsForMonth = useCalendarStore((s) => s.fetchEventsForMonth);
```

Lines 44–50 — commented-out useEffect block:
```
  // FIXME(calendar-store-refactor): progressive loading disabled while the
  // fetchEventsForMonth store action is missing.
  // useEffect(() => {
  //   for (let offset = range.startOffset; offset <= range.endOffset; offset++) {
  //     const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
  //     fetchEventsForMonth(d.getFullYear(), d.getMonth());
  //   }
  // }, [baseDate, range.startOffset, range.endOffset, fetchEventsForMonth]);
```

After deletion, the file should still have the real `useEffect` (starting around line 42), `useLayoutEffect` blocks, and the `handleScroll` function intact.

Also: line 1 imports `useEffect` from React, and line 2 imports `useCalendarStore`. Both are now unused after deletion. Remove both unused imports.

**Expected result:** file compiles cleanly (it's in the tsconfig exclude list, so tsc won't check it, but it should be syntactically valid).

**Commit message:**
```
chore(calendar): delete commented fetchEventsForMonth debris — Phase 0 Chunk 0.1
```

---

## Chunk 0.2 — Clean commented import in `ContentArea.tsx`

**Why:** a commented-out import line is dead code per "Delete, don't deprecate." The 4-line comment block above it is useful context; it stays (one line shortened). The commented `// 'calendar-viewer': CalendarViewer,` line also goes.

**File:** `fusion-studio-client/src/components/ContentArea.tsx`
**Current line count:** ~62 lines (verify before acting)

**Current block (lines 21–34 roughly):**
```tsx
// Calendar viewer disconnected — Apple JXA/EventKit data fetch is being
// reengineered. The 'calendar-viewer' panel falls through to the placeholder
// renderer below until the new data layer lands.
// import { CalendarViewer } from './calendar/CalendarViewer';
import { FileExplorer } from './file-explorer/FileExplorer';

/** Built-in component map: panel ID → content component */
const CONTENT_COMPONENTS: Record<string, ComponentType> = {
  'doc-viewer': CaptureTiles,
  'office-viewer': OfficeGrid,
  'file-viewer': FileExplorer,
  'wiki-viewer': WikiExplorer,
  'issues-viewer': TicketBoard,
  'agents-viewer': AgentTiles,
  // 'calendar-viewer': CalendarViewer,
};
```

**Replace with:**
```tsx
import { FileExplorer } from './file-explorer/FileExplorer';

/** Built-in component map: panel ID → content component */
const CONTENT_COMPONENTS: Record<string, ComponentType> = {
  'doc-viewer': CaptureTiles,
  'office-viewer': OfficeGrid,
  'file-viewer': FileExplorer,
  'wiki-viewer': WikiExplorer,
  'issues-viewer': TicketBoard,
  'agents-viewer': AgentTiles,
  // calendar-viewer disconnected; falls through to placeholder
};
```

(The 3-line comment block and the commented import line are removed. One short inline comment is kept so future readers know the omission is intentional, not an oversight.)

**Commit message:**
```
chore(content-area): remove commented CalendarViewer import — Phase 0 Chunk 0.2
```

---

## Chunk 0.3 — Delete `main.cjs.new` scratch stub

**Why:** a 54-line file that ends with `// but I'll use read_file first to get the whole thing to be safe.` is a stranded scratch document from an agent session. Not code, not docs, not needed.

**File:** `fusion-studio-client/electron/main.cjs.new`

**Verification before deleting:** read the file. Confirm it is 54 lines and ends with the comment above. Confirm the real `main.cjs` in the same directory is 633 lines and has all 10 expected `ipcMain.handle(...)` calls:
- `capture-page`
- `capture-rect`
- `export-document`
- `send-document-email`
- `print-document`
- `calendar:list-calendars`
- `calendar:list-events`
- `calendar:create-event`
- `calendar:update-event`
- `calendar:delete-event`

**Action:** `git rm fusion-studio-client/electron/main.cjs.new`

**Commit message:**
```
chore(electron): delete stranded main.cjs.new scratch stub — Phase 0 Chunk 0.3
```

---

## Chunk 0.4 — Move agent session artifacts to `docs/agent-sessions/`

**Why:** `SESSION_INCIDENT_REPORT.md` and `CALENDAR_DEBUG_REPORT.md` are useful reference documents but don't belong at the project root. Moving them tidies the root without deleting the history.

**Files:**
- `SESSION_INCIDENT_REPORT.md` (root)
- `CALENDAR_DEBUG_REPORT.md` (root)

**Action:**
```bash
mkdir -p docs/agent-sessions
git mv SESSION_INCIDENT_REPORT.md docs/agent-sessions/
git mv CALENDAR_DEBUG_REPORT.md docs/agent-sessions/
```

**Commit message:**
```
chore: move agent session reports to docs/agent-sessions/ — Phase 0 Chunk 0.4
```

---

## Chunk 0.5 — Untrack `wire-debug.log.old` and tighten `.gitignore`

**Why:** `*.log` is already in `.gitignore`, but `.log.old` doesn't match that pattern. `wire-debug.log.old` is a 1784-line log file that got committed accidentally. It should not be tracked.

**File:** `fusion-studio-server/wire-debug.log.old` and `.gitignore`

**Verification before acting:** read `.gitignore` and confirm the current entries near the `*.log` line. Read the first 5 lines of `wire-debug.log.old` to confirm it is a log file (not actual source code someone named poorly).

**Actions:**

1. In `.gitignore`, add after the existing `*.log` line:
   ```
   *.log.old
   wire-debug.log*
   ```

2. Untrack the file (keep it on disk, stop tracking in git):
   ```bash
   git rm --cached fusion-studio-server/wire-debug.log.old
   ```

**Commit message:**
```
chore: untrack wire-debug.log.old, tighten .gitignore for log files — Phase 0 Chunk 0.5
```

---

## Exit gate for Phase 0

After all 5 commits:

```bash
cd /Users/rccurtrightjr./projects/fs-dev && git log --oneline -7
```

Expected top 7: 5 chunk commits + `2bac568` + `cf1982e`.

```bash
cd fusion-studio-client && npm run build
```

Must exit 0.

```bash
git status
```

Must show: `nothing to commit, working tree clean` (the `.log.old` file may appear as "untracked" — that is correct and expected).

---

## What Phase 1 needs from Phase 0

Phase 0 has no technical dependencies for Phase 1. But it must be **approved by the project owner** before Phase 1 starts. The approval process is:

1. Incoming agent posts a summary of what changed (5 bullets, one per chunk).
2. Project owner reviews and approves in a new session.
3. Phase 1 handoff document (`docs/HANDOFF_PHASE1_CSS_TOKENS.md`) is generated at the start of the Phase 1 session.

---

## CalendarViewer.tsx — also needs cleanup (Chunk 0.1b)

One file was missed from the Chunk 0.1 scope: `CalendarViewer.tsx` also has FIXME comment debris.

**File:** `fusion-studio-client/src/components/calendar/CalendarViewer.tsx`
**Current line count:** ~153 lines (verify before acting)

**Lines to delete:**

Lines 17–19 — commented store destructure:
```
  // FIXME(calendar-store-refactor): fetchEventsForMonth not yet on the store.
  // const fetchEventsForMonth = useCalendarStore((s) => s.fetchEventsForMonth);
```

Lines 30–36 — the useEffect and its FIXME comment:
```
  useEffect(() => {
    // Sequential: calendars first, then events (avoids concurrent osascript contention)
    // FIXME(calendar-store-refactor): only fetching calendars right now; the
    // per-month event fetch is disabled until the store gains fetchEventsForMonth.
    fetchCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Wait — the `useEffect` above contains the live `fetchCalendars()` call, not just dead code. **Do not delete the useEffect itself.** Only delete the two FIXME comment lines inside it. The final result should be:

```tsx
  useEffect(() => {
    fetchCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

And delete only lines 17–18 (the two FIXME comment lines above the commented destructure), plus line 19 (the commented destructure itself).

Include this in Chunk 0.1's commit (same commit, same logical change).

**Commit message for 0.1 (updated):**
```
chore(calendar): delete commented fetchEventsForMonth debris in MonthView + Viewer — Phase 0 Chunk 0.1
```
