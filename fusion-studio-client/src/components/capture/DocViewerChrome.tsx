/**
 * @module DocViewerChrome
 * @role Shared chrome bar for capture-viewer grid and document views
 *
 * Mirrors the universal view-header paradigm:
 * 40px height, opaque rail background, bottom hairline.
 * Content is split into left / center / right slots.
 */

import './DocViewerChrome.css';

interface DocViewerChromeProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export function DocViewerChrome({ left, center, right }: DocViewerChromeProps) {
  return (
    <div className="rv-capture-viewer-chrome">
      <div className="rv-capture-viewer-chrome-left">{left}</div>
      <div className="rv-capture-viewer-chrome-center">{center}</div>
      <div className="rv-capture-viewer-chrome-right">{right}</div>
    </div>
  );
}
