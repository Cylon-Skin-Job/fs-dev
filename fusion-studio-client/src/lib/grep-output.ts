import { visibleToolText } from './tool-output';

const MAX_GREP_LINES = 200;

export function parseGrepOutput(output: unknown): string[] {
  const text = visibleToolText(output, true);
  if (!text.trim()) return [];

  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.length > 0);

  if (lines.length > MAX_GREP_LINES) {
    return [
      ...lines.slice(0, MAX_GREP_LINES),
      `... and ${lines.length - MAX_GREP_LINES} more matches`,
    ];
  }
  return lines;
}

export function formatGrepResultSection(
  args: Record<string, unknown> | undefined,
  output: unknown,
): string {
  const heading = grepHeadingFromArgs(args);
  const matchRows = parseGrepOutput(output);

  if (matchRows.length === 0) {
    return `${heading}\n  (no matches)\n`;
  }

  const indented = matchRows.map(row => `  ${row}`);
  return `${heading}\n${indented.join('\n')}\n`;
}

function grepHeadingFromArgs(args?: Record<string, unknown>): string {
  const path = args?.file_path ?? args?.path;
  if (typeof path === 'string' && path.trim()) {
    return compactHomePath(path.trim());
  }
  const pattern = args?.pattern;
  if (typeof pattern === 'string' && pattern.trim()) {
    return pattern.trim();
  }
  const query = args?.query;
  if (typeof query === 'string' && query.trim()) {
    return query.trim();
  }
  return 'grep';
}

function compactHomePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 2) return normalized;

  const fileName = parts[parts.length - 1];
  const parent = parts[parts.length - 2];
  return `~/${parent}/${fileName}`;
}
