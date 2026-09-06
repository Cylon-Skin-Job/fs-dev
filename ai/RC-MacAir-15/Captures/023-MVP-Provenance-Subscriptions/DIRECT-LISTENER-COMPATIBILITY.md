# SPEC-02 Direct Event-Bus Listener Compatibility Inventory

This inventory covers production callers of `lib/event-bus.on(...)` before the
governed controller is activated. Node/WebSocket/process/child-process
`EventEmitter.on(...)` callers are unrelated transport or operating-system
listeners and are not UEB subscribers.

| Current caller | Topics | Classification | Removal criterion |
|---|---|---|---|
| `lib/ledger/event-ledger-subscriber.js` | `*` | Migrated by SPEC-03 for the new `system.provenance-ledger` admitted-fact path; legacy event coverage retained until its own ledger compatibility migration | Remove its direct wildcard subscription only when every retained legacy ledger event has a registered schema/producer/subscription or an approved retirement |
| `lib/ws/workspace-broadcaster.js` and per-connection listener in `server.js` | workspace and thread state topics | Retained compatibility | Migrate only after workspace/thread lifecycle schemas, producers, session-safe projection capabilities, and registry rows are approved |
| `lib/wire/wire-broadcaster.js` | chat lifecycle/content/tool/metadata topics | Retained compatibility | Migrate only with the deferred full chat/tool provenance and governed projection contract |
| `lib/audit/audit-subscriber.js` | chat status and turn end | Retained compatibility | Migrate with registered chat audit schemas and a scoped audit persistence capability |
| `lib/transcription/history-subscriber.js` | transcription completion | Retained compatibility | Migrate with a registered transcription schema and scoped history persistence capability |
| `lib/chat-metadata/collectors/file-mutations.js` | chat turn begin and legacy file changed | Retained compatibility | Remove after the chat metadata model consumes registered resource facts and no supported mutation depends on `file:changed` |
| `lib/tickets/dispatch.js` | legacy file changed | Retained compatibility | Migrate after ticket automations have per-definition registry subjects and scoped named commands |
| `lib/triggers/trigger-loader.js` bus registration | Editable `TRIGGERS.md` `chat`, `ticket`, `agent`, and `system` topics. Current call chain: `startup.start -> loadTriggers -> processBlock -> registerBusListener -> on(topic)` (the destructured `lib/event-bus.on`) `-> evaluateCondition -> actionHandlers[action]` | Retained nongoverned compatibility. `test/triggers/trigger-loader.test.js` proves workspace/condition selection, legacy `emit/on` execution, and absence of governed capability context | Remove a direct bus listener only after that individual executable definition is a pending/granted registry subject, its topic has registered schema/producer authority, and its action is an approved scoped named command. Never grant the editable trigger set as one system adapter |
| `lib/triggers/trigger-loader.js` file watcher/filter registration | Editable non-bus/non-cron `TRIGGERS.md` definitions. Current call chain: `startup.start -> loadTriggers -> processBlock -> buildTriggerFilter -> buildFilter` (with optional `wrapWithScript -> runScript`) `-> projectWatcher.addFilter -> workspace-watcher.notifyFilters -> filter.shouldWatch -> filter.onDelete/onCreate/onModify/onRename -> actionHandlers[action]`; `notifyFilters` separately calls legacy `event-bus.emit('file:changed', ...)` | Retained nongoverned compatibility. `test/watch/workspace-watcher.test.js` covers watcher exclusion wiring; `test/triggers/trigger-loader.test.js` proves loader-produced editable filter matching, event selection, script execution, and the existing action-handler boundary | Remove one filter only after that individual executable definition is a pending/granted registry subject and its action is an approved scoped named command with equivalent path/operation/workspace/script-condition semantics. Never grant the editable filter set or arbitrary script execution as one system adapter |
| `lib/triggers/trigger-loader.js` cron registration and `lib/triggers/cron-scheduler.js` execution | Editable `TRIGGERS.md` `cron` definitions. Current call chain: `startup.start -> loadTriggers -> processBlock(type=cron) -> cronTriggers -> createCronScheduler -> register -> start -> setSafeInterval` (or retry `setSafeTimeout`) `-> fireJob -> runSafely -> wrappedCreateTicket` | Retained nongoverned compatibility. `test/triggers/trigger-loader.test.js` proves cron definitions remain inert loader output; `test/triggers/cron-scheduler.test.js` proves schedule/retry/condition/failure behavior and absence of governed capabilities | Remove one scheduled job only after that individual cron definition is a pending/granted registry subject and ticket creation is an approved scoped named command preserving its schedule, workspace, assignee, condition, and restart semantics. Never grant all editable schedules as one system adapter |
| `lib/workspace/workspace-controller.js` | workspace request topics | Retained compatibility command routing | Replace only when an approved named workspace command route owns all current request semantics and tests |
| `lib/thread/thread-lifecycle-controller.js` | chat turn and settings topics | Retained compatibility | Migrate with registered chat/settings schemas and explicit lifecycle authority |
| `lib/ws/harness-broadcaster.js` | harness status | Retained compatibility | Migrate with a registered harness-status projection and session-scoped publisher capability |
| `lib/ws/calendar-broadcaster.js` | calendar sync complete | Retained compatibility | Migrate only in an approved connector/plugin contract with scoped user consent |

Planned governed handlers that do not yet have direct listener call sites:

| Handler | Classification | Activation criterion |
|---|---|---|
| `system.resource-render-projection` | Introduced as a governed handler, not migrated from a current direct listener | SPEC-04 must add the allowlisted handler, locked system subscription row, and exact grants atomically before activation |

The governed path added by SPEC-02 is private and separate from these legacy
topics. None of the callers above is claimed schema-governed by this slice.
