# Roadmap: Universal Wiki Folder Contract

## Purpose

This roadmap captures the current decision state for fixing the workspace wiki system before implementation. It is intended to survive context compaction and to be usable as a handoff document for another session.

The immediate goal is no longer just terminal wiki access. The first goal is to standardize the wiki filesystem contract and remove duplicate/legacy wiki behavior so all workspaces use identical logic.

Terminal access remains a later slice once the universal folder contract is active.

## Product Decision

All workspaces must use the same wiki behavior.

Shipped/default workspaces:
- `Fusion Home`
- `Solobooks`
- `Media Studio`
- `System Source Files`
- future user-created workspaces

Internal/dev-only workspace:
- `fs-dev`

`fs-dev` is the source repo for the code that will be wrapped in Electron and shipped. Its wiki is internal and should not ship as default user content, but it should still follow the same wiki contract so development dogfoods the shipped behavior.

`System Source Files` is a shippable reference workspace. It is the thin guide for how to modify system features and system behavior. It should not be a full dev wiki.

## Canonical Wiki Contract

The code should look for a physical `Wiki` folder, not `content`.

Canonical root:

```text
ai/views/wiki-viewer/Wiki/
```

Canonical shape:

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

Meaning:
- `Wiki/PAGE.md` is the top-level Wiki Guide and gets a button at the top of the left column.
- `Wiki/{Section}/PAGE.md` is shown when clicking a section heading in the left column.
- `Wiki/{Section}/{Article}/PAGE.md` is the main center article when selecting an article in the left column.
- `Wiki/{Section}/{Article}/{RightSidebarSection}/PAGE.md` is the right-sidebar section page.
- `Wiki/{Section}/{Article}/{RightSidebarSection}/{Article}/PAGE.md` is a nested right-sidebar article page.

## Display Naming Rules

Display labels are derived from folder/file names.

Rules:
- Copy case exactly.
- `_` becomes a space.
- `-` remains a dash.
- Optional leading numeric sort prefixes are stripped from display labels.

Examples:
- `001-Getting_Started` displays as `Getting Started`.
- `System_Source_Files` displays as `System Source Files`.
- `Text-To-Speech` displays as `Text-To-Speech`.

Recommended ordering convention:

```text
001-Getting_Started/
002-System_Behavior/
010-Advanced_Workflows/
```

Use numeric prefixes instead of JSON indexes for primary ordering. This keeps order visible in Finder, terminal, GitHub, and AI scans, and avoids a second source of truth.

JSON metadata can be added later only for optional metadata such as hidden/draft state, icons, aliases, permissions, or explicit cross-links. It should not be required for primary discovery or ordering.

## Current Legacy Behavior Inventory

This audit was performed before implementation. Do not skip it in follow-up sessions.

Active workspace wiki viewer files:
- `fusion-studio-client/src/components/wiki/WikiExplorer.tsx`
- `fusion-studio-client/src/components/wiki/TopicList.tsx`
- `fusion-studio-client/src/components/wiki/PageViewer.tsx`
- `fusion-studio-client/src/components/wiki/EdgePanel.tsx`
- `fusion-studio-client/src/state/wikiStore.ts`
- `fusion-studio-client/src/lib/resource-path.ts`
- `fusion-studio-server/lib/views/index.js`
- `fusion-studio-server/lib/file-explorer.js`

Legacy assumptions currently hardcoded in the active wiki viewer:
- `content/` as the wiki content root.
- `content/index.json` as the root file.
- `sections`.
- `articles`.
- `groups`.
- `guide`.
- `_Guide.md`.
- `article.guide || ${article.id}_Guide.md`.
- right-sidebar groups synthesized from article `index.json` files.

