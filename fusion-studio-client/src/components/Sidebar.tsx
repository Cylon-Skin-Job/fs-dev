import '../styles/dropdown.css';
import './Sidebar.css';
import { CliPickerDropdown } from './CliPickerDropdown';
import { SidebarThreadList } from './sidebar/SidebarThreadList';
import { useSidebar } from './sidebar/useSidebar';
import type { Scope } from '../types';

interface SidebarProps {
  panel: string;
  scope: Scope;
  collapsed?: boolean;
}

export function Sidebar({ panel, scope, collapsed }: SidebarProps) {
  const sidebar = useSidebar({ panel, scope });

  if (collapsed) {
    return <aside className="rv-sidebar rv-sidebar--collapsed" aria-hidden="true" />;
  }

  return (
    <aside className={`rv-sidebar rv-sidebar--${scope}${sidebar.isActive ? ' rv-sidebar--active' : ''}`}>
      {scope !== 'project' && (
        <div className="rv-sidebar-header">
          {sidebar.headerLabel}
        </div>
      )}

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
