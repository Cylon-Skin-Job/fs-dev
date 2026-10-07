---
name: Wiki Lessons
description: Lessons learned while stabilizing the wiki system, especially around sidebar behavior, page organization, and metadata.
metadata:
  source-files:
    - fusion-studio-client/src/components/wiki/EdgePanel.tsx
    - fusion-studio-client/src/state/wikiStore.ts
  last-modified: "2026-09-28T04:56:08Z"
---

## Lessons

- **One selected path was not enough.** The UI needs a left-selected context and a separately viewed page. Otherwise clicking a right-sidebar child changes the context and makes the sidebar disappear.
- **Active-state contrast matters.** Using the same accent color for background and text can make active labels disappear.
- **Separate fact from approved direction.** Source-backed current behavior, approved future behavior and open decisions may coexist when clearly labeled. Preserve displaced text in versions, not as contradictory live guidance.
- **Folder structure is product behavior.** Moving a page changes navigation, sidebar behavior, and future query results.
- **Path references must be searched before moving wiki pages.** Markdown links and docs may point to folder names even when code does not.
- **Root pages need a different behavior than article pages.** The wiki guide and section roots can be useful without a populated right sidebar.

## Traps To Avoid

- Do not add a separate navigation source when the folder tree already defines the wiki.
- Do not let right-sidebar clicks overwrite the left-selected article context.
- Do not keep duplicate root pages for the same concept after consolidating them into a tree.
- Do not add frontmatter that cannot be used by future tools.
