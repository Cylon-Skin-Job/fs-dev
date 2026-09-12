/**
 * @module CaptureDocumentPresenter
 * @role VIEW-02 Slice 3 — the addressed Capture document presenter.
 *
 * Store-connected at the connected-host layer (this module runs inside the
 * capture adopter's first-party registration); `FilePageView` itself stays
 * presentation-only. The tab's committed descriptor input supplies path,
 * name, extension, mode, and the preserved scroll; scroll updates persist
 * through the connected owner's atomic acknowledged commit.
 */

import { useEffect } from 'react';
import { DOC_VIEWER_ARCHIVE_FOLDER } from '../../lib/viewFolders';
import { activityId } from '../../lib/viewActivity';
import { normalizeViewCollections } from '../../lib/viewCollections';
import { useFileDataStore } from '../../state/fileDataStore';
import { usePanelStore } from '../../state/panelStore';
import { useFileTileMenu } from '../../hooks/useFileTileMenu';
import { useTileFileActions } from '../../hooks/useTileFileActions';
import type { FileWithContent } from '../tile-row/TileRow';
import { FilePageView } from './FilePageView';
import {
  closeCaptureTabByTargetKey,
  persistCaptureDocumentScroll,
} from '../view-tabs/captureConnectedTabs';

export interface CaptureDocumentPresenterInput {
  path: string;
  name: string;
  extension?: string;
  mode?: string;
  docScroll?: number;
}

export function CaptureDocumentPresenter(props: {
  targetKey: string;
  input: CaptureDocumentPresenterInput;
}) {
  const { targetKey, input } = props;
  const path = input.path;
  const name = input.name;
  const extension = input.extension ?? name.split('.').pop()?.toLowerCase() ?? '';
  const folder = path.slice(0, path.lastIndexOf('/'));
  const docScroll = typeof input.docScroll === 'number' && Number.isFinite(input.docScroll)
    ? input.docScroll
    : 0;
  const storeKey = `capture-viewer:${path}`;

  const generation = useFileDataStore((s) => s.generation);
  const content = useFileDataStore((s) => s.contents[storeKey]);
  const metadata = useFileDataStore((s) => s.contentMetadata[storeKey]);
  const requestContent = useFileDataStore((s) => s.requestContent);

  useEffect(() => {
    requestContent('capture-viewer', path);
  }, [generation, path, requestContent]);

  const rawCollections = usePanelStore((s) => s.viewStates['capture-viewer']?.collections);
  const docCollections = normalizeViewCollections(rawCollections);
  const starredIds = new Set(docCollections.starred.map((item) => item.id));
  const starred = starredIds.has(activityId('capture-viewer', path));

  const { getFileStarClickHandler } = useFileTileMenu({
    panel: 'capture-viewer',
    folder: '',
  });
  const { archiveOrRestoreFile, renameFile, deleteFile } = useTileFileActions({
    panel: 'capture-viewer',
    folder,
  });

  const file: FileWithContent = {
    name,
    path,
    type: 'file',
    extension,
    content: content ?? '',
    ...(metadata ?? {}),
  } as FileWithContent;

  return (
    <FilePageView
      file={file}
      panel="capture-viewer"
      folder={folder}
      folderName={folder === DOC_VIEWER_ARCHIVE_FOLDER ? 'Archive' : undefined}
      docScroll={docScroll}
      onDocScroll={(scrollTop) => persistCaptureDocumentScroll(targetKey, scrollTop)}
      onArchive={() => archiveOrRestoreFile(file, folder)}
      starred={starred}
      onRename={() => renameFile(file, folder)}
      onDelete={() => deleteFile(file, folder)}
      onToggleStar={getFileStarClickHandler(file, folder)}
      /** The connected tab chrome owns the top identity. */
      hideChromeTitle={true}
      onBack={() => closeCaptureTabByTargetKey(targetKey)}
    />
  );
}
