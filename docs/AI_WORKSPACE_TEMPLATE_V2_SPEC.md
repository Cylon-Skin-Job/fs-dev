# AI Workspace Template V2 Spec

## 1. Purpose

Fusion Studio is moving from the current mixed `ai/` folder shape to a canonical workspace template that separates machine-scoped work product, view layout/state, system setup assets, and shareable AI collaboration artifacts.

The canonical source template will live in:

```text
System Source Files/ai-template/
```

New workspaces will receive an `ai/` folder copied from this template, filtered by user-selected views and setup choices.

During this build, `System Source Files/ai-v2/RC-MacAir-15/` is the working prototype. Once the v2 build is complete, trim/consolidate the prototype into `System Source Files/ai-template/`; `ai-template` becomes the only canonical source for new workspace `ai/` folders.

The experimental working shape currently being sketched is:

```text
System Source Files/ai-v2/RC-MacAir-15/
```

This spec captures the target paradigm and migration concerns. It does not require all code to change at once.

## 2. Core Principles

- `ai/<user-machine>/` is the root of machine-scoped AI workspace state and work product.
- The local machine name is stored in Fusion Studio's protected Electron SQLite database and determines which `ai/<machine>/` folder this running app instance owns.
- The server only uses the configured local machine folder for active local workspace behavior and ignores other `ai/<machine>/` folders except when a feature explicitly browses shared/cross-machine artifacts.
- View folders govern layout, display rank, appearance, and UI state.
- View data is independent from view definitions.
- Folder order is filesystem-native using numeric prefixes like `001-wiki-viewer`.
- The server should scan the `Views/` folder to derive workspace view order.
- Per-view state lives inside that view folder, not in a generic global state file.
- Repo-local AI artifacts are user/AI accessible work product unless explicitly protected by app policy.
- The protected Electron database remains canonical infrastructure; repo-local mirrors are optional projections/work product.
- Chat history, active thread resume state, and harness session binding are local-machine state owned by the protected Electron database. Repo-local chat files are audit mirrors/work product, not an import source for Electron's internal chat database.
- Other `ai/<machine>/` folders can be committed and shared so collaborators can inspect process, agents, wiki, issues, runs, and audit artifacts from another machine without merging those artifacts into local runtime state.

## 3. Target Folder Shape

```text
ai/
  <user-machine>/
    System/
    Views/
    Docs/
    Office/
    Skills/
    Wiki/
    Agents/
    Issues/
    Data/
      Chatlogs/
      Runs/
      Workspace-db/
    Prompts/
    Tools/
    Scripts/
```

Current prototype folder:

```text
System Source Files/ai-v2/RC-MacAir-15/
  System/
  Views/
  Docs/
  Office/
  Skills/
  Wiki/
  Agents/
  Issues/
  Data/
    Chatlogs/
    Runs/
    Workspace-db/
  Prompts/
  Tools/
  Scripts/
```

## 4. Category Responsibilities

| Folder | Responsibility |
|--------|----------------|
| `System/` | Workspace system contracts, setup metadata, universal styles, workspace-level state, internal instructions, and app-readable configuration. |
| `Views/` | View registration, display order, layout, appearance, and per-view UI state. |
| `Docs/` | Workspace document work product, including captures, draft specs, todos, playground notes, assets, screenshots, and document-like material displayed by document-oriented views. |
| `Office/` | Workspace office/document data for `office-viewer`; starts empty in the template. |
| `Skills/` | Workspace skills, using canonical skill document files. |
| `Wiki/` | Workspace wiki knowledge, using folder-first `PAGE.md` conventions. |
| `Agents/` | Agent definitions and setup files. |
| `Issues/` | Tickets, setup checklists, planning items, and workflow issues. |
| `Data/` | Repo-local generated/work-product data, including chat logs, runs, optional mirror databases, and generated indexes. |
| `Data/Chatlogs/` | Human-readable chat audit exports/transcripts. These are mirrors/work product, not the Electron chat database. |
| `Data/Runs/` | Agent/workflow run records, snapshots, validation, review, and evidence. |
| `Data/Workspace-db/` | Repo-local mirror database location. `workspace.db` is created during workspace creation and kept size-bounded. |
| `Prompts/` | Personas and session-start prompt packs that can be loaded into chat. |
| `Tools/` | Terminal tool definitions or tool manifests loadable at chat/session start. |
| `Scripts/` | User/AI accessible scripts for setup, sync, migration, and workflow automation. |

