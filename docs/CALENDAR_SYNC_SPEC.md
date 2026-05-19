# Calendar Sync Spec — Universal Adapter Pattern

**Date:** 2026-05-18  
**Status:** Ready for implementation  
**Enforces:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`

---

## Guiding Principle

One common language flows into the Universal Event Bus. Every data source — Apple local SQLite today, Google Apps Script tomorrow, iCloud CalDAV eventually — produces the same normalized shapes and emits the same event types. The trigger and automation system never knows or cares where the data came from.

---

## Part 1: Cleanup Targets (Delete First)

**Delete, don't deprecate.** No `_unused` prefixes, no `// removed` comments. If it's dead, delete it.

### `fusion-studio-client/electron/main.cjs`

| Lines | What to delete |
|-------|---------------|
| 8–29 | `runJxa()` helper function |
| 451–628 | All 5 JXA calendar IPC handlers |

Check line 1 `spawn` import — if used only by `runJxa` and the calendar handlers, delete it too.

### `fusion-studio-client/electron/preload.cjs`

Delete lines 9–13 (5 calendar method exposures):
`listCalendars`, `listEvents`, `createEvent`, `updateEvent`, `deleteEvent`

### `fusion-studio-client/src/state/calendarStore.ts`

- Replace `fetchCalendars()` with `GET /api/calendar/calendars`
- Replace `fetchEvents()` with `GET /api/calendar/events?start=&end=`
- Delete `createEvent()`, `updateEvent()`, `deleteEvent()` — the IPC targets are gone
- Delete `loadDemoData()` — no silent fallback to fake data once real pipeline is live
- Delete the `window.electronAPI` type augmentation that declared these methods

---

## Part 2: Normalized Shapes (Common Language)

All adapters produce these exact shapes before writing to `fusion.db` or emitting on the bus. Nothing downstream knows whether data came from Apple or Google.

```js
// NormalizedCalendar
{
  uuid: string,       // source-prefixed: "apple:{UUID}" | "google:{calendarId}"
  source: string,     // 'apple' | 'google'
  title: string,
  color: string,      // hex or null
  type: string,       // 'local' | 'caldav' | 'google' | etc.
}

// NormalizedEvent
{
  uuid: string,       // source-prefixed: "apple:{UUID}" | "google:{eventId}"
  source: string,     // 'apple' | 'google'
  title: string,
  startDate: number,  // Unix timestamp (seconds)
  endDate: number,    // Unix timestamp (seconds)
  timezone: string,   // IANA timezone string
  allDay: boolean,
  description: string | null,
  conferenceUrl: string | null,
  calendarUuid: string,   // source-prefixed, FK to NormalizedCalendar.uuid
  calendarTitle: string,
  calendarColor: string,
}
```

---

## Part 3: File Structure

One job per file. Each file should be describable in one sentence without "and".

```
fusion-studio-server/lib/calendar/
  index.js              ← Start adapters that are available and configured
  db-writer.js          ← Upsert NormalizedCalendar[] + NormalizedEvent[] into fusion.db

  apple/
    watcher.js          ← Watch Group Containers dir via chokidar, debounce to trigger sync
    reader.js           ← Read-only SQLite queries against Calendar.sqlitedb
    convert.js          ← Map Apple SQLite rows to NormalizedCalendar / NormalizedEvent
    sync.js             ← Orchestrate: read → convert → write → emit bus event

  google/
    client.js           ← HTTP calls to the user's deployed Apps Script endpoint
    convert.js          ← Map Apps Script response to NormalizedCalendar / NormalizedEvent
    poller.js           ← Interval-based trigger (no FSEvents for cloud data)
    sync.js             ← Orchestrate: fetch → convert → write → emit bus event

fusion-studio-server/tools/google-bridge/
  google-bridge.gs      ← Apps Script file users deploy to their Google account
  README.md             ← Setup instructions (4 steps)
```

### Code Standards Checklist (verify before each file)

