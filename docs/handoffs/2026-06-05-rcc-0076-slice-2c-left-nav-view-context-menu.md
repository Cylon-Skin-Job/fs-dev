# Worker Handoff: RCC-0076 Slice 2C - Left Nav View Context Menu

## Repo

```bash
cd /Users/rccurtrightjr./projects/fs-dev
```

Confirm:

```bash
git rev-parse --show-toplevel
git status --short
git log -1 --oneline
```

Expected repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The tree is expected to be heavily dirty. Inspect before editing and do not overwrite unrelated changes.

If `rg` is unavailable in your shell, use available grep/search tooling and report the substitution.

## Required Reading

Read these before working:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-2b-migrate-live-view-registry.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-4c-validate-create-new-live-registry.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Current Architecture Facts

- The left view rail is `fusion-studio-client/src/components/ToolsPanel.tsx`.
- `ToolsPanel` renders from `usePanelStore((s) => s.panelConfigs)`.
- The current panel switch path is `setCurrentPanel()` in `fusion-studio-client/src/state/panelStore.ts`, which sends `set_panel` over WebSocket.
- Panel discovery now prefers `ai/system/workspace/views.json` via `fusion-studio-client/src/lib/panels.ts` and `fusion-studio-server/lib/views/index.js`.
- Server exposes `ai/system/workspace/` through the `__workspace__` pseudo-panel for read access.
- This slice manages views inside the active workspace. It does not manage top-ribbon workspace membership.

## Goal

Add a right-click context menu on existing left-nav view icons so users can manage installed views in the active workspace.

Persist changes to:

```text
ai/system/workspace/views.json
```

Keep this first management slice narrow: rename label, change icon, hide view, move up, and move down. Do not delete folders.

## Product Behavior

- Right-clicking a view icon in the left rail opens a compact context menu near the click point.
- Menu shows the current view label/id for orientation.
- User can rename the view label.
- User can change the Material Symbols icon name.
- User can hide the view, which sets `enabled: false` in `ai/system/workspace/views.json`.
- User can move the view up/down by changing persisted order/rank in `ai/system/workspace/views.json`.
- Hidden views disappear from the left rail after registry reload.
- If the active view is hidden, switch to the nearest remaining enabled view. Prefer the next view to the right/below; fall back to previous.
- If no enabled views remain, leave current panel unset or in a safe empty state. Do not crash.
- Clicking outside the menu closes it.
- Pressing Escape closes it.
- Normal left-click view switching remains unchanged.

## Registry Mutation Rules

All changes must update only `ai/system/workspace/views.json`.

Rules:

- Rename changes `label` only. It must not rename folders, ids, or `baseViewId`.
- Icon changes `icon` only.
- Hide sets `enabled: false`. It must not delete folders.
- Move up/down reorders the registry views deterministically.
- Preserve all non-mutated fields: `id`, `baseViewId`, `source`, `viewPath`, existing unknown fields.
- Preserve disabled/hidden entries in the registry.
- Do not edit `ai/views/index.json`.
- Do not edit `ai/views/<view-id>/index.json` in this slice.
- Do not add duplicate view creation.

Recommended move behavior:

- Work only on enabled views for up/down positioning.
- Swap the target enabled view with the nearest enabled neighbor.
- Persist by rewriting `rank` values for enabled views to the resulting order using stable integers starting at 0 or 1, but preserve disabled entries and place them after enabled entries unless current code already has a clearer convention.
- If you choose to preserve existing duplicate rank values instead, explicitly document how up/down remains deterministic.

## Implementation Scope

Primary client scope:

```text
fusion-studio-client/src/components/ToolsPanel.tsx
fusion-studio-client/src/components/ToolsPanel.css
fusion-studio-client/src/state/panelStore.ts
fusion-studio-client/src/state/panelStoreTypes.ts
fusion-studio-client/src/lib/panels.ts
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-client/src/types/index.ts
```

Primary server scope:

```text
fusion-studio-server/lib/views/index.js
fusion-studio-server/lib/ws/client-message-router.js
```

Support scope only if build/tests prove it is directly required:

```text
fusion-studio-client/src/components/App.tsx
fusion-studio-server/test/**
```

Do not edit Electron menu code. Do not edit workspace ribbon code unless a type/build error directly requires a tiny adjustment.

## Suggested Message Contract

Use one focused WebSocket message for registry mutations:

Client request:

```json
{
  "type": "workspace:view_update_requested",
  "viewId": "wiki-viewer",
  "patch": { "label": "Wiki", "icon": "full_coverage", "enabled": true },
  "move": "up"
}
```

Rules:

- `patch` is optional.
- `move` is optional and may be `up` or `down`.
- Allow exactly the known mutable fields in `patch`: `label`, `icon`, `enabled`.
- Ignore or reject attempts to patch `id`, `baseViewId`, `source`, or `viewPath`.

Server success response:

```json
{
  "type": "workspace:view_registry_updated",
  "registry": { "version": 1, "sort": "ranked", "views": [] }
}
```

Server rejection response:

```json
{
  "type": "workspace:view_update_rejected",
  "message": "View not found"
}
```

Keep responses targeted to the requesting client for this slice. Broadcast can be added later if multi-client registry editing becomes necessary.

## Server Requirements

Add focused helper behavior in `fusion-studio-server/lib/views/index.js` or a small adjacent module if one file would become too broad.

Required server behavior:

