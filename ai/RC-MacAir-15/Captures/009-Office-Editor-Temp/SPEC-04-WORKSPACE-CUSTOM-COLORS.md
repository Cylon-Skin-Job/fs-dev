# SPEC-04 — Workspace Palette Config Foundation

> **OWNER SUPERSESSION — 2026-07-21:** All watcher, cross-workspace coordination, hash/token plan, security-hardening ceremony, and dormant multi-workspace projection requirements below are retired wherever they conflict with `GUIDANCE.md` §4. The target is the simple global/local source selector: global `System_Manager/global-configs/office-custom-color-pallete/colors.json`, workspace-local `ai/<machine>/System/config/colors.json`, one read of the selected source on workspace open/switch, ordinary selected-file read/write behavior, and no watcher/fanout/retry/journal/reconciliation machinery. Complete necessary integration and report every deviation from this historical packet.

**Domain:** Global/local palette file foundation and selected-source client state
**Depends on:** Accepted SPEC-03

## Objective

Build the trusted server-read, workspace-owned `colors.json` foundation without cutting over the active picker. This packet owns the config codec/path/watch lifecycle and a dormant workspace-keyed client projection. SPEC-05 atomically replaces the browser-global/document-derived picker with the complete file-backed Add/Sync/Remove product, so accepting this packet never removes the existing Add capability or exposes a partial read-only palette.

## Canonical Config Contract

For the local machine identity of a registered workspace:

```text
<workspace>/ai/<local-machine>/System/config/colors.json
```

```json
{
  "custom_colors": [
    "#ff6b35",
    "#004e89"
  ],
  "sync_enabled": true
}
```

`storedColors` means every schema-valid array element normalized to lowercase six-digit `#rrggbb`, deduplicated by normalized value, and retained in first-seen order. `visibleColors` is exactly `storedColors.slice(0, 20)`.

- A genuinely missing file is the valid logical state `{ custom_colors: [], sync_enabled: true }`. A read creates no directory or file.
- A malformed, inaccessible, oversized, symlinked, non-regular, or schema-invalid existing path is not missing and never receives defaults.
- Every array element is validated. There is no 20-member storage/schema limit: entries 21+ are valid and retained subject to the byte ceiling.
- The raw UTF-8 file ceiling is exactly 16,384 bytes. Reject `16,385+` before JSON parse; exactly 16,384 is accepted only when the entire file is valid.
- Unknown keys, a BOM, a missing/non-boolean `sync_enabled`, or a non-array/invalid color make the file invalid. Reads never repair or overwrite it.
- Reads accept either property order and legal JSON whitespace. Merely reading never rewrites, normalizes, truncates, prunes, or canonicalizes bytes.
- SPEC-05 mutations use exact canonical bytes: `Buffer.from(JSON.stringify({ custom_colors: storedColors, sync_enabled: syncEnabled }, null, 2) + '\n', 'utf8')`, with property order as shown, UTF-8 without BOM, LF, two-space indentation, and one final LF.

## Cutover and No-Legacy-Migration Boundary

The new foundation never reads, imports, sends, copies, rewrites, or clears `rv-office-table-custom-colors`. Existing browser bytes remain outside the new service/store. This packet leaves the pre-existing active picker path unchanged until SPEC-05 can switch sources and mutation controls atomically; it must not add a second picker source, dual-write, or feed file-backed colors into the active UI.

SPEC-05 removes the old active localStorage path and all Document-color scraping in the same accepted slice that exposes complete file-backed Add/Sync/Remove. It does not migrate or clear legacy bytes. Existing `metadata.tableColors` remains authoritative for already-applied document fills and continues to render; it is never a file-palette source.

There is no migration WebSocket, batch-import fallback, or migration disposition.

## Read and Watch Protocol

Client → server:

```text
office:palette_get { requestId, workspaceId }
```

Server → client:

```text
office:palette_state {
  requestId?, workspaceId,
  customColors, syncEnabled,
  source, operation, availability
}
office:palette_error {
  requestId?, workspaceId?,
  operation, code, message, state?
}
```

`customColors` is the visible first-20 projection, never the complete stored array. The server retains the complete last-known-good array internally for SPEC-05. `source` is exactly `request | watch | registry | error`; `operation` is `get | watch_read | registry_read`. `availability` is `ready | degraded | unavailable`.

