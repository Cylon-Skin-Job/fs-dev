import { useEffect } from 'react';
import type { FileWithContent } from '../tile-row/TileRow';
import { isImageFile } from '../tile-row/documentTileUtils';
import { CodeView } from '../CodeView';
import { IframeSurface, useCacheBusterUrl } from '../iframe';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';
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
        <button
          type="button"
          className="rv-document-preview-expand"
          onClick={onOpenFullScreen}
          aria-label={`Open ${file.name} full screen`}
          title="Open full screen"
        >
          <span className="material-symbols-outlined" aria-hidden="true">expand_content</span>
        </button>
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

        <footer className="rv-document-preview-footer">
          <CaptureDocumentMenuButton
            fileName={file.name}
            className="rv-doc-tile-more rv-document-preview-more"
            onRename={onRename}
            onArchive={onArchive}
            onDelete={onDelete}
          />
          <span className="material-symbols-outlined rv-doc-tile-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="rv-document-preview-name">{file.name}</span>
          <div className="rv-document-preview-footer-actions">
            <CopyPathButton
              panel={panel}
              relativePath={file.path}
              className="rv-document-preview-footer-action"
              title="Copy file path"
            />
            <SendToChatButton
              panel={panel}
              relativePath={file.path}
              className="rv-document-preview-footer-action"
              title="Send file path to chat"
            />
            <button
              type="button"
              className={`rv-document-preview-footer-action rv-document-preview-star${starred ? ' is-starred' : ''}`}
              onClick={onToggleStar}
              aria-label={starred ? `Unstar ${file.name}` : `Star ${file.name}`}
              aria-pressed={starred}
              title={starred ? 'Unstar' : 'Star'}
            >
              <span className="material-symbols-outlined" aria-hidden="true">kid_star</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
