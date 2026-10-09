/**
 * @module DocumentTile
 * @role Single file rendered as a scaled-down document thumbnail
 *
 * Renders the actual file content at full size inside a container,
 * then scales it down with CSS transform. The tile shows real content,
 * not a placeholder.
 *
 * Reusable across any workspace that wants a tile view.
 */

import { useMemo, type ReactNode } from 'react';
import { CodeView } from '../CodeView';
import { getPanelFileUrl } from '../../lib/panels';
import { getFileIcon } from '../../lib/file-utils';
import { IMAGE_EXTENSIONS } from './documentTileUtils';

interface DocumentTileProps {
  name: string;
  content: string;
  extension?: string;
  panel?: string;
  folderPath?: string;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMoreClick?: (e: React.MouseEvent) => void;
  moreButton?: ReactNode;
  onStarClick?: () => void;
  active?: boolean;
  checked?: boolean;
  starred?: boolean;
  size?: 'default' | 'small';
}

export function DocumentTile({ name, content, extension, panel, folderPath, onClick, onContextMenu, onMoreClick, moreButton, onStarClick, active, checked, starred, size = 'default' }: DocumentTileProps) {
  const ext = extension || name.split('.').pop()?.toLowerCase() || '';
  const icon = getFileIcon(ext, name);
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isMarkdown = ext === 'md' || ext === 'markdown';
  const classes = ['rv-doc-tile'];
  if (size === 'small') classes.push('rv-doc-tile-small');
  if (isMarkdown) classes.push('rv-doc-tile-markdown');
  if (active) classes.push('active');
  if (checked) classes.push('is-checked');

  // Truncate content for preview to prevent performance issues with large files.
  // Thumbnails only need a snippet; full rendering happens in detail view.
  const previewContent = useMemo(() => {
    if (isImage || !content) return '';
    const lines = content.split('\n');
    if (lines.length > 100) {
      return lines.slice(0, 100).join('\n') + '\n...';
    }
    return content;
  }, [content, isImage]);

  return (
    <div className={classes.join(' ')} onClick={onClick} onContextMenu={onContextMenu} title={name}>
      <div className="rv-doc-tile-surface">
        {onStarClick ? (
          <button
            type="button"
            className={`rv-doc-tile-star${starred ? ' is-starred' : ''}`}
            aria-label={starred ? `Unstar ${name}` : `Star ${name}`}
            aria-pressed={Boolean(starred)}
            title={starred ? 'Unstar document' : 'Star document'}
            onClick={(event) => {
              event.stopPropagation();
              onStarClick();
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">kid_star</span>
          </button>
        ) : starred ? (
          <span className="material-symbols-outlined rv-doc-tile-star is-starred" aria-hidden="true">kid_star</span>
        ) : null}
        <div className="rv-doc-tile-preview">
          {isImage ? (
            <img
              src={getPanelFileUrl(panel ?? '', `${folderPath ?? ''}/${name}`)}
              alt={name}
              loading="lazy"
              className="rv-doc-tile-img"
            />
          ) : (
            <CodeView
              content={previewContent}
              extension={ext}
              mode={isMarkdown ? 'markdown' : 'code'}
            />
          )}
        </div>
        <div className="rv-doc-tile-footer">
          {moreButton ?? (onMoreClick ? (
            <button
              type="button"
              className="rv-doc-tile-more"
              aria-label={`More actions for ${name}`}
              onClick={(event) => {
                event.stopPropagation();
                onMoreClick(event);
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
            </button>
          ) : null)}
          <span className="material-symbols-outlined rv-doc-tile-icon">{icon}</span>
          <span className="rv-doc-tile-name">{name}</span>
        </div>
      </div>
      <span className="material-symbols-outlined rv-doc-tile-hover-check" aria-hidden="true">check</span>
    </div>
  );
}
