# HANDOFF — Phase 5: `App.css` Decomposition

**Baseline commit:** `22b4e2e` (phase4-4.3 complete)
**Goal:** shrink `App.css` (2010 lines, ~185 unique classes) to genuinely-global rules only.
**Risk:** Medium-High — every chunk needs a full visual smoke test.

---

## 0. Prerequisites

- [x] Phase 1 (token swap) complete
- [x] Phase 2 (hardcoded value extraction) complete
- [x] Phase 3 (`.rv-` prefix migration) complete
- [x] Phase 4 (inline-style extraction) complete
- [ ] Read §3 (Override Warning) before touching any chat or sidebar rule

---

## 1. Class → Owner Mapping

### Bucket A — Stays in `App.css` (genuinely global)

These classes are consumed by `App.tsx` itself or are structural shell rules that span multiple
top-level layout zones. Do not move them.

| Class(es) | Reason |
|---|---|
| `.rv-app-container` | Root mount point |
| `.rv-header`, `.rv-header-*` (left / right / center / center-title) | Top chrome shared across all workspaces |
| `.rv-layout-dual-chat`, `.rv-layout-full` | Body layout variants |
| `.rv-panel`, `.rv-panel-container`, `.rv-panel-container--loading`, `.rv-panel.active` | Panel shell — consumed by `App.tsx` |
| `.rv-content-area` | Panel content slot |
| `.rv-resize-handle`, `.rv-resize-handle::before`, `:hover`, `:active`, `[data-pane=*]` | `ResizeHandle.tsx` — single file, could get own CSS in Phase 6 |
| `.rv-secondary-sticky` | Secondary panel positioning |
| `.rv-connection-status`, `.rv-connection-status.*` | Header chrome — `WorkspaceTitle.tsx` + `App.tsx` |
| `.rv-project-name` | Header chrome — `WorkspaceTitle.tsx` |
| `.rv-menu-btn`, `.rv-menu-btn:hover` | Header chrome — `App.tsx` |
| `.rv-header-nav-btn`, `.rv-header-nav-btn:hover` | Navigation buttons — `App.tsx` |
| `.rv-workspace-name` | `WorkspaceTitle.tsx` — used in header |

---

### Bucket B — Move to new component CSS files

#### 5.1 — `Sidebar.css` (NEW)

**Consumer:** `Sidebar.tsx` (primary), `ChatArea.tsx` (references sidebar collapse state)

Classes to move:

```
.rv-sidebar
.rv-sidebar--active
.rv-sidebar--collapsed
.rv-collapse-btn
.rv-collapse-btn:hover
.rv-collapse-rail-btn
.rv-collapse-rail-btn:hover
```

⚠️ **Override warning — see §3.** Both `fs-dev` and `Fusion-Home` `ai/settings/views.css` have
`.rv-sidebar` rules. These must remain valid (same class, same selector path) after the move —
the project-layer overrides don't need to change, but verify cascade order is unchanged.

---

#### 5.2 — `ChatArea.css` (NEW)

**Consumers:** `ChatArea.tsx`, `ChatInput.tsx`, `ThreadJumpDropdown.tsx`, `Sidebar.tsx`

Classes to move:

```
.rv-chat-area
.rv-chat-area--collapsed
.rv-chat-area--inactive
.rv-chat-area--no-thread
.rv-chat-header
.rv-chat-header-btn
.rv-chat-header-btn--left
.rv-chat-header-btn:focus-visible
.rv-chat-header-btn:hover
.rv-chat-header-btn[aria-expanded="true"]
.rv-chat-header-identity
.rv-chat-header-identity-name
.rv-chat-header-right
.rv-chat-input-container
.rv-chat-footer--disabled
.rv-chat-scroll-sentinel
.rv-chat-composer-meta-row
.rv-chat-more-dropdown
.rv-send-button-group
.rv-send-btn-main
.rv-send-btn-main:hover
.rv-send-btn-secondary
.rv-send-btn-secondary:hover
.rv-send-btn-divider
.rv-send-dropdown-modal
.rv-send-dropdown-content
.rv-send-dropdown-item
.rv-send-dropdown-item:hover
.rv-context-usage-container
.rv-context-usage-bar-standalone
.rv-context-usage-text
```

⚠️ **Override warning — see §3.** Both project `views.css` files have rules targeting
`.rv-chat-area`, `.rv-chat-input-container`, `.rv-chat-footer`. Cascade must be preserved.

---

#### 5.3 — `ToolsPanel.css` (NEW)

**Consumers:** `ToolsPanel.tsx`, `ToolCallBlock.tsx`

Classes to move:

```
.rv-tools-panel
.rv-tools-panel--app
.rv-tools-apps
.rv-tools-tools
.rv-tools-divider
.rv-tool-btn
.rv-tool-btn--app
.rv-tool-btn--tool
.rv-tool-btn.active
.rv-tool-btn.active::before
.rv-tool-btn:hover
.rv-tool-content-area
.rv-tool-content-area[data-expanded="true"]
.rv-tool-content-body
.rv-tool-arrow-icon
.rv-tool-header-btn
.rv-tool-header-btn[data-expanded="true"]
.rv-tool-header-btn[data-interactive="true"]
.rv-tool-icon
.rv-tool-label
```

