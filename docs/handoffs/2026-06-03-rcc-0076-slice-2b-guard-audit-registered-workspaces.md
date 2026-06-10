# Worker Handoff: RCC-0076 Slice 2B-Guard - Audit Registered Workspaces Before View Registry Migration

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

The tree is expected to be dirty. Inspect before working and do not overwrite unrelated changes.

## Required Reading

Read these before working:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-2a-ribbon-membership-model.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Goal

Audit every currently registered workspace before migrating the live view registry from `ai/views/index.json` to `ai/system/workspace/views.json`.

This slice is a guardrail. It should discover what exists and produce a migration-ready report. Do not migrate, rename, delete, or recreate any view folders in this slice.

## Why This Guard Exists

The future paradigm is:

```text
ai/system/workspace/views.json   <- live workspace view registry
ai/system/state/workspace.json   <- active/ephemeral workspace state if needed
ai/views/<view-id>/              <- actual view content folders
System Source Files/             <- scaffolding/template source only
```

Current workspaces may still use:

```text
ai/views/index.json
ai/views/<view-id>/index.json
```

Existing demo/dev workspaces may contain live view folders, partial features, custom labels, icons, ranks, and content/config files. We need an inventory before changing the source of truth.

## Edit Scope

Primary output:

```text
docs/handoffs/2026-06-03-rcc-0076-slice-2b-guard-audit-results.md
```

Read-only source scope:

```text
fusion-studio-server/lib/workspace/registry-service.js
fusion-studio-server/lib/workspace/workspace-controller.js
fusion-studio-server/data/fusion.db
<each registered workspace repoPath>/ai/views/**
<each registered workspace repoPath>/ai/system/**
```

Support scope only if you create a temporary helper script and remove it before finishing:

```text
/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/opencode/
```

Do not create scripts in the repo unless absolutely necessary. Prefer direct Node one-liners or existing DB/query modules.

## Non-Goals

- Do not create `ai/system/workspace/views.json` yet.
- Do not migrate any registry data.
- Do not rename view folders.
- Do not delete folders or files.
- Do not edit `ai/views/index.json`.
- Do not modify SQLite data.
- Do not implement left-nav context menus.
- Do not implement Create New scaffolding.
- Do not change ribbon behavior.

## Task

### 1. Identify all registered workspaces

List all registered workspaces from the current workspace registry.

Use the safest available method. Options:

- Query the `workspaces` table from `fusion-studio-server/data/fusion.db`.
- Use existing registry modules if easy.
- If neither works, inspect current server data/config files and report the limitation.

For each registered workspace, record:

```text
id
label
type
repoPath
sortOrder
ribbonVisible
ribbonSortOrder
exists on disk: yes/no
has ai/: yes/no
has ai/views/: yes/no
has ai/views/index.json: yes/no
has ai/system/workspace/views.json: yes/no
```

### 2. Inspect each workspace's current view registry

For each workspace with `ai/views/`, inspect:

```text
ai/views/index.json
ai/views/<folder>/index.json
ai/views/<folder>/settings/**
ai/views/<folder>/content/**
```

Do not read huge content files in full. Record presence and summarize structure.

For each view folder, record:

```text
folderName
declared id from index.json, if any
declared label, if any
declared icon, if any
declared rank/order, if any
baseViewId inference candidate
enabled/visible state, if discoverable
has settings directory: yes/no
has content directory: yes/no
notable config files
```

### 3. Compare current state to proposed schema

For each workspace, propose what `ai/system/workspace/views.json` would contain without writing it.

Use the proposed schema:

```json
{
  "version": 1,
  "sort": "ranked",
  "views": [
    {
      "id": "file-viewer",
      "baseViewId": "file-viewer",
      "label": "Code",
      "icon": "code_blocks",
      "rank": 1,
      "enabled": true,
      "source": "default",
      "viewPath": "ai/views/file-viewer"
    }
  ]
}
```

For `baseViewId`, use this inference rule for the report only:

- If folder name exactly matches a known view type, `baseViewId = folderName`.
- If folder name ends with `-<known-view-type>`, use the longest matching known suffix.
- Otherwise, `baseViewId = folderName` and `source = custom`.

Known view types:

```text
file-viewer
wiki-viewer
issues-viewer
agents-viewer
system-viewer
email
calendar
todo
doc-viewer
office-viewer
library
media-editor
```

### 4. Identify migration risks

For each workspace, flag:

- Missing `ai/` or `ai/views/`.
- Invalid or unreadable JSON.
- Duplicate view ids.
- Folder name/id mismatch.
- Missing labels/icons/ranks.
- Numeric-only duplicate prefixes like `02-office-viewer`.
- Existing `ai/system/workspace/views.json` that would already conflict.
- Views present in folders but absent from `ai/views/index.json`.
- Views present in `ai/views/index.json` but missing folders.
- Any custom or unknown view types.

### 5. Write the audit report

Create:

```text
docs/handoffs/2026-06-03-rcc-0076-slice-2b-guard-audit-results.md
```

Report format:

```markdown
# RCC-0076 Slice 2B-Guard Audit Results

## Summary

- Registered workspace count:
- Workspaces with ai/views/index.json:
- Workspaces already using ai/system/workspace/views.json:
- Migration blockers:
- Migration warnings:

## Registered Workspaces

| id | label | repoPath | exists | ai/views | legacy index | new registry |
|----|-------|----------|--------|----------|--------------|--------------|

## Workspace Details

### <workspace id>

**Registry row:** ...
**Current view folders:** ...
**Legacy index summary:** ...
**Proposed views.json preview:**
```json
...
```
**Risks:** ...
**Migration notes:** ...

## Recommended Next Slice

...
```

Keep previews concise. If a workspace has many views, include enough to prove the mapping and summarize the rest.

## Acceptance Checks

Run from repo root:

```bash
test -f docs/handoffs/2026-06-03-rcc-0076-slice-2b-guard-audit-results.md
```

Expected result: exit code 0.

Run:

```bash
rg -n "^## Summary|^## Registered Workspaces|^## Workspace Details|^## Recommended Next Slice" docs/handoffs/2026-06-03-rcc-0076-slice-2b-guard-audit-results.md
```

Expected result: all required sections found.

Run:

```bash
git diff --name-only
```

Expected result: the only intentional new file from this slice is:

```text
docs/handoffs/2026-06-03-rcc-0076-slice-2b-guard-audit-results.md
```

Pre-existing dirty files may appear. Report them, but do not modify them.

Run:

```bash
git diff --check -- docs/handoffs/2026-06-03-rcc-0076-slice-2b-guard-audit-results.md
```

Expected result: no output.

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after work.
- How registered workspaces were discovered.
- Count of registered workspaces audited.
- Count of workspaces with legacy `ai/views/index.json`.
- Count of workspaces already using `ai/system/workspace/views.json`.
- Any migration blockers.
- Any files intentionally created or modified.
- Acceptance check results.
- Any limitations in the audit.

## Expected Outcome

The orchestrator receives a reliable inventory of all registered workspaces and their current view registry state. No live workspace data is changed. The next implementation slice can safely generate `ai/system/workspace/views.json` using the audit results.