Every request uses a nonempty opaque `requestId` of at most 128 UTF-8 bytes. Its one direct state/error echoes the ID. Unsolicited watch/registry messages omit it. The client keys state by workspace ID and ignores late responses after a switch.

Stable errors are:

```text
INVALID_REQUEST
UNKNOWN_WORKSPACE
WORKSPACE_NOT_ACTIVE
PATH_REJECTED
SYMLINK_REJECTED
NOT_REGULAR_FILE
INVALID_SCHEMA
FILE_TOO_LARGE
READ_FAILED
STALE_WORKSPACE
```

Messages contain no host path, raw bytes, stack, or secret. A cold invalid/unreadable file yields one error with unavailable placeholder state `{ customColors: [], syncEnabled: true, source: 'error', availability: 'unavailable' }`; those values are not confirmed defaults and mutation/application remains disabled. After a prior valid read, an invalid edit retains its first-20 last-known-good projection with `degraded`. A later valid replacement recovers without restart.

## Trusted Path and Watch Safety

- Resolve roots only through `workspace/registry-service` and `workspace/ai-paths.getSystemConfigRoot`; clients never submit paths.
- Canonicalize every existing ancestor, prove containment, reject symlinks, and require an existing target to be regular.
- A validated read returns an immutable token containing raw-byte SHA-256 (or `missing`), registry ID/root generation, trusted ancestor/parent realpaths and device/inode identities, and target identity when present. SPEC-05 revalidates it before every write.
- Watch the containing directory or nearest existing trusted ancestor while absent. Rebind safely as directories/files appear; cover same-directory rename-based edits.
- Use `ignoreInitial`, stabilization/debounce, parsed-state equality for duplicate UI suppression, and complete cleanup/rebind on workspace registry/root changes. A read/watch never writes and cannot create a self-write loop.
- Never add a database, document versioning, provenance event, or provenance dependency.

## Dormant Client Projection Contract

The workspace-keyed client store retains only the confirmed first-20 `customColors` projection plus sync/availability/error state needed by SPEC-05. It is not connected to `officeColorPopover`, cannot apply a table fill, and renders no `+`, Sync, Remove, or read-only Custom UI in this packet.

The existing picker remains behaviorally and source-compatible during this foundation packet. SPEC-05 owns the one-step UI cutover to exact None/Google/file-backed Custom ordering and the complete mutation surface. Entries after 20 remain valid and untouched in the service's complete last-known-good state even though the dormant client projection contains only the first 20.

## Vertical Slices

### Slice 04.1 — Codec and trusted resolver

Implement pure validation/default/projection functions plus trusted path resolution and last-known-good reads. Cover normalization/dedup/order, valid 20/21/25-entry arrays, and the exact padded legal-JSON 16,383/16,384/16,385-byte construction in `GUIDANCE.md`; also cover malformed/unsafe paths, missing logical true, and redaction.

**Slice gate:** a missing read returns ready empty/true with zero mkdir/write; valid over-20 reads expose only the first 20 while preserving raw SHA-256; invalid paths/bytes produce the narrow error and zero writes.

### Slice 04.2 — Watch and WebSocket lifecycle

Add the exact get/state/error protocol and directory/ancestor watches. Reconnect/switch requests current state; stale responses cannot overwrite another workspace.

**Slice gate:** Jest/WS tests prove one broadcast per real valid change, cold unavailable, last-known-good degradation, live recovery, registry/root rebind, and cleanup without a write storm.

### Slice 04.3 — Client store and dormant projection

Add a workspace-keyed store/handler and exact first-20 projection without connecting it to the active picker or table-color application. Preserve the existing picker path until SPEC-05's atomic cutover, and prove the new store performs no legacy-key access or write.

**Slice gate:** store/handler tests expose deterministic 0/19/20/21/25 first-20 projections and never an entry after 20; active picker DOM and behavior remain at their pre-packet baseline; no file-backed swatch or partial `+`/Sync/Remove placeholder appears; a seeded legacy localStorage key remains byte-equivalent and is never accessed by the new path.

### Slice 04.4 — Switch/restart/external-read smoke

