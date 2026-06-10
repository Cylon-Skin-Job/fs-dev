# Worker Handoff: RCC-0076 Slice 4C - Validate Create New Against Live View Registry

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

The tree is expected to be heavily dirty with unrelated work. Inspect before editing and do not overwrite unrelated changes.

If `rg` is unavailable in your shell, use available grep/search tooling and report the substitution.

## Required Reading

Read these before working:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-rcc-0076-slice-2b-migrate-live-view-registry.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4-ribbon-plus-add-dropdown.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4b-add-project-ai-requirement.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Also inspect the paused/stale original Slice 4C handoff for context, but do not follow its legacy registry assumptions:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-4c-create-new-project-view-templates.md
```

## Current Starting Fact

Slice 4C appears partially or mostly implemented already in the dirty tree. At handoff creation time these files/features were present:

```text
System Source Files/views.manifest.json
System Source Files/view-templates/**/index.json
fusion-studio-client/src/components/WorkspaceCreateModal.tsx
fusion-studio-client/src/components/WorkspaceCreateModal.css
fusion-studio-server/lib/workspace/create-service.js
workspace:create_manifest_requested
workspace:create_requested
workspace:created
```

Treat this as a validation/alignment slice, not a from-scratch build.

## Goal

Validate and repair the minimal `Create New` project flow so it conforms to the new live registry paradigm:

```text
ai/system/workspace/views.json   <- primary live registry
ai/views/<view-id>/              <- installed view folders/content
ai/views/index.json              <- legacy compatibility only, if still written
```

After this slice, a newly created project must be scaffolded with `/ai`, selected view folders, and a primary `ai/system/workspace/views.json` registry. Legacy `ai/views/index.json` may still be written as a compatibility file, but no active code should prefer it over the new registry.

## Product Behavior To Validate

- Ribbon plus dropdown keeps existing add-to-ribbon behavior.
- `Create New` is enabled and opens the create modal.
- Create modal loads `System Source Files/views.manifest.json` through the server.
- Default templates are preselected.
- Optional templates are selectable.
- Cancel closes the modal without creating files or registering a workspace.
- Create validates project path, label, and selected views.
- Server creates the target project folder only after validation passes.
- Server creates `/ai`, `/ai/views`, `/ai/system/workspace`, and `/ai/system/state`.
- Server copies selected templates into `ai/views/<view-id>`.
- Server writes `ai/system/workspace/views.json` as the primary registry.
- If legacy `ai/views/index.json` is written, it is compatibility-only.
- Server registers the new project, makes it ribbon-visible, appends ribbon order, and switches active workspace to the new project.
- Rejection emits targeted `workspace:create_rejected` and leaves no partial new directory when the directory was created by the failed request.

## Registry Requirements For New Projects

The create service must write:

```json
{
  "version": 1,
  "sort": "ranked",
  "views": [
    {
      "id": "file-viewer",
      "baseViewId": "file-viewer",
      "label": "File Viewer",
      "icon": "code_blocks",
      "rank": 1,
      "enabled": true,
      "source": "default",
      "viewPath": "ai/views/file-viewer"
    }
  ]
}
```

Rules:

- `source` is `default` when manifest `group` is `default`.
- `source` is `optional` when manifest `group` is `optional`.
- `rank` is deterministic and follows selected view order.
- `baseViewId` equals manifest `id` for normal template-created views.
- `viewPath` is project-relative.
- JSON is formatted with two-space indentation and a trailing newline.

## Implementation Scope

Primary validation/repair scope:

```text
System Source Files/views.manifest.json
System Source Files/view-templates/**
fusion-studio-client/src/components/WorkspaceCreateModal.tsx
fusion-studio-client/src/components/WorkspaceCreateModal.css
fusion-studio-client/src/components/WorkspaceRibbon.tsx
fusion-studio-client/src/state/workspaceStore.ts
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-client/src/types/index.ts
fusion-studio-server/lib/workspace/create-service.js
fusion-studio-server/lib/workspace/workspace-controller.js
fusion-studio-server/lib/ws/workspace-request-handlers.js
fusion-studio-server/lib/ws/workspace-broadcaster.js
fusion-studio-server/lib/workspace/bootstrap-service.js
```

Support scope only if tests prove it is required:

```text
fusion-studio-server/test/**
fusion-studio-client/src/components/App.tsx
```

Do not edit external registered workspace registries in this slice unless a validation test explicitly creates a temporary project there. Prefer a temporary path outside the repo for smoke tests.

## Task

### 1. Inventory Current Create New Implementation

Confirm and report whether these exist:

```text
System Source Files/views.manifest.json
System Source Files/view-templates/default/file-viewer/index.json
System Source Files/view-templates/default/wiki-viewer/index.json
System Source Files/view-templates/default/issues-viewer/index.json
System Source Files/view-templates/default/agents-viewer/index.json
System Source Files/view-templates/default/system-viewer/index.json
System Source Files/view-templates/optional/email/index.json
System Source Files/view-templates/optional/calendar/index.json
System Source Files/view-templates/optional/todo/index.json
System Source Files/view-templates/optional/doc-viewer/index.json
System Source Files/view-templates/optional/office-viewer/index.json
System Source Files/view-templates/optional/library/index.json
System Source Files/view-templates/optional/media-editor/index.json
```

Validate manifest entries include:

```text
id
label
group
status
icon, if current create-service depends on it
```

### 2. Validate Server Create Service

Inspect `fusion-studio-server/lib/workspace/create-service.js`.

Required behavior:

- Reads manifest from repo-local `System Source Files/views.manifest.json`.
- Validates selected view ids.
- Creates target directory only after validations that can be done before creation.
- Creates `ai/views`, `ai/system/workspace`, and `ai/system/state`.
- Copies selected templates safely.
- Guards template source under `System Source Files/view-templates`.
- Guards destination under the new project's `ai/views`.
- Skips hidden files and symlinks.
- Writes `ai/system/workspace/views.json` as the primary registry.
- Does not rely on `ai/views/index.json` for primary behavior.

If any of these are missing, make the smallest repair.

### 3. Validate Server Request/Controller Flow

Inspect create handling in:

```text
fusion-studio-server/lib/ws/workspace-request-handlers.js
fusion-studio-server/lib/workspace/workspace-controller.js
fusion-studio-server/lib/ws/workspace-broadcaster.js
```

Required behavior:

- `workspace:create_manifest_requested` sends the manifest only to the requesting client.
- `workspace:create_requested` validates required fields before emitting controller event.
- Controller rejects missing/non-absolute project path.
- Controller rejects missing parent directory.
- Controller rejects existing non-empty target directory.
- Controller rejects empty selected view list.
- Controller delegates filesystem scaffolding to create service.
- Controller registers the new workspace through existing registry service.
- New workspace is `ribbonVisible: true` and appended to ribbon order.
- New workspace becomes active and emits the same switch/registry events normal add flows expect.
- Create rejection is targeted to the requesting connection.

If current implementation differs, repair only the mismatch.

### 4. Validate Client Create Flow

Inspect:

```text
fusion-studio-client/src/components/WorkspaceRibbon.tsx
fusion-studio-client/src/components/WorkspaceCreateModal.tsx
fusion-studio-client/src/state/workspaceStore.ts
fusion-studio-client/src/lib/ws/workspace-handlers.ts
fusion-studio-client/src/types/index.ts
```

Required behavior:

- `Create New` is enabled in the plus dropdown.
- Opening the modal requests the create manifest.
- Modal handles loading, error, cancel, and submit states.
- Defaults are preselected from manifest `group: "default"`.
- Optional entries are selectable.
- Submit requires absolute path and at least one selected view.
- Client does not create files directly.
- `workspace:create_manifest` populates modal state.
- `workspace:create_rejected` displays a useful error.
- `workspace:created` closes/reset the modal.

If current implementation differs, repair only the mismatch.

### 5. Smoke With A Temporary Project

Use a safe temp path, not a real project path. Recommended parent:

```text
/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/opencode/
```

If a server-level unit/integration test can exercise `create-service.scaffoldProject()` without registering a real workspace, use that first.

If performing manual app smoke, create a disposable project and report the path. Do not delete unrelated files. If cleanup is safe and only removes the created temp project, cleanup is allowed; otherwise leave it and report it.

Validate the created project contains:

```text
ai/system/workspace/views.json
ai/system/state/
ai/views/<selected-view-id>/
```

Parse `ai/system/workspace/views.json` and confirm selected views are represented.

## Non-Goals

- Do not redesign the create modal.
- Do not polish the wizard beyond functional validation.
- Do not implement left-nav view management.
- Do not implement Add View or Restore View.
- Do not implement duplicate view creation as a normal UI feature.
- Do not remove legacy `ai/views/index.json` in this slice.
- Do not change top-ribbon workspace membership behavior except what Create New requires.
- Do not edit Electron menu code.
- Do not implement drag reordering.
- Do not implement zero-ribbon splash.

## Acceptance Checks

Run from repo root:

```bash
test -f "System Source Files/views.manifest.json"
test -d "System Source Files/view-templates/default/file-viewer"
test -d "System Source Files/view-templates/optional/todo"
test -f "fusion-studio-server/lib/workspace/create-service.js"
test -f "fusion-studio-client/src/components/WorkspaceCreateModal.tsx"
```

Search create flow:

```bash
rg -n "workspace:create_manifest_requested|workspace:create_manifest|workspace:create_requested|workspace:create_rejected|workspace:created" fusion-studio-client/src fusion-studio-server
```

Expected: hits in both client and server.

Search new registry writes:

```bash
rg -n "ai/system/workspace|views.json|workspace view registry|workspace:create_requested" fusion-studio-server/lib/workspace fusion-studio-server/lib/ws fusion-studio-client/src
```

Expected: create path writes/uses `ai/system/workspace/views.json`.

Confirm obsolete switcher remains gone:

```bash
rg -n "WorkspaceSwitcher|isSwitcherOpen|openSwitcher|closeSwitcher|rv-switcher" fusion-studio-client/src
```

Expected: no hits.

Run client build:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Run relevant server tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/ws/client-message-router.test.js test/thread/thread-messages.test.js
```

If a more targeted create-flow test exists or is added, run that too. If the command is unsupported, report the exact failure and run the nearest relevant test command.

Run targeted diff check for touched files. Avoid relying only on full-repo `git diff --check` because the repo has known pre-existing whitespace in `fusion-studio-server/lib/transcription/index.js:287`.

```bash
git diff --check -- \
  "System Source Files/views.manifest.json" \
  "System Source Files/view-templates" \
  fusion-studio-client/src/components/WorkspaceCreateModal.tsx \
  fusion-studio-client/src/components/WorkspaceCreateModal.css \
  fusion-studio-client/src/components/WorkspaceRibbon.tsx \
  fusion-studio-client/src/state/workspaceStore.ts \
  fusion-studio-client/src/lib/ws/workspace-handlers.ts \
  fusion-studio-client/src/types/index.ts \
  fusion-studio-server/lib/workspace/create-service.js \
  fusion-studio-server/lib/workspace/workspace-controller.js \
  fusion-studio-server/lib/ws/workspace-request-handlers.js \
  fusion-studio-server/lib/ws/workspace-broadcaster.js
```

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Whether this was validation-only or included repairs.
- Current manifest view ids and groups.
- Whether new projects write `ai/system/workspace/views.json` as primary registry.
- Whether legacy `ai/views/index.json` is still written and why.
- How template copying is guarded.
- How create request validation works.
- What happens on cancellation.
- What happens on create rejection.
- Whether the created workspace becomes active.
- Acceptance check results.
- Build/test results.
- Manual/temp-project smoke result, or why it was not run.
- Any files touched outside declared scope, with reason.

## Expected Outcome

The current Create New implementation is validated and aligned with the live registry migration. If repairs are needed, they are minimal. New projects use `ai/system/workspace/views.json` as the primary source of truth and remain compatible with the existing ribbon/workspace flow.
