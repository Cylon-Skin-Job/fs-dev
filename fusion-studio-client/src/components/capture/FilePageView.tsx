/**
 * @module FilePageView
 * @role Full-content file viewer for the capture-viewer panel
 *
 * Pure presentation. Displays a single file at readable size, with a back
 * button, filename, chrome actions, mode toggle, and a bottom ribbon of
 * sibling tiles.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import type { FileWithContent } from '../tile-row/TileRow';
import { DocumentTile } from '../tile-row/DocumentTile';
import { isImageFile } from '../tile-row/documentTileUtils';
import { CodeView } from '../CodeView';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';
import { getPanelFileUrl } from '../../lib/panels';
import { useActiveResourceStore } from '../../state/activeResourceStore';
import { usePanelStore } from '../../state/panelStore';
import { DOC_VIEWER_ARCHIVE_FOLDER } from '../../hooks/useDocViewerState';
import { activityId } from '../../lib/viewActivity';
import { normalizeViewCollections } from '../../lib/viewCollections';
import { LinkedResourceIndicator } from '../LinkedResourceIndicator';
import { IframeSurface, useCacheBusterUrl } from '../iframe';
import { DocViewerChrome } from './DocViewerChrome';
import './FilePageView.css';
import './DocViewerHeader.css';
import './DocViewerChrome.css';

interface FilePageViewProps {
  file: FileWithContent;
  siblings?: FileWithContent[];
  panel: string;
  folder: string;
  folderName?: string;
  showRibbon?: boolean;
  docScroll?: number;
  onDocScroll?: (scrollTop: number) => void;
  onRestore?: () => void;
  onArchive?: () => void;
  onBack: () => void;
  onSelectSibling?: (file: FileWithContent) => void;
}

export function FilePageView({
  file,
  siblings,
  panel,
  folder,
  folderName,
  showRibbon = true,
  docScroll = 0,
  onDocScroll,
  onRestore,
  onArchive,
  onBack,
  onSelectSibling,
}: FilePageViewProps) {
  const isImage = isImageFile(file.name);
  const extension = file.extension || file.name.split('.').pop()?.toLowerCase() || '';
  const isMarkdown = extension === 'md' || extension === 'markdown';
  const isHtml = extension === 'html' || extension === 'htm';
  const isArchiveDoc = folder === DOC_VIEWER_ARCHIVE_FOLDER;
  const titleLabel = isArchiveDoc
    ? `ARCHIVE: ${file.name}`
    : folderName
      ? `${folderName} / ${file.name}`
      : file.name;
  const [viewMode, setViewMode] = useState<'code' | 'markdown'>('code');
  const setActiveResource = useActiveResourceStore((s) => s.setActiveResource);
  const rawCollections = usePanelStore((s) => s.viewStates[panel]?.collections);
  const starredIds = useMemo(
    () => new Set(normalizeViewCollections(rawCollections).starred.map((item) => item.id)),
    [rawCollections]
  );
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
  }, [docScroll, file.path, file.content, viewMode]);

  return (
    <div className="rv-file-page-view">
      <DocViewerChrome
        left={
          <>
            <button className="rv-capture-viewer-back" onClick={onBack} title="Back to tiles">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span className="rv-capture-viewer-title">{titleLabel}</span>
            {isArchiveDoc && onRestore && (
              <button
                type="button"
                className="rv-capture-viewer-restore"
                onClick={onRestore}
                title="Restore to active folder"
              >
                Restore
              </button>
            )}
          </>
        }
        right={
          <div className="rv-capture-viewer-actions">
            {file.isSymlink && file.symlinkTarget ? (
              <LinkedResourceIndicator
                symlinkTarget={file.symlinkTarget}
                className="rv-file-page-action"
              />
            ) : null}
            {!isArchiveDoc && onArchive && (
              <button
                type="button"
                className="rv-file-page-action"
                onClick={onArchive}
                title="Archive this file"
              >
                <span className="material-symbols-outlined">archive</span>
              </button>
            )}
            <CopyPathButton panel={panel} relativePath={file.path} title="Copy file path" />
            <SendToChatButton panel={panel} relativePath={file.path} title="Send file path to chat" />
            {isMarkdown && (
              <button
                className="rv-file-page-action"
                onClick={() => setViewMode(viewMode === 'code' ? 'markdown' : 'code')}
                title={viewMode === 'code' ? 'Switch to document view' : 'Switch to code view'}
              >
                <span className="material-symbols-outlined">
                  {viewMode === 'code' ? 'toggle_off' : 'toggle_on'}
                </span>
              </button>
            )}
          </div>
        }
      />

      <div
        ref={contentRef}
        className={`rv-file-page-content${isHtml ? ' rv-file-page-html' : ''}${!isImage && !isHtml && !(isMarkdown && viewMode === 'markdown') ? ' rv-file-page-document' : ''}`}
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
            src={useCacheBusterUrl(getPanelFileUrl(panel, file.path), true)}
            title={file.name}
          />
        ) : (
          <CodeView content={file.content} extension={extension} mode={isMarkdown ? viewMode : 'code'} />
        )}
      </div>

      {showRibbon && siblings && siblings.length > 0 && onSelectSibling && (
        <div className="rv-file-page-ribbon">
          <div className="rv-file-page-ribbon-scroll">
            {siblings.map((sib) => (
              <DocumentTile
                key={sib.path}
                name={sib.name}
                content={sib.content}
                extension={sib.extension}
                panel={panel}
                folderPath={folder}
                size="small"
                active={sib.path === file.path}
                starred={starredIds.has(activityId(panel, sib.path))}
                onClick={() => onSelectSibling(sib)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
