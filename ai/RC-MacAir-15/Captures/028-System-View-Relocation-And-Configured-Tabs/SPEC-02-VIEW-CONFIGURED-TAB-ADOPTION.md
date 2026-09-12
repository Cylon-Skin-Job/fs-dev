# VIEW-02 — View-Configured Tab Defaults and First Adopters

**Status:** `CANDIDATE — NOT IMPLEMENTATION AUTHORITY`  
**Lane:** View Configuration and Renderer Adoption  
**Requires:** owner-accepted VIEW-01 and accepted TABS-00 through TABS-03  
**Blocks:** owner release of the tab-platform milestone, then BRIDGE-01

## 1. Objective

Let a relocated view capsule select a safe, code-owned initial tab and Empty-tab
launcher set through `content.json`, then make Capture and File Explorer the
first production consumers of the accepted generic component tab host,
universal header/location rail, and TABS-03 placement controller.

## 2. Goals

1. Define one strict, versioned tab-policy projection with bounded failures.
2. Make initial and plus-created Empty tabs predictable without embedding
   domain creation in the plus button.
3. Give every adopted single tab centered identity and every active tab the
   universal location rail.
4. Route Capture preview/open and File selection through one exact-match,
   non-destructive placement function.
5. Preserve existing state/persistence owners and restart behavior.
6. Produce a meaningful owner-facing visual test before Bridge begins.

## 3. Non-goals

- Side Chat, ChatSurface, thread groups, collections, worksurface schemas, or
  Move Chat to Side Chat.
- Wiki/Tickets/Browser/Office/Email production conversion.
- Dynamic launcher/component registration, plug-in discovery, or executable
  paths from configuration.
- New server persistence, WebSocket messages, UEB facts, Provenance fields, or
  actor/permission claims.
- Domain creation effects from plus or Empty launchers.
- Redesigning Capture, File Explorer, their drawers, or the accepted tab chrome.

## 4. Server-owned configuration contract

Extend the existing version-1 `content.json` with the optional exact `tabs`
object defined in VRT-010. Add one server-side parser/normalizer with:

- plain own enumerable data properties only; no unknown/inherited/accessor or
  symbol keys;
- `schemaVersion: 1` exactly;
- `tabLabel`, `locationLabel`, and every `omitTerminalNames` entry are strings
  whose UTF-8 encoding is 1–1,024 bytes after requiring the original value to
  equal `trim()`; they must be well-formed Unicode with no lone high or low
  surrogate, contain no code point in U+0000–U+001F or U+007F–U+009F, and
  contain no U+2028/U+2029;
- launcher IDs use the accepted opaque-ID rule: string, original equals
  `trim()`, 1–256 UTF-8 bytes, and the same forbidden control ranges;
- ordered ID/name arrays are duplicate-free by exact byte-for-byte equality;
- exact `initial`, `plus`, `empty`, and `location` records;
- a fixed maximum of 32 launcher IDs and 32 omitted terminal names;
- only code-owned launcher IDs valid for that view;
- no URLs, import paths, component IDs, presenter IDs, resource targets,
  permissions, callbacks, or executable data.

Normalized policy—not raw JSON—is included in a new `tabPolicies` map on the
existing `panel_config` message. Each view value is exactly either
`{schemaVersion: 1, status: "ready", policy: <normalized policy>}` or
`{schemaVersion: 1, status: "unavailable", code:
"tab_configuration_unavailable"}`. Absence means legacy behavior. The renderer
stores that projection with the active workspace panel state and does not
reparse the disk object fetched by its legacy panel discovery path. A present
malformed/unsupported policy leaves the view discoverable and Chat unaffected
but opts its tab adapter into the bounded unavailable surface with no launch
actions. It does not fall back silently to a different default.

Configuration files are read at normal workspace/view refresh boundaries.
VIEW-02 adds no live editor or watcher contract.

## 5. Closed launcher catalog

Create a small code-owned registry that maps a launcher ID to:

- owning `viewId`;
- safe display label, icon, and optional description;
- a fixed kind: `component` or `picker`;
- for `component`, a launcher function returning a fully validated component
  descriptor or a bounded product-safe failure;
- for `picker`, a shell-owned reveal effect plus the accepted pending Empty
  reservation that identifies the eventual destination;
- the presenter/target resolver entry required for later placement.

The registry is not state storage and imports no view store. Connected
view-specific modules bind registry functions to their existing owners. Unknown
IDs, wrong-view IDs, thrown launchers/pickers, invalid descriptors, and stale
async completion use the accepted Empty reservation failure behavior.

Version-1 IDs are:

| View | Launcher ID | Kind | Empty label | Behavior |
|---|---|---|---|---|
| Capture | `capture.home` | component | Capture Home | Resolve the existing Capture landing presenter; no file/folder creation |
| File Explorer | `file.open` | picker | Open File | Reveal/open the existing file-tree drawer and keep this Empty tab as the destination |

Side Chat is not registered or shown.

There is exactly one active File-picker context per connected
`{workspaceId, viewId}` owner. Starting `file.open` in another Empty tab
atomically cancels the prior pending reservation before binding and revealing
the singleton drawer for the new one. Drawer close, launcher Cancel,
destination close/fill, workspace switch, disconnect, or owner retirement
clears that exact context and reservation. Ordinary focus changes do not.

Add one compatible picker-selection preparation transition. It accepts the
exact pending reservation identity, proves the destination is still Empty at
the expected revision, removes only that reservation, activates that tab, and
leaves content/order/revision unchanged. Missing, failed, canceled, closed,
filled, replaced, cross-workspace, or stale identities return
`stale_completion` with no state change. Preparation and the following TABS-03
`current` call run in one connected-owner serialized intent lane, so another
activate/close/plus/placement intent cannot interleave between them. Cancel or
closing the destination retires the pending picker. If placement itself fails
after valid preparation, the destination remains the active unreserved Empty
tab, the drawer reports a bounded failure, and the user may choose Open File
again; no false component success is reported. Exact-target activation may
leave that Empty tab available rather than duplicating the already-open file.

## 6. Initial and plus behavior

At first initialization with no hydrated tabs:

- `initial.kind: "empty"` creates one Empty tab with the configured tab and
  location labels;
- `initial.kind: "launcher"` creates one Empty tab and invokes the named
  launcher through reserve → launch → validate → commit/fail.

Before this rule, Capture runs a one-time classic-state conversion whenever no
generic Capture tab records exist. A valid `docViewerFullPage: true` state with
the mode's canonical selected document becomes one addressed document tab using
the existing snapshot/domain projection, preserving selected path, mode, grid
and document scroll. A landing/preview state with any meaningful classic field
(selected/last-opened path, non-default mode, or nonzero scroll) becomes one
`capture.home` tab whose presenter input preserves that projection. An asserted
full-page state without a valid selected document is bounded unavailable rather
than silently reset. Only the default shape—no selected/last path, active mode,
zero scroll, and not full-page—is truly uninitialized and uses configured
initial policy.

Hydrated valid generic state wins over classic conversion and initial policy.
Policy changes do not rewrite an existing tab set. A truly empty post-close
collection reinitializes only through the view owner's explicit established
lifecycle; it must not trigger a render loop that repeatedly recreates closed
tabs.

When enabled, plus creates and activates exactly one Empty tab. It does not open
a file, create a Capture, create a thread/folder, or invoke a configured
launcher. When disabled, no plus action or keyboard-equivalent add action is
exposed. The existing maximum tab bound applies.

## 7. Universal display policy

Each Empty tab uses `empty.tabLabel`, the view's existing configured icon, and
`empty.locationLabel`. Addressed components use code-owned target resolution to
supply tab label/icon and full location segments. One tab displays centered
identity; multiple tabs use the ordinary rail; both show the accepted location
row on shell background.

