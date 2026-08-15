# Code Standards

How to build views, workspaces, and frontends in Fusion Studio. Reference this before writing code.

---

## Three-Layer Architecture

Fusion Studio splits across three processes. Know which layer owns your code.

| Layer | Process | Owns | Must NOT Touch |
|-------|---------|------|----------------|
| **Server** | Node.js (always runs) | Business logic, DB, file watchers, WebSocket routing | DOM, native APIs, renderer state |
| **Main** | Electron main | Native APIs (dialogs, menus, protocol handlers) | DOM, business logic |
| **Renderer** | Electron renderer | UI, React, Zustand stores for shell chrome | Native APIs, business logic, filesystem directly |

**The rule:** Data flows down (Server → Main → Renderer). Events flow up (Renderer → Main → Server). Nothing skips a layer.

---

## View Rendering Model

Built-in Fusion Studio views are React components mounted by the renderer shell. Iframes are reserved for custom user-created views, local embedded apps, and browser-style surfaces.

### Built-In View Pattern

```
React view component -> renderer store/service -> WebSocket -> Node server
```

Built-in views never talk to the filesystem directly. They use renderer stores, hooks, or service modules, which send WebSocket requests to the server when data is needed.

### Custom Iframe Pattern

```
Custom iframe -> renderer shell boundary -> WebSocket -> Node server
```

Custom iframe views are user-created surfaces. They may communicate with the shell through postMessage or an approved bridge. The shell proxies any server/file access.

Custom iframe views receive, when the shell provides them:
- `theme` — CSS variables injected on load
- `state` — per-view state updates
- `file-tree` — directory listings
- `file-content` — file contents

Custom iframe views emit, when the shell supports them:
- `state:update` — pane width, scroll position, selected item
- `file:open` — request to open a file
- `file:save` — request to save a file
- `chat:send` — send a message to the active thread

**Origin validation:** Custom iframe views must validate the trusted sender/origin before handling postMessage payloads. `fusion-studio://` applies only to shell-controlled custom-protocol iframe URLs; local-server custom views should validate their configured local origin.

---

## View Templates vs Instances

**Templates** live in `System Files/views/`. They are the canonical HTML/CSS/JS for each view type. You never edit a template in a user workspace.

**Instances** live in `<workspace>/ai/views/`. They reference a template and store per-view state.

```json
// Instance index.json
{
  "id": "wiki-01",
  "templateId": "wiki",
  "label": "Wiki",
  "icon": "menu_book",
  "rank": 1,
  "type": "navigation",
  "state": {
    "activePage": "enforcement/code-standards",
    "expandedNodes": ["enforcement"]
  }
}
```

**Auto-numbered IDs:** The first instance of a template is `{id}-01`. Copies get `-02`, `-03`, etc. Built-ins are always the `-01` baseline.

---

## Workspace Anatomy

A workspace is a folder with an `ai/` directory.

```
<workspace>/
├── ai/
│   ├── settings/
│   │   ├── themes.json          ← workspace theme overrides
│   │   ├── state.json           ← default layout state
│   │   ├── variables.css        ← CSS variable fallbacks
│   │   ├── components.css       ← global component styles
│   │   ├── views.css            ← global view chrome
│   │   └── tints.css            ← tint selector catalog
│   └── views/
│       ├── file-viewer/
│       │   ├── index.json       ← view identity + settings
│       │   ├── content.json     ← display type + chat config
│       │   ├── settings/
│       │   │   ├── layout.json  ← pane widths, popup geometry
│       │   │   └── layout.css   ← view-specific layout rules
│       │   └── chat/            ← chat enabled marker
│       └── wiki-01/
│           ├── index.json       ← instance config + state
│           └── ...
```

**No workspace templates.** Only view templates. Workspaces are created from the `ai-template` blueprint and populated with view instances.

---

## State: Persistent vs Session

State is split into two layers. AI agents must respect the boundary.

### Persistent (survives restart)
- Pane widths: `leftSidebar`, `leftChat`, `rightCol`, `rightSecondary`
- Collapse states: `leftSidebar`, `leftChat`
- Popup geometry: `x`, `y`, `width`, `height`
- File explorer tabs (working set)
- Per-view filters and sort order

### Session (cleared on workspace close or nightly refresh)
- `popup.open`, `popup.threadId`
- `currentThreadId`, `secondaryThreadId`
- `activeViewId` — which panel is focused
- `scrollPosition`, `selectedItemId`, `activeWorkflow`

