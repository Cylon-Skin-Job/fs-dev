import type { StreamSegment, UniversalDiffDisplay, UniversalToolDisplay } from '../../../types';
import { escapeHtml } from '../../transforms';

export function buildFileChangeTitle(
  action: 'Write' | 'Edit',
  args?: Record<string, unknown>,
  segment?: StreamSegment,
): string {
  const diff = firstDiffDisplay(segment?.toolDisplay);
  const filePath = pathFromArgs(args) || diff?.path || 'file';
  const counts = segment?.returnedDiff && diff
    ? ` (-${diff.removedLines}, +${diff.addedLines})`
    : '';
  return `${action} ${basename(filePath)}${counts}`;
}

export function formatFileChangeContent(content: string, segment?: StreamSegment): string {
  if (segment?.isError) {
    return formatErrorContent(content, segment.toolStatus);
  }

  const diffs = diffDisplays(segment?.toolDisplay);
  if (!segment?.returnedDiff || diffs.length === 0) return '';

  return diffs.map(formatDiffBlock).join('');
}

function formatDiffBlock(diff: UniversalDiffDisplay): string {
  const rows = [
    ...diffLines(diff.oldText, '-'),
    ...diffLines(diff.newText, '+'),
  ];

  if (rows.length === 0) return '';

  const htmlRows = rows.map(({ prefix, text }) => {
    const style = prefix === '+'
      ? 'color:#4ade80;background:rgba(74,222,128,0.08)'
      : 'color:#f87171;background:rgba(248,113,113,0.08)';
    return `<span style="display:block;${style}">${prefix} ${escapeHtml(text)}</span>`;
  }).join('');

  return `<pre style="margin:0;overflow-x:auto"><code>${htmlRows}</code></pre>`;
}

function formatErrorContent(content: string, status?: string): string {
  const text = [status, content].filter(Boolean).join('\n');
  return text ? escapeHtml(text) : '';
}

function diffDisplays(display?: UniversalToolDisplay[]): UniversalDiffDisplay[] {
  if (!Array.isArray(display)) return [];
  return display.filter(isDiffDisplay);
}

function firstDiffDisplay(display?: UniversalToolDisplay[]): UniversalDiffDisplay | undefined {
  return diffDisplays(display)[0];
}

function isDiffDisplay(item: UniversalToolDisplay): item is UniversalDiffDisplay {
  return item?.type === 'diff'
    && typeof item.path === 'string'
    && typeof item.oldText === 'string'
    && typeof item.newText === 'string'
    && typeof item.removedLines === 'number'
    && typeof item.addedLines === 'number';
}

function diffLines(text: string, prefix: '+' | '-'): Array<{ prefix: '+' | '-'; text: string }> {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.map(line => ({ prefix, text: line }));
}

function pathFromArgs(args?: Record<string, unknown>): string | undefined {
  const path = args?.path ?? args?.file_path;
  return typeof path === 'string' && path.trim() ? path : undefined;
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || normalized || 'file';
}
