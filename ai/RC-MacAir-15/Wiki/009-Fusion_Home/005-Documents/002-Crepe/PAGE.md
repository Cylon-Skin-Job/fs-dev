---
name: Crepe
description: The Crepe wrapper around Milkdown used by the Office document editor. Covers which features Office enables/disables, theming, and the editor composition that mounts Office-owned controllers. Stub - planned for deep build-out.
metadata:
  incoming-edges:
    - Documents
  outgoing-edges:
    - Documents
    - Milkdown
  source-files:
    - fusion-studio-client/src/components/office/useCrepeEditor.ts
    - fusion-studio-client/src/components/office/OfficeDocumentPage.css
  connected-skills: []
  related-trigger-files: []
---

> **Stub.** This page is a breadcrumb. Deep content is pending a dedicated
> build pass.

Crepe is the wrapper layer around [Milkdown](../001-Milkdown/PAGE.md) that the
Office document editor uses. `useCrepeEditor.ts` creates the Crepe instance and
installs the Office-owned controllers around it.

## Features Office Disables

Office intentionally removes **CodeMirror**, **LaTeX**, the stock block-edit
handle, and Crepe's stock table feature. Backticks are treated as normal visible
text rather than rendered inline code, because Office is an authoring surface,
not a raw-Markdown surface. Users who want raw Markdown behavior should use
Capture or File Explorer.

## Theming Trap

Crepe's dark theme colors the ProseMirror **virtual caret** light, which is
invisible on Office's fixed-light paper. The fix sets
`--prosemirror-virtual-cursor-color` on
`.rv-office-document-editor .milkdown .ProseMirror` at a higher specificity than
`.ProseMirror-focused` so the override wins. See
[Lessons](../../000-Fusion_Home/001-Lessons/PAGE.md).

## Controllers Mounted Per Editor

Office installs its own insert menu, color popover, table colors, table context
menu, table geometry, and custom table node view around Crepe. The full list and
composition belong in the build-out of this page; see
[Documents](../PAGE.md) for the current summary.
