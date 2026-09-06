# SPEC-01 — Database Registry Authority

**Status:** `CANDIDATE — OWNER APPROVAL REQUIRED`  
**Mission:** Put event schemas, subscription definitions, requested capabilities, effective grants, and activation state in SQLite with an application-locked system partition and a separate user/extension partition.

## Applicable Code Standards

- Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`
- Routed pages:
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`
- Approved supersessions: none.

## Observable Outcome

After migration and startup:

- the server can enumerate versioned event/schema and subscription JSON from SQLite;
- shipped system schema entries are enabled and checksum-verified; a system subscription is inserted only by the same SPEC that ships its allowlisted handler;
- user/extension entries may be inserted only as `pending` with no effective grants;
- requested capabilities never imply granted capabilities;
- revoke/narrow/quarantine operations take effect; grant/expand/unquarantine requires a human-authorization repository method whose caller is not exposed in this MVP;
- corrupt or modified locked rows are runtime-quarantined/inactive and diagnosed without silently rewriting their persisted lifecycle state or preventing startup;
- no project-folder scan can create or enable a registry entry.

## Required Data Contract

Implement equivalent normalized tables through migrations. Exact SQL names may vary only with a documented deviation; semantics may not.

### `event_schema_registry`

- `schema_id` opaque primary key
- `schema_key`, `schema_version`, and `definition_kind` (`event|projection|command|query`), unique together
- `owner_kind` (`system|extension`) and `owner_id`
- `locked` boolean
- `status` (`enabled|disabled|pending|quarantined|revoked`)
- `definition_json` canonical JSON text
- `definition_sha256`
- `created_at`, `updated_at`

### `event_subscription_registry`

- `subscription_id` opaque primary key
- owner, lock, status, timestamps
- `handler_key` identifying an allowlisted built-in handler
- `priority` integer from -1000 through 1000; lower runs first, default 0
- `filter_json`
- `requested_capabilities_json`
- `definition_json` and SHA-256 checksum
- `delivery_policy` (`best_effort|required_ack`); only a locked built-in row may use `required_ack` in MVP
- optional future `installation_id` and revision fields, nullable in MVP

### `event_subscription_grants`

- `subscription_id`, `capability_key`, `state` (`pending|granted|denied|revoked`)
- `scope_json`
- `authorized_by_kind` (`system_seed|human`)
- authorization timestamps
- unique subscription/capability key

`effective` is derived, not caller-written: subscription enabled, definition valid, handler allowlisted, request includes capability, grant is granted, scope valid, and system checksum valid when locked. `definition_json` is the canonical checksummed envelope containing handler key, priority, filter, requested capabilities, delivery policy, owner, lock, and schema references; the convenience columns must exactly equal its normalized projections or the row is runtime-inactive. Grants remain separately authoritative and are not covered by a definition checksum.

Persisted lifecycle state is not rewritten merely because runtime validation fails. An enabled row with an unknown handler or invalid checksum is runtime-inactive and diagnosed; it is not automatically changed to `quarantined`, because unquarantine is human-owned. Explicit quarantine remains a subtractive administrative action.

`disabled` preserves the definition and grants but makes effective authority empty. A config/assistant/script may transition `enabled -> disabled`; only the future human authorization boundary may transition `disabled -> enabled`. `pending` means never granted/activated, `revoked` means authority removed, and `quarantined` means containment requiring human unquarantine; these states are not interchangeable.

MVP production exports only read/effective-state and subtractive repository operations. Upward transitions (`grant`, `disabled -> enabled`, restore, expand, unquarantine) require strict identity with an opaque authorization capability captured by the repository closure; strings, object shapes, database values, and caller-supplied principal labels never satisfy it. Production startup has no capability minter and exposes no upward caller. Focused tests construct the capability only through a test-only repository fixture, prove that a lookalike/serialized value is rejected, and do not create a production grant route. The later Systems panel must add a host-owned human authorization broker in its own reviewed SPEC rather than reuse a test hook.

## MVP Capability Catalog

The catalog is closed for this bundle:

