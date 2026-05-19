# Phase 4 — Inline-Style Extraction

**Roadmap phase:** 4 (table) / "Phase 3" in the roadmap body — same phase  
**Baseline commit:** `43c9a37` (phase 3 regression fix — file-viewer layout.css)  
**Goal:** zero `style={{}}` in JSX except for CSS custom-property injections that have no static equivalent  
**Prerequisite gate:** `--space-*` tokens — confirmed present in both repos (`variables.css` lines 79–85) ✅

---

## Research Summary

**Total occurrences found:** 58 across 30 files  
**Already compliant (CSS custom-property pattern):** 3 — no action  
**Legitimate exception (passthrough prop API):** 1 — annotate only  
**Disconnected calendar code (skip):** 2  
**Actionable:** 52 across 28 files

### Classification key

| Code | Meaning | Resolution |
|---|---|---|
| **S** | Static — pure constant value | Extract to CSS class rule |
| **D** | Dynamic value — derived from state/props | Replace with CSS custom-property on element; CSS rule consumes via `var()` |
| **M** | Mixed — static layout + one or more dynamic values | Extract static parts to CSS class; inject dynamic parts as CSS custom properties |
| **P** | Popup position — `position: fixed` with computed coords | `--popup-left` / `--popup-bottom` CSS vars on element; CSS class handles `position: fixed` |
| **✅** | Already correct CSS var pattern | No action |
| **⛔** | Legitimate exception | Add `/* FIXED: reason */` comment, no code change |

---

## Full Inventory by Chunk

### Chunk 4.1 — Top offenders (23 occurrences, 5 files)

| File | Line(s) | Code | What it is | Action |
|---|---|---|---|---|
| `ToolCallBlock.tsx` | 55 | S | `marginBottom: '12px'` on wrapper div | Add `margin-bottom: var(--space-md, 12px)` to `.rv-tool-fade-in` in CSS |
| `ToolCallBlock.tsx` | 60–71 | M | Button layout (display, flex, gap, padding, border, bg, cursor, font, opacity) + dynamic `color: labelColor` and conditional `cursor` | New `.rv-tool-header-btn` class for all static parts; inject `style={{ '--tool-label-color': labelColor }}`; CSS: `color: var(--tool-label-color)` |
| `ToolCallBlock.tsx` | 76 | D | `fontSize: ${visual.iconSize}px, color: iconColor` | `style={{ '--tool-icon-size': `${visual.iconSize}px`, '--tool-icon-color': iconColor }}`; CSS on `.material-symbols-outlined` child |
| `ToolCallBlock.tsx` | 83 | M | `fontSize: '13px'` (static) + `fontStyle: visual.labelStyle` (dynamic) | `fontSize` → class; `style={{ '--tool-label-style': visual.labelStyle }}`; CSS: `font-style: var(--tool-label-style)` |
| `ToolCallBlock.tsx` | 89–95 | M | Arrow icon: `fontSize`, `verticalAlign`, `marginLeft` static; `transform` toggles on `expanded`; `transition` uses `effectiveCollapse` | Static parts → new `.rv-tool-arrow-icon` class; `transform` → `data-expanded` attr + CSS `[data-expanded="true"]` selector; inject `style={{ '--tool-collapse-ms': effectiveCollapse }}` |
| `ToolCallBlock.tsx` | 106–118 | M | Content area: `marginLeft: '24px'` static; `maxHeight`, `opacity`, `transition` driven by `expanded` + `effectiveCollapse`; optional `borderLeft` from `visual.borderLeft` | New `.rv-tool-content-area` class (marginLeft, overflow: hidden); `style={{ '--tool-collapse-ms': effectiveCollapse, '--tool-border-left': visual.borderLeft?.width, '--tool-border-color': visual.borderLeft?.color }}`; CSS vars drive max-height/opacity via `data-expanded` attr |
| `ToolCallBlock.tsx` | 121–125 | M | `padding: '8px 0'` (static) + `fontSize: '13px'` (static) + `color: visual.contentColor` (dynamic) | New `.rv-tool-content-body` class for static; `style={{ '--tool-content-color': visual.contentColor }}`; CSS: `color: var(--tool-content-color)` |
| `EmojiTrigger.tsx` | 363 | S | `padding: '4px', width: '580px'` on picker container | New `.rv-emoji-picker-panel` CSS class |
| `EmojiTrigger.tsx` | 365 | S | `marginBottom: '12px'` on category block | New `.rv-emoji-category-block` CSS class |
| `EmojiTrigger.tsx` | 367–369 | S | `fontSize: '10px', textTransform: 'uppercase', ...` on category label | New `.rv-emoji-category-label` CSS class |
| `EmojiTrigger.tsx` | 380–382 | S | `display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '2px'` on emoji grid | New `.rv-emoji-grid` CSS class |
| `EmojiTrigger.tsx` | 392–394 | S | `display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', ...` on emoji button | New `.rv-emoji-item` CSS class |
| `ThemeDetail.tsx` | 27 | D | `background: s.hex` on swatch dot (iterating) | `style={{ '--swatch-hex': s.hex }}`; CSS on `.rv-fusion-color-swatch` → `background: var(--swatch-hex)` |
| `ThemeDetail.tsx` | 34 | D | `background: value` on current-color dot | `style={{ '--current-color': value }}`; CSS on `.rv-fusion-color-current-dot` → `background: var(--current-color)` |
| `ThemeDetail.tsx` | 76 | D | `color: theme.primary_color` | `style={{ '--theme-primary-preview': theme.primary_color }}`; CSS → `color: var(--theme-primary-preview)` |
| `ThemeDetail.tsx` | 83 | S | `marginTop: '24px'` on picker label | Add `margin-top: var(--space-xl, 24px)` to `.rv-fusion-color-picker-label` CSS rule |
| `ThemeDetail.tsx` | 164 | S | `marginTop: '16px'` on detail body | Add `margin-top: var(--space-lg, 16px)` to `.rv-fusion-detail-body` CSS rule |
| `FolderNode.tsx` | 122 | D | `paddingLeft` — computed `${0.75 + depth * 1.25}rem` | `style={{ '--tree-indent': paddingLeft }}`; CSS on `.rv-file-tree-item` → `padding-left: var(--tree-indent)` |
| `FolderNode.tsx` | 138 | D | Same depth calc for empty-folder row | Same `--tree-indent` var (compute `${0.75 + (depth + 1) * 1.25}rem`) |
| `FolderNode.tsx` | 139 | S | `color: 'var(--text-dim)', fontSize: 'var(--file-tree-font-size, 0.85rem)'` — already uses vars | New `.rv-file-tree-empty-label` CSS class using those same vars |
| `KittVisualizer.tsx` | 10 | D | `height: ${barHeight(audioLevel * 0.8)}px` | `style={{ '--kitt-bar-h': `${barHeight(audioLevel * 0.8)}px` }}`; CSS → `height: var(--kitt-bar-h)` |
| `KittVisualizer.tsx` | 11 | D | `height: ${barHeight(audioLevel)}px` | Same pattern (`--kitt-bar-h-mid`) |
| `KittVisualizer.tsx` | 12 | D | `height: ${barHeight(audioLevel * 0.6)}px` | Same pattern (`--kitt-bar-h-min`) |

