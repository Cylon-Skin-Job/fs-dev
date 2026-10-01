/**
 * Deterministic completed-message revision identities.
 *
 * Revisions are derived from the immutable presentation inputs rather than
 * array position or object identity. This makes hydration and real edits
 * invalidate stale presentation work while unrelated live/store updates keep
 * a completed row stable. No formatted output is retained here.
 */
import type { Message } from '../../types';

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(record[key])}`
  )).join(',')}}`;
}

function hashRevision(prefix: string, value: unknown): string {
  const input = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}-${input.length}`;
}

export function messageContentRevision(message: Message): string {
  return hashRevision('content', {
    type: message.type,
    content: message.content,
    segments: message.segments,
    projection: message.projection,
  });
}

export function messageMetadataRevision(message: Message): string {
  return hashRevision('metadata', {
    exchangeId: message.exchangeId,
    exchangeSeq: message.exchangeSeq,
    timestamp: message.timestamp,
    terminalError: message.terminalError,
    metadata: message.metadata,
  });
}

export function withMessageRevisions(message: Message): Message {
  const contentRevision = messageContentRevision(message);
  const metadataRevision = messageMetadataRevision(message);
  if (
    message.contentRevision === contentRevision &&
    message.metadataRevision === metadataRevision
  ) return message;
  return { ...message, contentRevision, metadataRevision };
}
