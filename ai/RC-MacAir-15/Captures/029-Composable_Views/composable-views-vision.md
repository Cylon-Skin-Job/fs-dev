# Composable Views — The Vision Capture

**Captured:** 2026-09-11, design riff with RC during the VIEW-02 acceptance window
**Origin:** RC's realization while planning Capture right-clicks and display
switching: "what we are building is just ways of organizing folders and files
into a visual display."
**Status:** vision, not a SPEC. Candidate to become the next major view-platform
track (working name VIEW-03). Nothing here is scheduled; it does not block
BRIDGE-01 and does not modify the accepted VIEW-02 contract.

---

## 1. The core realization

Views are **configurations**. Capture, Office Viewer, File Viewer, Email,
Calendar — they differ by how they organize folders/files (or database slices)
into a visual display, and by data-source sophistication. The apps (invoicing,
email, calendar) are the sophisticated tier; the file-organizers are the base
tier. Same grammar, different presets and data sources.

The lens principle extends in reverse and forward: open an office doc from the
Capture-like view and you get raw markdown; open it from Office and you get the
office view; a switch toggles render anytime (already the Universal Document
Tabs design — the opening surface's config decides the default lens).

## 2. The layer cake

```
L1  PRESENTATION GRAMMAR (composable modules)
    collections · columns · cards · thumbnails (row/grid,
    card-like vs literal) · rendered-vs-raw thumbnails
    Every shipped view is a PRESET of this grammar.
    Capture = folder-grid preset. Office = workbench preset.

L2  TYPE REGISTRY
    Per file type: render modes (raw/rendered/office),
    thumbnail presentation, which views may CREATE it.
    Office creates: document, sheet, html artifact.
    Office does NOT create: markdown, javascript, json —
    but could, and those types would render read-only here
    the same as in Capture and Files. The type (not the
    view) decides renderability; the view config decides
    creation affordances.

L3  CREATION + BEHAVIOR CONFIG (per view)
    New buttons bound to templates ("new document" has a
    specific type, bound to a template) · right-click menus ·
    display/behavior switching via clicks+settings that
    progressively turn Capture into something Office-like.
    → This is the already-designed "New surface = action set"
      contract (see VIEW-02-NEW-TAB-BEHAVIOR-SPEC.md §5-§7),
      generalized from tab-creation to content-creation.

L4  DATA SOURCE TIERS
    files/folders (Capture, Files, Office) →
    provisioned database slices (email, calendar, invoicing):
    drop a config → server provisions a database part + schema.

L5  SERVER PROVISIONING RUNTIME
    Drop a config in a system folder → the server serves that
    view, watches it, re-renders on signal.
    Drop JavaScript in a system folder → the server scoops it
    up as composable modules (columns, cards, collection
    renderers).
```

## 3. Documentation strategy (the kicker)

Every shipped view becomes the **reference sample of its own config**.
Capture's `content.json` teaches how to build a Capture-like view.
Self-documenting platform: break everything into categories and make the
existing views the worked examples.

## 4. What already exists under this

- View capsules are already declarative: `content.json` + manifest + state +
  styles under `ai/<machine>/System/Views/<prefix>-<view-id>/`.
- Templates already provision views
  (`System_Manager/ai-template/templates/view-templates/`, create-service).
- `tabs.newTab {blankKind, autoOpenDrawer}` shipped in VIEW-02 — an L3 record
  already on the wire (tabPolicies).
- Server `lib/views/` modules, projections, workspace watchers exist.
- The VIEW-02 implementation report (§10) explicitly named its new seams
  (`renderEmptyBody`, `blankPlacementTarget`, `createOrRecenterBlank`,
  `onEmptyTabCreated`, `newTab` policy) as platform surfaces for this future.

## 5. Open questions the SPEC must answer (in gravity order)

1. **Thumbnail rendering chain (L2, easy):** type default ← view config ←
   per-collection override? Confirm the chain. Includes "should Markdown
   thumbnails render rendered or raw" as the first concrete instance.
2. **UI-written configs:** when the owner right-clicks → "change display,"
   does the UI WRITE the config file (settings persist into `content.json` —
   git-trackable, self-writing configs, config-as-hot-user-data), or does UI
   state shadow config in a sidecar? First option fits the project's
   declarative religion; consequence: config files become hot user data.
3. **The JS trust boundary (L5, the big one):** workspace-supplied JavaScript
   scooped up server-side is a plugin system — arbitrary code execution from
   workspace files. Requires a deliberate trust design before anything in L5
   is buildable: manifest-declared modules, sandboxing, or explicit
   owner-trust levels. This is the item that turns vision into SPEC.
4. **Database provisioning ownership (L4):** who owns a provisioned DB slice —
   the view, the workspace, the machine? Schema versioning story needed
   (migrations pattern exists in `lib/db/migrations/`).

## 6. Presentation-shape examples from the riff

- Composable modules for **columns with cards**, or **folders presented as
  collections with thumbnails** — row or grid, "more of a card" vs "more of a
  literal representation."
- Override questions: would you override the office presentation of a file in
  the File Viewer, or somewhere else? (Open — ties to the Universal Document
  Tabs lens rules, queued separately.)

## 7. Roadmap placement

- New major track candidate (VIEW-03 "Composable Views"). One SPEC at a time
  per RC's standing rule; this capture is the seed, not the SPEC.
- Does not block BRIDGE-01 (Tabs↔Provenance); provenance attaches to threads
  and actions, and eventually to AI actions inside configured views — the
  attachment model may want revisiting once L1–L3 land, but nothing here
  redefines tab ownership (that's the thread-family work, post-chat).
- Sequence fork noted 2026-09-11: successor tab SPEC (self-heal New, universal
  document tabs, preview types) vs BRIDGE-01 vs this track — RC decides at
  view-platform release.
