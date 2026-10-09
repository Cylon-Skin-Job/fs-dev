---
name: Exchange Storage
description: SQLite exchange row rules, Chat ID meaning, sequence, and source-of-truth behavior.
metadata:
  incoming-edges:
    - Chat Identity And Persistence
  outgoing-edges:
    - Chat Exchange Metadata
  source-files:
    - fusion-studio-server/lib/db/migrations/001_initial.js
    - fusion-studio-server/lib/thread/HistoryFile.js
    - fusion-studio-server/lib/audit/audit-subscriber.js
  connected-skills: []
  related-trigger-files: []
---

The SQLite `exchanges` table stores rich chat turn history.

## Identifiers

- `exchanges.id` is the primary saved exchange id.
- `thread_id + seq` is unique and preserves per-thread ordering.
- The user-facing reply chrome "Chat ID" is `exchanges.id`.
- Never copy `threadId` as Chat ID.

## Source Of Truth

SQLite is the source of truth for completed chat history. The renderer may hold
derived state, but reloads and thread switches should hydrate from SQLite.

## Turn End Persistence

Normal completion, interrupted Stop completion, and accepted-turn error
completion go through the same durable path: canonical `turn_end` -> audit
subscriber -> `HistoryFile.addExchange()`.

Working activity, its cursor, its seen-identity ledger, and `activityRevision`
are transient and never enter SQLite or assistant parts. A failed exchange may
persist one validated `metadata.terminalError`; its optional `diagnosticId` is
only an opaque reference. The redacted report itself lives in the dedicated
bounded diagnostics table and is not part of exchange history.

A completed exchange that cannot be saved is a bug. Features that require a
saved turn should stay disabled until the save acknowledgement provides
`exchangeId`.
