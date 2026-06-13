/**
 * @module WebBrowser
 * @role General web browser with always-visible chrome bar and tabs
 *
 * Renders a sandboxed iframe with back/forward/reload navigation,
 * a manual history stack per tab, and a tab bar for multiple pages.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import './WebBrowser.css';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import type { PanelConfig } from '../../lib/panels';
import { BrowserChrome } from './BrowserChrome';
import { BrowserTabs } from './BrowserTabs';
import { validateUrl } from './urlValidator';

export interface WebBrowserProps {
  config: PanelConfig;
}

interface BrowserSettings {
  url?: string;
  homepage?: string;
  chrome?: {
    urlBar?: boolean;
    navButtons?: boolean;
  };
}

interface TabState {
  id: string;
  url: string;
  title: string;
  history: string[];
  historyIndex: number;
}

function readSettings(config: PanelConfig): BrowserSettings {
  return (config.settings || {}) as BrowserSettings;
}

function normalizeInitialUrl(raw: string | undefined): string {
  if (!raw) return 'about:blank';
  const result = validateUrl(raw);
  return result.valid && result.normalizedUrl ? result.normalizedUrl : 'about:blank';
}

function createTab(url: string = 'about:blank'): TabState {
  return {
    id: Math.random().toString(36).slice(2, 9),
    url,
    title: '',
    history: [url],
    historyIndex: 0,
  };
}

export const WebBrowser: React.FC<WebBrowserProps> = ({ config }) => {
  const panelId = config.id;
  useViewLayoutStyles(panelId);

  const settings = readSettings(config);
  const initialUrl = normalizeInitialUrl(settings.url || settings.homepage);
  const chromeFlags = settings.chrome || {};
  const showUrlBar = chromeFlags.urlBar !== false;
  const showNavButtons = chromeFlags.navButtons !== false;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [tabs, setTabs] = useState<TabState[]>(() => [createTab(initialUrl)]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;

  // Track programmatic navigations to avoid double-push from load event
  const pendingNavRef = useRef<string | null>(null);

  // Keep a ref in sync for handleLoad which has empty deps
  const activeTabIdRef = useRef(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  // Listen for cross-origin iframe URL changes from the main process
  useEffect(() => {
    if (!window.electronAPI?.onBrowserUrlChanged) return;
    return window.electronAPI.onBrowserUrlChanged(({ url }) => {
      if (!url || url === 'about:blank') return;
      pendingNavRef.current = null;
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabIdRef.current) return tab;
          if (tab.url === url) return tab;
          // For cross-origin navigations we can't track history, just update URL
          return { ...tab, url };
        })
      );
    });
  }, []);

  // Navigate to a new URL in the active tab
  const navigateTo = useCallback((url: string) => {
    const result = validateUrl(url);
    if (!result.valid || !result.normalizedUrl) {
      console.warn('[WebBrowser] Blocked navigation:', result.reason);
      return;
    }
    const target = result.normalizedUrl;
    pendingNavRef.current = target;

    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabIdRef.current) return tab;
        const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), target];
        return {
          ...tab,
          url: target,
          title: '',
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      })
    );
  }, []);

  const handleBack = useCallback(() => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId || tab.historyIndex <= 0) return tab;
        const newIndex = tab.historyIndex - 1;
        const target = tab.history[newIndex];
        pendingNavRef.current = target;
        return { ...tab, url: target, historyIndex: newIndex };
      })
    );
  }, [activeTabId]);

  const handleForward = useCallback(() => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId || tab.historyIndex >= tab.history.length - 1) return tab;
        const newIndex = tab.historyIndex + 1;
        const target = tab.history[newIndex];
        pendingNavRef.current = target;
        return { ...tab, url: target, historyIndex: newIndex };
      })
    );
  }, [activeTabId]);

  const handleReload = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.contentWindow?.location.reload();
    } catch {
      const currentSrc = iframe.getAttribute('src') || iframe.src;
      iframe.setAttribute('src', currentSrc);
    }
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

    const currentActiveId = activeTabIdRef.current;

    // Try to read the document title (works for same-origin; fails silently for cross-origin)
    let pageTitle = '';
    try {
      pageTitle = iframe.contentDocument?.title || '';
    } catch {
      // Cross-origin — can't read title
    }

    // Cross-origin: can only update URL, not history stack
    if (isCrossOrigin) {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== currentActiveId) return tab;
          return { ...tab, url: loadedUrl, title: pageTitle || tab.title };
        })
      );
      return;
    }

    // Same-origin: sync with history stack
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== currentActiveId) return tab;

        if (pendingNavRef.current === loadedUrl) {
          pendingNavRef.current = null;
          return { ...tab, url: loadedUrl, title: pageTitle || tab.title };
        }

        const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), loadedUrl];
        return {
          ...tab,
          url: loadedUrl,
          title: pageTitle || tab.title,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      })
    );
  }, []);

  // Tab management
  const handleAddTab = useCallback(() => {
    const newTab = createTab('about:blank');
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const handleActivateTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const handleCloseTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) {
          // Keep at least one tab; reset it to blank
          return [createTab('about:blank')];
        }
        const idx = prev.findIndex((t) => t.id === id);
        const newTabs = prev.filter((t) => t.id !== id);
        if (id === activeTabId && newTabs.length > 0) {
          const nextActive = newTabs[Math.min(idx, newTabs.length - 1)];
          setActiveTabId(nextActive.id);
        }
        return newTabs;
      });
    },
    [activeTabId]
  );

  // Keep iframe src in sync with active tab URL
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (iframe.src !== activeTab.url) {
      iframe.src = activeTab.url;
    }
  }, [activeTab.url]);

  return (
    <div className="rv-web-browser">
      <BrowserTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onActivate={handleActivateTab}
        onClose={handleCloseTab}
        onAdd={handleAddTab}
      />
      <BrowserChrome
        url={activeTab.url}
        title={activeTab.title}
        onUrlChange={navigateTo}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        showUrlBar={showUrlBar}
        showNavButtons={showNavButtons}
      />
      <div className="rv-web-browser-iframe-container">
        <iframe
          ref={iframeRef}
          className="rv-web-browser-iframe"
          src={activeTab.url}
          title={config.name || panelId}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
          allowFullScreen
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
};
