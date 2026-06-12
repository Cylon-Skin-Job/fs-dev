import '../styles/dropdown.css';
import './Sidebar.css';
import { CliPickerDropdown } from './CliPickerDropdown';
import { SidebarThreadList } from './sidebar/SidebarThreadList';
import { useSidebar } from './sidebar/useSidebar';

interface SidebarProps {
  panel: string;
  collapsed?: boolean;
}

export function Sidebar({ panel, collapsed }: SidebarProps) {
  const sidebar = useSidebar({ panel });

  if (collapsed) {
    return <aside className="rv-sidebar rv-sidebar--collapsed" aria-hidden="true" />;
  }

  return (
    <aside className={`rv-sidebar rv-sidebar--project${sidebar.isActive ? ' rv-sidebar--active' : ''}`}>
      <button
        className="rv-new-chat-btn"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={sidebar.handleCreateThread}
      >
        New Thread
      </button>
      {sidebar.showCliPicker && (
        <CliPickerDropdown
          panel={panel}
          statuses={sidebar.harnessStatuses}
          onSelect={sidebar.handleHarnessSelect}
        />
      )}

      <div className="rv-thread-list">
        <SidebarThreadList {...sidebar} />
      </div>
    </aside>
  );
}
