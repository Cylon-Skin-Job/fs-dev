export interface ContentPart {
  type?: unknown;
  text?: unknown;
}

export type ToolOutputPart =
  | { kind: 'system'; text: string }
  | { kind: 'text'; text: string };

export interface SearchResultChunk {
  kind: 'search-result';
  title?: string;
  date?: string;
  url?: string;
  summary?: string;
  raw: string;
}

export interface FetchParagraphChunk {
  kind: 'fetch-paragraph';
  text: string;
}

const SYSTEM_OPEN = '<system>';
const SYSTEM_CLOSE = '</system>';

export function normalizeToolOutput(output: string | ContentPart[] | unknown): ToolOutputPart[] {
  if (typeof output === 'string') {
    return [classifyTextPart(output)];
  }

  if (Array.isArray(output)) {
    const parts: ToolOutputPart[] = [];
    for (const part of output) {
      if (!part || typeof part !== 'object') continue;
      const maybeTextPart = part as ContentPart;
      if (maybeTextPart.type !== 'text' || typeof maybeTextPart.text !== 'string') continue;
      parts.push(classifyTextPart(maybeTextPart.text));
    }
    return parts;
  }

  return [{ kind: 'text', text: stringifyUnknown(output) }];
}

export function visibleToolText(output: string | ContentPart[] | unknown, dropSystem = false): string {
  return normalizeToolOutput(output)
    .filter(part => !(dropSystem && part.kind === 'system'))
    .map(part => part.text)
    .join('\n\n');
}

export function parseSearchWebOutput(output: string): SearchResultChunk[] {
  const blocks = output
    .replace(/\r\n/g, '\n')
    .split(/\n\s*---\s*\n/g)
    .map(block => block.trim())
    .filter(Boolean);

  return blocks.map(parseSearchBlock);
}

export function formatSearchResultChunk(chunk: SearchResultChunk): string {
  if (!chunk.title && !chunk.url && !chunk.summary) {
    return `${chunk.raw}\n\n`;
  }

  const lines = [
    chunk.title,
    chunk.url,
    preview(chunk.summary),
  ].filter(Boolean);

  return `${lines.join('\n')}\n\n`;
}

export function parseFetchOutput(output: string | ContentPart[] | unknown): FetchParagraphChunk[] {
  const text = normalizeToolOutput(output)
    .filter(part => part.kind === 'text')
    .map(part => part.text.trim())
    .filter(Boolean)
    .join('\n\n');

  if (!text) return [];

  let paragraphs = text
    .split(/\n\s*\n+/g)
    .map(part => part.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1 && /\n/.test(text)) {
    paragraphs = text
      .split(/\n+/g)
      .map(part => part.trim())
      .filter(Boolean);
  }

  return paragraphs.map(paragraph => ({
    kind: 'fetch-paragraph',
    text: `${paragraph}\n\n`,
  }));
}

function parseSearchBlock(raw: string): SearchResultChunk {
  const chunk: SearchResultChunk = { kind: 'search-result', raw };
  const lines = raw.split('\n');
  let currentField: 'title' | 'date' | 'url' | 'summary' | null = null;

  for (const line of lines) {
    const field = /^(Title|Date|URL|Summary):\s*(.*)$/i.exec(line);
    if (field) {
      const key = field[1].toLowerCase() as 'title' | 'date' | 'url' | 'summary';
      const value = field[2].trim();
      currentField = key;
      appendField(chunk, key, value);
      continue;
    }

    if (currentField === 'summary') {
      appendField(chunk, 'summary', line.trim());
    }
  }

  return chunk;
}

function appendField(
  chunk: SearchResultChunk,
  key: 'title' | 'date' | 'url' | 'summary',
  value: string,
): void {
  if (!value) return;
  chunk[key] = chunk[key] ? `${chunk[key]}\n${value}` : value;
}

function classifyTextPart(text: string): ToolOutputPart {
  const trimmed = text.trim();
  if (trimmed.startsWith(SYSTEM_OPEN) && trimmed.endsWith(SYSTEM_CLOSE)) {
    return { kind: 'system', text };
  }
  return { kind: 'text', text };
}

function stringifyUnknown(output: unknown): string {
  if (output == null) return '';
  if (typeof output === 'object') {
    try {
      return JSON.stringify(output);
    } catch {
      return String(output);
    }
  }
  return String(output);
}

function preview(text?: string): string | undefined {
  if (!text) return undefined;
  const flattened = text.replace(/\s+/g, ' ').trim();
  return flattened.length > 180 ? `${flattened.slice(0, 177)}...` : flattened;
}
