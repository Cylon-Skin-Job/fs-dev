# Chunk 8: Move Per-View Layout CSS to Correct Location

**Goal:** Move layout CSS from `open-robin-client/src/components/**/` to `ai/views/{viewer}/settings/layout.css`.

**Prerequisites:** Chunk 7 complete (tint rules extracted, per-view CSS now contains only layout).

**Working example:** `ai/views/file-viewer/settings/layout.css` already exists and loads correctly. Study it as the pattern.

**For each view, do the following:**

## 8a. Wiki Viewer

**Source:** `open-robin-client/src/components/wiki/wiki.css`
**Target:** `ai/views/wiki-viewer/settings/layout.css` (NEW)

1. Create the file `ai/views/wiki-viewer/settings/layout.css`
2. Copy all layout-only rules from `wiki.css`:
   - Grid/flex structure
   - Padding, margin
   - Width, height, position
   - Z-index, overflow
   - Any `display`, `flex-direction`, `gap`, `align-items`, `justify-content`
3. Do NOT copy color, border, or tint rules (those are now in `ai/settings/tints.css`)
4. Remove the `import './wiki.css'` from `open-robin-client/src/components/wiki/WikiExplorer.tsx`
5. Verify `useViewLayoutStyles('wiki-viewer')` is already called in `WikiExplorer.tsx`

## 8b. Tickets Viewer

**Source:** `open-robin-client/src/components/tickets/tickets.css`
**Target:** `ai/views/tickets-viewer/settings/layout.css` (NEW)

1. Create the folder: `mkdir -p ai/views/tickets-viewer/settings`
2. Create the file `ai/views/tickets-viewer/settings/layout.css`
3. Copy layout-only rules from `tickets.css`
4. Remove the `import './tickets.css'` from the Tickets component
5. Verify `useViewLayoutStyles('tickets-viewer')` is called in the Tickets component (add it if missing)

## 8c. Agents Viewer

**Source:** `open-robin-client/src/components/agents/agents.css`
**Target:** `ai/views/agents-viewer/settings/layout.css` (NEW)

1. Create the file `ai/views/agents-viewer/settings/layout.css`
2. Copy layout-only rules from `agents.css`
3. Remove the `import './agents.css'` from the Agents component
4. Verify `useViewLayoutStyles('agents-viewer')` is called (add it if missing)

## 8d. Doc Viewer (Tile Row + Capture)

**Source:** `open-robin-client/src/components/tile-row/tile-row.css` and `open-robin-client/src/components/capture/capture.css`
**Target:** `ai/views/doc-viewer/settings/layout.css` (NEW)

1. The folder `ai/views/doc-viewer/settings/` exists but has no `layout.css`
2. Create the file `ai/views/doc-viewer/settings/layout.css`
3. Copy layout-only rules from both `tile-row.css` and `capture.css`
4. Remove the CSS imports from the respective components
5. Verify `useViewLayoutStyles('doc-viewer')` is called (add it if missing)

**Smoke test per view:**
1. Navigate to each view
2. Verify layout renders correctly:
   - Columns are in the right places
   - Grids have the right number of columns
   - Padding and margins look correct
   - No elements are overlapping or mispositioned
3. Verify colors still render correctly (they come from global CSS in `ai/settings/`)
4. Verify toggle effects still work (they come from `ai/settings/tints.css`)

**Risk:** High per view. Layout breakage is immediately visible.

**Next chunk:** Chunk 9 — Final cleanup.
