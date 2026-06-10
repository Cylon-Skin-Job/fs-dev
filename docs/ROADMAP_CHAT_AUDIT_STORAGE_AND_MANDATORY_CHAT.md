# Roadmap: Mandatory Chat And System Chat Audit Storage

## Purpose

This roadmap captures the current findings and proposed implementation path for removing `ai/views/chat` from app view navigation while preserving chat markdown as a system-managed audit/export layer.

The goal is to make chat mandatory app behavior, not a folder-detected optional view, and to move human-readable thread markdown into `ai/system/` with a naming/frontmatter convention aligned with the wiki.

## Product Decision

Chat is mandatory.

The server should not ask the filesystem whether chat exists. It should not use `ai/views/<view>/chat/` or `ai/views/chat/` folder presence as the source of truth for whether chat renders or functions.

The app can still support project-scoped and view-scoped chat, but that is product/runtime policy, not view-folder discovery.

## Current Findings

### `ai/views/chat` currently appears because it is registered as a view

`ai/system/workspace/views.json` contains:

```json
{
  "id": "chat",
  "baseViewId": "chat",
  "label": "chat",
  "icon": "folder",
  "rank": 3,
  "enabled": true,
  "source": "custom",
  "viewPath": "ai/views/chat"
}
```

Because `ai/views/chat` exists, the registry makes it visible in app view navigation.

### `ai/views/chat` currently stores project chat markdown

`fusion-studio-server/lib/thread/ThreadManager.js` writes project-scoped thread markdown to:

```text
ai/views/chat/threads/<user>/<threadId>.md
```

View-scoped threads currently write to:

```text
ai/views/<view>/chat/threads/<user>/<threadId>.md
```

### Per-view `chat/` folders currently gate chat capability

`fusion-studio-server/lib/views/index.js` has `resolveChatConfig()` check:

```js
const chatMarker = path.join(view.viewRoot, 'chat');
if (!fs.existsSync(chatMarker)) return null;
```

This means a folder can affect whether a view is considered chat-enabled.

### Thread rename path already updates markdown frontmatter

Rename flow:

```text
client thread:rename
→ thread-ws-handlers.js
→ thread-crud.js handleThreadRename()
→ ThreadManager.renameThread()
→ ThreadIndex.rename() updates SQLite
→ ChatFile.write() rewrites markdown frontmatter name
```

Current `ChatFile` frontmatter only stores `name`.

## Target Storage Contract

Chat audit markdown should move out of `ai/views/` and into `ai/system/`.

Recommended project-scoped path:

```text
ai/system/chat/threads/<user>/<thread-id>/CHAT.md
```

Recommended view-scoped path:

```text
ai/system/chat/views/<view-id>/threads/<user>/<thread-id>/CHAT.md
```

Rationale:

- `ai/views/` remains only for navigable app views.
- `ai/system/chat/` clearly communicates system-managed audit/export data.
- Folder-per-thread matches the workspace document convention: a stable folder with one canonical all-caps markdown entry file.
- `CHAT.md` mirrors `SKILL.md` and `PAGE.md`: the filename declares the document role.
- The folder name is the immutable `thread-id`.
- The human thread name lives in frontmatter and can change without filesystem moves.
- Additional files can later live beside `CHAT.md`, such as `history.json` or `tokens.json`, without changing the thread identity path.

## Target Frontmatter Contract

Thread audit `CHAT.md` should use the same `---` YAML delimiter pattern as OpenCode skills and wiki pages.

Proposed shape:

```markdown
---
name: Build wiki frontmatter renderer
description: Conversation about adding wiki-style frontmatter rendering and metadata edge lists.
metadata:
  thread-id: 2026-06-09T14-30-22-123
  scope: project
  workspace-id: fs-dev
  view-id: null
  user: rccurtrightjr.
  created-at: 2026-06-09T14:30:22.123Z
  updated-at: 2026-06-09T15:12:01.456Z
  message-count: "18"
  input-tokens: "12345"
  output-tokens: "6789"
  total-tokens: "19134"
  sqlite-source: threads,exchanges
---

## User

...

## Assistant

...
```

Notes:

- `name` is the human thread name shown in UI and markdown.
- `metadata.thread-id` is the immutable ID and should match the folder name.
- Numeric values should be strings if we want maximum compatibility with the current wiki metadata habit and YAML parsing.
- SQLite remains authoritative. Markdown is a repo-friendly audit/export representation.

## Token Module Requirement

Token calculation should be a reusable module, not inline export code.

Proposed module:

```text
fusion-studio-server/lib/thread/thread-token-summary.js
```

Responsibilities:

- Load thread exchanges from SQLite.
- Count input tokens.
- Count output tokens.
- Return total tokens.
- Return a deterministic summary object usable by exporters.

The module can use the tokenizer already available in the project, but the roadmap deliberately leaves exact tokenizer wiring to the implementation slice.

## Required Research Before Implementation

