/**
 * @module lib/chat/terminal-error
 * @role Client boundary for the closed safe terminal-error catalog
 *       (RCC-0108 SPEC-05 Slice B; parent §4.13, roadmap §5.5).
 *
 * One job: decide what the client may present about a terminal turn error.
 * The server owns disclosure safety — it normalizes every failure to this
 * fixed catalog before publication (accepted SPEC-03
 * `lib/thread/turn-terminal-error.js`, whose rows are the normative values
 * mirrored below). This module re-validates at the client boundary so no
 * unvalidated bytes can ever reach presentation:
 *
 *  - A VALIDATED envelope reproduces its catalog row (kind/code/message/
 *    recoverable are reconstructed FROM THE CATALOG, never spread or cloned
 *    from the input) plus its optional opaque `diagnosticId`.
 *  - ANY other value — absent fields, wrong kind/code/message pairing,
 *    `recoverable` !== true, extra own keys (raw-injected objects), arrays,
 *    primitives — maps to the GENERIC safe catalog entry
 *    (MODEL_RESPONSE_FAILED / runtime / fixed message / recoverable) without
 *    copying a single unknown field.
 *  - The client never parses, truncates, or derives display text from the
 *    raw input; the only presentation limit applied later is the shared
 *    compaction/dedupe helper over the ALREADY-validated safe message.
 */

import type {
  Message,
  TurnTerminalError,
  TurnTerminalErrorCode,
  WebSocketMessage,
} from '../../types';

const MAX_DIAGNOSTIC_ID_BYTES = 128;

/** Opaque lookup references are never parsed; only their closed bound matters. */
export function isValidDiagnosticId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && new TextEncoder().encode(value).byteLength <= MAX_DIAGNOSTIC_ID_BYTES;
}

/**
 * Closed display catalog — exact mirror of the server normative table
 * (accepted SPEC-03; parent §4.13). Do not edit values without a SPEC change.
 */
const TURN_TERMINAL_ERROR_CATALOG: Readonly<
  Record<TurnTerminalErrorCode, Omit<TurnTerminalError, 'diagnosticId'>>
> = Object.freeze({
  AUTHENTICATION_FAILED: Object.freeze({
    kind: 'authentication',
    code: 'AUTHENTICATION_FAILED',
    message: 'Authentication failed. Check the configured harness credentials and try again.',
    recoverable: true,
  }),
  MODEL_TIMEOUT: Object.freeze({
    kind: 'runtime',
    code: 'MODEL_TIMEOUT',
    message: 'The model response timed out before it completed.',
    recoverable: true,
  }),
  HARNESS_EXITED: Object.freeze({
    kind: 'runtime',
    code: 'HARNESS_EXITED',
    message: 'The model process ended before the response completed.',
    recoverable: true,
  }),
  MODEL_RESPONSE_FAILED: Object.freeze({
    kind: 'runtime',
    code: 'MODEL_RESPONSE_FAILED',
    message: 'The model response failed before it completed.',
    recoverable: true,
  }),
});

/** Generic safe fallback for every invalid/absent/raw-injected input. */
const GENERIC_TERMINAL_ERROR: TurnTerminalError = Object.freeze({
  ...TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED,
});

