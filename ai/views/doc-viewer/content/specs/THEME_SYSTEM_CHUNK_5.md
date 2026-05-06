# Chunk 5: Robin deprecation

**From:** THEME_SYSTEM_REFACTOR_SPEC.md §5.5  
**Goal:** Remove the old preset-based theme system from the Robin panel. Strip all DB theme writes, archive the old CSS generator, and clean up client-side Robin theme code.  
**Depends on:** Chunks 1–4 (new theme system is live and working)

---

## Context

The Robin panel still has:
- `lib/robin/theme-css.js` — old preset-based CSS generator (dark/oled/medium/light)
- `lib/robin/ws-handlers.js` — theme WebSocket handlers that write to SQLite
- `lib/robin/queries.js` — theme DB queries (`system_theme`, `workspace_themes`)
- Client-side `RobinOverlay.tsx` — sends `robin:theme-load`, `robin:theme-update-system`, etc.
- `ws-client.ts` — routes `robin:theme-data` messages

The new slider-based system (Chunks 1–4) has replaced all of this. The old code is dead weight.

---

## Server-side changes

### `open-robin-server/lib/robin/theme-css.js`

**Action:** Move to `open-robin-server/archive/theme-css.js`

This file is no longer imported by any runtime code (Chunk 2 replaced the CSS generator). However, `lib/db/migrations/003_workspace_themes.js` still imports it.

**Before moving,** update the migration:
- Open `lib/db/migrations/003_workspace_themes.js`
- If it imports `generateThemeCss` from `../../robin/theme-css`, either:
  - Inline the `generateThemeCss` function into the migration, OR
  - Update the import path to `../../archive/theme-css`

Then move the file to `archive/`.

---

### `open-robin-server/lib/robin/ws-handlers.js`

**Remove all theme-related code:**

1. **Remove imports:**
   ```js
   const { generateThemeCss, hexToRgb } = require('./theme-css');
   const themesService = require('../theme/themes-service');
   ```
   (Keep `robinQueries` import and other non-theme imports.)

2. **Remove the `PRESET_TO_SLIDERS` mapping** (lines ~18–23).

3. **Remove `applyThemeToNewSystem()` function** (lines ~56–98).

4. **Remove `buildThemeData()` function** (lines ~101–135).
   - Verify it is **only** called by the theme handlers below. If anything else calls it, keep it but strip the theme-related fields.

5. **Remove these handlers from the returned object:**
   - `'robin:theme-load'`
   - `'robin:theme-update-system'`
   - `'robin:theme-update-workspace'`
   - `'robin:theme-inherit'`
   - `'robin:theme-apply-diverged'`

6. **Clean up unused helpers:** Remove `readFilesystemCss()` and `writeFilesystemCss()` if they are only used by the removed theme handlers.

**What to keep:**
- `'robin:tabs'`
- `'robin:tab-items'`
- `'robin:wiki-sections'`
- `'robin:wiki-page'`
- `'robin:context'`

---

### `open-robin-server/lib/robin/queries.js`

**Remove these exported functions:**
- `getSystemTheme`
- `updateSystemTheme`
- `getWorkspaceTheme`
- `upsertWorkspaceTheme`

**Remove them from `module.exports` too.**

**What to keep:**
- `getTabs`, `getTabItems`, `getWikiSections`, `getWikiPage`, `searchWiki`
- `getCli`, `getCliRegistry`, `setCliInstalled`, `setCliActive`
- `getWorkspaces` (used by non-theme code)

---

## Client-side changes

### `open-robin-client/src/components/Robin/RobinOverlay.tsx`

**Remove all theme-related code:**

1. **Remove the `robin:theme-data` message handler** (around line 103):
   ```ts
   onRobinMessage('robin:theme-data', (msg: any) => {
     if (!msg.error) {
       setSystemTheme(msg.systemTheme || null);
       setWorkspacesList(msg.workspaces || []);
     }
   }),
   ```

2. **Remove theme state and setters** from the component:
   - `systemTheme` state
   - `workspacesList` state
   - `setSystemTheme`, `setWorkspacesList`

3. **Remove the `robin:theme-load` fetch** (around line 141):
   ```ts
   sendRobinMessage({ type: 'robin:theme-load' });
   ```

4. **Remove theme update/inherit/apply UI code** (around lines 398–405):
   - Any `onUpdate`, `onUpdateColor`, `onInherit`, `onApply` callbacks that send `robin:theme-update-system`, `robin:theme-update-workspace`, `robin:theme-inherit`, `robin:theme-apply-diverged`

5. **Remove unused imports** related to theme types/state.

**What to keep:**
- Tabs rendering
- Wiki rendering
- Context tracking
- All non-theme Robin functionality

---

### `open-robin-client/src/lib/ws-client.ts`

**Remove `robin:theme-data` from the switch statement** (around line 187):
```ts
case 'robin:theme-data':
  emitRobin(msg.type, msg);
  break;
```

Change the switch to:
```ts
case 'robin:tabs':
case 'robin:items':
case 'robin:wiki':
  emitRobin(msg.type, msg);
  break;
```

---

### `open-robin-client/src/types/index.ts`

**Remove `'robin:theme-data'`** from the `ServerMessage` union type (around line 97).

---

## What NOT to touch

- Do NOT drop the `system_theme` or `workspace_themes` DB tables (deferred to future cleanup).
- Do NOT remove the `workspaces` table or `getWorkspaces` query (still used).
- Do NOT modify `themes-service.js`, `color-math.js`, or any of the new segment modules.
- Do NOT modify `theme-css-generator.js` or `live-preview.ts`.

---

## Acceptance criteria

- [ ] `lib/robin/theme-css.js` moved to `archive/theme-css.js`
- [ ] `lib/robin/ws-handlers.js` has no theme handlers (`robin:theme-*`)
- [ ] `lib/robin/queries.js` has no theme query functions
- [ ] `RobinOverlay.tsx` has no `robin:theme-data` handler and no theme state
- [ ] `ws-client.ts` has no `robin:theme-data` case
- [ ] `src/types/index.ts` has no `'robin:theme-data'` type
- [ ] DB migration that referenced `theme-css.js` still works (path updated or code inlined)
- [ ] Server starts without errors
- [ ] TypeScript compiles without errors
- [ ] Robin tabs and wiki still work (smoke-test: open Robin panel, verify tabs and wiki load)

---

## Verification steps

**Server:**
```bash
cd open-robin-server
node -c lib/robin/ws-handlers.js
node -c lib/robin/queries.js
node server.js
```

**Client:**
```bash
cd open-robin-client
npx tsc --noEmit -p tsconfig.app.json
```

**Check for dead imports:**
```bash
grep -r "robin:theme-" open-robin-client/src/
grep -r "generateThemeCss\|theme-css" open-robin-server/lib/
```
No matches should remain outside of `archive/` and migration files.

---

## Report format

```markdown
# Chunk 5 Report

## Files changed
- moved: open-robin-server/lib/robin/theme-css.js → archive/ (+0, created in archive)
- modified: open-robin-server/lib/robin/ws-handlers.js (+X, -X)
- modified: open-robin-server/lib/robin/queries.js (+X, -X)
- modified: open-robin-client/src/components/Robin/RobinOverlay.tsx (+X, -X)
- modified: open-robin-client/src/lib/ws-client.ts (+X, -X)
- modified: open-robin-client/src/types/index.ts (+X, -X)
- modified: open-robin-server/lib/db/migrations/003_workspace_themes.js (+X, -X)

## Acceptance criteria
- [x] criterion — how verified
- [ ] criterion — why blocked

## Gotchas / deviations
- Anything unexpected
```
