# Wiki Contract Slice 6: Default Workspace And Template Migration

## Objective

Convert the shipped/default workspace wiki trees and workspace templates to the canonical `Wiki/` + `PAGE.md` contract.

This slice migrates default/user-facing workspace content only. Do not migrate the internal `fs-dev` wiki in this slice; that is Slice 7.

## Source Roadmap

Read first:

- `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-5-system-source-files-migration.md`

Expected prior state:
- Active wiki viewer reads `ai/<machine>/Wiki`.
- System Source Files has already been migrated to `Wiki/`.

## Targets

Migrate these targets:

```text
/Users/rccurtrightjr./projects/Fusion-Home/ai/<machine>/Views/wiki-viewer
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/fusion-home/ai/<machine>/Views/wiki-viewer
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/project-repo/ai/<machine>/Views/wiki-viewer
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/media-studio/ai/<machine>/Views/wiki-viewer
/Users/rccurtrightjr./projects/solobooks/ai/<machine>/Views/wiki-viewer
/Users/rccurtrightjr./projects/media-editor/ai/<machine>/Views/wiki-viewer
```

Do not migrate this target yet:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Views/wiki-viewer
```

## Current Observed State

Observed before this handoff:
- `Fusion-Home/ai/<machine>/Views/wiki-viewer` has `content/`, `content.json`, `index.json`, `settings/`, `api.json`, `chat/`.
- `Fusion-Home/workspace-templates/*/ai/<machine>/Views/wiki-viewer` have similar `content/` structures.
- `solobooks/ai/<machine>/Views/wiki-viewer` has a fuller legacy wiki package with `content/`, `PROMPT.md`, `SPEC.md`, `WORKFLOW.md`, `runs/`, etc.
- `media-editor/ai/<machine>/Views/wiki-viewer` is skeletal and currently has only `content.json` and `index.json`.

## Path Safety Requirement

This slice creates and may move/copy wiki content. Search references before moving/deleting anything.

For each target, search for:

```text
ai/<machine>/Wiki
content/index.json
topics.json
PAGE.md
```

Also search workspace/template-specific paths before deleting old `content/` folders.

Do not delete old `content/` folders unless all references are understood and the report explicitly states deletion is safe. It is acceptable to leave old `content/` folders temporarily for Slice 8 cleanup.

## Canonical Contract

Each target should have:

```text
ai/<machine>/Wiki/
├── PAGE.md
└── 001-Section_Name/
    ├── PAGE.md
    └── 001-Article_Name/
        └── PAGE.md
```

Use deeper right-sidebar folders only where useful:

```text
001-Article_Name/
└── 001-Right_Sidebar_Section/
    ├── PAGE.md
    └── 001-Nested_Article/
        └── PAGE.md
```

## Naming Rules

- Use numeric prefixes for ordering.
- Use underscores for spaces.
- Preserve dashes only where semantically meaningful.
- Avoid `&`; use `And`.
- Do not add JSON indexes for primary navigation.

Examples:
- `001-Home`
- `001-Getting_Started`
- `002-Workspaces_Explained`
- `001-Asset_Pipeline`

## Migration Guidance By Target

### Fusion Home Active Workspace

Source content currently includes a small home collection:

```text
content/home/getting-started/PAGE.md
content/home/workspaces-explained/PAGE.md
```

Suggested target:

```text
Wiki/
├── PAGE.md
└── 001-Home/
    ├── PAGE.md
    ├── 001-Getting_Started/
    │   └── PAGE.md
    └── 002-Workspaces_Explained/
        └── PAGE.md
```

`Wiki/PAGE.md` should orient the user to Fusion Home as the default shipped workspace.

### Fusion Home Template

Mirror the active Fusion Home wiki shape unless there is a clear template-specific reason to differ.

Target:

```text
workspace-templates/fusion-home/ai/<machine>/Wiki/
```

### Project Repo Template

Source content currently has `project/getting-started/PAGE.md`.

Suggested target:

```text
Wiki/
├── PAGE.md
└── 001-Project/
    ├── PAGE.md
    └── 001-Getting_Started/
        └── PAGE.md
```

### Media Studio Template

Source content currently has `media/asset-pipeline/PAGE.md`.

Suggested target:

```text
Wiki/
├── PAGE.md
└── 001-Media/
    ├── PAGE.md
    └── 001-Asset_Pipeline/
        └── PAGE.md
```

### Solobooks

Solobooks has a larger legacy `content/` tree. Convert enough to preserve current user-facing wiki value, but do not spend this slice perfecting every historical/dev topic if it becomes too large.

Minimum target sections:

```text
Wiki/
├── PAGE.md
├── 001-Project/
│   ├── PAGE.md
│   └── ... project article folders
├── 002-System_Tools/
│   ├── PAGE.md
│   └── ... system tool article folders
└── 003-Enforcement/
    ├── PAGE.md
    └── ... enforcement article folders
```

Preserve existing `PAGE.md` content where available. Keep `LOG.md` files if useful, but they are not primary navigation.

### Media Editor / Media Studio Active Workspace

`media-editor/ai/<machine>/Views/wiki-viewer` is skeletal. Create a minimal canonical `Wiki/` tree that matches the Media Studio template enough for the viewer to render.

Suggested target:

```text
Wiki/
├── PAGE.md
└── 001-Media/
    ├── PAGE.md
    └── 001-Asset_Pipeline/
        └── PAGE.md
```

If there is a different active Media Studio workspace path, document it and migrate that instead or in addition.

## Explicit Non-Goals

- Do not migrate `fs-dev` internal wiki.
- Do not change active wiki viewer code unless a migration bug is discovered.
- Do not change DB-backed Fusion overlay wiki behavior.
- Do not add/rely on JSON index navigation.
- Do not delete old `content/` trees unless reference searches prove it is safe.
- Do not move Text-To-Speech resources; that was handled in Slice 5.

## Verification Steps

1. Confirm each target has `Wiki/PAGE.md`.

2. Confirm each navigable folder has its own `PAGE.md`.

3. Search for old active references:

```text
ai/<machine>/Wiki
content/index.json
topics.json
```

Classify remaining references as:
- old retained content pending Slice 8 cleanup
- documentation/handoff references
- runtime references requiring immediate fix

4. Runtime/manual smoke if practical:

- Open Fusion Home wiki.
- Open Solobooks wiki.
- Open Media Studio/media-editor wiki.
- Confirm `Wiki Guide` loads.
- Confirm section/article pages load from `PAGE.md`.
- Confirm no missing-page errors for intentionally navigable folders.

5. If any code/scripts are touched, run syntax/build checks appropriate to those files.

## Report Back Format

When done, report:

- Targets migrated.
- Files/folders created, moved, copied, or deleted.
- Which old `content/` folders remain and why.
- Reference search results and classification.
- Verification performed and results.
- Any blockers for Slice 7.

## Success Criteria

- Each shipped/default target has a canonical `Wiki/` tree.
- Workspace templates create new workspaces with `Wiki/`, not only `content/`.
- Existing useful wiki content is preserved as `PAGE.md` files.
- No JSON index navigation is introduced.
- No fs-dev internal wiki migration occurs in this slice.
