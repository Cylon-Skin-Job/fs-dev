# Chat Header + Collapsed-State Thread Access — Spec

**Status:** Draft — questions resolved, ready for implementation.
**Owner:** Open Robin core.
**Extends:** SPEC-26c-2 (left-column collapse + resize).
**Scope:** Project chat column only. View chat (floating popup, SPEC-26d) is untouched.

---

## 1. Purpose

Add a **chat header** bar above `ChatArea`. Behavior depends on sidebar state:

- **Sidebar expanded:** header is empty. The sidebar owns the collapse icon (as today).
- **Sidebar collapsed:** header shows an expand icon (upper-left), a **new-chat dropdown** (CLI picker), and a **thread-jump dropdown** (right side).

The collapsed-state header is the user's primary surface for switching CLIs and jumping between threads while keeping the chat wide.

---

## 2. Current state

- `Sidebar.tsx`, expanded: renders the thread list with a collapse button (`arrow_menu_close`) that toggles `collapsed.leftSidebar`.
- `Sidebar.tsx`, collapsed: renders an empty `<aside>` placeholder (per the SPEC-26c-2 layout fix).
- `ChatArea.tsx` has no header row. Inline `ChatHarnessPicker` shows when no thread is active.
- `viewStates[panel].collapsed.leftSidebar` is the collapse flag; persisted per-view per-user.
- `clampWidth` in `panelStore.ts:33` constrains pane widths to `[120, 600]`.

---

## 3. Target behavior

### 3a. Chat header — always rendered

A fixed-height header (`--chat-header-height: 40px`) at the top of `ChatArea`. Always mounted so chat body height is stable regardless of sidebar state.

### 3b. Sidebar expanded (chat header empty)

Chat header renders no controls. Sidebar behavior unchanged — `arrow_menu_close` inside the sidebar collapses it.

### 3c. Sidebar collapsed (chat header populated)

Three controls in the chat header:

| Position | Icon | Action |
|----------|------|--------|
| Upper-left | `arrow_menu_open` | Expand sidebar. Sets `collapsed.leftSidebar = false`; icon returns to the sidebar as `arrow_menu_close`. |
| Right group, left button | `playlist_add` | Open **CLI picker dropdown** to start a new chat (see 3d). |
| Right group, right button (far right) | `subject` | Open **thread-jump dropdown** (see 3e). |

The `arrow_menu_close` (sidebar) / `arrow_menu_open` (chat header) pair is a single logical toggle that swaps location and variant based on `collapsed.leftSidebar`.

### 3d. New-chat CLI picker dropdown

Clicking `playlist_add` opens a dropdown anchored below the button. Contents are the same harness options currently shown by `ChatHarnessPicker.tsx` (inline "no thread" picker). Dropdown behavior:

- Lists available CLIs/harnesses with status indicators.
- Click a CLI → creates a new thread with that harness and activates it → dropdown closes.
- Auto-rename on first send/receive round-trip (existing behavior from SPEC-24d).
- Dropdown closes on: selection, Escape, outside click, panel switch, workspace switch, sidebar expand.

**Future work (not in this spec):**
- Empty-thread cleanup: if the user clicks `playlist_add` while the currently-active thread has zero messages, delete the empty thread and replace it with the new one.
- Same cleanup on thread switch: leaving an empty/unused thread deletes it.
- There may be prior thread-cleanup logic that got removed; reinstate if needed. Track as a follow-up spec.

### 3e. Thread-jump dropdown

Clicking `subject` opens a dropdown anchored below the button. Contents:

- Lists threads from `state.threads.project`, one row per thread.
- Active thread visually marked (`aria-current="true"`).
- Click a thread → loads it (existing thread-open path) → dropdown closes.
- **Amended by `SECONDARY_CHAT_SPEC.md` §4a:** each row now carries a kebab (⋮) button that opens the same menu as the sidebar (Rename / Copy Link / Open as Secondary / Delete). Left-click on the row body still quick-jumps. No right-click context menus.
- Empty state: single non-interactive row "No threads — tap the new-chat button".

Close triggers: selection, re-click `subject`, Escape, outside click, panel switch, workspace switch, sidebar expand.

---

## 4. Layout constraints

