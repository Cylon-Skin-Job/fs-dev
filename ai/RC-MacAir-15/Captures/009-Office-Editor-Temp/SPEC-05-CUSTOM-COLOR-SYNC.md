# SPEC-05 — Custom Palette Coordination and Interaction

> **OWNER SUPERSESSION — 2026-07-21:** `sync_enabled` is now a source selector, not synchronization. All merge, fanout, convergence, registry participation, continuous watching, retry, removal-journal, durability-debt, identity-token, and background recovery requirements below are retired. Follow `GUIDANCE.md` §4: true uses and mutates only the System Manager global palette, false uses and mutates only the workspace-local palette, toggling preserves both arrays, drift does not matter, and workspace open/switch reads the selected source once. Finish the picker cutover, remove obsolete machinery, and report every deviation from this historical packet.

**Domain:** Picker cutover, global/local source selection, and selected-source Add/Remove
**Depends on:** Accepted SPEC-04

## Objective

Atomically cut the active picker over from its legacy browser/document sources to the complete workspace-file product: first-add seeding, always-visible Sync state, deterministic full-array convergence, reversible per-workspace forks, a 20-slot Add surface, and right-click Remove with crash-safe global deletion. The server is the sole coordinator; the client never sends paths or a merged palette, and no accepted state exposes a read-only file palette or loses the existing Add capability.

## Stored, Visible, and Addable Colors

Reuse SPEC-04 `storedColors` for the complete normalized/deduplicated array and `visibleColors = storedColors.slice(0, 20)`.

- Sync always merges and fans out complete arrays, including entries 21+.
- The Custom grid is exactly ten columns by at most two visible rows.
- Render `+` in the next slot only when the complete stored count is `0..19`. At 20 or more, do not render it; disabled/hidden-in-place does not pass.
- A distinct direct add is accepted only when the current complete authoritative array has fewer than 20 entries. An existing color is an idempotent success. A defensive/raced distinct add at 20+ returns `PALETTE_LIMIT` with zero write/broadcast.
- An externally authored or synchronized 21+ array remains valid. Removing an earlier visible color promotes the next latent entry; `+` returns only when the complete count reaches 19.
- The 16,384-byte canonical-file ceiling remains the sole storage/sync-union bound. Never truncate a union to 20.

## Missing, First Mutation, and Registry Lifecycle

A missing config is logical empty/true and participates without an eager write.

- An idempotent intent that changes nothing does not materialize a missing file.
- Disabling Sync while missing creates canonical `{ custom_colors: [], sync_enabled: false }`.
- Adding the first color in a logical/actual true workspace snapshots deterministic registry order, reads every registered config, treats every missing config as true, preserves/excludes every valid false config, computes the complete true-participant union plus the new color, then fans canonical true bytes to every logical/actual true destination.
- If the synchronized union is empty, missing participants may remain absent. Once nonempty, every missing true participant is materialized.
- A newly registered missing workspace automatically joins: it stays absent if the confirmed union is empty, otherwise it receives the complete union. A valid true config joins/contributes; a valid false config remains byte-untouched and forked.
- Any existing invalid/inaccessible registered config blocks a plan before fanout; missing alone never does.
- A missing `System/config` parent is materialized only in the write phase by the exact trusted component-by-component `0700` mkdir/lstat/realpath/device/inode/fsync protocol in `GUIDANCE.md`. Directory-only partial writes are reported degraded and retried; they never count as a materialized config or successful convergence. A restart safely treats the resulting empty trusted directory as an existing ancestor and replans from actual config bytes/missing state.

Example: A/B/C missing and D valid false; A adds `#123456`. A/B/C become identical canonical true configs containing that color; D's raw bytes do not change.

## Enable, Disable, and Ongoing Convergence

### Enable (`false → true`)

Read/validate the enabling config and all logical/actual true participants, form the complete deterministic union in registry/config first-seen order, enforce only the byte ceiling, then fan identical canonical true bytes. Do not persist the enabling flag before preflight passes. A full success joins it; a partial write reports degraded under the failure contract.

### Disable (`true → false`)