- [ ] One job — can I describe it without "and"?
- [ ] Under 400 lines
- [ ] Imports don't cross layer boundaries
- [ ] No premature abstractions — is there a second consumer?

---

## Part 4: Apple Adapter

### Source file paths

Resolve via `os.homedir()`. Never hardcode.

| File | Path |
|------|------|
| Calendar | `~/Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb` |
| Watch target | Parent directory (`group.com.apple.calendar/`) — WAL writes fire there |

Reminders path (`group.com.apple.reminders/`) is reserved for a follow-on spec.

### `apple/watcher.js`

One job: watch the Calendar Group Container directory and debounce calls to `sync.run()`.

```js
const chokidar = require('chokidar');
const os = require('os');
const path = require('path');

const CALENDAR_DIR = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.calendar'
);

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function start(onTrigger) {
  const trigger = debounce(onTrigger, 800);
  chokidar.watch(CALENDAR_DIR, {
    ignoreInitial: false,
    persistent: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  })
  .on('change', trigger)
  .on('add', trigger);
}

module.exports = { start };
```

### `apple/reader.js`

One job: read-only SQLite queries against Calendar.sqlitedb. Returns `null` on `SQLITE_BUSY` — let the next watcher fire retry naturally.

```js
const Database = require('better-sqlite3');
const os = require('os');
const path = require('path');

const DB_PATH = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb'
);

function readCalendars() {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    return db.prepare(`
      SELECT UUID, title, color, type
      FROM Calendar
      WHERE hidden IS NULL OR hidden = 0
    `).all();
  } catch (err) {
    if (err.code === 'SQLITE_BUSY') return null;
    throw err;
  } finally {
    db?.close();
  }
}

function readEvents(startApple, endApple) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    return db.prepare(`
      SELECT
        ci.UUID, ci.summary, ci.start_date, ci.end_date,
        ci.start_tz, ci.all_day, ci.description,
        ci.conference_url, ci.conference_url_detected,
        c.UUID as cal_uuid, c.title as cal_title, c.color as cal_color
      FROM CalendarItem ci
      JOIN Calendar c ON c.ROWID = ci.calendar_id
      WHERE ci.entity_type = 0
        AND ci.hidden = 0
        AND ci.start_date < ?
        AND ci.end_date > ?
    `).all(endApple, startApple);
  } catch (err) {
    if (err.code === 'SQLITE_BUSY') return null;
    throw err;
  } finally {
    db?.close();
  }
}

module.exports = { readCalendars, readEvents };
```

### `apple/convert.js`

One job: map Apple SQLite rows to normalized shapes.

```js
const APPLE_EPOCH_OFFSET = 978307200; // seconds between 1970-01-01 and 2001-01-01

function appleToUnix(ts) {
  return Math.round(ts + APPLE_EPOCH_OFFSET);
}

function calendar(row) {
  return {
    uuid: `apple:${row.UUID}`,
    source: 'apple',
    title: row.title,
    color: row.color || null,
    type: row.type || 'local',
  };
}

function event(row) {
  return {
    uuid: `apple:${row.UUID}`,
    source: 'apple',
    title: row.summary || '(no title)',
    startDate: appleToUnix(row.start_date),
    endDate: appleToUnix(row.end_date),
    timezone: row.start_tz || 'UTC',
    allDay: row.all_day === 1,
    description: row.description || null,
    conferenceUrl: row.conference_url || row.conference_url_detected || null,
    calendarUuid: `apple:${row.cal_uuid}`,
    calendarTitle: row.cal_title,
    calendarColor: row.cal_color || null,
  };
}

module.exports = { calendar, event };
```

### `apple/sync.js`

One job: orchestrate read → convert → write → emit for the Apple adapter.

