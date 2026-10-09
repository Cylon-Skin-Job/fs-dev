'use strict';

function createProvenanceLedgerHandler() {
  return async function handleResourceMutation(fact, context) {
    if (typeof context?.appendResourceFact !== 'function'
      || typeof context?.writeDiagnostic !== 'function') {
      throw new TypeError('provenance ledger capabilities are unavailable');
    }
    try {
      const result = await context.appendResourceFact(fact);
      if (result?.status === 'conflict') {
        context.writeDiagnostic('ledger_duplicate_conflict');
        throw new Error('resource ledger event conflicts with established truth');
      }
      if (!['stored', 'duplicate'].includes(result?.status)) {
        throw new Error('resource ledger append returned an invalid status');
      }
      return result;
    } catch (error) {
      if (error?.message !== 'resource ledger event conflicts with established truth') {
        try { context.writeDiagnostic('ledger_write_failed'); } catch (_diagnosticError) {}
      }
      throw error;
    }
  };
}

module.exports = { createProvenanceLedgerHandler };
