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


---

## I-9 (2026-09-11): Relocation journal orphans when the workspace folder moves

**Symptom.** After the accepted candidate moved from the `9572` worktree back to
the primary checkout, the acceptance-profile app hung forever on
"Discovering panels..." (Connected; `panel_config` delivered with
`viewRegistryUnavailable`, `panelRoots` absent).

**Root cause.** `buildPanelConfig`/`buildWorkspaceInit` gate on view readiness;
readiness verifies the relocation journal
(`view_capsule_relocations`). `source/destination_root_identity_sha256` are
computed by `relocation-identity.rootIdentity(path, role)` — **path-derived** —
and `directory_inode` is the recorded physical directory identity. Moving the
workspace's backing checkout (or restoring/re-cloning it) changes both; journal
verification throws (`root_identity_mismatch` / `directory_identity_mismatch`)
and every view registry becomes unavailable. The journal cannot follow the
workspace it successfully relocated.

**Recovery applied (data fix, acceptance profile).** Recomputed with the
server's own modules (`rootIdentity`, `collectInventory`) against the new root
and updated the row: both identity hashes, `directory_inode`; inventory digest
recomputed (content changed legitimately post-cutover). Verified: panels load.
**Backlog (product fix):** readiness should detect a path-moved workspace
(content-identical tree at a new root) and re-derive journal identity instead
of failing closed. Recovery recipe: run the identity/inventory modules, UPDATE
the journal row, restart.

## I-10 (2026-09-11): Alpha update flow must run `npm install` in both packages

**Symptom.** After the post-acceptance Alpha pull/repack, the installed app
booted to a dead shell: the bundled server exited after two log lines (error
content sanitized by the log tee), no `server.port`, main process hung waiting.

**Root cause.** The Alpha source checkout's `fusion-studio-server/node_modules`
predated the pulled code: `ajv` (needed as `ajv/dist/2020` by
`lib/event-registry/schema-validator.js`) was absent from the packaged bundle.

**Fix applied.** `npm install` in `fusion-studio-server` (ajv 8.20.0),
re-pack, reinstall, relaunch. Healthy (port file written, request traffic
flowing).

**Rule.** The Alpha update flow is: pull → **`npm install` in
`fusion-studio-server` AND `fusion-studio-client`** → `electron:pack` →
install. The log tee (`lib/logging.js`) sanitizes all server console output to
bare labels; to diagnose a silent packaged-server death, run the bundled
`server.js` with a `NODE_OPTIONS --require` patch that traces `process.exit`
and raw-writes `err.stack` to fd 2 (console content is unrecoverable by
design).

## I-11 (2026-09-12): Disabled sibling adapters clobbered the connected runtime registration

**Symptom.** In the Alpha dogfood build, expanding any Capture preview failed
with the bounded-failure toast; no tab appended, zero WS frames (failure was
pre-persist, client-side). Dev masked it.

**Root cause.** Every mounted panel calls `useViewTabAdapter(panelId)`, so the
capture/file connected adapters mount once per panel — mostly with
`enabled: false`. Their registration effects ran the
`setActive…ConnectedRuntime(null, null)` branch on mount, and the module-level
registration slot is a singleton: last writer wins. Panel mount order decided
ownership — Alpha mounted capture-viewer first, so a later disabled sibling
cleared the capture runtime registration and every external open entry point
gated off (`isCaptureConnectedActive()` false: `rt=NULL ws=null store=fs-dev`).

**Fix (4b83927).** Disabled sibling instances no longer touch the registration
slot; only the enabled instance registers, and its own cleanup clears it.
Applied symmetrically to `captureViewTabAdapter.ts` and
`fileConnectedAdapter.ts`. Verified: expand appends in both checkouts; tab
adoption specs green.

**Diagnostic note.** The bounded-failure toast text is uniform across four
distinct failure sites, and both the server log tee and the renderer console
pipe redact content. The decisive technique: patch the installed renderer
bundle's toast call sites with discriminating messages (plain-file
`dist/assets/index-*.js` under the .app's Resources — no asar needed), hard
reload, and reproduce over CDP. Revert by reinstalling from a clean pack.
