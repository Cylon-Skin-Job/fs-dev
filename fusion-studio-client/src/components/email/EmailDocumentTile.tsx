/**
 * @module EmailDocumentTile
 * @role Document thumbnail card for files in the email-viewer panel
 *
 * Renders Email's Drive-style file card shell. Markdown uses a scaled
 * document preview, images use their source preview, and other files use
 * CodeView inside the same frame.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { markdownToHtml } from '../../lib/transforms';
import { getPanelFileUrl } from '../../lib/panels';
import { CodeView } from '../CodeView';
import { IMAGE_EXTENSIONS } from '../tile-row/documentTileUtils';
import './EmailDocumentTile.css';

interface EmailDocumentTileProps {
  name: string;
  content: string;
  extension?: string;
  panel?: string;
  folderPath?: string;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMoreClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  highlighted?: boolean;
  starred?: boolean;
  size?: 'default' | 'small';
}

const BASE_DOCUMENT_WIDTH = 800;

const ICON_MAP: Record<string, string> = {
  md: 'description',
  markdown: 'description',
  html: 'html',
  json: 'data_object',
  js: 'javascript',
  ts: 'javascript',
  css: 'css',
  txt: 'text_snippet',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  svg: 'image',
  pdf: 'picture_as_pdf',
};

export function EmailDocumentTile(props: EmailDocumentTileProps) {
  const ext = props.extension || props.name.split('.').pop()?.toLowerCase() || '';
  const icon = ICON_MAP[ext] || 'draft';
  const isMarkdown = ext === 'md' || ext === 'markdown';
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!isMarkdown) return;
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
  }, [isMarkdown]);

  const markdownPreview = useMemo(() => {
    if (!isMarkdown || !props.content) return '';
    const lines = props.content.split('\n');
    const truncated = lines.length > 50 ? lines.slice(0, 50).join('\n') + '\n...' : props.content;
    return markdownToHtml(truncated);
  }, [isMarkdown, props.content]);

  const codePreview = useMemo(() => {
    if (isMarkdown || isImage || !props.content) return '';
    const lines = props.content.split('\n');
    return lines.length > 100 ? lines.slice(0, 100).join('\n') + '\n...' : props.content;
  }, [isImage, isMarkdown, props.content]);

  const relativePath = [props.folderPath, props.name].filter(Boolean).join('/');

  const classes = ['rv-email-doc-tile'];
  if (props.size === 'small') classes.push('rv-email-doc-tile-small');
  if (props.active) classes.push('active');
  if (props.highlighted) classes.push('rv-email-doc-tile--highlighted');

  return (
    <div
      className={classes.join(' ')}
      onClick={props.onClick}
      onContextMenu={props.onContextMenu}
      title={props.name}
    >
      <div className="rv-email-doc-tile-header">
        <span className="material-symbols-outlined rv-email-doc-tile-icon">{icon}</span>
        <span className="rv-email-doc-tile-name">{props.name}</span>
        {props.starred ? (
          <span className="material-symbols-outlined rv-email-doc-tile-star" aria-hidden="true">kid_star</span>
        ) : null}
        <button
          type="button"
          className="rv-email-doc-tile-more"
          aria-label={`More actions for ${props.name}`}
          onClick={(event) => {
            event.stopPropagation();
            props.onMoreClick?.(event);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
        </button>
      </div>
      <div className="rv-email-doc-tile-preview" ref={previewRef}>
        <div className="rv-email-doc-tile-open">Open</div>
        {isImage ? (
          <img
            src={getPanelFileUrl(props.panel ?? '', relativePath)}
            alt={props.name}
            loading="lazy"
            className="rv-email-doc-tile-img"
          />
        ) : isMarkdown ? (
          <div
            className="rv-email-doc-tile-document rv-wiki-page-content"
            style={{ '--tile-scale': scale } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: markdownPreview }}
          />
        ) : (
          <CodeView content={codePreview} extension={ext} />
        )}
      </div>
    </div>
  );
}
