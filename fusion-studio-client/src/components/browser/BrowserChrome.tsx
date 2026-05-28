/**
 * @module BrowserChrome
 * @role Chrome bar for browser views: back/forward/reload, URL input, fullscreen toggle
 */

import React, { useRef, useEffect } from 'react';

export interface BrowserChromeProps {
  url: string;
  onUrlChange: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onToggleFullscreen: () => void;
  onOpenMenu: (e: React.MouseEvent) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  showUrlBar: boolean;
  showNavButtons: boolean;
  isFullscreen: boolean;
  mode: 'browser' | 'app';
}

export const BrowserChrome: React.FC<BrowserChromeProps> = ({
  url,
  onUrlChange,
  onBack,
  onForward,
  onReload,
  onToggleFullscreen,
  onOpenMenu,
  canGoBack,
  canGoForward,
  showUrlBar,
  showNavButtons,
  isFullscreen,
  mode,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value when url prop changes (e.g. from iframe load)
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

  return (
    <form className="rv-browser-chrome" onSubmit={handleSubmit}>
      {showNavButtons && (
        <>
          <button
            type="button"
            className="rv-browser-chrome-btn"
            onClick={onBack}
            disabled={!canGoBack}
            title="Back"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <button
            type="button"
            className="rv-browser-chrome-btn"
            onClick={onForward}
            disabled={!canGoForward}
            title="Forward"
          >
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
          <button
            type="button"
            className="rv-browser-chrome-btn"
            onClick={onReload}
            title="Reload"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </>
      )}

      {showUrlBar && (
        <input
          ref={inputRef}
          type="text"
          className="rv-browser-url-input"
          defaultValue={url}
          readOnly={mode === 'app'}
          title={mode === 'app' ? 'URL is locked in app mode' : 'Enter a URL'}
        />
      )}

      <button
        type="button"
        className="rv-browser-chrome-btn rv-browser-fullscreen-btn"
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        <span className="material-symbols-outlined">
          {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
        </span>
      </button>

      <button
        type="button"
        className="rv-browser-chrome-btn"
        onClick={onOpenMenu}
        title="Menu"
      >
        <span className="material-symbols-outlined">more_vert</span>
      </button>
    </form>
  );
};
