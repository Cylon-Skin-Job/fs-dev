/** Application WebSocket lifecycle and compatibility transport facade. */
import { usePanelStore } from '../state/panelStore';
import { useFileDataStore } from '../state/fileDataStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import { resetStreamState } from './ws/stream-handlers';
import { retirePromptRecoveryConnection } from './chat/prompt-submission-recovery';
import { retirePendingResourceProvenanceQueries } from './ws/resource-provenance-protocol';
import { retirePendingChatDiagnosticRequests } from './ws/chat-diagnostic-handlers';
import { capturePendingWorkspaceExposure, retirePendingWorkspaceExposure } from './ws/workspace-handlers';
import { handleOfficePaletteSocketClose, handleOfficePaletteSocketOpen, handleOfficePaletteWorkspaceChanged } from './ws/office-palette-handlers';
import { setLoggerWs, captureConsoleLogs } from './logger';
import { sanitizeTerminalErrorsAtIngress } from './chat/terminal-error';
import { abandonViewStateMutations } from './viewStateMutationTracker';
import { abandonWorkspaceRequests } from './workspaceResponseTracker';
import type { WebSocketMessage } from '../types';
import { createServerWebSocket, getRuntimeTransportSnapshot, startRuntimeTransport, subscribeRuntimeTransport } from './runtime-transport';
import { createShellSocketAuthenticator } from './shell-auth-client';
import { installProductSendCapability, retireProductSendCapability, type ProductSendCapability, type ProductSendBinding } from './ws/product-send';
import { retireViewCapsuleProjectionInstallations } from './view-capsule-projection';
import { onFusionMessage, onFusionResponse, retireFusionResponseListeners } from './ws/fusion-response-listeners';
import { routeApplicationMessage } from './ws/application-message-router';

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
let productSendCapability: ProductSendCapability | null = null;

function captureProductBinding(workspaceId: string): ProductSendBinding | null {
  const state = useWorkspaceStore.getState();
  const pending = capturePendingWorkspaceExposure();
  if (pending && pending.runtimeGeneration !== connectedGeneration) return null;
  const binding = pending?.workspaceId === workspaceId ? pending : state;
  if (!workspaceId
    || (pending ? pending.workspaceId !== workspaceId : state.activeWorkspaceId !== workspaceId)
    || typeof binding.workspaceEpoch !== 'string'
    || !Number.isSafeInteger(binding.bindingRevision)) return null;
  return {
    workspaceId,
    workspaceEpoch: binding.workspaceEpoch,
    bindingRevision: binding.bindingRevision as number,
    bindingSerial: state.bindingSerial,
  };
}

function isProductBindingCurrent(binding: ProductSendBinding): boolean {
  const state = useWorkspaceStore.getState();
  if (state.bindingSerial !== binding.bindingSerial) return false;
  const pending = capturePendingWorkspaceExposure();
  if (pending && pending.runtimeGeneration !== connectedGeneration) return false;
  if (pending) return pending.workspaceId === binding.workspaceId
    && pending.workspaceEpoch === binding.workspaceEpoch
    && pending.bindingRevision === binding.bindingRevision;
  return state.activeWorkspaceId === binding.workspaceId
    && state.workspaceEpoch === binding.workspaceEpoch
    && state.bindingRevision === binding.bindingRevision;
}

function retireProductSender(): void {
  if (productSendCapability) retireProductSendCapability(productSendCapability);
  productSendCapability = null;
}

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
  if (!socket || socket.readyState !== WebSocket.OPEN || !owner) return false;
  if (owner.ws !== socket || owner.generation !== connectedGeneration) return false;
  return owner.sendProduct(JSON.stringify(msg));
}

// --- Public API ---

function retireConnectionState(): void {
  retireProductSender();
  retirePromptRecoveryConnection();
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
    bufferedAmount: () => ws.bufferedAmount,
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
  productSendCapability = {
    socket: ws,
    generation,
    isAuthenticated: authenticator.isAuthenticated,
    captureBinding: captureProductBinding,
    isBindingCurrent: (binding) => isCurrentConnection() && isProductBindingCurrent(binding),
    sendProductResult: authenticator.sendProductResult,
  };
  installProductSendCapability(productSendCapability);

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
  retireProductSender();
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
    retireProductSender();
    socket = null;
    connectedGeneration = null;
    connectionAuthenticator = null;
    previousAuthenticator?.retire();
    previous.close();
  }
  connectionAuthenticator = null;
  retireConnectionState();
}

// Public route retained for existing callers.
export function handleMessage(msg: WebSocketMessage, isStillCurrent: () => boolean = () => true, runtimeGeneration: string | null = connectedGeneration) {
  return routeApplicationMessage(msg, isStillCurrent, runtimeGeneration);
}

export { onFusionMessage, onFusionResponse };
