import type { SegmentType, StreamSegment } from '../../../types';
import { escapeHtml } from '../../transforms';
import type { ToolRenderer } from '../types';
import { truncatePath } from './path-truncate';

interface ErrorContextDefinition {
  label: string;
  keys: string[];
  format?: (value: string) => string;
}

interface ErrorContextRow {
  label: string;
  rawValue: string;
  displayValue: string;
}

const MAX_ERROR_OUTPUT_LINES = 16;
const MAX_ERROR_OUTPUT_LINE_LENGTH = 220;

/**
 * ONE shared pure compaction/dedupe presentation limit for safe error
 * message text (RCC-0108 parent §4.13 — reused by the tool-error formatter
 * and the ChatTurnError terminal row): compacts (newline normalization,
 * trailing-whitespace trim, line/line-length caps), then drops the result
 * when it normalizes equal to any already-presented duplicate. Returns
 * undefined when nothing renderable remains. Defensive presentation limit
 * ONLY — the server owns disclosure safety; the client never decides
 * whether provider data is safe.
 */
export function compactDedupedSafeErrorText(
  raw: string,
  duplicates: string[] = [],
): string | undefined {
  const compacted = compactErrorOutput(raw || '');
  if (!compacted) return undefined;

  const normalized = normalizeComparableText(compacted);
  if (duplicates.some((candidate) => normalizeComparableText(candidate) === normalized)) {
    return undefined;
  }

  return compacted;
}

const TOOL_LABELS: Record<SegmentType, string> = {
  text: 'Text',
  think: 'Thinking',
  shell: 'Shell',
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  glob: 'Glob',
  grep: 'Grep',
  web_search: 'Web Search',
  fetch: 'Fetch',
  subagent: 'Subagent',
  todo: 'Todo',
};

const TOOL_ERROR_CONTEXT_CATALOG: Partial<Record<SegmentType, ErrorContextDefinition[]>> = {
  shell: [{ label: 'Command', keys: ['command'], format: (value) => `$ ${value}` }],
  read: [{ label: 'File', keys: ['path', 'file_path', 'filePath'] }],
  write: [{ label: 'File', keys: ['path', 'file_path', 'filePath'] }],
  edit: [{ label: 'File', keys: ['path', 'file_path', 'filePath'] }],
  glob: [{ label: 'Pattern', keys: ['pattern'] }],
  grep: [{ label: 'Pattern', keys: ['pattern'] }],
  web_search: [{ label: 'Query', keys: ['query'] }],
  fetch: [{ label: 'URL', keys: ['url'] }],
  subagent: [{ label: 'Agent', keys: ['subagentType', 'agentType', 'type'] }],
};

export function formatToolErrorContent(
  type: SegmentType | string,
  content: string,
  args?: Record<string, unknown>,
  segment?: StreamSegment,
): string {
  const segmentType = isSegmentType(type) ? type : undefined;
  const label = segmentType ? TOOL_LABELS[segmentType] : 'Tool';
  const contextRows = segmentType ? getContextRows(segmentType, args) : [];
  const contextValues = contextRows.map((row) => row.rawValue);
  const output = getRenderableOutput(content, contextValues);
  const duplicateCandidates = output ? [...contextValues, output] : contextValues;
  const status = getRenderableStatus(segment?.toolStatus, duplicateCandidates);

  const body = [
    `<div class="rv-tool-error-title">${escapeHtml(`${label} failed`)}</div>`,
    ...contextRows.map(formatContextRow),
  ];

  if (status) {
    body.push(`<div class="rv-tool-error-status">${escapeHtml(status)}</div>`);
  }

  if (output) {
    body.push(`<pre class="rv-tool-error-output">${escapeHtml(output)}</pre>`);
  }

  if (!status && !output) {
    body.push('<div class="rv-tool-error-status">No error details returned.</div>');
  }

  return `<div class="rv-tool-error">${body.join('')}</div>`;
}

export function withUniversalToolErrorPresentation(
  type: SegmentType | string,
  renderer: ToolRenderer,
): ToolRenderer {
  return {
    ...renderer,
    formatContent: (content, args, segment) => {
      if (segment?.isError) {
        return formatToolErrorContent(segment.type || type, content, args, segment);
      }
      return renderer.formatContent(content, args, segment);
    },
  };
}

function getContextRows(type: SegmentType, args?: Record<string, unknown>): ErrorContextRow[] {
  const definitions = TOOL_ERROR_CONTEXT_CATALOG[type] || [];
  return definitions.flatMap((definition) => {
    const value = firstStringValue(args, definition.keys);
    if (!value) return [];
    return [{
      label: definition.label,
      rawValue: value,
      displayValue: definition.format ? definition.format(value) : truncatePath(value),
    }];
  });
}

function firstStringValue(args: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!args) return undefined;
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function formatContextRow(row: ErrorContextRow): string {
  return [
    '<div class="rv-tool-error-context">',
    `<span class="rv-tool-error-context-label">${escapeHtml(row.label)}:</span> `,
    escapeHtml(row.displayValue),
    '</div>',
  ].join('');
}

function getRenderableStatus(status: string | undefined, duplicates: string[]): string | undefined {
  const trimmed = String(status || '').trim();
  if (!trimmed) return undefined;

  const normalized = normalizeComparableText(trimmed);
  if (normalized === 'error' || normalized === 'failed') return undefined;
  if (duplicates.some((candidate) => normalizeComparableText(candidate) === normalized)) return undefined;

  return trimmed;
}

function getRenderableOutput(content: string | undefined, duplicates: string[]): string | undefined {
  return compactDedupedSafeErrorText(content || '', duplicates);
}

function compactErrorOutput(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  if (!normalized) return '';

  const lines = normalized.split('\n').map(compactLine);
  if (lines.length <= MAX_ERROR_OUTPUT_LINES) return lines.join('\n');

  const headCount = 8;
  const tailCount = MAX_ERROR_OUTPUT_LINES - headCount - 1;
  const omitted = lines.length - headCount - tailCount;
  return [
    ...lines.slice(0, headCount),
    `... ${omitted} more output line${omitted === 1 ? '' : 's'}`,
    ...lines.slice(lines.length - tailCount),
  ].join('\n');
}

function compactLine(line: string): string {
  if (line.length <= MAX_ERROR_OUTPUT_LINE_LENGTH) return line;
  return `${line.slice(0, MAX_ERROR_OUTPUT_LINE_LENGTH - 3)}...`;
}

function normalizeComparableText(value: string | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isSegmentType(value: string): value is SegmentType {
  return Object.prototype.hasOwnProperty.call(TOOL_LABELS, value);
}
