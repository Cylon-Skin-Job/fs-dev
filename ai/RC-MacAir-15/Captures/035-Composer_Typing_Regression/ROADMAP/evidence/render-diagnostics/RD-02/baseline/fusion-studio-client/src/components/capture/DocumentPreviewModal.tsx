import { useEffect } from 'react';
import type { FileWithContent } from '../tile-row/TileRow';
import { isImageFile } from '../tile-row/documentTileUtils';
import { CodeView } from '../CodeView';
import { IframeSurface, useCacheBusterUrl } from '../iframe';
import { getPanelFileUrl } from '../../lib/panels';
import { getFileIcon } from '../../lib/file-utils';
import { CaptureDocumentMenuButton } from './CaptureDocumentMenuButton';
import './DocumentPreviewModal.css';

interface DocumentPreviewModalProps {
  file: FileWithContent;
  panel: string;
  starred: boolean;
  onClose: () => void;
  onOpenFullScreen: () => void;
  /** VIEW-02 Slice 3: TABS-03 `new` disposition (adopted Capture path). */
  onOpenInNewTab?: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
}

export function DocumentPreviewModal({
  file,
  panel,
  starred,
  onClose,
  onOpenFullScreen,
  onOpenInNewTab,
  onRename,
  onArchive,
  onDelete,
  onToggleStar,
}: DocumentPreviewModalProps) {
  const extension = file.extension || file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = isImageFile(file.name);
  const isHtml = extension === 'html' || extension === 'htm';
  const isMarkdown = extension === 'md' || extension === 'markdown';
  const icon = getFileIcon(extension, file.name);
  const fileUrl = getPanelFileUrl(panel, file.path);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="rv-document-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="rv-document-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${file.name}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="rv-document-preview-header">
          <span className="material-symbols-outlined rv-doc-tile-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="rv-document-preview-name">{file.name}</span>
          <div className="rv-document-preview-header-actions">
            <button
              type="button"
              className={`rv-document-preview-header-action rv-document-preview-star${starred ? ' is-starred' : ''}`}
              onClick={onToggleStar}
              aria-label={starred ? `Unstar ${file.name}` : `Star ${file.name}`}
              aria-pressed={starred}
              title={starred ? 'Unstar' : 'Star'}
            >
              <span className="material-symbols-outlined" aria-hidden="true">kid_star</span>
            </button>
            <CaptureDocumentMenuButton
              fileName={file.name}
              className="rv-document-preview-header-action rv-document-preview-more"
              onRename={onRename}
              onArchive={onArchive}
              onDelete={onDelete}
            />
            {onOpenInNewTab && (
              <button
                type="button"
                className="rv-document-preview-header-action rv-document-preview-open-new-tab"
                onClick={onOpenInNewTab}
                aria-label={`Open ${file.name} in new tab`}
                title="Open in new tab"
              >
                <span className="material-symbols-outlined" aria-hidden="true">tab</span>
              </button>
            )}
            <button
              type="button"
              className="rv-document-preview-header-action rv-document-preview-expand"
              onClick={onOpenFullScreen}
              aria-label={`Open ${file.name} full screen`}
              title="Open full screen"
            >
              <span className="material-symbols-outlined" aria-hidden="true">expand_content</span>
            </button>
            <button
              type="button"
              className="rv-document-preview-header-action"
              onClick={onClose}
              aria-label={`Close ${file.name} preview`}
              title="Close preview"
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        </header>
        <div
          className={`rv-document-preview-content${isHtml ? ' is-html' : ''}`}
          role="button"
          tabIndex={0}
          title="Open full screen"
          onClick={onOpenFullScreen}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpenFullScreen();
            }
          }}
        >
          {isImage ? (
            <img src={fileUrl} alt={file.name} className="rv-document-preview-image" />
          ) : isHtml ? (
            <IframeSurface
              className="rv-document-preview-html-frame"
              iframeClassName="rv-document-preview-html-iframe"
              src={useCacheBusterUrl(fileUrl, true)}
              title={file.name}
            />
          ) : (
            <CodeView
              content={file.content}
              extension={extension}
              mode={isMarkdown ? 'markdown' : 'code'}
            />
          )}
        </div>

      </section>
    </div>
  );
}
