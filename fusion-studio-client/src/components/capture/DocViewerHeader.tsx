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
import { SegmentedViewNav } from '../SegmentedViewNav';
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
  /** Shell tabs replace the upper title; the section navigation remains. */
  hideTitle?: boolean;
}

const CAPTURE_NAV_ITEMS = [
  { value: 'active', label: 'Home' },
  { value: 'recent', label: 'Recent' },
  { value: 'starred', label: 'Starred' },
  { value: 'archive', label: 'Archive' },
] as const;

export function DocViewerHeader({
  mode,
  onModeChange,
  isSearchOpen,
  isSearchSubmitted,
  searchQuery,
  onSearchOpenChange,
  onSearchQueryChange,
  onSearchSubmit,
  hideTitle = false,
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

  if (hideTitle) {
    return (
      <div className="rv-capture-viewer-main-header rv-capture-viewer-main-header--tabs">
        <SegmentedViewNav
          ariaLabel="Capture sections"
          items={CAPTURE_NAV_ITEMS}
          activeValue={mode}
          onChange={(value) => onModeChange(value as DocViewerMode)}
        />
      </div>
    );
  }

  if (isSearchOpen) {
    return (
      <div className="rv-capture-viewer-main-header rv-capture-viewer-main-header--search">
        <DocViewerChrome
          center={<h1 className="rv-capture-viewer-main-title">{title}</h1>}
        />
        <div className="rv-segmented-view-nav rv-capture-viewer-search-row">
          <ViewerSearchField
            className="rv-capture-viewer-nav-search-field"
            inputRef={searchInputRef}
            ariaLabel="Search captures"
            value={searchQuery}
            onChange={onSearchQueryChange}
            onSubmit={onSearchSubmit}
            onDismiss={dismissSearch}
          />
        </div>
        {isSearchSubmitted ? (
          <ViewerSearchFilters className="rv-capture-viewer-search-filter-row" />
        ) : null}
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
      <SegmentedViewNav
        ariaLabel="Capture sections"
        items={CAPTURE_NAV_ITEMS}
        activeValue={mode}
        onChange={(value) => onModeChange(value as DocViewerMode)}
      />
    </div>
  );
}
