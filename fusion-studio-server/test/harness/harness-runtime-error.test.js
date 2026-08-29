/**
 * HarnessRuntimeError marker tests (RCC-0108 SPEC-03 Slice A / A1).
 *
 * Pins: the closed code union, fixed internal messages, genuine-marker vs
 * lookalike rejection, closed-shape candidate enforcement, and the fs-read
 * no-string-parsing guarantee over the module source.
 */

const fs = require('fs');
const path = require('path');

const {
  HarnessRuntimeError,
  isHarnessRuntimeError,
  HARNESS_RUNTIME_ERROR_CODES,
  HARNESS_RUNTIME_ERROR_MESSAGES,
  HARNESS_DIAGNOSTIC_CATEGORIES,
} = require('../../lib/harness/errors');

function validCandidateDraft(overrides = {}) {
  return {
    version: 1,
    harnessId: 'opencode',
    category: 'process_exit',
    hadRenderableOutput: true,
    hadToolCalls: false,
    truncatedFields: ['stderrExcerpt'],
    ...overrides,
  };
}

describe('HarnessRuntimeError closed code union', () => {
  it('exports exactly the three SPEC codes in a frozen list', () => {
    expect(HARNESS_RUNTIME_ERROR_CODES).toEqual([
      'HARNESS_AUTHENTICATION_FAILED',
      'HARNESS_MODEL_TIMEOUT',
      'HARNESS_PROCESS_EXIT',
    ]);
    expect(Object.isFrozen(HARNESS_RUNTIME_ERROR_CODES)).toBe(true);
  });

  test.each(HARNESS_RUNTIME_ERROR_CODES)('accepts %s and stamps the marker fields', (code) => {
    const err = new HarnessRuntimeError(code);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(code);
    expect(err.name).toBe('HarnessRuntimeError');
    expect(isHarnessRuntimeError(err)).toBe(true);
  });

  test.each(HARNESS_RUNTIME_ERROR_CODES)('%s carries its fixed internal message', (code) => {
    const err = new HarnessRuntimeError(code);
    expect(err.message).toBe(HARNESS_RUNTIME_ERROR_MESSAGES[code]);
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('exposes the frozen fixed message map', () => {
    expect(Object.isFrozen(HARNESS_RUNTIME_ERROR_MESSAGES)).toBe(true);
    expect(HARNESS_RUNTIME_ERROR_MESSAGES.HARNESS_AUTHENTICATION_FAILED)
      .toBe('Harness authentication failed');
    expect(HARNESS_RUNTIME_ERROR_MESSAGES.HARNESS_MODEL_TIMEOUT)
      .toBe('The model response timed out');
    expect(HARNESS_RUNTIME_ERROR_MESSAGES.HARNESS_PROCESS_EXIT)
      .toBe('The harness process ended before the response completed');
  });

  test.each([
    ['unknown upper-snake code', 'HARNESS_EXPLODED'],
    ['lowercase lookalike code', 'harness_authentication_failed'],
    ['numeric provider code', -32004],
    ['string provider code', '-32004'],
    ['empty code', ''],
    ['undefined code', undefined],
    ['null code', null],
  ])('rejects %s at construction', (_label, badCode) => {
    expect(() => new HarnessRuntimeError(badCode)).toThrow(TypeError);
  });
});

describe('genuine-marker check rejects lookalikes', () => {
  test.each(HARNESS_RUNTIME_ERROR_CODES)('accepts only a real instance for %s', (code) => {
    expect(isHarnessRuntimeError(new HarnessRuntimeError(code))).toBe(true);
    expect(isHarnessRuntimeError(new HarnessRuntimeError(code, validCandidateDraft()))).toBe(true);
  });

  it('rejects a plain object shaped exactly like the marker', () => {
    const lookalike = {
      code: 'HARNESS_AUTHENTICATION_FAILED',
      name: 'HarnessRuntimeError',
      message: HARNESS_RUNTIME_ERROR_MESSAGES.HARNESS_AUTHENTICATION_FAILED,
      candidate: validCandidateDraft(),
    };
    expect(isHarnessRuntimeError(lookalike)).toBe(false);
  });

  it('rejects a foreign Error subclass carrying matching fields', () => {
    class ForeignAuthError extends Error {
      constructor() {
        super(HARNESS_RUNTIME_ERROR_MESSAGES.HARNESS_AUTHENTICATION_FAILED);
        this.name = 'HarnessRuntimeError';
        this.code = 'HARNESS_AUTHENTICATION_FAILED';
      }
    }
    expect(isHarnessRuntimeError(new ForeignAuthError())).toBe(false);
  });

  it('rejects a prototype-only lookalike that never ran this constructor', () => {
    const forged = Object.create(HarnessRuntimeError.prototype);
    forged.code = 'HARNESS_MODEL_TIMEOUT';
    forged.message = HARNESS_RUNTIME_ERROR_MESSAGES.HARNESS_MODEL_TIMEOUT;
    // instanceof alone would pass; the hidden brand must fail.
    expect(forged instanceof HarnessRuntimeError).toBe(true);
    expect(isHarnessRuntimeError(forged)).toBe(false);
  });

  it('rejects non-error values entirely', () => {
    expect(isHarnessRuntimeError(null)).toBe(false);
    expect(isHarnessRuntimeError(undefined)).toBe(false);
    expect(isHarnessRuntimeError('HARNESS_PROCESS_EXIT')).toBe(false);
    expect(isHarnessRuntimeError({ code: 'HARNESS_PROCESS_EXIT' })).toBe(false);
    expect(isHarnessRuntimeError(new Error('The model response timed out'))).toBe(false);
  });

  it('the brand never leaks into serialization or enumeration', () => {
    const err = new HarnessRuntimeError('HARNESS_PROCESS_EXIT');
    expect(Object.keys(err)).not.toContain('Symbol');
    expect(JSON.parse(JSON.stringify({ ...err }))).not.toHaveProperty('brand');
    for (const key of Object.getOwnPropertyNames(err)) {
      expect(['stack', 'message', 'name', 'code', 'candidate']).toContain(key);
    }
  });
});

describe('closed candidate shape enforcement', () => {
  it('keeps exactly the closed V1 field set for a valid draft', () => {
    const err = new HarnessRuntimeError('HARNESS_PROCESS_EXIT', validCandidateDraft({
      modelId: 'kimi-for-coding/k2p7',
      exitCode: 1,
      signal: 'SIGTERM',
      stderrExcerpt: 'redacted tail',
    }));
    expect(err.candidate).toBeTruthy();
    expect(Object.keys(err.candidate).sort()).toEqual([
      'category',
      'exitCode',
      'hadRenderableOutput',
      'hadToolCalls',
      'harnessId',
      'modelId',
      'signal',
      'stderrExcerpt',
      'truncatedFields',
      'version',
    ]);
  });

  it('discards unknown keys instead of copying them', () => {
    const err = new HarnessRuntimeError('HARNESS_PROCESS_EXIT', validCandidateDraft({
      stack: 'secret-stack',
      raw: { nested: true },
      promptText: 'user prompt content',
    }));
    expect(err.candidate).toBeTruthy();
    expect(JSON.stringify(err.candidate)).not.toContain('secret-stack');
    expect(JSON.stringify(err.candidate)).not.toContain('promptText');
    expect(err.candidate.raw).toBeUndefined();
  });

  it('drops invalid optional values while keeping valid siblings', () => {
    const err = new HarnessRuntimeError('HARNESS_PROCESS_EXIT', validCandidateDraft({
      modelId: 42,
      providerCode: {},
      errorName: '',
      signal: ['SIGKILL'],
      message: null,
      stderrExcerpt: true,
      lastCanonicalEventType: NaN,
      exitCode: '1',
    }));
    for (const field of ['modelId', 'providerCode', 'errorName', 'signal', 'message', 'stderrExcerpt', 'lastCanonicalEventType']) {
      expect(err.candidate[field]).toBeUndefined();
    }
    expect(err.candidate.exitCode).toBeUndefined();
    expect(err.candidate.harnessId).toBe('opencode');
  });

  test.each([
    ['missing version', { version: undefined }],
    ['wrong version', { version: 2 }],
    ['missing harnessId', { harnessId: undefined }],
    ['non-string harnessId', { harnessId: 7 }],
    ['unknown category', { category: 'mystery' }],
    ['non-boolean hadRenderableOutput', { hadRenderableOutput: 'yes' }],
    ['non-boolean hadToolCalls', { hadToolCalls: 1 }],
    ['non-array truncatedFields', { truncatedFields: 'message' }],
    ['non-string truncation markers', { truncatedFields: ['message', 3] }],
  ])('rejects a draft with %s by dropping the whole candidate', (_label, override) => {
    const err = new HarnessRuntimeError('HARNESS_PROCESS_EXIT', validCandidateDraft(override));
    expect(err.candidate).toBeUndefined();
  });

  it('rejects non-object drafts and accepts a null draft as no candidate', () => {
    expect(new HarnessRuntimeError('HARNESS_TIMEOUT_X' && 'HARNESS_MODEL_TIMEOUT', 'nope').candidate).toBeUndefined();
    expect(new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT', [1]).candidate).toBeUndefined();
    expect(new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT', null).candidate).toBeUndefined();
    expect(new HarnessRuntimeError('HARNESS_MODEL_TIMEOUT').candidate).toBeUndefined();
  });

  it('freezes the stored candidate so later mutation cannot widen it', () => {
    const err = new HarnessRuntimeError('HARNESS_PROCESS_EXIT', validCandidateDraft());
    expect(Object.isFrozen(err.candidate)).toBe(true);
    expect(Object.isFrozen(err.candidate.truncatedFields)).toBe(true);
  });

  it('documents the full category union used by validation', () => {
    expect(HARNESS_DIAGNOSTIC_CATEGORIES).toEqual([
      'authentication',
      'timeout',
      'process_exit',
      'runtime',
    ]);
  });
});

describe('no-string-parsing guarantee over the module source', () => {
  const sourcePath = path.join(__dirname, '..', '..', 'lib', 'harness', 'errors.js');
  let source;

  beforeAll(() => {
    source = fs.readFileSync(sourcePath, 'utf8');
  });

  it('contains no regex construction or matching APIs', () => {
    for (const forbidden of [
      'new RegExp',
      '.test(',
      '.exec(',
      '.match(',
      '.search(',
      'i.test',
      '/Authentication failed/',
      '/authentication failed/i',
    ]) {
      expect(source.includes(forbidden)).toBe(false);
    }
  });

  it('never case-folds or pattern-scans content for classification', () => {
    // Closed-list membership checks (Array.includes on frozen unions) are
    // structural validation; regex construction and case-folding scans over
    // error names/messages/codes are what this guarantee forbids.
    expect(source.includes('new RegExp')).toBe(false);
    expect(source.includes('toLowerCase')).toBe(false);
    expect(source.includes('toUpperCase')).toBe(false);
    expect(source.includes('.replace(')).toBe(false);
    expect(source.toLowerCase().includes('startswith')).toBe(false);
  });
});
