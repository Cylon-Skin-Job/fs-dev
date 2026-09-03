import { usePanelStore } from '../state/panelStore';
import { isCaptureTabsLatched, plusPressed } from './view-tabs/captureTabsController';
import { viewTabDomId } from './view-tabs/viewTabDomIds';

interface ViewLayoutControlsProps {
  panel: string;
}

/** App-header controls for the active view's primary chat/content columns. */
export function AppHeaderLayoutControls({ panel }: ViewLayoutControlsProps) {
  const chatCollapsed = usePanelStore(
    (state) => state.viewStates[panel]?.collapsed?.leftChat ?? false,
  );
  const contentCollapsed = usePanelStore(
    (state) => state.viewStates[panel]?.collapsed?.contentArea ?? false,
  );
  const toggleCollapsed = usePanelStore((state) => state.toggleCollapsed);
  const contentFullScreen = chatCollapsed && !contentCollapsed;

  function handleAdvanceContent() {
    if (contentFullScreen) return;
    toggleCollapsed(panel, contentCollapsed ? 'contentArea' : 'leftChat');
  }

  function handleReverseContent() {
    if (contentCollapsed) return;
    toggleCollapsed(panel, chatCollapsed ? 'leftChat' : 'contentArea');
  }

  return (
    <>
      <button
        type="button"
        className="rv-fusion-icon-btn"
        aria-label={contentFullScreen ? 'Content fully expanded' : 'Expand content'}
        title={contentFullScreen ? 'Content fully expanded' : 'Expand content'}
        onClick={handleAdvanceContent}
        disabled={contentFullScreen}
      >
        <span className="material-symbols-outlined">first_page</span>
      </button>
      <button
        type="button"
        className="rv-fusion-icon-btn"
        aria-label={contentCollapsed ? 'Content collapsed' : 'Reduce content'}
        title={contentCollapsed ? 'Content collapsed' : 'Reduce content'}
        onClick={handleReverseContent}
        disabled={contentCollapsed}
      >
        <span className="material-symbols-outlined">last_page</span>
      </button>
    </>
  );
}

/**
 * Conditional view-shell controls that remain attached to view content.
 */
export function ViewLayoutControls({ panel }: ViewLayoutControlsProps) {
  const chatCollapsed = usePanelStore(
    (state) => state.viewStates[panel]?.collapsed?.leftChat ?? false,
  );
  const threadsCollapsed = usePanelStore(
    (state) => state.viewStates[panel]?.collapsed?.leftSidebar ?? false,
  );
  const toggleCollapsed = usePanelStore((state) => state.toggleCollapsed);
  const showThreadDrawerControl = chatCollapsed && threadsCollapsed;
  const isCapturePanel = panel === 'capture-viewer';
  const showCapturePlus = usePanelStore((state) => {
    if (!isCapturePanel) return false;
    const vs = state.viewStates[panel];
    const tabs = vs?.docViewerTabs ?? [];
    const active = tabs.find((tab) => tab.id === vs?.docViewerActiveTabId) ?? tabs[0];
    return Boolean(vs?.docViewerFullPage || active?.kind === 'doc')
      && !isCaptureTabsLatched(tabs);
  });

  function handleCapturePlus() {
    const createdId = plusPressed();
    if (!createdId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(viewTabDomId(panel, createdId))?.focus();
    });
  }

  if (!showThreadDrawerControl && !showCapturePlus) return null;

  return (
    <div className="rv-view-layout-controls" aria-label="View layout controls">
      <div className="rv-view-layout-controls__leading">
        {showCapturePlus && (
          <button
            type="button"
            className="rv-view-layout-control"
            aria-label="New capture view"
            title="New capture view"
            onClick={handleCapturePlus}
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        )}
        {showThreadDrawerControl && (
          <button
            type="button"
            className="rv-view-layout-control rv-chat-thread-dock"
            aria-label="Show threads"
            title="Show threads"
            onClick={() => toggleCollapsed(panel, 'leftSidebar')}
          >
            <span className="material-symbols-outlined">dock_to_right</span>
          </button>
        )}
      </div>
    </div>
  );
}
