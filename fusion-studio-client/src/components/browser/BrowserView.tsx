/**
 * @module BrowserView
 * @role Browser / app container view for external URLs
 *
 * Renders a sandboxed iframe with optional chrome bar (URL input, nav buttons).
 * Supports two modes:
 *   - "browser": free navigation, editable URL bar
 *   - "app": locked to declared origin, read-only URL bar
 *
 * Phase 1: single tab, no history persistence, no fusionStudio API injection.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import './BrowserView.css';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import type { PanelConfig } from '../../lib/panels';
import { BrowserChrome } from './BrowserChrome';
import { BrowserContextMenu } from './BrowserContextMenu';
import type { MenuItem } from './BrowserContextMenu';
import { validateUrl, getUrlOrigin } from './urlValidator';

export interface BrowserViewProps {
  config: PanelConfig;
}

interface BrowserSettings {
  url?: string;
  homepage?: string;
  mode?: 'browser' | 'app';
  fullscreen?: boolean;
  chrome?: {
    urlBar?: boolean;
    tabs?: boolean;
    navButtons?: boolean;
  };
}

function readSettings(config: PanelConfig): BrowserSettings {
  return (config.settings || {}) as BrowserSettings;
}

function normalizeInitialUrl(raw: string | undefined): string {
  if (!raw) return 'about:blank';
  const result = validateUrl(raw);
  return result.valid && result.normalizedUrl ? result.normalizedUrl : 'about:blank';
}

export const BrowserView: React.FC<BrowserViewProps> = ({ config }) => {
  const panelId = config.id;
  useViewLayoutStyles(panelId);

  const settings = readSettings(config);
  const initialUrl = normalizeInitialUrl(settings.url || settings.homepage);
  const mode = settings.mode === 'app' ? 'app' : 'browser';
  const chromeFlags = settings.chrome || {};
  const showUrlBar = chromeFlags.urlBar !== false;
  const showNavButtons = chromeFlags.navButtons !== false;
  const initialFullscreen = settings.fullscreen === true;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // History stack for back/forward (refs to avoid re-renders on every load)
  const historyRef = useRef<string[]>([initialUrl]);
  const historyIndexRef = useRef(0);

  // Track programmatic navigations to avoid double-push from load event
  const pendingNavRef = useRef<string | null>(null);

  const canGoBack = historyIndexRef.current > 0;
  const canGoForward = historyIndexRef.current < historyRef.current.length - 1;

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Navigate to a new URL (user-initiated or validation-corrected)
  const navigateTo = useCallback((url: string) => {
    const result = validateUrl(url);
    if (!result.valid || !result.normalizedUrl) {
      console.warn('[BrowserView] Blocked navigation:', result.reason);
      return;
    }
    const target = result.normalizedUrl;
    pendingNavRef.current = target;

    // Push to history, truncating forward entries
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    historyRef.current = [...stack.slice(0, idx + 1), target];
    historyIndexRef.current = historyRef.current.length - 1;

    setCurrentUrl(target);
  }, []);

  const handleBack = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const target = historyRef.current[historyIndexRef.current];
    pendingNavRef.current = target;
    setCurrentUrl(target);
  }, []);

  const handleForward = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const target = historyRef.current[historyIndexRef.current];
    pendingNavRef.current = target;
    setCurrentUrl(target);
  }, []);

  const handleReload = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.contentWindow?.location.reload();
    } catch {
      // Cross-origin reload fallback: re-assign src
      const src = iframe.src;
      iframe.src = 'about:blank';
      requestAnimationFrame(() => {
        iframe.src = src;
      });
    }
  }, []);

  const menuItems = React.useMemo<MenuItem[]>(
    () => [
      {
        label: isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen',
        icon: isFullscreen ? 'fullscreen_exit' : 'fullscreen',
        action: handleToggleFullscreen,
      },
      { separator: true, label: '', action: () => {} },
      {
        label: 'Reload',
        icon: 'refresh',
        action: handleReload,
      },
    ],
    [isFullscreen, handleToggleFullscreen, handleReload]
  );

  // Handle iframe load events
  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let loadedUrl: string | null = null;

    try {
      // Same-origin only (localhost apps)
      loadedUrl = iframe.contentWindow?.location.href || null;
    } catch {
      // Cross-origin: can't read location
      loadedUrl = null;
    }

    if (!loadedUrl || loadedUrl === 'about:blank') {
      return;
    }

    // App mode: enforce origin lock
    if (mode === 'app') {
      const allowedOrigin = getUrlOrigin(initialUrl);
      const loadedOrigin = getUrlOrigin(loadedUrl);
      if (allowedOrigin && loadedOrigin && loadedOrigin !== allowedOrigin) {
        console.warn('[BrowserView] App mode blocked navigation to different origin:', loadedOrigin);
        // Redirect back to allowed URL
        pendingNavRef.current = initialUrl;
        setCurrentUrl(initialUrl);
        return;
      }
    }

    // If this load was triggered by a programmatic nav, consume it
    if (pendingNavRef.current === loadedUrl) {
      pendingNavRef.current = null;
      setCurrentUrl(loadedUrl);
      return;
    }

    // Otherwise it's a user navigation inside the iframe (same-origin only)
    // Push to history
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    historyRef.current = [...stack.slice(0, idx + 1), loadedUrl];
    historyIndexRef.current = historyRef.current.length - 1;
    setCurrentUrl(loadedUrl);
  }, [mode, initialUrl]);

  // Keep iframe src in sync with currentUrl
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (iframe.src !== currentUrl) {
      iframe.src = currentUrl;
    }
  }, [currentUrl]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const containerClass = isFullscreen
    ? 'rv-browser-view-fullscreen'
    : 'rv-browser-view';

  return (
    <div className={containerClass} onContextMenu={handleContextMenu}>
      {!isFullscreen && (
        <BrowserChrome
          url={currentUrl}
          onUrlChange={navigateTo}
          onBack={handleBack}
          onForward={handleForward}
          onReload={handleReload}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenMenu={(e) => setContextMenu({ x: e.clientX, y: e.clientY })}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          showUrlBar={showUrlBar}
          showNavButtons={showNavButtons}
          isFullscreen={isFullscreen}
          mode={mode}
        />
      )}
      <div className="rv-browser-iframe-container">
        <iframe
          ref={iframeRef}
          className="rv-browser-iframe"
          src={currentUrl}
          title={config.name || panelId}
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={handleLoad}
        />
      </div>
      {contextMenu && (
        <BrowserContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