| Capability key | Exact scope JSON | Scoped context method |
|---|---|---|
| `fact.consume` | `{ "eventTypes": [{ "eventType": "resource.mutated", "schemaVersion": 1 }] }` | permits delivery only; exposes no method |
| `ledger.append_resource_fact` | `{ "workspaceScope": "event" }` | `appendResourceFact(fact)` |
| `renderer.publish_resource_changed` | `{ "workspaceScope": "event", "messageType": "resource:changed", "messageVersion": 1, "panel": "file-viewer" }` | `publishResourceChanged(message)` |
| `renderer.publish_resource_refresh_required` | `{ "workspaceScope": "event", "messageType": "resource:refresh_required", "messageVersion": 1, "panel": "file-viewer", "reasons": ["projection_failed"] }` | `publishResourceRefreshRequired(message)` |
| `diagnostic.write_fixed` | `{ "codes": [<closed handler-owned codes>] }` | `writeDiagnostic(code)` with no payload values |

No MVP context exposes raw Knex/SQLite, filesystem, WebSocket/session maps, EventEmitter, action-handler closures, arbitrary event emission, or command invocation. Adding a capability key or widening a scope is a registry/schema change reviewed with the owning later SPEC.

## Closed MVP Filter Grammar

`filter_json` is exactly:

```ts
type MvpFactFilter = {
  eventTypes: Array<{
    eventType: 'resource.mutated';
    schemaVersion: 1;
  }>;
  resource?: {
    operations?: Array<'create' | 'modify'>;
    kinds?: Array<'file'>;
    ingressPanels?: string[];
  };
};
```

Unknown keys, empty arrays, duplicate values, more than 16 ingress-panel keys, panel keys over 128 UTF-8 bytes, regex, glob, negation, JSONPath, and executable predicates are invalid. Arrays are canonicalized as sorted unique values. `ingressPanels` matches `resource.access.panel`; panel context never participates in resource identity. A fact must match an event type/version and every present resource predicate. Both MVP system subscriptions use event `resource.mutated@1`, operations `create|modify`, and kind `file`, with no ingress-panel restriction. Their priorities are ledger `-100` and renderer `0`.

## Seeded MVP Entries

SPEC-01 checks in literal JSON Schema 2020-12 documents (`additionalProperties: false` at every object) and seeds their canonical JSON bytes. The normative final-message shapes are:

```ts
type LocalClientOrigin = {
  kind: 'local_client';
  connectionId: string;
  assurance: 'transport_only';
  reportedUiContext?: { viewId?: string; viewInstanceId?: string };
};

type FileResource = {
  resourceId: string;
  kind: 'file';
  path: string; // canonical workspace-relative physical path
  access: { panel: string; path: string }; // validated command ingress alias
};

type FileCommandAcceptedV1 = {
  eventId: string;
  eventType: 'file.command_accepted';
  schemaVersion: 1;
  occurredAt: number;
  workspaceId: string;
  operationId: string;
  commandId: string;
  origin: LocalClientOrigin;
  resource: FileResource;
  intent: {
    kind: 'save';
    saveReason?: 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';
    milestone?: string;
    clientActionId?: string;
  };
};

type ResourceMutatedV1 = {
  eventId: string;
  eventType: 'resource.mutated';
  schemaVersion: 1;
  occurredAt: number;
  workspaceId: string;
  operationId: string;
  commandId: string;
  commandAcceptedEventId: string;
  origin: LocalClientOrigin;
  resource: FileResource;
  mutation: {
    kind: 'create' | 'modify';
    saveReason?: 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';
    milestone?: string;
  };
  fileVersionId: string;
};

type ResourceChangedV1 = {
  type: 'resource:changed';
  version: 1;
  eventId: string;
  operationId: string;
  workspaceId: string;
  resourceId: string;
  resourceKind: 'file';
  operation: 'create' | 'modify';
  panel: 'file-viewer';
  path: string;
  occurredAt: number;
  workspaceEpoch: string;
};

type ResourceRefreshRequiredV1 = {
  type: 'resource:refresh_required';
  version: 1;
  workspaceId: string;
  panel: 'file-viewer';
  path: string;
  operationId: string;
  workspaceEpoch: string;
  reason: 'fact_publish_failed' | 'projection_failed' | 'projection_unavailable' | 'mutation_outcome_unknown';
};
```

