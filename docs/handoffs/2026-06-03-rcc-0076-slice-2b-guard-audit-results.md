# RCC-0076 Slice 2B-Guard Audit Results

## Summary

- Registered workspace count: 5
- Workspaces with ai/views/index.json: 5
- Workspaces already using ai/system/workspace/views.json: 0
- Migration blockers: 0
- Migration warnings: 23 itemized warnings; primary risks are custom/unknown view folders and missing metadata in `chat` folders.
- Discovery method: read `fusion-studio-server/data/fusion.db` directly with `sqlite3`, querying the `workspaces` table ordered by `sort_order`.
- Scope note: this report is read-only. No workspace folders, view folders, registry JSON files, or SQLite data were changed.

## Registered Workspaces

| id | label | repoPath | exists | ai/views | legacy index | new registry |
|----|-------|----------|--------|----------|--------------|--------------|
| fs-dev | FS Dev | `/users/rccurtrightjr./projects/fs-dev` | yes | yes | yes | no |
| system-files | System Files | `/users/rccurtrightjr./projects/fs-dev/System Source Files` | yes | yes | yes | no |
| fusion-home | Fusion Home | `/users/rccurtrightjr./projects/fusion-home` | yes | yes | yes | no |
| media-editor | Media Editor | `/users/rccurtrightjr./projects/media-editor` | yes | yes | yes | no |
| solobooks | Solobooks | `/users/rccurtrightjr./projects/solobooks` | yes | yes | yes | no |

## Workspace Details

### fs-dev

**Registry row:** `id=fs-dev`, `label=FS Dev`, `type=code`, `sortOrder=0`, `ribbonVisible=1`, `ribbonSortOrder=0`, `repoPath=/users/rccurtrightjr./projects/fs-dev`.

**Current view folders:**

| folder | declared id | label | icon | rank | baseViewId | source | settings | content | notable config/files |
|--------|-------------|-------|------|------|------------|--------|----------|---------|----------------------|
| agents-viewer | agents-viewer | Agents | robot_2 | 5 | agents-viewer | default | yes | yes | `index.json`, `content.json`, `registry.json`, `AGENTS.md`, `settings/agents.json`, `settings/layout.json`, `settings/state.json` |
| browser-viewer | browser-viewer | Browser | public | 5 | browser-viewer | custom | no | no | `index.json`, `content.json` |
| chat | n/a | n/a | n/a | n/a | chat | custom | no | no | directory present; no `index.json` |
| custom-viewer | custom-viewer | Custom Viewer | app_registration | 99 | custom-viewer | custom | no | no | `index.json`, `content.json` |
| doc-viewer | doc-viewer | Docs | open_run | 0 | doc-viewer | optional | yes | yes | `index.json`, `content.json`, `settings/layout.json`, content includes `assets/`, `captures/`, `playground/`, `specs/` |
| file-viewer | file-viewer | Files | code_blocks | 1 | file-viewer | default | yes | no | `index.json`, `content.json`, `api.json`, `README.md`, `settings/layout.json` |
| issues-viewer | issues-viewer | Issues | business_messages | 3 | issues-viewer | default | yes | yes | `index.json`, `content.json`, `settings/layout.json`, `settings/state.json`, `content/sync.json`, `content/tickets.json` |
| wiki-viewer | wiki-viewer | Wiki | full_coverage | 4 | wiki-viewer | default | yes | yes | `index.json`, `content.json`, `api.json`, `PROMPT.md`, `SPEC.md`, `WORKFLOW.md`, `settings/layout.json`, `settings/state.json`, `settings/themes.css` |

**Legacy index summary:** `ai/views/index.json` is valid JSON with keys `version`, `id`, `folderName`, `label`, `description`, `type`, `icon`, `rank`, `sort`, `created`, `children`, and `settings`. It is not shaped as a `views` array registry, so migration should derive installed view instances from folders and per-view `index.json` files.

**Proposed views.json preview:**

