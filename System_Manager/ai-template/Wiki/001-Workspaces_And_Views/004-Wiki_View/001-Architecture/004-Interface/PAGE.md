---
name: Wiki Interface
description: User-facing wiki interface model, including the three-column layout, contextual right sidebar, rendered frontmatter, and read-only browsing behavior.
metadata:
  incoming-edges:
    - Wiki
    - Wiki Architecture
  outgoing-edges:
    - Wiki Frontmatter Model
    - Wiki Structure
  source-files:
    - fusion-studio-client/src/components/wiki/WikiExplorer.tsx
    - fusion-studio-client/src/components/wiki/TopicList.tsx
    - fusion-studio-client/src/components/wiki/PageViewer.tsx
    - fusion-studio-client/src/components/wiki/EdgePanel.tsx
    - fusion-studio-client/src/state/wikiStore.ts
  connected-skills: []
  related-trigger-files: []
---

The wiki interface is a three-column reader for folder-first `PAGE.md` content.

## Layout

```text
┌──────────────┬─────────────────────────────┬──────────────────┐
│ Topic List   │ PAGE.md rendered content    │ Context children │
│              │                             │                  │
│ Wiki Guide   │ Name                        │ Top article      │
│ Project      │ ----                        │ Child sections   │
│ Chat         │ Description                 │ Child articles   │
│ Wiki         │ ----                        │                  │
│ Browser      │ Markdown body               │                  │
│              │ ----                        │                  │
│              │ Metadata edge lists         │                  │
└──────────────┴─────────────────────────────┴──────────────────┘
```

## Sidebar Rules

- The left sidebar is the stable outline.
- Selecting the wiki guide shows the root guide and leaves the right sidebar empty.
- Selecting a heading folder shows that folder page and leaves the right sidebar empty.
- Selecting a top-level article folder populates the right sidebar with its children.
- Clicking inside the right sidebar changes the center page only.
- The left-selected top-level article remains highlighted while browsing its child pages.
- The active right-sidebar item follows the currently viewed page.

## Rendered Page Rules

- Frontmatter is parsed and removed from the Markdown body.
- `name` renders as the top article title.
- `description` renders beneath the title with a separator.
- Markdown body renders below the description.
- `metadata` renders at the bottom under deterministic relationship headings.

## Maintenance Rule

Keep interface behavior documented here in present tense. If the UI changes, update this page and the connected decisions or lessons page in the same pass.
