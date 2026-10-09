/**
 * @module lib/chat/diagnostic-report
 * @role Defensive client projection for one server-redacted V1 harness report.
 *
 * Diagnostic reports are outside the ordinary transcript contract. This
 * module reconstructs the closed, bounded shape before any report value can
 * reach display, clipboard, or composer surfaces, then provides one stable
 * human-readable representation for all three actions.
 */

import type { ChatTurnDiagnosticReport } from '../../types';

const SHORT_IDENTIFIER_BYTES = 128;
const MESSAGE_PREFIX_BYTES = 4096;
const STDERR_TAIL_BYTES = 16_384;
const SERIALIZED_LIMIT_BYTES = 24_576;
const MAX_TRUNCATION_MARKERS = 16;

const REPORT_KEYS = new Set([
  'version',
  'harnessId',
  'modelId',
  'category',
  'providerCode',
  'errorName',
  'exitCode',
  'signal',
  'message',
  'stderrExcerpt',
  'lastCanonicalEventType',
  'hadRenderableOutput',
  'hadToolCalls',
  'truncatedFields',
]);

const CATEGORIES = new Set(['authentication', 'timeout', 'process_exit', 'runtime']);
const TRUNCATION_MARKERS = new Set([
  'message',
  'stderrExcerpt',
  'harnessId',
  'modelId',
  'providerCode',
  'errorName',
  'signal',
  'lastCanonicalEventType',
]);

const SHORT_FIELDS = [
  'modelId',
  'providerCode',
  'errorName',
  'signal',
  'lastCanonicalEventType',
] as const;

export interface ValidatedChatTurnDiagnosticReport extends ChatTurnDiagnosticReport {
  category: 'authentication' | 'timeout' | 'process_exit' | 'runtime';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function readBoundedString(
  source: Record<string, unknown>,
  key: string,
  maxBytes: number,
): string | undefined | null {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return undefined;
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0 || utf8Length(value) > maxBytes) {
    return null;
  }
  return value;
}

/** Reconstruct one closed report, or return null for any malformed value. */
export function validateChatTurnDiagnosticReport(
  raw: unknown,
): ValidatedChatTurnDiagnosticReport | null {
  if (!isPlainObject(raw)) return null;
  if (Object.keys(raw).some((key) => !REPORT_KEYS.has(key))) return null;
  if (raw.version !== 1) return null;
  if (raw.hadRenderableOutput !== true && raw.hadRenderableOutput !== false) return null;
  if (raw.hadToolCalls !== true && raw.hadToolCalls !== false) return null;

  const harnessId = readBoundedString(raw, 'harnessId', SHORT_IDENTIFIER_BYTES);
  if (!harnessId) return null;

  const category = readBoundedString(raw, 'category', SHORT_IDENTIFIER_BYTES);
  if (!category || !CATEGORIES.has(category)) return null;

  if (!Array.isArray(raw.truncatedFields)) return null;
  if (raw.truncatedFields.length > MAX_TRUNCATION_MARKERS) return null;
  const markers: string[] = [];
  for (const marker of raw.truncatedFields) {
    if (typeof marker !== 'string' || !TRUNCATION_MARKERS.has(marker) || markers.includes(marker)) {
      return null;
    }
    markers.push(marker);
  }

  const report: ValidatedChatTurnDiagnosticReport = {
    version: 1,
    harnessId,
    category: category as ValidatedChatTurnDiagnosticReport['category'],
    hadRenderableOutput: raw.hadRenderableOutput,
    hadToolCalls: raw.hadToolCalls,
    truncatedFields: markers,
  };
  for (const field of SHORT_FIELDS) {
    const value = readBoundedString(raw, field, SHORT_IDENTIFIER_BYTES);
    if (value === null) return null;
    if (value !== undefined) report[field] = value;
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'exitCode')) {
    if (typeof raw.exitCode !== 'number' || !Number.isFinite(raw.exitCode)) return null;
    report.exitCode = raw.exitCode;
  }

  const message = readBoundedString(raw, 'message', MESSAGE_PREFIX_BYTES);
  if (message === null) return null;
  if (message !== undefined) report.message = message;

  const stderrExcerpt = readBoundedString(raw, 'stderrExcerpt', STDERR_TAIL_BYTES);
  if (stderrExcerpt === null) return null;
  if (stderrExcerpt !== undefined) report.stderrExcerpt = stderrExcerpt;

  if (utf8Length(JSON.stringify(report)) > SERIALIZED_LIMIT_BYTES) return null;
  return report;
}

/** Stable display/copy/composer text, produced only after closed-shape validation. */
export function formatChatTurnDiagnosticReport(raw: unknown): string | null {
  const report = validateChatTurnDiagnosticReport(raw);
  if (!report) return null;

  const lines = [
    'Redacted harness diagnostic',
    `Harness: ${report.harnessId}`,
    ...(report.modelId ? [`Model: ${report.modelId}`] : []),
    `Category: ${report.category}`,
    ...(report.providerCode ? [`Provider code: ${report.providerCode}`] : []),
    ...(report.errorName ? [`Error name: ${report.errorName}`] : []),
    ...(report.exitCode !== undefined ? [`Exit code: ${report.exitCode}`] : []),
    ...(report.signal ? [`Signal: ${report.signal}`] : []),
    ...(report.lastCanonicalEventType ? [`Last event: ${report.lastCanonicalEventType}`] : []),
    `Renderable output: ${report.hadRenderableOutput ? 'yes' : 'no'}`,
    `Tool calls: ${report.hadToolCalls ? 'yes' : 'no'}`,
    `Truncated fields: ${report.truncatedFields.length > 0 ? report.truncatedFields.join(', ') : 'none'}`,
    ...(report.message ? ['', 'Message:', report.message] : []),
    ...(report.stderrExcerpt ? ['', 'Stderr excerpt:', report.stderrExcerpt] : []),
  ];
  return lines.join('\n');
}
