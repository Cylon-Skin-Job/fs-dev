# Worker Handoff: RCC-0076 Slice 4C - Create New Project With View Templates

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
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4b-add-project-ai-requirement.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Confirm prior slices are complete:

```bash
rg -n "workspace:ribbon_add_requested|requestAddToRibbon|toHiddenRibbonWorkspaces" fusion-studio-client/src fusion-studio-server
rg -n "add_rejected_missing_ai|Project requires /ai|must already contain an /ai" fusion-studio-client/src fusion-studio-server
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected:

- Slice 4 and Slice 4B searches have hits.
- Obsolete switcher search has no hits.

If `rg` is unavailable in your shell, use the available search tooling and report that substitution.

## Current Starting Fact

At handoff creation time, these did not exist:

```text
System Source Files/views.manifest.json
System Source Files/view-templates/
```

This slice must create the initial manifest/template foundation before wiring the Create New flow.

## Goal

Implement the first minimal `Create New` project flow from the ribbon plus dropdown.

The flow should create a new project folder with an `/ai` tree and selected view folders scaffolded from `System Source Files/view-templates/`, then register and add that project to the ribbon.

Keep this slice intentionally minimal and functional. It is not a full polished project wizard.

## Product Behavior

- The `Create New` action in the ribbon plus dropdown is enabled.
- Clicking `Create New` opens a small creation modal/flow.
- The flow loads available view templates from `System Source Files/views.manifest.json` via the server.
- User provides a project path/name and chooses view templates.
- Default views are preselected.
- Optional views are available but not preselected.
- Canceling the flow aborts without creating or registering a project.
- Confirming creates the new project folder and `/ai` structure.
- Selected views are scaffolded into `ai/views/<view-id>` using each manifest entry's `templatePath`.
- The server creates `ai/views/index.json` for compatibility with current code.
- The server registers the new project and adds it to the ribbon.
- After creation, the new project becomes the active workspace, matching normal add-project behavior expectations for a newly created workspace.

## View Catalog To Create

Create:

```text
System Source Files/views.manifest.json
System Source Files/view-templates/default/file-viewer/
System Source Files/view-templates/default/wiki-viewer/
System Source Files/view-templates/default/issues-viewer/
System Source Files/view-templates/default/agents-viewer/
System Source Files/view-templates/default/system-viewer/
System Source Files/view-templates/optional/email/
System Source Files/view-templates/optional/calendar/
System Source Files/view-templates/optional/todo/
System Source Files/view-templates/optional/doc-viewer/
System Source Files/view-templates/optional/office-viewer/
System Source Files/view-templates/optional/library/
System Source Files/view-templates/optional/media-editor/
```

Manifest shape:

```json
{
  "version": 1,
  "views": [
    {
      "id": "file-viewer",
      "label": "File Viewer",
      "group": "default",
      "status": "ready",
      "templatePath": "view-templates/default/file-viewer"
    }
  ]
}
```

Full initial catalog:

- Default: `file-viewer`, `wiki-viewer`, `issues-viewer`, `agents-viewer`, `system-viewer`.
- Optional: `email`, `calendar`, `todo`, `doc-viewer`, `office-viewer`, `library`, `media-editor`.

Statuses:

- `file-viewer`, `wiki-viewer`, `issues-viewer`, `agents-viewer`, `system-viewer`, `office-viewer`: `ready`.
- `email`, `calendar`, `doc-viewer`: `active-development`.
- `todo`, `library`, `media-editor`: `stub`.

Template folder minimum:

- Each template folder should contain at least an `index.json` describing the view.
- Stub/active-development templates may contain placeholder content only.
- Do not copy large existing view content in this slice. Keep templates small and portable.

Suggested `index.json` per template:

```json
{
  "id": "file-viewer",
  "label": "File Viewer",
  "icon": "code_blocks",
  "status": "ready"
}
```

Use sensible Material Symbols icon names:

- `file-viewer`: `code_blocks`
- `wiki-viewer`: `full_coverage`
- `issues-viewer`: `business_messages`
- `agents-viewer`: `robot_2`
- `system-viewer`: `settings`
- `email`: `mail`
- `calendar`: `calendar_month`
- `todo`: `checklist`
- `doc-viewer`: `description`
- `office-viewer`: `grid_view`
- `library`: `local_library`
- `media-editor`: `movie`

## Edit Scope

Primary source/template scope:

```text
System Source Files/views.manifest.json
System Source Files/view-templates/**
```

Primary client scope:

```text
fusion-studio-client/src/components/WorkspaceRibbon.tsx
fusion-studio-client/src/components/WorkspaceRibbon.css
fusion-studio-client/src/state/workspaceStore.ts
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-client/src/types/index.ts
```

Primary server scope:

```text
fusion-studio-server/lib/ws/workspace-request-handlers.js
fusion-studio-server/lib/ws/workspace-broadcaster.js
fusion-studio-server/lib/workspace/workspace-controller.js
fusion-studio-server/lib/workspace/bootstrap-service.js
```

Support scope only if build/tests prove it is directly required:

```text
fusion-studio-client/src/components/WorkspaceCreateModal.tsx
fusion-studio-client/src/components/WorkspaceCreateModal.css
fusion-studio-server/lib/workspace/create-service.js
fusion-studio-server/test/
```

Creating a small new component/service is acceptable here if it keeps files one-job-per-file.

Do not edit Electron menu code. Do not implement view right-click menus. Do not implement drag reordering. Do not migrate live view registries in this slice.

## Task

### 1. Create manifest and template folders

Create the manifest and template folders listed above.

Keep all files ASCII.

For each template folder, create minimal placeholder files only. Do not bulk-copy current live workspace data.

For default templates, include enough `index.json` metadata for the scaffold service to generate `ai/views/index.json`.

### 2. Add server manifest read endpoint/message

Add a WebSocket request/response path for reading the view catalog:

Client request:

```json
{ "type": "workspace:create_manifest_requested" }
```

Server response:

```json
{
  "type": "workspace:create_manifest",
  "manifest": { "version": 1, "views": [] }
}
```

Implementation options:

- Add a handler in `fusion-studio-server/lib/ws/workspace-request-handlers.js` that reads `System Source Files/views.manifest.json` and sends the response directly to that client.
- Or route through the event bus if that fits existing architecture better.

Direct response is acceptable for this simple read-only request.

Path resolution:

- Resolve `System Source Files/views.manifest.json` from repo/server root deterministically.
- Do not hardcode the user's home directory.
- Keep path traversal out of this request; it should read only the known manifest path.

### 3. Add Create New client flow

Enable the `Create New` action in `WorkspaceRibbon.tsx`.

Clicking it should:

- Close the plus dropdown.
- Open a create modal/flow.
- Request the view manifest from the server.

The create modal should allow:

- Project folder path input.
- Project display name input or folder-name-derived label.
- View template selection.
- Default views preselected.
- Optional views selectable.
- Cancel.
- Create.

Keep UI minimal. It can be a simple modal with text inputs and checkboxes.

Do not use the folder picker unless that is easy and low-risk. A path text input is acceptable for this first slice.

Client create request:

```json
{
  "type": "workspace:create_requested",
  "projectPath": "/absolute/path/to/new/project",
  "label": "My Project",
  "viewIds": ["file-viewer", "wiki-viewer"]
}
```

Validation client-side:

- Require non-empty absolute path.
- Require at least one selected view.
- Do not create anything client-side.

### 4. Add server create request handling

In `workspace-request-handlers.js`, validate and emit:

```text
workspace:create_requested
```

Payload should include:

```js
{
  projectPath,
  label,
  viewIds,
  connectionId
}
```

In `workspace-controller.js`, subscribe to `workspace:create_requested` and implement creation.

Server behavior:

- Reject if `projectPath` is missing or not an absolute path.
- Reject if parent directory does not exist.
- Reject if target project path already exists and is not empty.
- Reject if selected `viewIds` is empty.
- Load manifest from `System Source Files/views.manifest.json`.
- Reject unknown `viewIds`.
- Create target project directory.
- Create `/ai`, `/ai/views`, and needed system folders.
- Copy selected template folders into `ai/views/<view-id>`.
- Generate `ai/views/index.json` from selected manifest entries with id, label, icon, rank.
- Register the project in the existing workspace registry.
- Set `ribbonVisible: true` and append ribbon order.
- Set the newly created workspace active, write `last_active_workspace_id`, and emit `workspace:switched`.
- Emit `workspace:created` targeted or broadcast as useful.
- Emit `workspace:registry_changed` with full registry list.

Failure behavior:

- Emit targeted `workspace:create_rejected` with a human-readable `message`.
- Do not leave partially created files when validation fails before creation.
- If copying fails after the directory is created, do best-effort cleanup of the newly created directory only if it was created by this request. Do not delete an existing user directory.

### 5. Copy template folders safely

Implement a small recursive copy helper in a server workspace create service or inside controller if it stays small.

Rules:

- Source must resolve under `System Source Files/view-templates`.
- Destination must resolve under the new project's `ai/views`.
- Do not follow symlinks for this slice.
- Skip hidden files if any appear.

### 6. Add client response handling

Handle:

```text
workspace:create_manifest
workspace:create_rejected
workspace:created
```

Behavior:

- `workspace:create_manifest`: populate the create modal template list.
- `workspace:create_rejected`: show error in the create modal or show alert; report choice.
- `workspace:created`: close create modal. Registry/switch messages should handle state updates.

If you add a local modal component, keep its state local and reset on close.

## Non-Goals

- Do not implement a polished wizard.
- Do not implement `/ai` Add Project modal changes; Slice 4B already did that.
- Do not add view right-click management.
- Do not migrate live view registry to `ai/system/workspace/views.json`; that belongs to Slice 2b after guard/audit.
- Do not implement duplicate view creation as a normal UI feature.
- Do not implement Electron menu behavior.
- Do not implement drag reordering.
- Do not implement final zero-ribbon splash design.

## Acceptance Checks

Run from repo root:

```bash
rg -n "workspace:create_manifest_requested|workspace:create_manifest|workspace:create_requested|workspace:create_rejected|workspace:created" fusion-studio-client/src fusion-studio-server
```

Expected result: hits in client and server create flow.

Run:

```bash
test -f "System Source Files/views.manifest.json" && test -d "System Source Files/view-templates/default/file-viewer" && test -d "System Source Files/view-templates/optional/todo"
```

Expected result: exit code 0.

Run:

```bash
rg -n '"id": "file-viewer"|"id": "media-editor"|"templatePath"|"group": "default"|"group": "optional"' "System Source Files/views.manifest.json"
```

Expected result: manifest includes default and optional catalog entries.

Run:

```bash
rg -n "Create New|Coming soon|workspace:create_requested" fusion-studio-client/src/components/WorkspaceRibbon.tsx fusion-studio-client/src
```

Expected result: `Create New` is no longer only disabled/coming-soon; create request path exists.

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
2. Click `Create New`.
3. Confirm create modal opens and loads default/optional view templates.
4. Cancel; no project folder is created.
5. Create a test project path under a safe temp/workspace location.
6. Select default views and submit.
7. Confirm project folder is created with `/ai` and selected `ai/views/<view-id>` folders.
8. Confirm project is registered and appears in ribbon.
9. Confirm project becomes active.
10. Confirm Add Project `/ai` requirement still works.

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files and folders created under `System Source Files`.
- Files changed in client/server.
- Manifest shape and view ids included.
- How template copying is guarded.
- How create request validation works.
- What happens on cancellation.
- What happens on create rejection.
- Whether created workspace becomes active.
- `rg` acceptance check results.
- `npm run build` result.
- Server test result or why a narrow/no server test was used.
- `git diff --check` result, including targeted result if full repo has pre-existing whitespace failure.
- Whether manual smoke was run; if not, why not.
- Any files touched outside declared scope, with reason.

## Expected Outcome

The app has a minimal `Create New` flow backed by a manifest/template catalog in `System Source Files`. New projects are scaffolded with `/ai`, selected view folders, and compatibility `ai/views/index.json`, then registered and added to the ribbon.
