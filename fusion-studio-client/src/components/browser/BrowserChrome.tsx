/**
 * @module BrowserChrome
 * @role Chrome bar for browser views: back/forward/reload, URL input, address bar toggle
 */

import React, { useRef, useEffect } from 'react';

export interface BrowserChromeProps {
  url: string;
  onUrlChange: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onToggleAddressBar: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  showUrlBar: boolean;
  showNavButtons: boolean;
  isAddressBarHidden: boolean;
  mode: 'browser' | 'app';
}

export const BrowserChrome: React.FC<BrowserChromeProps> = ({
  url,
  onUrlChange,
  onBack,
  onForward,
  onReload,
  onToggleAddressBar,
  canGoBack,
  canGoForward,
  showUrlBar,
  showNavButtons,
  isAddressBarHidden,
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

  const chromeClass = isAddressBarHidden
    ? 'rv-browser-chrome-inner collapsed'
    : 'rv-browser-chrome-inner';

  return (
    <form className="rv-browser-chrome" onSubmit={handleSubmit}>
      <div className={chromeClass}>
        <div className="rv-browser-nav-group">
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
      </div>

      <div className="rv-browser-actions-group">
        <button
          type="button"
          className="rv-browser-chrome-btn"
          onClick={onToggleAddressBar}
          title={isAddressBarHidden ? 'Show Address Bar' : 'Hide Address Bar'}
        >
          <span className="material-symbols-outlined">
            {isAddressBarHidden ? 'variable_insert' : 'variable_remove'}
          </span>
        </button>

      </div>
      </div>
    </form>
  );
};
