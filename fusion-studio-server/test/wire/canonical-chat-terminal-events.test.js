'use strict';

/**
 * CanonicalChatTerminalEvents — direct handler pins (RCC-0108 SPEC-03
 * Slice B). The applier suite covers error terminals through the public
 * applyChatEvent path; this suite pins handleTurnEnd's OWN contract in
 * isolation:
 *   - an error terminal ALWAYS carries a valid catalog envelope (absent or
 *     hostile payloads substitute the generic MODEL_RESPONSE_FAILED row);
 *   - normal/interrupted terminals force null envelopes;
 *   - the published envelope/seq/revision come from the SAME post-terminalize
 *     clone (published seq === retained snapshot seq);
 *   - duplicate/stale error terminals stay idempotent drops.
 */

const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const {
  TURN_TERMINAL_ERROR_CATALOG,
  normalizeTurnTerminalError,
} = require('../../lib/thread/turn-terminal-error');
const {
  createCanonicalChatTerminalEvents,
} = require('../../lib/wire/canonical-chat-terminal-events');
const {
  createCanonicalDrainControl,
  createCanonicalRouteContext,
} = require('../../lib/thread/canonical-drain-context');

const HOSTILE = 'HOSTILE raw provider stack stderr';

describe('CanonicalChatTerminalEvents handleTurnEnd — envelope rules (SPEC-03 Slice B)', () => {
  let emitted;
  let handlers;

  const RUNTIME_KEY = { workspaceId: 'code', scope: 'project', threadId: 'thread-term' };

  function makeRoute() {
    return createCanonicalRouteContext({
      workspaceId: 'code',
      workspace: 'workspace:code',
      projectRoot: '/tmp/project',
      scope: 'project',
      threadId: 'thread-term',
      acceptedUserInput: 'Hello AI',
      attachments: [],
    });
  }

  /** Claim + begin + bind one live turn, exactly like bridge composition. */
  function claimAndBegin(drainId) {
    const control = createCanonicalDrainControl({
      drainId,
      runtimeKey: RUNTIME_KEY,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    });
    threadRuntimeManager.claimActiveDrain(RUNTIME_KEY, control, makeRoute());
    const result = threadRuntimeManager.beginCanonicalTurn(RUNTIME_KEY, drainId, {
      turnId: `turn-${drainId}`,
      userInput: 'Hello AI',
    });
    expect(result.accepted).toBe(true);
    expect(threadRuntimeManager.bindTurnToDrain(RUNTIME_KEY, drainId, result.turnId)).toBe(true);
    return control;
  }

  function endTurn(control, payload) {
    handlers.handleTurnEnd({
      payload,
      route: makeRoute(),
      control: { runtimeKey: RUNTIME_KEY, drainId: control.drainId },
    });
    return emitted[emitted.length - 1]?.payload;
  }

  beforeEach(() => {
    threadRuntimeManager.runtimes.clear();
    emitted = [];
    handlers = createCanonicalChatTerminalEvents({
      emit: (type, payload) => emitted.push({ type, payload }),
    });
  });

  test('a reason-error terminal retains a VALID supplied envelope on snapshot and emission', () => {
    const control = claimAndBegin('d-valid');
    const payload = endTurn(control, {
      reason: 'error',
      partial: true,
      terminalError: normalizeTurnTerminalError(
        new (require('../../lib/harness/errors').HarnessRuntimeError)('HARNESS_PROCESS_EXIT')
      ),
    });

    expect(payload.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.HARNESS_EXITED);
    expect(threadRuntimeManager.getLiveTurn(RUNTIME_KEY)).toMatchObject({
      status: 'error',
      terminalError: TURN_TERMINAL_ERROR_CATALOG.HARNESS_EXITED,
    });
  });

  test('an ABSENT envelope on an error terminal substitutes the generic row', () => {
    const control = claimAndBegin('d-absent');
    const payload = endTurn(control, { reason: 'error', partial: true });

    expect(payload.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
    expect(threadRuntimeManager.getLiveTurn(RUNTIME_KEY).terminalError)
      .toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
  });

  test('a HOSTILE envelope on an error terminal substitutes the generic row and drops raw material', () => {
    const control = claimAndBegin('d-hostile');
    const payload = endTurn(control, {
      reason: 'error',
      partial: true,
      terminalError: { ...TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT, stack: HOSTILE },
    });

    expect(JSON.stringify(payload)).not.toContain('HOSTILE');
    expect(payload.terminalError).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
    expect(threadRuntimeManager.getLiveTurn(RUNTIME_KEY).terminalError)
      .toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
  });

  test.each([
    ['complete', { reason: 'complete' }],
    ['interrupted', { reason: 'interrupted', partial: true }],
  ])('%s terminal forces null snapshot envelope and OMITS the wire key despite a hostile payload', (reason, extra) => {
    const control = claimAndBegin(`d-${reason}`);
    const payload = endTurn(control, {
      ...extra,
      terminalError: { ...TURN_TERMINAL_ERROR_CATALOG.AUTHENTICATION_FAILED, stolen: HOSTILE },
    });

    expect(payload).not.toHaveProperty('terminalError'); // omitted (pinned shape)
    expect(threadRuntimeManager.getLiveTurn(RUNTIME_KEY).status).toBe(reason);
    expect(threadRuntimeManager.getLiveTurn(RUNTIME_KEY).terminalError).toBeNull();
  });

  test('published streamSeq/activityRevision/envelope all come from the SAME post-terminalize clone', () => {
    const control = claimAndBegin('d-clone');
    const payload = endTurn(control, { reason: 'error', partial: true });
    const retained = threadRuntimeManager.getLiveTurn(RUNTIME_KEY);

    expect(payload.streamSeq).toBe(retained.streamSeq); // final frontier
    expect(payload.activityRevision).toBe(retained.activityRevision);
    expect(payload.terminalError).toEqual(retained.terminalError);
  });

  test('duplicate error terminal after terminalization is a non-emitting drop', () => {
    const control = claimAndBegin('d-dup');
    endTurn(control, { reason: 'error', partial: true });
    expect(emitted).toHaveLength(1);

    endTurn(control, {
      reason: 'error',
      partial: true,
      terminalError: TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT,
    });
    endTurn(control, { reason: 'interrupted', partial: true });

    expect(emitted).toHaveLength(1);
    expect(threadRuntimeManager.getLiveTurn(RUNTIME_KEY).status).toBe('error');
    // Clear-if-current already removed our record; nothing else was touched.
    expect(threadRuntimeManager.getActiveDrain(RUNTIME_KEY)).toBeNull();
  });

  test('pre-binding error terminals are diagnostic drops', () => {
    const control = createCanonicalDrainControl({
      drainId: 'd-prebind',
      runtimeKey: RUNTIME_KEY,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    });
    threadRuntimeManager.claimActiveDrain(RUNTIME_KEY, control, makeRoute());
    // NO begin → no bound turnId.

    handlers.handleTurnEnd({
      payload: { reason: 'error', partial: true, terminalError: TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT },
      route: makeRoute(),
      control: { runtimeKey: RUNTIME_KEY, drainId: control.drainId },
    });

    expect(emitted).toHaveLength(0);
    expect(threadRuntimeManager.getLiveTurn(RUNTIME_KEY)).toBeNull();
    expect(threadRuntimeManager.getActiveDrain(RUNTIME_KEY)).toBeTruthy(); // untouched orphan
  });

  test('normalization-of-nothing equals the generic fallback row (shared constant proof)', () => {
    expect(normalizeTurnTerminalError()).toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
    expect(normalizeTurnTerminalError(undefined))
      .toEqual(TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED);
  });
});