No project-layer overrides found for these classes. Safe to move.

---

#### 5.4 — `ThemePicker.css` (NEW)

**Consumers:** `ThemePicker.tsx` (sole consumer of all `.rv-tp-*`), `ThemePickerModal.tsx`,
`ThemePickerButton.tsx`

Classes to move (all `.rv-tp-*` + theme-picker wrapper classes):

```
.rv-theme-picker
.rv-theme-picker-arrow
.rv-theme-picker-modal
.rv-theme-picker-scrim
.rv-theme-swatch-btn
.rv-theme-swatch-btn.open
.rv-theme-swatch-btn:hover
.rv-theme-swatch-wrapper
.rv-tp-btn
.rv-tp-btn--primary
.rv-tp-btn--primary:hover:not(:disabled)
.rv-tp-btn:disabled
.rv-tp-btn:hover:not(:disabled)
.rv-tp-color-native  (+ pseudo-elements)
.rv-tp-color-row
.rv-tp-divider
.rv-tp-footer
.rv-tp-group-header
.rv-tp-hex-input
.rv-tp-hex-input:focus
.rv-tp-icon-btn  (+ :disabled :hover)
.rv-tp-label
.rv-tp-mode-btn  (+ variants)
.rv-tp-mode-row
.rv-tp-palette
.rv-tp-palette-row
.rv-tp-save-input
.rv-tp-save-row
.rv-tp-section  (+ :last-of-type)
.rv-tp-slider  (+ label / row / val)
.rv-tp-sliders
.rv-tp-slot  (+ --empty / --filled / --filled:hover)
.rv-tp-slots
.rv-tp-swatch  (+ .active :hover)
.rv-tp-thumb  (+ all sub-classes)
.rv-tp-thumbs
.rv-tp-toggle-icon / label / row  (+ [aria-pressed="true"])
```

No project-layer overrides found. Largest single-move in this phase (~55 rules).

---

#### 5.5 — `secrets/secrets.css` (NEW)

**Consumers:** `secrets/SecretsManager.tsx`, `secrets/SecretsManagerModal.tsx`,
`secrets/SecretsManagerButton.tsx`, `secrets/api-keys/ApiKeysPanel.tsx`

Classes to move (all `.rv-secrets-*`):

```
.rv-secrets-manager  (+ -body / -divider / -header)
.rv-secrets-modal
.rv-secrets-panel  (+ -title)
.rv-secrets-scrim
.rv-secrets-popover-arrow
.rv-secrets-form  (+ -footer / -input / -input--mono / -label / -textarea)
  (+ :focus variants)
.rv-secrets-key-row  (+ variants / :last-child / :has(...))
.rv-secrets-key-main / -right / -name / -meta / -fingerprint / -delete
.rv-secrets-key-list
.rv-secrets-key-delete:hover
.rv-secrets-validation-err / -ok
.rv-secrets-duplicate-prompt
.rv-secrets-confirm-inline / -text
.rv-secrets-desc-counter
.rv-secrets-error-banner
.rv-secrets-empty
.rv-secrets-more-toggle  (+ :hover)
.rv-secrets-add-btn  (+ :hover)
.rv-secrets-btn-primary  (+ :hover:not(:disabled) / :disabled)
.rv-secrets-btn-secondary  (+ :hover)
.rv-secrets-btn-danger  (+ :hover)
.rv-secrets-swatch-btn  (+ .open :hover)
.rv-secrets-swatch-wrapper
```

No project-layer overrides found. Safe to move.

---

### Bucket C — Shared utility (stays or moves to `styles/`)

| Class(es) | Decision | Rationale |
|---|---|---|
| `.rv-dropdown`, `.rv-dropdown-*` | Move to `styles/dropdown.css` | Used by `ChatArea`, `ThreadJumpDropdown`, `CliPickerDropdown`, `Sidebar` — 4 unrelated consumers |
| `.rv-dim-label` | Keep in `App.css` or move to `styles/utilities.css` | Used by 5+ components as a color utility |
| `.rv-thread-dropdown` | Move to `ThreadJumpDropdown.css` (NEW) | Single consumer |
| `.rv-thread-rename-input` | Move to `Sidebar.css` | Consumer is Sidebar/thread rename flow |
| `.rv-cli-picker-dropdown` | Move to `CliPickerDropdown.css` (NEW) | Single consumer |

---

### Bucket D — Phase 4 utility classes (small, stay in App.css)

These were added during Phase 4 and have single-component owners. They are candidates for
Phase 6 file-size splits but are small enough to leave in App.css for now.

