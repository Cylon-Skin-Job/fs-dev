---
name: Custom Iframe
description: Local-server iframe display for user-created custom views; not a general internet browser.
metadata:
  incoming-edges:
    - Workspaces And Views
    - View Architecture
  outgoing-edges:
    - Browser
  source-files:
    - fusion-studio-client/src/components/browser/CustomViewer.tsx
    - fusion-studio-client/src/components/browser/AppChrome.tsx
    - fusion-studio-client/src/components/browser/urlValidator.ts
    - ai/<machine>/System/Views/<custom-view-folder>/manifest.md
  connected-skills: []
  related-trigger-files: []
---

Use this page for the Custom Iframe view.

## Purpose

Custom Iframe is a single display for a user-created local custom view. The expected use case is a developer running a local server, such as `http://localhost:3000`, and loading that app into Fusion Studio.

Custom Iframe is not an internet browser. It should not be used for general browsing, web search, or arbitrary external sites. Use [Browser](../005-Browser/PAGE.md) for that.

## Current Implementation

- View config: `ai/<machine>/System/Views/<custom-view-folder>/manifest.md`
- View type: `custom`
- Renderer component: `fusion-studio-client/src/components/browser/CustomViewer.tsx`
- Default URL: `http://localhost:3000`
- Chrome: collapsible app chrome, hidden by default.
- Navigation: no back/forward tab model; the embedded app owns its own routing.
- Frame: sandboxed iframe with `allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads`.

## Local-Only Rule

Custom Iframe only accepts local server URLs. Current validation allows:

- `localhost`
- `127.0.0.1`
- `[::1]`

If a user enters an external internet URL, `CustomViewer` rejects it. This protects the product model: Custom Iframe is a local custom view display, not a second browser.

## Origin Lock

Custom Iframe records the initial local origin and rejects navigation to a different origin. If the embedded app tries to leave that origin, the viewer returns to the initial URL.

This is a display boundary, not a general security sandbox. The embedded local app is trusted as user-created code, but it still cannot access Node.js or Electron APIs through the iframe.

## Local Server Requirements

The user's local server must allow iframe embedding. Default security middleware can block this.

Useful development headers include:

```http
Content-Security-Policy: frame-ancestors 'self' http://localhost:* http://127.0.0.1:*;
```

Avoid documenting `X-Frame-Options: ALLOWALL` as a portable production answer. Modern browsers do not support it consistently; `Content-Security-Policy: frame-ancestors` is the clearer contract.

## Historical Notes

Legacy docs described a WebContentsView migration for custom-viewer. Current code uses `CustomViewer.tsx`, a React-rendered iframe with local-only validation. Treat WebContentsView as historical/planned unless current implementation changes.

## Related

- [Browser](../005-Browser/PAGE.md) - internet-capable browsing.
- [View Architecture](../002-View_Architecture/PAGE.md) - view loading and content roots.