```js
const reader = require('./reader');
const convert = require('./convert');
const dbWriter = require('../db-writer');
const bus = require('../../event-bus');

const WINDOW_DAYS = 90;
const APPLE_EPOCH_OFFSET = 978307200;

async function run() {
  const now = Math.floor(Date.now() / 1000);
  const startApple = (now - WINDOW_DAYS * 86400) - APPLE_EPOCH_OFFSET;
  const endApple = (now + WINDOW_DAYS * 86400) - APPLE_EPOCH_OFFSET;

  const rawCalendars = reader.readCalendars();
  const rawEvents = reader.readEvents(startApple, endApple);

  if (rawCalendars === null || rawEvents === null) return; // SQLITE_BUSY, try next fire

  const calendars = rawCalendars.map(convert.calendar);
  const events = rawEvents.map(convert.event);

  await dbWriter.upsertCalendars(calendars);
  await dbWriter.upsertEvents(events);

  bus.emit('calendar:sync_complete', {
    source: 'apple',
    calendarCount: calendars.length,
    eventCount: events.length,
  });
}

module.exports = { run };
```

---

## Part 5: Google Adapter

### Architecture — Apps Script Bridge

No OAuth in Fusion. No Google Cloud project. No client_id or client_secret in the codebase.

The user deploys a single Apps Script file to their own Google account. The script runs in their account context — it has full access to their Calendar and Gmail. Fusion calls it as a plain HTTP endpoint, authenticated with a secret key that lives in the Secrets Manager.

**Setup flow (4 steps for the user):**

1. Go to `script.google.com`, create a new project
2. Paste the contents of `tools/google-bridge/google-bridge.gs`
3. Run `setup()` once — it generates a secret key stored in Script Properties
4. Deploy as Web App: *Execute as: Me, Access: Anyone*
5. Copy the deployment URL and the secret key into Fusion → Settings → Secrets Manager
   - Key name: `GOOGLE_BRIDGE_URL`
   - Key name: `GOOGLE_BRIDGE_KEY`

**Security model:** The secret key never leaves the user's machine (Secrets Manager → keychain). The Apps Script deployment is locked to calls that present that key. No Fusion infrastructure involved.

### `tools/google-bridge/google-bridge.gs`

```javascript
// Fusion Studio — Google Bridge
// Deploy as Web App: Execute as Me, Access: Anyone
// Run setup() once to generate your secret key, then add it to Fusion Secrets Manager.

function setup() {
  const key = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('FUSION_KEY', key);
  Logger.log('Your secret key (copy this into Fusion Secrets Manager):');
  Logger.log(key);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  const storedKey = PropertiesService.getScriptProperties().getProperty('FUSION_KEY');

  if (!storedKey || body.key !== storedKey) {
    return json({ error: 'unauthorized' }, 401);
  }

  switch (body.action) {
    case 'getCalendars': return json(getCalendars());
    case 'getEvents':    return json(getEvents(body.start, body.end));
    default:             return json({ error: 'unknown action' }, 400);
  }
}

function getCalendars() {
  return CalendarApp.getAllCalendars().map(c => ({
    id: c.getId(),
    title: c.getName(),
    color: c.getColor(),
  }));
}

function getEvents(startUnix, endUnix) {
  const start = new Date(startUnix * 1000);
  const end = new Date(endUnix * 1000);
  const events = [];
  CalendarApp.getAllCalendars().forEach(cal => {
    cal.getEvents(start, end).forEach(ev => {
      events.push({
        id: ev.getId(),
        title: ev.getTitle(),
        start: Math.floor(ev.getStartTime().getTime() / 1000),
        end: Math.floor(ev.getEndTime().getTime() / 1000),
        allDay: ev.isAllDayEvent(),
        description: ev.getDescription() || null,
        location: ev.getLocation() || null,
        calendarId: cal.getId(),
        calendarTitle: cal.getName(),
        calendarColor: cal.getColor(),
      });
    });
  });
  return events;
}

function json(data, status) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
```

### `google/client.js`

One job: make authenticated HTTP calls to the Apps Script endpoint.

