# SPEC-01 — Component/Tab Action Context

**Status:** `CANDIDATE — OWNER APPROVAL REQUIRED`
**Bundle:** `TABS-PROVENANCE-BRIDGE`
**Mission:** Attach validated tab/component/presenter/target context to
UI-originated mediated-save provenance, so each durable workspace-resource
mutation records where in the UI it was initiated — reusing the accepted save
path and governed-fact mechanism, not a new event subsystem.

## 1. Authorities And Baseline

Read before implementation:

- `../../../../../AGENTS.md`;
- bundle `HANDOFF.md`, `DECISIONS.md` (BRG-D01…D11), `ROADMAP.md`,
  `GUIDANCE.md`;
- `../../../Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`
  and routed pages `001-Architecture_Routing`, `003-State_Management`,
  `004-WebSocket_Protocol`, `005-Universal_Event_Bus`,
  `007-Persistence_And_Metadata`, `008-Testing_And_Smoke_Slices`;
- `../TABS-PROVENANCE-COORDINATION/INTERFACE-CONTRACT.md` (planned contract to
  reconcile) and `../TABS-PROVENANCE-COORDINATION/OWNER-DECISIONS.md`;
- `../../028-System-View-Relocation-And-Configured-Tabs/BRIDGE-01-HANDOFF.md`;
- `../../024-Agent-Tool-Provenance/PROV-01-INTEGRATION-REPORT.md`,
  `SPEC-01-AGENT-TOOL-PROVENANCE.md`, `DECISIONS.md`;
- `../../023-MVP-Provenance-Subscriptions/SPEC-03-MEDIATED-FILE-PROVENANCE.md`
  and `SPEC-04-FILE-VIEWER-LIVE-RENDER.md`;
- `../../026-Tab-Target-Placement/TAB_TARGET_PLACEMENT_ORCHESTRATOR_REPORT.md`
  §10 and `TAB_TARGET_PLACEMENT_SPEC.md` §13;
- `../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md`
  (`actor`/`context`/`cause` enums).

Accepted baselines (authenticate at dispatch): TABS-03 implementation `22cc435`,
merge `2748f03`; PROV-01 source `acf12da`, merge `d31fc8a`; current line
baseline `7372933` (handoff commits `5d0460f`, `333d49e`). The next free
migration is `040`.

## 2. Observable Outcome

After a user performs a mediated save through a tabbed view:

- the durable `resource.mutated@1` fact and its matching
  `file.command_accepted@1` fact carry a validated `ComponentActionContext`
  naming the workspace, view, and — when the active tab is component-backed —
  the tab/component/presenter/target that initiated the save;
- the context is a **snapshot** taken at command time: closing the tab or
  switching views afterward does not change or erase it;
- when context is unavailable, malformed, or stale, the save succeeds
  unchanged and the context is omitted/degraded with a fixed diagnostic;
- the view capsule's persisted `state.json` is **not** written by this feature;
  and
- existing mediated-save, provenance, and File Viewer regressions stay green.

## 3. Scope

### In scope

- the `ComponentActionContext` contract and its reconciliation with
  `INTERFACE-CONTRACT.md`;
- a bounded renderer-side context adapter that reads the live view state at
  command time;
- populating and extending the existing mediated-save `reportedUiContext`
  carrier (`{viewId, viewInstanceId}` today) with tab/component/presenter/target;
- server validation and persistence of the extended context on the accepted
  resource-mutation fact(s);
- schema/registry extension for the new context fields;
- queryability by workspace/view/tab/component/target;
- focused unit, integration, runtime, and restart proof.

### Out of scope

- building the SPEC-34 `ui.action`/`uiActionId` renderer envelope or the SPEC-40
  canonical API (BRG-D09);
- any provenance rendering/display surface (BRG-D06);
- retention/pruning (BRG-D07);
- non-mutating UI telemetry (BRG-D04);
- editing the fingerprint-frozen TABS-03 `componentTabPlacement*` types;
- adding provenance to non-save mutation commands (rename/move/delete/create/
  import): those routes do not carry the mediated-save carrier today; that
  coverage gap is recorded, not built here;
- chat identity (`threadGroupId`/`threadId`/`surfaceId`) — SPEC-02.

## 4. Canonical Context Contract

