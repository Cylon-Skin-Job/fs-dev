# MVP Provenance and Governed Subscriptions Decisions

> This ledger reconciles explicit owner decisions for this bounded roadmap. It becomes implementation authority only with approval of the exact release candidate.

## Owner Decisions

### MVP-D01 — Use the existing UEB as the one firehose

All server facts flow through the existing Universal Event Bus. Consumers subscribe through filters. Renderer freshness, provenance persistence, and future automations must not create parallel event services.

### MVP-D02 — Keep commands out of the firehose

Frontend intent flows into a centralized server command controller. The owning service validates and mutates. Successful work emits facts to UEB. Subscribers may cause new work only by invoking an authorized named command, which emits its own facts.

### MVP-D03 — Store schemas, subscription definitions, and permission authority in SQLite

The packaged application must not depend on discovering an editable project JSON file to decide server authority. JSON definitions live in the database. A locked system portion describes shipped components; user/extension definitions are separate and mutable within recognized meta-schema boundaries.

### MVP-D04 — Separate authored requests from grants

Configuration, an assistant, or a script may request, narrow, remove, or revoke permissions. It may not grant, restore, expand, or unquarantine authority. Those actions require an explicit human Systems-panel authorization path. Database state is authoritative.

### MVP-D05 — Register folder bundles before execution

Folder presence is not installation or permission. Future import reads and validates a bundle, snapshots its revision, stores normalized inactive definitions, and presents requested permissions off/pending. Import UI and file reconciliation are outside this MVP, but the registry schema must not preclude them.

### MVP-D06 — Use host identities, not DOM identities

The host/server creates durable IDs for installations, views, actions, commands, scripts/runs, events, resources, and file versions. A physical resource is keyed from its canonical workspace-relative path and fingerprint, not the panel/path alias used to reach it. DOM IDs may help UI testing but never become authority or provenance identity.

### MVP-D07 — Prefer timestamped facts over inferred verdicts

Record command acceptance, file mutation, script/tool/run facts, snapshots, and chat facts independently with timestamps and shared IDs when available. Missing direct causality never blocks recording, snapshotting, rendering, or later human/assistant conclusions. Direct cause fields are reserved but absent from the MVP event schemas.

### MVP-D08 — Capture save/session grain, not keystrokes

Manual editing provenance is recorded at save, autosave, checkpoint, milestone, or session boundaries. Per-keystroke logging is excluded.

### MVP-D09 — Preserve before snapshots for non-Git recovery

MVP guarantees an exact before snapshot for its first mediated operation: saving a validated Unicode-scalar/NUL-free JSON string as exact UTF-8 bytes to a compatible regular file, at most 10 MiB before and after. Existing bytes must fatal-decode and round-trip as canonical UTF-8 under the same NUL rule. Save-to-missing records an absent preimage and becomes a create fact. Unsupported text/binary, oversized, directory, any final symlink target, or any parent resolving outside the workspace/panel root is rejected before mutation. This is an explicit safety narrowing of legacy linked-file save behavior. Later operation classes require their own snapshot rules.

### MVP-D10 — Exclude arbitrary external filesystem changes

Arbitrary Finder/editor/background filesystem changes are not an MVP provenance source or acceptance case. Approved external systems enter later through explicit connector/plugin interfaces. Existing watcher behavior may remain for compatibility but cannot define MVP correctness.

### MVP-D11 — Defer complete chat/tool provenance without blocking its future insertion

The MVP establishes stable operation, command, event, resource, origin, and file-version identities plus versioned schema-extension points. It does not add empty thread/turn/tool/script fields or normalize chat and tool calls now. Later independently timestamped facts and schema versions can add those identities without replacing the ledger or resource store.

### MVP-D12 — Make File Viewer the first confirmed renderer customer

File Viewer must display an app-mediated file change in real time through UEB, a registered renderer projection, the existing WebSocket, and central Zustand state. No menu refresh, private view listener, new socket, or direct DOM patch is acceptable.

### MVP-D13 — Quarantine is subtractive authority

Future supervisor AIs may quarantine, narrow, or revoke an installation/subscriber and then create an Issues inbox record. They cannot grant, restore, expand, or unquarantine. Containment happens before notification. The MVP stores compatible states but does not implement the supervisor loop.

### MVP-D14 — Replace the old accepted-reference MVP gate with simple trusted admission

