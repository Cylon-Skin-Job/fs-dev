/**
 * @module ViewerSearchFilters
 * @role Shared search result filter controls for viewer headers.
 */

import { useState, type ReactNode } from 'react';
import './ViewerSearchFilters.css';

interface LocationOption {
  value: string;
  label: string;
}

interface ViewerSearchFiltersProps {
  className?: string;
  ariaLabel?: string;
  locationOptions?: LocationOption[];
  showLocation?: boolean;
  showTitleOnly?: boolean;
  showStarredOnly?: boolean;
  trailingControls?: ReactNode;
}

const DEFAULT_LOCATION_OPTIONS: LocationOption[] = [
  { value: 'active', label: 'Captures' },
  { value: 'archive', label: 'Archive' },
];

export function ViewerSearchFilters({
  className,
  ariaLabel = 'Search filters',
  locationOptions = DEFAULT_LOCATION_OPTIONS,
  showLocation = true,
  showTitleOnly = true,
  showStarredOnly = false,
  trailingControls,
}: ViewerSearchFiltersProps) {
  const [titleOnly, setTitleOnly] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const rowClass = [
    'rv-viewer-search-filter-row',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClass} aria-label={ariaLabel}>
      <label className="rv-viewer-filter-select">
        <select aria-label="Filter by type" defaultValue="all">
          <option value="all">Type</option>
          <option value="markdown">Markdown</option>
          <option value="html">HTML</option>
          <option value="image">Images</option>
        </select>
        <span className="material-symbols-outlined">expand_more</span>
      </label>
      <label className="rv-viewer-filter-select">
        <select aria-label="Filter by modified date" defaultValue="all">
          <option value="all">Modified</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <span className="material-symbols-outlined">expand_more</span>
      </label>
      {showLocation ? (
        <label className="rv-viewer-filter-select">
          <select aria-label="Filter by location" defaultValue="all">
            <option value="all">Location</option>
            {locationOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <span className="material-symbols-outlined">expand_more</span>
        </label>
      ) : null}
      {showTitleOnly ? (
        <button
          type="button"
          className={`rv-viewer-filter-toggle${titleOnly ? ' rv-viewer-filter-toggle--active' : ''}`}
          aria-pressed={titleOnly}
          onClick={() => setTitleOnly((selected) => !selected)}
        >
          Title only
        </button>
      ) : null}
      {showStarredOnly ? (
        <button
          type="button"
          className={`rv-viewer-filter-toggle${starredOnly ? ' rv-viewer-filter-toggle--active' : ''}`}
          aria-pressed={starredOnly}
          onClick={() => setStarredOnly((selected) => !selected)}
        >
          Starred only
        </button>
      ) : null}
      {trailingControls}
    </div>
  );
}