- **Chat column min-width: 300px.** Tighten `clampWidth` (currently `[120, 600]`) for the `leftChat` pane specifically — new range `[300, 600]`. The `leftSidebar` pane keeps its existing `[120, 600]` range. This means `clampWidth` needs to become pane-aware, or be split into `clampSidebarWidth` / `clampChatWidth`.
- **Dropdown width:** 240px (both CLI picker and thread-jump).
- **Thread-jump dropdown position:** right edge 15px from the chat column's right edge; top edge flush to the bottom of the `subject` button. At 300px chat width, that leaves 45px to the left of the dropdown — no collision risk.
- **CLI picker dropdown position:** anchored below `playlist_add` with its right edge aligned to `playlist_add`'s right edge. If that would push it off-screen, fall back to matching the thread-jump's right-15px anchor. (Both dropdowns are mutually exclusive; only one open at a time.)
- **Dropdown max-height:** `min(60vh, 400px)`; overflows scroll internally.

---

## 5. Components

### 5a. `ChatArea.tsx` — new header row

```tsx
<div className="rv-chat-header">
  {sidebarCollapsed && (
    <>
      <button
        className="rv-chat-header-btn rv-chat-header-btn--left"
        onClick={() => toggleCollapsed(panel, 'leftSidebar')}
        aria-label="Show threads sidebar"
        aria-expanded={false}
      >
        <span className="material-symbols-outlined">arrow_menu_open</span>
      </button>
      <div className="rv-chat-header-right">
        <button
          className="rv-chat-header-btn"
          onClick={toggleCliPickerDropdown}
          aria-haspopup="menu"
          aria-expanded={cliPickerOpen}
          aria-controls={`cli-picker-${panel}`}
          aria-label="New chat"
        >
          <span className="material-symbols-outlined">playlist_add</span>
        </button>
        <button
          className="rv-chat-header-btn"
          onClick={toggleThreadDropdown}
          aria-haspopup="menu"
          aria-expanded={threadDropdownOpen}
          aria-controls={`thread-dropdown-${panel}`}
          aria-label="Show thread list"
        >
          <span className="material-symbols-outlined">subject</span>
        </button>
      </div>
      <CliPickerDropdown panel={panel} />
      <ThreadJumpDropdown panel={panel} />
    </>
  )}
</div>
```

`sidebarCollapsed` is already plumbed through via `App.tsx:44-51`.

### 5b. `Sidebar.tsx` — unchanged

Expanded sidebar keeps its `arrow_menu_close` collapse button. Collapsed sidebar keeps its empty `<aside>` placeholder.

### 5c. `CliPickerDropdown.tsx` — new component

Renders the existing harness options (same data source as `ChatHarnessPicker.tsx`). 240px wide, anchored to `playlist_add`.

- On select → fire the existing new-thread + harness-select flow → close dropdown.
- Styled like a menu; no inline preview.

### 5d. `ThreadJumpDropdown.tsx` — new component

```tsx
<div
  className="rv-thread-dropdown"
  role="menu"
  data-open={open}
  id={`thread-dropdown-${panel}`}
>
  {threads.map(t => (
    <button
      role="menuitem"
      aria-current={t.threadId === currentThreadId ? 'true' : undefined}
      onClick={() => select(t.threadId)}
    >
      {t.entry?.name || t.threadId}
    </button>
  ))}
</div>
```

- Reuses thread data from `usePanelStore`.
- Does NOT reuse the full `Sidebar` component — dropdown is leaner, but now renders a per-row kebab (⋮) wired to the same menu as the sidebar (see `SECONDARY_CHAT_SPEC.md` §4a).

### 5e. `panelStore.ts` — dropdown open state

```ts
cliPickerOpen: Record<string, boolean>;
threadDropdownOpen: Record<string, boolean>;
openCliPicker: (panel: string) => void;
closeCliPicker: (panel: string) => void;
toggleCliPicker: (panel: string) => void;
openThreadDropdown: (panel: string) => void;
closeThreadDropdown: (panel: string) => void;
toggleThreadDropdown: (panel: string) => void;
```

- Both keyed by panel id; independent per panel; transient (not persisted).
- Mutual exclusion: opening one closes the other.
- Auto-close triggers: selection, panel switch, workspace switch, sidebar expand, Escape, outside click.

### 5f. Width clamp split

In `panelStore.ts:33`, replace `clampWidth(n)` with pane-aware logic:

```ts
function clampPaneWidth(pane: Pane, n: number): number {
  const [min, max] = pane === 'leftChat' ? [300, 600] : [120, 600];
  return Math.max(min, Math.min(max, n));
}
```

Update `setPaneWidth` to call `clampPaneWidth(pane, width)`. Also update the client-side clamp in `ResizeHandle.tsx` to pull the min/max from the same source (or mirror the 300/600 for `leftChat`).

### 5g. CSS — new rules

