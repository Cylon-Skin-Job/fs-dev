# Files, Editing, and Design Inheritance — Issues

> This document contains verified actionable problems or contradictions, not
> exploratory questions or unverified concerns.

## Verified Issues

### I-001 — Current rendered Markdown has no editable block/source mapping

- **Evidence:** `fusion-studio-client/src/components/CodeView.tsx`; `fusion-studio-client/src/components/capture/FilePageView.tsx`; `fusion-studio-client/src/components/wiki/PageViewer.tsx`; `fusion-studio-client/src/lib/transforms/markdown.ts`
- **Status:** open
- **Source:** CAP-034

Capture's current file page sends Markdown through `CodeView`, while Wiki's
`PageViewer` sends the parsed `PAGE.md` body through `markdownToHtml`. Both convert
the body to one HTML string and mount it under a `dangerouslySetInnerHTML`
container. The rendered elements do not carry stable Markdown node identity or
authoritative source ranges. Fusion also configures `marked` with `breaks: true`,
so physical newlines may affect rendered output even inside a paragraph.

A block-edit feature therefore cannot safely mutate source by treating whichever
HTML element received a right-click as an independently replaceable source line.
It needs a parsed Markdown/editor model with node selection and serialization, or
another source-position-preserving block representation.

### I-002 — Current Office persists substantial non-Markdown presentation state

- **Evidence:** `fusion-studio-client/src/lib/front-matter.ts`; `fusion-studio-client/src/components/office/officeTableDisplay.ts`; `fusion-studio-client/src/components/office/officeTableGeometry.ts`; `fusion-studio-client/src/components/office/officeTableTitleCodec.ts`; `fusion-studio-client/src/components/office/OfficeDocumentToolbar.tsx`; `../009-Office-Editor-Temp/GUIDANCE.md`
- **Status:** superseded
- **Source:** CAP-036

Current Office behavior includes page font/size/alignment/margins and table width,
color, overflow, title-row, border, and alignment state. Much of that state is
stored in frontmatter collections such as `metadata.tables`,
`metadata.tableColors`, and `metadata.tableStyles`, or reconstructed through
special codecs and output descriptors rather than ordinary Markdown syntax.

The original issue incorrectly treated these abilities as a removal and migration
surface. D-027 establishes that Office and its existing documents retain them.
They remain relevant only as a boundary inventory: these mechanisms are not part
of the pure-Markdown subset reused by Files.
