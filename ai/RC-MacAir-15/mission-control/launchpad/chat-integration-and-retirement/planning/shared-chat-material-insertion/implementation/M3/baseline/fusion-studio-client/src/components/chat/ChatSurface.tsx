/**
 * @module ChatSurface
 * @role Portable composable chat presentation boundary (SPEC-02 §5.1).
 *
 * `ChatSurface` renders one explicit session model and emits explicit actions.
 * Its own module imports no app store, WebSocket client, thread controller,
 * service, filesystem API, or tab owner. Existing connected descendants
 * (MessageList, TodoDrawer, composer menus/attachments) may remain internally
 * connected per CHAT-RD-014, but every behavior receives or resolves the
 * explicit `threadId`/`surfaceId`; none falls back to a global current
 * thread/panel.
 *
 * Transient DOM/focus/menu identity is keyed by the mount's `surfaceId`
 * (§6.3); two mounts of one session share session truth but never DOM ids,
 * focus restoration, or open-menu state.
 */

import { memo } from 'react';
import { ConnectedChatComposer } from './ConnectedChatComposer';
import { ConnectedChatHeader } from './ConnectedChatHeader';
import { ConnectedChatHistory } from './ConnectedChatHistory';
import { chatSurfaceDomId, type ChatSurfaceProps, type ChatSurfaceRefs } from './chatSurfaceContract';

export interface ChatSurfaceComponentProps extends ChatSurfaceProps {
  refs: ChatSurfaceRefs;
  panel: string;
  /** Outer shell content-collapse toggle; shell state is never chat identity. */
  onToggleContent?: () => void;
  /** Component descriptors own an exact session independently of rail selection. */
  screenshotSelection?: 'view' | 'session';
}

export const ChatSurface = memo(function ChatSurface({
  workspaceId,
  viewId,
  threadGroupId,
  threadId,
  surfaceId,
  host,
  componentInstanceId,
  shell,
  header,
  composer,
  actions,
  refs,
  panel,
  onToggleThreads,
  onToggleContent,
  screenshotSelection = 'view',
}: ChatSurfaceComponentProps) {
  const domId = chatSurfaceDomId(surfaceId);
  const sectionClass = `rv-chat-area rv-chat-area--project${shell.isActive ? ' rv-chat-area--active' : ' rv-chat-area--inactive'}${!shell.hasThread ? ' rv-chat-area--no-thread' : ''}`;

  return (
    <section
      className={sectionClass}
      id={`chat-surface-${domId}`}
      data-surface-id={surfaceId}
      data-chat-host={host}
      data-chat-thread-id={threadId}
      data-chat-workspace-id={workspaceId}
      data-chat-view-id={viewId ?? ''}
      onPointerDownCapture={actions.onActivate}
      onFocusCapture={actions.onActivate}
    >
      <ConnectedChatHeader
        workspaceId={workspaceId}
        threadId={threadId}
        surfaceId={surfaceId}
        panel={panel}
        shell={shell}
        header={header}
        actions={actions}
        headerRef={refs.headerRef}
        onToggleThreads={onToggleThreads}
        onToggleContent={onToggleContent}
      />
      <ConnectedChatHistory
        workspaceId={workspaceId}
        threadId={threadId}
        hasThread={shell.hasThread}
        connectingHarnessName={shell.connectingHarnessName}
        isSendingForCurrentThread={shell.isSendingForCurrentThread}
        actions={actions}
        refs={refs}
        scrollId={`chat-scroll-${domId}`}
      />
      <ConnectedChatComposer
        workspaceId={workspaceId}
        viewId={viewId}
        threadGroupId={threadGroupId}
        host={host}
        screenshotSelection={screenshotSelection}
        componentInstanceId={componentInstanceId}
        threadId={threadId}
        surfaceId={surfaceId}
        panel={panel}
        hasThread={shell.hasThread}
        isActive={shell.isActive}
        isSendingForCurrentThread={shell.isSendingForCurrentThread}
        composer={composer}
        actions={actions}
        inputRef={refs.inputRef}
              materialRef={refs.materialRef}
      />
    </section>
  );
});