```ts
type ComponentActionContext = {
  workspaceId: string;
  viewId: string;
  viewInstanceId?: string;
  tabId?: string;
  componentTypeId?: string;
  componentInstanceId?: string;
  presenterId?: string;
  targetKey?: string;
};
```

Rules:

1. `workspaceId` and `viewId` are **required** and server-authoritative: the
   server derives/validates workspace from the authenticated connection; it may
   use but never blindly trust a renderer-supplied workspace.
2. `tabId`, `componentTypeId`, `componentInstanceId`, `presenterId`, and
   `targetKey` are **optional** and present only when the initiating tab is a
   component-backed tab. Absence is a valid state; no value is invented.
3. `viewInstanceId` preserves the existing `reportedUiContext` field meaning.
4. The context is opaque query context, never a principal, permission,
   resource identity, or causal claim (`INTERFACE-CONTRACT.md` §Shared
   boundaries; PROV-H02).
5. **Reconciliation:** this contract makes the tab/component identifiers
   optional, superseding `INTERFACE-CONTRACT.md`'s required `tabId`/
   `componentTypeId`/`componentInstanceId`. The interface contract's change rule
   is honored by recording this reconciliation here; the coordination bundle is
   not edited into authority.

## 5. Renderer Context Adapter

- **Source:** the live view/tab state at actual command time — the active panel
  and its active tab record (per-view persisted `viewStates[viewId]` activity /
  the connected component-tab owner that already carries `workspaceId`/`viewId`
  and the tab's `presenterId`/`targetKey`).
- **Placement:** the adapter lives beside the command sender (the save caller),
  reads existing selectors, and returns a plain `ComponentActionContext` object.
  It must not become a store, subscribe to state, or own tab state.
- **Ownership:** module-private and memory-only; it must not add fields to
  Zustand, the view capsule, or any persistence.
- **Bounded and pure:** synchronous, no I/O, no await, no entropy, no dynamic
  import, no traversal beyond the active tab record. Fixed caps (at minimum:
  identifier strings bounded per the WebSocket standard) apply before send.
- **Fail-open:** any failure or missing field omits that field / the whole
  context and emits at most a fixed non-canonical diagnostic; it never blocks or
  delays the save and never substitutes a guessed value.
- **Ephemeral `viewInstanceId`/`surfaceId`:** these are transient mount
  identities; only durable identities are eligible for later persisted tab
  descriptors (relevant to SPEC-02), and neither is session authority.

## 6. Command And Fact Integration

Baseline chain to extend (authenticate exact names at dispatch):

- client save send: `fusion-studio-client/src/lib/ws/file-save-protocol.ts`
  and its caller in `fusion-studio-client/src/state/fileDataStore.ts` (which
  does not currently pass `reportedUiContext`);
- server route: `fusion-studio-server/lib/ws/file-save-route.js`;
- owner/controller: `lib/file-mutations/save-controller.js`;
- repository: `lib/file-mutations/file-operation-repository.js`;
- fact origin: `lib/file-mutations/fact-reservation-bindings.js`;
- schemas: `lib/event-registry/schemas/resource-mutated-v1.json`,
  `file-command-accepted-v1.json`;
- validator/registration: `lib/event-registry/schema-validator.js`,
  `seed-catalog.js`, `filter.js`, `capability-catalog.js`.

Rules:

1. The save message carries the adapter's `ComponentActionContext`. Extend the
   existing `reportedUiContext` on the wire and in the fact origin (preferred),
   or add one equally bounded sibling field; do not create a second parallel UI
   context vocabulary.
2. The server validates shape/bounds and derives authoritative workspace;
   renderer-supplied workspace/view are comparison evidence, not authority.
   Paths remain canonicalized server-side exactly as today.
3. Persist the context on the durable fact so it is queryable by
   workspace/view/tab/component/presenter/target. Where the repository already
   stores `reported_view_id`/`reported_view_instance_id`, extend with the new
   coordinates through the next-free migration if a queryable column is
   required; the fact JSON must always carry the full context.
4. **Fail-open and isolation:** provenance/metadata failure never rejects,
   delays, rolls back, or rewrites the accepted save. Missing context is
   omission, not failure (`Wiki .../003-Provenance_Model/PAGE.md` §Metadata Must
   Not Gate Valid Work; UEB standard §Failure Isolation).
5. No raw secret, credential, or unbounded value enters the context; standard
   redaction applies.
6. No new event family is registered by this SPEC. This SPEC extends existing
   accepted event schemas only.

## 7. State Ownership

- The bridge **reads** the live view config (`state.json` under
  `viewStates[viewId]`) at command time and **writes nothing back** (BRG-D08).
- The durable fact stores a snapshot; nothing re-reads the view config later.
- The State Management rule ("do not store the same authoritative fact twice")
  is respected: SQLite owns the historical attribution, the view capsule owns
  current live tab state; they are different facts.

## 8. Non-Goals

- Rendering provenance; building a History/Activity view or doc action bar.
- Pruning/retention; deleting provenance on tab close or group delete.
- Recording placement, focus, navigation, or other non-mutating interaction.
- Treating tab/component identity as actor, permission, or causal proof.
- Moving placement authority into UEB subscribers (TABS-03 §10).

## 9. Dependency-Ordered Slices

### Slice 01A — Context contract and renderer adapter (client)

Start at a real Capture/File mediated save and carry the active-view/tab context
through the renderer adapter into the save command. Prove: context populated for
a component-backed tab; omitted cleanly when absent; no Zustand/view-state
schema change; bounded and fail-open.

### Slice 01B — Server validation, schema, and persistence (server)

Extend the save route/controller/repository/fact origin and the two accepted
schemas; validate, derive workspace, persist the context on the durable fact,
and expose it to the existing provenance query path. Prove query by
workspace/view/tab/component/target and fail-open on malformed context.

### Slice 01C — Integration proof and report

End-to-end: user saves in a tabbed view → context appears on the durable fact →
tab closed/switch view → context intact → restart → context intact; mediated
save, PROV-01, TABS-03, and File Viewer regressions green; produce the
implementation report.

Every slice follows `GUIDANCE.md`: one fresh `spec-slice-builder` owns the slice,
including mechanically necessary integration, self-review, checks, and
deviations. It may spawn only fresh `spec-gate-reviewer` agents, never another
builder, and repairs forward until its first clean pass without an arbitrary
pass ceiling. The SPEC orchestrator then runs a separate fresh review and routes
any repair back through the owning builder before integration. Each pipeline
role runs on its pinned per-agent model and effort; do not substitute.

## 10. Required Verification

Focused tests equivalent to:

- client adapter unit tests (present/absent/stale/oversize/fail-open; no store
  mutation; no view-config write);
- server validation + fact-origin persistence tests for the extended context;
- an e2e/Electron proof: save in a tabbed view, then tab close/view switch,
  restart, and confirm the durable fact still carries the snapshot.

Required proof:

- `resource.mutated@1` and `file.command_accepted@1` carry the validated
  context; workspace is server-derived;
- missing/malformed context never changes the save result;
- context survives tab close and restart unchanged;
- view `state.json` bytes are unchanged by the feature;
- mediated-save, PROV-01 (activity/observation/ledger), TABS-03 placement, and
  File Viewer live-render suites remain green.

Run at minimum:

```bash
cd fusion-studio-client && npm run build
cd fusion-studio-server && npx jest --maxWorkers=2
```

Plus the accepted mediated-save live proof and the durable smoke
`node e2e/view-capsule-public-shell-smoke.mjs` → `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK`
(gate file sha256-pinned — never edit).

## 11. Expected Changed Areas

Expected, not exclusive:

- client: a focused context-adapter module; `lib/ws/file-save-protocol.ts`;
  `state/fileDataStore.ts` (populate carrier); relevant view selectors;
  `types/file-explorer.ts` (context type);
- server: `lib/ws/file-save-route.js`, `lib/file-mutations/save-controller.js`,
  `lib/file-mutations/file-operation-repository.js`,
  `lib/file-mutations/fact-reservation-bindings.js`;
- `lib/event-registry/schemas/resource-mutated-v1.json`,
  `file-command-accepted-v1.json` and the registry catalogs/validator;
- next-free migration `040` only if queryable columns are required;
- focused tests and the implementation report.

No TABS-03 `componentTabPlacement*` type, SPEC-34 file, PROV migration, or
chat file is edited.

## 12. Definition Of Done

SPEC-01 is complete only when all slices pass their targeted/full checks, the
first builder-owned and orchestrator-owned clean-room reviews pass, deviations
and downstream effects are reported, the supervisor presents the result, and the
owner explicitly accepts it. Until then BRIDGE-02 dispatch remains blocked.
