/**
 * @module BookmarksBar
 * @role Horizontal bookmarks bar below the chrome bar
 */

import React, { useEffect } from 'react';
import './BookmarksBar.css';
import { useBookmarksStore } from '../../state/bookmarksStore';
import { useWorkspaceStore } from '../../state/workspaceStore';
import { getFaviconUrl } from './favicon';

export interface BookmarksBarProps {
  onUrlChange: (url: string) => void;
}

export const BookmarksBar: React.FC<BookmarksBarProps> = ({ onUrlChange }) => {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const allBookmarks = useBookmarksStore((s) => s.bookmarks);
  const loadBookmarks = useBookmarksStore((s) => s.loadBookmarks);

  // Show only bookmarks in the "Bookmarks bar" folder (empty string = default)
  const bookmarks = allBookmarks.filter(
    (b) => b.folder === '' || b.folder === 'Bookmarks bar'
  );

  useEffect(() => {
    if (workspaceId) {
      loadBookmarks(workspaceId);
    }
  }, [workspaceId, loadBookmarks]);

  if (!workspaceId || bookmarks.length === 0) {
    return (
      <div className="rv-bookmarks-bar rv-bookmarks-bar--empty">
        <span className="rv-bookmarks-bar-hint">Bookmark a page to see it here</span>
      </div>
    );
  }

  return (
    <div className="rv-bookmarks-bar">
      {bookmarks.map((b) => {
        const hasTitle = b.title && b.title.trim().length > 0;
        const favicon = getFaviconUrl(b.url);
        return (
          <button
            key={b.id}
            type="button"
            className={`rv-bookmark-chip ${!hasTitle ? 'rv-bookmark-chip--icon-only' : ''}`}
            onClick={() => onUrlChange(b.url)}
            title={b.url}
          >
            {favicon ? (
              <img
                className="rv-bookmark-favicon"
                src={favicon}
                alt=""
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span className="material-symbols-outlined rv-bookmark-chip-icon">language</span>
            )}
            {hasTitle && (
              <span className="rv-bookmark-chip-title">{b.title}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