Generated event/operation/command/resource/version/epoch IDs use canonical lowercase UUID syntax. Existing workspace, connection, view, client-action, and ingress-panel IDs are nonempty UTF-8 strings capped at 128 bytes. Canonical and ingress paths are normalized, nonempty UTF-8 strings capped at 4096 bytes. `resource.path` is always canonical workspace-relative physical identity; `resource.access` is correlation/routing context and cannot change `resourceId`. Renderer and recovery projections are deliberately fixed to the read-only `file-viewer` panel for this MVP. Milestone is capped at 256 UTF-8 bytes. Timestamps are nonnegative integer epoch milliseconds. Optional fields are omitted rather than null. `milestone` is legal only when `saveReason = milestone`. The checked-in schema files, validator fixtures, and the explanatory restatements in SPEC-03/04 must be byte-semantically equivalent; SPEC-01 acceptance fails on drift.

Seed exactly:

- event schema `resource.mutated` v1;
- projection schema `resource:changed` v1;
- recovery projection schema `resource:refresh_required` v1;
- event schema `file.command_accepted` v1;

SPEC-03 atomically adds the allowlisted ledger handler, its `required_ack` subscription row, requested capabilities, and locked system grants. SPEC-04 does the same for the best-effort renderer projection. SPEC-01 must not create enabled references to absent handlers.

Seeds use stable semantic keys but migration-safe IDs. Re-running migrations/startup is idempotent. A bundled seed catalog is the expected checksum source; SQLite is authoritative for active state but cannot silently redefine locked shipped behavior.

## Slices

### Slice 01a — Migration and canonical JSON utility

Create tables, constraints, indexes, deterministic canonical JSON/checksum support, and rollback. Preserve migration 029 data.

### Slice 01b — Registry repository and policy

Implement read/enumerate, create-pending, request change, revoke, quarantine, the closure-bound/test-only human-authorization boundary, and effective-state calculation. No generic SQL or arbitrary definition execution.

### Slice 01c — Seed reconciliation and startup verification

Seed locked schema entries, verify checksums/handler keys/capabilities, keep invalid entries runtime-inactive, and expose compact diagnostics. Startup continues when one entry is bad.

## Expected Integration Areas

- `fusion-studio-server/lib/db/migrations/`
- new `fusion-studio-server/lib/event-registry/` modules
- `fusion-studio-server/lib/startup.js`
- new `fusion-studio-server/test/event-registry/` tests

Expected paths are advisory, not an allowlist.

## Acceptance

Required tests prove:

- fresh migration and down/up behavior;
- idempotent seed reconciliation;
- canonical JSON produces stable SHA-256 across key order;
- changing a locked handler/priority/filter/request/delivery-policy projection without changing its canonical envelope and checksum makes only that row runtime-inactive;
- extension/user entries start pending with zero effective grants even if their JSON says enabled/granted;
- a config-style request may revoke/narrow but not grant/expand;
- config/assistant disable takes effect, while re-enabling is rejected without strict identity with the opaque test-only authorization capability;
- string/object/serialized lookalikes cannot forge the opaque test-only human authorization capability, and production startup exposes no minter or upward route;
- unknown handler/capability/schema and checksum drift keep only the affected row runtime-inactive without silently rewriting its lifecycle state;
- exact catalog keys/scope grammars accept the two later system subscription fixtures and reject all widening/unknown methods;
- the closed filter grammar, array canonicalization, predicate AND semantics, priority bounds, and ledger-before-render ordering are deterministic;
- resource schemas distinguish canonical workspace-relative identity from ingress panel/path correlation, and renderer/recovery projections reject any panel other than literal `file-viewer`;
- a same-SPEC system seed fixture with an installed test handler has effective grants; an upward repository path can be tested only with the closure-bound opaque test capability;
- no filesystem discovery occurs.

Run at minimum:

```bash
cd fusion-studio-server
npm test -- --runInBand test/event-registry
npm test -- --runInBand test/ledger/event-ledger.test.js
```

## Review Packet

The fresh builder and both clean-room reviewers must inspect migration rollback/data preservation, authorization bypasses, checksum canonicalization, invalid JSON, concurrent update behavior, and whether any API accidentally lets a raw definition grant itself authority.

## Out of Scope

Systems UI, bundle discovery/import, config write-through, arbitrary plugin migrations, custom tables, raw SQL, custom code execution, and supervisor AI behavior.
