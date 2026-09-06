'use strict';

function createAgentProvenanceLedgerHandler() {
  return async function handleAgentProvenanceLedger(fact, context) {
    if (typeof context?.appendAgentFact !== 'function'
      || typeof context?.writeDiagnostic !== 'function') {
      throw new TypeError('agent provenance ledger capabilities are unavailable');
    }
    try {
      const result = await context.appendAgentFact(fact);
      if (result?.status === 'conflict') context.writeDiagnostic('agent_ledger_conflict');
      return result;
    } catch (error) {
      if (error?.code === 'agent_ledger_source_missing') {
        context.writeDiagnostic('agent_ledger_source_missing');
      } else {
        context.writeDiagnostic('agent_ledger_write_failed');
      }
      throw error;
    }
  };
}

module.exports = { createAgentProvenanceLedgerHandler };
