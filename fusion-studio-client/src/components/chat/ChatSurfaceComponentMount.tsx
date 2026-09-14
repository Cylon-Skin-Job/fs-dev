/**
 * @module ChatSurfaceComponentMount
 * @role Connected mount for one `fusion.chat-surface` component descriptor
 *       (SPEC-02 §8, Slice 02C).
 *
 * Two-stage discipline:
 *  1. Strict descriptor-input parse + hydrated workspace/view/group/member
 *     tuple validation. Invalid input or an unhydrated/invalid tuple renders
 *     the inert unavailable body with no callbacks and no store mutation.
 *  2. Only an established tuple mounts the real connected host + `ChatSurface`
 *     with the explicit identity and the transient `surfaceId` minted from the
 *     descriptor's `componentInstanceId` + runtime mount generation.
 */

import { useRef } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { getThreadGroupPopulation } from '../../state/slices/chatSurfaceSlice';
import type { AppState } from '../../state/panelStoreTypes';
import type { ComponentDescriptor } from '../view-tabs/componentTabTypes';
import { ChatSurface } from './ChatSurface';
import { useLegacyChatHost } from './useLegacyChatHost';
import { nextChatSurfaceMountGeneration } from './chatSurfaceContract';
import {
  mintChatComponentSurfaceId,
  parseChatSurfaceDescriptorInput,
  type ChatSurfaceDescriptorInput,
} from './chatSurfaceRegistrationContract';

export const CHAT_SURFACE_UNAVAILABLE_ATTR = 'data-chat-surface-unavailable';

/** Bounded inert projection: no callbacks, no store mutation, no authority claim. */
export function ChatSurfaceUnavailableBody() {
  return (
    <section
      className="rv-chat-surface-unavailable"
      role="status"
      {...{ [CHAT_SURFACE_UNAVAILABLE_ATTR]: 'true' }}
    >
      <span
        className="material-symbols-outlined rv-chat-surface-unavailable-icon"
        aria-hidden="true"
      >
        chat_error
      </span>
      <p className="rv-chat-surface-unavailable-message">
        This chat surface could not be opened. The tab stays usable.
      </p>
    </section>
  );
}

/**
 * Hydrated-authority tuple check: the descriptor's workspace must be the
 * hydrated active workspace and its exact `{threadGroupId, threadId}` member
 * must exist in the addressed `{workspaceId, viewId}` population. A stale,
 * foreign, or not-yet-hydrated tuple is invalid.
 */
function isTupleHydrated(state: AppState, input: ChatSurfaceDescriptorInput): boolean {
  if (!state.activeWorkspaceId || state.activeWorkspaceId !== input.workspaceId) return false;
  const rows = getThreadGroupPopulation(state, input.workspaceId, input.viewId);
  return rows.some(
    (row) => row.threadGroupId === input.threadGroupId && row.threadId === input.threadId,
  );
}

export function ChatSurfaceComponentMount({ descriptor }: { descriptor: ComponentDescriptor }) {
  const input = parseChatSurfaceDescriptorInput(descriptor.input);
  const tupleHydrated = usePanelStore((state) => (input ? isTupleHydrated(state, input) : false));
  if (!input || !tupleHydrated) return <ChatSurfaceUnavailableBody />;
  return <ChatSurfaceReadyMount descriptor={descriptor} input={input} />;
}

function ChatSurfaceReadyMount({
  descriptor,
  input,
}: {
  descriptor: ComponentDescriptor;
  input: ChatSurfaceDescriptorInput;
}) {
  // The mount wrapper owns the transient derivation; a remount (new
  // `componentInstanceId`) gets a fresh generation and a distinct surfaceId.
  const surfaceIdRef = useRef<string | null>(null);
  if (surfaceIdRef.current === null) {
    surfaceIdRef.current = mintChatComponentSurfaceId(
      descriptor.componentInstanceId,
      nextChatSurfaceMountGeneration(),
    );
  }
  const surfaceId = surfaceIdRef.current;
  const panel = `chat-surface-component-${descriptor.componentInstanceId}`;

  const host = useLegacyChatHost({
    panel,
    threadId: input.threadId,
    threadGroupId: input.threadGroupId,
    viewId: input.viewId,
    workspaceId: input.workspaceId,
    host: input.host,
    explicitTarget: true,
    surfaceId,
  });

  return (
    <ChatSurface
      {...host.identity}
      chat={host.chat}
      actions={host.actions}
      refs={host.refs}
      panel={panel}
      onToggleThreads={host.onToggleThreads}
      onToggleContent={host.onToggleContent}
    />
  );
}