Use two isolated registered workspaces with distinct valid configs plus missing, malformed, and over-20 variants. Switch, reload, restart, atomically replace files, inspect raw hashes and harness-observable dormant store state, and verify the active picker has not cut over. After acceptance update only the Workspace Paradigm Wiki page named below with the verified config service/read foundation; do not document picker behavior before SPEC-05.

**Slice gate:** projections and availability survive switch/restart; reads perform zero writes; external valid replacement appears once; malformed/unsafe input remains untouched; live workspaces are never accessed.

## Expected Changed Areas

- new `fusion-studio-server/lib/office/palette-config-service.js`
- new `fusion-studio-server/lib/office/palette-config-watcher.js`
- new `fusion-studio-server/lib/ws/office-palette-handlers.js`
- `fusion-studio-server/lib/ws/client-message-router.js` and `fusion-studio-server/lib/startup.js`
- `fusion-studio-server/test/office/palette-config.test.js`, `palette-watcher.test.js`, and `test/ws/office-palette-handlers.test.js`
- new `fusion-studio-client/src/state/officePaletteStore.ts` and `src/lib/ws/office-palette-handlers.ts`
- `fusion-studio-client/src/lib/ws-client.ts`, `src/types/index.ts`
- `fusion-studio-client/e2e/office/fixture-scenarios.mjs`
- `fusion-studio-client/e2e/office-palette-persistence.spec.ts`
- `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/001-Workspace_Paradigm/PAGE.md`

**Authorized target-state documentation delta:** after runtime acceptance, document only the machine-scoped config path and dormant read/watch foundation. Do not replace current picker-source documentation or document SPEC-05 UI/mutations before that packet passes.

## Acceptance Criteria

- Path, schema, logical missing true, normalization, projection, and 16,384-byte behavior exactly match this packet.
- A valid 21+ config is ready, not over-limit, and read byte-equivalently.
- Reads never create, rewrite, truncate, or canonicalize any config.
- The new service/store never accesses legacy localStorage or Document colors, while the active picker remains unchanged until SPEC-05.
- Direct/broadcast request-ID, source, operation, availability, error, and redaction shapes are exact.
- Cold invalid data is unavailable, last-known-good degradation is honest, and valid replacement recovers.
- Client/path/registry isolation, watcher cleanup, and stale-response handling pass.
- No picker cutover, regression of the existing Add path, mutation UI/protocol, database, versioning, or provenance is introduced.

## Exact Validation

From `fusion-studio-server/`:

```bash
node --check lib/office/palette-config-service.js
node --check lib/office/palette-config-watcher.js
node --check lib/ws/office-palette-handlers.js
node --check lib/ws/client-message-router.js
node --check lib/startup.js
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/ws/office-palette-handlers.test.js
```

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/state/officePaletteStore.ts src/lib/ws/office-palette-handlers.ts src/lib/ws-client.ts src/types/index.ts e2e/office/fixture-scenarios.mjs e2e/office-palette-persistence.spec.ts
node --test e2e/office/fixture-lifecycle.test.mjs
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts e2e/office-table-color-integrity.spec.ts e2e/office-table-geometry.spec.ts e2e/office-palette-persistence.spec.ts --project=chromium --workers=1
```

## Manual Electron Smoke

From `fusion-studio-client/`, run these exact commands separately:

```bash
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=valid --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=malformed-cold --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=malformed-after-valid --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=over-20-read --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=file-too-large --workspaces=3 --copies=1 --relaunches=1
```

Pass requires exact dormant-store first-20 state through harness instrumentation, unchanged active-picker DOM/behavior, unchanged config/localStorage hashes, correct unavailable/recovery states, no partial file-backed controls, and no live-workspace access.

## Non-Goals

- Active-picker cutover, Add, Remove, Sync toggle, fanout, retry, or file mutation (SPEC-05).
- Changing existing document fill metadata/cascade.
- Cloud/account sync, database, versioning, or provenance.

## Worker Handoff

Follow `GUIDANCE.md`. Report raw before/after hashes proving zero-write read behavior, dormant projection matrices, unchanged active-picker evidence, watcher counts, redaction, and exact commands. Return `READY_FOR_ORCHESTRATOR_REVIEW` or — only for Tier-3 conditions under the run protocol's decision ladder — evidence-backed `BLOCKED`; bank Tier-2 questions via `NEEDS_RULING` in the report file and keep working.
