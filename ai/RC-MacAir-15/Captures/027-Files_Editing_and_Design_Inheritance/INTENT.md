# Files, Editing, and Design Inheritance — Intent

> This document records owner purpose and desired outcomes. It does not approve
> a particular architecture, migration sequence, or implementation.

## Purpose

Shape a coherent file-centered product model that can support code and rich
documents without trapping generally useful editing behavior inside Office.

## Desired Outcomes

- Establish one file-centered surface in which Capture-like note taking and
  Office-like word processing are produced by layout and arrangement rather than
  separate fundamental app identities.
- Establish **Code Editor** as a tab-loaded file-tree/editor module, replacing the
  File Explorer concept at the product-model level.
- Make Files open content through its semantic presenter by default while keeping
  Code Editor as the explicit raw-source path.
- Let rendered Markdown transition into an explicit raw edit state in place,
  guarded by visible Save and Cancel actions.
- Reuse one raw Markdown editor while allowing Code Editor to apply real-time
  editing and Files to apply an explicit bounded Save/Cancel workflow.
- Give the Files app a real home surface that participates in the universal
  sole-tab/multi-tab presentation instead of beginning as a generic Empty tab.
- Separate Files and Collections as distinct presentations over the same file
  capabilities: Files uses left navigation, while Collections uses top navigation.
- Make top pill navigation a reusable module that can replace the normal
  filename/breadcrumb header content for Collections and other bundled products.
- Reuse tab typography, radius, and padding for navigation pills, distinguishing
  them with borders and appropriate header spacing.
- Give Files two left-navigation options: the flatter split treatment and the
  existing Google Drive-like treatment.
- Make Files the ordinary nested-folder experience and Collections the
  heading-based top-level experience, without changing the hierarchy underneath.
- Keep item display simple: Collections uses either grids beneath headings or
  horizontally scrolling, Kanban-like rows, while Files keeps its existing card
  treatment plus folder-like icons and List.
- Expose common binary presentation changes directly: sidebar layout and
  thumbnail visibility in the ellipsis, with List/Grid on the content container.
- Make advanced configuration explicit by opening the owning JSON in a new tab
  through a final **View Config** menu item.
- Let users swap presentation choices live from the tab-area menu and preserve
  the result as view-owned JSON configuration.
- Let each Files configuration tailor the Create New affordance, type list, and
  vocabulary without narrowing which supported content the Files engine can open.
- Preserve a surface-specific Create New bias in both Files and Collections
  without turning that bias into a supported-format restriction.
- Allow familiar experiences such as Notes and Office Suite to be composed as
  configurations of one Files system instead of separate content silos.
- Unify Archive, Trash, Star, search, filtering, and related file operations so
  each appearance arranges the same capabilities instead of reimplementing them.
- Provide universal Files search with useful file metadata filters such as
  location, last modified, and starred state.
- Separate reusable live-edit and Undo/Redo capabilities from Office-specific
  document behavior.
- Preserve Office's complete feature set while extracting only its
  Markdown-native editor mechanisms for reuse.
- Reuse that pure-Markdown subset in Files through a block-scoped interaction,
  without importing Office-specific presentation behavior.
- Modularize editor capabilities so each host composes the modules it needs:
  Notes exposes the normal-Markdown subset, while Office adds its extensions.
- Reuse the normal-Markdown block editor to make rendered Wiki pages editable
  while preserving Wiki-owned page identity, navigation, and metadata display.
- Define a comprehensible if/then configuration model in which each selected
  presentation choice exposes only the relevant later choices.
- Fit the result into the ongoing Tabs, Chat, and Provenance work without
  collapsing their established identities or ownership boundaries.
- Let bundled products use module short names in the shared top-navigation
  language, including domains such as Solobooks and productivity suites.
- Allow Collections to appear as one peer destination beside other apps and give
  it a Capture-like surface with independently chosen navigation and layout.
- Let Collections switch card or tile density between **Cozy** and **Compact**.

## Constraints

- Keep the final encompassing name open: **Files**, **Files and Docs**, or another
  owner-selected label.
- Reuse the global sole-tab and multi-tab shell behavior already being built,
  including its JSON-backed state and tab behavior.
- Preserve the distinction between resource identity, presentation placement,
  editing history, and provenance.
- Presenter selection must not change the file's resource identity; rendered and
  raw views are presentations of the same target.
- Do not create a second Markdown editor merely to support Files' bounded edit
  workflow; the host supplies the persistence boundary.
- A formatting command reused by Files must serialize through the selected
  Markdown dialect. Office-only features remain available in Office but do not
  enter Files as hidden metadata or special cases.
- Capability availability is host composition, not destructive removal: making an
  Office extension unavailable in Notes must not delete or disable it in Office.
- Wiki editing uses the normal-Markdown composition and must not acquire
  Office-only capabilities as hidden metadata or special cases.
- Keep navigation location, navigation composition, filter exposure, and
  folder/file display mode in the presentation layer; they must not fork the
  underlying file-operation semantics.
- Preserve the ordinary folder hierarchy underneath collection presentation so
  switching layouts never requires restructuring user files.
- Treat creation-menu visibility as discoverability, not file-format permission
  or presenter support; imported or dropped supported content must still work.
- Reuse the existing slider-style JSON update path for live view customization;
  verify the exact owning file and schema from current code before planning.
- Treat direct UI controls as conveniences over view configuration; uncommon
  configuration remains editable manually or through an assistant.
- Do not turn this capture into product implementation, canonical Wiki changes,
  or a roadmap without separate authorization.

## Non-goals

- No source-code changes are authorized by this capture.
- No conclusion has been reached yet about supported file formats, the concrete
  fallback behavior for unsupported types, the concrete note-taking/word-processing
  layouts, exact split dimensions and colors,
  precise responsive display rules, the complete conditional option tree, or
  the final app name.