Atomically persist false for only that workspace and retain its complete acknowledged palette. It stops contributing/receiving subsequent changes. The remaining true set reconciles independently.

### Ongoing changes

- A UI add in true performs coordinated full-union fanout; in false it changes only that file.
- Valid external true-file additions/deletions use stateless union behavior. An external deletion can be restored while another contributor retains the color because it is not a UI Remove intent.
- Valid external flag transitions use the same enable/disable semantics. Invalid data is never coerced.
- All healthy true participants converge to byte-identical canonical complete arrays. False configs are neither contributors nor destinations.

## Right-Click Remove Contract

Left click still applies a swatch. Right-clicking only a visible Custom swatch opens one context-anchored action labelled exactly `Remove` near the pointer. Google, None, and `+` have no Remove menu. Escape/outside click dismisses as a no-op. There is no confirmation, submenu, delete-file, or clear-palette action.

- In a false workspace, Remove atomically deletes that normalized value from its complete local array. An absent value is an idempotent zero-write success.
- In a true workspace, Remove is global across every currently registered true participant. It never changes false configs or existing document fills.
- The server operates on complete arrays even though the initiating swatch is within the first 20.
- On error, keep the last-confirmed swatch projection and show nonfatal feedback. Editor Undo never changes config state.

## Crash-Safe Global Removal

Before the first config write for a global Remove, atomically persist this minimal journal at `<dirname of DB_PATH>/office-palette-removal-journal.json`:

```json
{
  "pending_global_removals": [
    "#123456"
  ]
}
```

Canonicalize/deduplicate the pending color set. Write by same-directory exclusive temp, fsync, rename, and parent fsync. The journal contains no actor, timestamp, document, prior palette, completed event, version, or provenance field. After verified convergence it is durably cleared to the same schema with an empty pending array before optional unlink cleanup; it is operational crash recovery—not history.

While an intent is pending, every plan subtracts its colors from each complete contribution and target before computing the union. This includes a participant registered or externally edited during recovery. A destination is durable only after its temp file and rename have completed, its destination parent directory has been fsynced, and post-rename bytes/identities verify. Clear an intent only at the registry barrier linearization point defined below, after every participant in that locked snapshot is durably verified byte-equivalent without the color. Clearance atomically replaces the journal with canonical `{ "pending_global_removals": [] }` bytes by temp fsync, rename, parent fsync, and reread verification; failure before that durability point retains the nonempty journal and degraded state. Only after durable empty verification may cleanup unlink the empty journal and fsync its parent. Unlink failure leaves the durable empty file; unlink success followed by parent-fsync failure has crash outcome either durable empty or durable absence, both semantically cleared. Cleanup failure reports degraded `REMOVAL_JOURNAL_CLEANUP_FAILED` and retries cleanup, but never reconstructs a pending intent or blocks the already-safe removal result.

`workspace/registry-service` must expose an Office-owned async read barrier shared with register, unregister, root replacement, and root-generation mutation. The palette coordinator never holds it during ordinary fanout. For final clearance it acquires the barrier inside the serialized coordinator, snapshots ordered IDs/roots/generation again, and compares that snapshot to the one just converged. If changed, release without clearing, process the new/current participants under the still-pending subtraction, and retry. If equal, reread/verify every currently true participant while the barrier prevents membership/root changes, durably commit and verify the empty journal, then release. The empty-journal parent-fsync completion is the removal's membership linearization point. A registry mutation waiting behind the barrier is a later contribution and reconciles after release under normal semantics. Do not call registry callbacks while holding the barrier; queued events run after release.

- A crash before journal durability permits zero config writes.
- A crash/partial failure after durability resumes subtraction before ordinary union, so a stale copy cannot resurrect the color.
- Invalid/unreadable journal state fails closed with zero config writes and degraded status.
- A valid empty journal on startup is semantically cleared: subtract nothing, attempt only the bounded empty-file cleanup above, and never recreate a removal intent.
- After the journal clears, a later explicit external addition may introduce the color normally.

