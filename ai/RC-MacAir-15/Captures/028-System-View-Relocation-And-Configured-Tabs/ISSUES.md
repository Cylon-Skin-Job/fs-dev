# Issues and Deferrals

## Resolved for this candidate

### VRT-I01 — Does relocation require per-view copy recovery?

**Resolution:** No. Source and destination are within one machine-scoped
workspace tree. VIEW-01 preflights same-device atomic directory rename and
journals one whole-tree cutover. Cross-device or non-atomic conditions fail
before mutation.

### VRT-I02 — Does relocation require a new public mutation protocol?

**Resolution:** No. The workspace does not publish its view registry until
migration is verified. Existing public view mutations remain unchanged and run
only against the canonical resolver after readiness.

### VRT-I03 — May config register a component?

**Resolution:** No. It selects from a closed code-owned launcher registry.
Registration, dependencies, permissions, consent, revocation, and arbitrary
code loading require the later Provenance/plug-in control plane.

### VRT-I04 — How does `Open in current tab` behave?

**Resolution:** TABS-03 is authoritative: exact match first; otherwise fill the
active unreserved Empty tab; otherwise append. No populated tab is overwritten.

## Explicit non-blocking deferrals

### VRT-I05 — Direct host filesystem enforcement

Fusion can deny its own generic mutation routes and withhold privileged service
routes from harness sessions. Preventing an unsandboxed local process from
writing `System/Views` requires an OS/sandbox threat-model package. Product copy
must not call VIEW-01 tamper-proof.

### VRT-I06 — Validated GUI/direct JSON editor

This bundle makes protected configuration readable and establishes the schema,
but does not ship a configuration editor. A later editor must use one versioned,
revision-aware trusted service; it cannot reopen generic `file_save` as a bypass.

### VRT-I07 — Wiki, Tickets, Browser, and other tab adopters

The policy supports later adopters, but this bundle converts only Capture and
File Explorer. Each later view must supply its own presenter/target resolution,
state-owner adapter, resource behavior, and visual acceptance.

### VRT-I08 — Side Chat and Composable Chat

No Chat launcher is listed or registered. Side Chat consumes the accepted host,
placement, bridge, and reusable ChatSurface contracts later. Closing a future
tab must not imply thread deletion.

### VRT-I09 — Durable thread worksurface ownership

VIEW-02 preserves existing Capture/File tab persistence only. It does not create
`threadGroupId`, `threadId`, `surfaceId`, group-keyed worksurfaces, or Chat
storage. BRIDGE-02 and the Chat SPEC own those identities.

### VRT-I10 — Provenance events

Views and tabs remain context, not actor, authority, permission, or causal
proof. This bundle emits no new UEB fact. BRIDGE-01 later defines which accepted
placement actions/outcomes become durable events and supplies authoritative
actor/time/resource context.

### VRT-I11 — Plug-ins and dynamic views

`System/Views/plugins`, browse catalogs, SQLite plug-in payloads, dependencies,
side-loading, and template reduction remain out of scope. VIEW-02's closed
launcher registry is intentionally not a temporary plug-in system.

## Implementation-stop conditions

The orchestrator stops for owner direction rather than improvising if:

- source and destination view roots both contain data;
- immutable view IDs are missing, duplicated, or conflict with target identity;
- the cutover cannot use same-filesystem atomic rename;
- an accepted TABS-03 or trusted-shell contract has materially changed;
- a required production presenter cannot express its state through its current
  owner without introducing a second store or weakening acknowledged commit;
- a requested behavior would require dynamic executable registration; or
- a migration repair would require choosing, merging, overwriting, or deleting
  one of two plausible complete copies.

