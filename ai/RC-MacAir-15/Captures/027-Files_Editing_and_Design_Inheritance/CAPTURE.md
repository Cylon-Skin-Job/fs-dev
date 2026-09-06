# Files, Editing, and Design Inheritance — Capture

> This is the conversational checkpoint for raw owner input, working synthesis,
> and unresolved threads. It is context, not an approved design or implementation plan.

## Working Synthesis

This capture now has a clearer product model. Fusion's global tab shell presents
a sole tab as centered identity text with no visible tab rail and a plus button
to the right. Adding a second tab leaves that centered presentation and exposes
the tabbed presentation. That shared behavior is already being built, together
with JSON-backed state and tab behavior.

The planned Code Editor is a module loaded inside a tab. Its open drawer is the
file tree. Opening a file first finds and centers an exact existing target; if
none exists, it fills the current tab when that tab is Empty, otherwise it opens
and fills a new tab.

The Files concept intentionally differs at the first-tab layer. Starting a new
thread in Files presents a real Files home surface with centered identity rather
than a generic Empty tab. When another tab opens, that home surface participates
as a normal tab with the Files icon and short Files label.

Capture-like note taking and Office-like word processing are intended to emerge
from the layout and arrangement of files within this common surface, rather than
from separate fundamental app identities. The exact app name—Files versus Files
and Docs—and the concrete layouts remain open.

Files and Collections are now separate presentations over the same underlying
file capabilities. Files owns two left-navigation options: a side navigation
resembling the Threads list and the existing Google Drive-like presentation.
Collections uses the top-navigation paradigm through a reusable header module.
The pill navigation replaces the filename/breadcrumb content that normally owns
that header namespace instead of adding a third row. Its pills reuse the tabs'
font, radius, and padding, add a border, and receive more top margin within the
host header.

The same module is not limited to Collections. A bundled product can populate it
with module short names: Solobooks can navigate Invoices, Customers, and related
surfaces there; a productivity suite can navigate Calendar, Email, and other
bundled modules through the same visual language.

Collections itself can therefore be one destination in that navigation beside a
different app. It is a peer module, not necessarily the bundle's enclosing shell.
Its content surface looks like Capture and supports the same binary thumbnail
visibility toggle used by Files. Thumbnail visibility is a content-detail choice,
not the Collections layout. Collections layout instead
chooses a grid beneath each heading or a left-to-right, horizontally scrolling
row with the same general card-background language as the Issues Kanban. Its
card/tile density is either **Cozy** or **Compact**. List is not its fallback.

Their content structures are equally distinct. Files is the ordinary nested
folder presentation and exposes the applicable folder-display options.
Collections replaces only the top level with collection headings. Content below
those headings remains ordinary files and nested folders; collection semantics
do not recur down the tree.

Their item-display grammars are now deliberately narrow. Collections uses the
tile/grid/thumbnail presentation. Files keeps its existing folder-within-card
paradigm: file cards already share a width, are taller than folder items, and
create a thumbnail-like preview effect. Files has only one alternate display
choice—reduce file items to the same icon treatment already used by folders—or
use the retained List presentation.

The controls no longer require a full settings surface. The tab-area ellipsis
contains **Toggle Layout**, switching directly between **Header Navigation** with
the `page_control` icon and **Navigation Bar** with the custom
`navigation_top_bar` icon. It also contains a stateful **Show
Thumbnails** / **Hide Thumbnails** action, using `magnification_large` and
`pip_exit`. List versus Grid belongs at the upper-left of the item container.
These small controls produce the common presentation combinations without a
large display-mode matrix.

The last ellipsis item is **View Config**, using the existing JSON-file icon. It
opens the owning view JSON in another tab. Less common changes are deliberately
manual or assistant-driven through that file rather than exposed as more GUI
settings.

Navigation placement and composition are presentation choices; Archive, Trash,
Star, search, filtering, and their underlying file behavior should be one shared
capability model. A design may expose Pins or Starred as persistent navigation
destinations, or keep some filters inside search dropdowns.

Universal Files search is required and must be connected to the shared file
model. Initial filter dimensions include location, last modified, and starred
state, with the exact set still open.

The design model is conditional rather than parent-to-child inheritance. Choices
such as navigation presence/style, top-level content structure, and folder-open
behavior determine which later choices apply. They do not recursively restyle or
reinterpret the physical folder tree.

These choices are live view settings. A vertical-ellipsis menu at the far right
of the tab area includes an action to modify them. Changes swap the active layout
immediately and persist through the same JSON-writing mechanism used by the
existing sliders, targeting the JSON in the owning view capsule rather than
creating folder-level inheritance.

Files is the semantic/rendered file experience. Ordinary Markdown opens rendered;
`doc.md` opens as a Docs document; images open in an image viewer; HTML renders as
a webpage in an iframe; and spreadsheet content opens through Sheets. Code Editor
is the deliberate raw-source path when the user wants to see or edit the bytes or
text representation instead of the default presenter.

