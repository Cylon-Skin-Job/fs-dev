/** Transient mounted-chat projection composed through the existing Chat slice. */
import type { AppState } from '../panelStoreTypes';
import { getCurrentThreadGroupId, getThreadGroupPopulation } from './chatSurfaceSlice';
import { getWorksurfaceEntry } from './worksurfaceSlice';
import { readOpenSideChatPlacements } from '../../lib/chat/side-chat-placements';

export interface MountedChatIdentity {
  readonly workspaceId: string;
  readonly viewId: string;
  readonly threadGroupId: string;
  readonly threadId: string;
  readonly surfaceId: string;
  readonly host: 'main' | 'side-tab';
  readonly binding: 'view' | 'session';
  readonly componentInstanceId?: string;
}
export interface MountedChatBinding extends MountedChatIdentity {
  readonly generation: number;
  readonly placementId: string | null;
  /** False forever after this particular committed lifetime ends. */
  current: boolean;
}
export type ChatActivationIntent = Pick<MountedChatIdentity,
  'workspaceId' | 'viewId' | 'threadGroupId' | 'threadId' | 'host' | 'binding' | 'componentInstanceId'>;
export interface MountedChatState {
  mountedChats: Record<string, MountedChatBinding>;
  activeMountedChat: MountedChatBinding | null;
  pendingChatActivation: ChatActivationIntent | null;
  pendingNewChatActivation: { workspaceId: string; viewId: string } | null;
  chatMountRetirements: Record<string, number>;
  retireMountedChatAuthority: () => void;
  registerMountedChat: (identity: MountedChatIdentity) => MountedChatBinding | null;
  unregisterMountedChat: (binding: MountedChatBinding) => void;
  activateMountedChat: (surfaceId: string) => void;
  requestChatActivation: (intent: ChatActivationIntent) => void;
  requestNewChatActivation: (workspaceId: string, viewId: string) => void;
  resolveNewChatActivation: (intent: ChatActivationIntent) => void;
}

type Set = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;
let generation = 0;

function placementFor(state: AppState, identity: MountedChatIdentity) {
  const entry = getWorksurfaceEntry(state, identity.workspaceId, identity.viewId, identity.threadGroupId);
  return readOpenSideChatPlacements(entry, identity.viewId).filter((placement) => {
    const input = placement.descriptor.input as Record<string, unknown>;
    return input.workspaceId === identity.workspaceId
      && input.threadGroupId === identity.threadGroupId
      && placement.threadId === identity.threadId
      && placement.descriptor.componentInstanceId === identity.componentInstanceId;
  });
}

/** Authority is hydrated tuple/placement state, never focus or a global thread id. */
export function mountedChatIsHydrated(state: AppState, identity: MountedChatIdentity): boolean {
  if (!identity.workspaceId || !identity.viewId || !identity.threadGroupId || !identity.threadId
    || state.activeWorkspaceId !== identity.workspaceId || !state.projectChats[identity.threadId]) return false;
  if (identity.host === 'side-tab') return placementFor(state, identity).length === 1;
  const row = getThreadGroupPopulation(state, identity.workspaceId, identity.viewId)
    .find((item) => item.threadGroupId === identity.threadGroupId);
  return row?.threadId === identity.threadId
    && (identity.binding === 'session'
      || getCurrentThreadGroupId(state, identity.workspaceId, identity.viewId) === identity.threadGroupId);
}

export function mountedChatIsCurrent(state: AppState, binding: MountedChatBinding): boolean {
  return binding.current && state.mountedChats[binding.surfaceId] === binding
    && mountedChatIsHydrated(state, binding)
    && (binding.host !== 'side-tab' || placementFor(state, binding)[0]?.placementId === binding.placementId);
}

function matches(binding: MountedChatBinding, intent: ChatActivationIntent): boolean {
  return binding.workspaceId === intent.workspaceId && binding.viewId === intent.viewId
    && binding.threadGroupId === intent.threadGroupId && binding.threadId === intent.threadId
    && binding.host === intent.host && binding.binding === intent.binding
    && binding.componentInstanceId === intent.componentInstanceId;
}
function activatedCandidate(state: AppState, intent: ChatActivationIntent) {
  const candidates = Object.values(state.mountedChats).filter((binding) => matches(binding, intent)
    && mountedChatIsCurrent(state, binding));
  return candidates.length === 1 ? candidates[0] : null;
}

