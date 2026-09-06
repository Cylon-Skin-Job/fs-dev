# MVP Provenance and Governed Subscriptions Roadmap

**Roadmap status:** `CANDIDATE — OWNER APPROVAL REQUIRED`  
**Execution model:** Sequential SPEC orchestration with fail-forward repair and owner acceptance between SPECs

## 1. Product Milestone

The first milestone is dogfoodable resource freshness built on the architecture Fusion intends to keep:

- one existing UEB firehose;
- one database-backed source of truth for schemas, subscriptions, requested capabilities, grants, and runtime state;
- one server command boundary for in-scope file mutations;
- timestamped facts and before snapshots sufficient for later human or assistant conclusions;
- one registered renderer projection subscriber over the existing WebSocket;
- one central Zustand file-data store read by the File Viewer;
- no menu refresh after a mediated file change.

## 2. Ordered SPECs

| Order | SPEC | Delivers | Prerequisite | Owner acceptance unlocks |
|---:|---|---|---|---|
| 01 | [Database Registry](SPEC-01-DATABASE-REGISTRY.md) | System/user partitions; JSON definitions in SQLite; request/grant separation; locked seed integrity | Approved bundle | Runtime compilation |
| 02 | [Subscription Controller](SPEC-02-SUBSCRIPTION-CONTROLLER.md) | Validated fact admission; one governed UEB dispatcher; filters; scoped built-in handlers; atomic generation reload | SPEC-01 accepted | Provenance and projection subscribers |
| 03 | [Mediated File Provenance](SPEC-03-MEDIATED-FILE-PROVENANCE.md) | Host IDs; persistent resource identity; mediated text-file save; resource facts; minimal ledger query; before snapshots | SPEC-02 accepted | Renderer proof against admitted facts |
| 04 | [File Viewer Live Render](SPEC-04-FILE-VIEWER-LIVE-RENDER.md) | Resource projection over existing WS; central Zustand invalidation/refetch; File Viewer cutover; runtime proof | SPEC-03 accepted | MVP complete |

## 3. Dependency Graph

```text
SPEC-01 database authority
  -> SPEC-02 governed subscription runtime
    -> SPEC-03 mediated mutation + minimal provenance + snapshots
      -> SPEC-04 renderer projection + File Viewer live proof
```

The order is intentionally serial. SPEC-02 depends on actual registry rows and grant semantics. SPEC-03 needs the dispatcher before it emits facts for durable subscribers. SPEC-04 proves that exact path rather than creating a temporary refresh service.

## 4. Code Standards Authority Map

Every SPEC is governed by the active machine-scoped hub at `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` plus the routed pages below. These reviewed pages already express the MVP delivery, recovery, compatibility, persistence, client-state, protocol, and isolated-test contracts; no standards supersession is required.

| SPEC | Routed standards pages |
|---|---|
| SPEC-01 | `001-Architecture_Routing`, `004-WebSocket_Protocol`, `005-Universal_Event_Bus`, `007-Persistence_And_Metadata`, `008-Testing_And_Smoke_Slices` |
| SPEC-02 | `001-Architecture_Routing`, `005-Universal_Event_Bus`, `007-Persistence_And_Metadata`, `008-Testing_And_Smoke_Slices` |
| SPEC-03 | `001-Architecture_Routing`, `003-State_Management`, `004-WebSocket_Protocol`, `005-Universal_Event_Bus`, `007-Persistence_And_Metadata`, `008-Testing_And_Smoke_Slices` |
| SPEC-04 | `001-Architecture_Routing`, `002-Frontend_UI`, `003-State_Management`, `004-WebSocket_Protocol`, `005-Universal_Event_Bus`, `007-Persistence_And_Metadata`, `008-Testing_And_Smoke_Slices` |

## 5. Cross-SPEC Contracts

1. **Commands and facts remain separate.** Renderer intent enters a named server command. Command acceptance may emit its own non-success fact; only successful mutations emit a resource success fact. UEB subscribers never masquerade as command handlers.
2. **The database is authoritative.** Authored bundles may request permissions, but only database grants are effective. File text may revoke or narrow future authority; it may never grant or expand it.
3. **System and user definitions are separate.** Bundled system rows are migration-seeded, locked by application policy, versioned, and checksum-verified. User/extension rows remain independently mutable and start pending.
4. **No arbitrary code from the database.** MVP rows reference allowlisted built-in handler keys and declarative filters. Custom JavaScript, migrations, and raw SQL are deferred.
5. **The UEB is the shared firehose.** A schema-validating `publishFact` entry in the existing bus module admits MVP facts to a private accepted-fact delivery channel. New ledger and renderer behavior subscribes through the controller to that channel. Legacy `emit/on` remains compatibility-only. No second EventEmitter, WebSocket, polling loop, file watcher, or refresh daemon is added.
6. **Facts are useful without a causal verdict.** Every fact has a host-generated ID and timestamp. `operationId` groups one controlled operation. Direct cause fields are reserved but absent from this MVP. Later controlled follow-up commands may add them under a separately registered schema without retrofitting inferred claims.
7. **Origin claims match current assurance.** The unauthenticated loopback WebSocket can claim only `origin.kind = 'local_client'` with connection identity and `assurance = 'transport_only'`; reported view context is correlation data. Future authenticated UI/script/tool principals may use stronger versioned origin kinds. Time/path proximity is never rewritten as direct causation.
8. **Snapshots are operational safety records.** The in-scope `file_save` command captures exact pre-mutation bytes for an existing regular file whose bytes fatal-decode and round-trip as NUL-free UTF-8, at or below 10 MiB, or an `absent` preimage for save-to-missing. Intended content is a Unicode-scalar/NUL-free JSON string encoded once as exact UTF-8. Unsupported text/binary, oversized, directory, any final symlink target, or any parent resolving outside the workspace/panel root is rejected before mutation in this MVP; they do not receive a false restore claim. Rejecting linked-file saves is an approved MVP safety narrowing, not accidental compatibility.
9. **MVP snapshots do not imply a restore UI.** Records and query APIs must preserve enough data for a later named restore command without changing the schema.
10. **External observations are outside the acceptance claim.** The existing workspace watcher and all TRIGGERS file/cron/bus execution remain unchanged compatibility behavior. They do not enter the governed runtime, create MVP ledger facts/snapshots, or define acceptance. Per-trigger registration and consent require a later SPEC; wrapping editable trigger descriptors in one system-granted adapter is forbidden.
11. **The File Viewer reads central resource state.** Its tab/navigation identity may remain in `fileStore`, but file trees, file content, request correlation, invalidation, and live refetch come from `fileDataStore` or its renamed successor. The legacy component WebSocket listener is removed.
12. **Physical resource identity is panel-independent.** The server converts a validated panel/path ingress alias to one canonical workspace-relative physical path before identity lookup, mutexing, snapshots, ledger queries, and facts. The MVP renderer projection always translates that canonical path to the read-only File Viewer key; it does not invalidate or adopt Office/Email dirty-editor state.
13. **Dirty editors are not overwritten.** SPEC-04 proves the read-only File Viewer. Office/Email dirty-draft adoption and conflict behavior are a later roadmap family.
14. **Workspace pairs are preconditions, never authority.** Versioned save, provenance-query, and File Viewer read requests carry the client's current server-issued workspace ID/epoch so stale A1 intent can be rejected before mutation or I/O. The server still derives the workspace/root from its session and stamps replies with the pair captured at acceptance.

