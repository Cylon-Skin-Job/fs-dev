# Worker Handoff: RCC-0076 Slice 2D - Left Nav Add/Restore View Menu

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
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-2c-left-nav-view-context-menu.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-4c-validate-create-new-live-registry.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

## Current Architecture Facts

- The left view rail is `fusion-studio-client/src/components/ToolsPanel.tsx`.
- Slice 2C added per-view right-click actions for existing enabled views.
- Panel discovery prefers `ai/<machine>/System/workspace/views.json`.
- Hidden views remain in `ai/<machine>/System/workspace/views.json` with `enabled: false`.
- View templates live under `System Source Files/view-templates/` and are declared by `System Source Files/views.manifest.json`.
- Create New uses `fusion-studio-server/lib/workspace/create-service.js` for manifest/template scaffolding.

## Goal

Add a right-click context menu on empty space in the left view rail for workspace view add/restore actions.

This slice completes the first minimal left-nav view management surface:

- `Restore View`: show hidden installed views from `ai/<machine>/System/workspace/views.json` and set `enabled: true`.
- `Add View`: show available manifest templates not already installed in the workspace, copy the selected template into `ai/<machine>/Views/<view-id>`, and append a new enabled registry entry.

## Product Behavior

- Right-clicking empty space below/around the view icons opens an empty-space context menu.
- The menu includes `Restore View` only when hidden views exist.
- `Restore View` lists hidden views by label/id.
- Selecting a hidden view sets `enabled: true` in `ai/<machine>/System/workspace/views.json` without copying files.
- The menu includes `Add View` when manifest templates are available that are not already installed by `baseViewId`.
- `Add View` lists available view templates from `System Source Files/views.manifest.json`.
- Selecting a template copies its template folder into the active workspace's `ai/<machine>/Views/<view-id>` and appends a registry entry.
- Added/restored views appear in the left rail after rediscovery.
- Normal left-click switching and Slice 2C per-view context menu behavior remain unchanged.

## Registry Rules

All live view membership/order changes must update:

```text
ai/<machine>/System/workspace/views.json
```

Rules:

- Restore sets `enabled: true` only.
- Restore must not recreate or copy files.
- Add View must not offer templates whose `baseViewId` is already installed in the registry, even if currently hidden.
- Add View must not create duplicate normal beginner-facing views.
- Add View may use manifest `id` as the new `id` and `baseViewId`.
- Add View writes `viewPath: "ai/<machine>/Views/<view-id>"`.
- Add View sets `source` from manifest `group`: `default` or `optional`.
- Add View appends with `rank` greater than the current max enabled rank, or uses a deterministic append order if ranks are normalized.
- Preserve existing disabled entries and unknown fields.
- Do not edit `ai/<machine>/Views/index.json`.
- Do not edit existing per-view `ai/<machine>/Views/<view-id>/index.json` except by copying a brand-new template folder for an added view.
- Do not delete folders.

## Implementation Scope

Primary client scope:

```text
fusion-studio-client/src/components/ToolsPanel.tsx
fusion-studio-client/src/components/ToolsPanel.css
fusion-studio-client/src/state/panelStore.ts
fusion-studio-client/src/state/panelStoreTypes.ts
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-client/src/types/index.ts
```

Primary server scope:

```text
fusion-studio-server/lib/views/index.js
fusion-studio-server/lib/ws/client-message-router.js
fusion-studio-server/lib/workspace/create-service.js
```

Support scope only if build/tests prove it is directly required:

```text
fusion-studio-client/src/lib/panels.ts
fusion-studio-client/src/components/view-management/**
fusion-studio-server/test/**
```

`ToolsPanel.tsx` is already doing more after Slice 2C. If adding this slice pushes it toward multiple jobs or awkward size, extract a focused small component such as `ViewRailContextMenu.tsx` or a focused hook. Do not create a broad abstraction layer.

## Suggested Message Contract

Use focused WebSocket messages.

Client request hidden/addable view options:

```json
{ "type": "workspace:view_options_requested" }
```

Server response:

```json
{
  "type": "workspace:view_options",
  "hiddenViews": [],
  "availableTemplates": []
}
```

Restore request:

```json
{
  "type": "workspace:view_restore_requested",
  "viewId": "wiki-viewer"
}
```

Add request:

```json
{
  "type": "workspace:view_add_requested",
  "templateId": "calendar"
}
```

Success response can reuse Slice 2C's registry update response:

```json
{ "type": "workspace:view_registry_updated", "registry": {} }
```

Rejection response can reuse Slice 2C's rejection response:

```json
{ "type": "workspace:view_update_rejected", "message": "..." }
```

Keep responses targeted to the requesting client for this slice.

## Server Requirements

Add focused helper behavior in `fusion-studio-server/lib/views/index.js`, `create-service.js`, or a small adjacent module if needed.

Required behavior for options:

- Read active workspace registry.
- Hidden views are registry entries with `enabled: false`.
- Read manifest via existing `create-service.readManifest()` if practical.
- Available templates are manifest entries whose `id`/`baseViewId` is not already installed in registry, regardless of enabled state.
- Do not expose templates with missing template folders.

Required behavior for restore:

- Reject no active workspace.
- Reject missing/invalid registry.
- Reject missing `viewId`.
- Reject if view is not in registry.
- Set `enabled: true`.
- Preserve every other field.
- Write formatted JSON with trailing newline.

