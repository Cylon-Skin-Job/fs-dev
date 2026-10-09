/**
 * @module AppChrome
 * @role Collapsible chrome bar for app container: URL input + toggle button
 */

import React, { useRef, useEffect } from 'react';

export interface AppChromeProps {
  url: string;
  onUrlChange: (url: string) => void;
  onToggle: () => void;
  isHidden: boolean;
}

export const AppChrome: React.FC<AppChromeProps> = ({
  url,
  onUrlChange,
  onToggle,
  isHidden,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value when url prop changes
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

  const chromeClass = isHidden
    ? 'rv-app-chrome-inner collapsed'
    : 'rv-app-chrome-inner';

  return (
    <form className="rv-app-chrome" onSubmit={handleSubmit}>
      <div className={chromeClass}>
        <input
          ref={inputRef}
          type="text"
          className="rv-app-url-input"
          defaultValue={url}
          title="Enter a URL"
        />
        <button
          type="button"
          className="rv-app-toggle-btn"
          onClick={onToggle}
          title={isHidden ? 'Show Address Bar' : 'Hide Address Bar'}
        >
          <span className="material-symbols-outlined">
            {isHidden ? 'variable_insert' : 'variable_remove'}
          </span>
        </button>
      </div>
    </form>
  );
};
