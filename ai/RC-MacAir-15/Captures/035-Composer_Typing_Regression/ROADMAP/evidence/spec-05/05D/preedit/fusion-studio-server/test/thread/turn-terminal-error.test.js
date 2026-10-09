'use strict';

/**
 * TurnTerminalError catalog + validator tests (RCC-0108 SPEC-03 Slice B).
 *
 * Pins parent §4.13's NORMATIVE catalog table exactly (kind/code/message/
 * recoverable per row), marker→row mapping, hostile-input immunity of
 * reconstruction, and every validator rejection surface.
 */

const {
  TERMINAL_ERROR_REASON,
  MAX_DIAGNOSTIC_ID_LENGTH,
  TURN_TERMINAL_ERROR_CODES,
  TURN_TERMINAL_ERROR_KINDS,
  TURN_TERMINAL_ERROR_CATALOG,
  normalizeTurnTerminalError,
  validateTurnTerminalError,
  resolveTerminalErrorForReason,
} = require('../../lib/thread/turn-terminal-error');
const {
  HarnessRuntimeError,
} = require('../../lib/harness/errors');

const HOSTILE_TEXT = 'HOSTILE raw provider stack /tmp/secrets stderr tail';

describe('turn-terminal-error catalog reconstruction (SPEC-03 Slice B)', () => {
  test('every catalog row carries the exact normative kind/code/message/recoverable', () => {
    expect(TURN_TERMINAL_ERROR_CODES).toEqual([
      'AUTHENTICATION_FAILED',
      'MODEL_TIMEOUT',
      'HARNESS_EXITED',
      'MODEL_RESPONSE_FAILED',
    ]);
    expect(TURN_TERMINAL_ERROR_KINDS).toEqual(['runtime', 'authentication']);

    expect(TURN_TERMINAL_ERROR_CATALOG.AUTHENTICATION_FAILED).toEqual({
      kind: 'authentication',
      code: 'AUTHENTICATION_FAILED',
      message: 'Authentication failed. Check the configured harness credentials and try again.',
      recoverable: true,
    });
    expect(TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT).toEqual({
      kind: 'runtime',
      code: 'MODEL_TIMEOUT',
      message: 'The model response timed out before it completed.',
      recoverable: true,
    });
    expect(TURN_TERMINAL_ERROR_CATALOG.HARNESS_EXITED).toEqual({
      kind: 'runtime',
      code: 'HARNESS_EXITED',
      message: 'The model process ended before the response completed.',
      recoverable: true,
    });
    expect(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED).toEqual({
      kind: 'runtime',
      code: 'MODEL_RESPONSE_FAILED',
      message: 'The model response failed before it completed.',
      recoverable: true,
    });

    // Catalog messages are fixed constants ≤300 Unicode code points.
    for (const row of Object.values(TURN_TERMINAL_ERROR_CATALOG)) {
      expect([...row.message].length).toBeLessThanOrEqual(300);
    }
  });

  test.each([
    ['HARNESS_AUTHENTICATION_FAILED', 'AUTHENTICATION_FAILED'],
    ['HARNESS_MODEL_TIMEOUT', 'MODEL_TIMEOUT'],
    ['HARNESS_PROCESS_EXIT', 'HARNESS_EXITED'],
  ])('genuine marker %s normalizes to catalog row %s', (markerCode, expectedCode) => {
    const envelope = normalizeTurnTerminalError(new HarnessRuntimeError(markerCode));
    expect(envelope).toEqual(TURN_TERMINAL_ERROR_CATALOG[expectedCode]);
  });

  test('unknown fallback: any non-marker value yields MODEL_RESPONSE_FAILED', () => {
    const lookalike = new Error(HOSTILE_TEXT);
    lookalike.code = -32004;
    const inputs = [
      undefined,
      null,
      'HARNESS_MODEL_TIMEOUT', // string lookalike
      lookalike,
      { code: 'HARNESS_PROCESS_EXIT' }, // plain-object shape mimic
      new TypeError('auth exploded'),
    ];
    for (const input of inputs) {
      expect(normalizeTurnTerminalError(input)).toEqual(
        TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED
      );
    }
  });

  test('reconstruction ignores input text — a mutated marker still yields fixed catalog text', () => {
    const marker = new HarnessRuntimeError('HARNESS_AUTHENTICATION_FAILED');
    marker.message = HOSTILE_TEXT; // simulate post-construction tampering
    marker.candidate = { version: 1, stderrExcerpt: 'not-even-a-real-candidate' };

    const envelope = normalizeTurnTerminalError(marker);
    expect(envelope).toEqual(TURN_TERMINAL_ERROR_CATALOG.AUTHENTICATION_FAILED);
    expect(JSON.stringify(envelope)).not.toContain('HOSTILE');
    expect(envelope).not.toHaveProperty('candidate');
    // Fields are copied from the catalog constants — never spread from input.
    expect(Object.isFrozen(envelope)).toBe(true);
  });
});

