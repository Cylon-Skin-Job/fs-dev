'use strict';

function createAgentResourceObserverHandler() {
  return function handleAgentResourceObserver(fact, context) {
    if (typeof context?.scheduleAgentObservation !== 'function'
      || typeof context?.writeDiagnostic !== 'function') {
      throw new TypeError('agent observation scheduling capability is unavailable');
    }
    try {
      return context.scheduleAgentObservation(fact);
    } catch (error) {
      context.writeDiagnostic('agent_observation_schedule_failed');
      throw error;
    }
  };
}

module.exports = { createAgentResourceObserverHandler };