export function createMountedChatState(set: Set, get: () => AppState): MountedChatState {
  return {
    mountedChats: {}, activeMountedChat: null, pendingChatActivation: null, pendingNewChatActivation: null, chatMountRetirements: {},
    retireMountedChatAuthority: () => {
      const state = get(), chatMountRetirements = { ...state.chatMountRetirements };
      for (const binding of Object.values(state.mountedChats)) {
        binding.current = false;
        chatMountRetirements[binding.surfaceId] = (chatMountRetirements[binding.surfaceId] ?? 0) + 1;
      }
      set({ mountedChats: {}, activeMountedChat: null, pendingChatActivation: null,
        pendingNewChatActivation: null, chatMountRetirements });
    },
    registerMountedChat: (identity) => {
      const state = get();
      if (!mountedChatIsHydrated(state, identity)) return null;
      const prior = state.mountedChats[identity.surfaceId];
      if (prior) prior.current = false;
      const binding: MountedChatBinding = { ...identity, generation: ++generation,
        placementId: identity.host === 'side-tab' ? placementFor(state, identity)[0].placementId : null,
        current: true };
      set({ mountedChats: { ...state.mountedChats, [identity.surfaceId]: binding } });
      // React commits all sibling registrations before this settles an explicit
      // activation intent; duplicate mounts cannot win by registration order.
      const intent = get().pendingChatActivation;
      if (intent) queueMicrotask(() => {
        const current = get();
        if (current.pendingChatActivation !== intent || current.currentPanel !== intent.viewId
          || current.activeWorkspaceId !== intent.workspaceId) return;
        const candidate = activatedCandidate(current, intent);
        if (candidate) set({ activeMountedChat: candidate, pendingChatActivation: null });
      });
      return binding;
    },
    unregisterMountedChat: (binding) => {
      binding.current = false;
      const state = get();
      if (state.mountedChats[binding.surfaceId] !== binding) return;
      const mountedChats = { ...state.mountedChats };
      delete mountedChats[binding.surfaceId];
      set({ mountedChats, ...(state.activeMountedChat === binding ? { activeMountedChat: null } : {}) });
    },
    activateMountedChat: (surfaceId) => {
      const state = get(), binding = state.mountedChats[surfaceId];
      if (!binding || state.currentPanel !== binding.viewId || !mountedChatIsCurrent(state, binding)) return;
      set({ activeMountedChat: binding, pendingChatActivation: null, pendingNewChatActivation: null });
    },
    requestNewChatActivation: (workspaceId, viewId) => {
      const state = get();
      if (state.activeWorkspaceId === workspaceId && state.currentPanel === viewId) {
        set({ activeMountedChat: null, pendingChatActivation: null, pendingNewChatActivation: { workspaceId, viewId } });
      }
    },
    resolveNewChatActivation: (intent) => {
      const pending = get().pendingNewChatActivation;
      if (pending?.workspaceId === intent.workspaceId && pending.viewId === intent.viewId) get().requestChatActivation(intent);
    },
    requestChatActivation: (intent) => {
      const state = get();
      if (state.activeWorkspaceId !== intent.workspaceId || state.currentPanel !== intent.viewId) return;
      const candidate = activatedCandidate(state, intent);
      set({ activeMountedChat: candidate, pendingChatActivation: candidate ? null : { ...intent }, pendingNewChatActivation: null });
    },
  };
}

/** Synchronous retirement observes even loss/return within one React batch. */
export function retireInvalidMountedChats(state: AppState, previous: AppState): Partial<AppState> | null {
  const transportReplaced = state.ws !== previous.ws;
  const invalid = Object.values(state.mountedChats).filter((binding) => transportReplaced
    || !mountedChatIsCurrent(state, binding));
  const intentLost = (state.pendingChatActivation || state.pendingNewChatActivation) && (state.activeWorkspaceId !== previous.activeWorkspaceId
    || state.currentPanel !== previous.currentPanel || transportReplaced);
  if (!invalid.length) return intentLost ? { pendingChatActivation: null, pendingNewChatActivation: null } : null;
  const mountedChats = { ...state.mountedChats }, chatMountRetirements = { ...state.chatMountRetirements };
  for (const binding of invalid) {
    binding.current = false;
    delete mountedChats[binding.surfaceId];
    chatMountRetirements[binding.surfaceId] = (chatMountRetirements[binding.surfaceId] ?? 0) + 1;
  }
  return { mountedChats, chatMountRetirements, ...(intentLost ? { pendingChatActivation: null, pendingNewChatActivation: null } : {}),
    ...(state.activeMountedChat && invalid.includes(state.activeMountedChat) ? { activeMountedChat: null } : {}) };
}
