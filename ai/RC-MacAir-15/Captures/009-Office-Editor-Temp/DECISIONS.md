# DECISIONS — Office Editor Design Decisions

## Session Scope: Requirements-Only
- **This session is requirements-gathering and wish-list creation only.**
- No implementation, no coding, no PRs.
- The wish list will feed a separate session for formal SPEC build-out and later implementation.
- Working files (CAPTURE.md, ISSUES.md, DECISIONS.md, ROADMAP.md) serve as the bridge between sessions.

## Checkpoint Workflow
- Orchestrator (IDE Claude) runs checkpoint sub-agent with CHECKPOINT_PROMPT.md
- Agent validates transcript against working files, reports back to orchestrator
- Orchestrator implements fixes, loops until clean
- Once clean, orchestrator writes CHECKPOINTS.md and clears TRANSCRIPT.md

## Custom Colors: Config File, Not Frontmatter
- Custom colors live in workspace-local config file: `ai/<machine>/System/config/colors.json`
- Removed from per-document frontmatter entirely
- Mirror of the existing CSS-scoop pattern where server reads from `ai/` folder

## Server is Sync Source of Truth
- Server owns the merged palette computation
- Union of all `custom_colors` from synced workspaces, deduplicated by hex value
- Merged palette written back to each synced workspace's config file
- Client toggles sync flag, server handles the merge

## Remove Per-Document Color Scraping
- Remove "Document colors" section from `officeColorPopover.tsx`
- Keep: None / Google palette / Custom colors (from config file)
- Existing frontmatter color metadata stays in documents (not stripped), just no longer scraped into picker

## Table Context Menu Restructure
- Right-click table context menu gets a top-level **Table** item (`table_edit` + chevron) at the top
- Table sub-menu contains: Header/Footer toggles, Border size/color, Table alignment (left/center/right), Overflow modes, and Remove table
- Delete table confirmation popup lives under Table > Remove table
- Overflow modes (previously standalone) nested under Table sub-menu
- "None" border color → light grey dotted lines (`1px dotted #ccc`)

## Column Resize: Internal vs Outer Border Behavior
- Dragging an **internal column border**: only the two adjacent columns are affected. One gains width, the other loses an equal amount. Table total width does NOT change.
- Dragging the **outer edge** (leftmost or rightmost border): only that outer column changes width. All other columns remain unchanged. Table width changes.
- Minimum column width enforced (e.g. 30px). Drag clamps if adjacent column would go below minimum.

## Overflow Mode Names (Final)
- **Overflow** — text flows to cell edge, clipped at boundary. No ellipsis. Maps to CSS `overflow: hidden; white-space: nowrap;`
- **Truncate** — text clipped at cell boundary with ellipsis ("…"). Maps to CSS `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
- **New line** — text wraps to new lines within cell. Cell height grows. Maps to CSS `white-space: normal; word-wrap: break-word;`
- Default for new tables: **Overflow**.

## Table Color Metadata Reindex
- Before re-render after row/column insert or delete, recalculate all color metadata indices
- Shift indices at or past the insert/delete point
- Dedicated `reindexTableColors()` utility in `front-matter.ts`
