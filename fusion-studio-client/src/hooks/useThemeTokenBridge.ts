/**
 * @module useThemeTokenBridge
 * @role Observe theme CSS in the DOM and broadcast computed tokens to all
 *       warm view iframes via postMessage.
 *
 * Three triggers:
 *   1. Mount — sends current tokens to all existing .rv-view-iframe elements.
 *   2. Theme CSS change — MutationObserver on the ws-shared-styles-themes
 *      style tag fires when reloadThemesLayer swaps the CSS.
 *   3. New iframe added — MutationObserver on document.body catches
 *      dynamically-created panels (workspace switch, add-view).
 *
 * View contract:
 *   window.addEventListener('message', (event) => {
 *     if (event.origin !== 'fusion-studio://') return;
 *     if (event.data?.type !== 'theme:tokens') return;
 *     Object.entries(event.data.tokens).forEach(([k, v]) => {
 *       document.documentElement.style.setProperty(k, v);
 *     });
 *   });
 */

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