## 4.1 Local Machine Identity And Cross-Machine Folders

Fusion Studio needs a database-backed local machine identity registry.

Requirements:

- Store the local machine name in the protected Electron SQLite database.
- Provide a registration/setup flow for first run.
- Provide a controlled way to rename/change the local machine name later.
- Sanitize the machine name for filesystem use.
- Bind the running server instance to exactly one local machine folder: `ai/<local-machine>/`.
- Ignore sibling folders under `ai/` for active local behavior unless a feature explicitly supports cross-machine browsing.

Example:

```text
ai/
  RC-MacAir-15/       ← local folder on this Mac
  Studio-Server/      ← another machine's pushed workspace artifacts
  Collaborator-MBP/   ← collaborator's pushed workspace artifacts
```

The local server should operate only from the configured local folder:

```text
ai/RC-MacAir-15/
```

Other machine folders are shared artifacts. They can be viewed, audited, compared, copied from, or used by explicit cross-machine features, but they do not become local runtime state automatically.

Chat/session boundary:

- Local chat history and resumable thread metadata live in Electron SQLite and are bound to the local machine identity.
- Harnesses also have local/session-internal state, so a thread created by a server machine is not assumed resumable on a laptop machine.
- Repo-local `Data/Chatlogs/` files are audit/export mirrors of what happened on that machine.
- Fusion Studio must not import another machine's repo-local chat history into the local Electron chat database automatically.

Collaboration model:

- A machine can push its `ai/<machine>/` folder so others can inspect its agents, wiki, issues, runs, and audit trail.
- A user may manually copy selected artifacts, such as wiki pages, between machine folders.
- Pulling another machine's folder does not change the local machine identity or local runtime database.

## 4.2 Issues Sources Across Machines And APIs

`issues-viewer` should support multiple issue sources as tabs.

Required tabs:

- `Local` — issues from the configured local machine folder.
- `GitHub` — issues fetched fresh from the GitHub API when the tab/view is opened or refreshed.
- `GitLab` — issues fetched fresh from the GitLab API when the tab/view is opened or refreshed.
- One tab per other machine folder that contains an `Issues/` folder.

Behavior:

- Local issues are local filesystem/Electron-local workflow state and can drive autonomous local agents on this machine only.
- GitHub and GitLab issues are shared remote issue sources. Interactions with those tickets use their APIs instead of local markdown storage.
- Other machine tabs are sourced from synced repo-local `ai/<machine>/Issues/` trees and appear only when that machine folder has an `Issues/` folder.
- Other machine issue folders are shared artifacts by default. Write/ingest behavior should be explicit so another machine's local workflow is not mutated accidentally.
- This enables one machine to push tickets into another machine's `Issues/` folder, then use a shared GitHub/GitLab issue or hook to tell the target machine to pull and ingest/execute its local tickets.

Future ticket notification behavior:

- `@notify` is the single notification tag.
- Tickets tagged `@notify` appear in the bell icon notification menu in the app header.
- The bell menu can show notifications across workspaces.
- Each notification group should include a `Go to chat` action.
- `Go to chat` switches to the ticket's workspace and sends a message in that workspace's chat to handle the selected notifications.
- Agents remain workspace-scoped; a workspace chat should not handle notifications from another workspace.

New chat behavior:

- When the user clicks `New Chat` inside a workspace, Fusion Studio checks that local workspace's new/unhandled `@notify` tickets.
- If there are new local `@notify` tickets, the chat input should show a light placeholder/prefill:

```text
Let's handle our {{number}} @notify tickets...
```

- As soon as the user starts typing, the placeholder/prefill is replaced.
- After the user clears/dismisses this new-chat notification prompt once, it should not appear again for the same notification set.
- The bell remains the durable place to view notifications.
- Server-side notification selection/context injection must respect workspace scope and source-specific ticket permissions.

## 5. View Paradigm

`Views/` replaces central view registry/order files as the primary source of view order.

Example:

```text
Views/
  001-wiki-viewer/
    manifest.md
    state/
      state.json
    styles/
      layout.css
      icon.md
  002-file-viewer/
    manifest.md
    state/
      state.json
    styles/
      layout.css
      icon.md
```

Rules:

- Numeric prefix controls display rank.
- Folder name after the prefix is the view identity, such as `wiki-viewer` or `file-viewer`.
- `manifest.md` stores view identity and base-level behavior using the same YAML frontmatter delimiter convention as Wiki `PAGE.md` files.
- `state/state.json` stores per-view UI state such as widths, selected item, open files, browser tabs, expanded folders, or similar view-specific state.
- `styles/layout.css` stores view-specific styling for the view shell/presentation.
- `styles/icon.md` stores the left-side nav icon declaration using the same YAML frontmatter delimiter convention as Wiki `PAGE.md` files.
- View data does not live inside `Views/` unless it is layout/state for that view.
- Wiki data belongs in `Wiki/`, not `Views/001-wiki-viewer/`.
- Docs data belongs in `Docs/`, not `Views/001-doc-viewer/`.
- Chat audits belong in `Data/Chatlogs/`, not a navigable `chat` view folder.

Canonical default shipped view order:

```text
001-browser-viewer
002-doc-viewer
003-office-viewer
004-library-viewer
005-media-viewer
006-email-viewer
007-calendar-viewer
008-contacts-viewer
009-custom-viewer
010-file-viewer
011-issues-viewer
012-wiki-viewer
013-agents-viewer
```

When `Add Project` or `Create New Project` copies selected views from the template, it should preserve this relative order but renumber the selected set compactly from `001-`. For example, selecting only `file-viewer`, `issues-viewer`, `wiki-viewer`, and `agents-viewer` produces `001-file-viewer`, `002-issues-viewer`, `003-wiki-viewer`, and `004-agents-viewer`.

Per-view `state/state.json` replaces old global state assumptions such as `ai/system/state/state.json` and old per-view override files under `ai/views/<view>/settings/state.json`.

Example `manifest.md`:

```markdown
---
name: Docs
description: Document tiles for workspace captures, specs, todos, and playground notes.
metadata:
  view-id: doc-viewer
  view-type: docs
  data-source: Docs
  enabled: true
---
```

`manifest.md` is the view shell contract. It may describe identity, renderer/base view type, data source, and simple behavior flags. It must not contain the view's user/work content.

View availability has two layers:

- Source/template availability in `manifest.md`.
- User/workspace hide/show state in `System/state/`.

`manifest.md` fields:

```yaml
metadata:
  enabled: true
  availability: stable
```

Semantics:

- `metadata.enabled: true` means the view is available for normal selection and rendering when copied into a workspace.
- `metadata.enabled: false` means the view exists in the source template but should be hidden from normal selection/rendering unless the UI explicitly exposes hidden or experimental views.
- `metadata.availability` may be `stable`, `experimental`, or another future lifecycle label.
- User-driven hide/show after workspace creation should not edit `manifest.md`; it belongs in `System/state/` so the source view definition remains intact.

Example `state/state.json`:

```json
{
  "widths": {
    "leftSidebar": 220,
    "leftChat": 320,
    "rightSecondary": 400,
    "rightCol": 220
  },
  "collapsed": {
    "leftSidebar": false,
    "leftChat": false
  },
  "popup": {
    "open": false,
    "x": -1,
    "y": -1,
    "width": 420,
    "height": 520,
    "threadId": null
  },
  "tints": {
    "leftPanel": false,
    "rightPanel": false,
    "cards": false,
    "contentPanels": false,
    "borders": {
      "threads": false,
      "chat": false
    }
  }
}
```

