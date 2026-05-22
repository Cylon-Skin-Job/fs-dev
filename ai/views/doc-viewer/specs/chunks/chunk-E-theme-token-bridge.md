# Chunk E — Theme Token Bridge

← [ROADMAP-REVISED.md](../ROADMAP-REVISED.md)

**Phase:** 2.4
**Depends on:** Chunk D (iframe view loader)
**Ticket:** RCC-0086

---

## Goal

Broadcast computed CSS custom property tokens from the shell to every warm view iframe via `postMessage`. Views validate origin, then write received tokens to `:root` so they render with the same colors, spacing, and typography as the shell.

---

## Decision Log

| # | Question | Resolution |
|---|----------|------------|
| 1 | How does the shell compute tokens? | Parse the already-generated CSS from the `ws-shared-styles-themes` and `ws-shared-styles-variables` style tags. This guarantees the tokens sent to views are identical to the tokens the shell itself uses, with no risk of drift between a JS re-implementation and the server-side `theme-css-generator.js`. |
| 2 | When do we broadcast? | Three triggers: (a) hook mount — catches all existing warm iframes; (b) theme CSS change — `MutationObserver` on the theme style tag fires when `reloadThemesLayer` swaps the CSS; (c) new iframe added — `MutationObserver` on `document.body` catches dynamically-added panels. |
| 3 | What payload shape? | Flat structured object: `{ "--bg-solid": "#000000", "--text-primary": "#ffffff", ... }`. Views iterate `Object.entries()` and call `setProperty` on `:root`. |
| 4 | TargetOrigin `*` or exact? | `*` is safe: the iframe `src` is controlled by the shell (`fusion-studio://`), and the view validates `event.origin === 'fusion-studio://'` on receipt. No sensitive data travels in theme tokens. |
| 5 | Do views need to request tokens on load? | No. Warm iframes are already in the DOM when the hook mounts; the initial broadcast reaches them. If a view loads late (e.g., after a workspace switch), the body `MutationObserver` detects the new iframe and broadcasts current tokens. |

---

## Files Changed

| File | Change |
|------|--------|
| `fusion-studio-client/src/hooks/useThemeTokenBridge.ts` | **New** — parses theme CSS from DOM style tags, broadcasts to all `.rv-view-iframe` elements via `postMessage` |
| `fusion-studio-client/src/components/App.tsx` | Add `useThemeTokenBridge()` call alongside existing hooks |
| `ai/views/doc-viewer/specs/chunks/chunk-E-theme-token-bridge.md` | **New** — this spec |

---

## Shell-Side Implementation

### `hooks/useThemeTokenBridge.ts`

**One job:** observe theme CSS in the DOM and push it to every warm iframe.

