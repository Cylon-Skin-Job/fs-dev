# SPEC — System View Capsule Control-Plane Foundation

**Status:** Ready after `COMPOSABLE_THREADED_CHAT_SPEC.md`
**Sequence:** After Composable Threaded Chat; before View-Configured Thread
Collections and any prompt/plugin work that consumes relocated capsules
**Depends on:** `COMPOSABLE_THREADED_CHAT_SPEC.md`
**Source:** Vision Roadmap decisions D-095 through D-098, D-124, and D-169
**Scope:** Canonical `System/Views` path ownership, lossless capsule relocation,
registry cutover, and the Fusion-owned mutation boundary

---

## 0. Executive Contract

This SPEC performs one control-plane migration and nothing else:

1. make `ai/<machine>/System/Views/` the only canonical runtime capsule root;
2. move complete existing capsules there without moving independently rooted
   content or changing immutable view identity;
3. route every Fusion view consumer/writer through one registry/path resolver;
4. serialize migration with every Fusion-owned view mutation; and
5. make generic Fusion file routes read-only for the protected capsule tree,
   while retaining narrow trusted services for registry, state, reorder,
   restore, scaffolding, and validated configuration writes.

Relocation is organizational and protects Fusion-owned routes. It does not make
the directory tamper-proof against an unsandboxed host process. That stronger
boundary requires a later threat-model/permissions SPEC.

---

## 1. Goals

1. Give all view code one rename-safe, machine-scoped capsule address.
2. Complete an idempotent, crash-resumable cutover with no permanent two-root
   compatibility mode.
3. Preserve every manifest, state file, style, local capsule file, unknown user
   file, numeric order prefix, and valid content-root declaration.
4. Prevent generic file save/create/rename/move/copy/delete/upload/extract routes
   from becoming a write bypass into the control plane.
5. Keep legitimate Fusion-owned writers functional through narrow services and
   the trusted-shell authority already established by Composable Chat.
6. Make failure visible and non-destructive at one workspace boundary rather
   than partially exposing old and new registries.

## 2. Non-Goals

- Workspace/view prompt composition or harness prompt injection.
- Thread collection definitions, assignments, filtering, Archive, or menus.
- New Chat, Side Chat, tab launchers, plugins, Provenance, or view templates.
- Changing `content.json` chat behavior or removing `rolling-daily`.
- Moving Wiki, Captures, Issues, Agents, or any other independently rooted
  product content.
- A GUI or raw generic-file bypass for editing protected configuration.
- Claiming protection from direct host filesystem tools, harnesses, or other
  unsandboxed processes.

---

## 3. Current Facts and Authority

- `workspace/ai-paths.js` currently resolves the capsule root beneath
  `ai/<machine>/Views/`.
- `fusion-studio-server/lib/views/index.js` discovers capsules and resolves
  manifests, content configuration, state, styles, icons, and content roots.
- View identity is `manifest.md` frontmatter `metadata.view-id`, never the
  mutable folder name or numeric prefix.
- Composable Chat makes the registry authoritative for ID-to-current-folder
  resolution, fills missing stable IDs, and establishes the per-launch
  trusted-shell connection role.
- The Persistence and Metadata standard requires a central coordinator when a
  file-backed state transition and a relocation can otherwise race.

The active code and tests must be surveyed again at implementation time. The
builder records every discovered capsule-path consumer and mutation family in
the handoff before changing either.

---

## 4. Canonical Path and Registry

After acceptance, the only canonical capsule root is:

```text
ai/<machine>/System/Views/
```

Add one canonical resolver in `workspace/ai-paths.js`. View discovery, manifest
loading, content-root resolution, state, styles, icons, CLI display overrides,
registry updates, reorder/rename, restore, workspace bootstrap, and default
scaffolding consume that resolver or the registry API built on it. No consumer
may concatenate `Views`, `System/Views`, a numeric prefix, or a folder suffix.

The registry maps `{canonicalWorkspaceRoot, machineIdentity, viewId}` to the
current capsule folder and a monotonically changing registry generation. It
rejects missing/duplicate IDs and never selects one duplicate heuristically.
Folder rename/reorder preserves the same view ID and all bound thread groups,
content roots, state, styles, and worksurfaces.