Do this research before any code changes beyond disabling the accidental `chat` view entry. The point is to prevent the AI from guessing product behavior or quietly encoding assumptions.

### Research A: Inventory Current Chat Storage Behavior

Questions to answer:

- Which code paths create `ai/views/chat`?
- Which code paths create `ai/views/chat/threads`?
- Which code paths write project-scoped markdown files?
- Which code paths write view-scoped markdown files?
- Which code paths read markdown files back into runtime behavior?
- Which code paths use SQLite as source of truth instead?
- Does any code treat `ai/views/chat` as a view folder beyond `views.json` registration?
- Does any code treat per-view `chat/` folders as chat capability markers beyond `resolveChatConfig()`?

Expected artifacts:

- File/function inventory with exact paths.
- Statement of whether markdown is currently load-bearing.
- Statement of which behavior can change safely without data migration.

### Research B: Inventory Thread Name And Rename Behavior

Questions to answer:

- Where is the thread name first created?
- Is the initial thread name user-provided, generated, or null?
- Which UI controls can rename a thread?
- Which server handlers process rename messages?
- Does any harness or model-generated title path update thread names automatically?
- Does the rename path update SQLite only, markdown only, or both?
- What happens when markdown is missing during rename?

Current known path:

```text
thread:rename
→ ThreadWebSocketHandler.handleThreadRename()
→ ThreadManager.renameThread()
→ ThreadIndex.rename()
→ ChatFile.write()
```

This needs verification against tests and current UI behavior before implementation.

### Research C: Token Source And Tokenizer Behavior

Questions to answer:

- Which SQLite tables already store token usage, if any?
- Which harnesses report token usage?
- Are reported tokens trustworthy enough to use directly?
- Which tokenizer should be used when tokens must be recomputed?
- Is token counting model-specific?
- Should markdown metadata store prompt/output/total tokens per thread only, or per message too?
- Should token recomputation happen after every message or only on demand/batch?

Expected artifact:

- Recommendation for `thread-token-summary.js` inputs and outputs.
- Clear boundary between “reported tokens from provider” and “computed tokens from tokenizer”.

### Research D: Existing Chat Audit Data Policy

Questions to answer the user must decide:

- Move existing `ai/views/chat/threads` files into `ai/system/chat`, leave them in place, or archive them?
- Should existing view-scoped chat markdown be migrated too?
- Should migration preserve file modification times?
- Should migrated files be rewritten into folder-per-thread `CHAT.md` shape?
- Should migration happen before or after new writes switch to `ai/system/chat`?

Default until user decides:

- Do not delete existing chat markdown.
- Do not migrate existing chat markdown automatically.
- New implementation may write new files to the new location once approved.

## Assumptions To Confirm With User

These are intentionally listed so future agents do not silently treat them as settled product decisions.

- Chat should be mandatory everywhere, but the exact meaning of “everywhere” needs confirmation: every app view, every workspace, or every view with chat layout support?
- Project-scoped audit files should live at `ai/system/chat/threads/<user>/<thread-id>/CHAT.md`.
- View-scoped audit files should live at `ai/system/chat/views/<view-id>/threads/<user>/<thread-id>/CHAT.md`.
- The thread folder should be the immutable thread id.
- The semantic thread name should live only in frontmatter `name`.
- The audit filename should be `CHAT.md`.
- SQLite should remain the source of truth.
- Markdown audit files should be regenerable and not load-bearing.
- Token metadata should be included in frontmatter, but the exact granularity is not decided.
- Existing `ai/views/chat/threads` data should not be deleted without explicit approval.

## AI Question Policy

When implementing this roadmap, the AI must stop and ask the user before deciding any product behavior not explicitly settled here.

Ask before deciding:

- Whether chat appears in every view or only views with chat config.
- Whether existing markdown files are migrated, archived, or ignored.
- Whether view-scoped audit paths should be separate from project-scoped paths.
- Whether token counts are per-thread only or also per-message.
- Whether manual edits to `CHAT.md` should ever write back to SQLite.

Do not ask when the answer is already explicit:

- Do not register `ai/views/chat` as an app view.
- Do not use folder existence as the source of truth for chat capability.
- Do not delete existing chat markdown files.
- Do not make markdown the source of truth.
- Use `CHAT.md` as the canonical audit filename.

## Slice Plan

### Slice 0: Research, Assumption Audit, And User Decision Gate

Objective: enrich this roadmap with verified current behavior and explicit user decisions before implementation depends on assumptions.

Steps:

1. Complete Research A through D from `Required Research Before Implementation`.
2. Record exact file/function findings under `Current Findings` or a new dated research appendix.
3. Convert each unresolved product assumption into an explicit user question.
4. Ask the user those questions before changing behavior.
5. Update `Open Decisions` with answers and mark each answered decision as resolved.
6. Only proceed to Slice 1+ after the decision gate is complete, except for harmless documentation edits.

Verification:

