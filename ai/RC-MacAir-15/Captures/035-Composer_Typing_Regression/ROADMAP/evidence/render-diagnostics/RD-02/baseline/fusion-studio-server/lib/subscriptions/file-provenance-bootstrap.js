'use strict';

const { bootstrapGovernedEventBus } = require('./host-bootstrap');

function bootstrapFileProvenanceAdmission({
  registryAccess,
  deliverAdmittedFact,
  writeDiagnostic,
  fileSaveOwner,
  agentFactAuthority,
  agentFactAdmissionOwner,
  onAgentAdmissionCommitted,
}) {
  if (typeof fileSaveOwner?.verifyReservation !== 'function'
    || typeof fileSaveOwner?.installPublishers !== 'function') {
    throw new TypeError('durable file-save owner is required');
  }
  if (agentFactAuthority != null && (typeof agentFactAuthority?.verifyReservation !== 'function'
    || typeof agentFactAuthority?.commitVerifiedAdmission !== 'function')) {
    throw new TypeError('durable agent fact authority is required');
  }
  if (agentFactAdmissionOwner != null && typeof agentFactAdmissionOwner?.installPublishers !== 'function') {
    throw new TypeError('agent fact admission owner is required');
  }
  return bootstrapGovernedEventBus({
    registryAccess,
    deliverAdmittedFact,
    writeDiagnostic,
    verifyReservation: fileSaveOwner.verifyReservation,
    ...(agentFactAuthority ? {
      verifyAgentReservation: agentFactAuthority.verifyReservation,
      commitVerifiedAgentAdmission: agentFactAuthority.commitVerifiedAdmission,
    } : {}),
    installFileSavePublishers: fileSaveOwner.installPublishers,
    ...(agentFactAdmissionOwner ? {
      installAgentPublishers: agentFactAdmissionOwner.installPublishers,
    } : {}),
    onAgentAdmissionCommitted,
    onAgentAdmissionRejected: agentFactAdmissionOwner?.recordPublisherRejection,
    isAgentAdmissionCurrent: agentFactAdmissionOwner?.isAccepting,
  });
}

module.exports = { bootstrapFileProvenanceAdmission };
