---
name: Wiki Frontmatter Model
description: Contract for wiki page frontmatter, including article display fields and relationship metadata for future deterministic update tooling.
metadata:
  incoming-edges:
    - Wiki
    - Wiki Architecture
    - Wiki Interface
    - Wiki System
  outgoing-edges: []
  source-files:
    - fusion-studio-client/src/lib/wiki-frontmatter.ts
    - fusion-studio-client/src/components/wiki/PageViewer.tsx
  connected-skills:
    - customize-opencode
  related-trigger-files: []
---

Wiki frontmatter adopts the same delimiter paradigm as OpenCode skills.

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
---

Markdown content starts here.
```

## Display Contract

- `name` renders as the article name at the top of the page.
- `description` renders beneath the name.
- A separator line divides the description from the Markdown body.
- `metadata` renders at the bottom under relationship headings.

## Metadata Sections

- **Incoming Edges:** Pages, concepts, or resources that point into this page.
- **Outgoing Edges:** Pages, concepts, or resources this page points toward.
- **Source Files:** Code files whose edits may require this page to change.
- **Connected Skills:** Skills whose edits may require this page to change, or skills this page explains.
- **Related Trigger Files:** Trigger/hook files whose edits may require this page to change.

## Future Use

The metadata graph should support deterministic tickets. When a source file, skill, trigger, or wiki page changes, tooling can query metadata and file update tickets for affected wiki pages.
