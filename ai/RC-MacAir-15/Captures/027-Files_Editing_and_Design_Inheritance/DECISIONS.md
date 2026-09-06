# Files, Editing, and Design Inheritance — Decisions

> This document contains only explicit owner choices. Tentative language and
> assistant interpretations remain in `CAPTURE.md` until the owner settles them.

## Owner Decisions

### D-001 — Use the universal sole-tab and multi-tab presentation

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-005

Globally, a sole tab presents centered identity text with no visible tab rail and
a plus button to the right. Adding another tab leaves the centered presentation
and switches to the visible tabs presentation. This behavior and its JSON-backed
state/tab configuration are existing work in progress, not a new shell variant
owned by Files.

### D-002 — Code Editor is a module loaded within a tab

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-006

Code Editor uses an Empty tab with its drawer open, and the drawer is the file
tree. A file-open request first checks for an exact current match and centers it.
If there is no match, it fills the current tab when Empty; otherwise it opens and
fills a new tab. Code Editor is therefore a module hosted inside the shared tab
system rather than a separate tab shell.

### D-003 — Files starts from a real home surface

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-007

Starting a new thread in the file-centered app presents its own homepage with
centered identity, not a generic Empty tab. When another tab opens, the homepage
becomes a normal tab represented by its app icon and the short label **Files**.
The encompassing product may ultimately be named Files, Files and Docs, or
something else; that naming choice remains open.

### D-004 — Layout distinguishes note taking from word processing

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-008

Capture-like note taking and Office-like word processing are not separate
fundamental app identities. Their character comes from the layout and arrangement
of files within the shared file-centered surface. The concrete layout modes and
their names remain to be designed.

### D-005 — Keep appearance independent from the underlying file model

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-009

The file-centered surface offers a choice between multiple appearance families.
Changing appearance changes layout and visual presentation, not file identity,
content, or the underlying file behaviors. The first two directions are the
current Google Drive-like appearance and a flatter split-navigation appearance.

### D-006 — Allow navigation to move between the side and top

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-012

The appearance system must support a layout with no left navigation. In that
layout, navigation uses a top bar based on the current Capture surface. This is
an additional presentation family alongside the current and split-navigation
directions; it does not create a different file model.

### D-007 — Share file-operation semantics across every appearance

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-013

Archive, Trash, Star, and related file behaviors are unified capabilities. An
appearance may change where navigation lives, which destinations remain visible,
and how filters are exposed, but it must not redefine those operations or create
layout-specific copies of their state.

### D-008 — Provide universal Files search and filtering

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-014

Universal search must be connected to the Files model. It must support useful
file filters, initially including location, last modified, and starred state.
The complete filter vocabulary and whether a given filter is also exposed as a
persistent navigation choice remain open.

### D-009 — Use conditional layout logic, not parent-child inheritance

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-003

Presentation configuration follows explicit if/then branches. A choice exposes
the options relevant beneath that branch; it does not create a general design
inheritance system flowing from parent folders into child folders.

### D-010 — Choose collections or folders for the top-level structure

- **Authority:** owner decision
- **Status:** superseded
- **Source:** CAP-016

This record treated collections and folders as interchangeable top-level modes
inside Files. D-030 separates them into distinct Files and Collections
presentations over the same underlying content capabilities.

### D-011 — Limit collection-heading semantics to the first level

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-017

Collections may contain ordinary folders. The collection/header presentation is
used only at the first level. Opening a folder from a collection into a full tab
returns to ordinary folder display, including any folders inside it; it does not
recursively reinterpret nested folders as collections. The physical folder tree
therefore remains stable when the top-level presentation changes.

### D-012 — Support preview and direct-open folder behavior

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-018

A folder may preview its contents in a preview card or follow an Open in New Tab
default. Selecting an item inside a folder preview opens that item as a new tab.
The final default and whether it varies by layout remain open.

### D-013 — Optimize for flat use without breaking nesting

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-019

The basic use case should work like Google Keep: users can keep everything flat
and avoid nesting. Nested folders remain supported, but the first-level collection
paradigm does not propagate into them.

### D-014 — Provide three distinct navigation presentations

- **Authority:** owner decision
- **Status:** superseded
- **Source:** CAP-020

This record originally gave Files three navigation presentations:

1. **Top pills:** a third header row below the tab-owned first row and the
   filename/breadcrumb second row. The shell background extends behind the pill
   row, and the content background begins below the complete header stack.
