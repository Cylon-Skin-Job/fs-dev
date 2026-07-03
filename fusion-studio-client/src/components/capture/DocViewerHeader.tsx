/**
 * @module DocViewerHeader
 * @role Header bar for the doc-viewer grid: title + active/archive toggle
 *
 * Pure presentation component. Mode state is owned by useDocViewerState.
 */

import { DocViewerChrome } from './DocViewerChrome';
import type { DocViewerMode } from '../../hooks/useDocViewerState';
import './DocViewerHeader.css';

interface DocViewerHeaderProps {
  mode: DocViewerMode;
  onModeChange: (mode: DocViewerMode) => void;
}

export function DocViewerHeader({ mode, onModeChange }: DocViewerHeaderProps) {
  const title = mode === 'archive' ? 'Docs Archive' : 'Docs Viewer';

  const toggle = (
    <div className="rv-doc-viewer-toggle">
      <button
        type="button"
        className={`rv-doc-viewer-toggle-btn${mode === 'active' ? ' rv-doc-viewer-toggle-btn--active' : ' rv-doc-viewer-toggle-btn--inactive'}`}
        onClick={() => onModeChange('active')}
      >
        Home
      </button>
      <button
        type="button"
        className="rv-doc-viewer-toggle-btn rv-doc-viewer-toggle-btn--inactive rv-doc-viewer-toggle-btn--stub"
        disabled
        aria-disabled="true"
      >
        Recent
      </button>
      <button
        type="button"
        className="rv-doc-viewer-toggle-btn rv-doc-viewer-toggle-btn--inactive rv-doc-viewer-toggle-btn--stub"
        disabled
        aria-disabled="true"
      >
        Starred
      </button>
      <button
        type="button"
        className={`rv-doc-viewer-toggle-btn${mode === 'archive' ? ' rv-doc-viewer-toggle-btn--active' : ' rv-doc-viewer-toggle-btn--inactive'}`}
        onClick={() => onModeChange('archive')}
      >
        Archive
      </button>
    </div>
  );

  return (
    <DocViewerChrome
      left={<h1 className="rv-doc-viewer-title">{title}</h1>}
      center={toggle}
    />
  );
}
