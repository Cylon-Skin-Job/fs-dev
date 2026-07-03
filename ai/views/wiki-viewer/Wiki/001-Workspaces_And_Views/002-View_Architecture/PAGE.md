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
  source-files:
    - fusion-studio-client/src/components/wiki/WikiExplorer.tsx
    - fusion-studio-client/src/state/wikiStore.ts
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-server/lib/ws/client-message-router.js
  connected-skills: []
  related-trigger-files: []
---

Use this page for the current view loading model and the distinction between view identity, view content roots, and rendered UI.

## Current Model

Fusion Studio views are not all one kind of surface. Some are still React-backed app views; others are moving toward self-contained iframe/custom-protocol views. Check the active loader before assuming a view is React-only or iframe-only.

At runtime, a view has an identity and a filesystem root. The server resolves the content root for file and wiki requests, and the renderer asks for either folder trees or page content through WebSocket messages.

## View Content Roots

The wiki viewer is the clearest current example:

- The `wiki-viewer` view resolves to `viewRoot/Wiki` when a `Wiki/` folder exists.
- Navigable wiki pages are folders with `PAGE.md`.
- The client requests the folder tree with `file_tree_request`.
- The client loads selected pages with `file_content_request` for `PAGE.md`.
- Numeric folder prefixes control ordering and are stripped for display labels.

Other views may still resolve through `content/` folders or view-specific configuration. Do not generalize the wiki contract to every view without checking `fusion-studio-server/lib/views/index.js` and the renderer for that view.

## Folder-First Wiki

The current wiki source of truth is the filesystem tree under `ai/views/wiki-viewer/Wiki/`. JSON indexes are not the source of truth for wiki navigation.

This replaced the older generated/mirrored `content/` model and the stale idea that every workspace must load a root `index.json` for all content. Some app views still use `index.json` for view identity or templates, but the wiki itself discovers folders and `PAGE.md` files.

## Progressive Disclosure In Views

Views should load the shallowest useful data first, then load deeper content when the user selects it.

- A sidebar can load a tree or summary.
- A selected page can load its `PAGE.md` body.
- Relationship metadata can render after page content is loaded.
- Expensive or external data should be fetched on demand, not preloaded for every view.

## Workspace Index Lessons

The older `Workspace_Index` page captured a good goal: use a consistent data-loading pattern so every workspace does not invent a bespoke client flow. Its specific claim is stale for the wiki, because the current wiki intentionally uses folder-first discovery.

Keep the lesson, not the outdated rule: each view should have one clear loading contract, owned by the server/view boundary, with business logic kept out of ad hoc client parsing where possible.

## Related Pages

- [Workspace Paradigm](../001-Workspace_Paradigm/PAGE.md) - ownership and activation rules.
- [Wiki View](../004-Wiki_View/000-Wiki_View/PAGE.md) - wiki-specific interface and system docs.
- [Browser](../005-Browser/PAGE.md) - internet-capable browsing behavior.
- [Custom Iframe](../006-Custom_Iframe/PAGE.md) - local custom view iframe behavior.
