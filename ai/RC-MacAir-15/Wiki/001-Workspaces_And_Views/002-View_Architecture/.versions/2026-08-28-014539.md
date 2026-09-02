---
name: View Architecture
description: Explains how Fusion Studio views are discovered, mounted, and connected to workspace content roots, including the current folder-first wiki behavior.
metadata:
  incoming-edges:
    - Workspaces And Views
    - Workspace Paradigm
  outgoing-edges:
    - Wiki View
    - Browser Views
    - Chat System Overview
    - Viewer Search
    - View Activity And Collections
    - Office Viewer
  source-files:
    - fusion-studio-client/src/components/wiki/WikiExplorer.tsx
    - fusion-studio-client/src/state/wikiStore.ts
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-server/lib/views/panel-paths.js
    - fusion-studio-server/lib/file-explorer.js
    - fusion-studio-server/lib/http/panel-file-route.js
    - fusion-studio-server/lib/ws/client-message-router.js
    - fusion-studio-client/src/hooks/useViewerSearchIndex.ts
    - fusion-studio-client/src/components/capture/useCaptureViewerSearch.ts
    - fusion-studio-client/src/components/office/useOfficeViewerSearch.ts
    - fusion-studio-client/src/components/office/OfficeGrid.tsx
    - fusion-studio-client/src/components/office/OfficeDocumentPage.tsx
    - fusion-studio-client/src/components/office/officeTableGeometry.ts
    - fusion-studio-client/src/lib/viewActivity.ts
    - fusion-studio-client/src/lib/viewCollections.ts
    - fusion-studio-client/src/hooks/useFileTileMenu.ts
  connected-skills: []
  related-trigger-files: []
---

Use this page for the current view loading model and the distinction between view identity, view content roots, and rendered UI.

## Current Model

Fusion Studio views are not all one kind of surface. Built-in product views are React-backed renderer components. Iframes are reserved for custom user-created views, local embedded apps, and browser-style surfaces. Do not infer a built-in React-to-iframe migration unless current code and product direction both say so.

At runtime, a view has a durable view id, a numbered capsule root, and a resolved content root. The server resolves folder trees and file content through the V2 view resolver; it no longer treats unnumbered `ai/views/<id>/` folders or `ai/system/workspace/views.json` as the active view registry.

## View Capsules

Machine-scoped view folders under `ai/<machine>/Views/NNN-view-id/` are active view capsules. The numeric prefix controls display order. The folder owns view-local metadata, display state, UI state, styles, scripts, and future view-specific extensions.

Hide/show state belongs in the capsule state file at `state/state.json` as `display.hidden`. If a view capsule folder is missing, the view is absent; the server should not depend on separate system state that points at a deleted view folder.

Content/data lives outside the capsule by default in top-level machine folders such as `Captures`, `Wiki`, `Issues`, `Agents`, and `Office`. The old `Docs` root is retired; document and artifact capture content belongs under `Captures`.

## Sidebar Order, Icons, And State

The left sidebar order is filesystem-driven. View folders must be named `NNN-view-id`, for example `001-doc-viewer` or `004-wiki-viewer`. The server reads the numeric prefix as the view `rank`; the client sorts sidebar entries by that rank. If two folders have the same number, folder-name sort is the fallback. The prefix is not part of the durable view id: `manifest.md` should declare `metadata.view-id`, and that id is what callers use for routing.

Sidebar icon metadata is view-local. A view's icon lives inside its own capsule at `styles/icon.md`, with frontmatter such as:

```yaml
---
metadata:
  icon-name: open_run
---
```

Do not put sidebar icon names in global JSON registries or workspace-level state. The `styles/` folder is the view-local home for icon metadata, layout CSS, optional theme overrides, and layout JSON.

Per-view state is also view-local. Persist view-specific UI state under `state/state.json` inside the view capsule. Workspace defaults may live under `ai/<machine>/System/state/state.json`, but per-view overrides, hidden/display state, activity, collections, and view-specific UI placement belong in the view's `state/` folder.

Each capsule may declare its content root in `content.json`. This is durable routing configuration, not UI state. The default folder-backed viewers use workspace-relative paths with the `${machine}` token:

```json
{
  "version": 1,
  "dataSource": "Wiki",
  "root": {
    "type": "workspace-relative",
    "path": "ai/${machine}/Wiki"
  }
}
```

If a user wants the wiki or another viewer to use a repo-shared folder, they can move that folder and update `content.json`, for example `path: "Wiki"` or `path: "docs/wiki"`.

## View Content Roots

The wiki viewer is the clearest current example:

- The `wiki-viewer` capsule declares its content root in `content.json`.
- By default, that root resolves to `ai/${machine}/Wiki`.
- A user may move the wiki into a repo-shared folder and update `content.json`.
- Navigable wiki pages are folders with `PAGE.md`.
- The client requests the folder tree with `file_tree_request`.
- The client loads selected pages with `file_content_request` for `PAGE.md`.
- Numeric folder prefixes control ordering and are stripped for display labels.

Default V2 folder-backed mappings:

- `doc-viewer` resolves to `ai/${machine}/Captures`.
- `wiki-viewer` resolves to `ai/${machine}/Wiki`.
- `issues-viewer` resolves to `ai/${machine}/Issues`.
- `agents-viewer` resolves to `ai/${machine}/Agents`.
- `office-viewer` resolves to `ai/${machine}/Office`.
- `file-viewer` resolves to the project root or current session root.

