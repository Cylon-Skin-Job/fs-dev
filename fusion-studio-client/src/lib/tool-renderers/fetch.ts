/**
 * fetch — extracted page content preview.
 *
 * Live content is chunked one paragraph at a time by the active strategy.
 */

import { escapeHtml } from '../transforms';
import type { ToolRenderer } from './types';

export const fetchRenderer: ToolRenderer = {
  grouped: false,

  buildTitle: (n) => n === 1 ? 'Fetch' : `Fetch (${n})`,

  contentStyle: {
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    fontStyle: 'normal',
    fontSize: '13px',
  },

  formatContent: (content) => {
    if (!content) return '';
    const lines = content.split('\n').filter(l => l.trim());
    return lines.map(line => {
      const truncated = line.length > 80 ? line.slice(0, 77) + '...' : line;
      return `<div style="color:var(--text-dim);padding:1px 0">${escapeHtml(truncated)}</div>`;
    }).join('');
  },

  shouldConsumeNext: (nextType) => nextType === 'fetch',
};
