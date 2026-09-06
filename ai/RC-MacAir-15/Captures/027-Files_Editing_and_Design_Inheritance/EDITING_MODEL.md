# Files and Markdown Editing Model

> This is an analytical model derived from owner decisions and verified current
> code. `DECISIONS.md` governs target behavior; this document organizes the shared
> editor boundary, modular composition, host policies, block interaction, and
> Office-preservation boundary.

## Syntax Boundary

- The subset reused by Files supports only content abilities representable in the
  selected pure Markdown dialect.
- No reused Files feature may depend on presentation frontmatter, hidden metadata,
  DOM-only styling, non-Markdown node attributes, surrogate structures, or a
  feature-specific round-trip codec.
- “No special cases” applies to the shared core and Files block editing, not as a
  reduction of Office.
- Office retains its full feature set, including Office-owned metadata and codecs.
- The exact Markdown dialect remains open. GFM-style tables may qualify if the
  owner selects GFM, but custom table colors, widths, overflow, title-row markers,
  borders, and alignment remain Office-only rather than becoming shared Markdown
  features merely because Office preserves them.

## Shared Editor Core

Candidate reusable mechanisms include:

- Markdown parsing and serialization;
- the raw text editor surface;
- Markdown-native block and inline commands;
- structured selections and transactions;
- block decorations and command targeting;
- Undo/Redo and local edit history;
- dirty-state calculation and host callbacks; and
- validation that serialized output stays within the selected Markdown dialect.

Office-specific presentation controllers and metadata history remain in Office
and are not part of the shared core.

The composition model is:

```text
Normal Markdown modules
├── Code Editor: raw, real-time host policy
├── Notes / Files Markdown: rendered + bounded, block-scoped editing
├── Wiki: rendered, block-scoped editing; persistence policy open
└── Office / Docs: normal Markdown modules + Office extension modules
```

Capability gating occurs at composition time. A module unavailable to Notes is
still present and usable in Office.

## Host Policies

| Host | Default presentation | Editing boundary |
|---|---|---|
| Code Editor | Raw source | Real-time editing |
| Notes / Files Markdown | Rendered Markdown | Bounded editing; Save commits and Cancel discards; normal-Markdown modules only |
| Notes / Files block edit | Rendered document with one logical block selected | Uses the bounded session and makes normal-Markdown commands available for that block |
| Wiki | Rendered `PAGE.md` with Wiki-owned chrome and metadata | Uses the shared normal-Markdown block editor; exact persistence boundary remains open |
| Docs / `doc.md` | Office document presentation | Retains Office's complete feature set and Office-owned persistence behavior |

The hosts vary presentation and commit policy, not the underlying Markdown
language or resource identity.

## Block-Scoped Interaction

1. Right-click a supported logical Markdown node.
2. Select that node through the structured editor model.
3. Draw a dotted decoration around the selected block.
4. Open the block side menu.
5. Expose only commands valid for that node and representable in pure Markdown.
6. Apply each command through a structured transaction so Undo/Redo remains
   coherent.
7. Save or Cancel through the enclosing Files edit boundary.

H1–H6 changes a compatible block node type. Whole-block bold or italic applies a
Markdown mark across compatible inline content. Lists, quotes, code fences,
tables, links, and inline code require explicit node semantics; unsupported
commands remain unavailable rather than invoking a special conversion.

## Office Preservation Boundary

Current Office code contains non-Markdown presentation domains, including:

- page font family, font size, alignment, and margins;
- table widths and geometry;
- table cell/row/column colors;
- overflow modes;
- title-row markers and surrogate codecs;
- border width and color;
- table alignment and page-alignment flow; and
- presentation descriptors used for export fidelity.

These capabilities remain in Office and existing files remain valid. They define
what is *not extracted* into the shared pure-Markdown core; they are not a removal
or migration backlog. Their modules are simply unavailable to the Notes/rendered-
Markdown composition.

## Open Editing Semantics

- Select the exact Markdown dialect and extensions.
- Define the retained toolbar command inventory.
- Define the first supported block types and nested-selection rules.
- Decide whether block-scoped editing permits direct typing, formatting-only
  changes, or both.
- Define dirty indication and tab-close/navigation-away/external-change behavior.
- Decide whether Wiki adopts Files' bounded Save/Cancel session or another
  explicit persistence policy.
- Define the API boundary that lets Office retain its extensions while sharing
  Markdown-native primitives without leaking those extensions into Files.
- Define module manifests/dependencies and the host-level capability gate that
  keeps Office extensions unavailable in Notes.