```ts
import { useEffect } from 'react';

const THEME_STYLE_ID = 'ws-shared-styles-themes';
const VARIABLES_STYLE_ID = 'ws-shared-styles-variables';
const BROADCAST_TYPE = 'theme:tokens';

/** Extract all --* declarations from raw CSS text into a flat object. */
function parseCssCustomProperties(cssText: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const regex = /(--[\w-]+)\s*:\s*([^;]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cssText)) !== null) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

/** Read current tokens from the two canonical style tags. */
function getCurrentTokens(): Record<string, string> {
  const themeEl = document.getElementById(THEME_STYLE_ID);
  const varsEl = document.getElementById(VARIABLES_STYLE_ID);
  return {
    ...(varsEl ? parseCssCustomProperties(varsEl.textContent || '') : {}),
    ...(themeEl ? parseCssCustomProperties(themeEl.textContent || '') : {}),
  };
}

/** Send tokens to every warm iframe. */
function broadcastToIframes(tokens: Record<string, string>): void {
  const iframes = document.querySelectorAll('.rv-view-iframe');
  iframes.forEach((iframe) => {
    const cw = (iframe as HTMLIFrameElement).contentWindow;
    if (cw) {
      cw.postMessage({ type: BROADCAST_TYPE, tokens }, '*');
    }
  });
}

export function useThemeTokenBridge(): void {
  useEffect(() => {
    // 1. Initial broadcast — all warm iframes already in the DOM.
    const initialTokens = getCurrentTokens();
    if (Object.keys(initialTokens).length > 0) {
      broadcastToIframes(initialTokens);
    }

    // 2. Watch the theme style tag for content changes (reloadThemesLayer swaps it).
    const themeObserver = new MutationObserver(() => {
      broadcastToIframes(getCurrentTokens());
    });

    const observeThemeTag = (el: HTMLElement) => {
      themeObserver.observe(el, { childList: true, characterData: true, subtree: true });
    };

    const existingThemeTag = document.getElementById(THEME_STYLE_ID);
    if (existingThemeTag) {
      observeThemeTag(existingThemeTag);
    }

    // 3. Watch document.head so we catch the style tag if it arrives late.
    const headObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement && node.id === THEME_STYLE_ID) {
            observeThemeTag(node);
            broadcastToIframes(getCurrentTokens());
          }
        }
      }
    });
    headObserver.observe(document.head, { childList: true });

    // 4. Watch for new iframes (workspace switch, add-view).
    const iframeObserver = new MutationObserver((mutations) => {
      let hasNewIframe = false;
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement) {
            if (
              node.matches?.('.rv-view-iframe') ||
              node.querySelector?.('.rv-view-iframe')
            ) {
              hasNewIframe = true;
            }
          }
        }
      }
      if (hasNewIframe) {
        broadcastToIframes(getCurrentTokens());
      }
    });
    iframeObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      themeObserver.disconnect();
      headObserver.disconnect();
      iframeObserver.disconnect();
    };
  }, []);
}
```

**Why `useEffect` with empty deps?** The hook observes the DOM directly — the source of truth for both theme CSS and iframe presence. It does not need to re-run on React state changes.

### `components/App.tsx`

Add one line:

```ts
import { useThemeTokenBridge } from '../hooks/useThemeTokenBridge';
```

Inside `App()`:

```ts
  useSharedWorkspaceStyles();
  useThemeTokenBridge();   // ← new
  useElectronMenu();
```

---

## View-Side Contract

### Expected `postMessage` Payload

```ts
interface ThemeTokensMessage {
  type: 'theme:tokens';
  tokens: Record<string, string>;   // e.g. { "--bg-solid": "#000000", "--space-md": "12px" }
}
```

### Minimal Reference Implementation

Drop this into any iframe-based view's entry JS:

```js
window.addEventListener('message', (event) => {
  // SECURITY: reject messages from unknown origins
  if (event.origin !== 'fusion-studio://') return;

  if (event.data?.type === 'theme:tokens') {
    const root = document.documentElement;
    Object.entries(event.data.tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }
});
```

### Optional: Request Tokens on Load

If a view loads before the shell's initial broadcast (race on cold start), it can request tokens:

```js
window.parent.postMessage({ type: 'theme:request' }, '*');
```

> **Note:** Chunk E does not implement the request handler on the shell side. If this becomes necessary (e.g., slow network causing the theme CSS to load after the iframe), add a listener in `useThemeTokenBridge` that responds to `theme:request` with `getCurrentTokens()`. This is left as a forward-compatible extension point.

---

## Security Notes

- **Origin validation is mandatory on the view side.** Every iframe view must check `event.origin === 'fusion-studio://'` before acting on `postMessage` data.
- **No sensitive data in tokens.** Theme tokens are public CSS values (colors, spacing scales). Even if a malicious page somehow received them, no secrets are exposed.
- **`targetOrigin: '*'` is acceptable** because the view enforces origin on receipt, and the iframe `src` is shell-controlled.

---

## Smoke Tests

- [ ] App boots cleanly with `useThemeTokenBridge` — no console errors.
- [ ] Switching themes updates the theme style tag and triggers a broadcast.
- [ ] View iframe logs received tokens (dev snippet) and applies them to `:root`.
- [ ] Adding a new panel (which renders a new iframe) receives tokens immediately.
- [ ] `event.origin !== 'fusion-studio://'` messages are ignored by the view.
- [ ] Non-iframe panels are unaffected — no `postMessage` errors in console.

---

## Follow-on Work

| Chunk | What |
|-------|------|
| J | Issues-viewer redesign — first view to consume theme tokens inside an iframe. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-22 | Initial spec written. |
