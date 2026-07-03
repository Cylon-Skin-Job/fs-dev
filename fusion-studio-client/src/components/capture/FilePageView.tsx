/**
 * @module FilePageView
 * @role Full-content file viewer for the doc-viewer panel
 *
 * Pure presentation. Displays a single file at readable size, with a back
 * button, filename, chrome actions, mode toggle, and a bottom ribbon of
 * sibling tiles.
 */

import { useState, useEffect, useRef } from 'react';
import type { FileWithContent } from '../tile-row/TileRow';
import { DocumentTile } from '../tile-row/DocumentTile';
import { isImageFile } from '../tile-row/documentTileUtils';
import { CodeView } from '../CodeView';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';
import { getPanelFileUrl } from '../../lib/panels';
import { useActiveResourceStore } from '../../state/activeResourceStore';
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
  const isMarkdown = file.extension === 'md' || file.name.endsWith('.md');
  const isArchiveDoc = folder.includes('/Archive');
  const titleLabel = isArchiveDoc
    ? `ARCHIVE: ${file.name}`
    : folderName
      ? `${folderName} / ${file.name}`
      : file.name;
  const [viewMode, setViewMode] = useState<'code' | 'markdown'>('code');
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
  }, [docScroll, file.path, file.content, viewMode]);

  return (
    <div className="rv-file-page-view">
      <DocViewerChrome
        left={
          <>
            <button className="rv-doc-viewer-back" onClick={onBack} title="Back to tiles">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span className="rv-doc-viewer-title">{titleLabel}</span>
            {isArchiveDoc && onRestore && (
              <button
                type="button"
                className="rv-doc-viewer-restore"
                onClick={onRestore}
                title="Restore to active folder"
              >
                Restore
              </button>
            )}
          </>
        }
        right={
          <div className="rv-doc-viewer-actions">
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
        className={`rv-file-page-content${!isImage && !(isMarkdown && viewMode === 'markdown') ? ' rv-file-page-document' : ''}`}
        onScroll={(e) => onDocScroll?.(e.currentTarget.scrollTop)}
      >
        {isImage ? (
          <img
            src={getPanelFileUrl(panel, `${folder}/${file.name}`)}
            alt={file.name}
            className="rv-file-page-image"
          />
        ) : (
          <CodeView content={file.content} extension={file.extension} mode={isMarkdown ? viewMode : 'code'} />
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
                onClick={() => onSelectSibling(sib)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
