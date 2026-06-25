---
name: Browser
description: Internet-capable browsing surface for web navigation, testing, and automation, implemented by the WebBrowser iframe component with visible chrome and tabs.
metadata:
  incoming-edges:
    - Workspaces And Views
    - View Architecture
  outgoing-edges:
    - Custom Iframe
  source-files:
    - fusion-studio-client/src/components/browser/WebBrowser.tsx
    - fusion-studio-client/src/components/browser/BrowserChrome.tsx
    - fusion-studio-client/src/components/browser/BrowserTabs.tsx
    - fusion-studio-client/src/components/browser/urlValidator.ts
    - fusion-studio-client/electron/main.cjs
    - ai/views/browser-viewer/index.json
  connected-skills: []
  related-trigger-files: []
---

Use this page for the general Browser view.

## Purpose

Browser is the internet-capable browsing surface. It is for web navigation, testing, and automation where the user expects visible browser chrome, tabs, URL entry, back/forward, and reload.

Browser is not the same thing as Custom Iframe. Browser can navigate to general `http://` and `https://` destinations allowed by URL validation. Custom Iframe is for a single local server view.

## Current Implementation

- View config: `ai/views/browser-viewer/index.json`
- View type: `browser`
- Renderer component: `fusion-studio-client/src/components/browser/WebBrowser.tsx`
- Chrome: always-visible URL bar and navigation buttons unless disabled by config.
- Tabs: managed in `WebBrowser.tsx` with one iframe representing the active tab.
- Frame: sandboxed iframe with `allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads`.

## Navigation Model

Browser keeps a manual tab/history model in React state. User-entered URLs are validated, normalized, and pushed into the active tab history. Same-origin iframe loads can sync URL/title data back into the tab. Cross-origin pages are restricted by the browser same-origin policy, so the parent cannot reliably inspect the embedded document.

Electron main also tracks browser iframe navigations so the address bar can update for cross-origin sites where possible.

## URL Rules

Shared URL validation allows standard `http:` and `https:` URLs, normalizes bare `localhost`, blocks dangerous schemes, and blocks most bare IP addresses except local development hosts.

Browser may go out to the internet. Do not apply Custom Iframe's local-only rule to Browser.

## Known Limits

- It is still iframe-based, not a full Chromium browser process.
- Cross-origin navigation observability is limited.
- Some websites block iframe embedding with `X-Frame-Options` or `Content-Security-Policy`.
- The sandbox intentionally omits top navigation so embedded pages cannot redirect Fusion Studio.

## Historical Notes

Legacy Browser Views docs discussed WebContentsView and custom-viewer as one combined browser system. That is no longer the target model. Treat WebContentsView material as historical or planned unless current code reintroduces it.

## Related

- [Custom Iframe](../006-Custom_Iframe/PAGE.md) - local custom view display.
- [View Architecture](../002-View_Architecture/PAGE.md) - view loading and content roots.
