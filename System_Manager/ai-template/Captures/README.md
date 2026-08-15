# Captures

Workspace capture work product: captures, draft specs, todos, playground notes, assets, screenshots, and other document-like material displayed by document-oriented views.

This folder is data/work product. View layout and UI state belong under `Views/`.

Folders directly inside `Captures/` become tiled rows in `doc-viewer`.

This root-level `README.md` is documentation only. The server/doc-viewer should ignore it when building tiled rows.

Ordering and display rules:

- Prefix folders or files with `001-`, `002-`, etc. to control order.
- Numeric prefixes are not displayed.
- Underscores become spaces.
- Capitalization is preserved.

Example:

```text
001-Captures       -> Captures
002-Draft_Specs    -> Draft Specs
003-UI_Playground  -> UI Playground
```

Only files inside row folders become tiles. Root-level files directly under `Captures/` do not render as document tiles.