There is no permanent runtime fallback to the legacy root. The old path is read
only by the migration preflight/recovery routine. Successful cutover leaves an
empty legacy directory harmless and all normal reads/writes resolve only the
new root. The namespace `ai/<machine>/Views` remains permanently reserved after
cutover even when the directory does not exist; only the migration/repair
service may read, move, or remove an exact legacy capsule there. Ordinary
scaffolding and generic file operations can never recreate it.

---

## 5. Content-Root Independence

Moving a capsule never moves content rooted outside it. Preserve the existing
declaration and target for:

- machine-relative content such as `ai/${machine}/Wiki`;
- workspace-relative or Git-tracked content such as `Wiki/` or `docs/wiki`;
- workspace/project root;
- selected-folder, absolute, SQLite, and none declarations; and
- view-relative content.

View-relative content is physically part of the complete capsule and moves
with it, retaining the same relative relationship. The migration does not
rewrite a valid content-root declaration merely because the capsule address
changed.

---

## 6. Quiescent, Resumable Migration

### 6.1 Coordinator and readiness gate

One server-owned capsule-mutation coordinator is keyed by canonical workspace
root plus machine identity. Startup and later workspace attachment acquire its
exclusive migration lease before the view subsystem becomes ready. The same
coordinator serializes view-state/config writes, reorder/rename,
restore/scaffolding, and registry mutation.

Migration drains already accepted state writes, blocks new view mutations,
preflights, moves, rebuilds, verifies, publishes a new registry generation, and
only then releases queued operations to re-resolve their targets. No writer may
resolve a capsule path before acquiring the coordinator. Reads either observe
the last verified generation or a bounded `view_registry_unavailable` state;
they never observe a merged two-root registry.

### 6.2 Durable migration journal

SQLite stores a bounded migration journal outside either capsule root:

| Field | Contract |
|---|---|
| workspace/machine identity | Stable composite owner; unique with `view_id`. |
| `view_id` | Immutable capsule identity. |
| source/target folder names | Validated basenames only, never arbitrary client paths. |
| inventory digest | Digest of the preflighted capsule-relative entry list and metadata needed to detect collision/change; never file contents. |
| `status` | `planned`, `moved`, `verified`, or `failed`. |
| error/timestamps | Bounded redacted failure code plus created/updated/completed times. |

Preflight inventories both roots by view ID, validates every source and target,
detects duplicates/collisions for the whole workspace, and records all planned
rows before the first move. Move the complete directory with a same-filesystem
atomic rename. After each rename, record `moved`; then load it through the
canonical registry, verify identity/inventory/content-root resolution, and mark
`verified`. Only an all-verified workspace advances the published generation.

On restart, reconcile each journal row against both roots and immutable view
identity. A source-only planned row resumes the move. A target-only row still
marked `planned`—the crash point after atomic rename but before the status
write—must match the planned view ID, target basename, and inventory digest; it
then advances idempotently to `moved` and verification without moving again.
An exact target-only `moved` row verifies, and an already verified target is a
no-op. Both roots, wrong identity, changed inventory, ambiguous folder, or
target collision becomes `failed` and leaves view mutations unavailable. Never
merge, overwrite, delete the only complete copy, or guess which tree wins.

Bundled/default capsule material ships at the canonical destination. Existing
attached workspace copies go through the same migration on first observation.
Unknown files move as inventory members; generated/cache material is not
invented or rewritten.

---

## 7. Protected Fusion Mutation Boundary

Before moving a capsule, make the capsule pseudo-panel, canonical
`ai/<machine>/System/Views` tree, and retired `ai/<machine>/Views` namespace
read-only to every generic Fusion mutation family: save/create, rename, move,
copy, delete, upload/extract, traversal aliases, and link-resolved aliases. The
retired namespace check applies to the path and every descendant whether or not
the directory currently exists.

Authorization resolves the canonical target before checking protection:

- existing targets use realpath;
- non-existing targets resolve the nearest existing ancestor and validate each
  remaining path component, including the reserved legacy namespace;
- existing regular-file source/destination aliases also compare filesystem
  identity (`device`, `inode`) against the protected capsule inventory so a
  hard link outside the textual root cannot become a write/delete bypass;
