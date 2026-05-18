/**
 * @module OfficeDocumentTile
 * @role Document thumbnail for markdown files in the office-viewer panel
 *
 * Renders .md files as scaled-down document page previews using markdownToHtml.
 * Non-markdown files delegate to the shared DocumentTile (CodeView preview).
 *
 * This component is office-viewer specific; doc-viewer continues to use DocumentTile.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { markdownToHtml } from '../../lib/transforms';
import { DocumentTile } from '../tile-row/DocumentTile';
import './OfficeDocumentTile.css';

interface OfficeDocumentTileProps {
  name: string;
  content: string;
  extension?: string;
  panel?: string;
  folderPath?: string;
  onClick?: () => void;
  active?: boolean;
  highlighted?: boolean;
  size?: 'default' | 'small';
}

const BASE_DOCUMENT_WIDTH = 800;

export function OfficeDocumentTile(props: OfficeDocumentTileProps) {
  const ext = props.extension || props.name.split('.').pop()?.toLowerCase() || '';

  // Non-markdown files fall back to the existing code tile
  if (ext !== 'md' && ext !== 'markdown') {
    return <DocumentTile {...props} />;
  }

  return <MarkdownOfficeDocumentTile {...props} />;
}

function MarkdownOfficeDocumentTile(props: OfficeDocumentTileProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Observe preview container size and compute scale factor
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setScale(width / BASE_DOCUMENT_WIDTH);
      }
    };

    updateScale();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updateScale());
      ro.observe(el);
      return () => ro.disconnect();
    }

    // Fallback: recompute on window resize
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Truncate and convert markdown to HTML
  const previewContent = useMemo(() => {
    if (!props.content) return '';
    const lines = props.content.split('\n');
    const truncated = lines.length > 50 ? lines.slice(0, 50).join('\n') + '\n...' : props.content;
    return markdownToHtml(truncated);
  }, [props.content]);

  const classes = ['rv-office-doc-tile'];
  if (props.size === 'small') classes.push('rv-office-doc-tile-small');
  if (props.active) classes.push('active');
  if (props.highlighted) classes.push('rv-office-doc-tile--highlighted');

  return (
    <div
      className={classes.join(' ')}
      onClick={props.onClick}
      title={props.name}
    >
      <div className="rv-office-doc-tile-preview" ref={previewRef}>
        <div className="rv-office-doc-tile-open">Open</div>
        <div
          className="rv-office-doc-tile-document rv-wiki-page-content"
          style={{
            transform: `scale(${scale})`,
            width: `${BASE_DOCUMENT_WIDTH}px`,
          }}
          dangerouslySetInnerHTML={{ __html: previewContent }}
        />
      </div>
      <div className="rv-office-doc-tile-footer">
        <span className="material-symbols-outlined rv-office-doc-tile-icon">description</span>
        <span className="rv-office-doc-tile-name">{props.name}</span>
      </div>
    </div>
  );
}
