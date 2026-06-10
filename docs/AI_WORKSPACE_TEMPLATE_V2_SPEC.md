# AI Workspace Template V2 Spec

## 1. Purpose

Fusion Studio is moving from the current mixed `ai/` folder shape to a canonical workspace template that separates machine-scoped work product, view layout/state, system setup assets, and shareable AI collaboration artifacts.

The canonical source template will live in:

```text
System Source Files/ai-template/
```

New workspaces will receive an `ai/` folder copied from this template, filtered by user-selected views and setup choices.

The experimental working shape currently being sketched is:

```text
System Source Files/ai-v2/RC-MacAir-15/
```

This spec captures the target paradigm and migration concerns. It does not require all code to change at once.

## 2. Core Principles

- `ai/<user-machine>/` is the root of machine-scoped AI workspace state and work product.
- View folders govern layout, display rank, appearance, and UI state.
- View data is independent from view definitions.
- Folder order is filesystem-native using numeric prefixes like `001-wiki-viewer`.
- The server should scan the `Views/` folder to derive workspace view order.
- Per-view state lives inside that view folder, not in a generic global state file.
- Repo-local AI artifacts are user/AI accessible work product unless explicitly protected by app policy.
- The protected Electron database remains canonical infrastructure; repo-local mirrors are optional projections/work product.

## 3. Target Folder Shape

```text
ai/
  <user-machine>/
    System/
    Views/
    Chat/
    Runs/
    Skills/
    Wiki/
    Agents/
    Issues/
    Data/
    Prompts/
    Tools/
    Scripts/
```

Current prototype folder:

```text
System Source Files/ai-v2/RC-MacAir-15/
  System/
  Views/
  Chat/
  Runs/
  Skills/
  Wiki/
  Agents/
  Issues/
  Data/
  Prompts/
  Tools/
  Scripts/
```

## 4. Category Responsibilities

| Folder | Responsibility |
|--------|----------------|
| `System/` | Workspace system contracts, setup metadata, internal instructions, app-readable configuration. |
| `Views/` | View registration, display order, layout, appearance, and per-view UI state. |
| `Chat/` | Human-readable chat audit exports, including `CHAT.md` per thread. |
| `Runs/` | Agent/workflow run records, snapshots, validation, review, and evidence. |
| `Skills/` | Workspace skills, using canonical skill document files. |
| `Wiki/` | Workspace wiki knowledge, using folder-first `PAGE.md` conventions. |
| `Agents/` | Agent definitions and setup files. |
| `Issues/` | Tickets, setup checklists, planning items, and workflow issues. |
| `Data/` | Optional repo-local mirror databases and generated indexes. |
| `Prompts/` | Personas and session-start prompt packs that can be loaded into chat. |
| `Tools/` | Terminal tool definitions or tool manifests loadable at chat/session start. |
| `Scripts/` | User/AI accessible scripts for setup, sync, migration, and workflow automation. |

## 5. View Paradigm

`Views/` replaces central view registry/order files as the primary source of view order.

Example:

```text
Views/
  001-wiki-viewer/
    styles/
      layout.json
    state/
      state.json
  002-file-viewer/
    styles/
      layout.json
    state/
      state.json
```

Rules:

- Numeric prefix controls display rank.
- Folder name after the prefix is the view identity, such as `wiki-viewer` or `file-viewer`.
- `styles/layout.json` stores display metadata such as icon, default panel behavior, visual layout, and view appearance defaults.
- `state/state.json` stores per-view UI state such as widths, selected item, open files, browser tabs, expanded folders, or similar view-specific state.
- View data does not live inside `Views/` unless it is layout/state for that view.
- Wiki data belongs in `Wiki/`, not `Views/001-wiki-viewer/`.
- Chat audits belong in `Chat/`, not a navigable `chat` view folder.

## 6. View Reordering

Fusion Studio now has UI logic for right-click move up/down view ordering. That logic must be converted to the new filesystem-order paradigm.

Target behavior:

- Moving a view up/down renames numeric folder prefixes inside `Views/`.
- The server rescans `Views/` and emits the new order.
- Rename operations must preserve the semantic view id after the prefix.
- Example: moving `002-file-viewer` above `001-wiki-viewer` produces:

```text
Views/
  001-file-viewer/
  002-wiki-viewer/
```

Implementation requirements:

- Use safe rename logic to avoid collisions.
- Preserve per-view `styles/` and `state/` folders during reordering.
- Update any persisted references that include the prefixed folder path.
- Prefer stable semantic ids in runtime state so reordering does not break view identity.

## 7. New Workspace Setup

