# SPEC-28: Universal Sidebar Collapse and Resize

**Status:** Draft — requirement clarification complete
**Scope:** UI/Layout — all views get collapse/resize controls for their left sidebar
**Risk:** Low-Medium — touches multiple view components, but state model already exists

---

## 1. Problem Statement

The `collapsed.leftSidebar` and `widths.leftSidebar` state is per-view and works correctly in chat views (code viewer). But non-chat views (wiki, file explorer, tickets, agents, capture) have no collapse button and no resize handle for their internal left columns.

The state model is correct — per-view, isolated. The UI is missing.

## 2. Target Behavior

Every view that has a left sidebar (or left column) must have:
1. A collapse button (chevron) that toggles `collapsed.leftSidebar` for that view
2. A resize handle that adjusts `widths.leftSidebar` for that view
3. The sidebar width animates between 0 (collapsed) and the stored width (expanded)

Switching views preserves each view's independent collapse/width state.

## 3. View Inventory

| View | Has Left Sidebar? | What It Is | Needs Collapse? | Needs Resize? |
|------|-------------------|------------|-----------------|---------------|
| Code viewer (chat) | Yes | Thread list (shared `Sidebar`) | ✅ Already has | ✅ Already has |
| Wiki | Yes | Topic list (`TopicList`) | ❌ Missing | ❌ Missing |
| File explorer | Yes | File tree (`FileExplorer`) | ❌ Missing | ❌ Missing |
| Tickets | No | Three equal columns | N/A | N/A |
| Agents | Yes | Agent list (`AgentTiles` sidebar) | ❌ Missing | ❌ Missing |
| Capture | No | Tile grid only | N/A | N/A |

## 4. Design

### 4.1 Shared Collapse Button Component

Create a small shared component (e.g., `CollapseButton.tsx`) that:
- Accepts `collapsed: boolean` and `onToggle: () => void`
- Renders a chevron icon
- Positioned absolutely at the right edge of the sidebar
- Uses theme variables for color/hover

### 4.2 Shared Resize Handle Integration

The existing `LeftSidebarResize` component already reads `widths.leftSidebar` and calls `setPaneWidth`. Non-chat views can render this handle alongside their internal sidebar.

**Key change:** `LeftSidebarResize` currently only renders in the chat layout path (`App.tsx`). It needs to be renderable inside any view that has a left sidebar.

### 4.3 Per-View Integration

Each view wraps its left sidebar in a collapsible container:

**Wiki:**
```tsx
<div className="rv-wiki-sidebar" style={{ width: collapsed ? 0 : width }}>
  <TopicList />
  <CollapseButton collapsed={collapsed} onToggle={toggle} />
  <LeftSidebarResize panel={panel} />
</div>
```

**File explorer:**
```tsx
<div className="file-explorer-sidebar" style={{ width: collapsed ? 0 : width }}>
  <FileTree />
  <CollapseButton collapsed={collapsed} onToggle={toggle} />
  <LeftSidebarResize panel={panel} />
</div>
```

**Agents:**
```tsx
<div className="rv-agent-sidebar" style={{ width: collapsed ? 0 : width }}>
  <AgentList />
  <CollapseButton collapsed={collapsed} onToggle={toggle} />
  <LeftSidebarResize panel={panel} />
</div>
```

### 4.4 CSS Requirements

Each view's CSS must:
- Support `width: 0` with `overflow: hidden` for collapsed state
- Animate width transitions smoothly
- Position the collapse button at the sidebar's right edge
- Position the resize handle at the sidebar's right edge

## 5. Files to Change

| File | Change |
|------|--------|
| `components/CollapseButton.tsx` | **NEW** — shared collapse button component |
| `components/wiki/WikiExplorer.tsx` | Add collapse/resize to topic list column |
| `components/wiki/wiki.css` | Collapsible topic list styles |
| `components/file-explorer/FileExplorer.tsx` | Add collapse/resize to file tree |
| `ai/views/file-viewer/settings/layout.css` | Collapsible tree styles |
| `components/agents/AgentTiles.tsx` | Add collapse/resize to agent list |
| `components/agents/agents.css` | Collapsible agent list styles |
| `components/ResizeHandle.tsx` | Ensure `LeftSidebarResize` works outside chat layout |

## 6. State Model (Already Correct)

No state changes needed. Uses existing:
- `viewStates[view].collapsed.leftSidebar`
- `viewStates[view].widths.leftSidebar`
- `toggleCollapsed(view, 'leftSidebar')`
- `setPaneWidth(view, 'leftSidebar', width)`

## 7. Open Questions

1. **Tickets view:** Three equal columns. Should the leftmost column (INBOX) be collapsible? Or does tickets not need this feature?
2. **Capture view:** No sidebar. Confirmed — no action needed.
3. **Animation:** Should the sidebar width transition with CSS `transition: width 200ms`? Or instant?
4. **Collapsed width:** Should collapsed sidebars be fully 0px wide, or leave a small rail (e.g., 40px) with an expand button?

## 8. Chunks

### Chunk A: Shared Component
- Create `CollapseButton.tsx`
- Verify `LeftSidebarResize` works outside chat layout

### Chunk B: Wiki
- Integrate collapse/resize into `WikiExplorer.tsx`
- Update `wiki.css` for collapsible topic list

### Chunk C: File Explorer
- Integrate collapse/resize into `FileExplorer.tsx`
- Update `layout.css` for collapsible tree

### Chunk D: Agents
- Integrate collapse/resize into `AgentTiles.tsx`
- Update `agents.css` for collapsible agent list

### Chunk E: Verification
- Test collapse/resize in each view
- Verify state isolation (collapse in wiki doesn't affect file explorer)
