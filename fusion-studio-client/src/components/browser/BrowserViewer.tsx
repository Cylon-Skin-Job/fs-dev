/**
 * @module BrowserViewer
 * @role Full browser panel using Electron's native <webview> tag
 *
 * Unlike the iframe-based BrowserView, this uses a real Chromium renderer
 * process with proper history, devtools, and session isolation.
 *
 * Features:
 *   - Real back/forward (webview history, not a manual stack)
 *   - Origin lock in app mode
 *   - Partitioned sessions per view
 *   - Chrome bar with URL input, nav buttons, toggle
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import './browser-viewer.css';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import type { PanelConfig } from '../../lib/panels';
import { BrowserViewerChrome } from './BrowserViewerChrome';
import { validateUrl, getUrlOrigin } from './urlValidator';

export interface BrowserViewerProps {
  config: PanelConfig;
}

interface BrowserSettings {
  url?: string;
  homepage?: string;
  mode?: 'browser' | 'app';
  partition?: string;
  chrome?: {
    urlBar?: boolean;
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

/** Electron webview element API subset we use */
interface WebviewTag extends HTMLElement {
  src: string;
  loadURL(url: string): void;
  getURL(): string;
  goBack(): void;
  goForward(): void;
  reload(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  getTitle(): string;
  partition?: string;
  allowpopups?: boolean;
  webpreferences?: string;
}

export const BrowserViewer: React.FC<BrowserViewerProps> = ({ config }) => {
  const panelId = config.id;
  useViewLayoutStyles(panelId);

  const settings = readSettings(config);
  const initialUrl = normalizeInitialUrl(settings.url || settings.homepage);
  const mode = settings.mode === 'app' ? 'app' : 'browser';
  const partition = settings.partition || `persist:${panelId}`;
  const chromeFlags = settings.chrome || {};
  const showUrlBar = chromeFlags.urlBar !== false;
  const showNavButtons = chromeFlags.navButtons !== false;

  const webviewRef = useRef<WebviewTag | null>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [pageTitle, setPageTitle] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isChromeHidden, setIsChromeHidden] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Update nav state from webview
  const updateNavState = useCallback(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    try {
      setCanGoBack(wv.canGoBack());
      setCanGoForward(wv.canGoForward());
    } catch {
      // canGoBack/canGoForward may throw on cross-origin
    }
  }, []);

  const handleDidNavigate = useCallback(
    (e: Event) => {
      const wv = webviewRef.current;
      if (!wv) return;
      const detail = (e as any).detail || {};
      const url = detail.url || wv.getURL();

      // App mode: enforce origin lock
      if (mode === 'app') {
        const allowedOrigin = getUrlOrigin(initialUrl);
        const loadedOrigin = getUrlOrigin(url);
        if (allowedOrigin && loadedOrigin && loadedOrigin !== allowedOrigin) {
          console.warn('[BrowserViewer] App mode blocked navigation to:', loadedOrigin);
          wv.loadURL(initialUrl);
          return;
        }
      }

      setCurrentUrl(url);
      updateNavState();
    },
    [mode, initialUrl, updateNavState]
  );

  const handleDidNavigateInPage = useCallback(
    (e: Event) => {
      const detail = (e as any).detail || {};
      if (detail.url) {
        setCurrentUrl(detail.url);
      }
      updateNavState();
    },
    [updateNavState]
  );

  const handlePageTitleUpdated = useCallback((e: Event) => {
    const detail = (e as any).detail || {};
    if (detail.title) {
      setPageTitle(detail.title);
    }
  }, []);

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleLoadStop = useCallback(() => {
    setIsLoading(false);
    updateNavState();
  }, [updateNavState]);

  // Attach webview event listeners
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    wv.addEventListener('did-navigate', handleDidNavigate);
    wv.addEventListener('did-navigate-in-page', handleDidNavigateInPage);
    wv.addEventListener('page-title-updated', handlePageTitleUpdated);
    wv.addEventListener('load-start', handleLoadStart);
    wv.addEventListener('load-stop', handleLoadStop);

    return () => {
      wv.removeEventListener('did-navigate', handleDidNavigate);
      wv.removeEventListener('did-navigate-in-page', handleDidNavigateInPage);
      wv.removeEventListener('page-title-updated', handlePageTitleUpdated);
      wv.removeEventListener('load-start', handleLoadStart);
      wv.removeEventListener('load-stop', handleLoadStop);
    };
  }, [
    handleDidNavigate,
    handleDidNavigateInPage,
    handlePageTitleUpdated,
    handleLoadStart,
    handleLoadStop,
  ]);

  // User-initiated navigation
  const navigateTo = useCallback(
    (url: string) => {
      const result = validateUrl(url);
      if (!result.valid || !result.normalizedUrl) {
        console.warn('[BrowserViewer] Blocked navigation:', result.reason);
        return;
      }
      const target = result.normalizedUrl;
      const wv = webviewRef.current;
      if (wv) {
        wv.loadURL(target);
      }
      setCurrentUrl(target);
    },
    []
  );

  const handleBack = useCallback(() => {
    const wv = webviewRef.current;
    if (wv) wv.goBack();
  }, []);

  const handleForward = useCallback(() => {
    const wv = webviewRef.current;
    if (wv) wv.goForward();
  }, []);

  const handleReload = useCallback(() => {
    const wv = webviewRef.current;
    if (wv) wv.reload();
  }, []);

  const handleToggleChrome = useCallback(() => {
    setIsChromeHidden((prev) => !prev);
  }, []);

  return (
    <div className="rv-browser-viewer">
      <BrowserViewerChrome
        url={currentUrl}
        pageTitle={pageTitle}
        onUrlChange={navigateTo}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onToggleChrome={handleToggleChrome}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        isLoading={isLoading}
        showUrlBar={showUrlBar}
        showNavButtons={showNavButtons}
        isChromeHidden={isChromeHidden}
        mode={mode}
      />
      <div className="rv-browser-viewer-webview-container">
        <webview
          ref={webviewRef as any}
          className="rv-browser-viewer-webview"
          src={initialUrl}
          partition={partition}
          allowpopups={true}
          webpreferences="contextIsolation=yes,nodeIntegration=no"
        />
      </div>
    </div>
  );
};
