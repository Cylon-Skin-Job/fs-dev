# Chunk 2: Add `fetchSettingsFile` to Client

**Goal:** Teach the client to fetch files from `ai/settings/` via the new `__settings__` pseudo-panel.

**Prerequisites:** Chunk 1 complete (server resolves `__settings__`).

**Context:** The client currently uses `fetchViewsRootFile(ws, 'settings/themes.css')` which calls `fetchPanelFile(ws, '__panels__', 'settings/themes.css')` and resolves to `ai/views/settings/themes.css`. We need a parallel function that calls `fetchPanelFile(ws, '__settings__', 'themes.css')` and resolves to `ai/settings/themes.css`.

**File to change:** `open-robin-client/src/lib/panels.ts`

**Current code (existing constants and functions):**
```ts
export const VIEWS_SETTINGS_STYLES_THEMES = 'settings/themes.css' as const;

export function fetchViewsRootFile(ws: WebSocket, pathUnderViews: string): Promise<string> {
  return fetchPanelFile(ws, '__panels__', pathUnderViews);
}
```

**Changes to make:**

1. **Add new constants** after the existing `VIEWS_SETTINGS_*` constants:
```ts
export const SETTINGS_STYLES_THEMES     = 'themes.css' as const;
export const SETTINGS_STYLES_COMPONENTS = 'components.css' as const;
export const SETTINGS_STYLES_VIEWS      = 'views.css' as const;
export const SETTINGS_STYLES_TINTS      = 'tints.css' as const;
export const SETTINGS_STYLES_VARIABLES  = 'variables.css' as const;
```

2. **Add new function** after `fetchViewsRootFile`:
```ts
/** Fetch a file under ai/settings/ via the __settings__ pseudo-panel. */
export function fetchSettingsFile(ws: WebSocket, pathUnderSettings: string): Promise<string> {
  return fetchPanelFile(ws, '__settings__', pathUnderSettings);
}
```

**Smoke test:**
1. Build the client: `cd open-robin-client && npm run build`
2. Verify TypeScript compiles with no errors
3. No runtime test yet — the hook hasn't been updated to call `fetchSettingsFile`

**Risk:** Low. Pure addition, no existing usage changed.

**Next chunk:** Chunk 3 — Update `useSharedWorkspaceStyles` to load from `ai/settings/`.