**New CSS rules needed (Chunk 4.1):**
- `.rv-tool-fade-in` — add `margin-bottom` (existing rule in `ai/settings/views.css` or `App.css`)
- `.rv-tool-header-btn` — new rule
- `.rv-tool-arrow-icon` — new rule, with `[data-expanded="true"]` variant
- `.rv-tool-content-area` — new rule
- `.rv-tool-content-body` — new rule
- `.rv-emoji-picker-panel`, `.rv-emoji-category-block`, `.rv-emoji-category-label`, `.rv-emoji-grid`, `.rv-emoji-item` — new rules in `App.css` or a new `emojis/EmojiTrigger.css`
- `.rv-fusion-color-picker-label`, `.rv-fusion-detail-body` — add `margin-top` to existing rules in `fusion.css`
- `.rv-file-tree-item` — add `padding-left: var(--tree-indent)` (remove from existing inline; confirm rule exists)
- `.rv-file-tree-empty-label` — new rule
- `.rv-voice-recorder__kitt-bar` — confirm existing rule; add `height: var(--kitt-bar-h)` (remove conflicting static height if any)

**CSS file targets:** locate via `grep -r "rv-tool-fade-in\|rv-emoji\|rv-fusion-color-picker-label\|rv-fusion-detail-body\|rv-file-tree-item\|rv-voice-recorder" fusion-studio-client/src ai/settings`

---

### Chunk 4.2 — Mid offenders (20 occurrences, 10 files)

