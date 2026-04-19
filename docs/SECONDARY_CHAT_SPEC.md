# Secondary Chat — Spec

**Status:** Questions resolved — ready for implementation.
**Owner:** Open Robin core.
**Supersedes:** `SPEC-26d` (view chat as floating popup, MRU-default).
**Narrows:** `CHAT_SCOPE_SPEC.md` — view-scope survives only inside agents-viewer (see §10).
**Scope:** Project-scope viewers only. Agents-viewer keeps its own per-agent-view scoping, untouched.

---

## 1. Purpose

Replace the SPEC-26d popup model (view-scope MRU-default) with a **secondary chat** pattern: the user opens any existing project thread as a second window that shares the same thread list and sessions as the primary. The popup becomes a second view of a known thread, not a separate scope.

At most one secondary exists at a time. It has three display modes the user cycles through via macOS-style traffic-light controls, plus a dismiss.

---

## 2. Current state

- `SPEC-26d` floating popup: right-side popup bound to view-scope; MRU-default; its own thread pool.
- `Scope` in `types/index.ts:30ish`: `'project' | 'view'`. `view` currently used by wiki-viewer **and** agents-viewer per memory `project_chat_scoping_architecture.md`.
- `Sidebar.tsx` kebab menu has Rename / Copy Link / Delete on each thread row.
- Thread-jump dropdown (from `CHAT_HEADER_AND_THREAD_OVERLAY_SPEC.md`) is quick-jump only — no context menu.
- Code-viewer layout: `.file-explorer-main` + `.file-tree-sidebar` together make up ContentArea; sticky-right will target this region.

---

## 3. Core model

### 3a. Singleton

At most **one** secondary chat exists per workspace at any time. No multi-popup.

### 3b. Shared thread list and sessions

The secondary shows one of the **same** threads that lives in `state.threads.project` (or the appropriate project list). Selecting the secondary's thread does not fork the data; it's a second view onto identical state.

### 3c. Never co-primary

The primary and the secondary cannot display the same thread at the same time. Implied rules:
- The primary's currently-active thread is ineligible to be opened as secondary (see §5a).
- If the user switches the primary **to** the thread the secondary is displaying, the secondary auto-closes. Switch wins; no mode dialog.

### 3d. Lifetime

The secondary exists until the user clicks Red, or until its thread is deleted (any scope), or the workspace switches, or the panel switches in a way that makes the secondary inapplicable — see §7d.

---

## 4. Thread-list presentation

When a secondary is open, the thread list (both the expanded sidebar and the thread-jump dropdown) reorders:

1. **Position 1:** the primary's active thread (current behavior).
2. **Position 2:** the secondary's thread, **indented** by one level. Row prefix icon: `subdirectory_arrow_right`.
3. **Positions 3+:** the remaining threads in their normal MRU order.

The secondary's row is visually nested under the primary's row. Both rows remain clickable; clicking either selects it as primary (the secondary auto-closes if the clicked thread is currently the secondary — see §3c).

### 4a. Kebab in thread dropdown

Previously the thread-jump dropdown was quick-jump only (per `CHAT_HEADER_AND_THREAD_OVERLAY_SPEC.md` §3e). **Amendment:** each row in the dropdown now carries a kebab (⋮) button on the right, matching the sidebar's row pattern. Clicking the kebab opens the same menu (Rename / Copy Link / Open as Secondary / Delete). Left-click on the row body still quick-jumps.

No right-click context menus anywhere. The kebab is the single menu surface, consistent across sidebar and dropdown.

---

## 5. Kebab / context menu

Add a new item **"Open as Secondary"** at the **top** of the menu:

```
Open as Secondary        ← new, top
Rename
Copy Link
Delete
```

### 5a. "Open as Secondary" state

| Condition | State |
|-----------|-------|
| This row is the primary's active thread | Grayed (disabled) with tooltip "Already primary" |
| A secondary is already open (any thread) | Grayed (disabled) with tooltip "Close the current secondary first" |
| Otherwise | Enabled |

