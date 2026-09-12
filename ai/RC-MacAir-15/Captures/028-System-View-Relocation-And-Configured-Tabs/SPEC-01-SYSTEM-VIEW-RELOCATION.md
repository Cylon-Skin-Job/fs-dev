# VIEW-01 — System View Capsule Relocation

**Status:** `CANDIDATE — NOT IMPLEMENTATION AUTHORITY`  
**Lane:** View Control Plane  
**Requires:** accepted trusted Fusion shell authority  
**Blocks:** VIEW-02

## 1. Objective

Make `ai/<machine>/System/Views/` the only canonical runtime location for view
capsules through a lossless, startup-gated, journaled whole-tree relocation.
Route every active Fusion reader and writer through one path owner, protect both
the canonical tree and retired namespace from generic Fusion mutations, and
preserve legitimate narrow view services.

## 2. Goals

1. Preserve every capsule byte, unknown entry, folder name, style, state file,
   and valid content-root relationship.
2. Use immutable manifest view IDs across folder rename/reorder and relocation.
3. Recover deterministically from process death before or after the atomic
   rename without merging, overwriting, or guessing.
4. Publish a workspace's view registry only after migration verification.
5. Prevent Fusion's generic file routes from bypassing the protected control
   plane while keeping reads and narrow server-owned writers functional.
6. Update new-workspace scaffolding and active documentation to the canonical
   layout, leaving no permanent old-root runtime fallback.

## 3. Non-goals

- Tab configuration or renderer adoption (VIEW-02).
- Prompt composition, Chat, collections, Side Chat, plug-ins, or dynamic views.
- A new `workspace:view_*` protocol, registry generation system, or durable
  journal for ordinary view actions.
- A raw JSON editor or other new System-management GUI.
- Moving independently declared content roots.
- Preventing direct writes by a host process with OS filesystem permission.

## 4. Canonical path and identity

`getMachineViewsRoot(projectRoot, machine)` resolves only:

```text
<projectRoot>/ai/<machine>/System/Views
```

A separately named migration-only helper resolves the retired root. No ordinary
consumer imports that helper. Direct string construction of either root outside
the path owner and migration/protection modules fails a focused source scan.

Every capsule must have a unique, bounded `metadata.view-id` in `manifest.md`.
Folder suffix and numeric prefix are display/order metadata only. Migration
preflight rejects missing/duplicate IDs rather than using the current folder
fallback. Ordinary post-cutover discovery likewise does not silently select a
duplicate or invent identity.

Canonical view IDs are already-canonical ASCII strings of 1–128 bytes matching
`^[a-z0-9]+(?:-[a-z0-9]+)*$`. No trimming, Unicode normalization, case folding,
or coercion occurs. One shared parser and byte-for-byte equality rule is used by
discovery, migration, registry/state/config resolution, registry mutation, and
template validation. Whitespace, non-string values, uppercase, underscore,
leading/trailing/consecutive hyphens, non-ASCII forms, and
normalized-equivalent Unicode forms fail rather than being rewritten.

The retired `ai/<machine>/Views` namespace stays reserved whether or not it
exists. Only the migration/repair service may inspect or move it.

### 4.1 Electron custom/local app resolution

`fusion-studio://<viewId>/app/index.html` remains the renderer-facing URL, but
Electron must retire its current unscoped `ai/views/<viewId>` construction. The
server's post-migration `panel_config` includes a bounded `viewCapsules` record
for the active workspace: canonical `workspaceId`, canonical machine identity,
and duplicate-free `{viewId, folderName}` entries produced by the verified view
registry. Folder names are validated basenames; neither they nor view IDs are
paths.

Only the current committed Fusion shell may forward that record through
authorized IPC. The payload contains no capsule root or file path. Electron
binds it to the already-established active workspace root, derives
`ai/<machine>/System/Views/<folderName>`, independently verifies realpath
containment and the manifest's canonical `view-id`, and atomically installs the
map. The renderer cannot supply a different root, capsule path, relative path,
or manifest identity. This does not broaden the existing active-workspace-root
authority.

Workspace change, renderer retirement, server generation change, malformed or
duplicate mapping, missing/mismatched manifest, or unavailable registry clears
the entire map before serving another request. Requests without a current exact
mapping return bounded unavailable. The protocol handler decodes once, rejects
invalid encoding/NUL/traversal/absolute paths, resolves realpath within the
mapped capsule, and never falls back to the retired or unscoped tree.

The canonical projection is produced by one server function used by both
`panel_config` and every successful existing
`workspace:view_registry_updated` result for add/update/reorder/rename/hide/
restore. The result carries no path authority, only the exact fresh
`viewCapsules` projection. It is fanned to current clients already bound to that
workspace under the existing registry-update family. The renderer validates and
forwards the fresh map through authorized IPC before it exposes the refreshed
panel registry as interactive. Electron atomically replaces the prior map;
failed mutations retain the prior verified map. No reconnect or workspace
switch is required.

