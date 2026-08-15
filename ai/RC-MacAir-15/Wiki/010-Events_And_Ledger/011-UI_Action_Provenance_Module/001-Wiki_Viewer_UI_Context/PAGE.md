---
name: Wiki Viewer UI Context
description: Normative command-time context and resource mapping for the first Wiki Viewer UI-action adapter.
metadata:
  incoming-edges:
    - UI Action Provenance Module
  outgoing-edges:
    - UI Action And Context Provenance Schema
  source-files:
    - fusion-studio-client/src/state/panelStore.ts
    - fusion-studio-client/src/state/wikiStore.ts
    - fusion-studio-client/src/components/SendToChatButton.tsx
    - fusion-studio-client/src/components/chat/useChatArea.ts
    - fusion-studio-client/src/state/chatFileLinkStore.ts
  connected-skills: []
  related-trigger-files: []
---

Use this page when implementing or reviewing Wiki Viewer UI-action provenance.

## Current Scope

The owner approved Wiki Viewer for the first adapter pair. The current Wiki surface has no direct durable file create/save/move/rename/delete command. Its first migrated durable command is `chat.send_with_resource` when Wiki Viewer is the active panel and prompt send consumes at least one valid pending resource attachment, regardless of which panel staged it.

`SendToChatButton` attachment staging and Wiki navigation are non-mutating. They do not emit `ui.action` events.

## Context Mapping

The adapter is selected only when `usePanelStore.getState().currentPanel === 'wiki-viewer'` at actual prompt-send time.

| Output | Source / rule |
|---|---|
| Canonical `ids.workspaceId` | Server coordinator `WorkspaceCommandContextRef` captured for the accepted prompt; not session cache or renderer input. Missing provenance metadata does not block chat. |
| `context.viewId` | Literal `wiki-viewer`. |
| `context.panelId` | Literal `wiki-viewer`. |
| `context.route` | `null`; Wiki has no authoritative route store. |
| `context.activeTabId` | `null`; Wiki navigation history is not a tab identity. |
| `context.activeDocumentPath` | Renderer tentatively converts `useWikiStore.getState().viewedPagePath` through cached roots; server preserves it only after private workspace-token binding and re-resolution under the coordinator command root; null/omitted on failure. |
| `context.activeResourcePath` | Same server-verified canonical workspace-relative path as `activeDocumentPath`. |
| Canonical `context.selectedResourceId` | Server-derived only from an accepted resource reference; absent/null for this adapter. `selectedPath` is not read during send capture and is not an ID. |

The first adapter reads only `useWikiStore.getState().viewedPagePath`. It does not inspect `selectedPath` for envelope fields or diagnostics, avoiding a second selector and its failure surface.

## Resource Mapping

Each valid Wiki-origin attachment becomes a `resources[]` entry with:

- `role: 'subject'`.
- `resourceType: 'wiki'`.
- Renderer tentatively proves `wikiPanelRoot + relativePath === absolutePath` and cached-project containment. The server requires the private workspace token to match the coordinator command context, re-resolves the Wiki root/operational target, and derives the canonical path under the authoritative command root. For example, panel-relative `010-X/PAGE.md` may become `ai/<machine>/Wiki/010-X/PAGE.md`; the raw/tentative renderer value is never copied as canonical path. A stale A token/root while B is current omits the subject without affecting the prompt.

The attachment subject may differ from `activeDocumentPath` when the user stages a child/topic link or changes Wiki pages before sending. Preserve both facts; do not replace command-time active context with the subject path.

## Migration Boundary

Emit the first-pair envelope when the active panel is supported and at least one pending resource attachment is valid. The generic resource-ref helper also preserves valid subjects originating in other panels; their origin does not replace the active Wiki context. Otherwise keep the existing prompt path, record a development diagnostic, and never block ordinary prompt sending because provenance metadata is incomplete.

## Required Evidence

- Client build passes.
- A Wiki attachment can be staged without emitting `ui.action`.
- Actual prompt send emits one accepted `ui.action` with `command: 'chat.send_with_resource'`.
- Active Wiki context and attachment subject resource are both preserved.
- With Wiki active, a provenance-valid attachment staged by another panel still emits Wiki active context and preserves that cross-panel subject; a mixed provenance-valid/invalid list preserves every valid canonical subject and diagnoses/omits invalid entries only from provenance. The operational prompt attachment list and order remain unchanged.
- Missing context or enrichment degrades honestly without blocking prompt acceptance or producing falsely precise provenance.
