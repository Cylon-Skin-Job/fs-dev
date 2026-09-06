# MVP Provenance and Governed Subscriptions Issue Ledger

## Resolved By This Roadmap

### I-001 — File Viewer bypasses the central file-data store

`FileViewer.tsx` renders tab content from `fileStore`; `useFileTreeListener` attaches a component-owned WebSocket listener. Meanwhile `fileDataStore.ts` already implements central request correlation, cache invalidation, and refetch. SPEC-04 makes File Viewer a customer of the central store while preserving tab/navigation identity separately.

### I-002 — Server mutation paths bypass UEB projection

`file_save`, create, rename, move, and delete currently write in separate handlers. Save sends only a response; rename/move/delete directly broadcast `file_changed`. SPEC-03 converts `file_save` as the first mediated operation. SPEC-04 supplies its registered projection path. Other operations remain named compatibility debt until a multi-resource SPEC.

### I-003 — Current ledger is too narrow for the desired query

Migration 029 and `event-ledger.js` store a useful skeleton, but only three event types are accepted and file changes are watcher-shaped. They do not preserve operation/action/version IDs or guaranteed before snapshots. SPEC-03 evolves the schema and repository without discarding existing rows.

### I-004 — Subscribers are hand-wired

Ledger, audit, transcription, broadcasters, and TRIGGERS bus listeners subscribe directly. SPEC-02 introduces one governed dispatcher for new admitted facts. SPEC-03 and SPEC-04 migrate the two MVP subscribers. Existing TRIGGERS remains outside the controller until per-definition registration and scoped commands exist. Remaining direct subscribers are inventoried compatibility debt, not silently claimed complete.

### I-005 — Code Standards encoded an incompatible earlier UEB design

The enforcement page previously required accepted-reference leases, command slots, a supervised executor, and fully detached subscriber delivery. That contradicted the approved MVP direction for trusted `publishFact`, a bounded ledger `required_ack`, operational before-snapshot gating, and targeted renderer recovery. The active Code Standards router and applicable pages were repaired and added to this candidate, and every SPEC now names its exact standards authority with no remaining supersession.

### I-006 — Panel-relative paths could split one physical resource and touch dirty editors

File Viewer, Office, and Email can expose the same physical file through different panel/path aliases. The repaired contract derives one canonical workspace-relative path before resource identity and persistence, retains ingress alias only as correlation, and scopes MVP canonical/recovery projection to the read-only File Viewer key. Dirty Office/Email adoption remains deferred.

### I-007 — Privileged publisher and upward grant acquisition were data-shaped

A caller-selected producer key or human-looking principal would not enforce the claimed boundary. SPEC-02 now requires one host-owned mint-and-seal bootstrap with no generic publisher export, and SPEC-01 requires closure identity with a test-only opaque authorization capability while production exposes no upward caller.

### I-008 — Query and restart/session failure boundaries were incomplete

The compact provenance query lacked a public protocol and epoch, query errors could not represent an invalid request ID, the save response lacked exact phase/ID/status shapes, stale save intent could mutate the wrong workspace, File Viewer reads could label A1 bytes with A2 state, the UTF-8 boundary was not executable, `accepted` operations lacked a restart transition, workspace messages could route ahead of their switch frame, and `file_save.content` lacked an explicit log-redaction requirement. SPEC-03 now establishes deterministic text validation, locked versioned save/query families, equality-only workspace preconditions, one bounded bind queue, stale A→B→A request/reply rejection, interrupted-before-prepare handling, and redaction. SPEC-04 extends the same queue/epoch contract to exact File Viewer read and projection protocols.

## Deferred, Non-Blocking Work

### D-I01 — Existing direct subscribers outside MVP

Chat audit, transcription, workspace lifecycle, calendar, harness status, and other broadcasters remain direct listeners until individually migrated. They must be listed in the SPEC-02 compatibility inventory.

### D-I02 — Direct harness file edits

Current CLI harness tools can mutate workspace files outside the new command controller. Arbitrary external observation is excluded from MVP, so this roadmap does not promise provenance or refresh for that route. Later harness/tool integration should emit registered tool facts and use a mediated file capability or an explicitly approved compatibility observation bridge.

### D-I02A — Local WebSocket authentication

The current loopback WebSocket does not authenticate a human renderer versus another local client. MVP records honest `local_client` transport origin and does not expose a custom-view bridge. Electron/preload session authentication and stronger UI/script principals require a later security SPEC.

### D-I03 — Snapshot retention and restore UX

The MVP stores before snapshots and exposes queryable IDs. Thirty-day delete retention, compaction, restore commands, restore UI, quotas, and user-empty controls require a follow-on recovery SPEC.

### D-I04 — Other mutation and recovery classes

Create/move/rename/delete, archive collisions, cross-panel moves, Office thumbnail sidecars, recursive directory manifests, binary deltas, large-file storage, and cross-file transactional restore remain out of scope. The MVP save controller rejects unsupported targets before mutation rather than claim coverage.

### D-I05 — Systems permission UI and bundle import

The registry schema and service rules are delivered now. Discovery, import review, pending popups, toggle rendering, config write-through, and System Manager bootstrap remain later work.

### D-I06 — Office dirty-draft behavior

File Viewer is read-only and may adopt remote clean content immediately. Office and Email need operation echo/ack, clean adoption, dirty preservation, and conflict presentation before using the same projection for active editors.

### D-I07 — Full causal graph and schema hardening

Accepted-reference capabilities, historical proof objects, storm compaction, full graph edges, and inference/confidence policies from `008-Provenance-Temp` remain future hardening. They must be re-evaluated against the simpler fact-first MVP rather than treated as prerequisites.

### D-I08 — External connectors

Calendar, Email, and other macOS/external systems require explicit plugin contracts, scoped capabilities, and user consent. General filesystem watching is not their substitute.