`omitTerminalNames` removes an exact case-sensitive match only when it is the
last display segment and at least one segment remains. It never changes
`targetKey`, presenter identity, file path, permissions, fetching, saving, or
deduplication. Tests cover `PAGE.md`, similarly named files, one-segment paths,
and duplicate labels.

`historyControls: "presenter"` permits the shell to display Back/Forward only
when the active presenter supplies the accepted valid tab-correlated callbacks.
`"none"` suppresses controls even if a presenter has history. Config never
creates callbacks or derives navigation from breadcrumb text.

## 8. Connected owner contract

Each adopter supplies the generic host with validated content, shell, launcher,
reservation, resolution, and action projections. It also supplies TABS-03 with
one current snapshot and one atomic acknowledged commit port.

The adapter must:

- translate the view's existing state into generic records without changing
  identity semantics;
- apply content, active tab, descriptor, shell location, and reservation changes
  as one owner transition;
- return committed only when a fresh owner read exactly matches the planned
  snapshot, or rejected with the prior state intact;
- serialize placement decisions per connected view owner;
- abort or reject stale async work across workspace switch/unmount;
- preserve existing dirty/pending-file close protection;
- avoid optimistic committed presentation before required persistence
  acknowledgement where the existing owner requires acknowledgement.

Presentation components remain props-only. The generic shell imports no Capture
or File store, and no adopter creates a second tab store.

## 9. Capture adopter

Ship Capture policy in the relocated live capsule and canonical template:

```json
{
  "tabs": {
    "schemaVersion": 1,
    "initial": { "kind": "launcher", "launcherId": "capture.home" },
    "plus": { "enabled": true },
    "empty": {
      "tabLabel": "New Capture Tab",
      "locationLabel": "New Capture Tab",
      "launcherIds": ["capture.home"]
    },
    "location": {
      "omitTerminalNames": [],
      "historyControls": "none"
    }
  }
}
```

The home target displays `Capture Documents and Artifacts`. Existing document
previews remain previews. Their Open in New Tab action uses disposition `new`;
any existing current-tab action uses `current`. Addressed Capture documents use
a stable canonical Capture resource key and a location such as
`Capture > Collection > Name`. Exact open matches activate and reveal the
existing tab. Populated tabs are never overwritten.

Legacy hydrated Capture tabs are normalized once into the connected projection
without losing open document identity, active selection, scroll state, or
view-state persistence. Remove the legacy “only show tabs at two items” shell
branch for the adopted path: one Capture tab uses centered identity and the
location row.

## 10. File Explorer adopter

Ship File Explorer policy in the relocated live capsule and canonical template:

```json
{
  "tabs": {
    "schemaVersion": 1,
    "initial": { "kind": "empty" },
    "plus": { "enabled": true },
    "empty": {
      "tabLabel": "New File Tab",
      "locationLabel": "New File Tab",
      "launcherIds": ["file.open"]
    },
    "location": {
      "omitTerminalNames": [],
      "historyControls": "none"
    }
  }
}
```

`Open File` reserves its exact Empty tab and keeps that reservation pending
while revealing the existing file-tree drawer. It does not reserve a resource
identity in config. Selecting a file carries the reservation identity into the
connected-owner serial lane, runs picker-selection preparation to release and
activate that exact waiting tab, then creates a TABS-03 `current` request for
the canonical file presenter and canonical resolved file target. Explicit Open
in New Tab uses `new`. Exact match activates/reveals; otherwise that
now-unreserved waiting Empty tab fills. The current `openFileTab` local
match/fill/append implementation is retired from the public action path rather
than competing with TABS-03.

The accepted file data/content owner, loading/error behavior, symlink metadata,
dirty/pending close protection, autocomplete effects, and activity persistence
remain intact. Legacy hydrated file tabs normalize without changing the
canonical resource path used for fetching/saving.

## 11. Dependency-ordered slices

### Slice 1 — Parser, wire projection, and policy tests

