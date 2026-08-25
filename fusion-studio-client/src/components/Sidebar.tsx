import { useState } from 'react';
import '../styles/dropdown.css';
import './Sidebar.css';
import { CliPickerDropdown } from './CliPickerDropdown';
import { SidebarThreadList } from './sidebar/SidebarThreadList';
import { useSidebar } from './sidebar/useSidebar';
import { usePanelStore } from '../state/panelStore';

interface SidebarProps {
  panel: string;
  collapsed?: boolean;
}

type ThreadView = 'active' | 'archive';

interface ThreadRailContentsProps {
  panel: string;
  sidebar: ReturnType<typeof useSidebar>;
  threadView: ThreadView;
  preview?: boolean;
  onThreadViewChange: (view: ThreadView) => void;
  onTogglePinned: () => void;
}

function ThreadRailContents({
  panel,
  sidebar,
  threadView,
  preview = false,
  onThreadViewChange,
  onTogglePinned,
}: ThreadRailContentsProps) {
  return (
    <>
      <div className={`rv-thread-sidebar-header${preview ? ' rv-thread-sidebar-header--preview' : ''}`}>
        <button
          type="button"
          className="rv-chat-header-btn rv-sidebar-peek-dock"
          onClick={onTogglePinned}
          aria-label={preview ? 'Pin threads open' : 'Hide threads'}
          title={preview ? 'Pin threads open' : 'Hide threads'}
        >
          <span className="material-symbols-outlined">dock_to_right</span>
        </button>
        <select
          className="rv-thread-view-select"
          aria-label="Thread view"
          value={threadView}
          onChange={(event) => onThreadViewChange(event.target.value as ThreadView)}
        >
          <option value="active">Active Threads</option>
          <option value="archive">Archive</option>
        </select>
      </div>

      <button
        className="rv-new-chat-btn"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={sidebar.handleCreateThread}
      >
        <span className="material-symbols-outlined">edit_square</span>
        <span>New chat</span>
      </button>
      {sidebar.showCliPicker && (
        <CliPickerDropdown
          panel={panel}
          statuses={sidebar.harnessStatuses}
          onSelect={sidebar.handleHarnessSelect}
        />
      )}

      <div className="rv-thread-list-divider" role="separator" />

      <div className="rv-thread-list">
        {threadView === 'active' ? (
          <SidebarThreadList {...sidebar} />
        ) : (
          <div className="rv-chat-item rv-thread-list-empty">
            <span className="rv-chat-item-text">No archived threads</span>
          </div>
        )}
      </div>
    </>
  );
}

export function Sidebar({ panel, collapsed }: SidebarProps) {
  const sidebar = useSidebar({ panel });
  const toggleCollapsed = usePanelStore((state) => state.toggleCollapsed);
  const [threadView, setThreadView] = useState<'active' | 'archive'>('active');

  if (collapsed) {
    return (
      <aside className="rv-sidebar rv-sidebar--collapsed">
        <div className="rv-sidebar-peek-panel" aria-label="Threads">
          <ThreadRailContents
            panel={panel}
            sidebar={sidebar}
            threadView={threadView}
            preview
            onThreadViewChange={setThreadView}
            onTogglePinned={() => toggleCollapsed(panel, 'leftSidebar')}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside className={`rv-sidebar rv-sidebar--project${sidebar.isActive ? ' rv-sidebar--active' : ''}`}>
      <ThreadRailContents
        panel={panel}
        sidebar={sidebar}
        threadView={threadView}
        onThreadViewChange={setThreadView}
        onTogglePinned={() => toggleCollapsed(panel, 'leftSidebar')}
      />
    </aside>
  );
}