Stable journal errors are `REMOVAL_JOURNAL_INVALID | REMOVAL_JOURNAL_READ_FAILED | REMOVAL_JOURNAL_WRITE_FAILED | REMOVAL_JOURNAL_CLEANUP_FAILED`.

## Wire and UI State Contract

Client → server:

```text
office:palette_add { requestId, workspaceId, color }
office:palette_remove { requestId, workspaceId, color }
office:palette_set_sync { requestId, workspaceId, enabled }
```

Reuse SPEC-04 state/error. Add `source: mutation | sync`, operations `add | remove | set_sync | reconcile | retry | registry_reconcile | watch_reconcile`, errors `PALETTE_LIMIT | READ_ONLY | DIRECTORY_CREATE_FAILED | WRITE_FAILED | CONCURRENT_MODIFICATION | SYNC_PARTIAL | SYNC_CONTRIBUTOR_UNAVAILABLE | SYNC_RECONCILE_FAILED` plus journal errors, and `syncStatus: ok | reconciling | degraded` on every state.

SPEC-05 extends only the top-level error envelope:

```text
office:palette_error {
  requestId?, workspaceId?, operation, code, message, state?,
  failedWorkspaceIds?
}
```

`failedWorkspaceIds` is required and nonempty exactly for `SYNC_PARTIAL` and `SYNC_CONTRIBUTOR_UNAVAILABLE`; otherwise it is absent. It contains unique registered workspace IDs in registry order and never paths. It is never nested inside `state` and never appears on `office:palette_state`. A direct partial/contributor failure sends the requester one correlated error with the field, then sends every other affected connection one request-ID-free copy of that error followed by its request-ID-free degraded state. Watch/startup/registry failures have no requester and broadcast that request-ID-free error followed by degraded states. This ordering is part of the wire contract.

The Custom section always shows exactly:

```text
sync / sync_disabled   Sync Enabled / Sync Disabled
```

even with zero swatches. A click sends intent and shows pending/reconciling without claiming unacknowledged state.

For a direct intent: preflight emits nothing; a no-write rejection sends one correlated error and no broadcast; after preflight, broadcast request-ID-free `reconciling` states in registry/connection order; fan out; then send the requester one correlated final state or error. On success, every other affected connection receives final `ok`; on failure, use the exact request-ID-free error-then-`degraded` ordering above. Prospective values never masquerade as confirmed.

An idempotent intent is a successful no-op only when its complete postcondition is already confirmed: local false Add/Remove checks that one file; true Add requires the color already present in every currently registered valid true participant, while true Remove requires it absent from all of them and from the pending-removal journal. Any divergence still reconciles normally. A confirmed idempotent intent performs zero config/journal writes, timers, `reconciling` states, and broadcasts to other connections; it sends the requester exactly one correlated `office:palette_state` containing the current confirmed projection with `source:'mutation'`, the requested `operation:'add'|'remove'|'set_sync'`, current availability, and `syncStatus:'ok'`. It sends no error. Idempotent `set_sync` follows the same response only when the flag and complete participation postcondition already hold.

## Reconciliation, Concurrency, and Failure

- One global coordinator serializes API intents, watcher events, registry changes, journal recovery, retries, and shutdown.
- Read/validate every candidate and carry SPEC-04 raw-byte/root/ancestor commit tokens. Collectively revalidate before the first write and per destination before rename; stale plans reread/replan and never compensate from old bytes.
- Preflight read/schema/path/byte-limit failure performs zero writes. An already external oversized/invalid file remains untouched and degrades the set.
- Cross-file atomicity is not claimed. A mid-fanout failure preserves successful writes, returns `SYNC_PARTIAL` with unique registry-ordered `failedWorkspaceIds`, retains any pending removal journal, and marks affected true clients degraded.
- Reuse the per-file writer defined by `GUIDANCE.md`: temp fsync, rename, destination-parent fsync, then post-rename verification. Skip only exact canonical raw-byte equality. No global removal may clear its journal until every changed destination has passed that full durability sequence.
- Retry one unchanged failure episode at exactly 250 ms, 1,000 ms, and 4,000 ms, then remain degraded. One timer/operation exists. A real user intent, valid external-byte/flag change, or registry change resets the episode; equality/self-write events do not. Success and shutdown cancel/reset.
- A complete union above 16,384 canonical bytes returns `FILE_TOO_LARGE`, performs zero additional fanout writes, and is never truncated.