- `.rv-chat-header` — flex row, height `var(--chat-header-height, 40px)`, border-bottom, align-items center, justify-content space-between, padding-left/right, `position: relative` (anchor for dropdowns), `overflow: visible`.
- `.rv-chat-header-right` — flex row, gap, right-aligned.
- `.rv-chat-header-btn` — icon button base (size, hover, active, focus-ring).
- `.rv-dropdown` — shared base: absolute, width 240px, background, shadow-medium, border, border-radius, z-index drawer/popup, max-height `min(60vh, 400px)`, overflow-y auto, opacity 0, `pointer-events: none`, `transition: opacity 150ms ease`.
- `.rv-dropdown[data-open="true"]` — opacity 1, pointer-events auto.
- `.rv-thread-dropdown` — extends `.rv-dropdown`, positioned 15px from right edge of chat column, top flush to chat-header bottom.
- `.rv-cli-picker-dropdown` — extends `.rv-dropdown`, anchored under `playlist_add`.

---

## 6. Interactions

### 6a. Expand/collapse toggle
- Expanded → sidebar's `arrow_menu_close` → `collapsed.leftSidebar = true` → sidebar empty, chat header populated.
- Collapsed → chat header's `arrow_menu_open` → `collapsed.leftSidebar = false` → sidebar re-renders, chat header clears.
- Any open dropdown closes on expand.

### 6b. New-chat flow
- Click `playlist_add` → CLI picker opens (thread dropdown closes if open).
- Click CLI → creates new thread, switches to it, closes dropdown.
- Future: empty-thread cleanup on create/switch (tracked as follow-up).

### 6c. Thread jump
- Click `subject` → thread-jump opens (CLI picker closes if open).
- Click thread → loads, closes dropdown.
- Click `subject` again / Escape / outside click → close.

### 6d. Edge cases
- **Empty thread list** when `subject` clicked: show non-interactive "No threads" row.
- **No harness available** when `playlist_add` clicked: show non-interactive row explaining.
- **Click active thread in dropdown:** close dropdown without re-loading.
- **Dropdown open when sidebar expands:** close dropdown.
- **Both dropdown states true simultaneously:** prevented by the mutex in the store actions.

---

## 7. Persistence

- `collapsed.leftSidebar` — persisted (existing).
- `widths.leftSidebar` — persisted (existing).
- `widths.leftChat` — persisted; **clamp range tightened to `[300, 600]`**.
- `cliPickerOpen`, `threadDropdownOpen` — NOT persisted. Transient UI state only.

---

## 8. Accessibility

- Buttons: `aria-label`, `aria-expanded`, `aria-haspopup`, `aria-controls` as in §5a.
- Dropdowns: `role="menu"`, rows `role="menuitem"`, active thread `aria-current="true"`.
- Keyboard: Escape closes; ArrowUp/Down navigate rows; Enter activates.
- Focus returns to the triggering button on close.
- Focus moves to the first row on open.

---

## 9. Resolved questions (from review)

1. **Rename / delete / copy-link in dropdown** — originally OUT, now IN via a per-row kebab button (see `SECONDARY_CHAT_SPEC.md` §4a). Left-click row body still quick-jumps; kebab opens the menu.
2. **Dropdown width** — fixed 240px.
3. **Chat header height** — new token `--chat-header-height: 40px`.
4. **Dropdown animation** — fade (opacity, 150ms).
5. **Dropdown anchor** — inline, not portal. Requires `.rv-chat-header { overflow: visible }` and 300px chat min-width (see §4).
6. **`playlist_add` behavior** — opens a CLI picker dropdown; selection creates the thread. Auto-rename on first message round-trip (existing). Empty-thread cleanup deferred to follow-up.

---

## 10. Implementation order

1. CSS variable `--chat-header-height` + empty `.rv-chat-header` row in `ChatArea.tsx`.
2. Split `clampWidth` into `clampPaneWidth`; tighten `leftChat` min to 300; update `ResizeHandle.tsx` min.
3. Add `cliPickerOpen` + `threadDropdownOpen` state + actions to `panelStore.ts` (with mutex).
4. Render the three chat-header controls gated on `sidebarCollapsed`.
5. Build `CliPickerDropdown.tsx` (reuse harness data path from `ChatHarnessPicker.tsx`).
6. Build `ThreadJumpDropdown.tsx`.
7. Mutual-exclusion + outside-click + Escape + panel-switch + sidebar-expand close paths.
8. Accessibility pass.

Each step is independently testable.

---

## 11. Follow-up work (not in this spec)

- **Empty-thread cleanup.** If the active thread has zero messages, deleting it on new-chat or on thread-switch. Check for prior cleanup logic that may have been removed (SPEC-24 series had `delete legacy strategies`); reinstate or rewrite.
- Chat header will host additional controls over time (TBD).
