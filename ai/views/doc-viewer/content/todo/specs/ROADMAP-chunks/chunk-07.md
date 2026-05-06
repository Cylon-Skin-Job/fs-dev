# Chunk 7: Create `ai/settings/tints.css`

**Goal:** Extract all tint rules from per-view CSS into a single global file using `body[data-tint-*]` selectors.

**Prerequisites:** Chunks 0-6 complete.

**Context:** Currently, tint rules are scattered across per-view CSS files and use `.rv-panel[data-tint-*]` selectors. They should be:
1. In a single global file: `ai/settings/tints.css`
2. Using `body[data-tint-*]` selectors (not `.rv-panel`)

**Step 1: Read all per-view CSS files and extract tint rules**

Read these files and find ALL rules containing `[data-tint-`:
- `open-robin-client/src/components/tickets/tickets.css`
- `open-robin-client/src/components/tile-row/tile-row.css`
- `open-robin-client/src/components/wiki/wiki.css`
- `open-robin-client/src/components/capture/capture.css`
- `ai/views/file-viewer/settings/layout.css`
- `open-robin-client/src/components/App.css`

For each rule found:
1. Copy the rule body (the declarations inside `{ ... }`)
2. Change the selector from `.rv-panel[data-tint-X="true"]` to `body[data-tint-X="true"]`
3. Remove the `.rv-panel` prefix if present

**Step 2: Write `ai/settings/tints.css`**

The file should follow this structure:
```css
/* ═══════════════════════════════════════════════════════════════════════════
   Global Tint Rules
   ═══════════════════════════════════════════════════════════════════════════
   These rules respond to body[data-tint-*] attributes set by the active theme.
   They apply universally across every view. Per-view CSS never defines tint
   responses.
*/

/* ── Content Panels ── */
body[data-tint-content-panels="true"] .rv-ticket-column {
  /* declarations from tickets.css */
}

body[data-tint-content-panels="true"] .rv-tile-grid {
  /* declarations from tile-row.css */
}

body[data-tint-content-panels="true"] .file-explorer-empty,
body[data-tint-content-panels="true"] .file-explorer-main:empty {
  /* declarations from file-viewer/layout.css */
}

/* ── Cards ── */
body[data-tint-cards="true"] .rv-ticket-column {
  /* declarations from tickets.css */
}

body[data-tint-cards="true"] .rv-ticket-column-header {
  /* declarations from tickets.css */
}

/* ... etc for all tint types ... */
```

**Step 3: Remove tint rules from per-view CSS files**

After extracting, DELETE the tint rules from:
- `open-robin-client/src/components/tickets/tickets.css`
- `open-robin-client/src/components/tile-row/tile-row.css`
- `open-robin-client/src/components/wiki/wiki.css`
- `open-robin-client/src/components/capture/capture.css`
- `ai/views/file-viewer/settings/layout.css`
- `open-robin-client/src/components/App.css`

**Important:** Do NOT remove non-tint rules (layout, geometry, positioning). Only remove rules whose selectors contain `[data-tint-`.

**Smoke test:**
1. Build the client, restart the server
2. Open every view (Wiki, Tickets, Agents, Files, Doc/Capture)
3. For each view, flip each toggle in ThemePicker:
   - Content Panels
   - Cards
   - Navigation
   - Left Panel
   - Right Panel
   - Chat Border
   - Thread Border
4. Verify visual effects still work in every view
5. Verify no orphaned `.rv-panel[data-tint-*]` rules remain in any CSS file:
   ```bash
   grep -r "data-tint-" open-robin-client/src/components/ ai/views/
   ```
   The only results should be in `ai/settings/tints.css`.

**Risk:** High. This touches many CSS files. Wrong selectors = broken styling.

**Next chunk:** Chunk 8 — Move per-view layout CSS to correct location.