Do not store workspace-level active view state in per-view `state/state.json`. The last active semantic view id may be stored in the app database or a lightweight workspace cache as `currentPanel`, then restored only after fresh view discovery confirms the semantic id still exists.

Example `styles/icon.md`:

```markdown
---
name: Docs View Icon
description: This file determines what icon is rendered in the left side nav.
metadata:
  icon-name: open_run
---
```

`styles/icon.md` has no Markdown body requirement. The app reads the frontmatter only.

The icon frontmatter contract follows the Wiki frontmatter model:

- Use `---` YAML frontmatter delimiters.
- Use lowercase canonical keys: `name`, `description`, and `metadata`.
- Store icon-specific fields under `metadata`.
- Preserve the file even when it has no body content.

The same frontmatter convention applies to `manifest.md`.

All shipped views use the same minimal view-shell contract. For example, `doc-viewer` and `file-viewer` both require only:

```text
Views/00X-name-viewer/
  manifest.md
  onboarding/
  state/state.json
  styles/layout.css
  styles/icon.md
```

`file-viewer` must not carry old CLI/model/runtime artifacts such as `api.json`, `sessions/`, `threads`, `checkpoints/`, or per-view `chat/` folders. CLI/harness policy belongs under `System/`, and chat/thread audit artifacts belong under `Data/Chatlogs/` or other agreed top-level runtime/work-product folders.

Each view may include an `onboarding/` folder containing setup tickets, checklists, questions, and references specific to that view. Onboarding files are setup/workflow guidance, not view content data.

Example:

```text
Views/007-calendar-viewer/onboarding/001-verify-calendar-sync.md
```

Calendar onboarding example responsibilities:

- Verify Calendar sync is enabled through macOS Calendar access or Google OAuth.
- Ask whether the user wants macOS Calendar, Google Calendar, or both.
- Confirm read-only vs read-write tool access.
- Link to connector docs such as `System Source Files/Wiki/Connectors/MacOS/Calendar` and `System Source Files/Wiki/Connectors/Google_OAuth/Calendar`.

Onboarding ticket materialization:

- During workspace creation, onboarding tickets for selected views and selected template features should be moved or copied into the active issue tracker.
- Materialized onboarding issues should include `@notify` so they appear in the notification system.
- No source backlink is required.
- If useful, frontmatter or body text may indicate the ticket was created as part of new workspace onboarding.
- Onboarding files that are informational README/checklist files may remain in place; actionable tickets should appear in `Issues/` so Issues Viewer can show them immediately.

Additional shipped/future view shells follow the same contract:

| View | Data source |
|------|-------------|
| `office-viewer` | Top-level `Office/` folder. |
| `browser-viewer` | App-managed browser state; no top-level data folder required. |
| `custom-viewer` | App-managed iframe/custom-view state; no top-level data folder required. |
| `calendar-viewer` | Fusion Studio SQLite. |
| `email-viewer` | Fusion Studio SQLite. |
| `contacts-viewer` | Future Fusion Studio SQLite-backed view; may ship disabled until implemented. |
| `media-viewer` | User-selected folder inside the workspace repository. |
| `library-viewer` | User-selected folder inside the workspace repository. |

## 5.1 Docs Viewer Paradigm

`Docs/` is the data source for `doc-viewer`.

Folders directly inside `Docs/` become tiled rows in `doc-viewer`.

Root-level documentation files such as `Docs/README.md` are metadata/help text and must be ignored by the tiled row renderer.

Example:

```text
Docs/
  001-Captures/
  002-Draft_Specs/
  003-Todo/
```

Display rules:

- Numeric prefixes such as `001-` and `002-` control row order.
- Numeric prefixes are not displayed in the UI.
- Renaming prefixes reorders rows without changing the semantic folder label.
- Underscores in names become spaces for display.
- Existing capitalization is preserved.

