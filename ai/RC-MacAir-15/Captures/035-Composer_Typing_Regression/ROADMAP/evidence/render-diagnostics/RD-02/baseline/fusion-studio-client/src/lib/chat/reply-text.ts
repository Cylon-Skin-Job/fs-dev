import type { StreamSegment } from '../../types';

export interface AssistantReplyTextPayload {
  markdown: string;
  plainText: string;
  hasText: boolean;
}

export interface AssistantReplySourceRef {
  threadId: string;
  messageId: string;
  exchangeSeq?: number;
  exchangeId?: number;
}

export function extractAssistantReplyText(
  segments: StreamSegment[] | undefined,
): AssistantReplyTextPayload {
  const markdown = (segments || [])
    .filter(segment => segment.type === 'text')
    .map(segment => segment.content)
    .join('');

  return {
    markdown,
    plainText: markdownToPlainText(markdown),
    hasText: markdown.trim().length > 0,
  };
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[^\n`]*\n([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