- Add strict server normalization and panel-config typing.
- Add closed registry metadata and pure location-policy projection.
- Prove absence, valid config, every invalid shape/bound, wrong-view launcher,
  UTF-8 boundary, lone-surrogate rejection/valid-pair acceptance,
  whitespace/control range, duplicate value, and safe failure behavior.

### Slice 2 — Connected adapter foundation

- Factor shared translation/commit helpers without adding a store.
- Split Capture and File connected adapters into focused files.
- Prove initial Empty/launcher, plus enablement, reservation retry/cancel,
  workspace switch, and shell presentation through the public `ViewTabBar`.

### Slice 3 — Capture production adoption

- Add live/template config.
- Normalize legacy state and connect home/document presenters.
- Prove classic zero-tab full-page and landing/preview conversion with selection
  and scroll preserved across restart.
- Route preview/current/new through TABS-03.
- Pass focused behavior, persistence, accessibility, and visual tests.

### Slice 4 — File Explorer production adoption

- Add live/template config.
- Connect Empty/File presenters and drawer launcher.
- Route file selection/current/new through TABS-03 and retire competing logic.
- Pass focused data lifecycle, pending-close, persistence, accessibility, and
  visual tests.

### Slice 5 — Integrated restart and owner walk

- Run client typecheck/lint where configured, component suites, full production
  build, server config suites, and Electron smoke.
- Restart and verify hydrated Capture/File tabs.
- Complete the owner visual checklist below before releasing Bridge.

## 12. Verification matrix

| Contract | Required proof |
|---|---|
| Config | Exact schema and UTF-8/control/count boundaries; absence compatibility; invalid-present bounded failure; no executable/authority fields |
| Launcher | Correct view ownership; component commit; one singleton picker context and exact destination correlation; second-picker replacement; reserve/fail/retry/cancel; stale/cross-workspace isolation; Side Chat absent |
| Initial/plus | Hydration wins; initial launcher uses reservation; plus only creates Empty; disabled plus is inaccessible |
| Chrome | Single centered identity, multi-tab rail, location always present, Empty identity meaningful, display omission non-authoritative |
| Placement | Exact match reveal; current fills only active unreserved Empty else append; new exact-match else append; no overwrite |
| Capture | Home default; classic zero-tab conversion; preview/new behavior; location; scroll/selection persistence; restart |
| Files | Empty default, Open File drawer, current/new behavior, data errors, pending/dirty close, autocomplete, restart |
| Ownership | No generic store; one atomic owner commit; workspace-switch stale work cannot land |
| Regression | Existing generic tab tests, adopter suites, server config tests, client build, Electron public shell |

## 13. Owner visual acceptance

The implementation report gives plain-English launch instructions. The owner
must verify:

1. Capture opens as one centered `CAPTURE` identity with
   `Capture Documents and Artifacts` beneath it.
2. Capture plus creates `New Capture Tab`; it offers only `Capture Home`.
3. Opening a Capture document in a new tab shows universal rail/location chrome;
   opening the same document again centers the existing tab.
4. File Explorer opens as `New File Tab` with only `Open File`.
5. `Open File` reveals the file tree; selecting a file fills that Empty tab.
6. Selecting another file with a populated active tab appends; selecting an
   already-open file centers it instead of duplicating it.
7. Plus creates another Empty tab and never creates a file/folder/thread.
8. Closing, switching views/workspaces, and restarting preserve established
   Capture/File behavior without blank, duplicate, or cross-workspace tabs.
9. A fixture with malformed present tab config shows a bounded unavailable
   surface while the view remains selectable and the app remains usable.
10. Side Chat does not appear anywhere in these launchers.

## 14. Definition of done

VIEW-02 is complete only when validated relocated config drives Capture and File
defaults, all opens use accepted placement, universal identity/location chrome
is visible for single and multiple tabs, state owners and restart behavior are
preserved, automated gates pass, and the owner accepts the visual checklist.
Only then may the owner release the tab-platform milestone to BRIDGE-01.
