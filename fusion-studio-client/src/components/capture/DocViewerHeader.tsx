/**
 * @module DocViewerHeader
 * @role Header bar for the capture-viewer grid: title + active/archive toggle
 *
 * Pure presentation component. Mode state is owned by useDocViewerState.
 */

import { useEffect, useRef } from 'react';
import { DocViewerChrome } from './DocViewerChrome';
import { ViewerSearchField } from '../search/ViewerSearchField';
import { ViewerSearchFilters } from '../search/ViewerSearchFilters';
import type { DocViewerMode } from '../../hooks/useDocViewerState';
import './DocViewerHeader.css';

interface DocViewerHeaderProps {
  mode: DocViewerMode;
  onModeChange: (mode: DocViewerMode) => void;
  isSearchOpen: boolean;
  isSearchSubmitted: boolean;
  searchQuery: string;
  onSearchOpenChange: (isOpen: boolean) => void;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
}

export function DocViewerHeader({
  mode,
  onModeChange,
  isSearchOpen,
  isSearchSubmitted,
  searchQuery,
  onSearchOpenChange,
  onSearchQueryChange,
  onSearchSubmit,
}: DocViewerHeaderProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const title = mode === 'archive'
    ? 'Archive'
    : mode === 'recent'
      ? 'Recent'
      : mode === 'starred'
        ? 'Starred'
        : 'Document and Artifact Capture';

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  const openSearch = () => {
    onSearchQueryChange('');
    onSearchOpenChange(true);
  };

  const dismissSearch = () => {
    onSearchQueryChange('');
    onSearchOpenChange(false);
  };

  const toggle = (
    <div className="rv-capture-viewer-toggle">
      <button
        type="button"
        className={`rv-capture-viewer-toggle-btn${mode === 'active' ? ' rv-capture-viewer-toggle-btn--active' : ' rv-capture-viewer-toggle-btn--inactive'}`}
        onClick={() => onModeChange('active')}
      >
        Home
      </button>
      <button
        type="button"
        className={`rv-capture-viewer-toggle-btn${mode === 'recent' ? ' rv-capture-viewer-toggle-btn--active' : ' rv-capture-viewer-toggle-btn--inactive'}`}
        onClick={() => onModeChange('recent')}
      >
        Recent
      </button>
      <button
        type="button"
        className={`rv-capture-viewer-toggle-btn${mode === 'starred' ? ' rv-capture-viewer-toggle-btn--active' : ' rv-capture-viewer-toggle-btn--inactive'}`}
        onClick={() => onModeChange('starred')}
      >
        Starred
      </button>
      <button
        type="button"
        className={`rv-capture-viewer-toggle-btn${mode === 'archive' ? ' rv-capture-viewer-toggle-btn--active' : ' rv-capture-viewer-toggle-btn--inactive'}`}
        onClick={() => onModeChange('archive')}
      >
        Archive
      </button>
    </div>
  );

  if (isSearchOpen) {
    return (
      <div className="rv-capture-viewer-main-header rv-capture-viewer-main-header--search">
        <DocViewerChrome
          center={
            <ViewerSearchField
              inputRef={searchInputRef}
              ariaLabel="Search captures"
              value={searchQuery}
              onChange={onSearchQueryChange}
              onSubmit={onSearchSubmit}
              onDismiss={dismissSearch}
            />
          }
        />
        {isSearchSubmitted ? (
          <>
            <div className="rv-capture-viewer-title-row rv-capture-viewer-search-title-row">
              <h1 className="rv-capture-viewer-main-title">Search results</h1>
            </div>
            <ViewerSearchFilters className="rv-capture-viewer-search-filter-row" />
          </>
        ) : (
          <div className="rv-capture-viewer-title-row">
            <h1 className="rv-capture-viewer-main-title">{title}</h1>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rv-capture-viewer-main-header">
      <DocViewerChrome
        left={
          <>
            <button
              type="button"
              className="rv-capture-viewer-search-icon"
              aria-label="Search captures"
              onClick={openSearch}
            >
              <span className="material-symbols-outlined">search</span>
            </button>
          </>
        }
        center={<h1 className="rv-capture-viewer-main-title">{title}</h1>}
      />
      <div className="rv-capture-viewer-secondary-row">
        {toggle}
      </div>
    </div>
  );
}
