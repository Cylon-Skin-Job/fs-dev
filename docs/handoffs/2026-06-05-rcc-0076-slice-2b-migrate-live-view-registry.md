# Worker Handoff: RCC-0076 Slice 2B - Migrate Live View Registry

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

The tree is expected to be heavily dirty. Inspect before working and do not overwrite unrelated changes. Only touch files required for this slice.

Note: prior worker sessions reported `rg` was not available in their shell. If `rg` fails with `command not found`, use available grep/search tooling and report the substitution.

## Required Reading

Read these before working:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-2b-guard-audit-registered-workspaces.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-2b-guard-audit-results.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Goal

Migrate the live workspace view registry source of truth from legacy `ai/views/index.json` to:

```text
ai/system/workspace/views.json
```

Generate this file for every currently registered workspace from the Slice 2B-Guard audit, and update active panel discovery so the new registry wins when present.

Legacy `ai/views/index.json` files must remain in place during this slice. Do not remove, rename, or rewrite legacy files unless a targeted test proves a tiny compatibility update is required.

## Approved Audit Decision

The orchestrator approved the audit with these decisions:

- No repair slice is needed before migration.
- Include metadata-less `chat` folders as enabled custom views with fallback metadata.
- Preserve all custom/unknown folders explicitly.
- Preserve existing labels, icons, and ranks from per-view `index.json` where present.
- Do not rename or delete folders.
- Use deterministic tie-breaking for ordering, but do not rewrite original rank values just to remove duplicates.

## Current Registered Workspaces

Create or preserve `ai/system/workspace/views.json` for these registered workspace roots:

```text
/Users/rccurtrightjr./projects/fs-dev
/Users/rccurtrightjr./projects/fs-dev/System Source Files
/Users/rccurtrightjr./projects/fusion-home
/Users/rccurtrightjr./projects/media-editor
/Users/rccurtrightjr./projects/solobooks
```

The paths above are the actual absolute paths for the audit entries. Confirm they still exist before writing. If any registered workspace has changed since the audit, stop and report the mismatch rather than guessing.

## Target Schema

Each workspace registry file should use this shape:

```json
{
  "version": 1,
  "sort": "ranked",
  "views": [
    {
      "id": "file-viewer",
      "baseViewId": "file-viewer",
      "label": "Files",
      "icon": "code_blocks",
      "rank": 1,
      "enabled": true,
      "source": "default",
      "viewPath": "ai/views/file-viewer"
    }
  ]
}
```

Field rules:

- `id`: stable installed view id; normally the folder name under `ai/views/`.
- `baseViewId`: inferred template/type id. Use the folder name for normal views. For manually prefixed duplicates, match the longest known suffix.
- `label`: per-view `index.json` label when present; fallback to folder name.
- `icon`: per-view `index.json` icon when present; fallback to `folder`.
- `rank`: per-view `index.json` rank when present; fallback deterministically for missing metadata.
- `enabled`: `true` for every installed folder in this migration, including `chat`.
- `source`: `default`, `optional`, or `custom`.
- `viewPath`: project-relative path to the view folder.

Known view source classification:

```text
default: file-viewer, wiki-viewer, issues-viewer, agents-viewer, system-viewer
optional: doc-viewer, office-viewer, email, calendar, todo, library, media-editor
custom: anything else, including chat, browser-viewer, custom-viewer, calendar-viewer
```

If a folder ends with `-<known-view-id>`, infer `baseViewId` from the longest matching known suffix. Do not rename the folder.

## Migration Data Rules

For each registered workspace:

1. Read `ai/views/` folder names.
2. Read each `ai/views/<folder>/index.json` when present and valid.
3. Include every installed view folder, including folders missing `index.json`.
4. Preserve existing `id`, `label`, `icon`, and `rank` from per-view metadata when present.
5. If declared `id` is missing, use the folder name.
6. If declared `id` differs from the folder name, stop and report. The audit found no mismatches, so a mismatch means the state changed.
7. For `chat`, use fallback metadata:

```json
{
  "id": "chat",
  "baseViewId": "chat",
  "label": "chat",
  "icon": "folder",
  "enabled": true,
  "source": "custom",
  "viewPath": "ai/views/chat"
}
```

8. For fallback `rank`, use the audit preview's rank when possible. If regenerating dynamically, use a deterministic value that keeps output stable across runs. Do not renumber existing ranked views.
9. Sort the `views` array by `rank`, then by current folder/order source, then by `id` as a final deterministic tie-breaker. Preserve duplicate rank numbers as-is.
10. Create `ai/system/workspace/` if missing.
11. Write formatted JSON with two-space indentation and a trailing newline.
12. Do not edit `ai/views/index.json`.

## Implementation Scope

Primary implementation scope:

```text
fusion-studio-client/src/lib/panels.ts
fusion-studio-server/lib/views/index.js
fusion-studio-server/server.js
fusion-studio-server/lib/workspace/bootstrap-service.js
fusion-studio-server/lib/workspace/create-service.js
<registered workspace>/ai/system/workspace/views.json
```

Only touch the server files if the code path requires them. Prefer the smallest correct change.

Expected code behavior after this slice:

- Active panel discovery prefers `ai/system/workspace/views.json` when present.
- Legacy folder scanning remains as a concrete migration fallback when `views.json` does not exist.
- Legacy `ai/views/index.json` is no longer treated as the preferred source of truth.
- View content remains resolved from `ai/views/<view-id>/`.
- Existing view-specific `index.json`, `content.json`, and `settings/layout.json` still load as implementation/config details.
- Missing per-view `index.json` entries such as `chat` can still be represented using registry fallback metadata.