Specific cleanup targets:
- `fusion-studio-client/src/components/wiki/WikiExplorer.tsx` currently loads `index.json`, parses `sections`, then loads section/article JSON.
- `fusion-studio-client/src/state/wikiStore.ts` models `sections`, `articlesBySection`, `groupsByArticle`, `guideContent`, and `articleContent` around the old structure.
- `fusion-studio-client/src/components/wiki/TopicList.tsx` builds paths from `section.id`, `article.folder`, and `guide`.
- `fusion-studio-client/src/components/wiki/PageViewer.tsx` assumes guide-vs-article markdown with old guide filenames.
- `fusion-studio-client/src/components/wiki/EdgePanel.tsx` assumes grouped right-sidebar articles from JSON.
- `fusion-studio-client/src/lib/resource-path.ts` maps `wiki-viewer` to `ai/views/wiki-viewer/content`.
- `fusion-studio-server/lib/views/index.js` generically resolves every non-file view to `viewRoot/content` if it exists.
- `fusion-studio-server/lib/file-explorer.js` contains wiki-specific fallback synthesis for old `groups` JSON.

Known separate wiki system:
- `fusion-studio-client/src/components/Fusion/FusionOverlay.tsx`
- `fusion-studio-client/src/components/Fusion/WikiDetail.tsx`
- `fusion-studio-server/lib/fusion/ws-handlers.js`
- `fusion-studio-server/lib/fusion/queries.js`
- database table `system_wiki`

This DB-backed Fusion overlay wiki is separate from `wiki-viewer`. Leave it alone unless a future decision explicitly migrates the Fusion system overlay to file-backed wiki pages.

Likely dead/transitional code:
- `fusion-studio-server/lib/views/resolvers/index.js` is a placeholder for an eliminated resolver registry. It appears unused from the audit, but delete it only after a final import search.

## Current Workspace Layout Drift

Observed drift before implementation:
- `fs-dev` and `System Source Files` use `ai/views/wiki-viewer/content/index.json` with `sections`.
- `Fusion Home`, templates, and `Solobooks` use `content/index.json` with `type: "root"` and `children`.
- `Media Studio` / `media-editor` is skeletal and may only have `content.json`.
- `System Source Files` mixes `PAGE.md`, named guide markdown, grouped markdown references, empty folders, and raw JSON rule assets.
- Some resources, such as Text-To-Speech rules, are referenced from `System Source Files/ai/views/wiki-viewer/content/...`; those references need to be updated or intentionally decoupled before deleting old content paths.

## Non-Negotiable Implementation Rules

- Do not migrate content first while the active viewer still expects old JSON contracts.
- Do not add another compatibility layer unless it is explicitly temporary and scheduled for deletion in the same roadmap.
- Do not keep `content` and `Wiki` as equivalent roots long term.
- Do not keep old `sections/articles/groups/guide` concepts in the final active wiki viewer.
- Do not change the DB-backed Fusion overlay wiki unless explicitly scoped.
- Do not touch unrelated dirty worktree changes.

## Vertical Slices

Each slice should be independently reviewable. Each handoff should state files touched, behavior changed, verification commands run, and any remaining legacy references.

### Slice 1: Wiki Root Resolution

Objective:
- Make `wiki-viewer` resolve to `ai/views/wiki-viewer/Wiki` instead of `ai/views/wiki-viewer/content`.

Expected changes:
- Update `fusion-studio-server/lib/views/index.js` so only `wiki-viewer` prefers `Wiki/`.
- Keep generic `content/` behavior for other view types.
- Update `fusion-studio-client/src/lib/resource-path.ts` so copy/send path actions point at `ai/views/wiki-viewer/Wiki`.

Do not:
- Migrate workspace content in this slice.
- Add permanent fallback from `Wiki` to `content` unless explicitly temporary and documented.

Verification:
- Server resolves `wiki-viewer` panel root to `.../ai/views/wiki-viewer/Wiki` when that folder exists.
- Other views still resolve to their existing `content/` roots.
- Copy path buttons for wiki resources produce `.../ai/views/wiki-viewer/Wiki/...`.

### Slice 2: Folder Tree Wiki Data Model

Objective:
- Replace the old `sections/articles/groups/guide` client data model with a folder tree model based on `PAGE.md`.