The latest owner direction rejects making provenance depend on an elaborate evidence/true-false system. For this trusted built-in MVP, the existing UEB module gains a private schema-validating fact-admission path. Only admitted, frozen facts reach governed subscribers. The implementation does not create accepted-reference leases, historical proof capabilities, causal-confidence gates, owner cells, or arbitrary/untrusted subscriber executors. Legacy `emit/on` events remain compatibility-only. This decision supersedes `UEB-D01`, `LED-D03`, `LED-D04`, the accepted-reference prerequisites, and the broader `ULV-D02/D03/D05/D10/D12` gates only for the four approved MVP SPECs. MVP-D09 and SPEC-03 settle the smaller save-only snapshot/hash/idempotency/failure contract; their operational preimage row is not a canonical file-version event. Future untrusted subscribers, causal graphs, wider versioning, retention, restore, or canonical file-version events require separate hardening.

### MVP-D15 — Start with one mediated mutation: UTF-8 text-file save

The first vertical slice converts `file_save` only. Create/move/rename/delete remain compatibility paths until a later multi-resource SPEC handles archive collisions, cross-panel moves, folders, and Office sidecars honestly. A save to a missing file is classified as create with an absent preimage.

### MVP-D16 — Treat current local WebSocket origin as a reported local-client fact, not authenticated human identity

The current loopback WebSocket has no authenticated renderer principal. MVP records `origin.kind = 'local_client'`, the server connection ID, and optional reported UI context; it does not claim that transport proves a human click. Custom iframe/plugin access to mutation commands is not exposed by this roadmap. A future host bridge/session-auth SPEC must establish stronger UI/script principals before those origins are claimed.

### MVP-D17 — Keep TRIGGERS compatibility outside the governed MVP

Current TRIGGERS bus, file, and cron execution remains unchanged compatibility behavior. It is not wrapped in a system-granted adapter, because that would let editable files inherit the adapter's authority. A later migration must register each executable definition as its own pending/granted subject and replace raw action closures with scoped named commands.

### MVP-D18 — Make the routed Code Standards part of implementation authority

The active machine-scoped Code Standards hub and the exact pages routed by each SPEC are required implementation and review authority. The UEB enforcement standard uses the trusted built-in governed publisher/subscription model rather than the earlier accepted-reference/lease MVP gate. Editing the standards does not itself authorize product implementation; the exact roadmap candidate still requires owner approval.

## Spec Contracts Reconciled From Existing Authority

- UEB events are facts; this agrees with the current UEB Wiki and active `event-bus.js`.
- The database is storage behind subscriber capabilities, not ambient permission; this comes from `../010-ModularizeDB-Temp/CAPTURE.md`.
- Folder presence, registration, consent, and activation are distinct; this agrees with Vision Roadmap D-043 through D-046.
- Database permission state wins over configuration; this agrees with D-052 and D-053.
- Built-in views remain React and custom views may use iframes; this follows repository `AGENTS.md` and narrows older View Builder proposals.

## Implementation Choices Fixed By This Candidate

These choices do not change the product direction and are fixed so builders have no authority blocker:

- schema/subscription JSON is stored as canonical JSON text plus SHA-256 checksum;
- the MVP snapshot guarantee is `file_save` for UTF-8 regular files of at most 10 MiB, including absent targets;
- built-in subscribers are selected by an allowlisted `handlerKey`, never executable code from SQLite;
- registry runtime reload is explicit/startup-driven and atomically swaps complete validated generations;
- exact event-type filters plus closed resource-operation/ingress-panel predicates are sufficient for MVP;
- governed publishers are minted once from a host-owned static catalog, injected as exact closures, and sealed before dynamic project code or sockets start;
- recognized panel/path aliases normalize to one canonical workspace-relative physical resource path; MVP render projection targets only File Viewer;
- the minimal provenance query is a typed workspace-session-derived WebSocket request/result/error family;
- SPEC-03 establishes server bind epochs and exact versioned save/query replies; SPEC-04 extends that same epoch contract to file reads and unsolicited projections;
- client-sent workspace ID/epoch pairs are stale-intent preconditions only; server session state remains authoritative and held A1 requests fail after A→B→A;
- the minimal renderer projection message is `resource:changed`; legacy `file_changed` remains compatibility-only until removed by SPEC-04;
- compact provenance query defaults to 50 rows and hard-caps at 200.
