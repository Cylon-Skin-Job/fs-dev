---
name: Events Taxonomy
description: Categories for UI actions, chat lifecycle, tool calls, harness events, triggers, scheduler runs, resource mutations, render events, and external observations.
metadata:
  incoming-edges:
    - Events And Ledger
  outgoing-edges:
    - Events And Ledger Decisions
    - Events Provenance Model
    - Events Resource Events And Render Sync
  source-files:
    - fusion-studio-server/lib/event-bus.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before naming or classifying events.

Fusion Studio events need stable categories so subscribers can filter without knowing every producer implementation.

## Event Families

- UI actions: button clicks, document edits, drag/drop, rename, move, delete, save, and send-to-chat.
- Chat lifecycle: send, stream, tool call, tool result, turn end, stop, and interruption.
- Harness activity: provider runs, model sessions, tool calls, and adapter-normalized events.
- Automation: trigger runs, scheduler runs, script runs, agent runs, and sync/import jobs.
- Resource mutations: file/folder create, modify, delete, rename, metadata changes, and symlink changes.
- Render/resource sync: cache invalidation, tree refresh, content refresh, style refresh, and registry refresh.
- External observations: filesystem changes seen by watcher without a known app, assistant, trigger, or script cause.

## Rule

Do not overload one event name with multiple meanings. If subscribers need different behavior, the event type or metadata must make the distinction explicit.