| Class | Owner |
|---|---|
| `.rv-agent-tiles-placeholder` | `AgentTiles.tsx` |
| `.rv-content-placeholder-heading` / `-body` | `ContentArea.tsx` |
| `.rv-runtime-module-frame` | `RuntimeModule.tsx` |
| `.rv-doc-tile-img` | `DocumentTile.tsx` |
| `.rv-wf-step-spacer` | `PromptCardView.tsx` |

Defer these to Phase 6 when the components get their own CSS files.

---

## 2. New CSS Files Required

| New file | Classes | Import in |
|---|---|---|
| `components/Sidebar.css` | §B-5.1 | `Sidebar.tsx` |
| `components/ChatArea.css` | §B-5.2 | `ChatArea.tsx` |
| `components/ToolsPanel.css` | §B-5.3 | `ToolsPanel.tsx`, `ToolCallBlock.tsx` |
| `components/ThemePicker.css` | §B-5.4 | `ThemePicker.tsx`, `ThemePickerModal.tsx`, `ThemePickerButton.tsx` |
| `components/secrets/secrets.css` | §B-5.5 | `SecretsManager.tsx` (re-export for sub-components) |
| `styles/dropdown.css` | §C dropdown | Every consumer |
| `components/ThreadJumpDropdown.css` | §C thread-dropdown | `ThreadJumpDropdown.tsx` |
| `components/CliPickerDropdown.css` | §C cli-picker | `CliPickerDropdown.tsx` |

---

## 3. ⚠️ Override Warning — Project-Layer Cascade

Both `fs-dev/ai/settings/views.css` **and** `Fusion-Home/ai/settings/views.css` override the
following classes that are being moved:

```
.rv-sidebar
.rv-sidebar-header
.rv-chat-area
.rv-chat-messages  (+ scrollbar pseudo-elements)
.rv-chat-footer
.rv-chat-input-container
.rv-chat-input-wrapper
.rv-chat-item  (+ variants)
.rv-secondary-body .rv-chat-area
.rv-secondary-body .rv-chat-messages
.rv-secondary-body .rv-chat-footer
.rv-secondary-body .rv-chat-input-wrapper
```

**Rule:** project-layer CSS (`ai/settings/views.css`) is loaded *after* app-layer CSS by the
`useSharedWorkspaceStyles` hook. Moving rules from `App.css` to `ChatArea.css` or `Sidebar.css`
does NOT change the cascade order — both are app-layer. The project-layer overrides will
continue to win.

**Chunk 5.6 (reconciliation):** after all moves are complete, do a final grep of both project
`views.css` files against the moved classes and confirm each rule still resolves correctly.
No selector path changes are expected, but verify.

---

## 4. Chunk Plan

| Chunk | What moves | New file created | Risk | Override check needed? |
|---|---|---|---|---|
| 5.1 | Sidebar + collapse classes | `Sidebar.css` | Medium | Yes — `.rv-sidebar` |
| 5.2 | ChatArea + send + context-usage | `ChatArea.css` | High | Yes — `.rv-chat-*` |
| 5.3 | Tools panel classes | `ToolsPanel.css` | Low | No |
| 5.4 | Theme picker (`.rv-tp-*`) | `ThemePicker.css` | Low | No |
| 5.5 | Secrets manager | `secrets/secrets.css` | Low | No |
| 5.6 | Dropdown → shared + stragglers | `styles/dropdown.css`, `ThreadJumpDropdown.css`, `CliPickerDropdown.css` | Low | No |
| 5.7 | Reconcile project-layer overrides | — | Medium | Required |

**Order matters:** do 5.1 and 5.2 first because they carry override risk. Run the smoke test
after each. Do 5.3–5.6 in any order. Never skip 5.7.

---

## 5. Per-Chunk Procedure

For each chunk:

1. `git status` — must be clean before starting.
2. Read the source lines in `App.css` for the classes being moved (use line offsets, do not
   rely on memory).
3. Create the new CSS file (or append to it if already started this chunk).
4. Delete the rules from `App.css`.
5. Add `import './ComponentName.css'` (or `import '../styles/dropdown.css'`) to each consumer.
6. `cd fusion-studio-client && npm run build` — must pass.
7. `unset ELECTRON_RUN_AS_NODE && ~/projects/Fusion-Home/restart-fusion.sh`
8. Visual smoke: open Electron, switch to fs-dev workspace, click through panels, confirm
   no styling is lost on the affected surface.
9. `git add -A && git commit -m "refactor(phase5-5.X): move <surface> rules to <file>"`

---

## 6. Exit Gate

After all 7 chunks:

```bash
# Zero classes remain in App.css that belong to a single component
grep -c '^\.' fusion-studio-client/src/components/App.css
# Target: ≤ 50 rules (down from ~185)

# Build passes
cd fusion-studio-client && npm run build

# Project overrides still resolve
# Manual: open theme picker, secrets modal, chat sidebar in both workspaces
```

---

*Research completed: 2026-05-18*
*Baseline: `22b4e2e`*
