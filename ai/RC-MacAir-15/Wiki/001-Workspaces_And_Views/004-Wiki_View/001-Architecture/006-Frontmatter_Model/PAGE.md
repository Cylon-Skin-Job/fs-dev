---
name: Markdown Frontmatter Model
description: System-wide Markdown frontmatter contract for display names, descriptions, retrieval metadata, and renderer-owned settings.
metadata:
  incoming-edges:
    - Wiki
    - Wiki Architecture
    - Wiki Interface
    - Wiki System
  outgoing-edges: []
  source-files:
    - fusion-studio-client/src/lib/front-matter.ts
    - fusion-studio-client/src/lib/wiki-frontmatter.ts
    - fusion-studio-client/src/components/wiki/PageViewer.tsx
    - fusion-studio-client/src/components/office/OfficeDocumentPage.tsx
    - fusion-studio-client/src/components/office/officeTableGeometry.ts
  connected-skills:
    - customize-opencode
  related-trigger-files: []
---

Fusion Studio Markdown frontmatter adopts the same delimiter paradigm as OpenCode skills. The envelope is system-wide: Wiki pages, READMEs, skill documents, Office documents, and other searchable Markdown documents should use `name`, `description`, and `metadata`.

Wiki rendering normalizes a known subset of `metadata` for edge display. Other domains can store structured metadata under the same object.

## Shape

```markdown
---
name: Runtime Model
description: Explains how chat runtime state moves through the client and server. Use this page when changing runtime ownership, message flow, or state synchronization.
metadata:
  incoming-edges:
    - Chat
  outgoing-edges:
    - Rendering Model
    - State Model
  source-files:
    - fusion-studio-client/src/state/wikiStore.ts
  connected-skills:
    - js-conventions
  related-trigger-files: []
  display:
    font:
      family: serif
      size: 16
    alignment: left
    margins:
      top: 72
      bottom: 72
      left: 90
      right: 90
  tables:
    - tableIndex: 0
      fingerprint: header-hash
      columns: [180, 260, 140]
      rows: [42, 64, 42]
---

Markdown content starts here.
```

## Display Contract

- `name` renders as the article name at the top of the page.
- `description` renders beneath the name.
- A separator line divides the description from the Markdown body.
- Wiki renders known `metadata` edge fields at the bottom under relationship headings.
- Office/Email preserve the entire envelope while updating `metadata.display`.
- Office preserves Markdown table content and stores renderer-owned row/column geometry in `metadata.tables`.

## Metadata Sections

- **Incoming Edges:** Pages, concepts, or resources that point into this page.
- **Outgoing Edges:** Pages, concepts, or resources this page points toward.
- **Source Files:** Code files whose edits may require this page to change.
- **Connected Skills:** Skills whose edits may require this page to change, or skills this page explains.
- **Related Trigger Files:** Trigger/hook files whose edits may require this page to change.
- **Display:** Office/Email document display settings such as font, alignment, and margins.
- **Tables:** Office table display metadata such as column widths and row heights. The current Office shape uses `tableIndex`, `fingerprint`, `columns`, and `rows`.

Renderer-owned Markdown settings belong under `metadata` unless there is a strong reason for a separate top-level field. Office and Email document display settings use `metadata.display`.

## Future Use

The metadata graph should support deterministic retrieval and tickets. When a source file, skill, trigger, or wiki page changes, tooling can query metadata and file update tickets for affected wiki pages. When a user or AI needs to find an Office document, README, or skill, `name`, `description`, and structured `metadata` provide the first retrieval pass before body-text search.
