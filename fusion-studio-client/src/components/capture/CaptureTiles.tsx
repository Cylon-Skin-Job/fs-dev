/**
 * @module CaptureTiles
 * @role Grid / document orchestration view for the doc-viewer panel
 *
 * Renders either the tile grid or the file detail view. All state is owned by
 * useDocViewerState; this component only wires presentation to that state.
 */

import { useEffect, useRef } from 'react';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { useDocViewerState } from '../../hooks/useDocViewerState';
import { TileRow } from '../tile-row/TileRow';
import type { FileWithContent } from '../tile-row/TileRow';
import { FilePageView } from './FilePageView';
import { DocViewerHeader } from './DocViewerHeader';

const ROWS = [
  { label: 'Captures', folder: 'captures' },
  { label: 'Specs', folder: 'specs' },
  { label: 'TODO', folder: 'todo' },
  { label: 'Playground', folder: 'playground' },
  { label: 'Assets', folder: 'assets' },
  { label: 'Screenshots', folder: 'screenshots' },
];

export function CaptureTiles() {
  useViewLayoutStyles('doc-viewer');
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    mode,
    selected,
    gridScroll,
    docScroll,
    setMode,
    selectFile,
    selectSibling,
    clearSelection,
    restoreSelectedFile,
    archiveSelectedFile,
    persistGridScroll,
    persistDocScroll,
  } = useDocViewerState();

  useEffect(() => {
    if (selected || !scrollRef.current || gridScroll <= 0) return;
    const el = scrollRef.current;
    if (el.scrollHeight > el.clientHeight) {
      el.scrollTop = Math.min(gridScroll, el.scrollHeight - el.clientHeight);
    }
  }, [selected, gridScroll]);

  const handleFileSelect = (folder: string) => (file: FileWithContent) => {
    selectFile(folder, file);
  };

  const visibleRows = ROWS.map((row) => ({
    ...row,
    label: mode === 'archive' ? `Archive: ${row.label}` : row.label,
    folder: mode === 'archive' ? `${row.folder}/Archive` : row.folder,
  }));

  if (selected) {
    return (
      <FilePageView
        file={selected.file}
        siblings={selected.siblings}
        panel="doc-viewer"
        folder={selected.folder}
        docScroll={docScroll}
        onDocScroll={persistDocScroll}
        onRestore={restoreSelectedFile}
        onArchive={archiveSelectedFile}
        onBack={clearSelection}
        onSelectSibling={selectSibling}
      />
    );
  }

  return (
    <div className="rv-tile-grid rv-doc-viewer-grid">
      <DocViewerHeader mode={mode} onModeChange={setMode} />
      <div
        ref={scrollRef}
        className="rv-doc-viewer-grid-scroll"
        onScroll={(e) => persistGridScroll(e.currentTarget.scrollTop)}
      >
        {visibleRows.map((row) => (
          <TileRow
            key={row.folder}
            label={row.label}
            panel="doc-viewer"
            folder={row.folder}
            onFileSelect={handleFileSelect(row.folder)}
          />
        ))}
      </div>
    </div>
  );
}
