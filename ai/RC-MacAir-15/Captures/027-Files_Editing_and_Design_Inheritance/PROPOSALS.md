# Files, Editing, and Design Inheritance — Proposals

> This document contains candidate actions or designs. A proposal is not approved
> unless an explicit owner decision says so.

## Candidate Proposals

### P-001 — Flat split-navigation appearance

- **Authority:** owner-originated candidate
- **Status:** accepted
- **Source:** CAP-010
- **Decision:** D-030

Provide a flatter alternate Files appearance with an offset-color navigation
region on the left and a solid-color content region on the right. Use roughly
20% of the width for the left region as an initial design reference. The intended
feel is closer to Apple's flat compositions than to the current Google Drive-like
surface. D-030 accepts it as one of Files' two left-navigation options; exact
width, responsive behavior, colors, density, and control placement remain to be
designed and tested.

### P-002 — Capture-style top-navigation appearance

- **Authority:** owner-originated candidate
- **Status:** accepted
- **Source:** CAP-015, CAP-047
- **Decision:** D-035

Provide a reusable pill-navigation module with no navigation region on the left.
When active, it occupies the header namespace normally used by filename,
breadcrumb, or similar identity content rather than adding a third row. Match the
tabs' font, radius, and padding; add a border around each navigation pill and let
the host provide additional top margin.

Collections uses this presentation, but it is a shared product language rather
than a Collections-only component. Bundled apps populate it with destination short
names, such as Invoices and Customers in Solobooks or Calendar and Email in a
productivity suite. Exact overflow and responsive behavior remain open.

### P-003 — Notes configuration profile

- **Authority:** owner-originated candidate
- **Status:** candidate
- **Source:** CAP-031

Configure a Files view to reproduce the focused Capture/Google Keep-like
experience and present it to the user as **Notes**. Its primary creation action can
be **New Note**, producing rendered Markdown, while dropped or imported documents,
images, HTML, sheets, and other supported types continue to work through their
normal presenters.

### P-004 — Office Suite configuration profile

- **Authority:** owner-originated candidate
- **Status:** candidate
- **Source:** CAP-032

Configure a Files view as an **Office Suite** that advertises Docs, Sheets, Page,
and Slides while omitting Markdown and code from its normal creation affordances.
Dropped HTML still opens as a Page, and dropped Markdown still appears through
its rendered presentation, such as an applicable card or thumbnail. The profile
hides complexity without disabling compatible content.

### P-005 — Block-scoped rendered Markdown editing

- **Authority:** owner-originated candidate informed by current code
- **Status:** accepted
- **Source:** CAP-034, CAP-037
- **Decision:** D-026

Allow the user to right-click a supported rendered Markdown block, show a dotted
outline around that logical block, and open a side menu containing block-scoped
formatting controls. H1–H6 changes the selected block's node type; commands such
as italic apply across the supported inline content of that block.

Implement the interaction on a shared Milkdown/ProseMirror editor core rather than
editing Capture's rendered HTML or inventing source ranges from DOM nodes. The
installed editor already supports structured transactions, headings, marks,
history, and block-edit primitives: Office currently disables Crepe BlockEdit,
while Email configures it with H1–H6. Files can supply the dotted selection and
side-menu interaction while retaining its bounded Save/Cancel host policy.

The accepted direction must explicitly define supported node types and fail closed
for unsupported structures. Lists, nested quotes, fenced code, tables, links, and
inline code require node-specific semantics rather than assuming every visible
chunk behaves like a paragraph. Every retained control must map to pure Markdown
syntax under D-027's reuse boundary; no Office-specific formatting exception is
permitted in Files. Office retains those abilities. See
I-001 for the current renderer gap.

### P-006 — Editable Wiki through the shared block editor

- **Authority:** owner-originated candidate informed by current code
- **Status:** accepted
- **Source:** CAP-041
- **Decision:** D-029

Let a rendered Wiki page invoke the same structured, block-scoped Markdown
editing interaction accepted in P-005. Supported Wiki blocks receive the dotted
selection treatment and normal-Markdown commands; edits operate on parsed editor
nodes rather than the rendered HTML.

Keep Wiki navigation, page identity, frontmatter-derived header and metadata
footer, and internal-link behavior owned by the Wiki host. Do not expose Office
extension modules in Wiki. The current `PageViewer` uses a static
`dangerouslySetInnerHTML` renderer, so this proposal depends on resolving I-001.
Whether Wiki uses bounded Save/Cancel or another explicit persistence policy is
still an owner choice.
