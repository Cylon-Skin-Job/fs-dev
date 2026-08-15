# Chunk B — Filesystem Restructure (ai/<machine>/System → ai/<machine>/System)

**Phase:** 2.1
**Depends on:** Chunk A (complete)
**Spec written:** 2026-05-21
**Status:** Ready for handoff

← [ROADMAP-REVISED.md](../ROADMAP-REVISED.md)

---

## Goal

Rename `ai/<machine>/System/styles/` → `ai/<machine>/System/` and reorganize its contents into subfolders.
Update every code reference atomically. Final assertion: zero hits for `ai/<machine>/System`
in production code.

---

## Filesystem Operations

Do these first, before touching any code.

```
CREATE  ai/<machine>/System/
CREATE  ai/<machine>/System/config/
CREATE  ai/<machine>/System/state/
CREATE  ai/<machine>/System/styles/
CREATE  ai/<machine>/System/data/          ← empty, SQLite DBs land here in Phase 2.7

MOVE    ai/<machine>/System/config/cli.json             → ai/<machine>/System/config/cli.json
MOVE    ai/<machine>/System/state/state.json           → ai/<machine>/System/state/state.json
MOVE    ai/<machine>/System/state/state.json.bak       → ai/<machine>/System/state/state.json.bak
MOVE    ai/<machine>/System/styles/themes.json          → ai/<machine>/System/styles/themes.json
MOVE    ai/<machine>/System/styles/themes.json.bak      → ai/<machine>/System/styles/themes.json.bak
MOVE    ai/<machine>/System/styles/themes.css           → ai/<machine>/System/styles/themes.css
MOVE    ai/<machine>/System/styles/tints.css            → ai/<machine>/System/styles/tints.css
MOVE    ai/<machine>/System/styles/variables.css        → ai/<machine>/System/styles/variables.css
MOVE    ai/<machine>/System/styles/components.css       → ai/<machine>/System/styles/components.css
MOVE    ai/<machine>/System/styles/doc-viewer.css       → ai/<machine>/System/styles/doc-viewer.css
MOVE    ai/<machine>/System/styles/file-viewer.css      → ai/<machine>/System/styles/file-viewer.css
MOVE    ai/<machine>/System/styles/office-viewer.css    → ai/<machine>/System/styles/office-viewer.css
MOVE    ai/<machine>/System/styles/views.css            → ai/<machine>/System/styles/views.css

CREATE  ai/<machine>/System/state/workspace.json   ← new file, see below
DELETE  ai/<machine>/System/styles/                     ← after all moves confirmed
```

### `ai/<machine>/System/state/workspace.json` (new)

Stub workspace descriptor — content will grow as Phase 2 progresses:

```json
{
  "version": "1.0",
  "description": "Workspace system state and identity"
}
```

---

## Code Changes

### 1. `fusion-studio-server/server.js` — `__settings__` pseudo-panel resolution

**Line ~334.** Change the resolved path from `ai/<machine>/System/styles/` to `ai/<machine>/System/styles/`.
The `__settings__` pseudo-panel is used exclusively to serve CSS files — resolving
it to `styles/` means client-side path constants (`themes.css`, `variables.css`, etc.)
require no changes.

```js
// Before:
if (panel === '__settings__') {
  const settingsRoot = path.join(projectRoot, 'ai', 'settings');
  if (fs.existsSync(settingsRoot)) return settingsRoot;
  return null;
}

// After:
if (panel === '__settings__') {
  const settingsRoot = path.join(projectRoot, 'ai', 'system', 'styles');
  if (fs.existsSync(settingsRoot)) return settingsRoot;
  return null;
}
```

---

### 2. `fusion-studio-server/lib/startup.js` — CLI config path

**Line ~153.** Update the comment and the path passed to `ensureWorkspaceFile`:

```js
// Before (comment):
// 3.8c. CLI-config workspace file — ensure ai/<machine>/System/config/cli.json

// After (comment):
// 3.8c. CLI-config workspace file — ensure ai/<machine>/System/config/cli.json
```

