import { escapeHtml } from './transforms';

const MAX_VISIBLE_LINES = 5;
const VISIBLE_RECENT_ACTIVITY_LINES = 3;

export function buildSubagentTitle(args?: Record<string, unknown>): string {
  const description = stringValue(args?.description);
  if (description) return `Using Agent (${description})`;
  return 'Using Agent';
}

export function getSubagentTypeFromArgs(args?: Record<string, unknown>): string {
  return stringValue(args?.subagent_type) || stringValue(args?.agent_type) || 'subagent';
}

export function buildSubagentIntroLine(agentId?: string, subagentType?: string): string {
  const type = subagentType || 'subagent';
  return agentId ? `subagent ${type} (${agentId})` : `subagent ${type}`;
}

export function buildSubagentToolLine(toolName: string, args?: Record<string, unknown>): string {
  const label = friendlyToolName(toolName);
  const detail = toolDetail(toolName, args);
  return detail ? `Used ${label} (${detail})` : `Used ${label}`;
}

export function buildSubagentCompletedLine(): string {
  return 'completed';
}

export function buildSubagentResultFallbackLines(
  output: string,
  args?: Record<string, unknown>,
): string[] {
  const lines: string[] = [];
  const type = getSubagentTypeFromArgs(args);
  lines.push(buildSubagentIntroLine(undefined, type));

  const metadata = parseSubagentResultMetadata(output);
  if (metadata.agentId || metadata.subagentType) {
    lines[0] = buildSubagentIntroLine(metadata.agentId, metadata.subagentType || type);
  }

  if (metadata.status) {
    lines.push(metadata.status === 'completed' ? buildSubagentCompletedLine() : `status ${metadata.status}`);
  } else {
    lines.push(buildSubagentCompletedLine());
  }

  const summaryTitle = firstSummaryTitle(output);
  if (summaryTitle) lines.push(`summary ${summaryTitle}`);

  return lines;
}

export function formatSubagentContent(content: string): string {
  const lines = compactSubagentLines(
    content
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
  );

  return lines
    .map(line => `<div>${escapeHtml(`• ${line}`)}</div>`)
    .join('');
}

export function compactSubagentLines(lines: string[]): string[] {
  if (lines.length <= MAX_VISIBLE_LINES) return lines;

  const first = lines[0];
  const activity = lines.slice(1);
  const recent = activity.slice(-VISIBLE_RECENT_ACTIVITY_LINES);
  const hiddenCount = activity.length - recent.length;
  const hiddenLabel = `${hiddenCount} more tool call${hiddenCount === 1 ? '' : 's'} ...`;

  return [first, hiddenLabel, ...recent];
}

function friendlyToolName(toolName: string): string {
  const map: Record<string, string> = {
    Shell: 'Shell',
    ReadFile: 'Read',
    WriteFile: 'Write',
    StrReplaceFile: 'Edit',
    Glob: 'Glob',
    Grep: 'Grep',
    SearchWeb: 'Web Search',
    FetchURL: 'Fetch',
  };
  return map[toolName] || toolName || 'Tool';
}

function toolDetail(toolName: string, args?: Record<string, unknown>): string {
  if (toolName === 'Grep') return '';

  const command = stringValue(args?.command);
  if (toolName === 'Shell' && command) return shellSummary(command);

  const path = stringValue(args?.path) || stringValue(args?.file_path);
  if (path) {
    if (toolName === 'ReadFile' || toolName === 'WriteFile' || toolName === 'StrReplaceFile') {
      return basename(path);
    }
    return compactPath(path);
  }

  const pattern = stringValue(args?.pattern) || stringValue(args?.query);
  if (pattern) return truncateMiddle(pattern, 48);

  const url = stringValue(args?.url);
  if (url) return compactUrl(url);

  return '';
}

function shellSummary(command: string): string {
  const normalized = command.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const firstToken = normalized.split(' ')[0] || 'shell';
  const executable = basename(firstToken);
  const path = firstPathLikeToken(normalized);

  if (path) return `${executable} ${basename(path)}`;

  const quoted = firstQuotedValue(normalized);
  if (quoted) return `${executable} ${basename(quoted) || truncateMiddle(quoted, 32)}`;

  return executable;
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const cleaned = normalized.replace(/^['"]|['"]$/g, '').replace(/[),;:]$/g, '');
  return cleaned.split('/').filter(Boolean).pop() || cleaned;
}

function compactPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length < 2) return normalized;
  return `~/${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const headLength = Math.ceil((maxLength - 3) / 2);
  const tailLength = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, headLength)}...${value.slice(value.length - tailLength)}`;
}

function compactUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return truncateMiddle(value, 48);
  }
}

function firstPathLikeToken(command: string): string {
  const tokens = command.match(/(?:"[^"]+"|'[^']+'|\S+)/g) || [];
  const pathToken = tokens.find(token => {
    const cleaned = token.replace(/^['"]|['"]$/g, '');
    return cleaned.includes('/') || cleaned.startsWith('~');
  });
  return pathToken ? pathToken.replace(/^['"]|['"]$/g, '') : '';
}

function firstQuotedValue(command: string): string {
  const match = command.match(/"([^"]+)"|'([^']+)'/);
  return match?.[1] || match?.[2] || '';
}

function parseSubagentResultMetadata(output: string): {
  agentId?: string;
  subagentType?: string;
  status?: string;
} {
  const metadata: { agentId?: string; subagentType?: string; status?: string } = {};
  for (const line of output.split('\n')) {
    const [rawKey, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (!rawKey || !value) continue;

    const key = rawKey.trim();
    if (key === 'agent_id') metadata.agentId = value;
    if (key === 'actual_subagent_type') metadata.subagentType = value;
    if (key === 'status') metadata.status = value;
    if (line.trim() === '[summary]') break;
  }
  return metadata;
}

function firstSummaryTitle(output: string): string {
  const summaryIndex = output.indexOf('[summary]');
  const summary = summaryIndex >= 0 ? output.slice(summaryIndex + '[summary]'.length) : output;
  const heading = summary
    .split('\n')
    .map(line => line.trim())
    .find(line => line.startsWith('#'));
  return heading ? heading.replace(/^#+\s*/, '').trim() : '';
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