```js
const secrets = require('../../secrets');

async function post(action, params = {}) {
  const [url, key] = await Promise.all([
    secrets.get('GOOGLE_BRIDGE_URL'),
    secrets.get('GOOGLE_BRIDGE_KEY'),
  ]);

  if (!url || !key) return null; // adapter not configured

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, action, ...params }),
  });

  if (!res.ok) throw new Error(`Google bridge HTTP ${res.status}`);
  return res.json();
}

module.exports = { post };
```

### `google/convert.js`

One job: map Apps Script response rows to normalized shapes.

```js
function calendar(row) {
  return {
    uuid: `google:${row.id}`,
    source: 'google',
    title: row.title,
    color: row.color || null,
    type: 'google',
  };
}

function event(row) {
  return {
    uuid: `google:${row.id}`,
    source: 'google',
    title: row.title || '(no title)',
    startDate: row.start,
    endDate: row.end,
    timezone: 'UTC', // Apps Script returns UTC-normalized timestamps
    allDay: row.allDay,
    description: row.description || null,
    conferenceUrl: null, // future: parse location for Meet links
    calendarUuid: `google:${row.calendarId}`,
    calendarTitle: row.calendarTitle,
    calendarColor: row.calendarColor || null,
  };
}

module.exports = { calendar, event };
```

### `google/poller.js`

One job: poll the Google sync on an interval (no FSEvents for cloud data).

```js
const { run } = require('./sync');

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function start() {
  run(); // initial fetch on startup
  setInterval(run, POLL_INTERVAL_MS);
}

module.exports = { start };
```

### `google/sync.js`

One job: orchestrate fetch → convert → write → emit for the Google adapter.

```js
const client = require('./client');
const convert = require('./convert');
const dbWriter = require('../db-writer');
const bus = require('../../event-bus');

const WINDOW_DAYS = 90;

async function run() {
  const now = Math.floor(Date.now() / 1000);
  const start = now - WINDOW_DAYS * 86400;
  const end = now + WINDOW_DAYS * 86400;

  const [rawCalendars, rawEvents] = await Promise.all([
    client.post('getCalendars'),
    client.post('getEvents', { start, end }),
  ]);

  if (!rawCalendars || !rawEvents) return; // not configured or call failed

  const calendars = rawCalendars.map(convert.calendar);
  const events = rawEvents.map(convert.event);

  await dbWriter.upsertCalendars(calendars);
  await dbWriter.upsertEvents(events);

  bus.emit('calendar:sync_complete', {
    source: 'google',
    calendarCount: calendars.length,
    eventCount: events.length,
  });
}

module.exports = { run };
```

---

## Part 6: Shared DB Writer

Two consumers exist (apple/sync.js and google/sync.js), so extraction is warranted per code standards. One job: upsert normalized data into `fusion.db`.

### `db-writer.js`

```js
const db = require('../db');

async function upsertCalendars(calendars) {
  const knex = db.get();
  for (const cal of calendars) {
    await knex('calendar_sources')
      .insert({ ...cal, updated_at: Date.now() })
      .onConflict('uuid').merge();
  }
}

async function upsertEvents(events) {
  const knex = db.get();
  for (const ev of events) {
    await knex('calendar_events')
      .insert({ ...ev, updated_at: Date.now() })
      .onConflict('uuid').merge();
  }
}

module.exports = { upsertCalendars, upsertEvents };
```

---

## Part 7: Entry Point

### `index.js`

One job: start all adapters that are available and configured.

```js
const os = require('os');
const path = require('path');
const fs = require('fs');
const appleWatcher = require('./apple/watcher');
const appleSync = require('./apple/sync');
const googlePoller = require('./google/poller');

const APPLE_CALENDAR_DB = path.join(
  os.homedir(),
  'Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb'
);

function start() {
  if (fs.existsSync(APPLE_CALENDAR_DB)) {
    appleWatcher.start(() => appleSync.run());
  }

  // Google adapter self-checks for secrets — starts only if configured
  googlePoller.start();
}

module.exports = { start };
```

---

## Part 8: Calendar Broadcaster (Server → Client)

`calendar:sync_complete` is a broadcast event — no `threadId`, goes to every connected client. It follows the exact same shape as `workspace-broadcaster.js`.

