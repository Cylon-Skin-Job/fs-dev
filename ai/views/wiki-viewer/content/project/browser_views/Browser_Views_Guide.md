# Browser Views

Fusion Studio embeds external web content through three browser technologies: an **iframe-based general browser**, a **webview-based native browser**, and a **WebContentsView-based app container**. Each serves a different purpose, with different crash-isolation guarantees, security models, and layout behaviors.

This guide is the entry point for understanding how browser panels work, why we chose each technology, and what you need to know to build or maintain them.

---

## The Three Browser Technologies

| Technology | Use Case | Crash Isolated? | Process | Officially Supported? |
|------------|----------|----------------|---------|----------------------|
| `<iframe>` | General browsing, AI automation | ❌ No | Shared with parent | ✅ Yes |
| `<webview>` | Native browser panel (deprecated path) | ✅ Yes | Separate | ❌ Discouraged |
| `WebContentsView` | App container for user-built apps | ✅ Yes | Separate | ✅ Yes |

**Why three?** Because no single technology satisfies all use cases. The iframe is simple and sufficient for general web browsing. The webview gave us native Chromium features but Electron actively discourages it. WebContentsView is the future: officially supported, crash-isolated, and tied to Chromium's rendering pipeline.

---

## Quick Navigation

### Architecture
- [Overview](Architecture/Overview.md) — Compare all three technologies side-by-side
- [Crash Isolation](Architecture/Crash_Isolation.md) — Why iframe cannot be contained, and why that matters
- [Process Model](Architecture/Process_Model.md) — Renderer vs main process, IPC flow, bounds management

### Custom Viewer
- [WebContentsView Migration](Custom_Viewer/WebContentsView_Migration.md) — How the app container is built
- [IPC Protocol](Custom_Viewer/IPC_Protocol.md) — Messages between renderer and main process
- [Lifecycle](Custom_Viewer/Lifecycle.md) — Create, show, hide, destroy, crash recovery

### Iframe Browser
- [Sandbox](Iframe_Browser/Sandbox.md) — What sandbox tokens enable and why each matters
- [Cross-Origin Limitations](Iframe_Browser/Cross_Origin_Limitations.md) — What the parent can and cannot observe
- [History and Navigation](Iframe_Browser/History_Navigation.md) — Manual history stack, back/forward behavior

### Security
- [Trust Model](Security/Trust_Model.md) — Same-origin access, cross-origin restrictions, developer-tool assumptions
- [URL Validation](Security/URL_Validation.md) — Blocked schemes, allowed origins, bare IP rules
- [CSP Requirements](Security/CSP_Requirements.md) — X-Frame-Options and frame-ancestors for user apps

### API Reference
- [Components](API_Reference/Components.md) — BrowserView, BrowserChrome, BrowserViewer, WebContentsBrowser
- [Config Schema](API_Reference/Config_Schema.md) — `index.json` fields for browser panels
- [Events](API_Reference/Events.md) — DOM events, IPC events, lifecycle hooks

---

## For AI Agents

If you are an AI agent reading this wiki to implement or fix browser-related code:

1. **Start with [Architecture/Overview.md](Architecture/Overview.md)** to understand which technology applies to your task.
2. **If the task involves `custom-viewer`** (app container), read [Custom_Viewer/WebContentsView_Migration.md](Custom_Viewer/WebContentsView_Migration.md) — this is the current architecture target.
3. **If the task involves the iframe browser** (general browsing), read [Iframe_Browser/Sandbox.md](Iframe_Browser/Sandbox.md) and [Iframe_Browser/Cross_Origin_Limitations.md](Iframe_Browser/Cross_Origin_Limitations.md) — these cover the known brittleness.
4. **If the task involves the `<webview>` panel**, know that Electron discourages `<webview>`. Only fix bugs; do not add features.
5. **Security decisions are documented in [Security/Trust_Model.md](Security/Trust_Model.md)** — do not weaken the sandbox or validation rules without updating that page.

---

## For Humans

If you are a developer or user trying to understand how browser panels behave:

- **The `custom-viewer` is an app container.** Paste in your Node server address, hide the chrome bar, and your app fills the panel. It runs in a separate process, so if your app crashes, Fusion Studio stays alive.
- **The iframe browser is a general web browser.** It has back/forward/reload and a URL bar. It shares the renderer process with Fusion Studio, so a crash in a website can crash the whole window.
- **User apps must allow iframe embedding.** If you load your app in the iframe browser (not the custom-viewer), your server must send `X-Frame-Options: ALLOWALL` or a permissive `Content-Security-Policy`.
