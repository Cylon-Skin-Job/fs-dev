# Views

View folders define state, display attributes, and base-level behavior only. They do not contain user/work content.

Canonical shape:

```text
001-browser-viewer/
  manifest.md
  state/
    state.json
  styles/
    layout.css
    icon.md
```

Ordering and identity:

- Numeric prefixes such as `001-` control left-nav order.
- Prefixes are not displayed.
- The semantic view id is the folder name after the prefix, such as `doc-viewer`.

Content belongs in top-level data folders such as `Docs/`, `Wiki/`, `Issues/`, and `Chat/`.

Canonical default order:

```text
001-browser-viewer
002-doc-viewer
003-office-viewer
004-library-viewer
005-media-viewer
006-email-viewer
007-calendar-viewer
008-contacts-viewer
009-custom-viewer
010-file-viewer
011-issues-viewer
012-wiki-viewer
013-agents-viewer
```
