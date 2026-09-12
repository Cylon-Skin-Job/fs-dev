/**
 * @module FileDocumentPresenter
 * @role VIEW-02 Slice 4 — the addressed File document presenter.
 *
 * Store-connected at the connected-host layer (this module runs inside the
 * File adopter's first-party registration); the presentation stays the
 * EXISTING File Explorer viewer structure: the file breadcrumb/symlink info
 * bar, the dock control, `FileContentRenderer`, and the floating path
 * actions — with the shared `FileTreeDrawer` beside it (SPEC-02 §3/§10: the
 * accepted file data/content owner, loading/error behavior, and symlink
 * metadata are untouched; fetching and saving keep using the established
 * `fileDataStore` correlation keyed by the canonical `file-viewer:<path>`).
 */

import { useEffect } from 'react';
import { useFileDataStore } from '../../state/fileDataStore';
import { usePanelStore } from '../../state/panelStore';
import { FloatingPathActions } from '../FloatingPathActions';
import { FileContentRenderer } from './FileContentRenderer';
import { FileTreeDrawer } from './FileTreeDrawer';
import './FileDocumentPresenter.css';

export interface FileDocumentPresenterInput {
  path: string;
  name: string;
  extension: string;
}

export function FileDocumentPresenter({ input }: { input: FileDocumentPresenterInput }) {
  const path = input.path;
  const storeKey = `file-viewer:${path}`;

  const generation = useFileDataStore((s) => s.generation);
  const content = useFileDataStore((s) => s.contents[storeKey]);
  const error = useFileDataStore((s) => s.contentErrors[storeKey]);
  const loading = useFileDataStore((s) => s.pendingContents.has(storeKey));
  const requestContent = useFileDataStore((s) => s.requestContent);
  const drawerClosed = usePanelStore(
    (s) => s.viewStates['file-viewer']?.collapsed?.rightCol ?? false,
  );
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);

  useEffect(() => {
    requestContent('file-viewer', path);
  }, [generation, path, requestContent]);

  return (
    <div className="rv-file-explorer-layout">
      <div className="rv-file-explorer-main">
        <div className="rv-file-viewer">
          <div className={`rv-file-viewer-content${loading ? ' loading' : ''}`}>
            {error ? (
              <div className="rv-file-explorer-empty">{error}</div>
            ) : (
              <FileContentRenderer
                content={content ?? ''}
                extension={input.extension}
                fileName={input.name}
              />
            )}
          </div>
        </div>

        <button
          type="button"
          className="rv-view-layout-control rv-file-tree-dock-control rv-file-doc-dock"
          aria-label={drawerClosed ? 'Show file tree' : 'Hide file tree'}
          aria-expanded={!drawerClosed}
          title={drawerClosed ? 'Show file tree' : 'Hide file tree'}
          onClick={() => toggleCollapsed('file-viewer', 'rightCol')}
        >
          <span className="material-symbols-outlined">dock_to_left</span>
        </button>

        <FloatingPathActions
          panel="file-viewer"
          relativePath={path}
          className="rv-file-floating-actions"
          copyTitle="Copy file path"
          sendTitle="Send file path to chat"
          ariaLabel="File actions"
        />
      </div>

      <FileTreeDrawer />
    </div>
  );
}