describe('validateTurnTerminalError strict safe-envelope validation', () => {
  function envelopeFor(code, extra = {}) {
    return { ...TURN_TERMINAL_ERROR_CATALOG[code], ...extra };
  }

  test('accepts exact envelopes for all four codes and freezes the copy', () => {
    for (const code of TURN_TERMINAL_ERROR_CODES) {
      const validated = validateTurnTerminalError(envelopeFor(code));
      expect(validated).toEqual(TURN_TERMINAL_ERROR_CATALOG[code]);
      expect(Object.isFrozen(validated)).toBe(true);
    }
  });

  test('accepts an optional bounded diagnosticId and preserves it opaquely', () => {
    const withId = envelopeFor('MODEL_TIMEOUT', { diagnosticId: 'b3f1c9d2-uuid-opaque' });
    expect(validateTurnTerminalError(withId)).toEqual(withId);
    expect(validateTurnTerminalError(
      envelopeFor('MODEL_TIMEOUT', { diagnosticId: 'x'.repeat(MAX_DIAGNOSTIC_ID_LENGTH) })
    )).not.toBeNull();
  });

  test.each([
    ['null value', null],
    ['undefined value', undefined],
    ['a string', 'MODEL_TIMEOUT'],
    ['an array', [TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT]],
    ['a class instance', new (class Envelope {})()],
  ])('rejects %s as a non-plain-object envelope', (_label, value) => {
    expect(validateTurnTerminalError(value)).toBeNull();
  });

  test('rejects each violated field on an otherwise-exact envelope', () => {
    // wrong kind union member
    expect(validateTurnTerminalError({ ...envelopeFor('MODEL_TIMEOUT'), kind: 'network' })).toBeNull();
    // missing kind
    const noKind = envelopeFor('MODEL_TIMEOUT');
    delete noKind.kind;
    expect(validateTurnTerminalError(noKind)).toBeNull();
    // unknown code (arbitrary provider/marker passthrough)
    expect(validateTurnTerminalError({ ...envelopeFor('MODEL_TIMEOUT'), code: 'HARNESS_MODEL_TIMEOUT' })).toBeNull();
    expect(validateTurnTerminalError({ ...envelopeFor('MODEL_TIMEOUT'), code: -32004 })).toBeNull();
    // missing code
    const noCode = envelopeFor('MODEL_TIMEOUT');
    delete noCode.code;
    expect(validateTurnTerminalError(noCode)).toBeNull();
    // recoverable not exactly true
    expect(validateTurnTerminalError({ ...envelopeFor('MODEL_TIMEOUT'), recoverable: false })).toBeNull();
    expect(validateTurnTerminalError({ ...envelopeFor('MODEL_TIMEOUT'), recoverable: 'true' })).toBeNull();
    // missing message
    const noMessage = envelopeFor('MODEL_TIMEOUT');
    delete noMessage.message;
    expect(validateTurnTerminalError(noMessage)).toBeNull();
  });

  test('rejects wrong-code message pairing (message must equal ITS OWN row)', () => {
    expect(validateTurnTerminalError({
      ...envelopeFor('MODEL_TIMEOUT'),
      message: TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED.message,
    })).toBeNull();
    expect(validateTurnTerminalError({
      ...envelopeFor('AUTHENTICATION_FAILED'),
      message: TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT.message,
    })).toBeNull();
    // kind/code mismatch across rows is equally invalid
    expect(validateTurnTerminalError({
      ...envelopeFor('AUTHENTICATION_FAILED'),
      kind: 'runtime',
    })).toBeNull();
  });

  test('rejects interpolated or edited messages even when code/kind agree', () => {
    expect(validateTurnTerminalError({
      ...envelopeFor('MODEL_TIMEOUT'),
      message: `${TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT.message} (provider said: ${HOSTILE_TEXT})`,
    })).toBeNull();
  });

  test('rejects ANY extra own enumerable key', () => {
    expect(validateTurnTerminalError({
      ...envelopeFor('MODEL_TIMEOUT'),
      stack: HOSTILE_TEXT,
    })).toBeNull();
    expect(validateTurnTerminalError({
      ...envelopeFor('MODEL_TIMEOUT'),
      candidate: { version: 1 },
    })).toBeNull();
    expect(validateTurnTerminalError({
      ...envelopeFor('MODEL_TIMEOUT'),
      cause: 'raw provider object',
    })).toBeNull();
  });

  test('rejects oversized, empty, and non-string diagnosticId', () => {
    expect(validateTurnTerminalError(
      envelopeFor('MODEL_TIMEOUT', { diagnosticId: 'x'.repeat(MAX_DIAGNOSTIC_ID_LENGTH + 1) })
    )).toBeNull();
    expect(validateTurnTerminalError(envelopeFor('MODEL_TIMEOUT', { diagnosticId: '' }))).toBeNull();
    expect(validateTurnTerminalError(envelopeFor('MODEL_TIMEOUT', { diagnosticId: 42 }))).toBeNull();
  });
});

describe('reason gating (envelope attaches ONLY to reason error)', () => {
  const VALID = TURN_TERMINAL_ERROR_CATALOG.HARNESS_EXITED;

  test('error reason returns the validated envelope', () => {
    expect(resolveTerminalErrorForReason('error', { ...VALID })).toEqual(VALID);
    expect(resolveTerminalErrorForReason('error', undefined)).toBeNull();
    expect(resolveTerminalErrorForReason('error', { ...VALID, extra: true })).toBeNull();
  });

  test('normal and interrupted reasons NEVER carry an envelope — hostile payloads are forced null', () => {
    for (const reason of ['complete', 'interrupted', undefined]) {
      expect(resolveTerminalErrorForReason(reason, { ...VALID })).toBeNull();
      expect(resolveTerminalErrorForReason(reason, undefined)).toBeNull();
    }
  });

  test('the pinned terminal error reason constant is "error"', () => {
    expect(TERMINAL_ERROR_REASON).toBe('error');
  });
});