**New file:** `fusion-studio-server/lib/ws/calendar-broadcaster.js`

One job: subscribe to `calendar:sync_complete` on the bus and broadcast to all open WebSocket clients.

```js
/**
 * Calendar Broadcaster — bus → WebSocket fan-out for calendar sync events.
 * Template: lib/ws/workspace-broadcaster.js. Same shape — subscribe at startup,
 * broadcast to all clients, no state.
 */

const { on } = require('../event-bus');

function createCalendarBroadcaster({ getAllClients }) {
  function broadcastAll(wireMessage) {
    const payload = JSON.stringify(wireMessage);
    for (const ws of getAllClients()) {
      if (ws.readyState !== 1) continue;
      ws.send(payload);
    }
  }

  on('calendar:sync_complete', (event) => {
    broadcastAll({
      type: 'calendar:sync_complete',
      source: event.source,
      calendarCount: event.calendarCount,
      eventCount: event.eventCount,
    });
  });

  console.log('[CalendarBroadcaster] Started');
  return { started: true };
}

module.exports = { createCalendarBroadcaster };
```

### Startup wiring

In `lib/startup.js`, after `createWorkspaceBroadcaster` — reuse the `getAllClients` closure already defined there:

```js
const { createCalendarBroadcaster } = require('./ws/calendar-broadcaster');
const calendar = require('./calendar');

// After initDb() and the existing broadcaster inits:
createCalendarBroadcaster({ getAllClients });
calendar.start();
```

---

## Part 9: Client Message Handler (WebSocket → Store)

The client follows the existing `handleWorkspaceMessage` / `handleHarnessMessage` pattern. Each domain gets its own handler file; `ws-client.ts` calls it in the chain.

**New file:** `fusion-studio-client/src/lib/ws/calendar-handlers.ts`

One job: handle `calendar:sync_complete` wire messages and trigger a store re-fetch.

```ts
/**
 * calendar-handlers — handle calendar WebSocket messages.
 * Mirrors workspace-handlers pattern: boolean-returning, switch on msg.type.
 */

import { useCalendarStore } from '../../state/calendarStore';

export function handleCalendarMessage(msg: { type: string; [key: string]: unknown }): boolean {
  switch (msg.type) {
    case 'calendar:sync_complete': {
      const store = useCalendarStore.getState();
      store.fetchEvents(store.visibleRangeStart, store.visibleRangeEnd);
      return true;
    }
    default:
      return false;
  }
}
```

### Wire into `ws-client.ts`

Add import:
```ts
import { handleCalendarMessage } from './ws/calendar-handlers';
```

Add to `handleMessage()` before the `state:result` block:
```ts
if (handleCalendarMessage(msg)) return;
```

Full handler chain order after this change:
```ts
if (handleStreamMessage(msg)) return;
if (handleThreadMessage(msg)) return;
if (handleFileMessage(msg)) return;
if (handleWorkspaceMessage(msg)) return;
if (handleHarnessMessage(msg)) return;
if (handleThemeMessage(msg)) return;
if (handleScreenshotMessage(msg)) return;
if (handleRecentDocsMessage(msg)) return;
if (handleCalendarMessage(msg)) return;   // ← new
```

### `calendarStore` — visible range requirement

`handleCalendarMessage` reads `store.visibleRangeStart` and `store.visibleRangeEnd`. Confirm these are Zustand store state fields (not local component state) before implementation. If they live in the component today, migrate them into the store as part of this work.

---

## Part 10: Database Migration

The existing migrations top out at `021_recent_docs.js`. New file:

**File:** `fusion-studio-server/lib/db/migrations/022_calendar_sync.js`

**Tables live in:** `fusion-studio-server/data/fusion.db` — the same SQLite database as all other Fusion data. No separate database.

