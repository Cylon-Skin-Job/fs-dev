/**
 * @module ws-client
 * @role Standalone WebSocket client — no React dependency
 *
 * Manages connection, reconnection, discovery, and message routing.
 * Writes directly to the Zustand store. React components read from the store only.
 */

import { usePanelStore } from '../state/panelStore';
import { useSecretsStore } from '../state/secretsStore';
import { handleStreamMessage, resetStreamState } from './ws/stream-handlers';
import { handleThreadMessage } from './ws/thread-handlers';
import { handleFileMessage } from './ws/file-handlers';
import { handleWorkspaceMessage } from './ws/workspace-handlers';
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
import { loadAllPanels } from '../lib/panels';
import {
  sanitizeTerminalErrorsAtIngress,
} from './chat/terminal-error';
import {
  getLatestViewStateMutationId,
  hasPendingViewStateMutation,
  settleViewStateMutation,
} from './viewStateMutationTracker';
import type { ModalConfig } from '../lib/modal';
import type { ApiKeyIndexEntry, ApiKeysErrorCode } from '../state/secretsStore';
import type { ViewUIState, WebSocketMessage } from '../types';

// --- Module state ---

const WS_URL = `ws://${window.location.host}`;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let officePaletteWorkspaceSubscriptionStarted = false;

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
const fusionListeners: Map<string, Set<FusionListener>> = new Map();

interface StateResultMessage extends WebSocketMessage {
  type: 'state:result';
  view?: string;
  state?: ViewUIState;
  clientMutationId?: number;
}

interface StateErrorMessage extends WebSocketMessage {
  type: 'state:error';
  message?: string;
  view?: string;
  clientMutationId?: number;
}

interface PanelConfigMessage extends WebSocketMessage {
  type: 'panel_config';
  projectRoot?: string | null;
  panelRoots?: Record<string, string>;
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

function redactNoteBody(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const clone = { ...(value as Record<string, unknown>) };
  if (typeof clone.body === 'string') {
    clone.body = '[redacted]';
  }
  const note = clone.note;
  if (note && typeof note === 'object' && 'body' in note) {
    clone.note = { ...(note as Record<string, unknown>), body: '[redacted]' };
  }
  return clone;
}

/**
 * Reduce an inbound frame to its loggable form. Exported as the single
 * suppression-boundary seam (roadmap §5.5) so browser fixtures can prove
 * report-field containment; called before every inbound console.log above.
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

  const safeMessage = sanitizeTerminalErrorsAtIngress(msg);

  if (
    safeMessage.type !== 'chat-turn:metadata:update' &&
    safeMessage.type !== 'chat-turn:metadata:updated' &&
    safeMessage.type !== 'chat-turn:metadata:error'
  ) {
    return safeMessage;
  }

  return {
    ...safeMessage,
    metadata: redactNoteBody(safeMessage.metadata) as Record<string, unknown> | undefined,
    patch: safeMessage.patch
      ? {
        ...safeMessage.patch,
        note: redactNoteBody(safeMessage.patch.note) as { body: string } | null | undefined,
      }
      : safeMessage.patch,
  };
}

export function sendFusionMessage(msg: Record<string, unknown>) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

export function onFusionMessage<T = FusionMessagePayload>(type: string, listener: (msg: T) => void): () => void {
  if (!fusionListeners.has(type)) fusionListeners.set(type, new Set());
  const wrapped: FusionListener = (msg) => listener(msg as T);
  fusionListeners.get(type)!.add(wrapped);
  return () => { fusionListeners.get(type)?.delete(wrapped); };
}

function emitFusion(type: string, msg: WebSocketMessage) {
  const listeners = fusionListeners.get(type);
  if (listeners) {
    for (const fn of listeners) fn(msg);
  }
}

// --- Public API ---

export function connectWs() {
  ensureOfficePaletteWorkspaceSubscription();
  // Guard against double-connect (HMR, React Strict Mode)
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
  console.log('[WS] Connecting...');
  const ws = new WebSocket(WS_URL);
  socket = ws;

  ws.onopen = () => {
    console.log('[WS] Connected');
    resetStreamState();
    const store = usePanelStore.getState();
    store.setWs(ws);
    setLoggerWs(ws);
    captureConsoleLogs();
    handleOfficePaletteSocketOpen(ws);

    // Tell server which panel we're using
    const currentPanel = store.currentPanel;
    if (currentPanel) {
      console.log('[WS] Sending set_panel for:', currentPanel);
      ws.send(JSON.stringify({ type: 'set_panel', panel: currentPanel }));
    }

    // Discover panels
    loadAllPanels(ws).then((configs) => {
      console.log(`[WS] Discovered ${configs.length} panels`);
      usePanelStore.getState().setPanelConfigs(configs);
    }).catch((err) => {
      console.error('[WS] Panel discovery failed:', err);
    });
  };

  ws.onmessage = (event) => {
    try {
      const parsed: unknown = JSON.parse(event.data);
      if (!isWebSocketMessage(parsed)) {
        throw new Error('WebSocket message missing type');
      }
      const msg = sanitizeTerminalErrorsAtIngress(parsed);
      console.log('[WS] Message received:', msg.type, redactMessageForLog(msg));
      handleMessage(msg);
    } catch (err) {
      console.error('[WS] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected');
    handleOfficePaletteSocketClose(ws);
    usePanelStore.getState().setWs(null);
    reconnectTimer = setTimeout(connectWs, 3000);
  };

  ws.onerror = (err) => {
    console.error('[WS] Error:', err);
  };
}

export function disconnectWs() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
}

// --- Message handling ---
// Every store read uses getState() — always fresh, no stale closures.

function handleMessage(msg: WebSocketMessage) {
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
  if (handleWorkspaceMessage(msg)) return;
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
    const latestMutationId = getLatestViewStateMutationId(view);
    if (clientMutationId !== null && clientMutationId < latestMutationId) {
      return;
    }

    const current = store.viewStates[view];
    const hasPendingMutation = current && hasPendingViewStateMutation(view);
    // state:set responses contain a full server state. When multiple patches
    // are in flight, a later echo can be based on an older disk snapshot, so
    // keep the optimistic local state until the pending mutation settles.
    const stateToApply = hasPendingMutation ? { ...incoming, ...current } : incoming;
    store.setViewState(view, stateToApply);
    if (clientMutationId !== null) {
      settleViewStateMutation(view, clientMutationId);
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
    if (stateMsg.view && typeof stateMsg.clientMutationId === 'number') {
      settleViewStateMutation(stateMsg.view, stateMsg.clientMutationId);
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
      const panelMsg = msg as PanelConfigMessage;
      if (panelMsg.projectRoot) {
        store.setProjectRoot(panelMsg.projectRoot);
      }
      if (panelMsg.panelRoots) {
        store.setPanelRoots(panelMsg.panelRoots);
      }
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
