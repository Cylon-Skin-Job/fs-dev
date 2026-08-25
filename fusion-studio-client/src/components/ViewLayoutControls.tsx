import { usePanelStore } from '../state/panelStore';

interface ViewLayoutControlsProps {
  panel: string;
}

/**
 * Universal view-shell controls. These live above view content so every view
 * type gets identical chat/content toggles in identical locations.
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

  function handleHideContent() {
    if (chatCollapsed) toggleCollapsed(panel, 'leftChat');
    toggleCollapsed(panel, 'contentArea');
  }

  return (
    <div className="rv-view-layout-controls" aria-label="View layout controls">
      <div className="rv-view-layout-controls__leading">
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
        <button
          type="button"
          className="rv-view-layout-control"
          aria-label={chatCollapsed ? 'Expand chat' : 'Collapse chat'}
          title={chatCollapsed ? 'Expand chat' : 'Collapse chat'}
          onClick={() => toggleCollapsed(panel, 'leftChat')}
        >
          <span className="material-symbols-outlined">
            {chatCollapsed ? 'robot_2' : 'first_page'}
          </span>
        </button>
      </div>

      <button
        type="button"
        className="rv-view-layout-control rv-view-layout-control--trailing"
        aria-label="Hide content"
        title="Hide content"
        onClick={handleHideContent}
      >
        <span className="material-symbols-outlined">dock_to_left</span>
      </button>
    </div>
  );
}
