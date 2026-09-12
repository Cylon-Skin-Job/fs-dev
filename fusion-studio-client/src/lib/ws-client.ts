/**
 * @module ws-client
 * @role Standalone WebSocket client — no React dependency
 *
 * Manages connection, reconnection, discovery, and message routing.
 * Writes directly to the Zustand store. React components read from the store only.
 */

import { usePanelStore } from '../state/panelStore';
import { useFileDataStore } from '../state/fileDataStore';
import { useSecretsStore } from '../state/secretsStore';
import { handleStreamMessage, resetStreamState } from './ws/stream-handlers';
import { handleThreadMessage } from './ws/thread-handlers';
import { handleFileMessage } from './ws/file-handlers';
import {
  handleResourceProvenanceResponse,
  retirePendingResourceProvenanceQueries,
} from './ws/resource-provenance-protocol';
import { retirePendingChatDiagnosticRequests } from './ws/chat-diagnostic-handlers';
import {
  handleWorkspaceMessage,
  retirePendingWorkspaceExposure,
} from './ws/workspace-handlers';
import { handleHarnessMessage } from './ws/harness-handlers';
import { handleThemeMessage } from './ws/theme-handlers';
import { handleScreenshotMessage } from './ws/screenshot-handlers';
import { handleBookmarksMessage } from './ws/bookmarks-handlers';
import { handleCalendarMessage } from './ws/calendar-handlers';
import {
  handleOfficePaletteMessage,
  handleOfficePaletteSocketClose,
  handleOfficePaletteSocketOpen,
  handleOfficePaletteWorkspaceChanged,
} from './ws/office-palette-handlers';
import { useWorkspaceStore } from '../state/workspaceStore';
import { setLoggerWs, captureConsoleLogs } from '../lib/logger';
import { showModal } from '../lib/modal';
import {
  sanitizeTerminalErrorsAtIngress,
} from './chat/terminal-error';
import {
  abandonViewStateMutations,
  getLatestViewStateMutationId,
  getViewStateMutationOrigin,
  hasPendingViewStateMutation,
  settleViewStateMutation,
} from './viewStateMutationTracker';
import {
  abandonWorkspaceRequests,
  shouldApplyWorkspaceResponse,
} from './workspaceResponseTracker';
import type { ModalConfig } from '../lib/modal';
import type { ApiKeyIndexEntry, ApiKeysErrorCode } from '../state/secretsStore';
import type { ViewUIState, WebSocketMessage } from '../types';
import {
  createServerWebSocket,
  getRuntimeTransportSnapshot,
  startRuntimeTransport,
  subscribeRuntimeTransport,
} from './runtime-transport';
import { createShellSocketAuthenticator } from './shell-auth-client';
import { runWithRendererMessageDiagnosticBoundary } from './ws/renderer-diagnostic-boundary';
import {
  retireViewCapsuleProjectionInstallations,
} from './view-capsule-projection';

// --- Module state ---

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let officePaletteWorkspaceSubscriptionStarted = false;
let runtimeUnsubscribe: (() => void) | null = null;
let connectionRequested = false;
let connectedGeneration: string | null = null;
let connectionAuthenticator: {
  ws: WebSocket;
  generation: string | null;
  sendProduct: (serialized: string) => boolean;
  retire: () => void;
} | null = null;

export function abandonWsResponseTracking(): void {
  retireFusionResponseListeners();
  retirePendingChatDiagnosticRequests();
  abandonViewStateMutations();
  abandonWorkspaceRequests();
}

function ensureOfficePaletteWorkspaceSubscription(): void {
  if (officePaletteWorkspaceSubscriptionStarted) return;
  officePaletteWorkspaceSubscriptionStarted = true;
  useWorkspaceStore.subscribe((current, previous) => {
    if (current.activeWorkspaceId !== previous.activeWorkspaceId) {
      handleOfficePaletteWorkspaceChanged(current.activeWorkspaceId);
    }
  });
}

// --- Fusion message listeners ---
// Components subscribe to specific message types for fusion: responses.

type FusionListener = (msg: unknown) => void;
type FusionMessagePayload = WebSocketMessage & Record<string, unknown>;
interface FusionListenerEntry {
  listener: FusionListener;
  onConnectionRetired: (() => void) | null;
}
const fusionListeners: Map<string, Set<FusionListenerEntry>> = new Map();

