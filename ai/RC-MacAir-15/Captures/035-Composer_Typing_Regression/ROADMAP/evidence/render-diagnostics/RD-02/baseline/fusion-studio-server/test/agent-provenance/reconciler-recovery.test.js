'use strict';

const { createAgentFactAdmissionReconciler } = require('../../lib/agent-provenance/fact-admission-reconciler');
const { createAgentLedgerReconciler } = require('../../lib/agent-provenance/agent-ledger-reconciler');

function immediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('agent fact/ledger reconciler suppression, serialization, and shutdown', () => {
  test('operational publisher failure suppresses honestly pending source without semantic conflict', async () => {
    const reservation = Object.freeze(Object.create(null));
    const source = { kind: 'tool', key: 'tool:event-1', eventId: 'event-1' };
    const authority = {
      listPending: jest.fn(async ({ excludedKeys }) => (
        excludedKeys.includes(source.key) ? [] : [source]
      )),
      createPublishInput: jest.fn(async () => ({ reservation, body: {} })),
      markConflict: jest.fn(),
    };
    const diagnostics = [];
    const owner = createAgentFactAdmissionReconciler({
      authority, writeDiagnostic: (code) => diagnostics.push(code),
    });
    owner.installPublishers({
      publishAgentToolCompleted: async () => {
        owner.recordPublisherRejection(reservation, 'operational', false);
        return { admitted: false };
      },
      publishResourceStateObserved: async () => ({ admitted: true }),
    });
    await owner._drain();
    expect(authority.markConflict).not.toHaveBeenCalled();
    expect(owner._suppressed).toContain(source.key);
    expect(diagnostics).toEqual(['agent_fact_admission_failed']);
    await owner.shutdown();
  });

  test('first retryable admission exhaustion stops the batch and yields later eligible work', async () => {
    const sources = [
      { kind: 'tool', key: 'tool:event-first', eventId: 'event-first' },
      { kind: 'tool', key: 'tool:event-second', eventId: 'event-second' },
    ];
    const reservation = Object.freeze(Object.create(null));
    const authority = {
      listPending: jest.fn(async ({ excludedKeys }) => sources.filter(
        (source) => !excludedKeys.includes(source.key),
      ).slice(0, 1)),
      createPublishInput: jest.fn(async (_kind, eventId) => {
        if (eventId === 'event-first') {
          const error = new Error('busy');
          error.code = 'agent_fact_admission_transition_failed';
          throw error;
        }
        sources.splice(sources.findIndex((source) => source.eventId === eventId), 1);
        return { reservation, body: {} };
      }),
      markConflict: jest.fn(),
    };
    const publish = jest.fn(async () => ({ admitted: true }));
    const owner = createAgentFactAdmissionReconciler({ authority });
    owner.installPublishers({
      publishAgentToolCompleted: publish,
      publishResourceStateObserved: jest.fn(),
    });

    await expect(owner.start()).resolves.toEqual({ dispositions: 1, remaining: true });
    expect(publish).not.toHaveBeenCalled();
    await immediate();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(authority.createPublishInput.mock.calls.map(([, eventId]) => eventId))
      .toEqual(['event-first', 'event-second']);
    await owner.shutdown();
  });

  test('shutdown waits for selected admission work and prevents its post-await publication', async () => {
    let releaseSelection;
    const selection = new Promise((resolve) => { releaseSelection = resolve; });
    const authority = {
      listPending: jest.fn(() => selection),
      createPublishInput: jest.fn(),
      markConflict: jest.fn(),
    };
    const owner = createAgentFactAdmissionReconciler({ authority });
    owner.installPublishers({
      publishAgentToolCompleted: jest.fn(),
      publishResourceStateObserved: jest.fn(),
    });
    const drain = owner.start();
    await immediate();
    let settled = false;
    const shutdown = owner.shutdown().then((drained) => { settled = true; return drained; });
    await immediate();
    expect(settled).toBe(false);
    releaseSelection([{ kind: 'tool', key: 'tool:event-1', eventId: 'event-1' }]);
    const [, drained] = await Promise.all([drain, shutdown]);
    expect(drained).toBe(true);
    expect(authority.createPublishInput).not.toHaveBeenCalled();
  });

  test('a retryable admission failure settling after shutdown cannot arm a timer', async () => {
    let rejectInput;
    let selected = false;
    const authority = {
      listPending: jest.fn(async () => {
        if (selected) return [];
        selected = true;
        return [{ kind: 'tool', key: 'tool:event-late', eventId: 'event-late' }];
      }),
      createPublishInput: jest.fn(() => new Promise((_resolve, reject) => { rejectInput = reject; })),
      markConflict: jest.fn(),
    };
    const setTimer = jest.fn(() => ({ unref() {} }));
    const owner = createAgentFactAdmissionReconciler({ authority, setTimer, clearTimer: jest.fn() });
    owner.installPublishers({
      publishAgentToolCompleted: jest.fn(),
      publishResourceStateObserved: jest.fn(),
    });
    const startup = owner.start();
    await immediate();
    expect(authority.createPublishInput).toHaveBeenCalledTimes(1);
    await owner.shutdown({ timeoutMs: 0 });
    const error = new Error('busy');
    error.code = 'agent_fact_admission_transition_failed';
    rejectInput(error);
    await startup;
    expect(owner._delayed.size).toBe(0);
    expect(setTimer).not.toHaveBeenCalled();
  });

  test('ledger owner reports a local timeout while serialized selection remains unsettled', async () => {
    let releaseSelection;
    const selection = new Promise((resolve) => { releaseSelection = resolve; });
    const repository = {
      listCandidates: jest.fn(() => selection),
      nextWake: jest.fn(async () => null),
      claim: jest.fn(),
      appendClaimed: jest.fn(),
    };
    const owner = createAgentLedgerReconciler({
      repository,
      setTimer: (callback) => {
        callback();
        return { unref() {} };
      },
      clearTimer: () => {},
    });
    const startup = owner.start();
    await immediate();

    await expect(owner.shutdown()).resolves.toBe(false);
    releaseSelection([]);
    await startup;
  });

  test('defers 101st admission and ledger dispositions until continuations are enabled', async () => {
    let admitted = 0;
    const admission = createAgentFactAdmissionReconciler({
      authority: {
        listPending: jest.fn(async () => (admitted < 101 ? [{
          kind: 'tool', key: `tool:event-${admitted}`, eventId: `event-${admitted}`,
        }] : [])),
        createPublishInput: jest.fn(async (source) => ({ reservation: source, body: {} })),
        markConflict: jest.fn(),
      },
      monotonicNow: () => 0,
    });
    admission.installPublishers({
      publishAgentToolCompleted: jest.fn(async () => { admitted += 1; return { admitted: true }; }),
      publishResourceStateObserved: jest.fn(),
    });
    await expect(admission.start({ deferContinuations: true })).resolves.toEqual({
      dispositions: 100, remaining: true,
    });
    await immediate();
    expect(admitted).toBe(100);
    admission.enableContinuations();
    for (let attempt = 0; attempt < 5 && admitted < 101; attempt += 1) await immediate();
    expect(admitted).toBe(101);
    await admission.shutdown();

    let projected = 0;
    const ledger = createAgentLedgerReconciler({
      repository: {
        listCandidates: jest.fn(async () => (projected < 101 ? [{
          kind: 'tool', key: `tool:event-${projected}`, eventId: `event-${projected}`,
          state: 'pending',
        }] : [])),
        claim: jest.fn(async (candidate) => ({
          ...candidate, claimToken: `claim-${projected}`, attempt: 1, fact: {},
        })),
        appendClaimed: jest.fn(async () => { projected += 1; return { status: 'stored' }; }),
        nextWake: jest.fn(async () => null),
      },
      monotonicNow: () => 0,
    });
    await expect(ledger.start({ deferContinuations: true })).resolves.toEqual({
      dispositions: 100, remaining: true,
    });
    await immediate();
    expect(projected).toBe(100);
    ledger.enableContinuations();
    for (let attempt = 0; attempt < 5 && projected < 101; attempt += 1) await immediate();
    expect(projected).toBe(101);
    await ledger.shutdown();
  });

  test('retries the exact failed running transition at +1000ms and suppresses nonretryable errors immediately', async () => {
    let clock = 0;
    let mode = 'retryable';
    let recovered = false;
    const candidate = {
      kind: 'tool', key: 'claim:claim-1', eventId: 'event-1', state: 'running',
      claimToken: 'claim-1', attempt: 1,
    };
    const repository = {
      claim: jest.fn(), appendClaimed: jest.fn(), claimFact: jest.fn(), nextWake: jest.fn(async () => null),
      listCandidates: jest.fn(async ({ excludedKeys }) => (
        recovered || excludedKeys.includes(candidate.key) ? [] : [candidate]
      )),
      recover: jest.fn(async () => {
        if (mode === 'retryable') {
          mode = 'success';
          const error = new Error('busy'); error.code = 'agent_ledger_transition_failed'; throw error;
        }
        if (mode === 'nonretryable') {
          const error = new Error('io'); error.code = 'SQLITE_IOERR'; throw error;
        }
        recovered = true;
        return true;
      }),
      settleFailure: jest.fn(),
    };
    const diagnostics = [];
    const owner = createAgentLedgerReconciler({
      repository, now: () => clock, writeDiagnostic: (code) => diagnostics.push(code),
      setTimer: () => ({ unref() {} }), clearTimer: () => {},
    });
    await owner._drain();
    expect(repository.recover).toHaveBeenCalledTimes(1);
    clock = 999; await owner._drain();
    expect(repository.recover).toHaveBeenCalledTimes(1);
    clock = 1_000; await owner._drain();
    expect(repository.recover).toHaveBeenCalledTimes(2);

    mode = 'nonretryable';
    recovered = false;
    const second = { ...candidate, key: 'claim:claim-2', claimToken: 'claim-2', eventId: 'event-2' };
    repository.listCandidates.mockImplementation(async ({ excludedKeys }) => (
      excludedKeys.includes(second.key) ? [] : [second]
    ));
    await owner._drain();
    expect(owner._suppressed).toContain(second.key);
    expect(diagnostics).toContain('agent_ledger_transition_failed');
    await owner.shutdown();
  });

  test('serializes startup/background projection and live handler append through one lane', async () => {
    let releaseAppend;
    const gate = new Promise((resolve) => { releaseAppend = resolve; });
    let concurrent = 0;
    let maximum = 0;
    let selections = 0;
    const repository = {
      listCandidates: jest.fn(async () => (selections++ === 0
        ? [{ kind: 'tool', key: 'tool:event-1', eventId: 'event-1', state: 'pending' }]
        : [])),
      nextWake: jest.fn(async () => null),
      claim: jest.fn(async () => ({ kind: 'tool', eventId: 'event-1', claimToken: 'claim-1', attempt: 1, fact: {} })),
      claimFact: jest.fn(async () => ({ kind: 'tool', eventId: 'event-2', claimToken: 'claim-2', attempt: 1, fact: {} })),
      appendClaimed: jest.fn(async () => {
        concurrent += 1; maximum = Math.max(maximum, concurrent);
        await gate;
        concurrent -= 1;
        return { status: 'stored' };
      }),
      recover: jest.fn(), settleFailure: jest.fn(),
    };
    const owner = createAgentLedgerReconciler({ repository });
    const startup = owner.start();
    await immediate();
    const live = owner.appendAgentFact({ eventType: 'agent.tool_completed', eventId: 'event-2' });
    await immediate();
    expect(repository.appendClaimed).toHaveBeenCalledTimes(1);
    releaseAppend();
    await Promise.all([startup, live]);
    expect(maximum).toBe(1);
    expect(repository.appendClaimed).toHaveBeenCalledTimes(2);
    await owner.shutdown();
  });

  test('emits terminal contention diagnostics when the exact delayed settlement succeeds', async () => {
    let clock = 0;
    let claimed = false;
    let settlementAttempts = 0;
    const candidate = {
      kind: 'tool', key: 'tool:event-3', eventId: 'event-3', state: 'pending', attempt: 2,
    };
    const repository = {
      listCandidates: jest.fn(async () => (claimed ? [] : [candidate])),
      nextWake: jest.fn(async () => null),
      claim: jest.fn(async () => {
        claimed = true;
        return { kind: 'tool', eventId: 'event-3', claimToken: 'claim-3', attempt: 3, fact: {} };
      }),
      appendClaimed: jest.fn(async () => {
        const error = new Error('busy'); error.code = 'SQLITE_BUSY'; throw error;
      }),
      settleFailure: jest.fn(async () => {
        settlementAttempts += 1;
        if (settlementAttempts === 1) {
          const error = new Error('transition busy');
          error.code = 'agent_ledger_transition_failed';
          throw error;
        }
        return { status: 'failed' };
      }),
      recover: jest.fn(), claimFact: jest.fn(),
    };
    const diagnostics = [];
    const owner = createAgentLedgerReconciler({
      repository,
      now: () => clock,
      writeDiagnostic: (code) => diagnostics.push(code),
      setTimer: () => ({ unref() {} }),
      clearTimer: () => {},
    });

    await owner._drain();
    expect(settlementAttempts).toBe(1);
    expect(diagnostics).not.toContain('agent_tool_ledger_contention');
    clock = 1_000;
    await owner._drain();
    expect(settlementAttempts).toBe(2);
    expect(diagnostics).toContain('agent_tool_ledger_contention');
    await owner.shutdown();
  });

  test('a terminal projection failure emits only its write diagnostic when failure settlement succeeds', async () => {
    let selected = false;
    const candidate = {
      kind: 'tool', key: 'tool:event-terminal', eventId: 'event-terminal', state: 'pending', attempt: 0,
    };
    const repository = {
      listCandidates: jest.fn(async () => {
        if (selected) return [];
        selected = true;
        return [candidate];
      }),
      nextWake: jest.fn(async () => null),
      claim: jest.fn(async () => ({
        kind: 'tool', eventId: candidate.eventId, claimToken: 'claim-terminal', attempt: 1, fact: {},
      })),
      appendClaimed: jest.fn(async () => {
        const error = new Error('disk io failed');
        error.code = 'SQLITE_IOERR';
        throw error;
      }),
      settleFailure: jest.fn(async () => ({ status: 'failed' })),
      recover: jest.fn(),
      claimFact: jest.fn(),
    };
    const diagnostics = [];
    const owner = createAgentLedgerReconciler({
      repository,
      writeDiagnostic: (code) => diagnostics.push(code),
    });

    await owner._drain();

    expect(repository.settleFailure).toHaveBeenCalledWith(
      expect.objectContaining({ claimToken: 'claim-terminal' }),
      expect.any(Number),
      { terminal: true },
    );
    expect(diagnostics).toEqual(['agent_ledger_write_failed']);
    expect([...owner._suppressed]).toEqual([]);
    await owner.shutdown();
  });
});
