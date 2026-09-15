import type { Thread } from '../../types';

/** Display name fallback — strip milliseconds suffix from thread ID when unnamed. */
export function formatThreadDisplayName(thread: Thread): string {
  if (thread.entry?.name) return thread.entry.name;
  return thread.threadId.replace(/-\d{3}$/, '');
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