interface StateResultMessage extends WebSocketMessage {
  type: 'state:result';
  view?: string;
  state?: ViewUIState;
  clientMutationId?: number;
  requestId?: string;
  workspaceId?: string | null;
}

interface StateErrorMessage extends WebSocketMessage {
  type: 'state:error';
  message?: string;
  view?: string;
  clientMutationId?: number;
  requestId?: string;
  workspaceId?: string | null;
}

interface ApiKeysStateMessage extends WebSocketMessage {
  type: 'secrets:api-keys:state';
  items?: ApiKeyIndexEntry[];
}

interface ApiKeysErrorMessage extends WebSocketMessage {
  type: 'secrets:api-keys:error';
  code?: ApiKeysErrorCode;
  message?: string;
}

function isWebSocketMessage(value: unknown): value is WebSocketMessage {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && typeof value.type === 'string';
}

/**
 * Reduce an inbound frame to its loggable form. Exported as the single
 * suppression-boundary seam (roadmap §5.5). Ordinary product frames expose
 * only their declared type to diagnostics. The two accepted PROV diagnostic
 * response types retain their established fixed identifier allowlists.
 */
export function redactMessageForLog(msg: WebSocketMessage): WebSocketMessage {
  // MANDATORY diagnostic log suppression (roadmap §5.5 sentence 2; parent
  // §4.13.1; binding SPEC-03 §7): report frames are reduced to {type, opaque
  // route/diagnostic identifiers} with the ENTIRE report object removed
  // BEFORE any console logging or captured-log forwarding (the logger
  // captures console output downstream). Built as a fixed allowlist literal —
  // never spread from msg — so no present-or-future report field can reach
  // console or captured logs by construction.
  if (msg.type === 'chat-turn:diagnostic:report') {
    return {
      type: 'chat-turn:diagnostic:report',
      threadId: typeof msg.threadId === 'string' ? msg.threadId : undefined,
      turnId: typeof msg.turnId === 'string' ? msg.turnId : undefined,
      diagnosticId: typeof msg.diagnosticId === 'string' ? msg.diagnosticId : undefined,
    };
  }
  // Unavailable frames may carry only the null-echo identifier values and a
  // fixed marker — strip everything else identically.
  if (msg.type === 'chat-turn:diagnostic:unavailable') {
    return {
      type: 'chat-turn:diagnostic:unavailable',
      availability: 'unavailable',
      threadId: typeof msg.threadId === 'string' ? msg.threadId : undefined,
      turnId: typeof msg.turnId === 'string' ? msg.turnId : undefined,
      diagnosticId: typeof msg.diagnosticId === 'string' ? msg.diagnosticId : undefined,
    };
  }

  return { type: msg.type };
}

export function sendFusionMessage(msg: Record<string, unknown>) {
  const owner = connectionAuthenticator;
  if (!socket || socket.readyState !== WebSocket.OPEN || !owner) return;
  if (owner.ws !== socket || owner.generation !== connectedGeneration) return;
  owner.sendProduct(JSON.stringify(msg));
}

export function onFusionMessage<T = FusionMessagePayload>(type: string, listener: (msg: T) => void): () => void {
  if (!fusionListeners.has(type)) fusionListeners.set(type, new Set());
  const entry: FusionListenerEntry = {
    listener: (msg) => listener(msg as T),
    onConnectionRetired: null,
  };
  fusionListeners.get(type)!.add(entry);
  return () => { fusionListeners.get(type)?.delete(entry); };
}

/** A response listener whose request belongs to exactly the current socket. */
export function onFusionResponse<T = FusionMessagePayload>(
  type: string,
  listener: (msg: T) => void,
  onConnectionRetired: () => void,
): () => void {
  if (!fusionListeners.has(type)) fusionListeners.set(type, new Set());
  const entry: FusionListenerEntry = {
    listener: (msg) => listener(msg as T),
    onConnectionRetired,
  };
  fusionListeners.get(type)!.add(entry);
  return () => { fusionListeners.get(type)?.delete(entry); };
}

function emitFusion(type: string, msg: WebSocketMessage) {
  const listeners = fusionListeners.get(type);
  if (listeners) {
    for (const entry of listeners) entry.listener(msg);
  }
}

