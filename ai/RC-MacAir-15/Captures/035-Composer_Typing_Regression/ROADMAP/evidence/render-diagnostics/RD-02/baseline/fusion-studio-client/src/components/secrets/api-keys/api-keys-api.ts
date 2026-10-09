/**
 * @module components/secrets/api-keys/api-keys-api
 * @role Typed thin wrappers around secrets:api-keys:* WS messages — fire-and-forget send
 */

import { sendFusionMessage } from '../../../lib/ws-client';

export function listApiKeys(): void {
  sendFusionMessage({ type: 'secrets:api-keys:list' });
}

export function setApiKey(opts: {
  name: string;
  value: string;
  description?: string;
  expires_at?: number | null;
}): void {
  sendFusionMessage({ type: 'secrets:api-keys:set', ...opts });
}

export function deleteApiKey(name: string): void {
  sendFusionMessage({ type: 'secrets:api-keys:delete', name });
}
