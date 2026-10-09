import { getSummaryField } from '../catalog-visual';
import { toolNameToSegmentType } from '../instructions';
import { normalizeToolOutput, visibleToolText } from '../tool-output';

const MAX_SHELL_OUTPUT_LINES = 12;
const MAX_SHELL_OUTPUT_LINE_LENGTH = 180;

export function normalizeToolResultForSegment(
  type: ReturnType<typeof toolNameToSegmentType>,
  output: unknown,
  isError?: boolean,
  toolStatus?: string,
): { content: string; status?: string } {
  if (type === 'shell') {
    const parts = normalizeToolOutput(output);
    const content = compactShellOutput(parts
      .filter(part => part.kind === 'text')
      .map(part => part.text)
      .join(''));
    const status = parts
      .filter(part => part.kind === 'system')
      .map(part => stripSystemTag(part.text).trim())
      .filter(Boolean)
      .join('\n')
      || (typeof toolStatus === 'string' ? toolStatus.trim() : '');

    return {
      content: content || (isError ? status : ''),
      status: status || undefined,
    };
  }

  if (toolStatus) return { content: visibleToolText(output), status: toolStatus };
  if (type === 'fetch') return { content: visibleToolText(output, true) };
  return { content: visibleToolText(output) };
}

export function formatGroupedSummaryLine(
  type: ReturnType<typeof toolNameToSegmentType>,
  args: Record<string, unknown> | undefined,
  content: string,
): string {
  const summaryFieldName = getSummaryField(type);
  const summaryValue = summaryFieldName && args?.[summaryFieldName];
  const summaryLine = typeof summaryValue === 'string'
    ? summaryValue
    : content.slice(0, 80) || type;
  return `${summaryLine}\n`;
}

export function parseToolArgs(raw: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ToolCallPart can arrive as partial JSON. Keep buffering until parseable.
  }
  return undefined;
}

export function appendUniqueLine(content: string, line: string): string {
  const lines = content.split('\n').map(item => item.trim()).filter(Boolean);
  return lines.includes(line) ? content : `${content}\n${line}`;
}

function compactShellOutput(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  if (!normalized) return '';

  const lines = normalized.split('\n').map(compactShellLine);
  if (lines.length <= MAX_SHELL_OUTPUT_LINES) return lines.join('\n');

  const headCount = 6;
  const tailCount = MAX_SHELL_OUTPUT_LINES - headCount - 1;
  const omitted = lines.length - headCount - tailCount;
  return [
    ...lines.slice(0, headCount),
    `... ${omitted} more output line${omitted === 1 ? '' : 's'}`,
    ...lines.slice(lines.length - tailCount),
  ].join('\n');
}

function compactShellLine(line: string): string {
  if (line.length <= MAX_SHELL_OUTPUT_LINE_LENGTH) return line;
  return `${line.slice(0, MAX_SHELL_OUTPUT_LINE_LENGTH - 3)}...`;
}

function stripSystemTag(text: string): string {
  return text
    .trim()
    .replace(/^<system>/, '')
    .replace(/<\/system>$/, '');
}