Expected changes:
- Replace or refactor `fusion-studio-client/src/state/wikiStore.ts`.
- Model root guide, sections, left-column articles, right-sidebar sections, and right-sidebar articles as filesystem nodes.
- Add display-name helper: strip leading numeric prefix, replace `_` with space, preserve dashes and case.

Suggested node fields:
- `id`
- `name`
- `label`
- `path`
- `pagePath`
- `depth`
- `children`

Do not:
- Keep old fields such as `sections`, `articlesBySection`, `groupsByArticle`, `guideContent`, or `_Guide.md` if avoidable.
- Use JSON index files for primary ordering.

Verification:
- Unit-test or manually verify label conversion.
- Store can represent the canonical example tree without old JSON metadata.

### Slice 3: Wiki Viewer Loader Rewrite

Objective:
- Rewrite `WikiExplorer` to discover folders and load `PAGE.md` files using the new model.

Expected changes:
- Use `file_tree_request` to read folder children where needed.
- Use `file_content_request` to load `PAGE.md` for selected nodes.
- `Wiki/PAGE.md` becomes the Wiki Guide button at top of left column.
- Section header clicks load section `PAGE.md`.
- Article clicks load article `PAGE.md`.
- Right-sidebar section/article clicks load their own `PAGE.md`.

Likely touched files:
- `fusion-studio-client/src/components/wiki/WikiExplorer.tsx`
- `fusion-studio-client/src/components/wiki/TopicList.tsx`
- `fusion-studio-client/src/components/wiki/PageViewer.tsx`
- `fusion-studio-client/src/components/wiki/EdgePanel.tsx`

Do not:
- Parse old `index.json` files.
- Synthesize old `groups`.
- Use `_Guide.md`.

Verification:
- A minimal hand-made `Wiki/` tree renders root guide, sections, articles, and right sidebar articles.
- Left column ordering follows numeric prefixes/alphabetical folder sort.
- Display labels follow the naming rules.

### Slice 4: Remove Server Wiki Group Synthesis

Objective:
- Delete old wiki-specific fallback behavior from the generic file explorer.

Expected changes:
- Remove `buildWikiGroups()` from `fusion-studio-server/lib/file-explorer.js` if no longer used.
- Remove special handling for wiki article `index.json` group synthesis.
- Keep generic file tree/content handling intact.

Do not:
- Break file explorer behavior for other panels.
- Remove generic path safety checks.

Verification:
- `file_content_request` still returns files normally.
- `file_tree_request` still returns folders/files normally.
- Missing wiki `index.json` no longer returns synthetic groups.

### Slice 5: Migrate System Source Files Wiki

Objective:
- Convert `System Source Files` into the canonical shippable system-modification reference wiki.

Expected changes:
- Create `System Source Files/ai/views/wiki-viewer/Wiki/PAGE.md`.
- Convert current sections into numbered folder sections.
- Rename `workspaces & views` to a slug-safe/display-safe folder such as `001-Workspaces_&_Views` only if `&` is intentionally supported, otherwise `001-Workspaces_And_Views`.
- Convert named guide files such as `Connectors_Guide.md`, `Code_Standards.md`, and `Text-To-Speech.md` into article-folder `PAGE.md` files.
- Preserve deep reference files under relevant article folders where useful.
- Keep raw JSON rule assets only if they are meant to ship as reference/resources; otherwise move them to a non-wiki resource location and update code references.

Important dependency:
- `fusion-studio-server/lib/resources/resolver.js` currently points Text-To-Speech rules at `System Source Files/ai/views/wiki-viewer/content/system/Text-To-Speech/Rules`. If those rules move, update this resolver and any packaged resource preparation scripts in the same slice or a dedicated resource slice.

Do not:
- Delete old `content/` until all code references are updated and verified.

Verification:
- System Source Files wiki renders in the app using the new viewer.
- No remaining runtime code points at the old System Source wiki `content` path unless intentionally documented as temporary.

