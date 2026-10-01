/** Private chat product-send boundary. Local admission is never a server ACK. */
import type { ProductSendResult } from '../shell-auth-client';

export type { ProductSendResult } from '../shell-auth-client';
export type ProductSendPolicy = 'socket_only' | 'auth_queue_allowed';

export interface ProductSendBinding {
  workspaceId: string;
  workspaceEpoch: string;
  bindingRevision: number;
  bindingSerial: number;
}

export interface ProductSendCapability {
  socket: WebSocket;
  generation: string | null;
  isAuthenticated: () => boolean;
  captureBinding: (workspaceId: string) => ProductSendBinding | null;
  isBindingCurrent: (binding: ProductSendBinding) => boolean;
  sendProductResult: (
    serialized: string,
    policy: ProductSendPolicy,
    stillCurrent: () => boolean,
  ) => ProductSendResult;
}

let installed: ProductSendCapability | null = null;

export function installProductSendCapability(capability: ProductSendCapability): void {
  installed = capability;
}

export function retireProductSendCapability(capability: ProductSendCapability): void {
  if (installed === capability) installed = null;
}

export function sendChatProduct(
  payload: Record<string, unknown>,
  options: { workspaceId: string; policy: ProductSendPolicy; expectedSocket?: WebSocket | null },
): ProductSendResult {
  const owner = installed;
  if (!owner) return { status: 'not_enqueued', reason: 'disconnected' };
  if ('expectedSocket' in options && owner.socket !== options.expectedSocket) {
    return { status: 'not_enqueued', reason: 'stale_connection' };
  }
  if (owner.socket.readyState !== WebSocket.OPEN) return { status: 'not_enqueued', reason: 'disconnected' };
  const binding = owner.captureBinding(options.workspaceId);
  if (!binding) return { status: 'not_enqueued', reason: 'binding_unavailable' };
  if (options.policy === 'socket_only' && !owner.isAuthenticated()) {
    return { status: 'not_enqueued', reason: 'auth_not_ready' };
  }
  let serialized: string;
  try { serialized = JSON.stringify(payload); }
  catch { return { status: 'not_enqueued', reason: 'serialization_failed' }; }
  if (typeof serialized !== 'string') return { status: 'not_enqueued', reason: 'serialization_failed' };
  const stillCurrent = () => installed === owner && owner.socket.readyState === WebSocket.OPEN
    && owner.isBindingCurrent(binding);
  if (!stillCurrent()) return { status: 'not_enqueued', reason: 'stale_binding' };
  return owner.sendProductResult(serialized, options.policy, stillCurrent);
}