## Vertical Slices

### Slice 05.1 — Pure participation/mutation model

Implement and table-test missing-true participation, valid-false exclusion, full-array deterministic union, first-add bootstrap, enable/disable, visible projection, direct-add boundary, and local/global remove planning.

**Slice gate:** same inputs produce byte-identical plans; 21+ arrays remain complete; only distinct direct add at 20+ returns `PALETTE_LIMIT`; complete-union byte overflow returns `FILE_TOO_LARGE`; no input mutates.

### Slice 05.2 — Coordinator, atomic fanout, and removal journal

Implement the serialized coordinator, commit-token fanout, journal-before-remove rule, partial state, bounded retry, restart recovery, and shutdown cleanup.

**Slice gate:** injected preflight/mid-fanout/post-rename/crash/journal failures prove exact zero-write or partial behavior. Missing-parent cases cover component creation, raced `EEXIST`, symlink/ancestor/root swap, mkdir/directory-fsync failure, identity-guarded reverse cleanup, and restart from a safe empty partial directory. Journal cases cover nonempty recovery, durable-empty replacement failure, empty-file unlink failure, unlink-success/parent-fsync failure, and restart from either empty or absent state. Registry-race cases pause immediately before clearance, register/unregister/root-swap behind the barrier, prove pre-barrier mutations force reconvergence while blocked mutations linearize afterward, and crash on both sides of the empty-journal fsync; no branch resurrects a removed color from a participant that existed at the linearization point.

### Slice 05.3 — Mutation protocol and atomic complete-picker cutover

Add exact messages and, in the same slice, switch picker composition from the old active localStorage/Document-derived sources to None, Google, and the dormant SPEC-04 file-backed store. Remove the old active read/write/scrape path without reading, migrating, or clearing legacy bytes; expose the always-visible Sync row, `+` placement, add flow, and right-click one-action Remove only when their server mutations are live. On acknowledged Add, apply the new swatch to the captured table through one SPEC-02 metadata Step; on failure/stale target do not fill. Remove never changes existing fills.

**Slice gate:** the cutover is one accepted vertical slice with no intermediate partial picker; pointer/keyboard tests cover exact None/Google/file-backed Custom ordering, inert byte-preserved legacy localStorage, absent Document scraping, 0/19/20/21/25 counts, direct-race rejection, latent promotion, `+` return at 19, Sync-before-color, one nearby Remove action, dismissal/no-op, the exact correlated-only idempotent response for local/fully converged true cases, divergent-true reconciliation, and document/config Undo separation.

### Slice 05.4 — Three-workspace/restart/failure smoke

Use A/B/C plus the exact `GUIDANCE.md` variants for all-missing first add, valid-false fork, later registration, over-20 external arrays, file ceiling, contributor/destination failure, and partial Remove/restart. After acceptance update only the Tables and Workspace Paradigm Wiki pages with the complete verified behavior.

**Slice gate:** true participants converge byte-identically with all latent entries; false participants retain exact hashes; missing autojoin works; partial removal is non-resurrecting; wire/status/retry counts and cleanup are exact.

## Expected Changed Areas