Grayed (never hidden) to keep menu layout stable — user comfort over menu tidiness.

### 5b. Click behavior

Enabled click → spawn the secondary as a **floating popup** (the default spawn state). Always popup on spawn; prior mode memory is not applied.

---

## 6. Secondary chrome

The popup is a **separate artifact**, not the primary's `ChatArea` with a different prop. It has its own shell and a minimal header.

### 6a. Header

Fixed height (reuse `--chat-header-height: 40px`). Contents:

- Upper-left: three traffic-light buttons — red, yellow, green (left-to-right in that order, mac convention).
- No menu icon. No `playlist_add`. No `subject`. No kebab.
- Rest of the header is empty space, available for future chrome.

### 6b. Traffic lights

| Button | Color | Action |
|--------|-------|--------|
| 🔴 | Red | Dismiss the secondary. Closes the popup. Does NOT delete the thread. |
| 🟡 | Yellow | Minimize. Popup disappears; a round bottom-right button appears in its place (see §7b). Clicking the bottom-right button restores the popup. |
| 🟢 | Green | Toggle dock. Floating → stick to right side of viewport (see §7c). Sticky → return to floating popup. |

No hover preview / expand-icon-on-hover for now — plain buttons, keep it simple.

### 6c. Body and composer

Same MessageList / ChatInput used by the primary, wrapped in the popup shell. The wire routing uses whatever harness the thread already uses. One wire per thread — see §8a.

---

## 7. State machine

States: **closed, floating, minimized, sticky-right**.

```
closed ──(Open as Secondary)──► floating
floating ──(Yellow)──► minimized [prev=floating]
floating ──(Green)──► sticky-right
sticky-right ──(Yellow)──► minimized [prev=sticky-right]
sticky-right ──(Green)──► floating
minimized ──(click dock button)──► prev
any ──(Red)──► closed
```

### 7a. Floating (default)

Free-floating popup, user-draggable and user-resizable. Not modal; the rest of the UI is interactive.

**Default spawn position:** lower-right corner of the viewport. Default size: reasonable default (e.g. 380×520); exact number a UI-polish decision.

**State persistence through mode changes:** the popup's position and size are preserved when the user clicks Yellow (minimize) or Green (sticky-right). When the user un-sticks (Green → Floating) or restores from minimize, the popup returns to whatever position/size it had the last time it was floating. This state survives panel switches and workspace-internal navigation.

**State reset on Red:** clicking Red discards the popup's position/size state. A subsequent "Open as Secondary" spawns fresh at the default lower-right corner.

### 7b. Minimized → dock button

Yellow click hides the popup and shows a single round button fixed to the lower-right corner of the viewport (e.g., 48px, shadow, harness icon + thread-name tooltip). Clicking it restores the popup to the **exact state it was in immediately before minimize** — same mode (floating or sticky-right), same floating position/size if that was the prior mode.

Singleton dock button — since secondaries are a singleton, only one ever exists.

### 7c. Sticky-right

Green (while floating) docks the secondary to the right side of the active panel. Behavior is **uniform across all viewers** (code-viewer, wiki-viewer, etc.) — the panel-specific content simply shrinks to accommodate the new right column.

- Primary `ChatArea` stays put (with its own header already specced in `CHAT_HEADER_AND_THREAD_OVERLAY_SPEC.md`).
- A new grid track is added to the right of the primary, containing `<SecondaryChat />`.
- The panel's ContentArea yields horizontal space (shrinks) to make room.
- **Code-viewer refinement:** since the file tree sidebar has its own width inside ContentArea, hiding it (`display: none`) while sticky-right is active is a reasonable optimization — `.file-explorer-main` / FileViewer still renders. Implementation detail, not spec-mandated.
- Secondary width persisted per-user as a new `widths.rightSecondary` slice, independent of `widths.leftChat`. Default **300px**; user can widen via the drag handle.
- Resize handle between primary chat and the sticky column: reuse the `ResizeHandle` component, new pane `rightSecondary` with clamp range `[300, 600]` (same upper bound as `leftChat`).