| File | Line(s) | Code | What it is | Action |
|---|---|---|---|---|
| `HoverIconModalParts.tsx` | 69–73 | P | `position: fixed, left: position.left, bottom: position.bottom` | New `.rv-hover-icon-modal-positioner` class with `position: fixed`; `style={{ '--modal-left': position.left, '--modal-bottom': position.bottom }}`; CSS: `left: var(--modal-left); bottom: var(--modal-bottom)` |
| `HoverIconModalParts.tsx` | 220–224 | P | Same fixed-position pattern | Same treatment (same component, second usage) |
| `CLIDetail.tsx` | 35 | S | `marginTop: '12px'` | Add `margin-top: var(--space-md, 12px)` to `.rv-fusion-detail-meta-item` CSS rule |
| `CLIDetail.tsx` | 44 | S | `marginTop: '4px'` | Same rule with `:nth-child` or add sibling class `.rv-fusion-detail-meta-item--tight` |
| `ChatArea.tsx` | 424 | S | `position: 'relative'` on `.rv-chat-messages` | Add `position: relative` to `.rv-chat-messages` CSS rule |
| `ChatArea.tsx` | 488 | D | `width: ${Math.min(contextUsage * 100, 100)}%` on context bar fill | `style={{ '--ctx-fill': `${Math.min(contextUsage * 100, 100)}%` }}`; CSS on fill element → `width: var(--ctx-fill)` |
| `FileTree.tsx` | 12 | D | `paddingLeft: ${0.75 + depth * 1.25}rem` | Same `--tree-indent` pattern as FolderNode |
| `FileTree.tsx` | 13 | S | `color: 'var(--text-dim)', fontSize: 'var(--file-tree-font-size, 0.85rem)'` | Same `.rv-file-tree-empty-label` class from Chunk 4.1 |
| `FolderPicker.tsx` | 113 | D | `paddingLeft` (same depth formula) | Same `--tree-indent` CSS var |
| `FolderPicker.tsx` | 140 | D | Same for nested empty state | Same `--tree-indent` |
| `PromptCardView.tsx` | 152 | S | `height: '8px'` spacer div | New `.rv-wf-step-spacer` class: `height: 8px` |
| `PromptCardView.tsx` | 171 | ✅ | `style={{ '--agent-color': agentColor }}` — already CSS var pattern | No action |
| `Icon.tsx` | 47, 62 | ⛔ | `{...style, ...}` — passes caller's `style` prop through | Add `/* FIXED: passthrough style prop API */` comment; no code change |
| `ThreadJumpDropdown.tsx` | 125–130 | M | `display: flex, alignItems, justifyContent` static + `...resolveCliAccent(...)` spread (dynamic CSS vars) | New `.rv-thread-jump-row` class for static layout; keep `style={resolveCliAccent(t.entry?.harnessId)}` only |
| `ThreadJumpDropdown.tsx` | 145 | S | `background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px'` on ⋮ button | Add static resets to existing `.rv-thread-menu-btn` CSS rule |
| `TicketBoard.tsx` | 73 | S | `position: 'relative'` on `.rv-ticket-detail` | Add `position: relative` to `.rv-ticket-detail` CSS rule |
| `TicketBoard.tsx` | 155 | S | `color: 'var(--text-dim)'` loading span | New `.rv-ticket-loading-dim` class or add to existing loading rule |
| `ContentArea.tsx` | 51 | S | `color: 'var(--text-bright)', marginBottom: '16px'` | New `.rv-content-placeholder-heading` class |
| `ContentArea.tsx` | 54 | S | `color: 'var(--text-dim)'` | New `.rv-content-placeholder-body` class |

---

### Chunk 4.3 — Long tail (12 occurrences, 12 files)

| File | Line(s) | Code | What it is | Action |
|---|---|---|---|---|
| `FileNode.tsx` | 32 | D | `paddingLeft` — same depth formula | Same `--tree-indent` CSS var (consistent with FolderNode/FileTree/FolderPicker) |
| `FileViewer.tsx` | 211 | S | `marginLeft: 'auto'` on last info-item | Add `.rv-file-viewer-info-spacer` class (or `margin-left: auto` modifier on the element) |
| `FileExplorer.tsx` | 52 | S | `color: 'var(--text-dim)'` loading span | New `.rv-dim-label` utility class or add to existing loading rule |
| `WorkspaceCarousel.tsx` | 27 | D | `transform: translateX(${-activeIndex * 100}vw)` | `style={{ '--carousel-offset': `${-activeIndex * 100}vw` }}`; CSS → `transform: translateX(var(--carousel-offset))` |
| `DocumentTile.tsx` | 76 | S | `width: '100%', height: '100%', objectFit: 'cover'` on `<img>` | New `.rv-document-tile-img` class |
| `OfficeDocumentTile.tsx` | 93 | D | `transform: scale(${scale})` | `style={{ '--tile-scale': scale }}`; CSS → `transform: scale(var(--tile-scale, 1))` |
| `OfficeDocumentPage.tsx` | 900 | ✅ | `style={{ '--editor-zoom': zoom, ... }}` — already CSS var pattern | No action |
| `RuntimeModule.tsx` | 55 | S | `width: '100%', height: '100%', overflow: 'auto'` on iframe/embed | New `.rv-runtime-module-frame` class |
| `WikiExplorer.tsx` | 76 | S | `color: 'var(--text-dim)'` loading span | Same `.rv-dim-label` utility class (reuse from FileExplorer) |
| `AgentTiles.tsx` | 246 | S | Multi-prop on placeholder div: `color: var(--text-dim), fontSize, fontStyle, padding` | New `.rv-agent-tiles-placeholder` class |
| `ClipboardPopover.tsx` | 103 | P | `position: fixed, left: position.left, bottom: position.bottom` | Same pattern as HoverIconModalParts: `style={{ '--popup-left': position.left, '--popup-bottom': position.bottom }}`; `.rv-clipboard-bubble` CSS gets `position: fixed; left: var(--popup-left); bottom: var(--popup-bottom)` |
| `PageViewer.tsx` | 196 | S | `color: 'var(--text-dim)'` placeholder | Same `.rv-dim-label` utility class |
| `Sidebar.tsx` | 401 | S | Multi-prop on rename input: width, padding, fontSize, border, borderRadius, background, color (all via vars or static) | New `.rv-thread-rename-input` CSS class |

