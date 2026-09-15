/**
 * @module ViewChatHost
 * @role Connected view-bound ThreadedChat host (SPEC-02 §5.2/§5.3, Slice 02B).
 *
 * Wraps one explicit `{workspaceId, viewId}` population in `ThreadedChat`.
 * This is the explicit view-host lane; it is mounted into production view
 * chrome by `ViewWorksurfaceDock` (SPEC-03/SPEC-04) while preserving the
 * accepted SPEC-02 population/selection contract.
 */

import { useState } from 'react';
import { CliPickerDropdown } from '../CliPickerDropdown';
import { ThreadedChat } from './ThreadedChat';
import { useViewChatHost } from './useViewChatHost';
import type { ThreadRailView } from './ThreadRail';

export interface ViewChatHostProps {
  panel: string;
  workspaceId: string;
  viewId: string;
  isActive?: boolean;
}

export function ViewChatHost({
  panel,
  workspaceId,
  viewId,
  isActive = true,
}: ViewChatHostProps) {
  const host = useViewChatHost({ panel, workspaceId, viewId, isActive });
  const [threadView, setThreadView] = useState<ThreadRailView>('active');
  const { identity, chat, actions, refs, onToggleThreads, onToggleContent } = host.chatHost;

  return (
    <ThreadedChat
      rail={{
        ...host.rail,
        threadView,
        onThreadViewChange: setThreadView,
        cliPicker: host.showCliPicker ? (
          <CliPickerDropdown
            panel={panel}
            statuses={host.harnessStatuses}
            onSelect={host.handleHarnessSelect}
          />
        ) : null,
      }}
      chat={{
        ...identity,
        chat,
        actions,
        refs,
        panel,
        onToggleThreads,
        onToggleContent,
      }}
    />
  );
}