Green (while sticky-right) undocks back to floating. Any panel-specific adjustments (e.g. file-tree re-show) revert.

### 7d. Auto-close triggers

The secondary force-closes (goes to `closed`) in these cases:

- Red clicked.
- The secondary's thread is deleted (any code path — manual delete, cleanup, etc.).
- The primary switches to the secondary's thread (§3c).
- The workspace switches (blanket reset).

The secondary **persists** through:
- Sidebar collapse/expand (orthogonal concerns).
- Panel switch. The popup/dock/sticky state survives a panel change; the secondary re-renders in the new panel's layout context. Sticky-right uniformly takes a right column in whatever panel becomes active.

---

## 8. Interactions with other systems

### 8a. Wire / live-stream

A thread has one live wire (server-side). The primary owns the wire if the primary has that thread open; otherwise the secondary owns the wire. Since §3c forbids both pointing at the same thread, there's no contention — each view (primary or secondary) has its own thread, each with its own wire.

No mirror-on-read / read-only mode needed.

### 8b. `CHAT_HEADER_AND_THREAD_OVERLAY_SPEC.md`

Primary's chat-header behavior is unchanged. Three amendments:

1. **Thread-jump dropdown rows gain a kebab (⋮)** opening the same menu as the sidebar. Overrides the original "quick-jump only" rule in that spec's §3e. Implementation in `ThreadJumpDropdown.tsx`.
2. Both the sidebar kebab and the dropdown kebab gain the **"Open as Secondary"** row per §5.
3. **Thread list reordering** (§4) applies everywhere the list is rendered: expanded sidebar, thread-jump dropdown. The `subdirectory_arrow_right` prefix appears in both.

### 8c. `THREAD_LIFECYCLE_HARDENING_SPEC.md`

- **Part A (empty-thread cleanup):** unaffected. Secondary never hosts "new chat" (§6a — no `playlist_add`), so secondary never creates empty threads. Cleanup fires only from primary's triggers.
- **Part B (MRU auto-open guard):** unaffected.
- The cleanup spec's §6c (floating-popup cleanup) can be deleted — the popup no longer has an MRU-default model.

### 8d. `SPEC-26c-2` dual-chat routing

Dual-chat routing stays relevant **only for agents-viewer**, where view-scope survives. Non-agents viewers effectively become single-scope (project) for all routing; `state.panels[panel]` only needs a live chat state for agents-viewer panels.

### 8e. Scope narrowing

`Scope` type remains `'project' | 'view'`. Rule changes:

- **Project scope:** every non-agents-viewer panel uses this.
- **View scope:** agents-viewer only.
- Wiki-viewer, code-viewer, etc. all use project scope exclusively.

This is a narrowing of memory `project_chat_scoping_architecture.md` ("view-bound only for wiki/agents viewers") — now agents-only.

---

## 9. Components

### 9a. `panelStore.ts` — secondary state

```ts
type SecondaryMode = 'floating' | 'minimized' | 'sticky-right';

interface SecondaryState {
  threadId: string;         // thread currently shown in secondary
  mode: SecondaryMode;
  previousMode: 'floating' | 'sticky-right';  // where minimized came from
  // floating position/size (reuse SPEC-26d persisted shape if it fits)
  float: { x: number; y: number; width: number; height: number };
  // sticky width (separate from floating width)
  stickyWidth: number;
}

secondary: SecondaryState | null;           // null == closed

openSecondary: (threadId: string) => void;
closeSecondary: () => void;
minimizeSecondary: () => void;
restoreSecondary: () => void;
dockSecondary: () => void;                  // green, floating → sticky-right
undockSecondary: () => void;                // green, sticky-right → floating
```

`openSecondary` checks: already open? → noop. Thread is the primary's current? → noop. Otherwise sets `secondary = { threadId, mode: 'floating', ... }`.

Auto-close wiring (§7d):

