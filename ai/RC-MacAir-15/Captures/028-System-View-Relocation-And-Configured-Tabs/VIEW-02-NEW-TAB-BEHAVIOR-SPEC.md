# VIEW-02 Design Spec — New Tab Behavior Contract

**Written:** 2026-09-10, design session with RC
**Authority:** owner direction (rank 1, same chain as `VIEW-02-OWNER-DIRECTIVE.md`)
**Status:** design agreed; not implemented
**Audience:** the VIEW-02 corrections implementer; this document is the contract
the implementation must satisfy and the visual walk must verify.

---

## 1. Problem statement

Dogfooding the VIEW-02 build surfaced four defects in tab behavior:

1. A lone tab renders **centered** in the top bar (a separate
   `SingleTabIdentity` chrome path) and only left-aligns once a second tab
   exists. One tab looks unlike every other tab state.
2. The **+ button creates unlimited blank tabs** — a second, third, fourth
   empty tab. No dedupe exists in the plus path.
3. A blank tab is not blank: it renders the **"Add content" launcher menu**
   (`EmptyTabPanel`), which duplicates optionality the drawers should own.
4. **Capture tabs mirror each other**: opening a document in a new tab
   changes the rendered state of every other Capture tab, defeating the
   purpose of multiple tabs.

## 2. Tab taxonomy (closed set)

A tab is exactly one of:

| Kind | Content | Example |
|------|---------|---------|
| **Home** | The view's app home screen | Capture tile landing |
| **Empty** | Blank canvas of the view's type; slide-out drawer opens it; it is fillable | File view: drawer + folder icon + "Open file" / "Select a file from the workspace tree" |
| **Document** | One opened document, opened from a drawer or a home-screen click | `Capture > Captures > responsive-breakpoints.md` |

There are no other tab kinds **in this milestone** (§10 defines how future
surfaces, e.g. chat, extend the model). "Blank" means the view's
**configured new-tab state**: for home-type views that is the Home tab; for
non-home-type views it is the Empty tab.

## 3. Chrome: one strip, always

- The tab strip is the **only** tab chrome. A single tab renders exactly like
  twenty: left-aligned, same geometry, same actions.
- The `SingleTabIdentity` centered-chrome path is **retired** (aligned with
  the owner directive §1/§4: the top bar is default shell chrome; the
  location rail is the single path row; single chrome source). This contract
  supersedes any SPEC-02 single-tab centered-identity presentation language
  for adopted views; owner direction of 2026-09-10 is the latest word. It
  likewise supersedes SPEC-02 §6 ("plus creates and activates exactly one
  Empty tab") and §13.7 wherever they conflict with §4's dedupe/recenter
  rule.

## 4. Plus button contract

The + button always means what the user already associates with that view.
It is dumb and deterministic; it never opens menus.

- Active tab is a **Home** tab → **+ does nothing.**
- Active tab is an **Empty** tab → **+ does nothing.**
- Otherwise → **+ creates that view's blank** (per its configured new-tab
  state). If that view already has a blank tab, **recenter it** — the same
  recenter contract as reopening a document that is already open in a tab.
  A view never holds two blanks.

The + button **never** opens a launcher menu, picker, or any other UI.

## 5. Fill contract (how tabs get content)

- The **slide-out drawer is the only way an Empty tab is filled.**
- Right-click (or equivalent in-app open) generates a **new Document tab**
  or **recenters the existing tab** that already shows that document.
- **No condition exists under which a Home tab opens an Empty tab.** Only
  the + button creates blanks.
- Opening a document must never mutate the state of any other tab.

### Design flow principle (owner)

The drawer is the **general design flow** for optionality. Where a view needs
more open/new options, the answer is **more side drawers**, not more top-bar
affordances. + stays minimal; drawers net the options and double as the fill
mechanism for Empty tabs on non-home-type views. Future integration of
outside views and content will use right-click options and side bars
(owner-driven; do not pre-build).

## 6. Empty tab presentation (File view reference design)

The File Empty tab is the reference pattern for all Empty tabs:

- The drawer opens automatically on creation (subject to the per-view
  config flag, §7).
- Centered in the content area:
  - **Folder icon**
  - **"Open file"** — larger font
  - **"Select a file from the workspace tree"** — normal font

The `EmptyTabPanel` "Add content" launcher grid is **retired**. An Empty tab
presents no menu. (The Empty *reservation* machinery survives as the
container/lifecycle mechanism and bounded failure surface — only the launcher
menu presentation dies.)

## 7. Per-view new-tab config

The per-view `tabs` config (already carried by the template capsules'
`content.json`; server-side `tabPolicies` per SPEC-02 §4) gains a new-tab
policy:

- **Blank kind:** `home | empty` — what + creates for this view. This is a
  **new** policy field, distinct from but consistent with SPEC-02 §4's
  `initial.kind` (`launcher | empty`), which governs first initialization.
  Pinned per owner-confirmed reading (2026-09-10): **File: `empty`.
  Capture: `home`.**
- **Auto-open drawer:** whether a new Empty tab opens its drawer
  automatically (File: yes). New field; name and placement TBD at
  implementation. The strict `tabs` parser (SPEC-02 §4) must be extended to
  accept these fields as optional keys.

## 8. State scoping (hard rule)

**All presenter state is tab-scoped.** Anything a presenter renders must key
off its own tab's record — never a view-level or global slot.

Defect mechanism (symptom owner-observed in dogfood; the shared-state
mechanism below is code-verified — fix as part of this work):

- Tab *records* are correctly per-tab (each carries its own `targetKey`), but
  presenters depend on shared, view-keyed state: `activeResourceStore` is an
  app-wide singleton that document presenters **write** on open
  (`FilePageView`) and other surfaces **read** (e.g.
`src/lib/ws/file-handlers.ts`), and
  chrome/selection fields live at `viewStates['capture-viewer']`
  (panel-keyed). This shared state is the candidate mechanism for the
  owner-observed mirroring: opening document B in a new tab changes what tab
  A renders as its active document.

This rule also subsumes the placement recenter contract (SPEC-02 document
dispositions: reopening a document that is already open recenters only its
own tab).

## 9. Persistence

- The blank sentinel (Home or Empty, per view config) must survive cold
  start with its identity intact.
- This interacts with the known hydration defect
  (`VIEW-02-CORRECTIONS-HANDOFF.md` §4: persisted classic tabs render Empty on
  cold start; live tab state was reset 6→1). The sentinel's persisted
  identity must be specified during implementation so hydration neither eats
  blanks nor resurrects duplicate ones. Per-view dedupe (§4) applies on
  hydration too.

## 10. Out of scope (future, owner-sequenced)

- **Chat display surfaces:** when the chat work lands, every chat maintains a
  display surface for itself; tabs opened within a chat's surface are
  associated with that chat, and view-surface state is persisted per chat.
  This spec's per-view state scoping (§8) is the foundation that makes
  per-chat surfaces possible; no chat-specific behavior is built now.
- **Outside views/content integration:** right-click + sidebar paths, when
  the owner releases them (§5).

## 11. Verification expectations

In addition to the standing VIEW-02 gates (`VIEW-02-CORRECTIONS-HANDOFF.md` §6):

- One tab, twenty tabs: identical chrome geometry, left-aligned (§3).
- + on Home / + on Empty / + on Document: nothing / nothing / one blank,
  recentered if one exists (§4).
- No launcher menu on any Empty tab (§6).
- Opening a document in tab B leaves tab A's rendered state untouched (§8).
- Blank survives cold start exactly once (§9).
- Drawer toggle from the rail (or interim floating control) still collapses
  the tree (directive §5).