Examples:

| Folder name | Display label |
|-------------|---------------|
| `001-Captures` | `Captures` |
| `002-Draft_Specs` | `Draft Specs` |
| `003-UI_Playground` | `UI Playground` |

Files inside each `Docs/<row>/` folder become the tiles for that row. File display labels follow the same convention: strip numeric order prefixes, replace underscores with spaces, and preserve capitalization.

Root-level files directly under `Docs/` do not become tiles. Only files inside row folders are rendered as document tiles.

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
- Right-click hide should remove the view from active order without deleting the canonical source template.
- Hidden/restorable view records belong in `System/state/` or another `System/` contract file, not in a view folder's user content.
- The left view nav should include an add control, such as a `+` button at the bottom.
- Right-click should also offer an add/restore view action.
- Adding a view copies the view shell from the canonical source into the local `Views/` folder, assigns it the next bottom prefix, and preserves the source view's `manifest.md`, `state/`, and `styles/` files.
- Right-click remove may delete the local view shell folder from `Views/` because view data lives outside `Views/`.
- Removing a view must not delete bound data folders such as `Docs/`, `Wiki/`, `Issues/`, `Agents/`, `Office/`, or selected media/library folders.
- After removing a view, compact/renumber the remaining active `Views/` folders while preserving semantic ids.
- Adding the removed view back copies a fresh shell from the canonical source template and binds it back to the existing data source declared in `manifest.md`.
- The only expected loss from removing a view is that view's local UI state in `Views/<viewer>/state/state.json`.
- Template `state/state.json` files should contain only real fields consumed by the view/runtime so re-adding a view does not introduce stale or nonsensical UI state.

## 6.1 View Discovery And Caching

Fresh view discovery is the source of truth for view order and view rail configuration.

Rules:

- Do not persist or restore cached `panelConfigs`/view configs as first paint.
- Do not use cached view order as a fallback.
- On startup or workspace switch, scan `ai/<user-machine>/Views/` fresh.
- Sort view folders by numeric prefixes such as `001-`, `002-`, and `003-`.
- Use the semantic id after the prefix as the stable runtime view id.
- Restore only the last active semantic view id after fresh discovery confirms that view still exists.
- If the last active semantic view no longer exists, select the first discovered view.

The workspace cache may store lightweight active-view state only:

```json
{
  "currentPanel": "doc-viewer"
}
```

It must not store discovered view order, labels, icons, categories, `hasChat`, rank, or other rail config as authoritative data.

Performance expectation:

- Discovery should be fast enough to run fresh because it only reads the `Views/` directory and small layout/state files.
- Prefer optimizing fresh discovery over painting stale cached config.
- If a cache is later needed for speed, it should be an in-memory cache invalidated by filesystem changes, not persisted across reloads as the first rendered view order.

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

Workspace template families:

Fusion Studio should support multiple workspace templates, not only one generic template.

Planned templates:

- `System Source Files`
- `Fusion Home`
- `Media Studio`
- `Invoicing & Expenses`

Each workspace template can include its own selected views, data folders, documentation, onboarding tickets, and starter assets.

Template-specific tickets:

- Tickets included in a workspace template should appear immediately in `issues-viewer` after workspace creation.
- These tickets live in that template's `Issues/` folder.
- View-specific onboarding tickets can still live under `Views/<viewer>/onboarding/`, but template-level work items belong in `Issues/`.
- Example: `Media Studio` may include a custom viewer plus tickets and documentation to download and install ComfyUI.

Template-specific docs:

- Workspace templates may include documentation in `Docs/`, `Wiki/`, or another appropriate top-level data folder.
- Template docs should support the selected views and initial tasks for that workspace type.

Template source layout:

```text
templates/
  views/
  workspaces/
    startup/
    new/
  tools/
    global/
    view-scoped/
  skills/
    global/
    view-scoped/
  scripts/
    global/
    view-scoped/
```