```json
{
  "version": 1,
  "sort": "ranked",
  "views": [
    { "id": "doc-viewer", "baseViewId": "doc-viewer", "label": "Docs", "icon": "open_run", "rank": 0, "enabled": true, "source": "optional", "viewPath": "ai/views/doc-viewer" },
    { "id": "file-viewer", "baseViewId": "file-viewer", "label": "Files", "icon": "code_blocks", "rank": 1, "enabled": true, "source": "default", "viewPath": "ai/views/file-viewer" },
    { "id": "issues-viewer", "baseViewId": "issues-viewer", "label": "Issues", "icon": "business_messages", "rank": 3, "enabled": true, "source": "default", "viewPath": "ai/views/issues-viewer" },
    { "id": "wiki-viewer", "baseViewId": "wiki-viewer", "label": "Wiki", "icon": "full_coverage", "rank": 4, "enabled": true, "source": "default", "viewPath": "ai/views/wiki-viewer" },
    { "id": "agents-viewer", "baseViewId": "agents-viewer", "label": "Agents", "icon": "robot_2", "rank": 5, "enabled": true, "source": "default", "viewPath": "ai/views/agents-viewer" },
    { "id": "browser-viewer", "baseViewId": "browser-viewer", "label": "Browser", "icon": "public", "rank": 5, "enabled": true, "source": "custom", "viewPath": "ai/views/browser-viewer" },
    { "id": "custom-viewer", "baseViewId": "custom-viewer", "label": "Custom Viewer", "icon": "app_registration", "rank": 99, "enabled": true, "source": "custom", "viewPath": "ai/views/custom-viewer" },
    { "id": "chat", "baseViewId": "chat", "label": "chat", "icon": "folder", "rank": 3, "enabled": true, "source": "custom", "viewPath": "ai/views/chat" }
  ]
}
```

**Risks:** custom/unknown view types `browser-viewer`, `chat`, and `custom-viewer`; `chat` has no readable `index.json` and no label/icon/rank metadata; duplicate rank values exist (`agents-viewer` and `browser-viewer` both rank 5; `chat` fallback rank collides with `issues-viewer`).

**Migration notes:** Preserve all folders. Decide whether `chat` is a real view instance before generating a live registry, or intentionally include it as custom with fallback metadata.

### system-files

**Registry row:** `id=system-files`, `label=System Files`, `type=system`, `sortOrder=1`, `ribbonVisible=1`, `ribbonSortOrder=1`, `repoPath=/users/rccurtrightjr./projects/fs-dev/System Source Files`.

**Current view folders:**

| folder | declared id | label | icon | rank | baseViewId | source | settings | content | notable config/files |
|--------|-------------|-------|------|------|------------|--------|----------|---------|----------------------|
| agents-viewer | agents-viewer | Agents | robot_2 | 5 | agents-viewer | default | yes | no | `index.json`, `content.json`, `settings/layout.json` |
| chat | n/a | n/a | n/a | n/a | chat | custom | no | no | directory present; no `index.json` |
| file-viewer | file-viewer | Files | code_blocks | 1 | file-viewer | default | yes | no | `index.json`, `content.json`, `settings/layout.json` |
| issues-viewer | issues-viewer | Issues | business_messages | 3 | issues-viewer | default | yes | no | `index.json`, `content.json`, `settings/layout.json` |
| system-viewer | system-viewer | System | manufacturing | 5 | system-viewer | default | no | yes | `index.json`, `content.json`, `content/index.json`, `content/secrets/user.md` |
| wiki-viewer | wiki-viewer | Wiki | full_coverage | 4 | wiki-viewer | default | yes | yes | `index.json`, `content.json`, `settings/layout.json`, content includes `enforcement/` and `system/connectors/` |

**Legacy index summary:** `ai/views/index.json` is valid JSON with workspace-like top-level keys and no `views` array. Use folders and per-view `index.json` files as the migration source.

**Proposed views.json preview:**

```json
{
  "version": 1,
  "sort": "ranked",
  "views": [
    { "id": "file-viewer", "baseViewId": "file-viewer", "label": "Files", "icon": "code_blocks", "rank": 1, "enabled": true, "source": "default", "viewPath": "ai/views/file-viewer" },
    { "id": "issues-viewer", "baseViewId": "issues-viewer", "label": "Issues", "icon": "business_messages", "rank": 3, "enabled": true, "source": "default", "viewPath": "ai/views/issues-viewer" },
    { "id": "wiki-viewer", "baseViewId": "wiki-viewer", "label": "Wiki", "icon": "full_coverage", "rank": 4, "enabled": true, "source": "default", "viewPath": "ai/views/wiki-viewer" },
    { "id": "agents-viewer", "baseViewId": "agents-viewer", "label": "Agents", "icon": "robot_2", "rank": 5, "enabled": true, "source": "default", "viewPath": "ai/views/agents-viewer" },
    { "id": "system-viewer", "baseViewId": "system-viewer", "label": "System", "icon": "manufacturing", "rank": 5, "enabled": true, "source": "default", "viewPath": "ai/views/system-viewer" },
    { "id": "chat", "baseViewId": "chat", "label": "chat", "icon": "folder", "rank": 2, "enabled": true, "source": "custom", "viewPath": "ai/views/chat" }
  ]
}
```

