/**
 * @module ViewerSearchField
 * @role Shared compact search input chrome for viewer headers.
 */

import type { Ref } from 'react';
import './ViewerSearchField.css';

interface ViewerSearchFieldProps {
  value: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onDismiss?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  placeholder?: string;
  dismissLabel?: string;
  showSearchIcon?: boolean;
  className?: string;
}

export function ViewerSearchField({
  value,
  ariaLabel,
  onChange,
  onSubmit,
  onDismiss,
  inputRef,
  placeholder = 'Search',
  dismissLabel = 'Dismiss search',
  showSearchIcon = true,
  className,
}: ViewerSearchFieldProps) {
  const classes = [
    'rv-viewer-search-field',
    !showSearchIcon ? 'rv-viewer-search-field--no-icon' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {showSearchIcon ? (
        <span className="material-symbols-outlined rv-viewer-search-field-icon">search</span>
      ) : null}
      <input
        ref={inputRef}
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      {onDismiss ? (
        <button
          type="button"
          className="rv-viewer-search-dismiss"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      ) : null}
    </div>
  );
}
