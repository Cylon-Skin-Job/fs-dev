/**
 * @module ContentArea
 * @role Routes panel ID to the correct content component
 *
 * Priority order:
 * 1. If panel has ui/ folder (hasUiFolder) → RuntimeModule (plugin)
 * 2. If panel has built-in component → static component
 * 3. Fallback → Simple placeholder
 *
 * SPEC-26c-2: right-side view chat removed. ContentArea is now a single-column
 * layout that renders the view's main component or a loading state.
 */

import React, { type ComponentType } from 'react';
import { usePanelStore } from '../state/panelStore';
import { WikiExplorer } from './wiki/WikiExplorer';
import { TicketBoard } from './tickets/TicketBoard';
import { AgentTiles } from './agents/AgentTiles';
import { CaptureTiles } from './capture/CaptureTiles';
import { OfficeGrid } from './office/OfficeGrid';
import { FileExplorer } from './file-explorer/FileExplorer';

/** Built-in component map: panel ID → content component */
const CONTENT_COMPONENTS: Record<string, ComponentType> = {
  'doc-viewer': CaptureTiles,
  'office-viewer': OfficeGrid,
  'file-viewer': FileExplorer,
  'wiki-viewer': WikiExplorer,
  'issues-viewer': TicketBoard,
  'agents-viewer': AgentTiles,
  // calendar-viewer disconnected; falls through to placeholder
};

interface ContentAreaProps {
  panel: string;
}

export const ContentArea: React.FC<ContentAreaProps> = ({ panel }) => {
  const configs = usePanelStore((state) => state.panelConfigs);
  const config = configs.find((c) => c.id === panel);

  // If a built-in static component exists, use it.
  const StaticComponent = CONTENT_COMPONENTS[panel];

  return (
    <main className="rv-content-area">
      {StaticComponent ? (
        <StaticComponent />
      ) : (
        <div className="rv-content-placeholder">
          <h3 style={{ color: 'var(--text-bright)', marginBottom: '16px' }}>
            {config?.name || panel}
          </h3>
          <p style={{ color: 'var(--text-dim)' }}>
            Content area for {(config?.name || panel).toLowerCase()} panel.
          </p>
        </div>
      )}
    </main>
  );
}