When a new workspace is created, Fusion Studio should copy the canonical template into the new project root as `ai/`.

Source:

```text
System Source Files/ai-template/
```

Destination:

```text
<new-project-root>/ai/
```

Setup behavior:

- Copy the canonical template into the workspace root.
- Omit views the user did not select during workspace creation.
- Keep selected view folders ordered with numeric prefixes.
- Copy matching data folders and starter content needed by selected views.
- Preserve required setup skills, setup tickets, and setup workflows.
- Avoid copying machine-specific runtime state unless it is explicitly part of the selected template.

Existing copy logic already exists in the app, but it needs to be tightened to match this new paradigm.

## 8. Canonical `ai-template`

We need to inspect and consolidate:

- Current working `ai/` folder.
- Existing workspace templates.
- `System Source Files` defaults.
- Current prototype `System Source Files/ai-v2/RC-MacAir-15/`.

Then create one canonical template:

```text
System Source Files/ai-template/
```

The canonical template should include:

- Default machine/user folder placeholder or setup token.
- Default `Views/` folders for shipped views.
- Default `styles/layout.json` per view.
- Default empty or starter `state/state.json` per view.
- Default `Wiki/` starter content.
- Default setup tickets under `Issues/`.
- Default workspace setup skill under `Skills/`.
- Default prompt packs under `Prompts/`.
- Default tool manifests under `Tools/`.
- Default setup/migration scripts under `Scripts/`.

## 9. Workspace Setup Skill

Ship a single workspace-setup skill in the template.

Purpose:

- Orient the AI inside a newly created workspace.
- Point the AI to `System Source Files` for additional skills/templates/reference material.
- Explain the new `ai/<user-machine>/` folder structure.
- Explain how to determine which views are active by scanning `Views/`.
- Explain that view data is independent from view layout/state.
- Explain which setup questions to ask the user instead of guessing.

Questions the setup skill should ask:

- Which views should be active?
- Should workspace mirror DB creation be enabled?
- Which tables/modules should be mirrored into `Data/workspace.db`?
- Should chat audit markdown be generated/shared?
- Which agents should be installed?
- Which scripts/tools should be available at chat session start?
- Should starter wiki content be created or left minimal?

## 10. Setup Tickets

The template should include setup tickets/checklists under `Issues/`.

Potential tickets:

- Workspace setup checklist.
- Mirror DB setup checklist.
- Wiki setup checklist.
- Agent setup checklist.
- Scripts/tools setup checklist.
- Prompt/persona setup checklist.
- View selection and order verification.

These tickets should be practical work items that guide a user or AI through finalizing the workspace after template copy.

## 11. Prompt, Tool, And Script Loading

`Prompts/`, `Tools/`, and `Scripts/` support chat-session startup customization.

Target behavior:

- `Prompts/` stores personas and reusable prompt packs.
- `Tools/` stores terminal tool definitions/manifests that can be loaded at chat start.
- `Scripts/` stores executable or documented scripts for setup, sync, migration, and workspace tasks.
- Chat session startup can discover these folders and offer or load selected assets.

Open questions:

- Which file names should be canonical for prompt packs?
- Which file names should be canonical for tools?
- Should scripts be directly executable, documented wrappers, or both?
- Should session startup auto-load defaults or ask the user?

## 12. Migration Plan

This should happen piece by piece.

1. Finalize the target folder schema in `System Source Files/ai-v2/RC-MacAir-15/`.
2. Audit the current working `ai/` folder and existing templates.
3. Create `System Source Files/ai-template/` as the canonical source.
4. Update workspace creation to copy from `ai-template` into `<project-root>/ai/`.
5. Add filtering so unselected views are omitted.
6. Update server view discovery to scan `ai/<user-machine>/Views/`.
7. Convert view order move up/down logic to rename numeric prefixes.
8. Move per-view layout/state from global state files into `Views/<viewer>/styles/` and `Views/<viewer>/state/`.
9. Convert existing wiki/chat/issues/skills/agents/data references to the new category folders.
10. Remove obsolete central registry/state assumptions after migration is complete.

## 13. Open Decisions

- Should the repo root folder be `ai/<user-machine>/...` or should the machine folder be optional for single-user workspaces?
- Should canonical template paths use uppercase category folders or lowercase folders?
- Should `Views/<viewer>/styles/layout.json` include icon, label, default width, and active/enabled flags?
- Should view selection during setup delete unselected template folders or mark them inactive?
- Should `Data/workspace.db` be created immediately or only after the user enables mirroring?
- Should `Prompts/`, `Tools/`, and `Scripts/` have required manifest files?
- Should setup tickets be copied for every workspace or only when setup is incomplete?