**Risks:** custom/unknown view type `chat`; `chat` has no readable `index.json` and no label/icon/rank metadata; duplicate rank value 5 for `agents-viewer` and `system-viewer`.

**Migration notes:** This workspace appears to be scaffolding/template source. Keep it registered as a workspace, but do not treat `System Source Files` as the live source of truth for other workspaces.

### fusion-home

**Registry row:** `id=fusion-home`, `label=Fusion Home`, `type=code`, `sortOrder=2`, `ribbonVisible=1`, `ribbonSortOrder=2`, `repoPath=/users/rccurtrightjr./projects/fusion-home`.

**Current view folders:**

| folder | declared id | label | icon | rank | baseViewId | source | settings | content | notable config/files |
|--------|-------------|-------|------|------|------------|--------|----------|---------|----------------------|
| agents-viewer | agents-viewer | Agents | smart_toy | 5 | agents-viewer | default | yes | yes | `index.json`, `content.json`, `registry.json`, `settings/agents.json`, `settings/layout.json`, `settings/state.json` |
| calendar-viewer | calendar-viewer | Calendar | calendar_month | 1 | calendar-viewer | custom | yes | yes | `index.json`, `content.json`, content includes calendar build/spec chunk docs |
| chat | n/a | n/a | n/a | n/a | chat | custom | no | no | directory present; no `index.json` |
| file-viewer | file-viewer | Files | code_blocks | 1 | file-viewer | default | yes | no | `index.json`, `content.json`, `api.json`, `settings/layout.json` |
| issues-viewer | issues-viewer | Issues | business_messages | 3 | issues-viewer | default | yes | yes | `index.json`, `content.json`, `settings/layout.json`, `settings/state.json` |
| office-viewer | office-viewer | Office Viewer | clarify | 0 | office-viewer | optional | yes | yes | `index.json`, `content.json`, `settings/layout.json`, content contains a nested `.git/` directory |
| wiki-viewer | wiki-viewer | Wiki | full_coverage | 4 | wiki-viewer | default | yes | yes | `index.json`, `content.json`, `api.json`, `settings/layout.json`, `settings/state.json`, `settings/themes.css`, content includes `home/` topics |

**Legacy index summary:** `ai/views/index.json` is valid JSON with workspace-like top-level keys and no `views` array. Use folders and per-view `index.json` files as the migration source.

**Proposed views.json preview:**

```json
{
  "version": 1,
  "sort": "ranked",
  "views": [
    { "id": "office-viewer", "baseViewId": "office-viewer", "label": "Office Viewer", "icon": "clarify", "rank": 0, "enabled": true, "source": "optional", "viewPath": "ai/views/office-viewer" },
    { "id": "calendar-viewer", "baseViewId": "calendar-viewer", "label": "Calendar", "icon": "calendar_month", "rank": 1, "enabled": true, "source": "custom", "viewPath": "ai/views/calendar-viewer" },
    { "id": "file-viewer", "baseViewId": "file-viewer", "label": "Files", "icon": "code_blocks", "rank": 1, "enabled": true, "source": "default", "viewPath": "ai/views/file-viewer" },
    { "id": "issues-viewer", "baseViewId": "issues-viewer", "label": "Issues", "icon": "business_messages", "rank": 3, "enabled": true, "source": "default", "viewPath": "ai/views/issues-viewer" },
    { "id": "wiki-viewer", "baseViewId": "wiki-viewer", "label": "Wiki", "icon": "full_coverage", "rank": 4, "enabled": true, "source": "default", "viewPath": "ai/views/wiki-viewer" },
    { "id": "agents-viewer", "baseViewId": "agents-viewer", "label": "Agents", "icon": "smart_toy", "rank": 5, "enabled": true, "source": "default", "viewPath": "ai/views/agents-viewer" },
    { "id": "chat", "baseViewId": "chat", "label": "chat", "icon": "folder", "rank": 3, "enabled": true, "source": "custom", "viewPath": "ai/views/chat" }
  ]
}
```

