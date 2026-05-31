# Overview

Fusion Studio has three browser technologies, each chosen for a specific use case. This article compares them so you know which one to use, fix, or extend.

---

## Comparison Table

| Feature | Iframe `BrowserView` | `<webview>` `BrowserViewer` | `WebContentsView` (Custom Viewer) |
|---------|---------------------|---------------------------|----------------------------------|
| **Renderer** | Shared with parent | Separate Chromium process | Separate Chromium process |
| **History** | Manual stack in refs | Native `goBack()` / `goForward()` | Native via `webContents` API |
| **DevTools** | Parent window only | Per-webview DevTools | Per-view DevTools |
| **Sessions** | Shared cookies | Isolated via `partition` | Isolated per `WebContents` |
| **Events** | Limited (`onLoad`) | Rich (`did-navigate`, `page-title-updated`) | Rich (`did-navigate`, `page-title-updated`) |
| **Crash isolation** | ❌ No | ✅ Yes | ✅ Yes |
| **Electron support** | ✅ Standard HTML | ❌ Discouraged | ✅ Official replacement |
| **Layout reliability** | ✅ Standard CSS | ❌ Fragile in flexbox | ✅ Explicit `setBounds()` |
| **Z-index** | Normal DOM | Normal DOM | Paints on top of HTML |

---

## Iframe BrowserView

**What it is:** A React component that renders a sandboxed `<iframe>` with a chrome bar overlay.

**Use case:** General web browsing, AI automation, testing. Anything where the user navigates the open web.

**Why it exists:** It is the simplest, most standards-based way to embed web content. No main-process code, no IPC, no Electron-specific APIs.

**Its fatal flaw:** It cannot be crash-isolated. The iframe runs in the same renderer process as Fusion Studio. If a website infinite-loops or hits a GPU bug, the entire window dies.

**When to use it:** When you need a general-purpose browser and crash isolation is not required.

---

## `<webview>` BrowserViewer

**What it is:** A React component that renders an Electron `<webview>` tag.

**Use case:** Was intended as a native browser panel with full Chromium features.

**Why it exists:** It provided native navigation events, per-webview DevTools, and session isolation via `partition`.

**Its fatal flaw:** Electron officially discourages `<webview>` because Chromium's webview implementation is undergoing dramatic architectural changes. Stability issues include rendering bugs, navigation failures, and event routing problems.

**When to use it:** **Never for new work.** It is maintained only for backward compatibility.

---

## WebContentsView (Custom Viewer)

**What it is:** An Electron main-process API that creates a native Chromium view, sized explicitly via `setBounds()`.

**Use case:** The `custom-viewer` app container — user pastes in their Node server address, hides the chrome bar, and treats it as a native app panel.

**Why it exists:** It is the officially supported replacement for both `<webview>` and the deprecated `BrowserView` API. It provides crash isolation, rich navigation events, and per-view DevTools.

**Its trade-off:** Requires main-process code and IPC for layout bounds. The view paints on top of HTML, so Fusion Studio overlays must hide or resize it.

**When to use it:** When you need crash isolation — especially for user-built apps that may be buggy or experimental.

---

## Decision Flowchart

```
Do you need crash isolation?
├── Yes → Use WebContentsView
│         └── Is this for general web browsing with chrome visible?
│               └── Yes → You also need IPC for the chrome bar
│               └── No  → Full panel bounds, minimal IPC
└── No  → Use iframe
          └── Do you need per-view DevTools or session isolation?
                └── Yes → Consider WebContentsView anyway
                └── No  → iframe is simpler
```

---

## Historical Context

- **Phase 1:** Built iframe `BrowserView` for general browsing and `<webview>` `BrowserViewer` for native features.
- **Phase 2:** Discovered `<webview>` height bug in flexbox (renders at ~25% height). Research confirmed Electron discourages `<webview>`.
- **Phase 3:** Decided `WebContentsView` is the official, future-proof path for crash-isolated panels. Iframe stays for general browsing.