- symlinks, `..`, alternate separators/encodings, pseudo-panel aliases, and
  source/destination operations cannot escape the containment decision; and
- a denied multi-path operation performs no partial filesystem change.

Legitimate migration, registry reorder/rename, automatic state persistence,
restore/scaffolding, and validated config editing use separate narrow services.
Any direct user config editor must arrive through the authenticated
trusted-shell connection, invoke the same versioned validator/write service as
a GUI, and use revision/conflict handling; it is not `file_save` with a special
flag. Request-supplied origin, privilege, or path assertions confer no access.
Harness children receive neither the trusted-shell credential nor a privileged
service route.

This boundary does not prevent direct writes by a host process that already has
OS permission. Product text and documentation must describe the actual
Fusion-route protection and must not call `System/Views` tamper-proof.

### 7.1 Correlated public mutations and convergence

Preserve the existing `workspace:view_*_requested` family rather than adding a
parallel socket namespace, but give every public registry mutation—including
add, update/reorder/rename, restore, and validated config writes—a bounded
client-generated `requestId` plus `expectedRegistryGeneration`. The server
derives workspace/machine authority from the authenticated connection and
rejects client paths, origin claims, stale generations, unknown fields, and
cross-workspace targets before filesystem work.

The coordinator owns a durable action row keyed by
`{workspaceId, machineIdentity, requestId}` with action, canonical target/payload
hash, expected generation, status (`planned`, `applied`, `verified`, `failed`),
and the terminal registry generation/result identifiers. It records `planned`
before the idempotent filesystem operation, uses request-derived temp/backup
names where needed, then verifies through the registry before recording the
terminal result and publishing the new generation. Restart reconciles a
nonterminal row against immutable view IDs and exact expected filesystem state;
it never blindly repeats add/move/restore. Same-ID/same-input retry returns the
stored or reconciled result; different-input reuse returns `request_mismatch`.

Requester success uses the existing `workspace:view_registry_updated` result,
enriched with its exact `requestId`, `workspaceId`, registry generation, and
authoritative registry snapshot. Rejection echoes `requestId`, action, bounded
error code, and current generation. After commit/verification the same
generation/snapshot and a stable event ID fan to every authenticated window
bound to that workspace; recipients do not settle unrelated local requests.
Individual requester/fan-out delivery failures are isolated, and reconnect
hydrates the current registry generation without replaying the mutation.
Renderer code never applies an optimistic reorder/add/restore as committed
state.

Read-only options/list requests require ordinary response correlation but no
durable action row. Existing revisioned view-state persistence keeps its
accepted `state:set` correlation/owner and only shares the coordinator; it does
not get reimplemented as a registry mutation.

---

## 8. Failure and Recovery

1. Preflight failure performs no move and publishes no new generation.
2. A mid-move crash resumes from the journal and immutable IDs.
3. A migration failure keeps the old complete copy and/or already moved complete
   copy intact, marks the workspace repair-required, and blocks view mutations.
4. Queued mutations never retain a pre-cutover path; they re-resolve only after
   the verified generation publishes.
5. Duplicate IDs, both-root copies, identity mismatch, and inventory drift are
   visible repair cases, never automatic merge/delete cases.
6. A protected-target denial is atomic and reveals no privileged write handle.
7. Restart after complete migration is a no-op and never recreates the old root.
8. A generic attempt to recreate or populate the retired root fails before any
   file change and cannot force the next startup into a false two-root repair.

---

## 9. Dependency-Ordered Vertical Slices

### Slice 1 — Consumer inventory and canonical resolver

- Record every current read/write/bootstrap/default capsule path consumer.
- Add the canonical `System/Views` resolver and registry generation contract.
- Route consumers through it without moving data yet; fail stale direct-path
  assertions in focused tests.

### Slice 2 — Protected mutation routes

- Put every generic file mutation family behind canonical/link-aware protected
  target resolution.
- Preserve narrow state/registry/config services through the trusted-shell and
  revision contracts.
- Add `requestId`/expected-generation validation, the durable view-action
  journal/recovery path, correlated completion/error, and authoritative
  workspace fan-out to existing public registry mutation messages.