function retireFusionResponseListeners(): void {
  const retirements = new Set<() => void>();
  for (const entries of fusionListeners.values()) {
    for (const entry of entries) {
      if (!entry.onConnectionRetired) continue;
      entries.delete(entry);
      retirements.add(entry.onConnectionRetired);
    }
  }
  for (const retire of retirements) retire();
}

// --- Public API ---

function retireConnectionState(): void {
  retireViewCapsuleProjectionInstallations();
  retirePendingWorkspaceExposure();
  abandonWsResponseTracking();
  useWorkspaceStore.getState().beginInit();
  useFileDataStore.getState().retireConnectionGeneration();
  retirePendingResourceProvenanceQueries();
  usePanelStore.getState().setWs(null);
  setLoggerWs(null);
}

function connectCurrentRuntime() {
  ensureOfficePaletteWorkspaceSubscription();
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    return;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Every socket receives a fresh workspace:init. Until it arrives, thread
  // lists may describe the server's workspace before the client has swapped
  // its workspace-scoped state, so they must not activate a thread yet.
  useWorkspaceStore.getState().beginInit();
  abandonWsResponseTracking();
  useFileDataStore.getState().retireConnectionGeneration();
  retirePendingResourceProvenanceQueries();
  console.log('[WS] Connecting...');
  let ws: WebSocket;
  try {
    ws = createServerWebSocket();
  } catch {
    retireConnectionState();
    return;
  }
  socket = ws;
  const generation = getRuntimeTransportSnapshot().descriptor?.generation ?? null;
  connectedGeneration = generation;
  const isCurrentConnection = () => socket === ws
    && connectedGeneration === generation
    && getRuntimeTransportSnapshot().descriptor?.generation === generation;

  let connectionActivated = false;
  const activateConnection = () => {
    if (connectionActivated || !isCurrentConnection()) return;
    connectionActivated = true;
    if (!isCurrentConnection()) return;
    console.log('[WS] Authenticated');
    resetStreamState();
    const store = usePanelStore.getState();
    store.setWs(ws);
    setLoggerWs(ws);
    captureConsoleLogs();
    // The socket is transport-ready, but workspace-bound bootstrap traffic
    // must wait for workspace:init to establish the recipient-specific pair.
    handleOfficePaletteSocketOpen(ws, { requestImmediately: false });
  };

  const deliverApplicationMessage = (value: unknown) => {
    if (!isCurrentConnection() || !isWebSocketMessage(value)) return;
    const msg = sanitizeTerminalErrorsAtIngress(value);
    console.log('[WS] Message received:', msg.type, redactMessageForLog(msg));
    handleMessage(msg, isCurrentConnection, generation);
  };
  const authenticator = createShellSocketAuthenticator({
    generation: generation || '',
    electronApi: window.electronAPI,
    send: (value) => ws.send(value),
    close: () => ws.close(),
    authenticated: activateConnection,
    deliver: deliverApplicationMessage,
  });
  connectionAuthenticator = {
    ws,
    generation,
    sendProduct: authenticator.sendProduct,
    retire: authenticator.retire,
  };

  ws.onopen = () => {
    if (!isCurrentConnection()) return;
    console.log('[WS] Connected; authenticating');
  };

  ws.onmessage = (event) => {
    if (!isCurrentConnection()) return;
    try {
      const parsed: unknown = JSON.parse(event.data);
      void authenticator.receive(parsed);
    } catch {
      console.error('[WS] Invalid server frame');
      authenticator.retire();
      ws.close();
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected');
    authenticator.retire();
    if (socket !== ws) return;
    if (connectionAuthenticator?.ws === ws) connectionAuthenticator = null;
    handleOfficePaletteSocketClose(ws);
    socket = null;
    connectedGeneration = null;
    retireConnectionState();
    if (connectionRequested && getRuntimeTransportSnapshot().status === 'ready') {
      reconnectTimer = setTimeout(connectCurrentRuntime, 3000);
    }
  };

  ws.onerror = (err) => {
    if (!isCurrentConnection()) return;
    console.error('[WS] Error:', err);
  };
}

function handleRuntimeTransportChange(): void {
  if (!connectionRequested) return;
  const runtime = getRuntimeTransportSnapshot();
  const nextGeneration = runtime.descriptor?.generation ?? null;
  if (runtime.status === 'ready' && socket && connectedGeneration === nextGeneration) return;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const previous = socket;
  const previousAuthenticator = connectionAuthenticator;
  socket = null;
  connectedGeneration = null;
  connectionAuthenticator = null;
  previousAuthenticator?.retire();
  if (previous) {
    handleOfficePaletteSocketClose(previous);
    previous.close();
  }
  resetStreamState();
  retireConnectionState();
  if (runtime.status === 'ready') connectCurrentRuntime();
}

export function connectWs() {
  connectionRequested = true;
  if (!runtimeUnsubscribe) runtimeUnsubscribe = subscribeRuntimeTransport(handleRuntimeTransportChange);
  void startRuntimeTransport().then(handleRuntimeTransportChange);
}

export function disconnectWs() {
  connectionRequested = false;
  runtimeUnsubscribe?.();
  runtimeUnsubscribe = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    abandonWsResponseTracking();
    const previous = socket;
    const previousAuthenticator = connectionAuthenticator;
    socket = null;
    connectedGeneration = null;
    connectionAuthenticator = null;
    previousAuthenticator?.retire();
    previous.close();
  }
  connectionAuthenticator = null;
  retireConnectionState();
}