```js
exports.up = async (knex) => {
  await knex.schema.createTable('calendar_sources', (t) => {
    t.string('uuid').primary();    // source-prefixed: "apple:UUID" | "google:id"
    t.string('source').notNullable();
    t.string('title').notNullable();
    t.string('color');
    t.string('type');
    t.bigInteger('updated_at');
  });

  await knex.schema.createTable('calendar_events', (t) => {
    t.string('uuid').primary();    // source-prefixed
    t.string('source').notNullable();
    t.string('title');
    t.bigInteger('startDate');     // Unix timestamp seconds
    t.bigInteger('endDate');       // Unix timestamp seconds
    t.string('timezone');
    t.boolean('allDay').defaultTo(false);
    t.text('description');
    t.string('conferenceUrl');
    t.string('calendarUuid');      // FK to calendar_sources.uuid
    t.string('calendarTitle');
    t.string('calendarColor');
    t.bigInteger('updated_at');
    t.index(['startDate', 'endDate']);
    t.index('calendarUuid');
    t.index('source');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('calendar_events');
  await knex.schema.dropTableIfExists('calendar_sources');
};
```

---

## Part 11: HTTP Routes

```
GET /api/calendar/calendars
  → SELECT * FROM calendar_sources ORDER BY title

GET /api/calendar/events?start=<unix>&end=<unix>
  → SELECT * FROM calendar_events
    WHERE startDate < end AND endDate > start
    ORDER BY startDate
```

Optional `?source=apple` filter available via `WHERE source = ?`.

---

## Part 12: Event Bus Summary

`calendar:sync_complete` is the single entry point into the trigger and automation system. Both adapters emit it. The broadcaster forwards it to all connected clients. The client handler re-fetches the visible window from the HTTP API.

Full flow for a calendar change:

```
macOS Calendar writes → FSEvents fires → debounce 800ms
  → apple/sync.js reads SQLite → normalizes → upserts fusion.db
  → bus.emit('calendar:sync_complete', { source: 'apple', ... })
  → calendar-broadcaster.js receives it
  → broadcasts { type: 'calendar:sync_complete' } to all WS clients
  → ws-client.ts → handleCalendarMessage()
  → calendarStore.fetchEvents(visibleRangeStart, visibleRangeEnd)
  → GET /api/calendar/events → reads fusion.db → renders
```

Future events (emit only when a consumer exists):
- `calendar:event_added`
- `calendar:event_updated`

---

## Part 13: Client Store (`calendarStore.ts`)

```ts
fetchCalendars: async () => {
  const res = await fetch('/api/calendar/calendars');
  const data = await res.json();
  set({ calendars: data });
},

fetchEvents: async (start: Date, end: Date) => {
  const params = new URLSearchParams({
    start: String(Math.floor(start.getTime() / 1000)),
    end: String(Math.floor(end.getTime() / 1000)),
  });
  const res = await fetch(`/api/calendar/events?${params}`);
  const data = await res.json();
  set({ events: data });
},
```

`visibleRangeStart` and `visibleRangeEnd` must be Zustand store fields (not local component state) so `calendar-handlers.ts` can read them via `getState()`.

---

## Part 14: Startup Wiring Summary

Everything that goes into `lib/startup.js`:

```js
const { createCalendarBroadcaster } = require('./ws/calendar-broadcaster');
const calendar = require('./calendar');

// Inside start(), after initDb() and existing broadcaster inits:
createCalendarBroadcaster({ getAllClients });
calendar.start();
```

`calendar.start()` is non-blocking. The Apple watcher fires an initial sync immediately; the Google poller fires on its interval.

---

## Out of Scope

**Write-back deferred.** Create/edit/delete events against Calendar.app or Google Calendar is a separate spec. The `EventModal` UI stays, submit is disabled.

**Reminders.** Same adapter pattern. `~/Library/Group Containers/group.com.apple.reminders/Container_v1/Stores/Data-*.sqlite` — multiple files, one per account. Follow-on spec after Calendar is stable.

**Full Disk Access check.** First-run check for `Calendar.sqlitedb` readability → prompt user to grant Full Disk Access in System Settings. Small enough to inline in `index.js`.