Rules:

- `templates/views/` preloads default view shells that ship with Fusion Studio.
- `templates/workspaces/new/` is the default new workspace profile.
- The `new` profile defaults to `file-viewer`, `issues-viewer`, `wiki-viewer`, and `agents-viewer` selected.
- `templates/workspaces/startup/` is reserved for startup/system workspace profiles.
- Global tools, skills, and scripts install into all new workspaces.
- View-scoped tools, skills, and scripts install automatically when matching views are selected.
- View onboarding tickets under `*-viewer/onboarding/` can preload when that view is selected.
- The default `new` profile should include base agents such as wiki updaters and audit/review agents that inspect chat logs, file edits, and diffs, then suggest tools, skills, and wiki upgrades through issue tickets.

Final setup UI requirement:

- Both `Add Project` and `Create New Project` should present a setup modal before finalizing the workspace.
- The modal should list available views from the canonical template.
- Default selected views:
  - `file-viewer`
  - `wiki-viewer`
  - `agents-viewer`
  - `issues-viewer`
- Users can select or unselect additional views before the `ai/` folder is created/updated.
- Unselected views are omitted from the copied `Views/` folder.
- Unselected view templates remain untouched in `System Source Files/ai-template/` and can be added later.
- Data folders that are only starter/template data for omitted views may also be omitted.
- Shared/system folders required for workspace operation should remain.
- The selected view set should preserve numeric order prefixes from the template, compacting prefixes only if needed by implementation.
- The selected view set should use the canonical default order and compact selected prefixes from `001-` upward.

## 7.1 System Folder Contract

`System/` stores workspace-level app/system contracts and state that do not belong to a single view and are not user/work content.

Recommended shape:

```text
System/
  config/
    cli.json
  state/
    state.json
  styles/
    variables.css
    themes.css
    themes.json
    tints.css
    views.css
    components.css
```

`System/config/` should remain the home for workspace-level CLI/harness configuration. View folders must not contain old per-view CLI/model/provider policy files such as `api.json`.

Examples of config that belongs in `System/config/`:

- Default harness/CLI selection.
- Enabled harness list.
- Workspace-level model defaults.
- Workspace-level thinking effort defaults.
- Future workspace-wide CLI/session startup policy.

`System/styles/` should remain the home for universal workspace styles and design tokens. These styles provide a unified interface across the workspace. A view only overrides or extends them intentionally by placing CSS in its own `Views/<viewer>/styles/` folder.

`System/state/` should hold workspace-level state such as:

- View availability/hidden/restorable records.
- Setup progress.
- Selected view bindings that are workspace-level rather than per-view.
- Whether the left-nav `+` add-view button is visible/enabled.
- Other repo-visible app state that should not live in per-view `state/state.json`.

Per-view state such as widths, collapsed panels, selected item, open tabs, and view-specific bindings belongs in:

```text
Views/<viewer>/state/state.json
```

Machine identity, local chat history, and resumable thread metadata remain in the protected Electron SQLite database, not `System/state/`.

The old `ai/system/workspace/views.json` and `ai/system/state/workspace.json` roles are replaced by v2 `Views/` folder order, per-view `manifest.md`, per-view `styles/icon.md`, and `System/state/` records for hidden/restorable view state.

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

- Machine-scoped folder instantiated from the database-registered local machine name.
- Default `Views/` folders for shipped views.
- Default `manifest.md`, `styles/layout.css`, and `styles/icon.md` per view.
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
- Which tables/modules should be mirrored into `Data/Workspace-db/workspace.db`?
- Should chat audit markdown be generated/shared?
- Which agents should be installed?
- Which scripts/tools should be available at chat session start?
- Should starter wiki content be created or left minimal?

## 10. Setup Tickets

Workspace creation should materialize selected setup/onboarding tickets into the active issue tracker under `Issues/`. These are actionable issues, not passive template notes.

Potential tickets:

