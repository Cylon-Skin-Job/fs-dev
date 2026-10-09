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
import { getWorksurfaceEntry } from '../../state/slices/worksurfaceSlice';
import type { AppState } from '../../state/panelStoreTypes';
import type { ComponentDescriptor } from '../view-tabs/componentTabTypes';
import { readOpenSideChatPlacements } from './sideChatBridge';
import { ChatSurface } from './ChatSurface';
import { useChatSessionHost } from './useChatSessionHost';
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
  const row = rows.find((candidate) => candidate.threadGroupId === input.threadGroupId);
  if (row && row.threadId === input.threadId) return true;
  // SPEC-04 §6/§7: a Side Chat addresses a non-primary member of the group.
  // Its authority is the server-persisted service-managed placement lane for
  // this exact view, never primary history and never a client guess. This is
  // also the adapterless-host path (SPEC-04 §11 04B): a view with no view-bound
  // chat population still mounts the placed member because the durable
  // placement lane is the authority.
  if (input.host !== 'side-tab' || !input.viewId) return false;
  const entry = getWorksurfaceEntry(
    state,
    input.workspaceId,
    input.viewId,
    input.threadGroupId,
  );
  return readOpenSideChatPlacements(entry, input.viewId).some(
    (placement) => placement.threadId === input.threadId,
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

  const host = useChatSessionHost({
    panel,
    threadId: input.threadId,
    threadGroupId: input.threadGroupId,
    viewId: input.viewId,
    workspaceId: input.workspaceId,
    host: input.host,
    surfaceId,
  });

  return (
    <ChatSurface
      {...host.identity}
      shell={host.shell}
      header={host.header}
      composer={host.composer}
      actions={host.actions}
      refs={host.refs}
      panel={panel}
      onToggleThreads={host.onToggleThreads}
      onToggleContent={host.onToggleContent}
    />
  );
}