Rendered Markdown also has an in-place edit transition inside Files. Activating
Edit transforms the current rendered surface into raw editing and displays a
Save/Cancel banner. This reuses the raw editing capability without requiring the
user to navigate away from the current file tab.

The two hosts apply different persistence boundaries to that shared raw editor.
Code Editor is real-time editing. Files Markdown is bounded: Save writes the file
and returns to rendered mode; Cancel discards the edit-session changes and returns
to rendered mode. Reusing the editor avoids a second Markdown editing paradigm,
while the explicit rendered/edit transition makes ordinary Markdown visibly
different from a `doc.md` file that opens directly as Docs.

Each surface retains a **Create New** bias. Its settings can make creation a
broad dropdown of supported types, a curated Office-like set such as Docs, Sheets,
Page, and Slides, or a simplified action such as **New Note** that creates rendered
Markdown. This configuration changes the creation affordances and labels, not the
shared engine's ability to accept and present other supported content.

That separation lets one configured Files view resemble Capture and be called
Notes, while another resembles an Office Suite and omits Markdown and code from
its creation UI. Content remains portable across those personalities: dropping a
document into Notes still works; dropped HTML in the Office-like profile appears
as a Page; and dropped Markdown still appears as rendered content such as a card
or thumbnail even when Markdown creation is not advertised.

A new candidate interaction would make rendered Markdown editable one logical
block at a time. Right-clicking a paragraph, heading, or other supported block
would open a side menu, outline the active block with a dotted box, and expose
whole-block commands such as paragraph/text style, H1–H6, italic, and related
formatting. The idea is technically viable if the selected unit is a parsed
Markdown node and edits run through the shared Milkdown/ProseMirror model; it is
not safe to infer editable source ranges from the current rendered HTML alone.

The owner has now fixed the reuse boundary: Office keeps all of its existing
abilities, but Files extracts and reuses only the pieces representable as pure
Markdown syntax. Reusable pieces include the structured editor, Markdown-native
commands, history, Undo/Redo, selection, and related mechanics. Files presents a
constrained block-scoped interaction over that subset and receives no
Office-specific formatting exceptions. The exact Markdown dialect for the shared
subset remains open.

The implementation shape is modular composition. Normal Markdown capabilities
form the reusable base. The Notes/rendered-Markdown composition makes only those
modules available and scopes them to the selected block. Office composes the same
base with its Office-only extension modules, so nothing is removed from Office.

Wiki is another host for that normal-Markdown composition. A rendered Wiki page
can invoke the same block-scoped editor without receiving Office-only extension
modules. Its page identity, Wiki navigation, and metadata presentation remain
Wiki-owned; the exact save boundary for Wiki editing remains open.

The next capability seam to examine is the editing machinery currently associated
with Office—especially live editing and Undo/Redo—and determine which parts are
actually shared file-editor infrastructure.

This work dovetails with the accepted direction that tabs become the default
content interface and with the Tabs/Provenance/Chat identity boundaries. It should
reuse tab placement and explicit resource identity rather than inventing another
navigation or causality system.

Current phase: **exploring**.

## Active Threads

### CAP-001 — Reframe the file-facing product surface

- **Origin:** owner
- **Type:** direction
- **Status:** open
- **Captured:** 2026-09-05

Settle the remaining naming and scope language. **Code Editor** is the working
identity for the tab-loaded editor module. Capture-like and Office-like work are
now understood as layouts of the shared file surface, but the encompassing app
name remains open between **Files**, **Files and Docs**, or another final label.

### CAP-002 — Extract shared editing capabilities from Office

- **Origin:** owner
- **Type:** requirement exploration
- **Status:** open
- **Captured:** 2026-09-05

Identify what should be pulled out of Office into reusable file-editing
infrastructure, beginning with live editing and Undo/Redo. The reusable content
boundary is pure Markdown syntax. Office retains its full feature set; the
remaining work is to inventory the Markdown-native mechanisms suitable for the
shared core and define the selected Markdown dialect.

### CAP-004 — Join with Tabs, Chat, and Provenance

- **Origin:** context synthesis
- **Type:** dependency question
- **Status:** open
- **Captured:** 2026-09-05

Map the new Files/Code Editor direction onto the established platform boundaries:
tabs are presentation context; exact targets use `presenterId + targetKey`;
resource mutations, tab placement, thread actions, and renderer refreshes are
separate facts; and Chat retains its own group, session, surface, and worksurface
identities. Determine which file-editing actions need durable provenance without
treating every focus or layout change as a resource mutation.

Sources:

