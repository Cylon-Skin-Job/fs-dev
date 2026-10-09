/**
 * @module EmailViewerHeader
 * @role Shared Email list/search header.
 */

import type { ReactNode } from 'react';
import { ViewerSearchField } from '../search/ViewerSearchField';
import { ViewerSearchFilters } from '../search/ViewerSearchFilters';
import { EmailAccountSwitcher } from './EmailAccountSwitcher';

interface EmailViewerHeaderProps {
  children: ReactNode;
  title: ReactNode;
  /** When set, renders in place of the title row (mail modes). */
  toolbar?: ReactNode;
  searchQuery: string;
  isSearchSubmitted: boolean;
  rightControls?: ReactNode;
  rulesOpen?: boolean;
  showFolderFilters?: boolean;
  onOpenRules?: () => void;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  onSearchDismiss: () => void;
}

export function EmailViewerHeader({
  children,
  title,
  toolbar,
  searchQuery,
  isSearchSubmitted,
  rightControls,
  rulesOpen = false,
  showFolderFilters = false,
  onOpenRules,
  onSearchQueryChange,
  onSearchSubmit,
  onSearchDismiss,
}: EmailViewerHeaderProps) {
  const emailLocationOptions = [
    { value: 'email', label: 'Email' },
    { value: 'archive', label: 'Archive' },
  ];

  return (
    <div className="rv-email-header">
      <div className="rv-email-header-row">
        <ViewerSearchField
          className="rv-email-search-field"
          ariaLabel="Search email documents"
          value={searchQuery}
          onChange={onSearchQueryChange}
          onSubmit={onSearchSubmit}
          onDismiss={isSearchSubmitted ? onSearchDismiss : undefined}
          dismissLabel="Clear email search"
          showSearchIcon={false}
        />
        <div className="rv-email-header-actions" aria-label="Email header actions">
          <button
            type="button"
            className="rv-email-header-action rv-email-settings-action"
            aria-label="Email settings"
            title="Email settings"
            aria-expanded={rulesOpen}
            onClick={onOpenRules}
          >
            <span className="material-symbols-outlined" aria-hidden="true">home_storage_gear</span>
          </button>
          <EmailAccountSwitcher />
        </div>
      </div>
      <section className="rv-email-content-panel">
        {toolbar ? (
          <div className="rv-email-toolbar-row">{toolbar}</div>
        ) : (
          <div className="rv-email-title-row">
            <h2 className="rv-email-title">{title}</h2>
            {!isSearchSubmitted && !showFolderFilters ? rightControls : null}
          </div>
        )}
        {showFolderFilters && !isSearchSubmitted ? (
          <ViewerSearchFilters
            className="rv-email-folder-filter-row"
            ariaLabel="Folder filters"
            showLocation={false}
            showTitleOnly={false}
            trailingControls={rightControls}
          />
        ) : null}
        {isSearchSubmitted ? (
          <ViewerSearchFilters
            className="rv-email-search-filter-row"
            locationOptions={emailLocationOptions}
          />
        ) : null}
        {children}
      </section>
    </div>
  );
}