// --- Message handling ---
// Every store read uses getState() — always fresh, no stale closures.

function handleMessageWithinDiagnosticBoundary(
  msg: WebSocketMessage,
  isStillCurrent: () => boolean,
  runtimeGeneration: string | null,
) {
  if (
    msg.type === 'chat-turn:metadata:updated' ||
    msg.type === 'chat-turn:metadata:error' ||
    msg.type === 'document_create_response'
  ) {
    emitFusion(msg.type, msg);
  }

  if (handleStreamMessage(msg)) return;
  if (handleThreadMessage(msg)) return;
  if (handleFileMessage(msg)) return;
  if (handleResourceProvenanceResponse(msg)) return;
  if (handleWorkspaceMessage(msg, { runtimeGeneration, isStillCurrent })) return;
  if (handleHarnessMessage(msg)) return;
  if (handleThemeMessage(msg)) return;
  if (handleScreenshotMessage(msg)) return;
  if (handleBookmarksMessage(msg)) return;
  if (handleCalendarMessage(msg)) return;
  if (handleOfficePaletteMessage(msg)) return;

  // SPEC-26c-2 / STATE_OVERRIDE_SPEC: view UI state responses.
  if (msg.type === 'state:result') {
    const store = usePanelStore.getState();
    const stateMsg = msg as StateResultMessage;
    const view = stateMsg.view;
    const incoming = stateMsg.state;
    if (!view || !incoming) return;
    const clientMutationId = typeof stateMsg.clientMutationId === 'number'
      ? stateMsg.clientMutationId
      : null;
    if (
      clientMutationId === null
      && !shouldApplyWorkspaceResponse(
        'state:get',
        stateMsg.requestId,
        stateMsg.workspaceId,
        store.activeWorkspaceId,
        {
          view,
          mutationWatermark: getLatestViewStateMutationId(view, store.activeWorkspaceId),
        },
      )
    ) {
      return;
    }
    const mutationOrigin = clientMutationId === null
      ? null
      : getViewStateMutationOrigin(clientMutationId);
    if (clientMutationId !== null && !mutationOrigin) return;
    if (clientMutationId !== null && mutationOrigin
      && (mutationOrigin.workspaceId !== store.activeWorkspaceId || mutationOrigin.view !== view)) {
      settleViewStateMutation(clientMutationId);
      return;
    }
    const workspaceId = mutationOrigin?.workspaceId ?? store.activeWorkspaceId;
    const latestMutationId = getLatestViewStateMutationId(view, workspaceId);
    if (clientMutationId !== null && clientMutationId < latestMutationId) {
      settleViewStateMutation(clientMutationId);
      return;
    }

    const current = store.viewStates[view];
    const hasPendingMutation = current && hasPendingViewStateMutation(view, workspaceId);
    // state:set responses contain a full server state. When multiple patches
    // are in flight, a later echo can be based on an older disk snapshot, so
    // keep the optimistic local state until the pending mutation settles.
    const stateToApply = hasPendingMutation ? { ...incoming, ...current } : incoming;
    store.setViewState(view, stateToApply);
    // VIEW-02 §9: a persisted state document landed for this view — the
    // connected adapters' initial-policy gate may open.
    store.settleViewStateLoad(view);
    if (clientMutationId !== null) {
      settleViewStateMutation(clientMutationId);
    }
    // STATE_OVERRIDE_SPEC §9.3: hydrate persisted currentThreadId into the
    // live slot when loading the active view. Guarded equality check in
    // setCurrentThreadId prevents a persist-echo loop.
    if (
      view === store.currentPanel &&
      incoming?.currentThreadId &&
      incoming.currentThreadId !== store.currentThreadId
    ) {
      store.setCurrentThreadId(incoming.currentThreadId);
    }
    return;
  }
  if (msg.type === 'state:error') {
    const stateMsg = msg as StateErrorMessage;
    if (
      typeof stateMsg.clientMutationId !== 'number'
      && !shouldApplyWorkspaceResponse(
        'state:get',
        stateMsg.requestId,
        stateMsg.workspaceId,
        usePanelStore.getState().activeWorkspaceId,
        stateMsg.view ? {
          view: stateMsg.view,
          mutationWatermark: getLatestViewStateMutationId(
            stateMsg.view,
            usePanelStore.getState().activeWorkspaceId,
          ),
        } : undefined,
      )
    ) {
      return;
    }
    if (stateMsg.view && typeof stateMsg.clientMutationId === 'number') {
      const mutationOrigin = getViewStateMutationOrigin(stateMsg.clientMutationId);
      if (
        mutationOrigin
        && (mutationOrigin.workspaceId !== usePanelStore.getState().activeWorkspaceId
          || mutationOrigin.view !== stateMsg.view)
      ) {
        settleViewStateMutation(stateMsg.clientMutationId);
        return;
      }
      settleViewStateMutation(stateMsg.clientMutationId);
    }
    // VIEW-02 §9: the state read settled (with an error) — release the
    // connected adapters' initial-policy gate for this view.
    if (typeof stateMsg.view === 'string') {
      usePanelStore.getState().settleViewStateLoad(stateMsg.view);
    }
    console.error('[state] error:', stateMsg.message);
    return;
  }

  const store = usePanelStore.getState();

  switch (msg.type) {
    case 'connected':
      console.log('[WS] Session:', msg.sessionId);
      break;

    case 'modal:show':
      showModal(msg as unknown as ModalConfig);
      break;

    case 'panel_config': {
      break;
    }

    case 'panel_changed':
      // CLI_CONFIG_SPEC §7d: stash per-view overrides for render-time merge.
      if (msg.panel) {
        store.setCliConfigViewDelta(msg.panel, msg.cliConfigDelta ?? {});
      }
      break;

    // Fusion system panel responses
    case 'fusion:tabs':
    case 'fusion:items':
    case 'fusion:wiki':
      emitFusion(msg.type, msg);
      break;

    // Clipboard manager responses
    case 'clipboard:list':
    case 'clipboard:append':
    case 'clipboard:touch':
    case 'clipboard:use':
    case 'clipboard:delete':
    case 'clipboard:clear':
    case 'clipboard:state':
    case 'clipboard:error':
      emitFusion(msg.type, msg);
      break;

    case 'emoji_recents:list':
    case 'emoji_recents:record':
    case 'emoji_recents:error':
      emitFusion(msg.type, msg);
      break;

    case 'secrets:api-keys:state': {
      const m = msg as ApiKeysStateMessage;
      useSecretsStore.getState().setApiKeys(m.items ?? []);
      break;
    }

    case 'secrets:api-keys:error': {
      const m = msg as ApiKeysErrorMessage;
      useSecretsStore.getState().setApiKeysError({
        code: m.code ?? 'UNKNOWN',
        message: m.message ?? '',
      });
      break;
    }

    default:
      break;
  }
}

export function handleMessage(
  msg: WebSocketMessage,
  isStillCurrent: () => boolean = () => true,
  runtimeGeneration: string | null = connectedGeneration,
) {
  return runWithRendererMessageDiagnosticBoundary(
    () => handleMessageWithinDiagnosticBoundary(msg, isStillCurrent, runtimeGeneration),
  );
}