- `../002-SPECs/TABS-PROVENANCE-COORDINATION/OWNER-DECISIONS.md`
- `../002-SPECs/TABS-PROVENANCE-COORDINATION/INTERFACE-CONTRACT.md`
- `../025-Chat_Composition_Roadmap/DECISIONS.md`
- `../026-Tab-Target-Placement/DECISIONS.md`
- `../009-Office-Editor-Temp/GUIDANCE.md`

### CAP-011 — Define the folder and file display grammar

- **Origin:** owner
- **Type:** design question
- **Status:** open
- **Captured:** 2026-09-05

Settle the remaining display choices: cards, tiles, thumbnails, or icons; grid,
list, or another arrangement; and the exact visual treatment of the first-level
collection headings. Also decide whether Starred and other filters are persistent
navigation destinations, search-only dropdowns, or selectable parts of an
appearance configuration.

The main item-display split was resolved by D-032. The navigation/filter exposure
question and exact visual styling remain open.

### CAP-033 — Settle the Create New vocabulary and control shape

- **Origin:** owner
- **Type:** design question
- **Status:** open
- **Captured:** 2026-09-05

Choose the exact Create New control for each configuration: dropdown versus
single action, complete versus curated file-type list, the supported type set,
and user-facing labels such as Note and Page.

### CAP-035 — Define block granularity and whole-block formatting semantics

- **Origin:** owner and code-informed analysis
- **Type:** design question
- **Status:** open
- **Captured:** 2026-09-05

Decide whether selectable units are paragraphs, headings, list items, whole lists,
quotes, code fences, tables, or a smaller initial subset. Define how whole-block
bold/italic behaves around links and inline code, which node types can convert to
H1–H6, and how keyboard selection, Undo/Redo, Save/Cancel, and nested structures
interact with the dotted block focus.

### CAP-038 — Define the pure Markdown dialect and migration policy

- **Origin:** code-informed follow-up
- **Type:** design and migration question
- **Status:** open
- **Captured:** 2026-09-05

Define whether “pure Markdown” means CommonMark, the currently configured GFM
surface, or another explicit subset, and inventory every syntax command eligible
for reuse. Office-only capabilities and existing Office documents remain intact
and outside this extraction boundary.

## Routed Outcomes

### CAP-003 — Parent-to-child design flow

- **Origin:** owner
- **Type:** design correction
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-009

Routed to D-009 in `DECISIONS.md`; the earlier inheritance framing was replaced
by conditional layout logic.

### CAP-005 — Global sole-tab and multi-tab presentation

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-001

Routed to D-001 in `DECISIONS.md`.

### CAP-006 — Code Editor is a tab-loaded file-tree module

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-002

Routed to D-002 in `DECISIONS.md`.

### CAP-007 — Files begins with its own home surface

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-003

Routed to D-003 in `DECISIONS.md`.

### CAP-008 — Note taking and word processing are layouts

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-004

Routed to D-004 in `DECISIONS.md`.

### CAP-009 — Offer multiple appearance families

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-005

Routed to D-005 in `DECISIONS.md`.

### CAP-010 — Flat split-navigation appearance

- **Origin:** owner
- **Type:** design idea
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** P-001

Routed to P-001 in `PROPOSALS.md`.

### CAP-012 — Support a top-navigation appearance

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-006

Routed to D-006 in `DECISIONS.md`.

### CAP-013 — Unify file operations across layouts

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-007

Routed to D-007 in `DECISIONS.md`.

### CAP-014 — Connect universal Files search

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-008

Routed to D-008 in `DECISIONS.md`.

### CAP-015 — Capture-style top bar

- **Origin:** owner
- **Type:** design idea
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** P-002

Routed to P-002 in `PROPOSALS.md`.

### CAP-016 — Collections or folders at the top level

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-010

Routed to D-010 in `DECISIONS.md`.

### CAP-017 — Keep collection semantics at the first level

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-011

Routed to D-011 in `DECISIONS.md`.

### CAP-018 — Folder preview or direct-open behavior

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-012

Routed to D-012 in `DECISIONS.md`.

### CAP-019 — Preserve the flat Google Keep use case

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-013

Routed to D-013 in `DECISIONS.md`.

### CAP-020 — Fix the three navigation presentations

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-014

Routed to D-014 in `DECISIONS.md`.

### CAP-021 — Put layout settings in the tab-area overflow menu

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-015

Routed to D-015 in `DECISIONS.md`.

### CAP-022 — Apply live swaps and persist them in view JSON

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-016

Routed to D-016 in `DECISIONS.md`.

### CAP-023 — Route Files content to semantic presenters

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-017

Routed to D-017 in `DECISIONS.md`.

### CAP-024 — Reserve raw presentation for Code Editor

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-018

Routed to D-018 in `DECISIONS.md`.

### CAP-025 — Transform rendered Markdown into raw edit mode

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-019

Routed to D-019 in `DECISIONS.md`.

