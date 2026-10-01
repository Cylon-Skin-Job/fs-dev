/** Mutable observation buffers. Pulled at 5 Hz by diagnostics only, never chat. */
import { usePanelStore } from '../../state/panelStore';
import { sendChatProduct } from '../ws/product-send';
import { readRevealSurfaces } from '../reveal/progress';
import type { WebSocketMessage } from '../../types';
import type { DiagnosticTarget, DiagnosticStreamFrame } from './types';

const LIMIT = 131072;
type Surface = ReturnType<typeof readRevealSurfaces>[number];
export interface DiagnosticChannel {
  target: DiagnosticTarget;
  subscriptionId: string;
  socket: WebSocket | null;
  turnId: string | null;
  retiredTurns: Set<string>;
  generation: number;
  sequence: number;
  text: string;
  notice: string;
  availability: string;
  terminal: boolean;
  events: number;
  sourceUnits: number;
  sourceBytes: number;
  canonical: Record<string, number>;
  canonicalEvents: Record<string, number>;
  startedAt: number;
  lastIncomingAt: number | null;
  lastSurface: Surface | null;
  truncated: boolean;
  sampledAt: number;
  sampledVisible: Record<string, number>;
  stopWatch: () => void;
}
const channels = new Map<string, DiagnosticChannel>();
function addNotice(c: DiagnosticChannel, notice: string) {
  if (!c.notice.includes(notice)) c.notice += ' ' + notice;
}
function reset(c: DiagnosticChannel, turnId: string | null) {
  if (c.turnId && c.turnId !== turnId) {
    c.retiredTurns.add(c.turnId);
    if (c.retiredTurns.size > 64) c.retiredTurns.delete(c.retiredTurns.values().next().value!);
  }
  c.notice = 'Capture starts here; no earlier events retained.';
  c.turnId = turnId; c.sequence = 0; c.text = ''; c.events = 0;
  c.sourceUnits = 0; c.sourceBytes = 0; c.canonical = {}; c.canonicalEvents = {};
  c.startedAt = Date.now(); c.lastIncomingAt = null; c.lastSurface = null;
  c.sampledAt = Date.now(); c.sampledVisible = {};
  c.truncated = false; c.terminal = false;
}
function send(c: DiagnosticChannel, type: 'subscribe' | 'unsubscribe') {
  const result = sendChatProduct({ type: `chat-turn:diagnostic:${type}`,
    subscriptionId: c.subscriptionId, workspaceId: c.target.workspaceId, threadId: c.target.threadId },
  { workspaceId: c.target.workspaceId, policy: 'socket_only', expectedSocket: c.socket });
  if (result.status !== 'enqueued') c.availability = 'disconnected';
}
export function openDiagnosticStream(id: string, target: DiagnosticTarget) {
  if (channels.has(id)) return;
  const c: DiagnosticChannel = { target, subscriptionId: '', socket: null, turnId: null, retiredTurns: new Set(),
    generation: 0, sequence: 0, text: '', notice: 'Capture starts here; no earlier events retained.',
    availability: 'connecting', terminal: false, events: 0, sourceUnits: 0, sourceBytes: 0,
    canonical: {}, canonicalEvents: {}, startedAt: Date.now(), lastIncomingAt: null,
    lastSurface: null, truncated: false, sampledAt: Date.now(), sampledVisible: {}, stopWatch: () => {} };
  channels.set(id, c);
  const reconcile = () => {
    const state = usePanelStore.getState();
    if (state.activeWorkspaceId !== target.workspaceId) {
      send(c, 'unsubscribe'); c.socket = null; c.availability = 'unavailable';
      reset(c, null); c.notice = 'Workspace changed; capture discarded.'; return;
    }
    if (state.ws === c.socket) return;
    const reconnect = Boolean(c.subscriptionId);
    send(c, 'unsubscribe');
    c.socket = state.ws;
    c.subscriptionId = `diagnostic-${crypto.randomUUID()}`;
    c.generation = 0;
    // Resubscribe starts a new observation window. No attempt to replay missing native data.
    reset(c, null);
    c.retiredTurns.clear();
    c.turnId = state.projectChats[target.threadId]?.currentTurn?.id ?? null;
    c.notice = reconnect ? 'Connection gap; capture restarted here. Missed events unavailable.'
      : 'Capture starts here; no earlier events retained.';
    c.availability = c.socket ? 'connecting' : 'disconnected';
    send(c, 'subscribe');
  };
  c.stopWatch = usePanelStore.subscribe(reconcile);
  reconcile();
  c.turnId = usePanelStore.getState().projectChats[target.threadId]?.currentTurn?.id ?? null;
  sampleDiagnostic(id);
}
export function closeDiagnosticStream(id: string) {
  const c = channels.get(id); if (!c) return;
  c.stopWatch(); send(c, 'unsubscribe'); channels.delete(id);
}
export function handleDiagnosticStream(frame: DiagnosticStreamFrame) {
  const c = [...channels.values()].find(candidate => candidate.subscriptionId === frame.subscriptionId);
  if (!c || frame.workspaceId !== c.target.workspaceId || frame.threadId !== c.target.threadId
    || usePanelStore.getState().activeWorkspaceId !== c.target.workspaceId) return;
  if (frame.turnId && c.retiredTurns.has(frame.turnId)) return;
  if (frame.availability === 'unavailable') { c.availability = 'unavailable'; return; }
  if (!Number.isSafeInteger(frame.generation) || frame.generation! < c.generation) return;
  const generation = frame.generation!;
  if (generation === c.generation && c.turnId && frame.turnId !== c.turnId) return;
  if (generation > c.generation || (frame.reset && !c.turnId)) {
    if (c.turnId !== frame.turnId) {
      const reconnecting = c.generation === 0 && c.notice.includes('Connection gap');
      reset(c, frame.turnId ?? null);
      if (reconnecting) addNotice(c, 'Connection gap; missed events unavailable.');
    }
    c.generation = generation; c.sequence = frame.baseline ?? 0;
  }
  c.availability = frame.availability; c.terminal = frame.terminal === true;
  if (frame.dropped) addNotice(c, 'Transport gap: some native events were dropped; counts cover observed events only.');
  for (const event of frame.events ?? []) {
    if (!Number.isSafeInteger(event.seq) || event.seq <= c.sequence || typeof event.text !== 'string') continue;
    if (event.seq !== c.sequence + 1) addNotice(c, 'Sequence gap: missed native events unavailable.');
    c.sequence = event.seq;
    c.events += event.count ?? 1; c.sourceUnits += event.sourceUnits; c.sourceBytes += event.sourceBytes;
    c.lastIncomingAt = Date.now();
    c.text += event.dropped ? '[Native event dropped by bounded capture]\n' : event.text + '\n';
    if (event.redacted) addNotice(c, 'Redaction applied to native event text.');
    if (c.text.length > LIMIT) { c.text = c.text.slice(-LIMIT); c.truncated = true; }
  }
}
/** Called only after the existing canonical thread/turn/sequence gate accepts a frame. */
export function observeCanonicalDiagnostic(msg: WebSocketMessage) {
  for (const c of channels.values()) {
    if (msg.threadId !== c.target.threadId || usePanelStore.getState().activeWorkspaceId !== c.target.workspaceId) continue;
    if (msg.type === 'turn_begin') {
      if (c.turnId !== msg.turnId) reset(c, msg.turnId ?? null);
      continue;
    }
    if (!msg.turnId || c.turnId !== msg.turnId) continue;
    const type = msg.type;
    if (!['content', 'thinking', 'tool_call', 'tool_call_args', 'tool_result'].includes(type)) continue;
    c.canonicalEvents[type] = (c.canonicalEvents[type] ?? 0) + 1;
    const text = type === 'content' || type === 'thinking' ? msg.text
      : type === 'tool_call_args' ? msg.argsChunk : null;
    // Counts only source strings; object tool args/results have no prose-length equivalence.
    if (typeof text === 'string') c.canonical[type] = (c.canonical[type] ?? 0) + text.length;
  }
}
export function sampleDiagnostic(id: string) {
  const c = channels.get(id); if (!c) return null;
  const surface = readRevealSurfaces().find(s => s.workspaceId === c.target.workspaceId
    && s.threadId === c.target.threadId && s.surfaceId === c.target.surfaceId
    && (!c.turnId || s.turnId === c.turnId));
  const now = Date.now();
  const visible: Record<string, number> = {};
  for (const segment of surface?.segments ?? []) visible[segment.visibleUnit] = (visible[segment.visibleUnit] ?? 0) + segment.visible;
  const rates = Object.entries(visible).map(([unit, amount]) => `${(Math.max(0, amount - (c.sampledVisible[unit] ?? amount)) / Math.max(.001, (now - c.sampledAt) / 1000)).toFixed(1)} ${unit}/s`);
  if (surface) c.lastSurface = surface;
  c.sampledVisible = visible; c.sampledAt = now;
  return { rates,  ...c, surface: surface ?? c.lastSurface, mounted: Boolean(surface), now: Date.now() };
}
