/**
 * @module BrowserChrome
 * @role Chrome bar for general web browser: back/forward/reload, URL input
 */

import React, { useRef, useEffect, useState } from 'react';
import './BrowserChrome.css';
import { BookmarksBar } from './BookmarksBar';
import { BookmarkDialog } from './BookmarkDialog';
import { useBookmarksStore } from '../../state/bookmarksStore';
import { useWorkspaceStore } from '../../state/workspaceStore';

export interface BrowserChromeProps {
  url: string;
  title?: string;
  onUrlChange: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  showUrlBar: boolean;
  showNavButtons: boolean;
}

export const BrowserChrome: React.FC<BrowserChromeProps> = ({
  url,
  title,
  onUrlChange,
  onBack,
  onForward,
  onReload,
  canGoBack,
  canGoForward,
  showUrlBar,
  showNavButtons,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const starRef = useRef<HTMLButtonElement>(null);

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

  const handleSaveBookmark = (bookmarkUrl: string, name: string, folder: string) => {
    const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
    if (workspaceId && bookmarkUrl) {
      // Map "Bookmarks bar" display name back to empty string for the default folder
      const folderValue = folder === 'Bookmarks bar' ? '' : folder;
      useBookmarksStore.getState().addBookmark(workspaceId, bookmarkUrl, name, folderValue);
    }
  };

  return (
    <form className="rv-browser-chrome" onSubmit={handleSubmit}>
      <div className="rv-browser-chrome-row">
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
            <div className="rv-browser-url-wrapper">
              <input
                ref={inputRef}
                type="text"
                className="rv-browser-url-input"
                defaultValue={url}
                title="Enter a URL"
              />
              <button
                ref={starRef}
                type="button"
                className="rv-browser-star-btn"
                title="Bookmark this page"
                onClick={() => setDialogOpen(true)}
              >
                <span className="material-symbols-outlined">star</span>
              </button>
              <BookmarkDialog
                url={url}
                title={title || ''}
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSave={handleSaveBookmark}
                anchorRef={starRef}
              />
            </div>
          )}
        </div>

        <div className="rv-browser-actions-group">
          <button type="button" className="rv-browser-chrome-btn" title="Gallery">
            <span className="material-symbols-outlined">browse_gallery</span>
          </button>
          <button type="button" className="rv-browser-chrome-btn" title="Folders">
            <span className="material-symbols-outlined">folder_special</span>
          </button>
        </div>
      </div>
      <BookmarksBar onUrlChange={onUrlChange} />
    </form>
  );
};