- Subscribe to `currentThreadIds.project` changes: if new current == secondary's threadId → `closeSecondary`.
- Subscribe to `thread:deleted` events: if deleted == secondary's threadId → `closeSecondary`.
- Workspace switch handler: `closeSecondary`.
- Panel switch handler: evaluate per §10 Q2 resolution.

### 9b. `SecondaryChat.tsx` — new

Renders the popup shell with:

- `<SecondaryHeader>` (traffic lights).
- `<MessageList>` and `<ChatInput>` wired to the secondary's thread state.
- Shell layout depends on `secondary.mode`:
  - `floating` → absolutely-positioned, draggable, resizable.
  - `minimized` → renders nothing for the popup; `<SecondaryDockButton>` renders instead.
  - `sticky-right` → grid column within the panel.

### 9c. `SecondaryHeader.tsx` — new

40px header with three buttons. Traffic-light appearance via CSS (solid circles + hover/active states).

### 9d. `SecondaryDockButton.tsx` — new

Absolutely-positioned bottom-right button (only rendered when `secondary.mode === 'minimized'`).

### 9e. Thread-list components — amendments

- `Sidebar.tsx`: reorder threads to put secondary's thread at position 2 with indent + prefix icon when `secondary !== null`. Add "Open as Secondary" menu item to the kebab with the gray-out rules from §5a.
- `ThreadJumpDropdown.tsx`: mirror the reorder + indent + prefix icon; implement `onContextMenu` on rows to show the same menu.

### 9f. Panel layout — sticky-right

`App.tsx` / panel CSS: when `secondary?.mode === 'sticky-right'` and the active panel is a code-viewer-like panel with a file tree, hide `.file-tree-sidebar` and add a new grid track on the right containing `<SecondaryChat />`.

---

## 10. Resolved questions

- **Panel switch with popup open** — popup persists, works uniformly across viewers (§7c, §7d).
- **Minimized dock persistence across panel switch** — persists; restore returns to exact prior state.
- **Right-click context menus** — removed from the design; kebab (⋮) is the single menu surface everywhere (§4a).
- **Default popup position** — lower-right corner (§7a).
- **Floating position/size persistence** — preserved across Yellow / Green transitions; reset only by Red (§7a).
- **SPEC-26d persisted popup state** — retire it; fresh lower-right default is the new baseline.
- **Sticky width** — default 300px, drag to widen, clamp `[300, 600]`, persisted as `widths.rightSecondary` independent of `widths.leftChat` (§7c).
- **Kebab menu ordering** — "Open as Secondary" at the top, above Rename (§5).

All questions resolved. Ready for implementation pending review.

---

## 11. Implementation order

1. **Scope narrowing.** Amend memory / docs: view-scope now agents-viewer only. Audit non-agents viewers for any view-scope reads and move them to project.
2. **Retire SPEC-26d.** Remove the floating-popup MRU-default code paths. Keep the state shape around if useful for §9a.
3. **`panelStore.ts` secondary state + actions.** Ship behind a feature check so UI can be stubbed.
4. **`SecondaryChat` + `SecondaryHeader`** in `floating` mode only first. Validate message flow and wire ownership (§8a).
5. **Traffic-light actions.** Red, then Yellow (with `SecondaryDockButton`), then Green floating→sticky.
6. **Sticky-right layout.** `.file-tree-sidebar` hide, grid track add, resize handle for secondary width.
7. **Thread-list reorder + indent + prefix icon.** Sidebar and dropdown.
8. **"Open as Secondary" menu item** with gray-out rules.
9. **Kebab in thread dropdown rows** + wire to the same menu used by the sidebar.
10. **Auto-close wiring** (thread delete, primary switch, workspace switch). Note: no panel-switch auto-close — the popup persists.
11. QA matrix across all three modes in multiple viewers (code, wiki) + agents-viewer unaffected smoke.

---

## 12. Out of scope

- Agents-viewer chat behavior (tracked separately per user direction).
- Multi-secondary support.
- Secondary that mirrors the primary's same thread (forbidden by §3c).
- Per-thread mode memory on "Open as Secondary" — always spawns floating.
- Context menu keyboard shortcuts.