Required behavior for add:

- Reject no active workspace.
- Reject missing/invalid registry.
- Reject missing `templateId`.
- Reject unknown manifest template.
- Reject if the template/base view is already installed in registry, enabled or disabled.
- Reject if destination `ai/<machine>/Views/<templateId>` already exists unexpectedly.
- Resolve template source under `System Source Files/view-templates`.
- Resolve destination under active workspace `ai/<machine>/Views`.
- Copy template safely: skip hidden files, skip symlinks, do not follow symlinks.
- Append a registry entry using manifest metadata.
- If copy fails after destination was created by this request, best-effort cleanup that destination folder only.
- Do not edit legacy `ai/<machine>/Views/index.json`.

## Client Requirements

In the view rail:

- Add `onContextMenu` to the empty rail area.
- Prevent default browser context menu for empty-space menu.
- Do not open empty-space menu when right-clicking an existing view button; Slice 2C menu should win there.
- Request view options when opening the empty-space menu, or maintain options from the latest server response.
- Render hidden view restore choices.
- Render addable template choices.
- Show a useful empty state if no hidden views and no addable templates exist.
- Use `.rv-` prefixed classes and existing token/fallback style patterns.
- Close on outside click and Escape.

In client state/handlers:

- Add actions to request options, restore view, and add view through the active WebSocket.
- Handle `workspace:view_options`.
- Reuse existing `workspace:view_registry_updated` rediscovery behavior from Slice 2C.
- Reuse existing `workspace:view_update_rejected` error display if adequate.

## Non-Goals

- Do not implement duplicate/clone view behavior.
- Do not implement a custom naming flow for added views.
- Do not implement drag/drop ordering.
- Do not delete view folders.
- Do not edit `ai/<machine>/Views/index.json`.
- Do not change top workspace ribbon behavior.
- Do not change Create New behavior except reusing manifest/template helpers.
- Do not implement Electron menu behavior.
- Do not implement polished searchable template picker; a simple list is enough.

## Acceptance Checks

Run from repo root:

```bash
rg -n "workspace:view_options_requested|workspace:view_options|workspace:view_restore_requested|workspace:view_add_requested" fusion-studio-client/src fusion-studio-server
```

Expected: hits in client and server.

Run:

```bash
rg -n "Restore View|Add View|availableTemplates|hiddenViews|onContextMenu" fusion-studio-client/src/components fusion-studio-client/src/state fusion-studio-client/src/lib/ws
```

Expected: empty-space menu and state handling exist.

Run:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected: no hits.

Run:

```bash
rg -n "ai/<machine>/Views/index.json" fusion-studio-server/lib/views fusion-studio-server/lib/ws fusion-studio-client/src
```

Expected: no new active registry write path. Existing legacy/documentation references should be reported.

Run client build:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Run targeted server tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/ws/client-message-router.test.js test/thread/thread-messages.test.js
```

Add or run a narrow server-side smoke for add/restore registry helpers if practical.

Run targeted diff check:

```bash
git diff --check -- \
  fusion-studio-client/src/components/ToolsPanel.tsx \
  fusion-studio-client/src/components/ToolsPanel.css \
  fusion-studio-client/src/state/panelStore.ts \
  fusion-studio-client/src/state/panelStoreTypes.ts \
  fusion-studio-client/src/lib/ws/workspace-handlers.ts \
  fusion-studio-client/src/types/index.ts \
  fusion-studio-server/lib/views/index.js \
  fusion-studio-server/lib/ws/client-message-router.js \
  fusion-studio-server/lib/workspace/create-service.js
```

Avoid relying only on full-repo `git diff --check`; the repo has known pre-existing whitespace in `fusion-studio-server/lib/transcription/index.js:287`.

## Manual Smoke

If validation passes and the app can be restarted safely, smoke on a non-critical workspace first:

1. Hide a view using the Slice 2C menu.
2. Right-click empty left rail space.
3. Confirm `Restore View` lists the hidden view.
4. Restore it. Confirm it reappears and `enabled: true` is persisted.
5. Right-click empty rail space again.
6. Confirm `Add View` lists templates not already installed.
7. Add a template not currently installed in that workspace.
8. Confirm `ai/<machine>/Views/<template-id>/` was created from the template.
9. Confirm `ai/<machine>/System/workspace/views.json` has a new enabled entry.
10. Confirm no legacy `ai/<machine>/Views/index.json` edit occurred.

If manual smoke changes a real workspace, report the exact workspace and final state. Prefer using the UI to restore/hide back to the prior state if safe. Do not revert unrelated changes.

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files intentionally changed.
- Message contract implemented.
- How hidden views are discovered.
- How available templates are filtered.
- How restore updates the registry.
- How add copies templates and appends registry entries.
- How duplicate installed views are prevented.
- Whether disabled entries remain in `views.json`.
- Acceptance check results.
- Build/test results.
- Manual smoke results, or why smoke was not run.
- Any files touched outside declared scope, with reason.

## Expected Outcome

Right-clicking empty left-nav space lets users restore hidden installed views and add new manifest-backed views to the active workspace, with all live state persisted through `ai/<machine>/System/workspace/views.json` and no folder deletion or legacy registry writes.
