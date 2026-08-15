/**
 * @module OfficeViewerHeader
 * @role Shared Office list/search header.
 */

import type { ReactNode } from 'react';
import { ViewerSearchField } from '../search/ViewerSearchField';
import { ViewerSearchFilters } from '../search/ViewerSearchFilters';

interface OfficeViewerHeaderProps {
  children: ReactNode;
  title: ReactNode;
  searchQuery: string;
  isSearchSubmitted: boolean;
  rightControls?: ReactNode;
  showFolderFilters?: boolean;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  onSearchDismiss: () => void;
}

export function OfficeViewerHeader({
  children,
  title,
  searchQuery,
  isSearchSubmitted,
  rightControls,
  showFolderFilters = false,
  onSearchQueryChange,
  onSearchSubmit,
  onSearchDismiss,
}: OfficeViewerHeaderProps) {
  const officeLocationOptions = [
    { value: 'office', label: 'Office' },
    { value: 'archive', label: 'Archive' },
  ];

  return (
    <div className="rv-office-header">
      <div className="rv-office-header-row">
        <ViewerSearchField
          className="rv-office-search-field"
          ariaLabel="Search office documents"
          value={searchQuery}
          onChange={onSearchQueryChange}
          onSubmit={onSearchSubmit}
          onDismiss={isSearchSubmitted ? onSearchDismiss : undefined}
          dismissLabel="Clear office search"
          showSearchIcon={false}
        />
      </div>
      <section className="rv-office-content-panel">
        <div className="rv-office-title-row">
          <h2 className="rv-office-title">{title}</h2>
          {!isSearchSubmitted && !showFolderFilters ? rightControls : null}
        </div>
        {showFolderFilters && !isSearchSubmitted ? (
          <ViewerSearchFilters
            className="rv-office-folder-filter-row"
            ariaLabel="Folder filters"
            showLocation={false}
            showTitleOnly={false}
            trailingControls={rightControls}
          />
        ) : null}
        {isSearchSubmitted ? (
          <ViewerSearchFilters
            className="rv-office-search-filter-row"
            locationOptions={officeLocationOptions}
          />
        ) : null}
        {children}
      </section>
    </div>
  );
}