## 5. Readiness and coordination

One server-owned coordinator is keyed by canonical workspace identity plus
machine identity. Initial startup and later workspace attachment must complete
or recover VIEW-01 before view discovery, `panel_config`, view registry
publication, view-state hydration, or public view mutations for that workspace.

Internal state/registry/config/scaffold writers acquire the same coordinator.
After readiness they resolve their path while holding the operation lease; they
do not cache a pre-cutover folder. Because no public view mutation is admitted
before readiness, VIEW-01 does not need to retrofit request IDs or generations
onto the existing view protocol.

A migration conflict leaves the workspace registered and readable at the
workspace-management level but exposes a bounded `view_registry_unavailable`
condition instead of an empty or merged view list. It does not publish the old
tree as a compatibility registry.

## 6. Durable tree migration

### 6.1 Journal

Add a SQLite migration for one row per `{workspaceId, machineIdentity}` with:

- validated source and destination root identities;
- source directory device/inode captured before rename;
- deterministic SHA-256 inventory digest;
- `status`: `planned`, `moved`, `verified`, or `failed`;
- bounded redacted error code;
- created, updated, and completed authoritative server timestamps.

The inventory digest covers each relative entry's normalized path, entry type,
mode, symlink target where present, and regular-file bytes. The journal stores
the digest, not file contents. Preflight evaluates every symlink both at its
source location and at the projected destination. A relative link is allowed
only when it resolves inside the capsule tree in both projections with the same
relative referent. Absolute links into the retiring tree, escaping/broken links,
traversal, unsupported special-file types, missing/duplicate view IDs,
destination collision, or different-device rename conditions fail before a
journaled move. The digest is a cutover/recovery invariant only while the row is
`planned` or `moved`; legitimate post-verification state/config/registry writes
are expected to change tree bytes.

### 6.2 State classification

Preflight classifies exactly:

- **old only:** validate and plan the move;
- **new only, no journal:** validate as an already-migrated workspace, create a
  verified adoption row, and do not move;
- **old and new:** repair required; never merge or choose;
- **neither:** valid only for a genuinely viewless new workspace according to
  existing product policy; otherwise bounded unavailable;
- **journaled nonterminal:** reconcile as described below.

### 6.3 Commit and recovery

For old-only:

1. create the destination parent but not the destination root;
2. record and durably commit `planned` with identity and digest;
3. atomically rename the complete old root to the canonical destination;
4. record `moved`;
5. load exclusively through the canonical registry, revalidate directory
   identity, digest, manifest IDs, and content-root resolution;
6. record `verified`; then publish readiness and the canonical registry.

On restart, source-only `planned` resumes. Destination-only `planned` is the
allowed crash point after rename; it advances only when device/inode, digest,
and identities exactly match. Destination-only `moved` verifies. `verified` is
an idempotent no-op after confirming the retired root is absent, the canonical
root retains the journaled directory device/inode, and its current manifests
have valid unique canonical IDs. It does not compare mutable bytes or the
original ID set to the historical cutover digest. For a nonterminal row, both
roots, neither root, wrong inode, digest drift, or identity mismatch becomes
`failed` without destructive repair. The only complete copy is never deleted.

Crash-injection tests stop after every durable step, including immediately after
rename and before the `moved` write.

## 7. Content-root preservation

`workspace-relative`, `machine-relative`, `project-root`, `absolute`, and
non-null `selected-folder` roots retain their declarations and resolved
destinations. `view-relative` roots move with the complete tree and resolve from
the new capsule root. Under the active resolver, null-path `selected-folder`,
`sqlite`, and `none` are capsule-root aliases; their resolved filesystem
placeholder follows the capsule to `System/Views`. They do not preserve the old
path and do not authorize file-backed content merely because a placeholder path
exists. Migration does not rewrite a valid `content.json` merely because the
capsule moved.

Preflight resolves every declaration against both the current and projected
layout. A declaration labeled external—`workspace-relative`,
`machine-relative`, non-null `selected-folder`, or `absolute`—that resolves
inside either the retired source tree or canonical control-plane tree is not an
independent external binding and fails as `relocation_dependent_content_root`
before the journaled move. The migrator does not rewrite it heuristically.
Fixtures cover each declaration type plus absolute and relative symlinks.

## 8. Protected Fusion mutation boundary

Before live relocation, one canonical protected-path policy must cover the
canonical tree and retired namespace across every generic mutation family.
Authorization resolves the real target before filesystem work:

- existing targets use realpath containment;
- non-existing destinations resolve the nearest existing ancestor and validate
  every remaining component;
