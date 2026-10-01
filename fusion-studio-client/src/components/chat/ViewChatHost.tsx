/**
 * @module ViewChatHost
 * @role Connected view-bound ThreadedChat host (SPEC-02 §5.2/§5.3, Slice 02B).
 *
 * Wraps one explicit `{workspaceId, viewId}` population in `ThreadedChat`.
 * This explicit full-host lane is retained for isolated composition tests and
 * non-shell embedding. Production shell regions compose the same projection
 * as sibling rail/chat/content boundaries in `WorkspacePanel`.
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
  const { identity, shell, header, composer, actions, refs, onToggleThreads, onToggleContent } = host.chatHost;

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
        shell,
        header,
        composer,
        actions,
        refs,
        panel,
        onToggleThreads,
        onToggleContent,
      }}
    />
  );
}
