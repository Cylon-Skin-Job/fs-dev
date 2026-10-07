# Mission Control — Ticket Inventory Snapshot

**Capture:** Mission Control working memory · **Parent:** [Plugin System](../030-Plugin_System/plugin-system-vision.md)
**Status:** bounded inventory; no ticket adjudication or product verification
**Updated:** 2026-09-22 (PDT)
**Trickle-down:** owner request to understand the tickets · **Roll-up:** reconciliation-system requirements

## Scope and counts

Read metadata/titles from [tickets.json](../../Issues/content/tickets.json), direct status-folder Markdown identity headers and sampled RCC-0092, RCC-0106 and RCC-0108 narratives. No deep code search or full ticket review was performed.

- Registry: 40 records, 29 open and 11 closed; `last_updated` is `2026-09-21T08:12:10.670Z`.
- Markdown: 41 unique IDs, 34 files in `inbox` and 7 in `closed`; no duplicate IDs observed in those files.
- Every registry ID has a Markdown file. [RCC-0104](../../Issues/inbox/RCC-0104.md), “System Manager approval flow for protected triggers, prompts, skills, and tools,” is an open Markdown ticket absent from the registry.
- The registry uses `state`. Folder location is not status: closed tickets remain in `inbox`.

These are reconciliation observations, not a decision about which representation should overwrite the other. No Issues files changed.

## Representative findings

| Ticket | Evidence | Implication |
|---|---|---|
| [RCC-0092](../../Issues/inbox/RCC-0092.md) | Owner retired standalone connector SPEC updates as superseded by plugin direction; Calendar permission requirements remain elsewhere. | Superseded does not mean delivered. Preserve remaining requirements. |
| [RCC-0106](../../Issues/inbox/RCC-0106.md) | Owner retired clipboard-history consolidation in favor of RCC-0114's removal direction. | Historical acceptance criteria may contradict current scope. |
| [RCC-0108](../../Issues/inbox/RCC-0108.md) | Closed ticket carries decisions, multi-SPEC evidence and completion history; current CHAT-AR separately owns Working Activity repair. | Historical completion and a current regression need separate records. |
| [RCC-0104](../../Issues/inbox/RCC-0104.md) | Present as Markdown, absent from registry. | Enumerate both sources before claiming a complete review set. |

## Breadth and next review boundary

Titles span workspace/onboarding, views/templates, native permissions/integrations, secrets/versioning, tickets/docs, chat, shared UI and managed processes. Relevant examples include RCC-0071, RCC-0078, RCC-0098, RCC-0103, RCC-0111, RCC-0113 and RCC-0114. These title groupings are not roadmap assignments or coverage judgments.

A future reviewer should first reconcile inventory identities, then inspect a named ticket set against specified owner decisions, approved SPECs and evidence. Return proposed requirement mappings, uncovered scope and contradictions without changing canonical ticket status. Mission Control receives the synthesis and references, not every ticket's full history.
