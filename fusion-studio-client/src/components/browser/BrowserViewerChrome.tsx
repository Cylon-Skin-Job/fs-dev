/**
 * @module BrowserViewerChrome
 * @role Chrome bar for the webview-based browser viewer
 *
 * Nav buttons, URL input, reload, loading indicator, and chrome toggle.
 * Styled with app theme tokens for automatic dark/light mode support.
 */

import React, { useRef, useEffect } from 'react';

export interface BrowserViewerChromeProps {
  url: string;
  pageTitle: string;
  onUrlChange: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onToggleChrome: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  showUrlBar: boolean;
  showNavButtons: boolean;
  isChromeHidden: boolean;
  mode: 'browser' | 'app';
}

export const BrowserViewerChrome: React.FC<BrowserViewerChromeProps> = ({
  url,
  pageTitle,
  onUrlChange,
  onBack,
  onForward,
  onReload,
  onToggleChrome,
  canGoBack,
  canGoForward,
  isLoading,
  showUrlBar,
  showNavButtons,
  isChromeHidden,
  mode,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input when url prop changes (unless user is actively editing)
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = url;
    }
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (value) {
      onUrlChange(value);
      inputRef.current?.blur();
    }
  };

  const chromeClass = isChromeHidden
    ? 'rv-browser-viewer-chrome-inner collapsed'
    : 'rv-browser-viewer-chrome-inner';

  return (
    <form className="rv-browser-viewer-chrome" onSubmit={handleSubmit}>
      <div className={chromeClass}>
        <div className="rv-browser-viewer-nav-group">
          {showNavButtons && (
            <>
              <button
                type="button"
                className="rv-browser-viewer-chrome-btn"
                onClick={onBack}
                disabled={!canGoBack}
                title="Back"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <button
                type="button"
                className="rv-browser-viewer-chrome-btn"
                onClick={onForward}
                disabled={!canGoForward}
                title="Forward"
              >
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <button
                type="button"
                className="rv-browser-viewer-chrome-btn"
                onClick={onReload}
                title="Reload"
              >
                <span className={`material-symbols-outlined ${isLoading ? 'spinning' : ''}`}>
                  {isLoading ? 'progress_activity' : 'refresh'}
                </span>
              </button>
            </>
          )}

          {showUrlBar && (
            <div className="rv-browser-viewer-url-wrap">
              <span className="rv-browser-viewer-url-lock">
                <span className="material-symbols-outlined">
                  {mode === 'app' ? 'lock' : 'public'}
                </span>
              </span>
              <input
                ref={inputRef}
                type="text"
                className="rv-browser-viewer-url-input"
                defaultValue={url}
                readOnly={mode === 'app'}
                title={mode === 'app' ? 'URL is locked in app mode' : 'Enter a URL'}
              />
              {pageTitle && !isChromeHidden && (
                <span className="rv-browser-viewer-url-title">{pageTitle}</span>
              )}
            </div>
          )}
        </div>

        <div className="rv-browser-viewer-actions-group">
          <button
            type="button"
            className="rv-browser-viewer-chrome-btn"
            onClick={onToggleChrome}
            title={isChromeHidden ? 'Show Chrome' : 'Hide Chrome'}
          >
            <span className="material-symbols-outlined">
              {isChromeHidden ? 'expand_more' : 'expand_less'}
            </span>
          </button>
        </div>
      </div>
    </form>
  );
};
