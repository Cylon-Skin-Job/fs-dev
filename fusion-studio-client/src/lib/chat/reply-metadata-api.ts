import { onFusionMessage, sendFusionMessage } from '../ws-client';
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
    let timeout: ReturnType<typeof setTimeout>;
    let unsubscribeUpdated = () => {};
    let unsubscribeError = () => {};

    const cleanup = () => {
      unsubscribeUpdated();
      unsubscribeError();
      clearTimeout(timeout);
    };

    const matches = (msg: { threadId?: string; exchangeId?: number }) =>
      msg.threadId === source.threadId && msg.exchangeId === exchangeId;

    unsubscribeUpdated = onFusionMessage<ChatTurnMetadataUpdatedMessage>(
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
    );

    unsubscribeError = onFusionMessage<ChatTurnMetadataErrorMessage>(
      'chat-turn:metadata:error',
      (msg) => {
        if (!matches(msg)) return;
        cleanup();
        reject(new Error(msg.message || 'Metadata update failed'));
      },
    );

    timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout waiting for chat-turn:metadata:updated'));
    }, timeoutMs);

    sendFusionMessage({
      type: 'chat-turn:metadata:update',
      threadId: source.threadId,
      exchangeId,
      patch,
    });
  });
}
