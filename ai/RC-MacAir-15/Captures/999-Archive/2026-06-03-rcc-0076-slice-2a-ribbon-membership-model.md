# Worker Handoff: RCC-0076 Slice 2A - Workspace Ribbon Membership Model Foundation

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

The tree is expected to be dirty. Inspect before editing and do not overwrite unrelated changes.

## Required Reading

Read these before editing:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-orchestration-plan.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Also confirm Slice 1 is complete:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected result: no hits. If `rg` is unavailable in your shell, use the available search tooling and report that substitution.

## Goal

Introduce a persisted model that distinguishes registered workspaces from ribbon workspaces without changing visible UI behavior yet.

Definitions:

- Registered workspaces: all workspaces the app knows about in the `workspaces` table.
- Ribbon workspaces: registered workspaces currently shown in the top ribbon, with their own persisted membership and order.

This slice is a foundation only. Existing workspaces should all remain visible in the ribbon after this slice, and the current ribbon/carousel UI should look and behave the same.

## Product Rules To Encode

- Removing a workspace from the ribbon is not the same as deleting/unregistering it.
- A workspace removed from the ribbon must remain registered for future plus-dropdown work.
- Ribbon membership and ribbon order must be persisted separately from registration.
- Existing registered workspaces should default to being in the ribbon.
- New workspaces added through the current Add Project flow should default to being in the ribbon.
- Existing `sort_order` remains the registered-workspace ordering field for now.
- New ribbon ordering should be stored separately so Slice 5 can reorder the ribbon without rewriting registered order semantics.

## Edit Scope

Primary server scope:

```text
fusion-studio-server/lib/db/migrations/
fusion-studio-server/lib/workspace/registry-service.js
fusion-studio-server/lib/workspace/workspace-controller.js
```

Primary client scope:

```text
fusion-studio-client/src/types/index.ts
fusion-studio-client/src/state/workspaceStore.ts
fusion-studio-client/src/components/WorkspaceRibbon.tsx
fusion-studio-client/src/components/WorkspaceCarousel.tsx
fusion-studio-client/src/hooks/useWorkspaceKeyboard.ts
```

Support scope only if build/tests prove it is directly required:

```text
fusion-studio-client/src/components/WorkspaceTitle.tsx
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-server/test/
fusion-studio-server/lib/workspace/__tests__/
```

Do not edit Electron menu code. Do not edit screenshot/carousel transition code beyond changing which workspace list is used. Do not edit view registry files.

## Task

### 1. Add DB migration for ribbon membership fields

Create the next available migration under:

```text
fusion-studio-server/lib/db/migrations/
```

Use the next available number after existing migrations. At orchestration time `024_slack_liaison_foundation.js` existed untracked, so `025_workspace_ribbon_membership.js` is likely appropriate, but verify before creating the file.

Add columns to `workspaces`:

```text
ribbon_visible integer default 1
ribbon_sort_order integer nullable
```

Backfill all existing rows:

```text
ribbon_visible = 1
ribbon_sort_order = sort_order
```

Down migration should drop both columns.

SQLite note: use simple `table` alterations consistent with nearby migrations. Do not rebuild the table unless Knex/SQLite requires it.

### 2. Normalize registry output shape

In `fusion-studio-server/lib/workspace/registry-service.js`, keep data access pure and add a small row-mapping boundary if one does not already exist.

Returned workspace objects sent to client should expose camelCase fields:

```ts
{
  id,
  label,
  icon,
  description,
  repoPath,
  sortOrder,
  type,
  ribbonVisible,
  ribbonSortOrder,
}
```

Keep internal DB writes using snake_case column names.

`list()` should continue returning all registered workspaces. It should not filter out `ribbon_visible = 0` in this slice.

Add a pure helper for ribbon ordering/filtering, for future slices and current client parity:

```js
function toRibbonWorkspaces(workspaces) { ... }
```

or an equivalent clearly named helper in the client store if that better fits existing architecture. The helper should:

- Filter to `ribbonVisible !== false`.
- Sort by `ribbonSortOrder` when present.
- Fall back to `sortOrder`.

