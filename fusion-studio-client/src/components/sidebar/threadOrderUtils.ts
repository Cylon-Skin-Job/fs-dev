import type { Thread } from '../../types';

/** Display name fallback — strip milliseconds suffix from thread ID when unnamed. */
export function formatThreadDisplayName(thread: Thread): string {
  if (thread.entry?.name) return thread.entry.name;
  return thread.threadId.replace(/-\d{3}$/, '');
}

/**
 * SECONDARY_CHAT_SPEC §4: when a secondary chat is open, move the secondary's
 * thread to position 2 (right after the primary's active thread).
 */
export function reorderWithSecondary<T extends { threadId: string }>(
  threads: T[],
  primaryId: string | null,
  secondaryId: string | null,
): T[] {
  if (!threads || threads.length === 0) return threads;
  if (!secondaryId) return threads;
  const secondary = threads.find((t) => t.threadId === secondaryId);
  if (!secondary) return threads;
  const remainder = threads.filter((t) => t.threadId !== secondaryId);
  const primaryIdx = remainder.findIndex((t) => t.threadId === primaryId);
  const insertAt = primaryIdx >= 0 ? primaryIdx + 1 : 0;
  const out = [...remainder];
  out.splice(insertAt, 0, secondary);
  return out;
}

export function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return 'unknown';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'unknown';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'unknown';
  }
}