**Where it lives:**
- Workspace default: `ai/settings/state.json`
- Per-view override: embedded in the view instance `index.json` under `state`

---

## File Size Guidance

One job per file, not a line count.

| Size | Action |
|------|--------|
| Under 200 lines | Don't think about it |
| 200–400 lines | Check if it's still one job |
| Over 400 lines | Almost certainly doing too much — split it |

A 350-line SSE controller handling parsing, buffering, and recovery = fine (one job). A 250-line file rendering UI + calling APIs + managing state = not fine (three jobs).

**The test:** Can you describe what this file does in one sentence without "and"? If not, split it.

---

## Modularity Rules

1. **One job per file.** Not one function — one responsibility.
2. **No God files.** If a file is the only place where X, Y, and Z happen, it's doing too much.
3. **Imports tell the story.** If a file imports from 5+ unrelated modules, it's probably orchestrating too many concerns.
4. **Extract when the second consumer appears.** Don't pre-extract. Three similar lines of code is better than a premature abstraction.
5. **Delete, don't deprecate.** No `_unused` prefixes, no `// removed` comments. If it's dead, delete it.

### View-Level Modularity

Views are naturally modular at the component or surface boundary. A wiki view should not crash a file-explorer view, and a custom iframe view should not assume it owns shell state.

Within a view, the same rules apply. If a React view component starts owning unrelated concerns, split it into hooks, components, or services. If a custom iframe view's `app.js` exceeds 400 lines, split it into modules the custom view loads. Do not split a single concept into multiple views just because one file got long.

---

## CSS Architecture

### Global CSS (`ai/settings/`)

Loaded once per workspace switch. Applies everywhere.

| File | Purpose |
|------|---------|
| `variables.css` | Fallback CSS variables |
| `themes.css` | Generated from `themes.json` — `:root` variables |
| `components.css` | Global component styles |
| `views.css` | Global view chrome (chat, sidebar, thread list) |
| `tints.css` | Tint selector catalog (`body[data-tint-*]`) |

**Load order is load-bearing:** `variables` → `themes` → `components` → `views` → `tints`. Both `variables.css` and `themes.css` target `:root`; the last one injected wins. If `variables.css` loads after `themes.css`, the user's saved theme is silently overwritten.

### Per-View CSS (`ai/views/<viewer>/settings/layout.css`)

Scoped to `[data-panel="{viewer}"]`. Layout only: widths, heights, flex/grid, visibility. Never colors, borders, or `body[data-tint-*]` responses.

### Theme vs State Boundary

| System | Stored In | Scope | Examples |
|--------|-----------|-------|----------|
| **Theme** | `ai/settings/themes.json` | Workspace-wide | Colors, surfaces, borders, sliders, toggles |
| **State** | `ai/settings/state.json` + per-view `state` | Per-view | Pane widths, collapse, popup geometry, thread IDs |

**The rule:** If it affects color or visual style, it is a theme property. If it affects position or visibility of a pane, it is state.

---

## Naming Conventions

```
Files:     feature-view.js, feature-controller.js, feature-service.js
Events:    domain:action          (chat:turn_end, ticket:claimed)
CSS vars:  --palette-name, --bg-name, --text-name
Classes:   .rv-component, .rv-component-part
View IDs:  wiki-01, file-viewer-01, tools-02
```

---

## Anti-Patterns

| Don't | Do |
|-------|----|
| View calls server directly | Use a renderer store/service or approved shell bridge |
| Custom iframe skips origin check on postMessage | Validate the trusted custom-protocol or local-server origin |
| Hardcode color `#FF6B35` | Use `var(--palette-accent, #FF6B35)` |
| Put business logic in Electron main | Main owns native APIs only |
| Put native API calls in renderer | Renderer emits event → main handles it |
| Store tint values in per-view state | Tints are theme properties |
| Create per-view CSS programmatically | Per-view CSS is human-only |
| Reference `ai/views/settings/` | Global files live in `ai/settings/` |
| One giant custom-view app.js | Split into modules loaded by that custom view |
| Add features beyond what was asked | Do what was asked, nothing more |

---

## Planning Phase Checklist

Before writing code:

- [ ] Each new file has one job (describable in one sentence without "and")
- [ ] No file will exceed 400 lines
- [ ] I know which layer owns this code (server / main / renderer / view)
- [ ] CSS values use variables with fallbacks
- [ ] Built-in views use renderer services; custom iframes use the shell bridge, not direct server/filesystem access
- [ ] No premature abstractions (is there actually a second consumer?)
- [ ] No scope creep (does this change do more than what was asked?)
