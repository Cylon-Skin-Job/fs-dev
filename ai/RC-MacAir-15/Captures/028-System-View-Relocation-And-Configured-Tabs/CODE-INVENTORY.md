# Code Inventory

**Survey baseline:** branch `agent/exact-workspace-paths`, commit `7f0d3c8`,
2026-09-07. The receiving orchestrator must repeat the inventory before edits.

## VIEW-01 active owners

| Area | Current owner / seam | Required treatment |
|---|---|---|
| Machine paths | `fusion-studio-server/lib/workspace/ai-paths.js` | Make `getMachineViewsRoot` canonical for `System/Views`; add a migration-only legacy resolver |
| Discovery/config/content roots | `fusion-studio-server/lib/views/index.js` | Consume canonical resolver; validate immutable IDs; expose parsed tab config in panel config |
| View add/reorder/hide/restore | `fusion-studio-server/lib/views/workspace-registry-writer.js` | Resolve only canonical root after readiness; preserve public messages |
| View state | `fusion-studio-server/lib/view-state/{resolver,writer,defaults,index}.js` | Use canonical root and the shared migration/readiness coordinator |
| CLI display overrides | `fusion-studio-server/lib/cli-config/loader.js` | Resolve canonical view folder; no fallback to retired tree |
| Pseudo-panel/file routing | `fusion-studio-server/lib/views/panel-paths.js` and file mutation handlers | Keep reads; deny generic writes to canonical and retired namespaces, including aliases |
| Workspace creation | `fusion-studio-server/lib/workspace/create-service.js` | Copy selected templates into `System/Views` |
| Workspace bootstrap/attach | startup/controller and connection-init paths discovered at preflight | Complete/recover migration before `panel_config` and view registry publication |
| Custom/local app protocol | `fusion-studio-client/electron/protocol-handler.cjs`, authorized workspace IPC, `ContentArea.tsx` | Replace unscoped `ai/views/<id>` lookup with a readiness-verified canonical capsule mapping; retain traversal/origin controls |
| Durable migration | `fusion-studio-server/lib/db/migrations/` plus a focused service | One journal row per workspace/machine cutover |
| Trusted shell | accepted connection role and guard from Chat SPEC-00 | Reuse connection-owned role; do not trust request fields |

## Repository content and documentation surfaces

- Live development capsules: `ai/RC-MacAir-15/Views/*`.
- Canonical template sources:
  `System_Manager/ai-template/templates/view-templates/*`.
- Workspace template destination logic:
  `System_Manager/ai-template/templates/` and workspace create tests.
- Active client path comments:
  `fusion-studio-client/src/lib/panels.ts`, shared-style hooks/types, theme help.
- Electron custom-view path owner and tests:
  `fusion-studio-client/electron/protocol-handler.cjs`, `main.cjs`, authorized
  preload IPC, navigation policy, and a canonical custom-app protocol fixture.
- Active Wiki/template documentation under `System_Manager/ai-template/Wiki/`
  and the current machine Wiki must describe `System/Views` after acceptance.
- Historical migrations, archived reports, and old snapshots may retain old
  paths when clearly historical; the implementation report lists exclusions.

## Generic mutation families to enumerate before VIEW-01

The builder records exact entry points and tests for:

- save/write and create file/folder;
- rename and move, with both source and destination checked;
- copy, with both source and destination checked;
- delete;
- upload, archive extraction, and generated-file destinations;
- pseudo-panel aliases such as `__panels__`;
- symlink-resolved, hard-link identity, traversal, encoded, and non-existing
  destination cases.

Absence of a named family must be proven by search and recorded; it must not be
silently omitted from the security acceptance matrix.

## VIEW-02 active owners

| Area | Current owner / seam | Required treatment |
|---|---|---|
| Server config parser | `fusion-studio-server/lib/views/index.js` | Strict optional `tabs` parser; bounded product-safe failure |
| Renderer panel config types | `fusion-studio-client/src/lib/ws-client.ts`, `src/types/`, panel store | Carry validated data; no renderer reinterpretation of raw JSON |
| Shell host | `src/components/view-tabs/ViewTabBar.tsx` | Consume connected adapter; remain store-free and prop-driven |
| Generic lifecycle | `componentTabLifecycle.ts`, `ComponentTabPanel.tsx`, `EmptyTabPanel.tsx` | Reuse; do not fork Empty reservation behavior |
| Universal chrome | `ComponentTabShellPanel.tsx`, presentation domain, location rail | Reuse v2 projection; omission is pure display projection |
| Placement | `componentTabPlacement*`, exported by `componentTabDomain.ts` | Reuse `createConnectedTabPlacementController`; do not modify semantics |
| Adapter registry | `viewTabAdapters.ts` | Split view-specific owners before the file exceeds standards; no giant switch growth |
| Capture state | `captureTabsController.ts`, `captureTabDomain.ts`, panel store state | Adapt existing owner and acknowledged `state:set` persistence |
| File state | `state/fileStore.ts`, `fileDataStore.ts`, File Explorer drawer | Adapt current owner; retain content/data lifecycles and activity persistence |
| Content routing | `components/ContentArea.tsx` | Opt in only validated configured adopters; legacy views remain intact |

## Expected tests

Server-focused additions should live beside existing workspace/view/file route
tests and include migration journal fixtures, crash injection, protection
aliases, workspace creation, config validation, and restart/readback.

Client-focused additions should extend the existing component-tab and
file-viewer Playwright suites and add Capture adoption tests. Test helpers may
be split by domain to keep source files reviewable; focused regression scripts
that encode permanent public behavior remain maintained tests rather than
throwaway orchestration artifacts.

## Dirty-worktree rule

The preflight records current dirty paths. Existing user state, theme, capture,
Provenance, or unrelated Markdown changes are preserved. The implementation
does not normalize, regenerate, or revert them merely because live capsules are
relocated.
