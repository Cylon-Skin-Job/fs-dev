'use strict';

const { createProvenanceLedgerHandler } = require('../../lib/ledger/provenance-ledger-handler');

describe('provenance ledger governed handler', () => {
  const fact = Object.freeze({ eventId: 'event-1' });

  test.each(['stored', 'duplicate'])('accepts %s append idempotently', async (status) => {
    const appendResourceFact = jest.fn(async () => ({ status, eventId: 'event-1' }));
    const writeDiagnostic = jest.fn();
    await expect(createProvenanceLedgerHandler()(fact, {
      appendResourceFact, writeDiagnostic,
    })).resolves.toEqual({ status, eventId: 'event-1' });
    expect(appendResourceFact).toHaveBeenCalledWith(fact);
    expect(writeDiagnostic).not.toHaveBeenCalled();
  });

  test('diagnoses a conflicting duplicate and fails required acknowledgement', async () => {
    const writeDiagnostic = jest.fn();
    await expect(createProvenanceLedgerHandler()(fact, {
      appendResourceFact: async () => ({ status: 'conflict', eventId: 'event-1' }),
      writeDiagnostic,
    })).rejects.toThrow(/conflicts with established truth/);
    expect(writeDiagnostic).toHaveBeenCalledTimes(1);
    expect(writeDiagnostic).toHaveBeenCalledWith('ledger_duplicate_conflict');
  });

  test('diagnoses storage failure without leaking its error through the capability', async () => {
    const writeDiagnostic = jest.fn();
    const failure = new Error('SQL secret');
    await expect(createProvenanceLedgerHandler()(fact, {
      appendResourceFact: async () => { throw failure; },
      writeDiagnostic,
    })).rejects.toBe(failure);
    expect(writeDiagnostic).toHaveBeenCalledWith('ledger_write_failed');
  });
});
