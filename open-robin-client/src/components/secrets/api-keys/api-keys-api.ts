/**
 * @module components/secrets/api-keys/api-keys-api
 * @role Typed thin wrappers around secrets:api-keys:* WS messages — fire-and-forget send
 */

import { sendRobinMessage } from '../../../lib/ws-client';

export function listApiKeys(): void {
  sendRobinMessage({ type: 'secrets:api-keys:list' });
}

export function setApiKey(opts: {
  name: string;
  value: string;
  description?: string;
  expires_at?: number | null;
}): void {
  sendRobinMessage({ type: 'secrets:api-keys:set', ...opts });
}

export function deleteApiKey(name: string): void {
  sendRobinMessage({ type: 'secrets:api-keys:delete', name });
}
