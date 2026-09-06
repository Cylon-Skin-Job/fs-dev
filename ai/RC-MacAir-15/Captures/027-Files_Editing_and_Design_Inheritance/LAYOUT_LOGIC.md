# Files Conditional Layout Logic

> This document is a working analytical model of the owner-directed presentation
> logic. `DECISIONS.md` remains the authority for settled behavior; open branches
> here are not approved defaults or implementation specifications.

## Decision Flow

The current presentation split and option tree is:

1. Choose the presentation identity.
   - **Files:** use left navigation, then choose between the offset-color side
     navigation resembling Threads and the existing Google Drive-like treatment.
     Present the ordinary nested folder hierarchy. Keep the existing file-card
     treatment, reduce file items to folder-like icons, or use List.
   - **Collections:** mount the reusable pill-navigation module in place of the
     filename/breadcrumb header content. Present only the first level as collection
     headings over a Capture-like card surface.
2. In Collections, show pinned collections at the top of content and
   omit those pinned collections from navigation.
3. Choose folder-open behavior: preview contents in place or open the folder in
   a new tab by default.
4. Apply the display grammar fixed for that presentation rather than exposing a
   cross-product of every display mode.

The model is conditional: later controls appear only where the earlier choice
makes them meaningful. It is not a recursive inheritance cascade.

The top-navigation module is also available to other bundles. It accepts module
short names as destinations and preserves each destination's own identity and
behavior. Its pills reuse tab font, radius, and padding, add borders, and sit in a
host header with increased top margin.

Collections can occupy one of those destinations beside another app. Inside the
Collections destination, the surface looks like Capture. Each heading either owns
a grid or a left-to-right, horizontally scrolling row using the general card
background language of the Issues Kanban. List is not a Collections fallback.

## Settings Entry and Persistence

- A vertical-ellipsis menu sits at the far right of the tab area.
- **Toggle Layout** switches between **Header Navigation** (`page_control`) and
  **Navigation Bar** (`navigation_top_bar`).
- **Show Thumbnails** / **Hide Thumbnails** changes preview visibility, using
  `magnification_large` and `pip_exit` respectively.
- In Collections, layout switches between heading grids (`view_column_2`) and
  horizontal heading rows (`split_screen`).
- In Collections, card/tile density switches between **Cozy** and **Compact**.
- **View Config** is the last item, reuses the JSON-file icon, and opens the owning
  view JSON in another tab.
- Files' List/Grid control sits at the upper-left of its item container.
- Changing a direct option updates the active presentation immediately.
- The selected configuration persists as JSON in the owning view capsule through
  the same update mechanism used by the existing sliders.
- Advanced or uncommon configuration is performed directly in that JSON, either
  manually or with assistant help.
- This is view-scoped configuration, not configuration inherited by folders or
  files.
- The exact JSON path, field names, validation contract, and atomic-write behavior
  remain implementation facts to verify from current code.

## File Presentation Routing

Files and Collections select the same semantic presenters by default; Code Editor
supplies the raw-source alternative.

| File target | Files default | Raw alternative |
|---|---|---|
| Markdown | Rendered Markdown; Edit transforms the same tab into raw editing with a Save/Cancel banner | Code Editor |
| `doc.md` | Docs | Code Editor |
| Image | Image viewer | Code Editor when a raw representation is meaningful |
| HTML | Webpage in an iframe | Code Editor |
| Spreadsheet | Sheets | Code Editor when a raw representation is meaningful |

Presenter choice is not resource identity. Opening the same target through Files
or Code Editor must not create two conflicting notions of which file it is. The
exact `presenterId + targetKey` contracts and find-or-open behavior remain for a
later coordination pass with the tab-placement work.

For Markdown, raw editing is also a transient state of the current Files tab:

1. Open the Markdown target rendered.
2. Activate Edit.
3. Replace the rendered body with raw editing in the same tab.
4. Show a Save/Cancel banner for the duration of that edit state.
5. On Save, write the file and return to rendered mode in the same tab.
6. On Cancel, discard changes made during that edit session and return to rendered
   mode in the same tab.

The underlying raw editor is shared with Code Editor. Code Editor uses its
real-time editing behavior; Files supplies the bounded Save/Cancel host policy.
This keeps one raw Markdown editing paradigm while making the Files Markdown and
Docs experiences visibly distinct.

## Creation and Profile Logic

Create New is a conditional presentation bias shared by Files and Collections:

1. Choose the creation affordance.
   - A dropdown exposing all supported creation types.
   - A dropdown exposing a curated subset.
   - A single named action for the configuration's primary type.
2. Choose the advertised types and vocabulary.
   - Examples include Docs, Sheets, Page, and Slides.
   - A rendered Markdown creator may be labeled **New Note** rather than exposing
     implementation-oriented Markdown language.
3. Apply the choice only to creation discoverability.
   - Do not disable semantic presenters for types omitted from the menu.
   - Dropped, imported, or otherwise introduced supported files continue to open
     normally.

This enables configurations such as:

| Profile idea | Advertised creation | Content still accepted |
|---|---|---|
| Notes | New Note / rendered Markdown | Documents, images, HTML, sheets, and every other supported type |
| Office Suite | Docs, Sheets, Page, Slides | Markdown and code remain supported when introduced, alongside other supported types |

These profiles and surface biases change layout and vocabulary, not the
underlying content system.

## Collection and Folder Semantics

- Collections are a first-level presentation construct.
- Files presents the ordinary nested folder tree rather than collection headings.
- Files uses its existing file-card treatment by default, with folder-like icons
  and List as its two alternate item displays.
- Collections uses either grids beneath its headings or left-to-right rows with
  horizontal overflow scrolling and Kanban-like card backgrounds. It does not use
  List as its fallback.
- Card/tile size is a two-state **Cozy** or **Compact** density choice.
- A collection may contain ordinary folders.
- A folder opened into a full tab displays ordinary folders and files, not a
  recursive layer of collections.
- An item selected inside a folder preview opens in a new tab.
- The ordinary filesystem hierarchy remains authoritative underneath every
  presentation, so changing layouts does not restructure or reinterpret nesting.
- A fully flat, Google Keep-like use case is the baseline; nesting is supported
  without forcing the collection metaphor deeper into the tree.

## Open Configuration Branches

- Final user-facing labels for Files' two left-navigation options.
- Exact header heights, top margin, pill overflow, side-nav width, responsive
  behavior, and color tokens.
- Whether folder preview versus direct open is global, layout-specific, or chosen
  per interaction.
- The default top-level structure and the visual language for collection headers.
- Exact grid breakpoints, horizontal-row scroll affordance, and thumbnail
  generation/fallback rules in Collections.
- Exact icon-mode density and metadata visibility in Files.
- Exact columns, metadata density, and responsive behavior for Files List.
- Exact extension/type recognition, default behavior for unknown types, and the
  containment contract for HTML iframe presentation.
- Markdown dirty indication plus tab-close, navigation-away, and external-file
  change behavior while the bounded raw editor is active.
- Whether Pins, Starred, Archive, Trash, and other filters appear persistently in
  navigation or only through universal-search dropdowns.
- Exact divider placement and state-dependent wording within the ellipsis menu.
- Exact Create New control shapes, creation type inventory, file extensions, and
  final user-facing names for Note, Page, Docs, Sheets, and Slides.
