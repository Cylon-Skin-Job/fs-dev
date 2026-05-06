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
import { setLoggerWs, captureConsoleLogs } from '../lib/logger';
import { showModal } from '../lib/modal';
import { loadAllPanels } from '../lib/panels';
import type { WebSocketMessage } from '../types';

// --- Module state ---

const WS_URL = 'ws://localhost:3001';

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// --- Robin message listeners ---
// Components subscribe to specific message types for robin: responses.

type RobinListener = (msg: any) => void;
const robinListeners: Map<string, Set<RobinListener>> = new Map();

export function sendRobinMessage(msg: Record<string, unknown>) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

export function onRobinMessage(type: string, listener: RobinListener): () => void {
  if (!robinListeners.has(type)) robinListeners.set(type, new Set());
  robinListeners.get(type)!.add(listener);
  return () => { robinListeners.get(type)?.delete(listener); };
}

function emitRobin(type: string, msg: any) {
  const listeners = robinListeners.get(type);
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
      const msg: WebSocketMessage = JSON.parse(event.data);
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
  if (handleStreamMessage(msg)) return;
  if (handleThreadMessage(msg)) return;
  if (handleFileMessage(msg)) return;
  if (handleWorkspaceMessage(msg)) return;
  if (handleHarnessMessage(msg)) return;
  if (handleThemeMessage(msg)) return;

  // SPEC-26c-2 / STATE_OVERRIDE_SPEC: view UI state responses.
  if (msg.type === 'state:result') {
    const store = usePanelStore.getState();
    const view = (msg as any).view;
    const incoming = (msg as any).state;
    store.setViewState(view, incoming);
    // STATE_OVERRIDE_SPEC §9.3: hydrate persisted currentThreadId into the
    // live slot when loading the active view. Guarded equality check in
    // setCurrentThreadId prevents a persist-echo loop.
    if (
      view === store.currentPanel &&
      incoming?.currentThreadId &&
      incoming.currentThreadId !== store.currentThreadIds.project
    ) {
      store.setCurrentThreadId('project', incoming.currentThreadId);
    }
    return;
  }
  if (msg.type === 'state:error') {
    console.error('[state] error:', (msg as any).message);
    return;
  }

  const store = usePanelStore.getState();

  switch (msg.type) {
    case 'connected':
      console.log('[WS] Session:', msg.sessionId);
      break;

    case 'modal:show':
      showModal(msg as unknown as import('../lib/modal').ModalConfig);
      break;

    case 'panel_config':
      if ((msg as any).projectRoot) {
        store.setProjectRoot((msg as any).projectRoot);
      }
      break;

    case 'panel_changed':
      // CLI_CONFIG_SPEC §7d: stash per-view overrides for render-time merge.
      if (msg.panel) {
        store.setCliConfigViewDelta(msg.panel, msg.cliConfigDelta ?? {});
      }
      break;

    // Robin system panel responses
    case 'robin:tabs':
    case 'robin:items':
    case 'robin:wiki':
      emitRobin(msg.type, msg);
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
      emitRobin(msg.type, msg);
      break;

    case 'secrets:api-keys:state': {
      const m = msg as any;
      useSecretsStore.getState().setApiKeys(m.items);
      break;
    }

    case 'secrets:api-keys:error': {
      const m = msg as any;
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

