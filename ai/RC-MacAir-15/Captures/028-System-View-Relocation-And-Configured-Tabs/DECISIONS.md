# Decisions

## VRT-001 — Use two dependency-ordered SPECs

Relocation and configured-tab adoption are one release gate but two
implementation judgments. VIEW-01 owns server/filesystem/security migration.
VIEW-02 owns config validation, connected renderer adapters, and visual behavior.

## VRT-002 — Canonical view root is `System/Views`

After VIEW-01, the only runtime capsule root is
`ai/<machine>/System/Views/`. The retired `ai/<machine>/Views/` name remains
reserved and is not a compatibility fallback.

## VRT-003 — Folder names are presentation; manifest IDs are identity

`metadata.view-id` in `manifest.md` is the immutable view identity. Numeric
prefixes and folder names may change without changing identity, state ownership,
content roots, tab state, or later thread bindings. Missing or duplicate IDs are
a repair condition during migration; the migrator does not silently mint or
choose an identity.

Canonical view IDs are already-canonical ASCII strings of 1–128 bytes matching
`^[a-z0-9]+(?:-[a-z0-9]+)*$`. No trimming, Unicode normalization, case folding,
or coercion occurs. One shared parser and byte-for-byte equality rule is used by
every view reader, writer, migrator, and template validator. Invalid values are
repair conditions rather than values the system silently rewrites.

## VRT-004 — Move the complete tree atomically

The migration moves the complete `Views` directory with one same-filesystem
atomic rename after a full preflight. It does not copy selected known files or
move capsules one at a time. This preserves unknown files and makes the recovery
state old-only, new-only, both, or neither.

## VRT-005 — Journal the tree cutover, not ordinary view actions

SQLite stores one migration row per workspace identity and machine identity.
The existing `workspace:view_*` protocol remains the public mutation family;
VIEW-01 does not add registry generations, durable action rows, or a parallel
command namespace. Migration completes before the workspace's view registry is
published, so public view mutations never race an exposed half-cutover tree.

## VRT-006 — Protect Fusion routes honestly

The canonical and retired trees are read-only through generic Fusion file
mutation routes. Narrow server-owned view state, registry, scaffold, migration,
and future validated-config services remain legal and require accepted trusted
shell authority when entered through WebSocket. This does not claim protection
against an unsandboxed process with host filesystem permission.

## VRT-007 — Keep content roots independent

Relocation moves the capsule, not separately declared Wiki, Captures, Issues,
Agents, project-root, absolute, or other external content. `view-relative`
content moves with the capsule and retains its relative meaning. Valid root
declarations are not rewritten. The active resolver's null-path
`selected-folder`, `sqlite`, and `none` values use the capsule root as a
filesystem placeholder; that placeholder follows relocation and is not an
external content destination.

## VRT-007A — Give Electron the verified capsule registry

Custom/local HTML views continue to use `fusion-studio://<viewId>/...`, but
Electron no longer constructs unscoped `ai/views/<viewId>` paths. After server
readiness, the existing `panel_config` carries canonical view-ID/folder-basename
entries. The trusted renderer may forward only that bounded correlation map
through authorized IPC; it supplies no capsule or file paths. Electron derives
the target beneath the already-established active workspace root and machine's
`System/Views`, independently verifies containment and matching canonical
manifest ID, and atomically replaces/clears the map across workspace changes.
Every successful add/reorder/rename/hide/restore operation publishes the same
fresh server-derived map through its existing registry result before refreshed
views become interactive, so folder-basename changes cannot leave Electron on a
stale capsule path.

## VRT-008 — Extend `content.json`; do not create a second view config

VIEW-02 adds an optional, strictly validated `tabs` object to the existing
version-1 `content.json`. Views without `tabs` remain on their existing renderer
path. An invalid present `tabs` object fails that view's tab adapter closed with
a bounded unavailable surface; it never silently changes behavior.

## VRT-009 — Config selects choices; code owns capabilities

Configuration may name code-owned choice IDs and presentation policy. It may
not name an import path, executable module, arbitrary component type, presenter,
permission, or filesystem target. Unknown choice IDs are rejected. Dynamic
registration belongs to the later Provenance-backed plug-in control plane.

## VRT-010 — Define the version-1 tab policy exactly

The optional `tabs` object has this exact logical contract:

```json
{
  "schemaVersion": 1,
  "initial": { "kind": "launcher", "launcherId": "capture.home" },
  "plus": { "enabled": true },
  "empty": {
    "tabLabel": "New Capture Tab",
    "locationLabel": "New Capture Tab",
    "launcherIds": ["capture.home"]
  },
  "location": {
    "omitTerminalNames": ["PAGE.md"],
    "historyControls": "presenter"
  }
}
```

`initial.kind` is `launcher` or `empty`; `launcherId` is required only for
`launcher`. `plus.enabled` controls whether the shell offers plus; in version 1
plus always creates and activates one Empty tab and performs no domain creation.
Empty tab identity uses the view's existing icon plus the configured tab and
location labels. `launcherIds` is ordered and duplicate-free. Location omission
is display-only and applies only to exact terminal segment names.
`historyControls: "presenter"` renders controls only when the active presenter
supplies a valid tab-correlated navigation capability; `"none"` suppresses them.

## VRT-011 — Initial launcher uses the same reservation contract

An initial launcher is not a privileged shortcut. The connected owner creates
one Empty tab, then runs the accepted Empty reservation/commit/failure lifecycle
for the configured launcher. A failed initial launch leaves a retryable Empty
tab. Rendering never calls a launcher directly.

## VRT-011A — Keep picker choices correlated to their destination

The code-owned catalog declares each choice as `component` or `picker`.
Component choices use the accepted descriptor commit. A picker such as
`file.open` keeps its reservation pending while the shell selector is open. The
reservation's tab ID and expected revision identify the destination even if the
user focuses another tab. Selection enters one connected-owner serial lane,
atomically releases and activates that exact still-Empty destination, then calls
TABS-03 `current` before another tab intent can interleave. This preserves the
accepted waiting-tab behavior without adding a target-tab field to TABS-03.

## VRT-012 — Use one placement controller for every resource open

Capture preview/open and File Explorer selection call the accepted TABS-03
controller. Exact `{presenterId, targetKey}` match activates and reveals;
otherwise `current` fills the active unreserved Empty tab and appends when it is
not available. `new` activates an exact match first or appends. Production
adapters do not reimplement matching, fill, append, or reveal rules.

## VRT-013 — Preserve each view's existing state owner

Capture remains owned by the view-state slice and its acknowledged `state:set`
path. File Explorer remains owned by its existing Zustand file presentation
store and existing view-activity persistence. Connected adapters translate
those stores to the generic snapshot and perform one atomic acknowledged owner
commit. No second generic tab store or duplicate durable schema is introduced.

## VRT-014 — First adopters are Capture and File Explorer

Capture starts from `capture.home`; its plus-created Empty tabs offer
`Capture Home`. File Explorer starts Empty; its Empty tabs offer `Open File`,
which opens/reveals the existing file-tree drawer and waits for a file choice.
Side Chat is deliberately absent until the Chat component exists. Wiki's
`PAGE.md` omission and presenter navigation policy are schema-tested but Wiki
production adoption is a later, separately accepted view conversion.

## VRT-015 — Visual acceptance is mandatory before Bridge

VIEW-02 is not complete on unit tests alone. The owner must exercise the public
Electron surface for single-tab identity/location, plus-created Empty tabs,
Capture Home placement, File selection current/new behavior, exact-match
recentering, persistence/restart, and malformed-config degradation before the
view-platform milestone releases BRIDGE-01.