/** Only these own keys may appear on a validated envelope. */
const ALLOWED_ENVELOPE_KEYS: ReadonlyArray<string> = Object.freeze([
  'kind',
  'code',
  'message',
  'recoverable',
  'diagnosticId',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Validate one terminal-error candidate and ALWAYS return a safe envelope:
 * the matching catalog row reconstructed field-by-field for valid input, or
 * the GENERIC safe catalog entry for anything else. Unknown fields are never
 * copied; display text is never derived from the raw value.
 */
export function validateTurnTerminalError(raw: unknown): TurnTerminalError {
  if (!isPlainObject(raw)) return GENERIC_TERMINAL_ERROR;

  // Extra own keys (raw-injected payloads) reject the whole envelope — the
  // result is the generic row, so no unknown field can survive anywhere.
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_ENVELOPE_KEYS.includes(key)) return GENERIC_TERMINAL_ERROR;
  }

  const code = raw.code;
  if (typeof code !== 'string') return GENERIC_TERMINAL_ERROR;
  const row = (TURN_TERMINAL_ERROR_CATALOG as Record<string, unknown>)[code] as
    | Omit<TurnTerminalError, 'diagnosticId'>
    | undefined;
  if (!row) return GENERIC_TERMINAL_ERROR;

  // kind/code/message/recoverable must all agree with that single row — a
  // catalog message under the wrong code is invalid, never re-paired here.
  if (raw.kind !== row.kind) return GENERIC_TERMINAL_ERROR;
  if (raw.message !== row.message) return GENERIC_TERMINAL_ERROR;
  if (raw.recoverable !== true) return GENERIC_TERMINAL_ERROR;

  const validated: TurnTerminalError = {
    kind: row.kind,
    code: row.code,
    message: row.message,
    recoverable: true,
  };

  // Optional opaque lookup reference. Absent stays absent (never null); a
  // present-but-invalid id rejects the whole envelope, like every other key.
  if (raw.diagnosticId !== undefined) {
    const diagnosticId = raw.diagnosticId;
    if (!isValidDiagnosticId(diagnosticId)) {
      return GENERIC_TERMINAL_ERROR;
    }
    validated.diagnosticId = diagnosticId;
  }

  return validated;
}

/** Replace only a present terminalError value; preserve unrelated metadata. */
export function sanitizeTerminalErrorMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata || !Object.prototype.hasOwnProperty.call(metadata, 'terminalError')) {
    return metadata;
  }
  return {
    ...metadata,
    terminalError: validateTurnTerminalError(metadata.terminalError),
  };
}

/**
 * Client ingress boundary for every ordinary terminal-error carrier. The
 * returned frame is safe to route, buffer, cache, hydrate, and log: each
 * terminal envelope is reconstructed from the closed catalog before any
 * downstream consumer receives the object.
 */
export function sanitizeTerminalErrorsAtIngress(msg: WebSocketMessage): WebSocketMessage {
  let safeMessage = msg;
  if (Object.prototype.hasOwnProperty.call(safeMessage, 'terminalError')) {
    safeMessage = {
      ...safeMessage,
      terminalError: validateTurnTerminalError(safeMessage.terminalError),
    };
  }
  if (safeMessage.metadata !== undefined) {
    safeMessage = {
      ...safeMessage,
      metadata: sanitizeTerminalErrorMetadata(safeMessage.metadata),
    };
  }
  if (safeMessage.liveTurn) {
    safeMessage = {
      ...safeMessage,
      liveTurn: {
        ...safeMessage.liveTurn,
        terminalError: safeMessage.liveTurn.status === 'error'
          ? validateTurnTerminalError(safeMessage.liveTurn.terminalError)
          : null,
      },
    };
  }
  if (safeMessage.exchanges) {
    safeMessage = {
      ...safeMessage,
      exchanges: safeMessage.exchanges.map((exchange) => ({
        ...exchange,
        metadata: sanitizeTerminalErrorMetadata(exchange.metadata),
      })),
    };
  }
  return safeMessage;
}

/**
 * Read the terminal error a completed assistant message row presents.
 *
 * The immediate client-validated field wins for a just-finalized live or
 * terminal-snapshot row. Durable history falls back to the persisted metadata
 * field. A present candidate is always validated; invalid/raw input becomes
 * the generic catalog row. An absent candidate renders nothing. Because this
 * is the single mounting read, the immediate and durable sources never mount
 * together.
 */
export function readMessageTerminalError(
  message: Pick<Message, 'terminalError' | 'metadata'>,
): TurnTerminalError | null {
  if (message.terminalError !== undefined) {
    return validateTurnTerminalError(message.terminalError);
  }
  if (!message.metadata || !Object.prototype.hasOwnProperty.call(message.metadata, 'terminalError')) {
    return null;
  }
  return validateTurnTerminalError(message.metadata.terminalError);
}
