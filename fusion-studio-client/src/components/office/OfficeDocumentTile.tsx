/**
 * @module OfficeDocumentTile
 * @role Document thumbnail card for files in the office-viewer panel
 *
 * Renders Office's Drive-style file card shell. Markdown uses saved
 * screenshot thumbnails, images use their source preview, and other files use
 * CodeView inside the same frame.
 */

import { useEffect, useMemo, useState } from 'react';
import { getPanelFileUrl } from '../../lib/panels';
import { officeDocumentPath, officeThumbnailPath, thumbnailCacheKey } from '../../lib/officeThumbnails';
import { useOfficeThumbnailStore } from '../../state/officeThumbnailStore';
import { CodeView } from '../CodeView';
import { IMAGE_EXTENSIONS } from '../tile-row/documentTileUtils';
import './OfficeDocumentTile.css';

interface OfficeDocumentTileProps {
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

export function OfficeDocumentTile(props: OfficeDocumentTileProps) {
  const ext = props.extension || props.name.split('.').pop()?.toLowerCase() || '';
  const icon = ICON_MAP[ext] || 'draft';
  const isMarkdown = ext === 'md' || ext === 'markdown';
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  const codePreview = useMemo(() => {
    if (isMarkdown || isImage || !props.content) return '';
    const lines = props.content.split('\n');
    return lines.length > 100 ? lines.slice(0, 100).join('\n') + '\n...' : props.content;
  }, [isImage, isMarkdown, props.content]);

  const relativePath = officeDocumentPath(props.folderPath, props.name);
  const thumbnailVersion = useOfficeThumbnailStore((state) => state.versions[relativePath] ?? 0);
  const thumbnailSrc = isMarkdown && props.panel
    ? `${getPanelFileUrl(props.panel, officeThumbnailPath(relativePath))}?v=${thumbnailVersion || thumbnailCacheKey(props.content)}`
    : '';

  useEffect(() => {
    setThumbnailFailed(false);
  }, [thumbnailSrc]);

  const classes = ['rv-office-doc-tile'];
  if (props.size === 'small') classes.push('rv-office-doc-tile-small');
  if (props.active) classes.push('active');
  if (props.highlighted) classes.push('rv-office-doc-tile--highlighted');

  const handleTileClick = () => {
    props.onClick?.();
  };

  return (
    <div
      role={props.onClick ? 'button' : undefined}
      tabIndex={props.onClick ? 0 : undefined}
      className={classes.join(' ')}
      onClick={handleTileClick}
      onContextMenu={props.onContextMenu}
      onKeyDown={(event) => {
        if (!props.onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleTileClick();
        }
      }}
      title={props.name}
    >
      <div className="rv-office-doc-tile-header">
        <span className="material-symbols-outlined rv-office-doc-tile-icon">{icon}</span>
        <span className="rv-office-doc-tile-name">{props.name}</span>
        {props.starred ? (
          <span className="material-symbols-outlined rv-office-doc-tile-star" aria-hidden="true">kid_star</span>
        ) : null}
        <button
          type="button"
          className="rv-office-doc-tile-more"
          aria-label={`More actions for ${props.name}`}
          onClick={(event) => {
            event.stopPropagation();
            props.onMoreClick?.(event);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
        </button>
      </div>
      <div
        className="rv-office-doc-tile-preview"
        onClick={(event) => {
          event.stopPropagation();
          handleTileClick();
        }}
      >
        <div className="rv-office-doc-tile-open">Open</div>
        <div
          className="rv-office-doc-tile-click-overlay"
          aria-hidden="true"
          onClick={(event) => {
            event.stopPropagation();
            handleTileClick();
          }}
        />
        {isImage ? (
          <img
            src={getPanelFileUrl(props.panel ?? '', relativePath)}
            alt={props.name}
            loading="lazy"
            draggable={false}
            className="rv-office-doc-tile-img"
          />
        ) : isMarkdown && thumbnailSrc && !thumbnailFailed ? (
          <img
            src={thumbnailSrc}
            alt=""
            aria-hidden="true"
            loading="lazy"
            draggable={false}
            className="rv-office-doc-tile-img rv-office-doc-tile-thumbnail"
            onError={() => setThumbnailFailed(true)}
          />
        ) : isMarkdown ? (
          <div className="rv-office-doc-tile-missing-thumbnail" aria-label="Thumbnail missing">
            <span className="material-symbols-outlined" aria-hidden="true">image_not_supported</span>
            <span>Thumbnail missing</span>
          </div>
        ) : (
          <CodeView content={codePreview} extension={ext} />
        )}
      </div>
    </div>
  );
}
