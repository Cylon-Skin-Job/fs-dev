'use strict';

describe('production file-provenance bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('seals exactly once, injects exact publishers into the durable owner, and leaves public imports non-minting', () => {
    const { bootstrapFileProvenanceAdmission } = require('../../lib/subscriptions/file-provenance-bootstrap');
    const registryAccess = { validatePayload: jest.fn(async () => ({ valid: true })) };
    const deliverAdmittedFact = jest.fn(async () => []);
    const writeDiagnostic = jest.fn();
    let installed = null;
    const fileSaveOwner = {
      verifyReservation: jest.fn(async () => { throw new Error('not exercised'); }),
      installPublishers: jest.fn((publishers) => { installed = publishers; }),
    };

    expect(bootstrapFileProvenanceAdmission({
      registryAccess, deliverAdmittedFact, writeDiagnostic, fileSaveOwner,
    })).toEqual({ sealed: true });
    expect(Object.keys(installed).sort()).toEqual([
      'publishFileCommandAccepted', 'publishResourceMutated',
    ]);
    expect(() => bootstrapFileProvenanceAdmission({
      registryAccess, deliverAdmittedFact, writeDiagnostic, fileSaveOwner,
    })).toThrow(/already sealed/);

    const publicBus = require('../../lib/event-bus');
    const publicSubscriptions = require('../../lib/subscriptions');
    expect(Object.keys(publicBus).sort()).toEqual(['bus', 'emit', 'on']);
    expect(publicSubscriptions.bootstrapGovernedEventBus).toBeUndefined();
    expect(publicSubscriptions.publishFileCommandAccepted).toBeUndefined();
    expect(publicSubscriptions.publishResourceMutated).toBeUndefined();
    expect(fileSaveOwner.installPublishers).toHaveBeenCalledTimes(1);
    expect(registryAccess.validatePayload).not.toHaveBeenCalled();
    expect(deliverAdmittedFact).not.toHaveBeenCalled();
  });
});