**Shared utility class introduced in 4.3:** `.rv-dim-label` — `color: var(--text-dim)` — applies in FileExplorer, WikiExplorer, PageViewer, and possibly TicketBoard loading span (confirm at execution time; replace `.rv-ticket-loading-dim` with the shared class if appropriate).

---

## Skipped Items

| File | Line | Reason |
|---|---|---|
| `calendar/CalendarListView.tsx` | 55 | Calendar disconnected from compilation |
| `calendar/EventBar.tsx` | 25 | Calendar disconnected; also already uses CSS var pattern `--event-color` |

---

## New CSS needed — where to put it

| Rule(s) | File |
|---|---|
| `.rv-tool-*` (5 new rules) | `ai/settings/views.css` — tool-call section |
| `.rv-emoji-*` (5 new rules) | New `fusion-studio-client/src/emojis/EmojiTrigger.css` (imported by `EmojiTrigger.tsx`) |
| `.rv-file-tree-empty-label` | `ai/views/file-viewer/settings/layout.css`; mirror to `Fusion-Home` layout |
| `.rv-voice-recorder__kitt-bar` update | Existing mic CSS file (grep for the class) |
| `.rv-hover-icon-modal-positioner` | `ai/settings/views.css` — modal section |
| `.rv-wf-step-spacer`, `.rv-wf-*` | `ai/settings/views.css` — agents section |
| `.rv-thread-jump-row`, `.rv-thread-rename-input` | `ai/settings/views.css` — threads section |
| `.rv-content-placeholder-*` | `fusion-studio-client/src/components/App.css` — ContentArea section |
| `.rv-ticket-*` or `.rv-dim-label` | `ai/settings/views.css` — tickets section |
| `.rv-document-tile-img` | Existing tile CSS (check `DocumentTile` imports) |
| `.rv-runtime-module-frame` | `fusion-studio-client/src/components/App.css` |
| `.rv-dim-label` | `fusion-studio-client/src/styles/document.css` (utility; usable cross-component) |

**Mirror rule:** any new class added to `ai/settings/views.css` in fs-dev must be added to the matching section in `~/projects/Fusion-Home/ai/settings/views.css`.

---

## Execution checklist — same loop as prior phases

### Before each chunk

```bash
git status          # must be clean
git log -1 --oneline
```

### After each chunk

```bash
cd fusion-studio-client && npm run build
unset ELECTRON_RUN_AS_NODE && ~/projects/Fusion-Home/restart-fusion.sh
```

Visual check after each chunk:
- **4.1:** tool-call blocks (expand/collapse), emoji picker, theme detail swatches, file tree indentation, Kitt visualizer bars
- **4.2:** clipboard popover position, CLI detail panel, context bar fill, folder picker indentation, thread jump dropdown, ticket board
- **4.3:** workspace carousel, office doc tile scale, file viewer info row, agent placeholder, sidebar rename input

### Exit gate (after all three chunks)

```bash
# Should return zero results (excluding calendar and Icon.tsx passthrough)
rg 'style=\{\{' fusion-studio-client/src --type tsx \
  --ignore-case \
  | grep -v 'calendar/' \
  | grep -v 'Icon.tsx' \
  | grep -v "style=\{\{ '--"   # CSS var injections are ok
```

If any plain-value `style={{` remains, it's either:
- A missed occurrence → rename in the current chunk commit
- A newly introduced regression → revert and fix

---

## Deviations from roadmap

The roadmap's chunk 4.1 files (`ToolCallBlock`, `EmojiTrigger`, `ThemeDetail`, `FolderNode`, `KittVisualizer`) match exactly.

Chunk 4.2 deviates from "10 files with 2 occurrences each" — `PromptCardView` and `Icon` have entries that are already correct or legitimate exceptions, so the net actionable count is lower. The handoff execution agent should use this doc, not the roadmap body count, as the source of truth.

---

*Authored: 2026-05-18 | Baseline: `43c9a37`*