- Read current `ai/system/workspace/views.json` for the active workspace.
- Reject if there is no active workspace.
- Reject if the registry file is missing or invalid.
- Reject if `viewId` is missing or not in the registry.
- Reject unknown patch fields.
- Validate `label` and `icon` as non-empty strings when provided.
- Validate `enabled` as boolean when provided.
- Validate `move` as `up` or `down` when provided.
- Write the updated registry atomically enough for local app use: write JSON with two-space indentation and trailing newline. A direct `writeFileSync` is acceptable for this slice if existing code uses sync filesystem operations.
- Use path resolution from active `projectRoot`; never hardcode the user's home directory.
- Do not allow client-supplied file paths.

After success:

- Send `workspace:view_registry_updated` with the updated registry.
- Client should reload panel discovery or update panel configs from the registry.

## Client Requirements

In `ToolsPanel.tsx`:

- Add `onContextMenu` to each view button.
- Prevent default browser context menu.
- Track menu open state locally unless store state is clearly needed.
- Keep normal `onClick` behavior unchanged.
- Render the context menu with `.rv-` prefixed classes.
- Menu actions:
  - Rename
  - Change icon
  - Move up
  - Move down
  - Hide view
- For rename/icon, a small inline prompt/input inside the menu is acceptable. A browser `prompt()` is acceptable only if it keeps scope minimal and tests/build pass, but prefer a small controlled input if easy.
- Disable Move up/down when there is no enabled neighbor.
- Disable Hide if it is the last enabled view, unless you implement the safe empty state.

In client state/handlers:

- Add a small action for sending `workspace:view_update_requested` through the active WebSocket, or send directly from `ToolsPanel` only if that matches current project patterns.
- On `workspace:view_registry_updated`, rediscover panels using the existing `loadAllPanels()` path.
- If current panel is no longer present after rediscovery, choose the nearest valid panel if available, otherwise avoid sending invalid `set_panel`.
- On `workspace:view_update_rejected`, show a useful error. Existing toast/modal infrastructure is acceptable if already used; otherwise local error text in the menu is acceptable.

## Non-Goals

- Do not implement Add View.
- Do not implement Restore View.
- Do not implement empty-space left-nav context menu. That is Slice 2D.
- Do not delete view folders.
- Do not edit `ai/views/index.json`.
- Do not edit per-view `ai/views/<view-id>/index.json`.
- Do not add duplicate/clone view behavior.
- Do not implement a full icon picker; text entry for Material Symbols names is enough.
- Do not change top workspace ribbon behavior.
- Do not change Create New behavior.
- Do not implement Electron menu behavior.

## Acceptance Checks

Run from repo root:

```bash
rg -n "workspace:view_update_requested|workspace:view_registry_updated|workspace:view_update_rejected" fusion-studio-client/src fusion-studio-server
```

Expected: hits in client and server.

Run:

```bash
rg -n "onContextMenu|Hide view|Move up|Move down|Change icon|Rename" fusion-studio-client/src/components/ToolsPanel.tsx fusion-studio-client/src/components/ToolsPanel.css
```

Expected: context menu UI exists in `ToolsPanel`.

Run:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected: no hits.

Run:

```bash
rg -n "ai/views/index.json" fusion-studio-client/src fusion-studio-server/lib/views fusion-studio-server/lib/ws
```

Expected: no new active registry-write path. Existing documentation/legacy compatibility references may exist; report any hits.

Run client build:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Run relevant server tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/ws/client-message-router.test.js test/thread/thread-messages.test.js
```

If a more targeted view-registry test exists or is added, run that too.

Run targeted diff check:

```bash
git diff --check -- \
  fusion-studio-client/src/components/ToolsPanel.tsx \
  fusion-studio-client/src/components/ToolsPanel.css \
  fusion-studio-client/src/state/panelStore.ts \
  fusion-studio-client/src/state/panelStoreTypes.ts \
  fusion-studio-client/src/lib/panels.ts \
  fusion-studio-client/src/lib/ws/workspace-handlers.ts \
  fusion-studio-client/src/types/index.ts \
  fusion-studio-server/lib/views/index.js \
  fusion-studio-server/lib/ws/client-message-router.js
```

Avoid relying only on full-repo `git diff --check`; the repo has known pre-existing whitespace in `fusion-studio-server/lib/transcription/index.js:287`.

## Manual Smoke

If validation passes and the app can be restarted safely, smoke on a non-critical workspace first:

1. Right-click a left rail view icon.
2. Rename the view label. Confirm the label persists in `ai/system/workspace/views.json` and after reload.
3. Change the icon. Confirm the rail updates and registry persists it.
4. Move a view up/down. Confirm ordering changes and persists.
5. Hide a non-active view. Confirm it disappears from the rail and `enabled: false` is in the registry.
6. Hide the active view if safe. Confirm app switches to a remaining view.
7. Confirm no `ai/views/<view-id>/` folder was deleted.
8. Confirm `ai/views/index.json` was not edited.

If manual smoke changes a real workspace registry, report the exact workspace and final state. Prefer reverting only the smoke changes you made by using the UI to restore them, not by deleting files. Do not revert unrelated user/worker changes.

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files intentionally changed.
- Message contract implemented.
- How registry update validation works.
- How rank/order is persisted.
- How active-view hiding is handled.
- Whether disabled entries remain in `views.json`.
- Acceptance check results.
- Build/test results.
- Manual smoke results, or why smoke was not run.
- Any files touched outside declared scope, with reason.

## Expected Outcome

The left nav has a minimal per-view context menu for managing installed views, and every change persists through `ai/system/workspace/views.json` without deleting folders or touching legacy registries.
