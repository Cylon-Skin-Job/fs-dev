import { writeAndRecord } from '../../clipboard/clipboard-api';
import { showToast } from '../toast';
import type {
  AssistantReplySourceRef,
  AssistantReplyTextPayload,
} from './reply-text';

const DATA_UNAVAILABLE_MESSAGE = 'Error: Data Unavailable';

export function guardAssistantReplySource(
  source: AssistantReplySourceRef | null | undefined,
  options: { requireExchangeId?: boolean } = {},
): source is AssistantReplySourceRef {
  if (
    !source?.threadId ||
    !source.messageId ||
    (options.requireExchangeId && typeof source.exchangeId !== 'number')
  ) {
    showToast(DATA_UNAVAILABLE_MESSAGE);
    return false;
  }
  return true;
}

export function guardAssistantReplyAction(
  payload: AssistantReplyTextPayload | null | undefined,
  source: AssistantReplySourceRef | null | undefined,
): payload is AssistantReplyTextPayload {
  if (!payload?.hasText || !payload.markdown) {
    showToast(DATA_UNAVAILABLE_MESSAGE);
    return false;
  }
  return guardAssistantReplySource(source);
}

export async function copyReplyText(
  payload: AssistantReplyTextPayload | null | undefined,
  source: AssistantReplySourceRef | null | undefined,
): Promise<boolean> {
  if (!guardAssistantReplyAction(payload, source)) return false;

  try {
    await writeAndRecord(payload.markdown, 'assistant-reply');
    return true;
  } catch (err) {
    console.error('[AssistantReplyChrome] copyReplyText failed:', err);
    showToast(DATA_UNAVAILABLE_MESSAGE);
    return false;
  }
}

export async function copyChatId(
  source: AssistantReplySourceRef | null | undefined,
): Promise<boolean> {
  if (!guardAssistantReplySource(source, { requireExchangeId: true })) return false;

  try {
    await writeAndRecord(String(source.exchangeId), 'assistant-reply-chat-id');
    showToast('Chat ID copied');
    return true;
  } catch (err) {
    console.error('[AssistantReplyChrome] copyChatId failed:', err);
    showToast(DATA_UNAVAILABLE_MESSAGE);
    return false;
  }
}

export async function copyNoteDraft(
  noteText: string | null | undefined,
  source: AssistantReplySourceRef | null | undefined,
): Promise<boolean> {
  if (!guardAssistantReplySource(source, { requireExchangeId: true })) return false;

  if (!noteText?.trim()) {
    showToast(DATA_UNAVAILABLE_MESSAGE);
    return false;
  }

  try {
    await writeAndRecord(noteText, 'assistant-reply-note');
    return true;
  } catch (err) {
    console.error('[AssistantReplyChrome] copyNoteDraft failed:', err);
    showToast(DATA_UNAVAILABLE_MESSAGE);
    return false;
  }
}
