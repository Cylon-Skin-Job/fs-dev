/**
 * @module ContentArea
 * @role Routes panel ID to the correct content component
 *
 * Dual-track transition (Chunk D):
 * 1. If panel has app/index.html (hasAppHtml) → iframe via fusion-studio://
 * 2. If panel has built-in component → static React component
 * 3. Fallback → Simple placeholder
 *
 * SPEC-26c-2: right-side view chat removed. ContentArea is now a single-column
 * layout that renders the view's main component or a loading state.
 */

import React, { type ComponentType } from 'react';
import { usePanelStore } from '../state/panelStore';
import { WikiViewer } from './WikiViewer';
import { TicketBoard } from './tickets/TicketBoard';
import { AgentTiles } from './agents/AgentTiles';
import { CaptureTiles } from './capture/CaptureTiles';
import { OfficeGrid } from './office/OfficeGrid';
import { FileExplorer } from './file-explorer/FileExplorer';
import { SystemViewer } from './SystemViewer';

/** Built-in component map: panel ID → content component */
const CONTENT_COMPONENTS: Record<string, ComponentType> = {
  'doc-viewer': CaptureTiles,
  'office-viewer': OfficeGrid,
  'file-viewer': FileExplorer,
  'wiki-viewer': WikiViewer,
  'issues-viewer': TicketBoard,
  'agents-viewer': AgentTiles,
  'system-viewer': SystemViewer,
  // calendar-viewer disconnected; falls through to placeholder
};

interface ContentAreaProps {
  panel: string;
}

export const ContentArea: React.FC<ContentAreaProps> = ({ panel }) => {
  const configs = usePanelStore((state) => state.panelConfigs);
  const config = configs.find((c) => c.id === panel);

  // Track 1: iframe view (view ships app/index.html)
  if (config?.hasAppHtml) {
    return (
      <main className="rv-content-area">
        <iframe
          className="rv-view-iframe"
          src={`fusion-studio://${panel}/app/index.html`}
          title={config.name || panel}
          sandbox="allow-scripts allow-same-origin"
        />
      </main>
    );
  }

  // Track 2: built-in static React component
  const StaticComponent = CONTENT_COMPONENTS[panel];

  return (
    <main className="rv-content-area">
      {StaticComponent ? (
        <StaticComponent />
      ) : (
        <div className="rv-content-placeholder">
          <h3 className="rv-content-placeholder-heading">
            {config?.name || panel}
          </h3>
          <p className="rv-content-placeholder-body">
            Content area for {(config?.name || panel).toLowerCase()} panel.
          </p>
        </div>
      )}
    </main>
  );
};