- The roadmap identifies every known place chat storage, rename, token, and view-registration behavior is implemented.
- The roadmap separates verified facts from proposed behavior.
- Every implicit AI assumption is either confirmed by the user or left as an open decision.
- No implementation slice requires the AI to guess product intent.

### Slice 1: Remove `chat` From View Navigation

Objective: stop `ai/views/chat` from appearing as a navigable app view.

Steps:

1. Remove or disable the `chat` entry in `ai/system/workspace/views.json`.
2. Ensure `listRegistryViews()` continues to list real app views only.
3. Do not delete existing `ai/views/chat/threads` data in this slice.

Verification:

- App view navigation no longer shows `chat`.
- Existing chat still opens and sends messages.
- No thread markdown files are deleted.

### Slice 2: Make Chat Mandatory, Not Folder-Gated

Objective: remove folder-presence gating for chat capability.

Steps:

1. Update `resolveChatConfig()` so it no longer checks for `viewRoot/chat` as a capability marker.
2. Use `content.json` chat config or central app policy as the source of truth.
3. Decide whether every view gets chat, or every chat-capable layout gets chat based on `content.json`.
4. Update comments that describe `chat/` folders as markers.

Verification:

- Removing a `chat/` folder does not disable chat.
- Views with declared chat still render chat.
- Views without declared chat behave according to the chosen mandatory-chat policy.

### Slice 3: Move Markdown Audit Storage To `ai/system/chat`

Objective: change markdown output root without changing SQLite behavior.

Steps:

1. Update `ThreadManager._getViewsDir()` or replace it with a clearer audit path resolver.
2. Write project threads to `ai/system/chat/threads/<user>/<thread-id>/CHAT.md`.
3. Write view threads to `ai/system/chat/views/<view-id>/threads/<user>/<thread-id>/CHAT.md`.
4. Update `ChatFile` constructor naming from `viewsDir` to `threadDir` or `auditDir`.
5. Keep filenames/folder names immutable by using `thread-id` folders.

Verification:

- New project thread creates `ai/system/chat/threads/<user>/<thread-id>/CHAT.md`.
- New view thread creates `ai/system/chat/views/<view-id>/threads/<user>/<thread-id>/CHAT.md`.
- SQLite thread creation still works.
- Existing chat UI still hydrates from SQLite.

### Slice 4: Align Chat Markdown With Wiki Frontmatter

Objective: make thread audit markdown use `name`, `description`, and `metadata`.

Steps:

1. Extend server frontmatter catalog entry for `chat`.
2. Update `ChatFile.serialize()` to emit `name`, `description`, and `metadata`.
3. Include `thread-id`, `scope`, `workspace-id`, `view-id`, `user`, `created-at`, `updated-at`, and `message-count`.
4. Preserve the existing readable message body format unless a deliberate body format change is needed.

Verification:

- Markdown frontmatter parses through `lib/frontmatter`.
- Rename updates `name` without moving folders.
- Thread id in metadata matches folder name.
- Semantic thread name lives in frontmatter `name`, not in the folder or filename.

### Slice 5: Token Summary Module

Objective: centralize token math.

Steps:

1. Create `fusion-studio-server/lib/thread/thread-token-summary.js`.
2. Read SQLite exchanges for a thread.
3. Count input/output/total tokens.
4. Return deterministic data for `ChatFile` or the audit exporter.
5. Add focused tests if the test harness is stable.

Verification:

- Token module can summarize a known thread.
- Markdown metadata includes `input-tokens`, `output-tokens`, and `total-tokens`.
- Token calculation is not duplicated in export code.

## Open Decisions

- Should all views always render chat, or should `content.json` remain the declaration while folders stop being markers?
- Should project-scoped and view-scoped audit markdown share one tree or remain separated as proposed?
- Should thread audit body use `## User` / `## Assistant`, or should each message include stable message IDs and timestamps?
- Should `history.json` live next to `CHAT.md`, or is SQLite enough for structured replay?
- Should existing `ai/views/chat/threads` files be moved, archived, or left untouched until a cleanup slice?

## Research Appendix Template

Use this template during Slice 0. Keep facts, assumptions, and user answers separate.

```markdown
## YYYY-MM-DD - Slice 0 Research

### Verified Facts

- [path] [function/module]: [what it currently does]

### AI Assumptions Found

- Assumption: [what the AI assumed]
- Source: [roadmap line, prior implementation, code path, or discussion]
- Risk: [what could go wrong if this is wrong]
- Status: needs user answer | confirmed | rejected

### Questions For User

1. [specific yes/no or choice question]
2. [specific yes/no or choice question]

### User Answers

- Question: [copy exact question]
- Answer: [copy or summarize user answer]
- Decision: [implementation consequence]

### Implementation Impact

- Slice impacted: [slice number]
- Required change: [what changes because of this research]
```

## Do Not Do Yet

- Do not delete existing markdown thread audit files.
- Do not make markdown load-bearing.
- Do not move storage and change renderer behavior in the same slice.
- Do not keep `chat` registered as an app view once audit storage moves under `ai/system`.
