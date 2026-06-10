/**
 * @module CustomViewer
 * @role App container with collapsible chrome bar
 *
 * Renders a sandboxed iframe with an origin-locked, collapsible
 * chrome bar. No back/forward buttons. URL bar hidden by default.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import './CustomViewer.css';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import type { PanelConfig } from '../../lib/panels';
import { AppChrome } from './AppChrome';
import { validateUrl, getUrlOrigin } from './urlValidator';

export interface CustomViewerProps {
  config: PanelConfig;
}

interface ViewerSettings {
  url?: string;
  homepage?: string;
  chrome?: {
    urlBar?: boolean;
  };
}

function readSettings(config: PanelConfig): ViewerSettings {
  return (config.settings || {}) as ViewerSettings;
}

function normalizeInitialUrl(raw: string | undefined): string {
  if (!raw) return 'about:blank';
  const result = validateCustomViewerUrl(raw);
  return result.valid && result.normalizedUrl ? result.normalizedUrl : 'about:blank';
}

function isLocalServerUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

function validateCustomViewerUrl(input: string) {
  const result = validateUrl(input);
  if (!result.valid || !result.normalizedUrl) return result;
  if (!isLocalServerUrl(result.normalizedUrl)) {
    return { valid: false, reason: 'Custom viewer only supports local server URLs' };
  }
  return result;
}

export const CustomViewer: React.FC<CustomViewerProps> = ({ config }) => {
  const panelId = config.id;
  useViewLayoutStyles(panelId);

  const settings = readSettings(config);
  const initialUrl = normalizeInitialUrl(settings.url || settings.homepage);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [isBarHidden, setIsBarHidden] = useState(true);

  // Track programmatic navigations to avoid double-push from load event
  const pendingNavRef = useRef<string | null>(null);

  const handleToggleBar = useCallback(() => {
    setIsBarHidden((prev) => !prev);
  }, []);

  // Navigate to a new URL
  const navigateTo = useCallback((url: string) => {
    const result = validateCustomViewerUrl(url);
    if (!result.valid || !result.normalizedUrl) {
      console.warn('[CustomViewer] Blocked navigation:', result.reason);
      return;
    }
    const target = result.normalizedUrl;
    pendingNavRef.current = target;
    setCurrentUrl(target);
  }, []);

  // Handle iframe load events
  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let loadedUrl: string | null = null;
    let isCrossOrigin = false;

    try {
      loadedUrl = iframe.contentWindow?.location.href || null;
    } catch {
      isCrossOrigin = true;
    }

    if (!loadedUrl || loadedUrl === 'about:blank') {
      return;
    }

    // Enforce origin lock
    const allowedOrigin = getUrlOrigin(initialUrl);
    const loadedOrigin = getUrlOrigin(loadedUrl);
    if (allowedOrigin && loadedOrigin && loadedOrigin !== allowedOrigin) {
      console.warn('[CustomViewer] Blocked navigation to different origin:', loadedOrigin);
      pendingNavRef.current = initialUrl;
      setCurrentUrl(initialUrl);
      return;
    }

    // Cross-origin: cannot observe navigation, skip sync
    if (isCrossOrigin) {
      return;
    }

    // Same-origin: sync URL
    if (pendingNavRef.current === loadedUrl) {
      pendingNavRef.current = null;
      setCurrentUrl(loadedUrl);
      return;
    }

    setCurrentUrl(loadedUrl);
  }, [initialUrl]);

  // Keep iframe src in sync with currentUrl
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (iframe.src !== currentUrl) {
      iframe.src = currentUrl;
    }
  }, [currentUrl]);

  return (
    <div className="rv-custom-viewer">
      <AppChrome
        url={currentUrl}
        onUrlChange={navigateTo}
        onToggle={handleToggleBar}
        isHidden={isBarHidden}
      />
      <div className="rv-custom-viewer-iframe-container">
        {/*
          SECURITY NOTE: allow-same-origin + allow-scripts means same-origin apps
          have full access to their origin's cookies, localStorage, and DOM. This
          is intentional for a developer tool where the user loads their own server.
          Cross-origin apps are naturally restricted by the Same-Origin Policy.

          USER APP REQUIREMENT: The server must allow iframe embedding:
            X-Frame-Options: ALLOWALL
            OR Content-Security-Policy: frame-ancestors 'self' http://localhost:*;
          Default Express/Helmet configs often block this.
        */}
        <iframe
          ref={iframeRef}
          className="rv-custom-viewer-iframe"
          src={currentUrl}
          title={config.name || panelId}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
          allowFullScreen
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
};
