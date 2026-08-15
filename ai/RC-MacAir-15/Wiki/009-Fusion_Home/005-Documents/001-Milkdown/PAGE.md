---
name: Milkdown
description: The Markdown/ProseMirror engine underneath the Office document editor. Covers the schema, the editable content DOM contract, and why all Office adornments must live outside the editable cells. Stub - planned for deep build-out.
metadata:
  incoming-edges:
    - Documents
  outgoing-edges:
    - Documents
    - Lessons
  source-files:
    - fusion-studio-client/src/components/office/useCrepeEditor.ts
    - fusion-studio-client/src/components/office/officeTableNodeView.ts
  connected-skills: []
  related-trigger-files: []
---

> **Stub.** This page is a breadcrumb. Deep content is pending a dedicated
> build pass.

Milkdown is the Markdown editing engine that powers the Office document editor.
Under the hood it is a **ProseMirror** editor with a Markdown-shaped schema.

## The One Rule That Matters

ProseMirror owns the editable content DOM (the `<td>`/`<th>` cells inside a
table's `<tbody>`, and the editable prose elsewhere). Writing anything onto that
content DOM — an inline style, a class, a data attribute — makes ProseMirror
re-render the node (discarding the write) and collapse the selection to the
document end. Every "clicks don't work / caret jumps to the bottom / color won't
stick" bug in the Office editor traced back to this.

This is why Office adornments never touch cells and instead write only to
**table chrome** (`<table>`, `<colgroup>`) or work entirely outside the editor
through a body-level overlay or an injected stylesheet. See
[Documents](../PAGE.md) for the full mechanics and
[Lessons](../../000-Fusion_Home/001-Lessons/PAGE.md) for the traps.

## Schema And The Table Node View

Office keeps Milkdown's table **schema and row/column commands** but replaces
the table **rendering** with a custom node view
(`officeTableNodeView.ts`) that bakes in a `<colgroup>` and ignores attribute
mutations, so the geometry/color layers can write to chrome without triggering a
rebuild loop. Detail belongs in the build-out of this page.
