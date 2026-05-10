/**
 * @module CaptureTiles
 * @role Tile grid view for the Capture panel
 *
 * Two modes:
 * - Grid: renders each subfolder as a horizontal TileRow (default)
 * - Detail: full-page FilePageView with bottom ribbon
 *
 * Reuses the generic tile-row components.
 */

import { useState, useCallback } from 'react';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { TileRow } from '../tile-row/TileRow';
import type { FileWithContent } from '../tile-row/TileRow';
import { FilePageView } from './FilePageView';


const ROWS = [
  { label: 'Captures', folder: 'captures' },
  { label: 'Specs', folder: 'specs' },
  { label: 'TODO', folder: 'todo' },
  { label: 'Playground', folder: 'playground' },
  { label: 'Assets', folder: 'assets' },
  { label: 'Screenshots', folder: 'screenshots' },
];

interface SelectedFile {
  file: FileWithContent;
  siblings: FileWithContent[];
  folder: string;
}

export function CaptureTiles() {
  useViewLayoutStyles('doc-viewer');
  const [selected, setSelected] = useState<SelectedFile | null>(null);

  const handleFileSelect = useCallback((folder: string) => {
    return (file: FileWithContent, siblings: FileWithContent[]) => {
      setSelected({ file, siblings, folder });
    };
  }, []);

  const handleBack = useCallback(() => {
    setSelected(null);
  }, []);

  const handleSelectSibling = useCallback((sib: FileWithContent) => {
    setSelected((prev) => prev ? { ...prev, file: sib } : null);
  }, []);

  // Detail view
  if (selected) {
    return (
      <FilePageView
        file={selected.file}
        siblings={selected.siblings}
        panel="doc-viewer"
        folder={selected.folder}
        onBack={handleBack}
        onSelectSibling={handleSelectSibling}
      />
    );
  }

  // Grid view
  return (
    <div className="rv-tile-grid">
      {ROWS.map((row) => (
        <TileRow
          key={row.folder}
          label={row.label}
          panel="doc-viewer"
          folder={row.folder}
          onFileSelect={handleFileSelect(row.folder)}
        />
      ))}
    </div>
  );
}
