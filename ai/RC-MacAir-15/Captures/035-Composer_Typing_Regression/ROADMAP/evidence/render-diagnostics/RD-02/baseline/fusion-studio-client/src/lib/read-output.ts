import { normalizeToolOutput } from './tool-output';

export interface ReadFileSection {
  path: string;
  metadata?: string;
  lines: string[];
}

const SYSTEM_TAG_RE = /<system>([\s\S]*?)<\/system>/g;

export function parseReadFileOutput(
  output: unknown,
  args?: Record<string, unknown>,
): ReadFileSection {
  const path = readPathFromArgs(args);
  const metadata: string[] = [];
  const lines: string[] = [];

  for (const part of normalizeToolOutput(output)) {
    if (part.kind === 'system') {
      const text = stripSystemTag(part.text);
      if (text) metadata.push(text);
      continue;
    }

    const visibleText = part.text.replace(SYSTEM_TAG_RE, (_match, systemText: string) => {
      const text = systemText.trim();
      if (text) metadata.push(text);
      return '';
    });

    const partLines = visibleText.replace(/\r\n/g, '\n').replace(/^\n+/, '').split('\n');
    if (partLines[partLines.length - 1] === '') partLines.pop();
    lines.push(...partLines);
  }

  const metadataText = metadata.join('\n') || undefined;
  return {
    path,
    metadata: metadataText,
    lines: lines.length > 0 ? lines : fallbackLines(path, metadataText),
  };
}

export function formatReadFileSection(section: ReadFileSection): string {
  const chunks = [section.path, ...section.lines];
  return `${chunks.join('\n')}\n`;
}

export function formatReadFileSummary(args?: Record<string, unknown>): string {
  return compactHomePath(readPathFromArgs(args));
}

function readPathFromArgs(args?: Record<string, unknown>): string {
  const path = args?.path ?? args?.file_path ?? args?.filePath;
  return typeof path === 'string' && path.trim() ? path : 'Read file';
}

function fallbackLines(path: string, metadata?: string): string[] {
  if (metadata) return metadata.split('\n').filter(Boolean);
  return [`No file content returned for ${path}`];
}

function stripSystemTag(text: string): string {
  return text
    .trim()
    .replace(/^<system>/, '')
    .replace(/<\/system>$/, '')
    .trim();
}

function compactHomePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 2) return normalized;

  const fileName = parts[parts.length - 1];
  const parent = parts[parts.length - 2];
  return `~/${parent}/${fileName}`;
}
