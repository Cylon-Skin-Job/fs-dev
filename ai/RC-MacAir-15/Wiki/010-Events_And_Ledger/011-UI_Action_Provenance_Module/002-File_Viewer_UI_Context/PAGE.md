---
name: File Viewer UI Context
description: Normative command-time context and resource mapping for the first File Viewer UI-action adapter.
metadata:
  incoming-edges:
    - UI Action Provenance Module
  outgoing-edges:
    - UI Action And Context Provenance Schema
  source-files:
    - fusion-studio-client/src/state/panelStore.ts
    - fusion-studio-client/src/lib/viewActivity.ts
    - fusion-studio-client/src/components/SendToChatButton.tsx
    - fusion-studio-client/src/components/chat/useChatArea.ts
    - fusion-studio-client/src/state/chatFileLinkStore.ts
  connected-skills: []
  related-trigger-files: []
---

Use this page when implementing or reviewing File Viewer UI-action provenance.

## Current Scope

The owner approved File Viewer for the first adapter pair. The current File Viewer surface reads files and stages file/folder chat attachments; it does not expose direct durable file create/save/move/rename/delete commands. Its first migrated durable command is `chat.send_with_resource` when File Viewer is the active panel and prompt send consumes at least one valid pending resource attachment, regardless of which panel staged it.

Tree expansion, tab navigation, and attachment staging are non-mutating. They do not emit `ui.action` events.

## Context Mapping

The adapter is selected only when `usePanelStore.getState().currentPanel === 'file-viewer'` at actual prompt-send time.

| Output | Source / rule |
|---|---|
| Canonical `ids.workspaceId` | Server coordinator `WorkspaceCommandContextRef` captured for the accepted prompt; not session cache or renderer input. Missing provenance metadata does not block chat. |
| `context.viewId` | Literal `file-viewer`. |
| `context.panelId` | Literal `file-viewer`. |
| `context.route` | `null`; File Viewer has no authoritative route store. |
| `context.activeTabId` | `activity.activeTabId`, where `activity = normalizeViewActivity(usePanelStore.getState().viewStates['file-viewer']?.activity)`. |
| `context.activeDocumentPath` | Renderer tentatively converts the active tab path through cached File Viewer/project roots; server preserves it only after private workspace-token binding and re-resolution under the coordinator command root; null/omitted on failure. File Viewer content root may be a configured subdirectory. |
| `context.activeResourcePath` | Same server-verified canonical workspace-relative path as `activeDocumentPath`. |
| Canonical `context.selectedResourceId` | Server-derived only from an accepted resource reference; absent/null for this adapter. Local attachment/tab IDs are not canonical resource IDs. |

Do not use a React key, tab ID, `ChatLinkAttachment.id`, or path string as `selectedResourceId`.

Do not use `useFileStore.activeTabPath` for provenance. File-store tabs are currently global across workspace activation, while panel `viewStates` are workspace-scoped; combining them could attribute an old-workspace path to the active workspace.

## Resource Mapping

Each valid File Viewer-origin attachment becomes a `resources[]` entry with:

- `role: 'subject'`.
- `resourceType` equal to the attachment kind. File Viewer Markdown attachments are `doc`; the total mapping also permits `file`, `folder`, `wiki`, and `ticket` subjects normalized by the generic helper.
- Renderer tentatively proves `fileViewerPanelRoot + relativePath === absolutePath` and cached-project containment. The server requires the private workspace token to match the coordinator command context, re-resolves the File Viewer root/operational target, and derives canonical path under the authoritative command root. If File Viewer is configured to subroot `src`, panel-relative `a.ts` may become canonical `src/a.ts`; equality/copying is never assumed, and stale A evidence under B is omitted without changing the prompt.

The attachment subject may differ from the active tab when a tree-row action stages another file/folder or the user changes tabs before sending. Preserve both facts; do not replace command-time active context with the subject path.

## Migration Boundary

Emit the first-pair envelope when the active panel is supported and at least one pending resource attachment is valid. The generic resource-ref helper also preserves valid subjects originating in other panels; their origin does not replace the active File Viewer context. Otherwise keep the existing prompt path, record a development diagnostic, and never block ordinary prompt sending because provenance metadata is incomplete.

## Required Evidence

- Client build passes.
- A File Viewer attachment can be staged without emitting `ui.action`.
- Actual prompt send emits one accepted `ui.action` with `command: 'chat.send_with_resource'`.
- Active File Viewer tab/path and attachment subject resource are both preserved.
- With File Viewer active, a provenance-valid attachment staged by another panel still emits File Viewer active context and preserves that cross-panel subject; a mixed provenance-valid/invalid list preserves every valid canonical subject and diagnoses/omits invalid entries only from provenance. The operational prompt attachment list and order remain unchanged.
- Missing context or enrichment degrades honestly without blocking prompt acceptance or producing falsely precise provenance.
