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
import { handleRecentDocsMessage } from './ws/recent-docs-handlers';
import { handleBookmarksMessage } from './ws/bookmarks-handlers';
import { handleCalendarMessage } from './ws/calendar-handlers';
import { setLoggerWs, captureConsoleLogs } from '../lib/logger';
import { showModal } from '../lib/modal';
import { loadAllPanels } from '../lib/panels';
import type { ModalConfig } from '../lib/modal';
import type { ApiKeyIndexEntry, ApiKeysErrorCode } from '../state/secretsStore';
import type { ViewUIState, WebSocketMessage } from '../types';

// --- Module state ---

const WS_URL = `ws://${window.location.host}`;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// --- Fusion message listeners ---
// Components subscribe to specific message types for fusion: responses.

type FusionListener = (msg: unknown) => void;
type FusionMessagePayload = WebSocketMessage & Record<string, unknown>;
const fusionListeners: Map<string, Set<FusionListener>> = new Map();

interface StateResultMessage extends WebSocketMessage {
  type: 'state:result';
  view?: string;
  state?: ViewUIState;
}

interface StateErrorMessage extends WebSocketMessage {
  type: 'state:error';
  message?: string;
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

function redactMessageForLog(msg: WebSocketMessage): WebSocketMessage {
  if (
    msg.type !== 'chat-turn:metadata:update' &&
    msg.type !== 'chat-turn:metadata:updated' &&
    msg.type !== 'chat-turn:metadata:error'
  ) {
    return msg;
  }

  return {
    ...msg,
    metadata: redactNoteBody(msg.metadata) as Record<string, unknown> | undefined,
    patch: msg.patch
      ? {
        ...msg.patch,
        note: redactNoteBody(msg.patch.note) as { body: string } | null | undefined,
      }
      : msg.patch,
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
  // Guard against double-connect (HMR, React Strict Mode)
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    return;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

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
    ws.send(JSON.stringify({ type: 'initialize' }));

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
      const msg = parsed;
      console.log('[WS] Message received:', msg.type, redactMessageForLog(msg));
      handleMessage(msg);
    } catch (err) {
      console.error('[WS] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected');
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
  if (msg.type === 'chat-turn:metadata:updated' || msg.type === 'chat-turn:metadata:error') {
    emitFusion(msg.type, msg);
  }

  if (handleStreamMessage(msg)) return;
  if (handleThreadMessage(msg)) return;
  if (handleFileMessage(msg)) return;
  if (handleWorkspaceMessage(msg)) return;
  if (handleHarnessMessage(msg)) return;
  if (handleThemeMessage(msg)) return;
  if (handleScreenshotMessage(msg)) return;
  if (handleRecentDocsMessage(msg)) return;
  if (handleBookmarksMessage(msg)) return;
  if (handleCalendarMessage(msg)) return;

  // SPEC-26c-2 / STATE_OVERRIDE_SPEC: view UI state responses.
  if (msg.type === 'state:result') {
    const store = usePanelStore.getState();
    const stateMsg = msg as StateResultMessage;
    const view = stateMsg.view;
    const incoming = stateMsg.state;
    if (!view || !incoming) return;
    store.setViewState(view, incoming);
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