- SPEC-04 palette service/watcher/WS/store files
- new `fusion-studio-server/lib/office/palette-sync-coordinator.js`
- new `fusion-studio-server/lib/office/palette-removal-journal.js`
- `fusion-studio-server/lib/startup.js`, WS router/handlers, and DB-path import for journal location
- `fusion-studio-server/lib/workspace/registry-service.js` for the bounded shared mutation/read barrier
- `fusion-studio-server/test/office/palette-sync.test.js`, `palette-removal-journal.test.js`, and WS/config/watcher tests
- `fusion-studio-client/src/state/officePaletteStore.ts`, WS handlers/types/client
- `fusion-studio-client/src/components/office/officeColorPopover.ts`, `OfficeDocumentPage.css`, `OfficeDocumentPage.tsx`, and `useCrepeEditor.ts`
- `fusion-studio-client/e2e/office/fixture-scenarios.mjs`
- `fusion-studio-client/e2e/office-palette-sync.spec.ts`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`
- `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/001-Workspace_Paradigm/PAGE.md`

## Acceptance Criteria

- Missing/default/first mutation, seed-all, valid-false preservation, and later autojoin match this packet.
- Healthy true configs converge to identical complete arrays/bytes, including entries 21+; UI renders only first 20.
- `+` is absent at complete count 20+ and returns at 19; distinct direct add at 20+ is a zero-write error.
- Sync row is always visible and an empty disable persists false.
- Right-click exposes exactly one Remove action only for Custom swatches.
- Picker cutover removes active legacy localStorage/Document scraping without reading, migrating, or clearing legacy bytes, and it lands atomically with working file-backed Add/Sync/Remove.
- False Remove is local; true Remove is global, leaves document fills/false configs unchanged, and cannot resurrect after partial failure/restart.
- Journal durability/validation/cleanup, commit-token races, ordered messages/errors, partial failure, retry, and shutdown are exact.
- Journal clearance holds the registry barrier through the durable-empty linearization point; pre-barrier membership/root changes are included and post-barrier changes are later contributions.
- Missing config parents materialize only through the trusted component/fsync protocol; directory-only partial results are degraded, safely restartable, and never acknowledged as config convergence.
- External non-intent deletions remain stateless union; later explicit additions after journal clearance are allowed.
- No migration, delete-file/clear-palette UI, cloud/account/database/versioning/provenance work is introduced.

## Exact Validation

From `fusion-studio-server/`:

```bash
node --check lib/office/palette-config-service.js
node --check lib/office/palette-config-watcher.js
node --check lib/office/palette-sync-coordinator.js
node --check lib/office/palette-removal-journal.js
node --check lib/ws/office-palette-handlers.js
node --check lib/ws/client-message-router.js
node --check lib/startup.js
node --check lib/workspace/registry-service.js
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js
```

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/components/office/officeColorPopover.ts src/components/office/OfficeDocumentPage.tsx src/components/office/useCrepeEditor.ts src/state/officePaletteStore.ts src/lib/ws/office-palette-handlers.ts src/lib/ws-client.ts src/types/index.ts e2e/office/fixture-scenarios.mjs e2e/office-palette-sync.spec.ts
node --test e2e/office/fixture-lifecycle.test.mjs
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts e2e/office-table-color-integrity.spec.ts e2e/office-table-geometry.spec.ts e2e/office-palette-persistence.spec.ts e2e/office-palette-sync.spec.ts --project=chromium --workers=1
```

## Manual Electron Smoke

From `fusion-studio-client/`, run these exact commands separately:

```bash
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=valid --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=read-only --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=all-missing-first-add --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=over-20-external --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=file-too-large --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=contributor-read-failure --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=destination-write-failure --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=remove-partial --workspaces=3 --copies=1 --relaunches=2
```

Pass requires complete-array disk hashes, first-20 UI projection, exact `+`/Sync/Remove behavior, deterministic wire evidence, bounded writes/retries, journal lifecycle, and no live-workspace access. Only `remove-partial` uses two relaunches, and its second launch must recover the durable pending removal before ordinary union.

## Non-Goals

- Cloud/account sync, unregistered filesystem roots, a general config synchronizer.
- Delete-file, clear-palette, confirmation, completed deletion history, or document Undo integration for config state.
- Database, versioning, or provenance.

## Worker Handoff

Follow `GUIDANCE.md`. Report every config/journal before-after hash, complete versus visible arrays, wire ordering, retries, partial/restart evidence, UI count matrix, and exact commands. Return `READY_FOR_ORCHESTRATOR_REVIEW` or — only for Tier-3 conditions under the run protocol's decision ladder — evidence-backed `BLOCKED`; bank Tier-2 questions via `NEEDS_RULING` in the report file and keep working.
