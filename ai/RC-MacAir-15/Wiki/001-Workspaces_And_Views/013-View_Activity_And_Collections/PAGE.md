---
name: View Activity And Collections
description: Documents shared per-view state for recents, navigation, tabs, starred files, and pinned folders.
metadata:
  incoming-edges:
    - Workspaces And Views
    - View Architecture
    - Themes and State
    - State Management Standards
  outgoing-edges:
    - View Architecture
    - Viewer Search
    - Themes and State
  source-files:
    - fusion-studio-client/src/lib/viewActivity.ts
    - fusion-studio-client/src/lib/viewCollections.ts
    - fusion-studio-client/src/state/slices/viewSlice.ts
    - fusion-studio-client/src/hooks/useFileTileMenu.ts
    - fusion-studio-client/src/state/fileStore.ts
    - fusion-studio-client/src/state/wikiStore.ts
    - fusion-studio-server/lib/view-state/defaults.js
    - fusion-studio-server/lib/view-state/writer.js
  connected-skills: []
  related-trigger-files: []
---

Use this page for persisted per-view activity and saved-item collections. This is the shared model behind Recents, wiki back/forward navigation, File Explorer tab persistence, starred files, and Office pinned folders.

## Storage Model

Per-view activity and collections live in the view capsule state file:

```text
ai/<machine>/Views/<view-folder>/state/state.json
```

The client writes minimal `state:set` patches through `usePanelStore._persistViewPatch`. The server state writer treats `activity`, `collections`, and `officeDocumentSidePanel` as forced view-override keys so they stay view-local instead of being folded into workspace defaults.

The persisted shape has two shared branches:

- `activity`: recents, navigation stack, open tabs, and active tab id.
- `collections`: starred items and pinned folders.

Use `activityId(panel, path)` as the stable item id. Do not create another id format for starred, pinned, recent, or tab entries.

## Activity

`viewActivity.ts` owns activity normalization and mutation.

- `recordViewRecent(view, item)` appends or re-ranks an item in `activity.recents`.
- `pushViewNavigation(view, item)` adds a navigation entry, trims anything ahead of the current index, and also records the item as recent.
- `setViewNavigationIndex(view, index)` moves back or forward without adding a new entry.
- `replaceViewTabs(view, tabs, activeTabId)` persists ordered tabs and the active tab.

Recents are pruned to the latest 100 items and to items opened within the last 365 days. The UI groups them as:

- Today
- Yesterday
- Earlier This Week
- Earlier This Month
- Last Month
- Month name and year

Empty groups are not rendered.

## Current Consumers

Capture records document opens in `doc-viewer` activity and renders the Recents mode from `activity.recents`.

Office records document opens in `office-viewer` activity and renders the Recents sidebar/page from the same grouping helper. Opening a document also keeps the Office document side drawer state in `officeDocumentSidePanel`, so the drawer remains open or closed when another document opens.

Wiki uses `pushViewNavigation` for page/link navigation. Back and forward move the persisted navigation index. Clicking a new link after going back truncates entries ahead of the index before adding the new top entry.

File Explorer persists open tabs with `replaceViewTabs`. File tab entries include `tabIndex`, and the active tab id is stored in the same activity branch.

## Collections

`viewCollections.ts` owns saved collections.

- `toggleViewStarred(view, item)` adds/removes a starred file.
- `toggleViewPinnedFolder(view, item)` adds/removes a pinned Office folder.
- `removeViewPathReferences(reference)` removes matching activity and collection entries after delete.
- `rewriteViewPathReferences(reference)` updates matching activity and collection entries after rename, archive, restore, or move.

Starred files are shared by Capture and Office. Both use the shared file menu from `useFileTileMenu.ts`, which provides Star/Unstar, Rename, Archive/Restore, and Delete. Starred items render the `kid_star` Material Symbol only when starred; unstarred files do not reserve empty icon space.

Pinned folders are Office-only today. The Office sidebar shows a non-clickable `Pinned Folders` section; individual pinned folders under it are clickable. Capture does not expose folder pinning.

## Archive Interaction

Archive is a filesystem folder named `999-Archive` for Capture and Office. Normal listings hide it; Archive mode lists it directly. Search includes Archive content.

When a file is archived, restored, renamed, or deleted, the same path-reference helpers update or remove recents and starred entries. Do not implement separate cleanup code in each view.

## Extension Rule

When another view needs recents, back/forward, tabs, stars, or pins:

1. Use `viewActivity.ts` and `viewCollections.ts`.
2. Persist with `state:set` patches, not new JSON files or SQLite tables.
3. Keep durable item paths as panel-relative paths.
4. Use `removeViewPathReferences` and `rewriteViewPathReferences` when filesystem actions mutate paths.
5. Render view-specific chrome in the view, but keep activity and collection mutation in the shared helpers.

## Related Pages

- [View Architecture](../002-View_Architecture/PAGE.md) - view capsules, content roots, and view state boundaries.
- [Viewer Search](../012-Viewer_Search/PAGE.md) - shared local search for Capture and Office.
- [Themes And State](../../005-Enforcement/002-Themes_And_State/PAGE.md) - filesystem state and style boundaries.
