/**
 * @module emojis/emoji-recents-api
 * @role Client-side emoji recents recording transport
 */

import { onFusionMessage, sendFusionMessage } from '../lib/ws-client';

export interface EmojiRecentItem {
  id: number;
  emoji: string;
  last_used_at: number;
}

const EMOJI_PATTERN = /[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*|[0-9#*]\uFE0F?\u20E3/gu;

export function extractEmojis(text: string): string[] {
  const seen = new Set<string>();
  const emojis: string[] = [];
  for (const match of text.matchAll(EMOJI_PATTERN)) {
    const emoji = match[0];
    if (!seen.has(emoji)) {
      seen.add(emoji);
      emojis.push(emoji);
    }
  }
  return emojis;
}

export function getInsertedText(previous: string, next: string): string {
  if (next.length <= previous.length) return '';

  let prefixLength = 0;
  while (
    prefixLength < previous.length &&
    prefixLength < next.length &&
    previous[prefixLength] === next[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previous.length - prefixLength &&
    suffixLength < next.length - prefixLength &&
    previous[previous.length - 1 - suffixLength] === next[next.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  return next.slice(prefixLength, next.length - suffixLength);
}

export function recordEmojiRecentsFromText(text: string): void {
  for (const emoji of extractEmojis(text)) {
    sendFusionMessage({ type: 'emoji_recents:record', emoji });
  }
}

export function listEmojiRecents(limit = 20): Promise<EmojiRecentItem[]> {
  return new Promise((resolve, reject) => {
    const unsubscribeList = onFusionMessage('emoji_recents:list', (msg) => {
      cleanup();
      resolve(Array.isArray(msg.items) ? msg.items : []);
    });
    const unsubscribeError = onFusionMessage('emoji_recents:error', (msg) => {
      cleanup();
      reject(new Error(msg.error || 'Failed to load emoji recents'));
    });
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timeout waiting for emoji recents'));
    }, 5000);

    function cleanup() {
      window.clearTimeout(timeout);
      unsubscribeList();
      unsubscribeError();
    }

    sendFusionMessage({ type: 'emoji_recents:list', limit });
  });
}