## 6. First Confirmed Test Case

The mandatory acceptance scenario is:

1. launch an isolated server and client fixture using a temporary application-data directory and temporary workspace;
2. open a small UTF-8 file in File Viewer and record its visible content;
3. submit an app-mediated `file_save` through the server command path from a second local-client fixture connection, recorded honestly as transport-only rather than authenticated user identity;
4. observe one successful mutation response, one admitted `resource.mutated` fact, one ledger record, one before snapshot, and one renderer projection;
5. verify the already-open File Viewer displays the new content without menu refresh, workspace switch, view remount, or direct DOM patch;
6. query provenance through the typed public WebSocket route by canonical or recognized panel-relative resource path and verify the returned operation/event/version IDs match the mutation;
7. verify the exact save response and query result carry the active server-issued workspace epoch and that delayed first-A replies are rejected after A→B→A;
8. verify navigation, selected tab, and unrelated cached file content remain intact.

Negative acceptance:

- a failed save emits no success fact or renderer projection;
- a malformed or ungranted subscriber row does not activate;
- an unrecognized handler key keeps that entry inactive and diagnosed;
- duplicate event delivery is idempotent for ledger/snapshot projections;
- no test touches the developer's live `fusion.db`, workspace files, or application profile.

## 7. Per-SPEC Execution Cycle

For every SPEC:

1. The supervisor confirms the predecessor has explicit owner acceptance.
2. A fresh `spec-orchestrator` receives only the approved SPEC packet, shared guidance, accepted predecessor handoff, and relevant current Wiki/code.
3. The orchestrator gives each slice to a fresh `spec-slice-builder` with explicit file/responsibility ownership and a warning that other work may coexist in the worktree.
4. The builder implements necessary bounded integration, runs targeted checks, records all deviations, and owns fresh clean-room review/repair until the first clean pass.
5. The orchestrator performs its own fresh clean-room review, routes repairs, runs acceptance commands/runtime evidence, and accounts for every deviation and downstream effect.
6. The supervisor independently checks the result and presents a plain-language owner report.
7. Only explicit owner acceptance unlocks the next SPEC.

`AUTHORITY_BLOCKED` is reserved for an indispensable owner choice not settled by the approved packet. `BLOCKED` is reserved for genuine execution impossibility. Dirty unrelated files, changed expected paths, failed tests, review findings, and necessary bounded integration are work to resolve and report, not reasons to abandon the SPEC.

## 8. Follow-On Roadmap Families

These are deliberately not orchestrator-ready in this bundle:

1. migrate Capture, Wiki, System, Agents, Tickets, Email, and Office read paths to the same resource store/projection contract;
2. add Office/Email canonical-resource versus dirty-draft conflict handling with operation echo/ack;
3. extract a reusable document editing controller from the proven save/adopt/conflict contract;
4. implement package import, Systems permission switches, request/grant reconciliation, and generated non-authoritative installation-state projection;
5. register each TRIGGERS bus/file/cron definition as its own pending/granted subject and replace raw action closures with scoped named commands;
6. convert create/move/rename/delete as explicit multi-resource operations, including archive collisions, cross-panel paths, and Office sidecars;
7. register script, automation, chat, harness, and tool-call facts and connect their existing IDs/timestamps to resource facts;
8. add named restore commands, retention, trash/version policy, and recovery UI;
9. add connector plugins for approved external systems such as Calendar and Email;
10. add supervisor-AI quarantine/revocation and Issues inbox reporting; supervisors may remove authority but never grant or restore it.

## 9. Global Completion Gate

The roadmap MVP is complete when all four SPECs are owner-accepted, their tests pass together, and the isolated runtime proof passes. The candidate already contains conditional authority notices in the current Wiki, 008 map, and TODO index; approval of the exact candidate ID activates those notices before implementation starts.
