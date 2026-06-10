# Wiki Contract Slice 3: Viewer Loader Rewrite

## Objective

Make the active `wiki-viewer` discover the canonical `Wiki/` folder tree and load each selected node's `PAGE.md`.

This slice turns the Slice 2 data model into working UI behavior.

## Source Roadmap

Read first:

- `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-1-root-resolution.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-2-folder-tree-data-model.md`

Expected prior state:
- `wiki-viewer` resolves to `ai/views/wiki-viewer/Wiki` when `Wiki/` exists.
- `wikiStore` exposes `WikiNode`, `root`, `selectedPath`, `selectedPagePath`, `selectedContent`, and tree-based actions.
- Old store fields such as `sections`, `articlesBySection`, `groupsByArticle`, `guideContent`, and `articleContent` are gone.

## Canonical Wiki Contract

```text
Wiki/
├── PAGE.md
└── 001-Section_Name_Folder/
    ├── PAGE.md
    └── 001-Article_Name_Folder/
        ├── PAGE.md
        └── 001-Right_Sidebar_Section_Folder/
            ├── PAGE.md
            └── 001-Article_Folder/
                └── PAGE.md
```

UI mapping:
- `Wiki/PAGE.md` is the `Wiki Guide` button at the top of the left column.
- Direct child folders of `Wiki/` are left-column section headings.
- Section heading clicks load that section folder's `PAGE.md`.
- Direct child folders of a section are left-column articles.
- Article clicks load that article folder's `PAGE.md`.
- Direct child folders of an article are right-sidebar sections.
- Direct child folders of a right-sidebar section are right-sidebar articles.
- Right-sidebar clicks load the clicked node's `PAGE.md`.

## Files To Inspect First

- `fusion-studio-client/src/components/wiki/WikiExplorer.tsx`
- `fusion-studio-client/src/components/wiki/TopicList.tsx`
- `fusion-studio-client/src/components/wiki/PageViewer.tsx`
- `fusion-studio-client/src/components/wiki/EdgePanel.tsx`
- `fusion-studio-client/src/state/wikiStore.ts`
- `fusion-studio-client/src/hooks/usePanelData.ts`
- `fusion-studio-server/lib/file-explorer.js`

## Important Discovery Constraint

`usePanelData.ts` currently handles only `file_content_response` messages. It does not listen for `file_tree_response`.

Slice 3 must add a clean way for the wiki viewer to request and consume folder listings. Acceptable approaches:
- Add a small wiki-specific tree loader inside `WikiExplorer`.
- Add a generic hook for panel tree requests if it stays small and reusable.
- Extend `usePanelData` only if doing so does not make it confusing or overbroad.

Do not use old `index.json`, `topics.json`, `sections`, `articles`, or `groups` as the discovery mechanism.

## Tree Loading Behavior

Recommended implementation:

1. Request the root folder tree with `file_tree_request` path `""` for panel `wiki-viewer`.
2. Build a `WikiNode` tree from returned folder nodes.
3. Recursively or breadth-first request folder trees down to the supported UI depth.
4. Ignore files except for `PAGE.md` existence checks if needed.
5. Sort folders by raw filesystem name; numeric prefixes provide order.
6. Use `createWikiNode()` and `wikiFolderNameToLabel()` from `wikiStore.ts`.

Supported depth for this slice:
- depth 0: root `Wiki` node
- depth 1: sections
- depth 2: left-column articles
- depth 3: right-sidebar sections
- depth 4: right-sidebar articles

It is acceptable to ignore deeper folders for primary navigation in this slice.

## Page Loading Behavior

Use `file_content_request` to load the selected node's `pagePath`.

Expected paths relative to the resolved `Wiki/` root:
- Root guide: `PAGE.md`
- Section: `001-Section_Name_Folder/PAGE.md`
- Article: `001-Section_Name_Folder/001-Article_Name_Folder/PAGE.md`
- Right-sidebar section: `001-Section_Name_Folder/001-Article_Name_Folder/001-Right_Sidebar_Section_Folder/PAGE.md`
- Right-sidebar article: `001-Section_Name_Folder/001-Article_Name_Folder/001-Right_Sidebar_Section_Folder/001-Article_Folder/PAGE.md`

Missing `PAGE.md` policy:
- Prefer showing a clear missing-page error for the selected node.
- Do not synthesize content.
- Do not fall back to old guide files.

## UI Behavior Requirements

Left column:
- Shows `Wiki Guide` at the top.
- Shows section headings from root children.
- Shows section article children under each section.
- Clicking a section heading selects the section node.
- Clicking an article selects the article node.

Center:
- Renders `selectedContent` as markdown.
- Header/copy/send path uses `selectedPagePath`.
- Back/forward continues to work through selected node paths.

Right column:
- Shows selected node's child nodes.
- For an article, this means right-sidebar sections.
- For a right-sidebar section, this means right-sidebar articles.
- For nodes with no loaded children, show a neutral empty state.

## Explicit Non-Goals

- Do not migrate workspace wiki content.
- Do not remove server group synthesis yet; that is Slice 4.
- Do not parse old JSON indexes.
- Do not revive old store fields.
- Do not alter DB-backed Fusion overlay wiki behavior.
- Do not implement terminal access.

## Temporary Test Fixture Guidance

Because most workspaces may not yet have `Wiki/` trees, create the smallest fixture needed only if necessary for manual verification.

If creating a temporary fixture inside the repo, make it intentional and report it clearly. Prefer using an existing active workspace path only if it will be migrated soon.

Minimal fixture:

```text
ai/views/wiki-viewer/Wiki/
├── PAGE.md
└── 001-Test_Section/
    ├── PAGE.md
    └── 001-Test_Article/
        ├── PAGE.md
        └── 001-Test_Sidebar/
            ├── PAGE.md
            └── 001-Test_Nested/
                └── PAGE.md
```

Do not delete or overwrite existing user/worker content.

## Verification Steps

1. Build the client:

```bash
cd fusion-studio-client
npm run build
```

2. Search active wiki UI/store files for old model terms:

```bash
grep -R "sections\|articlesBySection\|groupsByArticle\|_Guide\|guideContent\|articleContent\|setIndex\|setArticleGroups" fusion-studio-client/src/components/wiki fusion-studio-client/src/state/wikiStore.ts
```

Expected:
- No active old-model usage.

3. Manual runtime smoke:

- Start/restart the app using the project standard flow.
- Open a workspace with a `Wiki/` fixture.
- Open the Wiki view.
- Confirm root guide loads.
- Confirm section click loads section `PAGE.md`.
- Confirm article click loads article `PAGE.md`.
- Confirm right-sidebar section/article clicks load their own `PAGE.md`.
- Confirm copy/send path buttons point under `ai/views/wiki-viewer/Wiki`.

4. Confirm no old JSON discovery:

- Temporarily remove or ignore `content/index.json` in the fixture path if present.
- Wiki navigation should still be based on folders.

## Report Back Format

When done, report:

- Files changed.
- How folder tree requests are implemented.
- Supported tree depth.
- Missing `PAGE.md` behavior.
- Verification commands run and results.
- Whether any fixture was created.
- Any blockers for Slice 4.

## Success Criteria

- The wiki viewer builds its navigation from folders under `Wiki/`.
- Selecting any supported node loads that node's `PAGE.md`.
- Left column and right column use the same `WikiNode` tree.
- No old JSON index/guide/group discovery remains in active client wiki behavior.
- Client build passes.