Suggested minimal approach:

1. Add a small filesystem helper in `fusion-studio-server/lib/views/index.js` to read `ai/system/workspace/views.json` and list enabled registry views.
2. Keep the existing `ai/views/` scanning function as fallback when the new registry is absent or unreadable.
3. Expose the new workspace registry over the existing WebSocket file API with the smallest safe alias or path support needed by the client.
4. Update `fusion-studio-client/src/lib/panels.ts` so `loadAllPanels()` first attempts the new registry, then falls back to current `discoverPanels()` behavior.
5. When loading panel configs from registry entries, use registry metadata as fallback for missing per-view `index.json` fields.
6. Update `create-service.js` so newly created workspaces write `ai/system/workspace/views.json` directly. Keep legacy `ai/views/index.json` only if current tests or current create flow still need it during this migration.
7. Update `bootstrap-service.js` so Add Project's minimum workspace validation accepts the new registry path and does not create a fresh legacy registry as the primary file.

Do not introduce a broad abstraction layer. One or two focused helper functions are enough if needed.

## Non-Goals

- Do not implement Slice 2C left-nav context menus.
- Do not implement Slice 2D add/restore view menus.
- Do not implement Slice 4C Create New UI beyond adjusting existing create-service registry output if already present.
- Do not delete `ai/views/index.json`.
- Do not rename, delete, or recreate any `ai/views/<view-id>/` folders.
- Do not add drag reorder behavior.
- Do not change top workspace ribbon behavior.
- Do not move view content out of `ai/views/`.
- Do not treat `System Source Files` as the live source of truth for other workspaces. It is only one registered workspace plus the scaffolding/template source.

## Acceptance Checks

Run from repo root:

```bash
test -f /Users/rccurtrightjr./projects/fs-dev/ai/system/workspace/views.json
test -f "/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/system/workspace/views.json"
test -f /Users/rccurtrightjr./projects/fusion-home/ai/system/workspace/views.json
test -f /Users/rccurtrightjr./projects/media-editor/ai/system/workspace/views.json
test -f /Users/rccurtrightjr./projects/solobooks/ai/system/workspace/views.json
```

Validate each registry is parseable JSON:

```bash
node -e "for (const file of process.argv.slice(1)) { const fs = require('fs'); const json = JSON.parse(fs.readFileSync(file, 'utf8')); if (json.version !== 1 || json.sort !== 'ranked' || !Array.isArray(json.views)) throw new Error(file); }" \
  /Users/rccurtrightjr./projects/fs-dev/ai/system/workspace/views.json \
  "/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/system/workspace/views.json" \
  /Users/rccurtrightjr./projects/fusion-home/ai/system/workspace/views.json \
  /Users/rccurtrightjr./projects/media-editor/ai/system/workspace/views.json \
  /Users/rccurtrightjr./projects/solobooks/ai/system/workspace/views.json
```

Confirm each registry includes `chat`:

```bash
node -e "for (const file of process.argv.slice(1)) { const json = require(file); if (!json.views.some((view) => view.id === 'chat' && view.source === 'custom' && view.enabled === true)) throw new Error('missing chat: ' + file); }" \
  /Users/rccurtrightjr./projects/fs-dev/ai/system/workspace/views.json \
  "/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/system/workspace/views.json" \
  /Users/rccurtrightjr./projects/fusion-home/ai/system/workspace/views.json \
  /Users/rccurtrightjr./projects/media-editor/ai/system/workspace/views.json \
  /Users/rccurtrightjr./projects/solobooks/ai/system/workspace/views.json
```

Run client build:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Run targeted server tests if available:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/ws/client-message-router.test.js test/thread/thread-messages.test.js
```

If the targeted test command is not valid for this repo, run the nearest existing server test command and report what was run.

Run targeted diff check for files touched in this slice. Avoid full `git diff --check` unless you also report the known pre-existing whitespace issue in `fusion-studio-server/lib/transcription/index.js:287`.

```bash
git diff --check -- \
  fusion-studio-client/src/lib/panels.ts \
  fusion-studio-server/lib/views/index.js \
  fusion-studio-server/server.js \
  fusion-studio-server/lib/workspace/bootstrap-service.js \
  fusion-studio-server/lib/workspace/create-service.js \
  ai/system/workspace/views.json \
  "System Source Files/ai/system/workspace/views.json"
```

For external workspace files outside this repo, validate with `node` parse checks and report paths changed.

## Manual Smoke

If builds/tests pass, restart the app using the normal repo flow and smoke these behaviors:

1. Open each registered workspace from the ribbon or plus dropdown.
2. Confirm the left navigation/view rail loads from the new registry.
3. Confirm labels/icons/order match the audit output, including duplicate rank tie-breaks being stable.
4. Confirm custom views remain listed where expected: `browser-viewer`, `custom-viewer`, `calendar-viewer`, and `chat`.
5. Confirm existing view content still opens from `ai/views/<view-id>/`.
6. Confirm workspaces without any future registry would still fall back to legacy folder scanning if tested with a temporary copy.

## Worker Final Response Requirements

Include:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- How each registered workspace path was confirmed.
- Files intentionally created or modified, including external workspace registry files.
- Confirmation that legacy `ai/views/index.json` files were preserved.
- Summary of panel discovery/code changes.
- Acceptance check results.
- Build/test results.
- Any manual smoke results, or why manual smoke was not run.
- Any deviations from the audit data or blockers encountered.

## Expected Outcome

Every registered workspace has a live `ai/system/workspace/views.json` registry, active panel discovery prefers it, legacy files remain as fallback, and Slice 4C Create New can be revised afterward to write the new paradigm directly.
