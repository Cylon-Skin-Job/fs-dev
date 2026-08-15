# Session T1L3 — Server Wiring

**Track:** 1 (Server). **Layer:** 3 (Final wiring).
**Master spec:** `docs/SECRETS_MANAGER_SPEC.md` — read this for context. Sections most relevant to this session: §11a, §11b (note on `lib/secrets/index.js` shadowing), and the precedent set by how `lib/robin/` and `lib/ws/theme-handlers.js` are registered in `server.js` today.
**Dependencies:** Sessions T1L0, T1L1, T1L2 must all be complete and merged. Specifically: `lib/secrets/index.js` exists and exports `register(wsRouter)` (or whatever shape T1L2 chose to match the precedent — read it first).
**Estimated size:** Very small. One file edit, one or two lines plus a require. Most of this brief is verification.

---

## Files in scope

### 1. `open-robin-server/server.js` (modify — minimal edit)

Wire the secrets WS handlers into the existing message router. Mirror exactly how the existing handler families (theme, robin, clipboard) are wired. There may already be a registration site that takes one more registration call, or it may be inline at the WS-router setup — read first, match the pattern.

**Critical: use the explicit subpath when requiring.**

```js
// Correct:
const secretsModule = require('./lib/secrets/index');

// WRONG — this resolves to lib/secrets.js (the keychain wrapper), not the WS-handler aggregator:
// const secretsModule = require('./lib/secrets');
```

Per the spec §11b note, `lib/secrets.js` (keychain wrapper, ~196 lines) shadows `lib/secrets/index.js` (handler aggregator) when the bare path is used. Always use `./lib/secrets/index` (or `./lib/secrets/index.js`) explicitly.

After requiring, call the registration function the way other modules' registration is called. If the existing pattern is `router.use(handlers)`, do that. If it's `for (const [type, fn] of handlers) router.on(type, fn)`, do that. Don't invent a new pattern.

If the secrets aggregator from T1L2 takes a `getAllClients` (or equivalent) factory dependency — match the precedent set by `lib/ws/theme-handlers.js`, which T1L2's report referenced. Read both files before wiring.

---

## Files NOT in scope

- Anything under `lib/secrets/` — already done in T1L0/T1L1/T1L2. Do not modify.
- Anything client-side, anything wiki.

---

## Acceptance criteria

1. **Server boots cleanly.** `npm start` (or whatever the project's start command is) succeeds without throwing. Console shows the secrets module's registration message if the precedent pattern emits one (it might, by analogy to theme handlers).

2. **The shadowing trap is avoided.** `grep -n "require.*secrets" open-robin-server/server.js` shows the require pointing at `./lib/secrets/index` (or equivalent explicit path), not the bare `./lib/secrets`. Confirm by adding a one-time `console.log(Object.keys(secretsModule))` after the require — should print `['register']` (or whatever the aggregator exports), NOT keychain wrapper exports like `['get', 'set', 'del', 'has', ...]`.

3. **Three message types route.** With the server running, send each of the three secrets messages over a WebSocket connection (use the dev tools WS panel or a quick test client):
   - `{type:'secrets:api-keys:list'}` → receives `secrets:api-keys:state` with `items: []` (empty list, no rows yet).
   - `{type:'secrets:api-keys:set', name:'TEST_KEY_T1L3', value:'ignore_me_12345', description:'smoke test'}` → keychain entry written, `secrets_index` row added, `secret:added` UEB event fires (subscribe `on('secret:added', ...)` to confirm), broadcast goes out.
   - `{type:'secrets:api-keys:delete', name:'TEST_KEY_T1L3'}` → keychain entry removed, row gone, `secret:deleted` UEB event fires, broadcast goes out with empty list.

4. **Cleanup after smoke test.** The `TEST_KEY_T1L3` entry from step 3 is fully removed by the `delete` call. Verify: `security find-generic-password -a "open-robin" -s "TEST_KEY_T1L3"` returns not-found, and `sqlite3 "$ROBIN_DB" "SELECT * FROM secrets_index WHERE name='TEST_KEY_T1L3';"` returns zero rows.

5. **No regressions.** All existing WS message families still work — confirm by:
   - Loading the Robin overlay (theme tab, CLIs tab, etc.). Tabs render. (The Secrets tab is gone per migration 014; that's expected.)
   - Theme picker still works (open it, switch themes, confirm live preview).
   - Workspace switcher still works.

6. **`ROBIN_DB` env var verified.** From a Bash tool spawned by any installed CLI after the server is up, `echo $ROBIN_DB` prints the absolute path to `open-robin-server/data/robin.db`. (This was T1L0's deferred runtime check #4 — now's the natural time to confirm.)

7. **server.js diff.** `git diff open-robin-server/server.js` shows minimal change — ideally one line for the require and one line for the registration call. If the existing router pattern requires more (e.g., passing a `getAllClients` factory), the diff may be 3-4 lines. Anything beyond ~5 lines deserves a justification in the surprises section.

8. **No out-of-scope changes.** `git status` shows changes only to `server.js`.

---

## Implementation notes

- Read `server.js` first. Find where `theme:*` or `robin:*` handlers are wired. Match that exact pattern. The point of mirroring is to reduce future maintenance — when someone refactors the registration plumbing, secrets registration moves with theme/robin in one stroke.
- If T1L2's aggregator returns a factory (`function register(deps) { ... }`), pass it the same dependencies (probably `getAllClients` or `wsRouter`) the other registrations use. T1L2's surprises note says it followed the `factory({getAllClients}) → handler map` precedent — match it.
- The `ROBIN_DB` runtime check from T1L0 happens here naturally because the server is now running and a CLI has been spawned through the harness for the smoke tests.

---

## Return format

```
Session T1L3 complete.

Files changed:
  - <git diff stat>

Acceptance criteria:
  1. Server boots cleanly:                    [pass / fail + notes]
  2. Shadowing trap avoided:                  [pass / fail + notes]
  3. Three message types route:               [pass / fail + notes]
  4. Cleanup after smoke test:                [pass / fail + notes]
  5. No regressions:                          [pass / fail + notes]
  6. ROBIN_DB env var verified:               [pass / fail + notes]
  7. server.js diff:                          [pass / fail + notes]
  8. No out-of-scope changes:                 [pass / fail + notes]

Surprises / blockers:
  <anything unexpected; otherwise "none">

Ready for: convergence (E2E) once T2L2 lands.
```
