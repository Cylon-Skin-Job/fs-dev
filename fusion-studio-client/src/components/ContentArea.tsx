/**
 * @module ContentArea
 * @role Routes panel ID to the correct content component
 *
 * View routing model:
 * 1. Built-in product panels render static React components.
 * 2. Non-built-in panels with app/index.html render in a shell-managed
 *    fusion-studio:// iframe.
 * 3. Custom/browser panels render through their iframe wrappers.
 * 4. Unknown panels fall back to a simple placeholder.
 *
 * SPEC-26c-2: right-side view chat removed. ContentArea is now a single-column
 * layout that renders the view's main component or a loading state.
 */

import React, { type ComponentType, type ReactNode } from 'react';
import { usePanelStore } from '../state/panelStore';
import { WikiExplorer } from './wiki/WikiExplorer';
import { TicketBoard } from './tickets/TicketBoard';
import { AgentTiles } from './agents/AgentTiles';
import { CaptureTiles } from './capture/CaptureTiles';
import { OfficeGrid } from './office/OfficeGrid';
import { EmailGrid } from './email/EmailGrid';
import { FileExplorer } from './file-explorer/FileExplorer';
import { SystemViewer } from './SystemViewer';
import { WebBrowser } from './browser/WebBrowser';
import { CustomViewer } from './browser/CustomViewer';
import { CalendarViewer } from './calendar/CalendarViewer';
import { ViewLayoutControls } from './ViewLayoutControls';
import { ViewTabBar } from './view-tabs/ViewTabBar';
import './view-tabs/ViewTabBar.css';

/** Built-in component map: panel ID → content component */
const CONTENT_COMPONENTS: Record<string, ComponentType> = {
  'capture-viewer': CaptureTiles,
  'office-viewer': OfficeGrid,
  'email-viewer': EmailGrid,
  'file-viewer': FileExplorer,
  'wiki-viewer': WikiExplorer,
  'issues-viewer': TicketBoard,
  'agents-viewer': AgentTiles,
  'system-viewer': SystemViewer,
  'calendar-viewer': CalendarViewer,
};

interface ContentAreaProps {
  panel: string;
}

function ContentFrame({ panel, children }: { panel: string; children: ReactNode }) {
  return (
    <main className="rv-content-area">
      <ViewLayoutControls panel={panel} />
      <ViewTabBar panel={panel} />
      {children}
    </main>
  );
}

export const ContentArea: React.FC<ContentAreaProps> = ({ panel }) => {
  const configs = usePanelStore((state) => state.panelConfigs);
  const config = configs.find((c) => c.id === panel);
  const StaticComponent = CONTENT_COMPONENTS[panel];

  // Built-in product views stay React-backed even if old iframe artifacts exist.
  if (StaticComponent) {
    return (
      <ContentFrame panel={panel}>
        <StaticComponent />
      </ContentFrame>
    );
  }

  // Shell-managed custom/local app iframe.
  if (config?.hasAppHtml) {
    return (
      <ContentFrame panel={panel}>
        <iframe
          className="rv-view-iframe"
          src={`fusion-studio://${panel}/app/index.html`}
          title={config.name || panel}
          sandbox="allow-scripts allow-same-origin"
        />
      </ContentFrame>
    );
  }

  // Track 2: local custom iframe — user-built local servers, origin-locked, collapsible chrome
  if (config?.type === 'custom' || config?.type === 'iframe') {
    return (
      <ContentFrame panel={panel}>
        <CustomViewer config={config} />
      </ContentFrame>
    );
  }

  // Track 2b: general browser — free navigation, always-visible chrome, back/forward
  if (config?.type === 'browser') {
    return (
      <ContentFrame panel={panel}>
        <WebBrowser config={config} />
      </ContentFrame>
    );
  }

  return (
    <ContentFrame panel={panel}>
      <div className="rv-content-placeholder">
        <h3 className="rv-content-placeholder-heading">
          {config?.name || panel}
        </h3>
        <p className="rv-content-placeholder-body">
          Content area for {(config?.name || panel).toLowerCase()} panel.
        </p>
      </div>
    </ContentFrame>
  );
};