### Slice 6: Migrate Default Workspace Wikis And Templates

Objective:
- Convert shipped/default workspace wiki trees to `Wiki/`.

Targets:
- `Fusion-Home/ai/views/wiki-viewer`
- `Fusion-Home/workspace-templates/fusion-home/ai/views/wiki-viewer`
- `Fusion-Home/workspace-templates/project-repo/ai/views/wiki-viewer`
- `Fusion-Home/workspace-templates/media-studio/ai/views/wiki-viewer`
- `solobooks/ai/views/wiki-viewer`
- `media-editor/ai/views/wiki-viewer` or its current Media Studio equivalent

Expected changes:
- Create canonical `Wiki/` trees with `PAGE.md` files.
- Remove reliance on `content/index.json`, `topics.json`, and article `index.json` for primary browsing.
- Keep historical metadata only if deliberately retained as non-primary reference.

Verification:
- Each target workspace renders with the same viewer logic.
- Workspace templates create new workspaces with `Wiki/`, not `content/`.

### Slice 7: Migrate fs-dev Internal Wiki

Objective:
- Convert internal `fs-dev` wiki to the same `Wiki/` contract.

Expected changes:
- Convert `ai/views/wiki-viewer/content` into `ai/views/wiki-viewer/Wiki`.
- Preserve internal dev pages but normalize guide/article structure.
- Update docs that point humans/agents at old internal wiki paths where current and important.

Do not:
- Treat fs-dev wiki as shippable content.
- Block shipped workspace migration on perfect internal documentation migration.

Verification:
- fs-dev wiki renders with the same viewer logic.
- Important internal code standards path has a new canonical location.

### Slice 8: Legacy Path Cleanup

Objective:
- Remove obsolete `content/` wiki assumptions after all active workspaces are migrated.

Expected changes:
- Search and update remaining `ai/views/wiki-viewer/content` references.
- Remove old wiki `content/` folders only when no runtime/package/docs-critical references remain.
- Delete `fusion-studio-server/lib/views/resolvers/index.js` if still unused.
- Update roadmap/docs to point at `Wiki/`.

Verification:
- Content search for `wiki-viewer/content` has only archived/handoff references or no references.
- Build passes.
- Runtime smoke passes.

### Slice 9: Terminal Wiki Access

Objective:
- Add deterministic terminal/tool access to the now-standard wiki tree.

Expected behavior:
- Query current workspace wiki.
- Query all available workspace wikis.
- Return stable machine-readable results with provenance.

Suggested fields:
- `workspaceId`
- `workspacePath`
- `nodePath`
- `pagePath`
- `label`
- `depth`
- `body` optional

Do not:
- Implement terminal access against old JSON structures.
- Return hidden/deep reference docs unless explicitly requested.

Verification:
- Query works for current workspace.
- Query works across all available workspaces.
- Output ordering matches filesystem/numeric prefix rules.

## Open Questions

- Should `&` be allowed in folder names, or should all display text use words like `And` for safer paths?
- Should root `Wiki/PAGE.md` be used as the AI workspace context hydrator immediately, or only after the UI migration is stable?
- Should right-sidebar section folders always require their own `PAGE.md`, or should they be allowed as structural-only folders?
- Where should shippable non-markdown resources live if they are referenced by wiki articles but also loaded by runtime code?
- Should terminal access include full body by default or require `includeBody: true`?

## Current Next Step

Slices 1-8 have moved active wiki resolution, viewer loading, migrated workspace trees, and current path instructions to the canonical `Wiki/PAGE.md` contract. The next implementation slice is Slice 9: terminal/tool access against the folder-tree wiki model.

Recommended next handoff:

```text
Implement Slice 9 only: add deterministic terminal/tool access to workspace wiki pages under ai/views/wiki-viewer/Wiki. Do not read old content/index.json, topics.json, sections/articles/groups metadata, or _Guide.md files. Report exact files touched and verification results.
```
