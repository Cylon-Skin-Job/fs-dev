/**
 * shell — Monospace line stream. Like a terminal.
 *
 * Preserves exact formatting. No syntax highlighting.
 */

import { escapeHtml } from '../transforms';
import type { ToolRenderer } from './types';

const MAX_RENDERED_OUTPUT_LINES = 12;
const MAX_RENDERED_LINE_LENGTH = 180;

export const shellRenderer: ToolRenderer = {
  grouped: false,
  buildTitle: () => 'Shell',
  contentStyle: {
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    fontStyle: 'normal',
    fontSize: '13px',
  },
  formatContent: (content, args, segment) => {
    const command = getShellCommand(args);
    const status = segment?.isError ? segment.toolStatus : undefined;
    const pieces: string[] = [];

    if (command) {
      pieces.push(`<span class="rv-shell-command">$ ${escapeHtml(command)}</span>`);
      if (content || status) pieces.push('\n\n');
    }

    if (content) pieces.push(escapeHtml(compactShellOutput(content)));

    if (status) {
      if (content && !content.endsWith('\n')) pieces.push('\n');
      pieces.push(`<span class="rv-shell-status">${escapeHtml(status)}</span>`);
    }

    return pieces.join('');
  },
};

function getShellCommand(args?: Record<string, unknown>): string | undefined {
  const command = args?.command;
  return typeof command === 'string' && command.length > 0 ? command : undefined;
}

function compactShellOutput(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  if (!normalized) return '';

  const lines = normalized.split('\n').map(compactLine);
  if (lines.length <= MAX_RENDERED_OUTPUT_LINES) return lines.join('\n');

  const headCount = 6;
  const tailCount = MAX_RENDERED_OUTPUT_LINES - headCount - 1;
  const omitted = lines.length - headCount - tailCount;
  return [
    ...lines.slice(0, headCount),
    `... ${omitted} more output line${omitted === 1 ? '' : 's'}`,
    ...lines.slice(lines.length - tailCount),
  ].join('\n');
}

function compactLine(line: string): string {
  if (line.length <= MAX_RENDERED_LINE_LENGTH) return line;
  return `${line.slice(0, MAX_RENDERED_LINE_LENGTH - 3)}...`;
}
