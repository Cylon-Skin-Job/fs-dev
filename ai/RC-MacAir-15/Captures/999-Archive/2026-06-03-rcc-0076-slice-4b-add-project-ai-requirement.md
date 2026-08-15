# Worker Handoff: RCC-0076 Slice 4B - Add Project Requires `/ai`

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
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4-ribbon-plus-add-dropdown.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Confirm prior slices are complete:

```bash
rg -n "workspace:ribbon_add_requested|requestAddToRibbon|toHiddenRibbonWorkspaces|ribbon_add" fusion-studio-client/src fusion-studio-server
rg -n "workspace:ribbon_remove_requested|requestRemoveFromRibbon|updateRibbonVisibility" fusion-studio-client/src fusion-studio-server
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected:

- Slice 3 and Slice 4 searches have hits.
- Obsolete switcher search has no hits.

If `rg` is unavailable in your shell, use the available search tooling and report that substitution.

## Goal

Add a mandatory `/ai` requirement gate to the existing Add Project flow.

After this slice:

- Choosing `Add Project` first shows a modal/panel explaining the selected project must already contain an `/ai` folder.
- Canceling the requirement gate aborts the add flow with no side effects.
- Confirming the requirement gate continues to the existing folder picker.
- The server rejects `workspace:add_requested` when the selected project does not contain an `/ai` folder.
- The server must not silently create `/ai` for a project that does not have one.
- Existing add-project behavior should otherwise remain the same for projects that already contain `/ai`.

## Product Behavior

Add Project flow:

1. User chooses `Add Project` from the ribbon plus dropdown.
2. App shows a clear requirement message: the project must contain an `/ai` folder before it can be added.
3. User can cancel or continue.
4. Cancel closes/aborts Add Project and does not open the folder picker.
5. Continue opens the existing folder picker.
6. User selects a folder.
7. Server accepts only if the selected folder already has an `/ai` directory.
8. If accepted, current registration/bootstrap behavior continues for the valid project.
9. If rejected, user sees an explanatory message and no workspace is added.

Important wording:

- Say `/ai` is required.
- Do not imply `/ai` is optional.
- Do not say Fusion Studio will create `/ai` for them in this flow.

## Edit Scope

Primary client scope:

```text
fusion-studio-client/src/components/WorkspaceAddModal.tsx
fusion-studio-client/src/components/WorkspaceAddModal.css
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-client/src/types/index.ts
```

Primary server scope:

```text
fusion-studio-server/lib/workspace/workspace-controller.js
fusion-studio-server/lib/workspace/bootstrap-service.js
fusion-studio-server/lib/ws/workspace-broadcaster.js
```

Support scope only if build/tests prove it is directly required:

```text
fusion-studio-client/src/components/FolderPicker.tsx
fusion-studio-server/test/
```

Do not edit Electron menu code. Do not implement Create New scaffolding. Do not change the ribbon add-to-ribbon dropdown behavior except as needed to preserve the existing `Add Project` action.

## Task

### 1. Add a client requirement gate before the folder picker

In `fusion-studio-client/src/components/WorkspaceAddModal.tsx`, add a local two-step flow:

- Step 1: requirement gate.
- Step 2: existing `FolderPicker`.

When `isAddModalOpen` becomes true, default to showing the requirement gate.

Requirement gate should include:

- Title like `Add Project`.
- Clear copy: `The project must already contain an /ai folder before it can be added to Fusion Studio.`
- Optional supporting copy: `Cancel to abort, or continue when you are ready to choose a project folder that already has /ai.`
- Buttons: `Cancel` and `Continue`.

Button behavior:

- `Cancel`: close modal and reset local step state.
- `Continue`: show the existing `FolderPicker`.

Folder picker behavior:

- Keep using `requestAdd(path)` on selection.
- Keep closing the add modal after selection, unless you need to keep it open to show an inline rejection. If you choose inline rejection, report it.
- `onCancel` should close the add modal and reset local step state.

Implementation notes:

- Local `useState`/`useEffect` in `WorkspaceAddModal` is appropriate.
- Keep this in `WorkspaceAddModal.tsx`; do not create a new component unless necessary.
- `WorkspaceAddModal.css` already exists and appears mostly unused by the current `FolderPicker` implementation. Reuse/add `.rv-add-modal-*` styles for the requirement gate.
- Use CSS variables with fallbacks.

### 2. Add server-side `/ai` enforcement

In `fusion-studio-server/lib/workspace/workspace-controller.js`, update `handleAddRequested`:

- Canonicalize as it does today.
- Before `bootstrap.bootstrap(canonical)`, check that `path.join(canonical, 'ai')` exists and is a directory.
- If `/ai` is missing, emit a targeted rejection event and return without calling `bootstrap.bootstrap` and without inserting into `workspaces`.

Suggested event:

```js
emit('workspace:add_rejected_missing_ai', {
  repoPath: canonical,
  connectionId,
});
```

Use `fs.statSync` or equivalent safely. A plain `fs.existsSync(path.join(canonical, 'ai'))` plus directory check is fine.

Existing `bootstrap.bootstrap(canonical)` may still run after `/ai` exists, to create missing internal subfolders/files needed by the current app. It must not create `/ai` for a project where `/ai` was absent.

### 3. Update bootstrap-service comments/guard if needed

`fusion-studio-server/lib/workspace/bootstrap-service.js` currently documents that add can create the minimum `ai/` tree. Update comments if needed so future workers understand the new rule:

- Add Project requires `/ai` to already exist.
- Bootstrap may fill missing internal files under an existing `/ai` tree.

Do not remove bootstrap entirely unless tests prove it is no longer needed. Minimal change preferred.

### 4. Broadcast missing-ai rejection to the initiating client

In `fusion-studio-server/lib/ws/workspace-broadcaster.js`, add a targeted subscription for:

```text
workspace:add_rejected_missing_ai
```

Send to the initiating connection:

```js
{
  type: 'workspace:add_rejected_missing_ai',
  repoPath: event.repoPath,
}
```

Keep existing `workspace:add_rejected_duplicate` behavior unchanged.

### 5. Handle missing-ai rejection in the client

In `fusion-studio-client/src/types/index.ts`, add any fields needed by the WebSocket message type, likely:

```ts
repoPath?: string | null;
```

If `repoPath` already exists, do not duplicate it.

In `fusion-studio-client/src/lib/ws/workspace-handlers.ts`, handle:

```text
workspace:add_rejected_missing_ai
```

Behavior:

- Ensure the add modal is closed.
- Show a clear alert/modal message explaining the selected folder cannot be added because it does not contain `/ai`.
- Do not call `requestAdd` again.
- Do not switch workspaces.

Existing modal infrastructure in this file uses `showModal`; reuse that if appropriate.

Suggested copy:

```text
Project requires /ai
This folder cannot be added because it does not contain an /ai folder. Choose a project that already has /ai, or create the project through the future Create New flow.
```

Do not implement Create New in this slice.

## Non-Goals

- Do not implement the Create New project flow.
- Do not scaffold `/ai` for folders that do not have it.
- Do not change the add-to-ribbon dropdown except preserving the existing Add Project action.
- Do not change ribbon membership model or ordering.
- Do not change `workspace:ribbon_add_requested` or `workspace:ribbon_remove_requested` semantics.
- Do not add Electron menu behavior.
- Do not change view registry migration paths.

## Acceptance Checks

Run from repo root:

```bash
rg -n "add_rejected_missing_ai|Project requires /ai|must already contain an /ai|/ai folder" fusion-studio-client/src fusion-studio-server
```

Expected result: hits in client requirement UI, server controller/broadcaster, and client rejection handler.

Run:

```bash
rg -n "bootstrap\(canonical\)|path\.join\(canonical, 'ai'\)|path\.join\(canonical, \"ai\"\)" fusion-studio-server/lib/workspace/workspace-controller.js
```

Expected result: `/ai` check occurs before `bootstrap(canonical)`.

Run:

```bash
rg -n "workspace:ribbon_add_requested|requestAddToRibbon|toHiddenRibbonWorkspaces" fusion-studio-client/src fusion-studio-server
```

Expected result: Slice 4 add-to-ribbon path still exists.

Run:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected result: no hits.

Run client build:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Run relevant server tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

If that command is unsupported, report the exact failure and run the narrowest available relevant test command instead.

Then:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Known note: full-repo `git diff --check` may fail on pre-existing trailing whitespace in `fusion-studio-server/lib/transcription/index.js:287`. If so, run targeted `git diff --check` for touched files and report both results.

## Manual Smoke Optional

If validation passes and this session can restart the app safely, smoke these behaviors:

1. Open ribbon plus dropdown.
2. Click `Add Project`.
3. Confirm `/ai` requirement gate appears before folder picker.
4. Click Cancel; folder picker does not open and no add request is sent.
5. Click Add Project again, Continue; folder picker opens.
6. Select a folder without `/ai`; it is rejected and an explanatory alert appears.
7. Select a folder with `/ai`; existing add-project flow continues.
8. Confirm add-to-ribbon dropdown behavior from Slice 4 still works.

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files changed.
- How the client requirement gate is implemented.
- How the server verifies `/ai` before bootstrap/registration.
- New rejection event/message type added.
- Whether `bootstrap.bootstrap(canonical)` can still create `/ai` for missing-`/ai` projects. Expected answer: no.
- `rg` acceptance check results.
- `npm run build` result.
- Server test result or why a narrow/no server test was used.
- `git diff --check` result, including targeted result if full repo has pre-existing whitespace failure.
- Whether manual smoke was run; if not, why not.
- Any files touched outside declared scope, with reason.

## Expected Outcome

Add Project now has an explicit `/ai` requirement before folder selection and server-side enforcement after selection. Canceling aborts without side effects. Folders without `/ai` are rejected instead of silently bootstrapped. Create New remains future work.
