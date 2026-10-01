import { onFusionResponse } from '../ws-client';
import { sendChatProduct } from '../ws/product-send';
import type { ChatTurnMetadataPatch } from '../../types';
import type { AssistantReplySourceRef } from './reply-text';

interface ChatTurnMetadataUpdatedMessage {
  type: 'chat-turn:metadata:updated';
  threadId?: string;
  exchangeId?: number;
  metadata?: Record<string, unknown>;
}

interface ChatTurnMetadataErrorMessage {
  type: 'chat-turn:metadata:error';
  threadId?: string;
  exchangeId?: number;
  message?: string;
}

export interface ReplyMetadataUpdateResult {
  threadId: string;
  exchangeId: number;
  metadata: Record<string, unknown>;
}

export function updateReplyMetadata(
  source: AssistantReplySourceRef,
  patch: ChatTurnMetadataPatch,
  options: { timeoutMs?: number } = {},
): Promise<ReplyMetadataUpdateResult> {
  const exchangeId = source.exchangeId;
  if (!source.threadId || typeof exchangeId !== 'number') {
    return Promise.reject(new Error('Error: Data Unavailable'));
  }

  const timeoutMs = options.timeoutMs ?? 5000;

  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribeUpdated = () => {};
    let unsubscribeError = () => {};

    const cleanup = () => {
      if (settled) return;
      settled = true;
      unsubscribeUpdated();
      unsubscribeError();
      clearTimeout(timeout);
    };

    const matches = (msg: { threadId?: string; exchangeId?: number }) =>
      msg.threadId === source.threadId && msg.exchangeId === exchangeId;
    const retire = () => {
      cleanup();
      reject(new Error('Connection retired while updating reply metadata'));
    };

    unsubscribeUpdated = onFusionResponse<ChatTurnMetadataUpdatedMessage>(
      'chat-turn:metadata:updated',
      (msg) => {
        if (!matches(msg)) return;
        cleanup();
        resolve({
          threadId: source.threadId,
          exchangeId,
          metadata: msg.metadata || {},
        });
      },
      retire,
    );

    unsubscribeError = onFusionResponse<ChatTurnMetadataErrorMessage>(
      'chat-turn:metadata:error',
      (msg) => {
        if (!matches(msg)) return;
        cleanup();
        reject(new Error(msg.message || 'Metadata update failed'));
      },
      retire,
    );

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout waiting for chat-turn:metadata:updated'));
    }, timeoutMs);

    const result = sendChatProduct({
      type: 'chat-turn:metadata:update',
      threadId: source.threadId,
      exchangeId,
      patch,
    }, { workspaceId: source.workspaceId ?? '', policy: 'auth_queue_allowed' });
    if (result.status === 'not_enqueued') {
      cleanup();
      reject(new Error('Metadata update was not enqueued'));
    }
  });
}
