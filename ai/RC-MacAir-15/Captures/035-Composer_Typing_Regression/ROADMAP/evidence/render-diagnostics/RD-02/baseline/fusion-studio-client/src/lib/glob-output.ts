import { visibleToolText } from './tool-output';

const MAX_GLOB_LINES = 200;

export function parseGlobOutput(output: unknown): string[] {
  const text = visibleToolText(output, true);
  if (!text.trim()) return [];

  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.length > 0);

  if (lines.length > MAX_GLOB_LINES) {
    return [
      ...lines.slice(0, MAX_GLOB_LINES),
      `... and ${lines.length - MAX_GLOB_LINES} more matches`,
    ];
  }
  return lines;
}

export function formatGlobResultSection(
  _args: Record<string, unknown> | undefined,
  output: unknown,
): string {
  const rows = parseGlobOutput(output);
  if (rows.length === 0) {
    return '(no matches)\n';
  }
  return rows.map(row => compactHomePath(row)).join('\n') + '\n';
}

function compactHomePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 2) return normalized;

  const fileName = parts[parts.length - 1];
  const parent = parts[parts.length - 2];
  return `~/${parent}/${fileName}`;
}
