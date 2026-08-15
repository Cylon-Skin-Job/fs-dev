# Wiki Contract Slice 7: fs-dev Internal Wiki Migration

## Objective

Migrate the internal `fs-dev` wiki to the canonical `Wiki/` + `PAGE.md` contract.

This is the development/internal wiki for the source repo. It is not shippable default user content, but it should follow the same wiki behavior so the app dogfoods the shipped contract.

## Source Roadmap

Read first:

- `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-6-default-workspace-template-migration.md`

Expected prior state:
- Active wiki viewer reads `ai/<machine>/Wiki`.
- Shipped/default workspaces and templates have `Wiki/` trees.
- System Source Files has `Wiki/` and TTS resources moved out of old wiki content.

## Target

Migrate only this target:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Views/wiki-viewer
```

Do not migrate or modify unrelated workspace wiki trees in this slice.

## Current Observed State

Current fs-dev wiki root:

```text
ai/<machine>/Views/<wiki-view-folder>/
├── api.json
├── chat/
├── content.json
├── content/
├── index.json
├── PROMPT.md
├── runs/
├── secrets/
├── settings/
├── SPEC.md
├── wire-protocol/
└── WORKFLOW.md
```

Current old content root:

```text
content/
├── enforcement/
├── index.json
├── project/
├── system-tools/
└── topics.json
```

Current major sections:
- `project/` with many internal dev articles.
- `system-tools/` with tool/how-to articles.
- `enforcement/` with code standards and themes/state rules.

Current metadata still points to old paths:

```json
"contentDir": "ai/<machine>/Wiki/project",
"systemWikiDir": "ai/<machine>/Wiki/system"
```

## Path Safety Requirement

Before moving/deleting anything, search references for:

```text
ai/<machine>/Wiki
ai/<machine>/Wiki/project
ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
content/project
content/system-tools
content/enforcement
topics.json
```

Classify references before changes:
- runtime/code reference requiring update
- docs/handoff reference
- old content pending Slice 8 cleanup
- historical reference that can remain

Do not delete old `content/` in this slice unless all references are resolved and deletion is explicitly safe. It is acceptable and likely preferable to leave old `content/` for Slice 8 cleanup.

## Target Layout

Create:

```text
ai/<machine>/Wiki/
├── PAGE.md
├── 001-Project/
│   ├── PAGE.md
│   └── ... migrated project article folders
├── 002-System_Tools/
│   ├── PAGE.md
│   └── ... migrated system tool article folders
└── 003-Enforcement/
    ├── PAGE.md
    └── ... migrated enforcement article folders
```

Use numeric prefixes for article ordering. Preserve dashes where meaningful. Use underscores for spaces. Avoid `&`; use `And`.

## Priority Content To Preserve

Migrate these as high priority:

Project section:
- `home`
- `chat`
- `model-config`
- `path-resolution`
- `progressive-disclosure`
- `workspace-agent-model`
- `workspace-index`
- `workspaces`
- `wiki-interface`
- `wiki-system`
- `Coding-CLIs`
- `browser_views`

System Tools section:
- `custom-theme-css`
- `secrets-manager`

Enforcement section:
- `code-standards`
- `themes-and-state`

If time permits, migrate all remaining project articles:
- `background-agents`
- `background-services-audit`
- `chat-panel-architecture`
- `chat-thread-lifecycle`
- `gitlab`
- `hooks`
- `run-auditing`
- `screenshot-capture`
- `setup-wizard`
- `ticket-routing`
- `warmth-settings`

## Deep/Nested Content Policy

Some fs-dev articles have nested architecture/reference folders. Preserve useful nested content under the relevant article as right-sidebar folders/articles using the canonical model:

```text
Article/
├── PAGE.md
└── 001-Reference_Section/
    ├── PAGE.md
    └── 001-Nested_Article/
        └── PAGE.md
```

Do not flatten everything if the existing hierarchy carries meaning.

Do not keep old article `index.json` files as navigation metadata in the new `Wiki/` tree.

## Metadata Update

Update:

```text
ai/<machine>/Views/<wiki-view-folder>/index.json
```

Target settings:

```json
"contentDir": "ai/<machine>/Wiki",
"systemWikiDir": "ai/<machine>/Wiki"
```

Do not change unrelated metadata unless necessary.

## Important Internal Reference

Many docs/handoffs refer to the old code standards path:

```text
ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Do not attempt to update every historical handoff. But do identify and update any active/current docs where the path is used as an instruction source rather than history.

At minimum, report the new canonical path for code standards.

Suggested new path:

```text
ai/<machine>/Wiki/003-Enforcement/001-Code_Standards/PAGE.md
```

## Explicit Non-Goals

- Do not migrate default workspace/template wikis; Slice 6 handled those.
- Do not delete old `content/` unless reference checks prove it safe.
- Do not change active wiki viewer code unless a migration bug is discovered.
- Do not alter DB-backed Fusion overlay wiki behavior.
- Do not add JSON index navigation.
- Do not update every historical handoff/doc reference unless it is active guidance.

## Verification Steps

1. Confirm root exists:

```text
ai/<machine>/Wiki/PAGE.md
```

2. Confirm every directory under new `Wiki/` has `PAGE.md`.

3. Validate modified JSON metadata parses.

4. Search new `Wiki/` markdown for stale primary-navigation references:

```text
content/index.json
topics.json
_Guide.md
ai/<machine>/Wiki
```

5. Classify remaining repo-wide old path references:

```text
ai/<machine>/Wiki
```

6. Runtime/manual smoke if practical:

- Open fs-dev workspace.
- Open Wiki view.
- Confirm `Wiki Guide` loads.
- Confirm Project/System Tools/Enforcement sections render.
- Confirm migrated article pages load from `PAGE.md`.
- Confirm code standards page loads at the new canonical path.

## Report Back Format

When done, report:

- Files/folders created, moved, copied, or deleted.
- Sections/articles migrated.
- New canonical code standards path.
- Whether old `content/` remains and why.
- Reference search results and classification.
- Verification performed and results.
- Any blockers for Slice 8.

## Success Criteria

- `fs-dev/ai/<machine>/Wiki/PAGE.md` exists.
- Internal fs-dev wiki renders using the same canonical `Wiki/` contract.
- High-priority internal docs are preserved as `PAGE.md` files.
- `index.json` metadata points at `Wiki`.
- No JSON index navigation is introduced.
- Old `content/` is either safely removed or documented as retained for Slice 8 cleanup.