The `ensureWorkspaceFile` call itself uses the path from `cli-config/loader.js`
(change #5 below) — verify the call chain reaches the updated path, not a
hardcoded string.

---

### 3. `fusion-studio-server/lib/view-state/resolver.js` — state.json path

**Line 48.** Workspace default state path:

```js
// Before:
return path.join(projectRoot, 'ai', 'settings', 'state.json');

// After:
return path.join(projectRoot, 'ai', 'system', 'state', 'state.json');
```

Line 52 (per-view override path) is unchanged — `ai/<machine>/Views/<view>/state/state.json`
is a per-view path, not the workspace default.

---

### 4. `fusion-studio-server/lib/watcher/filters/theme-json-regenerator.js` — path filter

**Line 35.** Update the path check that detects `themes.json` changes:

```js
// Before:
return filePath.includes('ai/<machine>/System/styles/') && ctx.basename.includes('themes.json');

// After:
return filePath.includes('ai/<machine>/System/styles/') && ctx.basename.includes('themes.json');
```

---

### 5. `fusion-studio-server/lib/cli-config/loader.js` — cli.json path

**Line 13.** Workspace CLI config path:

```js
// Before:
return path.join(projectRoot, 'ai', 'settings', 'cli.json');

// After:
return path.join(projectRoot, 'ai', 'system', 'config', 'cli.json');
```

Line 17 (per-view cli.json path) is unchanged — `ai/<machine>/Views/<viewId>/settings/cli.json`
is a per-view path.

---

### 6. `fusion-studio-client/src/lib/panels.ts` — comment only

**Lines 70-82.** `SETTINGS_STYLES_*` constants (`'themes.css'`, `'variables.css'`, etc.)
are relative paths served through `__settings__`. Since `__settings__` now resolves
to `ai/<machine>/System/styles/`, these constants require **no value changes**.

Update comments only where they reference `ai/<machine>/System/styles/`:
```ts
// Before (line ~7):
// Chat/thread styles: settings/views.css (see VIEWS_SETTINGS_STYLES_VIEWS).

// After:
// Chat/thread styles: ai/<machine>/System/styles/views.css (see VIEWS_SETTINGS_STYLES_VIEWS).
```

---

### 7. `fusion-studio-client/src/components/App.tsx` — comment only

**Line ~163.** Update the comment that references the old path:

```ts
// Before:
// ai/<machine>/System/styles/themes.css (workspace) with optional overrides at

// After:
// ai/<machine>/System/styles/themes.css (workspace) with optional overrides at
```

---

### 8. `fusion-studio-client/src/components/Fusion/ThemeDetail.tsx` — UI string

**Line ~170.** This path is shown to the user in the UI:

```tsx
// Before:
You can edit the workspace CSS directly at: <code>ai/<machine>/System/styles/themes.css</code>

// After:
You can edit the workspace CSS directly at: <code>ai/<machine>/System/styles/themes.css</code>
```

---

### 9. `fusion-studio-client/src/hooks/useSharedWorkspaceStyles.ts` — no changes

`SHARED_LAYERS` uses the `SETTINGS_STYLES_*` constants from `panels.ts` and the
`fetchSettingsFile` function which routes through `__settings__`. Both are handled
by changes #1 and #6. This file requires no edits.

---

## Migration Order

1. Filesystem moves (all files, all folders) — do atomically before any code change
2. Server changes (#1–#5) — server will fail to start if filesystem moves are incomplete
3. Client changes (#6–#8) — comments and one UI string, low risk
4. Restart server, verify app loads correctly
5. Run final assertions

---

## Final Assertions (must all pass before marking complete)

```bash
# Zero production code references to old path
grep -r "ai/<machine>/System" fusion-studio-server/lib --include="*.js"   # → 0 hits
grep -r "ai/<machine>/System" fusion-studio-client/src --include="*.ts"   # → 0 hits
grep -r "ai/<machine>/System" fusion-studio-client/src --include="*.tsx"  # → 0 hits

# New structure exists and is populated
ls ai/<machine>/System/config/    # → cli.json
ls ai/<machine>/System/state/     # → state.json, workspace.json
ls ai/<machine>/System/styles/    # → themes.json, themes.css, variables.css, ...
ls ai/<machine>/System/data/      # → (empty, ready for SQLite)

# Old folder is gone
ls ai/<machine>/System/styles/         # → No such file or directory
```

Comments in `panels.ts` and `App.tsx` may mention `ai/<machine>/System` — those are
documentation strings, not production paths. The grep should target `path.join`
calls and string literals that construct actual filesystem paths.

---

## Smoke Tests

- [ ] Server starts without errors
- [ ] App loads in Electron — no blank window, no console errors about missing CSS
- [ ] Theme picker works — changes apply visually
- [ ] `ai/<machine>/System/styles/themes.css` receives edits from theme picker (verify via file watcher)
- [ ] CLI config loads correctly — active harness is correct on workspace switch
- [ ] View state persists across reload — panel widths and layout survive a server restart
- [ ] `theme-json-regenerator` filter fires when `ai/<machine>/System/styles/themes.json` is modified

---

## What NOT to Change

- Per-view paths like `ai/<machine>/Views/<view>/state/state.json` — these are per-view,
  not workspace-level, and are unaffected by this rename
- `SETTINGS_STYLES_*` constant values in `panels.ts` — relative paths, unchanged
- `VIEWS_SETTINGS_STYLES_*` constants — per-view CSS paths, unaffected
- Any logic inside `view-state/resolver.js`, `cli-config/loader.js` beyond the path strings
