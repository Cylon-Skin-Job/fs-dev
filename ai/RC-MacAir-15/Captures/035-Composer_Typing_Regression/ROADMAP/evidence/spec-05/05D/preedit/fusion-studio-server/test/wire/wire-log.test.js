'use strict';

jest.mock('fs', () => ({
  appendFileSync: jest.fn(),
  renameSync: jest.fn(),
  statSync: jest.fn(() => ({ size: 0 })),
  unlinkSync: jest.fn(),
}));

const fs = require('fs');
const { logWire } = require('../../lib/wire/wire-log');

describe('wire diagnostic logging', () => {
  beforeEach(() => jest.clearAllMocks());

  test('suppresses the entire raw frame and bounds the direction', () => {
    const canary = 'PROMPT_PROOF_NONCE_CANARY_00B';
    logWire('WIRE_IN', JSON.stringify({ payload: canary }));
    logWire(canary, canary);

    const entries = fs.appendFileSync.mock.calls.map((call) => call[1]).join('');
    expect(entries).not.toContain(canary);
    expect(entries).toMatch(/WIRE_IN: \[redacted\]/);
    expect(entries).toMatch(/WIRE_EVENT: \[redacted\]/);
  });
});