**Risks:** custom/unknown view types `calendar-viewer` and `chat`; `chat` has no readable `index.json` and no label/icon/rank metadata; duplicate rank value 1 for `calendar-viewer` and `file-viewer`; `office-viewer/content/` contains a nested `.git/` directory that may be intentional but should not be copied blindly by future migration/scaffolding work.

**Migration notes:** Product docs list known view type `calendar`, but the live folder is `calendar-viewer`; under the requested inference rule this is custom because it does not exactly match `calendar` or end with `-calendar`.

### media-editor

**Registry row:** `id=media-editor`, `label=Media Editor`, `type=app`, `sortOrder=3`, `ribbonVisible=1`, `ribbonSortOrder=3`, `repoPath=/users/rccurtrightjr./projects/media-editor`.

**Current view folders:**

| folder | declared id | label | icon | rank | baseViewId | source | settings | content | notable config/files |
|--------|-------------|-------|------|------|------------|--------|----------|---------|----------------------|
| agents-viewer | agents-viewer | Agents | smart_toy | 4 | agents-viewer | default | no | no | `index.json`, `content.json` |
| chat | n/a | n/a | n/a | n/a | chat | custom | no | no | directory present; no `index.json` |
| doc-viewer | doc-viewer | Docs | description | 1 | doc-viewer | optional | no | no | `index.json`, `content.json` |
| file-viewer | file-viewer | Files | folder | 0 | file-viewer | default | no | no | `index.json`, `content.json` |
| issues-viewer | issues-viewer | Issues | bug_report | 2 | issues-viewer | default | no | no | `index.json`, `content.json` |
| wiki-viewer | wiki-viewer | Wiki | menu_book | 3 | wiki-viewer | default | no | no | `index.json`, `content.json` |

**Legacy index summary:** `ai/views/index.json` is valid JSON and contains a `views` array with 5 entries: `file-viewer`, `doc-viewer`, `issues-viewer`, `wiki-viewer`, and `agents-viewer`. The `chat` folder is present on disk but absent from the legacy index.

**Proposed views.json preview:**

```json
{
  "version": 1,
  "sort": "ranked",
  "views": [
    { "id": "file-viewer", "baseViewId": "file-viewer", "label": "Files", "icon": "folder", "rank": 0, "enabled": true, "source": "default", "viewPath": "ai/views/file-viewer" },
    { "id": "doc-viewer", "baseViewId": "doc-viewer", "label": "Docs", "icon": "description", "rank": 1, "enabled": true, "source": "optional", "viewPath": "ai/views/doc-viewer" },
    { "id": "issues-viewer", "baseViewId": "issues-viewer", "label": "Issues", "icon": "bug_report", "rank": 2, "enabled": true, "source": "default", "viewPath": "ai/views/issues-viewer" },
    { "id": "wiki-viewer", "baseViewId": "wiki-viewer", "label": "Wiki", "icon": "menu_book", "rank": 3, "enabled": true, "source": "default", "viewPath": "ai/views/wiki-viewer" },
    { "id": "agents-viewer", "baseViewId": "agents-viewer", "label": "Agents", "icon": "smart_toy", "rank": 4, "enabled": true, "source": "default", "viewPath": "ai/views/agents-viewer" },
    { "id": "chat", "baseViewId": "chat", "label": "chat", "icon": "folder", "rank": 2, "enabled": true, "source": "custom", "viewPath": "ai/views/chat" }
  ]
}
```

**Risks:** custom/unknown view type `chat`; `chat` has no readable `index.json` and no label/icon/rank metadata; `chat` is present as a folder but absent from `ai/views/index.json`; fallback rank for `chat` collides with `issues-viewer`.

**Migration notes:** This is the only audited workspace whose legacy index contains a proper `views` array. Future migration should decide whether to preserve legacy-index membership strictly, which would exclude `chat`, or include every installed folder, which would include it as custom.

### solobooks

**Registry row:** `id=solobooks`, `label=Solobooks`, `type=app`, `sortOrder=4`, `ribbonVisible=1`, `ribbonSortOrder=4`, `repoPath=/users/rccurtrightjr./projects/solobooks`.

**Current view folders:**