- Prove traversal, symlink, pseudo-panel, non-existing destination, and
  source/destination alias cases fail atomically. Explicitly try create/move/
  copy/upload/extract into the absent and present retired `Views` namespace.
  Prove lost acknowledgement, crash, same-ID retry, payload mismatch, stale
  generation, and two-window convergence before relocation begins.

### Slice 3 — Journaled quiescent cutover

- Add the shared coordinator, readiness gate, journal, whole-workspace
  preflight, atomic directory moves, verification, and registry publication.
- Update bundled/default scaffolding to the canonical root.
- Inject a process stop at every journal phase and prove deterministic resume.

### Slice 4 — Restart and public-shell acceptance

- Reopen all built-in views through public shell navigation.
- Exercise state/config/reorder/restore requests concurrent with migration and
  prove they block/re-resolve rather than split the tree.
- Remove temporary migration-only compatibility helpers and run stale-path
  sweeps, full server tests, client build, and Electron acceptance.

Each slice crosses its public boundary and owning service, proves durable
readback where applicable, and records changed files, exact commands/results,
warnings, and residual risk before the next slice.

---

## 10. Verification Matrix

| Area | Required proof |
|---|---|
| Canonical resolution | Discovery, state, styles, icons, config, content roots, CLI display, reorder/rename, restore, bootstrap, and defaults have no direct legacy/new-root concatenation outside the resolver. |
| Migration modes | Old-only, already-migrated, planned, moved, verified, collision, duplicate-ID, identity-mismatch, and changed-inventory workspaces resolve deterministically. |
| Crash recovery | Stop after plan, after filesystem rename while the row is still `planned`, after `moved`, during registry rebuild, and during verification; restart validates the exact target/digest, preserves complete copies, resumes once without a second move, and publishes only an all-verified generation. |
| Quiescence | Concurrent state/config/reorder/rename/restore/scaffolding operations cannot recreate or split the legacy tree; accepted queued work re-resolves after verified cutover. |
| Content roots | External root types remain in place; view-relative fixtures move losslessly and resolve through unchanged declarations. |
| Protected routes | Generic save/create/rename/move/copy/delete/upload/extract cannot mutate the canonical tree or recreate/populate the retired `ai/<machine>/Views` namespace through direct, pseudo-panel, traversal, encoding, symlink, hardlink/link-resolution, or non-existing destination aliases; denied compound operations are atomic. Restart after each attempt remains single-root and healthy. |
| Narrow writers | Registry, state, restore, scaffold, and validated config services remain functional and revision-safe; raw/custom/harness/model/request-asserted authority cannot reach them. |
| Public mutation correlation | Add/update/reorder/rename/restore/config requests carry `requestId` and expected generation; same-ID retry is idempotent across process death, mismatched reuse/stale generation fails, success/error correlates to the requester, all workspace windows receive one authoritative generation, and reconnect hydrates without replay. |
| Identity | Rename/reorder/restart retains immutable ID, folder suffix semantics, bound thread groups, state, styles, and worksurfaces. |
| Honest boundary | Tests/handoff explicitly record that direct unsandboxed host filesystem writes remain out of scope and no tamper-proof claim ships. |
| Regression | Focused migration/security suites, full server `npm test`, client `npm run build`, restart/readback, and Electron public-shell walk pass with warnings classified. |

---

## 11. Definition of Done

1. All active capsules resolve only from `ai/<machine>/System/Views/` through one
   canonical registry/path owner.
2. Relocation is lossless, journaled, resumable, idempotent, and quiescent.
3. Independently rooted content remains in place; view-relative content moves
   inside the complete capsule without declaration rewrites.
4. No generic Fusion file mutation can write the protected capsule tree, while
   narrow authenticated services remain correlated, crash-idempotent, and
   convergent across windows.
5. Missing/duplicate/conflicting state fails visibly without guessing,
   overwriting, deleting the only copy, or exposing a mixed registry.
6. Restart never recreates or normally reads the legacy root.
7. The absent or empty retired namespace remains reserved against every generic
   Fusion create/move/copy/upload/extract path.
8. No prompt composition, collection behavior, thread UI, Side Chat, plugin, or
   OS-level permission work enters the implementation diff.
