/** Persistent notifications and connection-scoped response subscriptions. */
import type { WebSocketMessage } from '../../types';

type FusionListener = (msg: unknown) => void;
type FusionMessagePayload = WebSocketMessage & Record<string, unknown>;
interface FusionListenerEntry {
  listener: FusionListener;
  onConnectionRetired: (() => void) | null;
}
const fusionListeners: Map<string, Set<FusionListenerEntry>> = new Map();

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

export function emitFusion(type: string, msg: WebSocketMessage) {
  const listeners = fusionListeners.get(type);
  if (listeners) {
    for (const entry of listeners) entry.listener(msg);
  }
}

export function retireFusionResponseListeners(): void {
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

