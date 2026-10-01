import { useState } from 'react';
import '../styles/dropdown.css';
import './Sidebar.css';
import { CliPickerDropdown } from './CliPickerDropdown';
import { ThreadRail } from './chat/ThreadRail';
import { usePanelStore } from '../state/panelStore';
import type { ViewChatRailProjection } from './chat/useViewChatHost';
import type { HarnessStatus } from '../types';

interface SidebarProps {
  panel: string;
  collapsed?: boolean;
  /** Connected rail projection for this panel's view-bound population. */
  rail: ViewChatRailProjection;
  showCliPicker: boolean;
  harnessStatuses: Record<string, HarnessStatus>;
  onHarnessSelect: (harnessId: string, modelId?: string) => void;
}

/**
 * Production rail column. It renders the connected view-bound rail projection
 * (owner direction 2026-09-19) into the portable `ThreadRail` and adds only
 * shell chrome: the rail-collapse toggle and the CLI picker element.
 */
export function Sidebar({
  panel,
  collapsed,
  rail,
  showCliPicker,
  harnessStatuses,
  onHarnessSelect,
}: SidebarProps) {
  const toggleCollapsed = usePanelStore((state) => state.toggleCollapsed);
  const [threadView, setThreadView] = useState<'active' | 'archive'>('active');

  return (
    <ThreadRail
      {...rail}
      collapsed={collapsed}
      threadView={threadView}
      onThreadViewChange={setThreadView}
      onTogglePinned={() => toggleCollapsed(panel, 'leftSidebar')}
      cliPicker={showCliPicker ? (
        <CliPickerDropdown
          panel={panel}
          statuses={harnessStatuses}
          onSelect={onHarnessSelect}
        />
      ) : null}
    />
  );
}
