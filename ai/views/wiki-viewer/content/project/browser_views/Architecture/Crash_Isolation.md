# Crash Isolation

This article explains why a standard `<iframe>` cannot be crash-isolated, and why `WebContentsView` is the only robust solution for user-built apps.

---

## The Problem

A standard `<iframe>` runs in the **same Chromium renderer process** as its parent page. In Electron, this means:

- Fusion Studio's UI and the embedded website share one renderer process
- If the website infinite-loops, exhausts memory, or triggers a GPU fault, **the entire Fusion Studio window crashes**
- There is no sandbox attribute, CSS property, or JavaScript workaround that changes this
- Chromium does not offer per-iframe process isolation as a controllable API

This is not a bug. It is a fundamental architectural limitation of how Chromium renders same-origin iframes.

---

## What We Tried

### Cross-Origin Iframe (OOPIF)

Chromium's site isolation **may** run cross-origin iframes in a separate process. However:
- It is disabled on systems with low RAM
- It is not guaranteed for same-origin content
- There is no Electron API to force it
- A shared-process fallback always exists

**Verdict:** Not reliable enough for a developer tool.

### `<webview>` Tag

Electron's `<webview>` tag creates a separate guest view with its own renderer process. This does provide crash isolation.

However, Electron's official documentation states:

> *"Electron's `webview` tag is based on Chromium's `webview`, which is undergoing dramatic architectural changes. This impacts the stability of webviews, including rendering, navigation, and event routing. We currently recommend to not use the `webview` tag."*

**Verdict:** Crash-isolated but officially discouraged. Not a stable foundation.

---

## The Solution: WebContentsView

`WebContentsView` is an Electron API (stable since v29, recommended since v30) that creates a native Chromium view with its own `WebContents` and renderer process.

### How It Works

```
Main Process
└── BrowserWindow
    ├── HTML UI (Fusion Studio)  ← renderer process A
    └── WebContentsView          ← renderer process B (isolated)
```

- If renderer process B crashes, process A stays alive
- The main process receives `render-process-gone` on the view's `webContents`
- The panel shows a crash overlay; the user can reload
- Fusion Studio never dies

### Why This Is Different from BrowserView

Electron previously had a `BrowserView` API. It was deprecated in Electron 30 and replaced by `WebContentsView`.

| | `BrowserView` (deprecated) | `WebContentsView` (current) |
|---|---|---|
| Base class | Custom Electron implementation | Chromium's native `views::WebContentsView` |
| Future stability | ❌ Custom code, harder to maintain | ✅ Tied to Chromium's UI framework |
| API | `win.setBrowserView(view)` | `win.contentView.addChildView(view)` |

---

## Graceful Crash Recovery

Even with `WebContentsView`, crashes still happen. The system handles them gracefully:

1. **Detection:** Main process listens to `view.webContents.on('render-process-gone', ...)`
2. **Notification:** Main sends `browser-panel:crashed` IPC to renderer
3. **Overlay:** Renderer shows a crash placeholder with a reload button
4. **Reload:** User clicks reload; main creates a new `WebContentsView` or reloads the existing one
5. **State:** `localStorage`, `IndexedDB`, cookies, and the user's Node backend survive

---

## When Crash Isolation Matters

| Scenario | Recommendation |
|----------|---------------|
| User loads their own experimental Node app | **Required.** Use `WebContentsView`. |
| AI automation on trusted websites | Optional. Iframe is acceptable. |
| General web browsing (Google, docs, etc.) | Optional. Iframe is acceptable. |
| Loading untrusted third-party apps | **Required.** Use `WebContentsView`. |

---

## For AI Agents

**If a user asks you to "contain crashes" or "isolate the browser panel":**

- Do NOT suggest sandbox attributes on an iframe. They do not provide process isolation.
- Do NOT suggest `<webview>`. It is officially discouraged.
- **DO** suggest `WebContentsView`. It is the only officially supported, crash-isolated solution.
- Reference the migration spec at `docs/CUSTOM_VIEWER_WEBCONTENTSVIEW_SPEC.md`.