`doc-viewer` uses the `Captures` data source. The old `Docs` root is retired. Capture folders are ordered by filesystem prefix, for example `001-Captures`, `002-SPECs`, and `003-ToDo`. Its normal root tree hides `999-Archive`; Archive mode directly lists `999-Archive` when the user selects it.

`office-viewer` uses the `Office` data source. It supports loose files at root, folders, nested folders, and loose files inside folders. Its normal root tree hides `999-Archive`; Archive mode directly lists `999-Archive` when the user selects it. Office uses a full-time left sidebar with Home, Recent, Starred, Pinned Folders, and Archive. See [Office Viewer](../../009-Fusion_Home/001-Office_Viewer/PAGE.md) for Office document editing, thumbnails, paper brightness, and table geometry.

Other views may still resolve through SQLite, selected-folder bindings, project-root browsing, or view-specific configuration. Do not generalize one view's content contract to every view without checking `fusion-studio-server/lib/views/index.js` and the renderer for that view.

## Folder-First Wiki

The current wiki source of truth is the filesystem tree under the resolved wiki content root. The default is `ai/${machine}/Wiki/`. JSON indexes are not the source of truth for wiki navigation.

This replaced the older generated/mirrored `content/` model and the stale idea that every workspace must load a root `index.json` for all content. Some app views still use `index.json` for view identity or templates, but the wiki itself discovers folders and `PAGE.md` files.

## Server Resolution Boundaries

View identity is loaded from the numbered V2 capsule folder. `manifest.md`, `content.json`, `styles/icon.md`, and `styles/layout.json` are the durable files that describe the view. `content.json` supports explicit root declarations such as `workspace-relative`, `machine-relative`, `view-relative`, `project-root`, `selected-folder`, `absolute`, `sqlite`, and `none`; relative declarations are path-checked so they cannot escape their allowed root.

The file explorer exposes compatibility aliases for client metadata reads:

- `__workspace__/views.json` is virtual V2 metadata generated from `ai/<machine>/Views/NNN-view-id/` folders.
- `__panels__/<view-id>/index.json`, `content.json`, `styles/layout.json`, `styles/icon.md`, `styles/layout.css`, and other existing capsule files resolve through the numbered V2 folder.
- Missing `__panels__/<view-id>/...` files return not found once the V2 view id is recognized; only workspaces with no V2 `ai/<machine>/Views/` root use the legacy `ai/views/<view-id>/` compatibility fallback.
- `__settings__` resolves to `ai/<machine>/System/styles` for workspace-level style files.

HTTP panel-file routes use the same resolved panel path as the WebSocket file tree/content handlers. They serve content roots, not raw view capsule folders, unless a view explicitly declares a view-relative content root.

## Progressive Disclosure In Views

Views should load the shallowest useful data first, then load deeper content when the user selects it.

- A sidebar can load a tree or summary.
- A selected page can load its `PAGE.md` body.
- Relationship metadata can render after page content is loaded.
- Expensive or external data should be fetched on demand, not preloaded for every view.

## Capture And Office Shared Behavior

Capture and Office are both folder-backed React views. They share file tree/content loading, local search mechanics, context-menu composition, archive handling, recents, and starred state where the product behavior overlaps.

The shared file tile menu lives in `useFileTileMenu.ts`. It provides Star/Unstar, Rename, Archive/Restore, and Delete for file tiles. Capture exposes the same menu through right-click and tile ellipsis. Office exposes the same file menu on document cards.

Starred files are persisted in per-view `collections.starred` and render a filled `kid_star` glyph only when starred. Office can also persist pinned folders in `collections.pinnedFolders`; Capture does not expose folder pinning.

Recents, wiki navigation, and File Explorer tabs use the shared activity model in `viewActivity.ts`. See [View Activity And Collections](../013-View_Activity_And_Collections/PAGE.md).

## Viewer Search

Folder-backed React views use local viewer search over the existing file tree/content cache. Shared indexing, loading, and ranking live in `useViewerSearchIndex.ts`; per-view adapters declare scope and exclusions.

Capture and Office search include `999-Archive`. Office search is global across the Office root and Archive; it is not scoped to the currently open folder. Office surfaces matching folders before matching files.

Use [Viewer Search](../012-Viewer_Search/PAGE.md) for search behavior and extension rules.

## Workspace Index Lessons

The older `Workspace_Index` page captured a good goal: use a consistent data-loading pattern so every workspace does not invent a bespoke client flow. Its specific claim is stale for the wiki, because the current wiki intentionally uses folder-first discovery.

Keep the lesson, not the outdated rule: each view should have one clear loading contract, owned by the server/view boundary, with business logic kept out of ad hoc client parsing where possible.

## Related Pages

- [Workspace Paradigm](../001-Workspace_Paradigm/PAGE.md) - ownership and activation rules.
- [Wiki View](../004-Wiki_View/000-Wiki_View/PAGE.md) - wiki-specific interface and system docs.
- [Browser](../005-Browser/PAGE.md) - internet-capable browsing behavior.
- [Custom Iframe](../006-Custom_Iframe/PAGE.md) - local custom view iframe behavior.
- [Viewer Search](../012-Viewer_Search/PAGE.md) - local search behavior for folder-backed React views.
- [View Activity And Collections](../013-View_Activity_And_Collections/PAGE.md) - recents, navigation, tabs, stars, and pinned folders.
- [Office Viewer](../../009-Fusion_Home/001-Office_Viewer/PAGE.md) - Office-specific filesystem, editor, thumbnail, and table behavior (now in the Fusion Home templated workspace).
