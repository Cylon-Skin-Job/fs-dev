# Wiki Contract Slice 2: Folder Tree Data Model

## Objective

Replace the old client wiki state model with a folder-tree model based on the new canonical wiki contract:

```text
ai/<machine>/Wiki/
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

This slice prepares state/types/helpers for the viewer rewrite. It should not migrate workspace content and should not rewrite all rendering behavior yet unless doing so is unavoidable for type correctness.

## Source Roadmap

Read first:

- `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-1-root-resolution.md`

Slice 1 should already be implemented:
- `wiki-viewer` resolves to `ai/<machine>/Wiki` when `Wiki/` exists.
- Client copy paths for `wiki-viewer` point at `ai/<machine>/Wiki`.

## Files To Inspect First

- `fusion-studio-client/src/state/wikiStore.ts`
- `fusion-studio-client/src/components/wiki/WikiExplorer.tsx`
- `fusion-studio-client/src/components/wiki/TopicList.tsx`
- `fusion-studio-client/src/components/wiki/PageViewer.tsx`
- `fusion-studio-client/src/components/wiki/EdgePanel.tsx`
- `fusion-studio-client/src/hooks/usePanelData.ts`

## Current Legacy Model To Replace

`fusion-studio-client/src/state/wikiStore.ts` currently models the old JSON/index contract:

- `sections`
- `articlesBySection`
- `groupsByArticle`
- `activeSection`
- `activeArticle`
- `activeArticleFile`
- `showGuide`
- `guideContent`
- `articleContent`
- `setIndex(sections, articlesBySection)`
- `setArticleGroups(articleId, groups)`
- guide file assumptions like `_Guide.md`

These terms should not remain as the final model. If a temporary bridge is needed so the app compiles before Slice 3, mark it clearly with a deletion note.

## Target State Model

Create a state model that represents filesystem nodes, not JSON sections/articles/groups.

Suggested TypeScript shape:

```ts
export type WikiNodeKind =
  | 'root'
  | 'section'
  | 'article'
  | 'sidebar-section'
  | 'sidebar-article';

export interface WikiNode {
  id: string;
  name: string;
  label: string;
  path: string;
  pagePath: string;
  kind: WikiNodeKind;
  depth: number;
  children: WikiNode[];
}
```

Recommended state fields:

```ts
root: WikiNode | null;
selectedPath: string;
selectedPagePath: string;
selectedContent: string;
loading: boolean;
error: string | null;
history: string[];
historyIndex: number;
```

Recommended actions:

```ts
setRoot(root: WikiNode | null): void;
selectNode(node: WikiNode): void;
setSelectedContent(content: string): void;
setLoading(loading: boolean): void;
setError(error: string | null): void;
goBack(): void;
goForward(): void;
activateWorkspace(workspaceId: string | null): void;
reset(): void;
```

Exact names can differ if the implementation is cleaner, but the final model should be tree/node based.

## Display Name Helper

Add a helper for converting folder names to labels.

Rules:
- Strip leading numeric sort prefix matching `^\d{3,}-`.
- Replace `_` with a space.
- Preserve `-` as a dash.
- Preserve case exactly.

Examples:

```text
001-Getting_Started -> Getting Started
System_Source_Files -> System Source Files
Text-To-Speech -> Text-To-Speech
```

Add this helper in the smallest appropriate place. Prefer keeping it in `wikiStore.ts` for this slice unless reuse clearly justifies a separate file.

## Tree Semantics

The model should support these mappings:

- `Wiki/PAGE.md` is the root guide node.
- Direct child folders of `Wiki/` are left-column section nodes.
- Direct child folders of a section are left-column article nodes.
- Direct child folders of an article are right-sidebar section nodes.
- Direct child folders of a right-sidebar section are right-sidebar article nodes.

Every node’s readable page is its own `PAGE.md`:

```text
node.pagePath = `${node.path}/PAGE.md`
```

For the root node:

```text
path = ''
pagePath = 'PAGE.md'
```

## Explicit Non-Goals

- Do not migrate workspace wiki content.
- Do not parse or depend on `index.json`, `topics.json`, `sections`, `articles`, `groups`, `guide`, or `_Guide.md`.
- Do not remove server wiki group synthesis; that is Slice 4.
- Do not rewrite server path resolution; that was Slice 1.
- Do not change DB-backed Fusion overlay wiki behavior.
- Do not create a permanent compatibility layer for the old wiki contract.

## Compatibility Boundary

The existing wiki components may fail or need small temporary adjustments after the store shape changes. Prefer one of these approaches:

1. Keep Slice 2 focused on adding the new model while preserving old exports only as a temporary bridge with explicit TODO comments.
2. Update components only enough to compile, then leave behavior rewrite to Slice 3.

Do not do a partial old/new hybrid without documenting exactly what remains for Slice 3.

## Verification Steps

Run after changes:

1. Type/build check:

```bash
cd fusion-studio-client
npm run build
```

2. Search for old active model terms in wiki state:

```bash
grep -n "sections\|articlesBySection\|groupsByArticle\|_Guide\|guideContent\|articleContent" fusion-studio-client/src/state/wikiStore.ts
```

Expected:
- No matches, or only explicitly marked temporary bridge comments for Slice 3.

3. Confirm display helper behavior manually or with a small test if test infrastructure is already present.

Expected conversions:
- `001-Getting_Started` -> `Getting Started`
- `System_Source_Files` -> `System Source Files`
- `Text-To-Speech` -> `Text-To-Speech`

## Report Back Format

When done, report:

- Files changed.
- New state/types/actions introduced.
- Any old state fields temporarily retained and why.
- Verification commands run and results.
- Any blockers for Slice 3.

## Success Criteria

- `wikiStore` is organized around `WikiNode`-style filesystem nodes.
- Display label conversion follows the agreed rules.
- The client build passes, or any build failure is documented with the exact next component rewrite required by Slice 3.
- No content migration occurred.
- No old JSON index model was made more permanent.