2. **Side navigation:** a left navigation surface visually similar to the Threads
   list, using its own single background color.
3. **Google clone:** the existing Google Drive-like presentation.

D-030 supersedes that grouping. Files now owns the two left-navigation options;
Collections owns the top-pill presentation. They still share file behavior.

D-035 supersedes only the old third-row placement described above: pill
navigation now replaces the filename/breadcrumb header namespace and is reusable
beyond Collections.

### D-015 — Enter presentation customization from the tab-area overflow menu

- **Authority:** owner decision
- **Status:** superseded
- **Source:** CAP-021

Place a vertical-ellipsis menu at the far right of the tab area. The menu contains
a small set of actions, including an action for modifying the Files presentation
settings or Collections presentation settings, according to the active surface.
The remaining menu actions are not yet defined.

D-034 replaces the generic settings action with named direct toggles and a final
**View Config** action that opens the JSON itself.

### D-016 — Swap layouts live and persist view-owned JSON

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-022

Files and Collections presentation settings apply live. Persist changes through
the same mechanism used by the existing sliders, updating JSON in the owning view
capsule. The configuration is view-owned rather than inherited through the folder
tree. The exact existing JSON file, fields, and write contract must be verified
from current code before implementation planning.

### D-017 — Default Files to semantic file presentation

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-023

Files opens supported content through the presenter appropriate to its semantic
type by default:

| Target | Default Files presentation |
|---|---|
| Markdown | Rendered Markdown |
| `doc.md` | Docs document |
| Image | Image viewer |
| HTML | Webpage rendered in an iframe |
| Spreadsheet | Sheets surface |

Exact recognition rules, supported extensions, iframe containment, and fallback
behavior for unknown types remain to be specified.

### D-018 — Use Code Editor for raw file presentation

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-024

Code Editor owns the raw file-editing capability. The user may open a file through
Code Editor directly, and Files may invoke that capability as an in-place raw edit
state where explicitly defined by a semantic presenter. Rendered and raw states
must retain the same underlying resource identity. D-019 defines the first such
in-place transition for Markdown.

### D-019 — Edit rendered Markdown through an in-place raw state

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-025

Markdown opens rendered in Files. When the user activates Edit, the current file
surface transforms into raw editing in the same tab and displays a Save/Cancel
banner. D-020 fixes the Save and Cancel outcomes. Close-tab, navigation-away, and
external-change handling remain to be defined before implementation.

### D-020 — Save commits and Cancel discards the bounded Markdown edit

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-026

In Files' raw Markdown edit state, Save writes the edited file and returns the
same tab to rendered Markdown. Cancel discards every change made since entering
that edit state and returns the same tab to rendered Markdown.

### D-021 — Reuse one raw editor with different host boundaries

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-027

Code Editor and Files Markdown reuse the same raw editing capability rather than
creating a second Markdown editor. Code Editor retains real-time editing. Files
wraps the editor in a bounded Save/Cancel session. That rendered-to-edit transition
also distinguishes ordinary Markdown from `doc.md`, which opens directly through
the Docs presentation.

### D-022 — Make Create New configurable

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-028

Files view settings control what happens when the user selects **Create New**.
The configured experience may expose a dropdown of all supported creation types,
a curated subset such as Docs, Sheets, Page, and Slides, or a single simplified
action such as **New Note** that creates rendered Markdown. The exact control
shape, type inventory, and labels remain configurable design choices.

### D-023 — Separate creation affordances from content support

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-029

Hiding a file type from Create New does not make that type unsupported. Files
continues to recognize and present supported content that is dropped, imported,
or otherwise placed into the view. Creation configuration controls what the UI
advertises; it is not a format allowlist.

### D-024 — Compose named experiences from the same Files engine

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-030

Notes-like and Office-like experiences are configurations of the same Files
engine. Their layout, navigation, creation vocabulary, and advertised types may
differ, while file identity, supported presenters, search, and file operations
remain shared. This permits an experience to look focused without becoming a
content silo.

### D-025 — Remove every non-Markdown ability from Office

- **Authority:** owner decision
- **Status:** superseded
- **Source:** CAP-036

This record captured an incorrect interpretation that non-Markdown abilities
would be removed from Office. The owner corrected that interpretation in D-027:
Office retains all abilities; only the subset reused outside Office is limited to
pure Markdown.