### CAP-026 — Define Markdown Save and Cancel outcomes

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-020

Routed to D-020 in `DECISIONS.md`.

### CAP-027 — Reuse one raw editor with host-specific persistence

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-021

Routed to D-021 in `DECISIONS.md`.

### CAP-028 — Configure the Create New affordance

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-022

Routed to D-022 in `DECISIONS.md`.

### CAP-029 — Keep hidden creation types supported

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-023

Routed to D-023 in `DECISIONS.md`.

### CAP-030 — Build named experiences from Files configuration

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-024

Routed to D-024 in `DECISIONS.md`.

### CAP-031 — Notes configuration profile

- **Origin:** owner
- **Type:** design idea
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** P-003

Routed to P-003 in `PROPOSALS.md`.

### CAP-032 — Office Suite configuration profile

- **Origin:** owner
- **Type:** design idea
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** P-004

Routed to P-004 in `PROPOSALS.md`.

### CAP-034 — Block-scoped rendered Markdown editing

- **Origin:** owner
- **Type:** design idea and feasibility question
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** P-005, I-001

Routed to P-005 in `PROPOSALS.md` and I-001 in `ISSUES.md` after checking the
current renderer and installed editor surfaces.

### CAP-036 — Remove non-Markdown abilities from Office

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-025, I-002

Routed to D-025 in `DECISIONS.md`; the current Office-only metadata surface is
recorded as migration issue I-002.

### CAP-037 — Reuse Markdown-native editor pieces block-scoped

- **Origin:** owner
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-026, P-005

Routed to D-026 in `DECISIONS.md`; P-005 is accepted under that decision.

### CAP-039 — Preserve Office while limiting the reusable subset

- **Origin:** owner correction
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-027

Routed to D-027 in `DECISIONS.md`. This correction supersedes D-025 and the
removal/migration interpretation in I-002.

### CAP-040 — Modularize capabilities and gate the Notes composition

- **Origin:** owner clarification
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-028

Routed to D-028 in `DECISIONS.md`.

### CAP-041 — Reuse the block-scoped Markdown editor in Wiki

- **Origin:** owner
- **Type:** decision and design direction
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-029, P-006

Routed to D-029 in `DECISIONS.md` and P-006 in `PROPOSALS.md`. Current Wiki
renderer evidence is included in I-001.

### CAP-042 — Separate Files and Collections presentations

- **Origin:** owner
- **Type:** decision and product-model correction
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-030

Routed to D-030 in `DECISIONS.md`. This replaces the model in which Files itself
offered all three navigation paradigms.

### CAP-043 — Divide folder and heading structure by presentation

- **Origin:** owner
- **Type:** decision and clarification
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-031

Routed to D-031 in `DECISIONS.md`.

### CAP-044 — Narrow display choices by presentation

- **Origin:** owner
- **Type:** decision and simplification
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-032

Routed to D-032 in `DECISIONS.md`.

### CAP-045 — Retain List in Files

- **Origin:** owner correction
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-033

Routed to D-033 in `DECISIONS.md`, superseding D-032's two-mode Files display.

### CAP-046 — Use direct toggles and expose the JSON escape hatch

- **Origin:** owner
- **Type:** decision and interaction design
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-034

Routed to D-034 in `DECISIONS.md`.

### CAP-047 — Make pill navigation a reusable header module

- **Origin:** owner
- **Type:** decision and reusable design direction
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-035, P-002

Routed to D-035 in `DECISIONS.md` and the revised P-002 in `PROPOSALS.md`.

### CAP-048 — Name and icon the two navigation layouts

- **Origin:** owner
- **Type:** decision and asset request
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-036

Routed to D-036 in `DECISIONS.md`. The requested `navigation_top_bar` source icon
was created beside the Material Symbols source variants by rotating `toast`
upside down.

### CAP-049 — Treat Collections as a peer destination with a fallback display

- **Origin:** owner
- **Type:** decision and clarification
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-037

Routed to D-037 in `DECISIONS.md`.

### CAP-050 — Use Capture-like Cards or Thumbnails in Collections

- **Origin:** owner correction and decision
- **Type:** decision
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-038

Routed to D-038 in `DECISIONS.md`, superseding D-037's incorrect List-fallback
interpretation.

### CAP-051 — Separate Collections navigation, layout, and density

- **Origin:** owner clarification and asset request
- **Type:** decision and asset request
- **Status:** routed
- **Captured:** 2026-09-05
- **Related:** D-039

Routed to D-039 in `DECISIONS.md`. Collections layout is Grid Under Headings or
Horizontal Rows with Kanban-like card backgrounds and sideways overflow scrolling.
Navigation remains a separate option, and card/tile density is Cozy or Compact.
The initially requested custom `view_row_2` family was removed after the existing
Material Symbols `split_screen` icon was identified as the horizontal counterpart.