- Workspace setup checklist with `@notify`.
- Mirror DB setup checklist with `@notify` if the mirror DB is enabled.
- Wiki setup checklist with `@notify` when starter wiki decisions remain.
- Agent setup checklist with `@notify` when agents are selected or recommended.
- Scripts/tools setup checklist with `@notify` when scripts/tools are selected or recommended.
- Prompt/persona setup checklist with `@notify` when prompt setup is needed.
- View selection and order verification with `@notify`.

These tickets should be practical work items that guide a user or AI through finalizing the workspace after template copy. They do not need to link back to their source onboarding files, but they may note that they were created as part of new workspace onboarding.

## 11. Prompt, Tool, And Script Loading

`Prompts/`, `Tools/`, and `Scripts/` support chat-session startup customization.

Target behavior:

- `Prompts/` stores personas, assistant prompts, background agent prompts, and sub-agent prompts.
- `Tools/` stores future terminal/app tool definitions that can be displayed and made available to chat/agents through controlled server mediation.
- `Scripts/` stores future executable or documented scripts for setup, sync, migration, and workspace tasks.
- Chat session startup can discover these folders and offer or load selected assets.

Prompt folder shape:

```text
Prompts/
  Chat-Assistant-Prompts/
  Background-Agent-Prompts/
  Chat-Sub-Agent-Prompts/
```

Prompt behavior:

- `Chat-Assistant-Prompts/` feeds the chat header persona dropdown.
- The user can select a chat assistant persona before sending the first message.
- `Background-Agent-Prompts/` feeds Agents viewer flows for creating cron jobs, trigger jobs, and other autonomous background jobs.
- `Chat-Sub-Agent-Prompts/` feeds sub-agent selection for chat/assistant workflows.
- Prompt files are Markdown files with YAML frontmatter.
- The server parses the frontmatter for display metadata and safety policy.
- The harness receives the prompt body after frontmatter; frontmatter is not injected as prompt text unless explicitly needed by a harness adapter.

Prompt frontmatter shape:

```markdown
---
name: Code Standards Enforcer
description: Reviews code changes against workspace code standards.
metadata:
  icon-name: rule
  tools:
    filesystem: read-only
    shell: restricted
  file-access:
    workspace: read-write
    outside-workspace: read-only
---

Prompt body starts here.
```

Ordering:

- Prompt folders may use numeric prefixes such as `001-Code_Standards_Enforcer/PROMPT.md` to control dropdown order.
- Numeric prefixes are stripped for display.
- Underscores become spaces.
- Existing capitalization is preserved.
- If no numeric prefixes are present, sort alphabetically.

Security and tool limits:

- The server must enforce tool/file-access limits from prompt frontmatter.
- Background agents and sub-agents can use `metadata` to limit available tools.
- Chat assistant prompts can also limit file access, including read-only access outside the default workspace.
- These limits are server-side constraints around tool use, not just instructions in the prompt body.
- The goal is to reduce damage from prompt injection or rogue web content by preventing harness/tool execution outside the declared policy.

Current scaffold decisions:

- Prompt packs use Markdown files with YAML frontmatter.
- Tool definitions remain documented placeholders until the controlled execution model exists.
- Scripts remain documented placeholders until the controlled execution model exists.
- Session startup should discover available prompts/tools/scripts and let the user or selected assistant persona choose what to load, rather than silently enabling everything.

Tools and Scripts are intentionally unfinished for this v2 scaffold. They should ship with README/spec placeholders until the execution and safety model is implemented.

Future tool definition goals:

- Tool definitions can represent controlled terminal commands or app capabilities.
- Tools should have display metadata such as icon, display label, and description.
- Tools can appear in chat/tool menus as icon + text entries, for example `Calendar Tool`, `Email Tool`, or `Video Edit`.
- Tool execution must be server-mediated and safety constrained; a tool definition should not grant raw terminal access by default.
- Approved tool definitions are the only way AI may alter Fusion Studio's protected internal SQLite databases.
- Generic scripts or arbitrary shell commands originating from a harness must be blocked from writing to internal SQLite databases.
- Any SQLite write tool must be named, allowlisted, permission-scoped, audited, and mediated by the server.