### D-026 — Reuse Markdown-native editor mechanics block-scoped in Files

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-037

Extract and reuse the normal-Markdown editor pieces identified under D-027 and
D-028—such as parsing,
serialization, Markdown-native commands, selection, history, and Undo/Redo—and
present them through Files' block-scoped interaction. Files must not reintroduce
Office-only behavior through block-specific exceptions. Office itself retains
those abilities under D-027. P-005 is accepted subject to this reuse boundary.

### D-027 — Preserve Office and limit only the reusable subset

- **Authority:** owner correction and decision
- **Status:** active
- **Source:** CAP-039

Office does not lose abilities. Preserve its complete current feature set. When
extracting editor mechanisms for Files or another shared surface, reuse only
capabilities that map cleanly to pure Markdown syntax. Office-specific metadata,
codecs, and presentation behavior remain Office-owned and do not become special
cases in the block-scoped Files editor. This decision supersedes D-025.

### D-028 — Modularize editor capabilities and gate them by host

- **Authority:** owner clarification and decision
- **Status:** active
- **Source:** CAP-040

Split the editor into composable capability modules. The Notes/rendered-Markdown
host makes only normal-Markdown modules available and presents them block-scoped.
Office composes the same normal-Markdown base plus its Office-only extension
modules. “Remove” means omit or disable a module in the Notes composition; it does
not mean delete the capability from Office.

### D-029 — Reuse the normal-Markdown block editor in Wiki

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-041

Make rendered Wiki pages editable through the shared block-scoped Markdown
editor. Wiki composes the normal-Markdown capability modules only; Office-owned
extensions remain unavailable there. Preserve Wiki page identity, navigation,
and Wiki-owned metadata presentation around the editing surface. The exact Wiki
save and commit policy remains open rather than being inferred from this reuse
decision.

### D-030 — Separate Files from Collections by navigation paradigm

- **Authority:** owner decision and correction
- **Status:** active
- **Source:** CAP-042

Treat **Files** and **Collections** as separate presentations over the same file
capabilities. Files uses left navigation and offers two appearance options: the
offset-color side navigation resembling the Threads list, and the existing
Google Drive-like presentation. Collections uses the top-navigation paradigm;
D-035 governs its reusable module and replacement-header placement.

Both presentations support all recognized file types and use the same semantic
presenters and file operations. Each keeps a configurable **Create New** bias—its
advertised types, primary action, and vocabulary—without using that bias as a
format allowlist. This decision supersedes D-010's in-Files structure switch and
D-014's three-interchangeable-styles model.

### D-031 — Assign nested folders to Files and top-level headings to Collections

- **Authority:** owner decision and clarification
- **Status:** active
- **Source:** CAP-043

Files presents the ordinary nested folder hierarchy and offers the applicable
folder presentation and opening options. Collections presents the first level as
collection headings. That heading paradigm stops at the top level: files and
folders beneath a collection remain ordinary filesystem items, and nested folders
do not become additional collection-heading layers.

This is a presentation boundary, not two storage models. Files and Collections
continue to address the same underlying resources and support the same file types.

### D-032 — Give Collections rich previews and Files one compact alternative

- **Authority:** owner decision and simplification
- **Status:** superseded
- **Source:** CAP-044

Collections uses the tile/grid/thumbnail display paradigm. Files retains the
existing folder-within-card paradigm: file items keep their common width, taller
card geometry, and thumbnail-like preview effect alongside folder items.

Do not give Files a broad matrix of list, grid, card, tile, and thumbnail modes.
Its only alternate display option reduces file cards to the same icon-scale
treatment already used for folders. This keeps the Files configuration materially
simpler while Collections owns the preview-forward visual grammar.

D-033 corrects this decision by retaining List as a third Files presentation.

### D-033 — Retain List as a Files display option

- **Authority:** owner correction and decision
- **Status:** active
- **Source:** CAP-045

Files has three restrained item displays: its existing taller file cards, compact
folder-like icons, and List. Retaining List does not reopen the full cross-product of display
styles rejected in D-032; it preserves a useful dense, row-oriented Files view.

This decision supersedes D-032's two-mode Files display while retaining its
broader simplification and the separate Collections visual grammar.

D-038 governs the later, corrected Collections visual grammar.

### D-034 — Use direct presentation controls with View Config as the escape hatch

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-046

Keep the tab-area ellipsis menu small and concrete:

1. **Toggle Layout** switches directly between the two navigation layouts. D-036
   governs their final labels and icons.
2. **Show Thumbnails** / **Hide Thumbnails** toggles preview visibility. Use
   `magnification_large` for Show and `pip_exit` for Hide.
3. **View Config** is the final menu item, uses the same icon already used for
   JSON files, and opens the owning view JSON in another tab.

Place the List/Grid choice at the upper-left of the container that owns the file
or collection items, not in the ellipsis. Treat List/Grid and thumbnail visibility
as separate controls: their combinations yield dense lines, preview-forward
cards or tiles, and compact icon-like grids without defining a large enumeration
of display modes.

D-038 supersedes the application of List/Grid to Collections. List remains a
Files control; Collections uses Cards/Thumbnails and Card Size instead.

Do not build a comprehensive GUI for uncommon options. The JSON opened by **View
Config** is the advanced interface: the user can edit it manually or ask an
assistant to change it. Direct toggles still persist through the view-owned JSON
mechanism established by D-016.

### D-035 — Make pill navigation a reusable replacement header module

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-047

Implement top pill navigation as a reusable module that occupies the header
namespace normally used by filename, breadcrumb, or comparable identity content.
It replaces that content when active; it does not add a third header row.

Style navigation pills with the same font, radius, padding, and general language
as tabs, but surround each pill with a border. Allow the host to provide the
increased top margin needed for the revised header composition.

Populate the module from bundled destinations using their short names. Collections
uses the module for its top navigation. The same language can support Solobooks
destinations such as Invoices and Customers, or a productivity bundle containing
Calendar, Email, and other modules. Navigation reuse does not merge those modules'
resource identities or behavior.

### D-036 — Name and icon Header Navigation and Navigation Bar

- **Authority:** owner decision
- **Status:** active
- **Source:** CAP-048

The two choices exposed by **Toggle Layout** are:

1. **Header Navigation**, using the `page_control` icon.
2. **Navigation Bar**, using the custom `navigation_top_bar` icon derived by
   turning the Material Symbols `toast` source icon upside down.

This decision supersedes D-034's use of `side_navigation` for the layout toggle;
the rest of D-034 remains active.

### D-037 — Make Collections a peer module with one primary and one fallback display

- **Authority:** owner decision and clarification
- **Status:** superseded
- **Source:** CAP-049

Collections may appear as a short-name destination in Header Navigation beside
another app or module. It is not required to own or enclose the other destinations
in the bundle; the shared navigation module routes among peers while preserving
their separate identities.

Collections has two item displays. Its primary display is the tile/grid/thumbnail
presentation. List is the fallback display, providing a dependable row-oriented
representation without becoming a second equally elaborate Collections design
system.

D-038 preserves Collections as a peer module but supersedes the display model:
Collections is Capture-like, uses Cards or Thumbnails, and does not use List as a
fallback.

### D-038 — Give Collections Capture-like Cards, Thumbnails, and three card sizes

- **Authority:** owner correction and decision
- **Status:** superseded
- **Source:** CAP-050

Collections remains a peer navigation destination, but its content surface looks
like Capture. Its two content treatments are **Cards** and **Thumbnails**. Use the
same binary thumbnail-toggle pattern established for Files to switch between
them; do not treat List as a Collections fallback.

Add a **Card Size** control using the `view_cozy` icon. It has three configured
sizes and advances through them sequentially each time it is activated. The exact
size names, dimensions, wrap behavior, and persistence values remain open.

D-039 supersedes the two-treatment framing and the three-size sequence. Thumbnail
visibility remains an independent content-detail setting rather than defining the
Collections layout.

### D-039 — Separate Collections navigation, layout, and density

- **Authority:** owner clarification and decision
- **Status:** active
- **Source:** CAP-051

Collections has three independent presentation choices:

1. **Navigation** chooses the applicable navigation presentation.
2. **Layout** chooses either a grid beneath each collection heading or a
   left-to-right row beneath each heading. The row uses the same general card
   background language as the Issues Kanban and scrolls horizontally when its
   contents overflow.
3. **Card/Tile Size** chooses **Cozy** or **Compact**. This is a two-state density
   setting, not a three-state cycle.

Use `view_column_2` for the grid layout and the existing `split_screen` icon for
the horizontal-row layout. Thumbnail visibility may remain a separate detail
toggle; it does not define either Collections layout.