- source-and-destination operations validate both before either mutates;
- symlink aliases, pseudo-panel aliases, traversal/encoding variants, alternate
  separators, and hard links to protected regular-file identities cannot bypass
  the decision;
- denied compound operations perform no partial change.

Read-only browsing remains allowed. Migration, registry reorder/rename,
scaffolding, and automatic view-state persistence use separate narrow services.
WebSocket entry to those services requires the accepted connection-owned
trusted-shell role; request-supplied flags, origins, paths, or actor claims grant
nothing. Harness child environments receive no shell proof or privileged route.

VIEW-01 does not ship direct JSON editing. Any future editor uses the same
versioned validator and revision-aware narrow service as its GUI, never a
generic save exception.

## 9. Dependency-ordered slices

### Slice 1 — Inventory, identity, and path owner

- Re-inventory all active consumers/mutators and tests.
- Add canonical and migration-only resolvers.
- Make discovery reject missing/duplicate immutable IDs in strict readiness.
- Add stale direct-path assertions without switching live resolution yet.
- Inventory the Electron `fusion-studio:` custom-app reader and define the
  canonical verified `viewCapsules` projection/authorized IPC boundary.

### Slice 2 — Protected generic routes and trusted narrow writers

- Centralize protected-path classification.
- Cover every enumerated mutation family and alias class atomically.
- Reuse accepted trusted-shell admission for WebSocket narrow writers.
- Prove ordinary reads, view state, registry operations, and scaffolding still
  work through their dedicated owners.

### Slice 3 — Journal, coordinator, and fixtures

- Add the SQLite journal migration and focused migration service.
- Gate startup/attachment publication on verified readiness.
- Prove all root classifications and every injected crash boundary on fixtures.

### Slice 4 — Canonical cutover and templates

- Route all ordinary consumers to canonical `System/Views`.
- Move the live development tree through the product migration service.
- Change new-workspace destinations and retained template paths as needed.
- Update active comments, help text, Wiki, and template documentation.
- Replace Electron's unscoped custom-app lookup with the verified canonical map;
  clear it across workspace/runtime-generation transitions and refresh it from
  each successful registry mutation.

### Slice 5 — Restart and public-shell acceptance

- Restart against old-only, new-only, recovered, conflict, and live workspaces.
- Open every built-in view, save view state, reorder/hide/restore/add a view, and
  verify restart readback from the canonical root.
- Load a custom `app/index.html` fixture through `fusion-studio://` before and
  after relocation, restart, and workspace switch; prove stale workspace maps,
  forged IDs/folders, symlinks, and traversal remain unavailable.
- Reorder and add the custom-app fixture through the public shell and load its
  next asset immediately without reconnecting; prove all bound clients receive
  and Electron installs the new basename mapping before refreshed interaction.
- After verification, save view state and exercise add/reorder/rename/hide/
  restore, restart after each, and prove the historical cutover digest does not
  reject legitimate canonical mutations.
- Run full server tests, client build, stale-path scan, and Electron smoke.

## 10. Verification matrix

| Contract | Required proof |
|---|---|
| Resolver | All active discovery, config, styles, state, CLI override, pseudo-panel, mutation, and scaffold paths use one canonical owner |
| Identity | Missing/duplicate IDs fail visibly; rename/reorder/relocation preserve ID |
| Losslessness | Before/after digest matches for the complete tree, including unknown entries and pre-existing dirty files |
| Recovery | Every nonterminal journal crash point resumes once; ambiguous roots/identity/digest never auto-repair; verified restart checks root identity/current manifests but permits legitimate mutable-byte drift |
| Content roots | True external roots stay fixed; view-relative and current capsule-root aliases move; relocation-dependent external declarations and absolute internal symlinks fail preflight without rewrite |
| Protection | All mutation families fail for canonical/retired direct, alias, traversal, symlink, hard-link, and non-existing destinations without partial writes |
| Narrow services | Trusted view state/registry/scaffold operations succeed; untrusted/custom/harness sockets fail before effects |
| Bootstrap | No `panel_config` or view registry exposes a partial/legacy tree; bounded conflict remains manageable |
| Custom app protocol | Server-verified ID/basename map resolves prefixed `System/Views` capsules; map atomically refreshes after registry mutations and clears on switch/restart; renderer paths, stale maps, identity mismatch, and traversal fail |
| Regression | Focused suites, server `npm test`, client `npm run build`, restart/readback, Electron public-shell walk |

## 11. Definition of done

VIEW-01 is complete only when the live and newly scaffolded workspaces resolve
capsules solely from `System/Views`, the whole-tree migration is journaled and
crash-resumable, generic Fusion writes cannot mutate either protected namespace,
narrow trusted writers work, content roots and dirty bytes are preserved, tests
and restart pass, and the implementation report states the honest OS-level
limitation. Owner acceptance is still required before VIEW-02 dispatch.