| folder | declared id | label | icon | rank | baseViewId | source | settings | content | notable config/files |
|--------|-------------|-------|------|------|------------|--------|----------|---------|----------------------|
| agents-viewer | agents-viewer | Agents | robot_2 | 5 | agents-viewer | default | yes | yes | `index.json`, `content.json`, `registry.json`, `AGENTS.md`, `settings/agents.json`, `settings/layout.json`, `settings/state.json` |
| chat | n/a | n/a | n/a | n/a | chat | custom | no | no | directory present; no `index.json` |
| file-viewer | file-viewer | Files | code_blocks | 1 | file-viewer | default | yes | no | `index.json`, `content.json`, `api.json`, `README.md`, `settings/layout.json` |
| issues-viewer | issues-viewer | Issues | business_messages | 3 | issues-viewer | default | yes | yes | `index.json`, `content.json`, `settings/layout.json`, `settings/state.json`, ticket markdown files, `content/sync.json`, `content/tickets.json` |
| office-viewer | office-viewer | Office Viewer | clarify | 0 | office-viewer | optional | yes | yes | `index.json`, `content.json`, `settings/layout.json` |
| wiki-viewer | wiki-viewer | Wiki | full_coverage | 4 | wiki-viewer | default | yes | yes | `index.json`, `content.json`, `api.json`, `PROMPT.md`, `SPEC.md`, `WORKFLOW.md`, `settings/layout.json`, `settings/state.json`, `settings/themes.css` |

**Legacy index summary:** `ai/views/index.json` is valid JSON with workspace-like top-level keys and no `views` array. Use folders and per-view `index.json` files as the migration source.

**Proposed views.json preview:**

```json
{
  "version": 1,
  "sort": "ranked",
  "views": [
    { "id": "office-viewer", "baseViewId": "office-viewer", "label": "Office Viewer", "icon": "clarify", "rank": 0, "enabled": true, "source": "optional", "viewPath": "ai/views/office-viewer" },
    { "id": "file-viewer", "baseViewId": "file-viewer", "label": "Files", "icon": "code_blocks", "rank": 1, "enabled": true, "source": "default", "viewPath": "ai/views/file-viewer" },
    { "id": "issues-viewer", "baseViewId": "issues-viewer", "label": "Issues", "icon": "business_messages", "rank": 3, "enabled": true, "source": "default", "viewPath": "ai/views/issues-viewer" },
    { "id": "wiki-viewer", "baseViewId": "wiki-viewer", "label": "Wiki", "icon": "full_coverage", "rank": 4, "enabled": true, "source": "default", "viewPath": "ai/views/wiki-viewer" },
    { "id": "agents-viewer", "baseViewId": "agents-viewer", "label": "Agents", "icon": "robot_2", "rank": 5, "enabled": true, "source": "default", "viewPath": "ai/views/agents-viewer" },
    { "id": "chat", "baseViewId": "chat", "label": "chat", "icon": "folder", "rank": 2, "enabled": true, "source": "custom", "viewPath": "ai/views/chat" }
  ]
}
```

**Risks:** custom/unknown view type `chat`; `chat` has no readable `index.json` and no label/icon/rank metadata.

**Migration notes:** Installed view metadata is otherwise complete. `issues-viewer` has active ticket content and should be preserved as-is.

## Cross-Workspace Findings

- All registered workspace `repoPath` values exist on disk.
- All registered workspaces have `ai/`, `ai/views/`, and `ai/views/index.json`.
- No workspace currently has `ai/system/workspace/views.json`, so the new registry path has no existing conflict.
- No invalid JSON was found in existing `ai/views/index.json` files or per-view `index.json` files that exist.
- No numeric-only duplicate prefixes such as `02-office-viewer` were found.
- No declared per-view `id` mismatches the containing folder name among views with `index.json`.
- `chat` appears in every workspace as an `ai/views/chat/` directory without per-view `index.json`, label, icon, or rank metadata.
- `browser-viewer`, `custom-viewer`, and `calendar-viewer` are custom/unknown under the requested known-view-type inference rules.
- Several workspaces use duplicate rank values. The migration generator should preserve declared ranks but may need stable tie-breaking by current folder order or legacy index order.

## Recommended Next Slice

Proceed with Slice 2B migration only after deciding how to treat metadata-less `chat` folders. The safest migration generator should read every registered workspace, create `ai/system/workspace/views.json` only when absent, preserve existing per-view labels/icons/ranks, include custom folders explicitly with `source: "custom"`, and use deterministic tie-breaking for duplicate ranks without renaming or deleting folders.
