/**
 * @module FilePageView
 * @role Full-content file viewer for the capture-viewer panel
 *
 * Pure presentation. Displays a single file at readable size, with a back
 * button, filename, and chrome actions.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { FileWithContent } from '../tile-row/TileRow';
import { isImageFile } from '../tile-row/documentTileUtils';
import { CodeView } from '../CodeView';
import { FloatingPathActions } from '../FloatingPathActions';
import { getPanelFileUrl } from '../../lib/panels';
import { getFileIcon } from '../../lib/file-utils';
import { useActiveResourceStore } from '../../state/activeResourceStore';
import { DOC_VIEWER_ARCHIVE_FOLDER } from '../../hooks/useDocViewerState';
import { LinkedResourceIndicator } from '../LinkedResourceIndicator';
import { IframeSurface, useCacheBusterUrl } from '../iframe';
import { DocViewerChrome } from './DocViewerChrome';
import { stripFrontmatter } from '../../lib/transforms';
import { CaptureDocumentMenuButton } from './CaptureDocumentMenuButton';
import './FilePageView.css';
import './DocViewerHeader.css';
import './DocViewerChrome.css';

interface FilePageViewProps {
  file: FileWithContent;
  panel: string;
  folder: string;
  folderName?: string;
  docScroll?: number;
  onDocScroll?: (scrollTop: number) => void;
  onRestore?: () => void;
  onArchive?: () => void;
  starred?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
  onToggleStar?: () => void;
  /** Tabs mode owns the top chrome; suppress the centered file identity. */
  hideChromeTitle?: boolean;
  onBack: () => void;
}

function extractMarkdownHeading(content: string, fallback: string) {
  const source = stripFrontmatter(content);
  const heading = /^ {0,3}#\s+(.+?)\s*#*\s*$(?:\r?\n)?/m.exec(source);
  if (!heading || heading.index === undefined) {
    return { title: fallback, body: source };
  }

  const title = heading[1]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
  const body = source.slice(0, heading.index) + source.slice(heading.index + heading[0].length);
  return { title: title || fallback, body };
}

export function FilePageView({
  file,
  panel,
  folder,
  folderName,
  docScroll = 0,
  onDocScroll,
  onRestore,
  onArchive,
  starred = false,
  onRename,
  onDelete,
  onToggleStar,
  hideChromeTitle = false,
  onBack,
}: FilePageViewProps) {
  const isImage = isImageFile(file.name);
  const extension = file.extension || file.name.split('.').pop()?.toLowerCase() || '';
  const isMarkdown = extension === 'md' || extension === 'markdown';
  const isHtml = extension === 'html' || extension === 'htm';
  const isCaptureView = panel === 'capture-viewer';
  const fileIcon = getFileIcon(extension, file.name);
  const isArchiveDoc = folder === DOC_VIEWER_ARCHIVE_FOLDER;
  const htmlUrl = useCacheBusterUrl(getPanelFileUrl(panel, file.path), true);
  const titleLabel = isArchiveDoc
    ? `ARCHIVE: ${file.name}`
    : folderName
      ? `${folderName} / ${file.name}`
      : file.name;
  const markdownDocument = useMemo(
    () => isMarkdown ? extractMarkdownHeading(file.content, file.name) : null,
    [file.content, file.name, isMarkdown],
  );
  const documentTitle = markdownDocument?.title ?? titleLabel;
  const setActiveResource = useActiveResourceStore((s) => s.setActiveResource);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveResource(panel, file.path);
  }, [panel, file.path, setActiveResource]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || docScroll <= 0) return;
    if (el.scrollHeight > el.clientHeight) {
      el.scrollTop = Math.min(docScroll, el.scrollHeight - el.clientHeight);
    }
  }, [docScroll, file.path, file.content]);

  return (
    <div className={`rv-file-page-view${isCaptureView ? ' rv-file-page-view--capture' : ''}`}>
      <DocViewerChrome
        left={
          <>
            {!isCaptureView ? (
              <button
                type="button"
                className="rv-capture-viewer-close"
                onClick={onBack}
                aria-label="Close document"
                title="Close document"
              >
                Close
              </button>
            ) : null}
            {isArchiveDoc && onRestore ? (
              <button
                type="button"
                className="rv-capture-viewer-restore"
                onClick={onRestore}
                title="Restore to active folder"
              >
                Restore
              </button>
            ) : null}
          </>
        }
        center={
          isCaptureView && hideChromeTitle ? null : (
            isCaptureView ? (
              <span className="rv-capture-viewer-file-identity">
                <span className="material-symbols-outlined" aria-hidden="true">{fileIcon}</span>
                <span className="rv-capture-viewer-title">{file.name}</span>
              </span>
            ) : (
              <span className="rv-capture-viewer-title">{titleLabel}</span>
            )
          )
        }
        right={
          <div className="rv-capture-viewer-actions">
            {file.isSymlink && file.symlinkTarget ? (
              <LinkedResourceIndicator
                symlinkTarget={file.symlinkTarget}
                className="rv-file-page-action"
              />
            ) : null}
            {onToggleStar ? (
              <button
                type="button"
                className={`rv-file-page-action rv-capture-viewer-star${starred ? ' is-starred' : ''}`}
                onClick={onToggleStar}
                aria-label={starred ? `Unstar ${file.name}` : `Star ${file.name}`}
                aria-pressed={starred}
                title={starred ? 'Unstar' : 'Star'}
              >
                <span className="material-symbols-outlined" aria-hidden="true">kid_star</span>
              </button>
            ) : null}
            {onRename || onDelete || onToggleStar ? (
              <CaptureDocumentMenuButton
                fileName={file.name}
                className="rv-file-page-action"
                onRename={onRename}
                onArchive={!isArchiveDoc ? onArchive : undefined}
                onDelete={onDelete}
              />
            ) : null}
          </div>
        }
      />

      {isCaptureView ? (
        <div className="rv-capture-document-subheader">
          <button
            type="button"
            className="rv-capture-document-subheader-back"
            onClick={onBack}
            aria-label="Close document"
            title="Close document"
          >
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          </button>
          <span className="rv-capture-document-subheader-title">{documentTitle}</span>
        </div>
      ) : null}

      <div
        ref={contentRef}
        className={`rv-file-page-content${isHtml ? ' rv-file-page-html' : ''}${!isImage && !isHtml && !isMarkdown ? ' rv-file-page-document' : ''}`}
        onScroll={(e) => onDocScroll?.(e.currentTarget.scrollTop)}
      >
        {isImage ? (
          <img
            src={getPanelFileUrl(panel, file.path)}
            alt={file.name}
            className="rv-file-page-image"
          />
        ) : isHtml ? (
          <IframeSurface
            className="rv-file-page-html-frame"
            iframeClassName="rv-file-page-html-iframe"
            src={htmlUrl}
            title={file.name}
          />
        ) : (
          <CodeView
            content={markdownDocument?.body ?? file.content}
            extension={extension}
            mode={isMarkdown ? 'markdown' : 'code'}
          />
        )}
      </div>

      <FloatingPathActions
        panel={panel}
        relativePath={file.path}
        copyTitle="Copy file path"
        sendTitle="Send file path to chat"
        ariaLabel={isCaptureView ? 'Capture document actions' : 'Document actions'}
      />

    </div>
  );
}