Do not over-abstract. One helper is enough.

### 3. Preserve Add Project behavior

In `workspace-controller.js`, when adding a workspace, set ribbon fields so new workspaces appear in the ribbon by default:

```text
ribbonVisible: true
ribbonSortOrder: nextSortOrder
```

If you keep the `registry.add` API minimal, it may default these values internally instead. Either is acceptable; report which choice you made.

### 4. Update client type and current ribbon consumers

Update `fusion-studio-client/src/types/index.ts`:

```ts
export interface Workspace {
  id: string;
  label: string;
  icon: string;
  description: string | null;
  repoPath: string;
  sortOrder: number;
  type?: 'code' | 'app';
  ribbonVisible?: boolean;
  ribbonSortOrder?: number | null;
}
```

Update current ribbon list consumers to use the ribbon membership/order helper while preserving visible behavior because all current rows default to visible:

```text
fusion-studio-client/src/components/WorkspaceRibbon.tsx
fusion-studio-client/src/components/WorkspaceCarousel.tsx
fusion-studio-client/src/hooks/useWorkspaceKeyboard.ts
fusion-studio-client/src/state/workspaceStore.ts
```

Expected behavior after this slice:

- The ribbon still shows every currently registered workspace.
- Carousel still tracks the active workspace while ribbon is open.
- Keyboard cycling still cycles through the same visible set as before.
- Header title still resolves active workspace from all registered workspaces.

If you add a store selector/helper, keep it small and local to `workspaceStore.ts` unless there is already a better shared location.

### 5. Do not implement the future UI yet

Do not change `WorkspaceRibbon` remove button from `delete` to `cancel` in this slice.

Do not change the current `requestRemove` behavior in this slice.

Do not add the plus dropdown in this slice.

Do not add drag reordering in this slice.

Do not add zero-ribbon-workspace splash behavior in this slice.

Do not add Electron menu behavior in this slice.

## Acceptance Checks

Run from repo root:

```bash
rg -n "ribbon_visible|ribbon_sort_order|ribbonVisible|ribbonSortOrder" fusion-studio-server fusion-studio-client/src
```

Expected result: hits in migration, registry/model code, client type/store/list consumers.

Run:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected result: no hits.

Run:

```bash
rg -n "workspace:close_requested|workspace-close-times|Workspaces'|label: 'Workspaces'" fusion-studio-client fusion-studio-server
```

Expected result: no new hits from this slice. If there were pre-existing hits, report them and do not change them.

Run client build:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Run any relevant server tests if present or if you add tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

If `npm test -- --runInBand` is not supported by this repo, report the exact failure and instead run the narrowest available relevant test command. Do not spend time fixing unrelated test-runner configuration.

Then:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Known note: full-repo `git diff --check` may fail on pre-existing trailing whitespace in `fusion-studio-server/lib/transcription/index.js:287`. If so, run targeted `git diff --check` for touched files and report both results.

## Manual Smoke Optional

If validation passes and this session can restart the app safely, smoke these behaviors:

1. Ribbon opens from workspace title.
2. Ribbon still shows all current workspaces.
3. Clicking a workspace switches and closes the ribbon.
4. Option/Alt + Left/Right still cycles through the same workspaces.
5. Carousel still appears while ribbon is open.
6. Add Project still opens the existing add modal.

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Migration file created and why that number was chosen.
- Exact model fields added.
- Whether registry output now includes `ribbonVisible` and `ribbonSortOrder`.
- How current ribbon consumers now determine the ribbon workspace list.
- `rg` acceptance check results.
- `npm run build` result.
- Server test result or why a narrow/no server test was used.
- `git diff --check` result, including targeted result if full repo has pre-existing whitespace failure.
- Any files touched outside declared scope, with reason.

## Expected Outcome

The app has a persisted ribbon membership/order model, but the visible ribbon/carousel behavior remains unchanged because all existing and newly added workspaces default to ribbon-visible. Later slices can replace the ribbon remove button with a non-destructive membership update and turn the plus button into an add-to-ribbon dropdown.