Future harness mode work:

- Tool interception and generalized harness permission modes are future backend/harness-layer work, not part of the folder structure migration.
- Planned modes may include:
  - `Read`
  - `Capture` — read plus write access to Docs/doc-viewer capture workflows.
  - `Agent` — asks before high-risk actions.
  - `Auto`
- These modes require backend engineering around harness adapters and tool-call interception.
- This v2 workspace template spec only defines the folder structure, display rules, and where safety metadata can live.

## 11.1 Data Folder And Mirror Database

`Data/` ships with structural folders and a repo-local SQLite mirror database created during workspace creation.

Default template shape:

```text
Data/
  Chatlogs/
  Runs/
  Workspace-db/
  onboarding/
```

Rules:

- `Data/Chatlogs/` stores repo-local chat transcript/audit exports.
- `Data/Runs/` stores agent/workflow run artifacts and evidence.
- `Data/Workspace-db/` is where the optional mirror database will live.
- `Data/onboarding/` stores setup tickets/checklists for data mirrors, chatlogs, runs, event ledgers, file versioning, and retention.
- Create `Data/Workspace-db/workspace.db` during workspace creation.
- The protected Electron SQLite database remains canonical infrastructure.
- The repo-local `workspace.db` is a projection/mirror for sharing, inspection, or automation, not the local app's primary database.

Initial/future mirror domains that should be represented in the mirror schema:

- `runs` — agent/workflow run records once the main Electron database has the run-storage schema.
- `chatlogs` — chat transcript/audit export metadata.
- `universal_event_ledger` — future universal event ledger mirror.
- `file_versioning` — future file versioning/checkpoint mirror.

Retention and size policy:

- Keep `Data/Workspace-db/workspace.db` under 80 MB.
- Favor a 120-day retention cutoff first.
- If the database reaches 80 MB before the 120-day cutoff is enough, prune individual entries FIFO by timestamp until under the limit.
- Retention should remove mirror/projection rows only. It must not delete canonical Electron database rows or source workspace files.

Implementation note:

- The workspace creation flow can copy the template folders normally.
- After copy, a setup service should create/open `Data/Workspace-db/workspace.db` and apply the current mirror schema/migrations.
- Prefer creating the database with code over copying a blank SQLite file so schema changes can be handled deterministically.

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
10. Clean up original legacy view folders as each view is converted or in a final enforcement pass.
11. Remove obsolete central registry/state assumptions after migration is complete.

## 13. Legacy View Cleanup And Enforcement

As each legacy view under `ai/views/<viewer>/` is converted to the v2 `Views/00X-<viewer>/` shape, remove or migrate anything that violates the view-shell-only rule.

Allowed in v2 view folders:

- `manifest.md`
- `state/state.json`
- `styles/layout.css`
- `styles/icon.md`

Not allowed in v2 view folders:

- User/work content folders such as `content/`, `Wiki/`, `specs/`, or document collections.
- Chat marker folders or chat transcripts such as `chat/` and `threads/`.
- Runtime/session folders such as `sessions/`, `checkpoints/`, or old process lifecycle records.
- CLI/model/provider policy files such as `api.json`.
- Old view registry/config files such as `index.json` and `content.json` after their fields have been migrated into `manifest.md`, `state/state.json`, or top-level category folders.
- Product-name or provider-name artifacts from older eras that no longer describe Fusion Studio.

Cleanup can happen view-by-view or as a final enforcement pass, but the canonical `System Source Files/ai-template/` must ship only the v2 shape. The server should eventually reject or ignore legacy-only files inside v2 view folders so content cannot creep back into `Views/`.

## 14. Deferred Work

- Full Tools execution and safety model.
- Full Scripts execution and safety model.
- Harness permission modes and tool-call interception.
- Future SQLite mirror schemas for universal event ledger and file versioning.
