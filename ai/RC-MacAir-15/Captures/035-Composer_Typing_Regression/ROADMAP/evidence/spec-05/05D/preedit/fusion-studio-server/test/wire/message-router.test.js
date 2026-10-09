/**
 * Wire Message Router Tests (RCC-0108 SPEC-02 Slice D / SPEC §5)
 *
 * Per-connection router behaviors over an injected ws + session:
 *   - closed-ws guard;
 *   - generic non-chat event forwarding (StepBegin included — its legacy
 *     direct branch is deleted, so it takes the generic path);
 *   - request/response forwarding and the SPEC-03 value-minimized error relay;
 *   - unknown-message forwarding;
 *   - handleCanonicalHarnessEvent composition: the bridge's bindDrainTurn is
 *     wired to threadRuntimeManager.bindTurnToDrain, proven end-to-end by
 *     binding a real accepted begin on a real claimed drain;
 *   - SPEC-03 shared-classifier absence sweep over lib/.
 *
 * uuid is mocked (ESM-only under Jest — same precedent as
 * test/ws/prompt-canonical-route.integration.test.js).
 */
let mockIdCounter = 0;
jest.mock('uuid', () => ({
  v4: () => `gen-${++mockIdCounter}-${Math.random().toString(36).slice(2, 8)}`,
}));

const fs = require('fs');
const path = require('path');
const { createWireMessageRouter } = require('../../lib/wire/message-router');
const { emit, on } = require('../../lib/event-bus');
const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const {
  createCanonicalDrainControl,
  createCanonicalRouteContext,
} = require('../../lib/thread/canonical-drain-context');

describe('WireMessageRouter', () => {
  let sentMessages;
  let ws;
  let session;

  function makeRouter() {
    return createWireMessageRouter({
      session,
      ws,
      emit,
      checkSettingsBounce: () => null,
    });
  }

  function handleMessage(router, msg) {
    router.handleMessage(msg);
    return sentMessages.map(m => JSON.parse(m));
  }

  beforeEach(() => {
    mockIdCounter = 0;
    threadRuntimeManager.runtimes.clear();
    sentMessages = [];
    ws = { readyState: 1, send: jest.fn((raw) => sentMessages.push(raw)) };
    session = { currentThreadId: 'session-thread' };
  });

  // ─── transport guard ─────────────────────────────────────────────────

  test('drops every message when the WebSocket is not open', () => {
    const router = makeRouter();
    ws.readyState = 3; // CLOSED

    const out = [
      { method: 'event', params: { type: 'X', payload: {} } },
      { method: 'request', params: { type: 't', payload: {} }, id: 'r1' },
      { id: 'i1', result: {} },
      { id: 'i2', error: { code: -32004, message: 'nope' } },
      { junk: true },
    ].flatMap(msg => handleMessage(router, msg));

    expect(ws.send).not.toHaveBeenCalled();
    expect(out).toEqual([]);
  });

  // ─── generic non-chat event forwarding ──────────────────────────────

  test('forwards generic non-chat events raw to the client', () => {
    const router = makeRouter();
    const out = handleMessage(router, {
      method: 'event',
      params: { type: 'CustomThing', payload: { n: 1 } },
    });

    expect(out).toEqual([{ type: 'event', eventType: 'CustomThing', payload: { n: 1 } }]);
  });

  test('StepBegin takes the generic unknown-event path with no stepNumber anywhere', () => {
    const router = makeRouter();
    const out = handleMessage(router, {
      method: 'event',
      params: { type: 'StepBegin', payload: { n: 7 } },
    });

    // No special case: forwarded like any other non-chat event.
    expect(out).toEqual([{
      type: 'event',
      eventType: 'StepBegin',
      payload: { n: 7 },
    }]);
    expect(out[0].type).not.toBe('step_begin');
    const serialized = sentMessages.join('');
    expect(serialized).not.toContain('stepNumber');
    expect(serialized).not.toContain('"type":"step_begin"');
  });

  // ─── requests / responses ────────────────────────────────────────────

  test('forwards requests from the agent with their request id', () => {
    const router = makeRouter();
    const out = handleMessage(router, {
      method: 'request',
      params: { type: 'permission', payload: { tool: 'Bash' } },
      id: 'req-9',
    });

    expect(out).toEqual([{
      type: 'request',
      requestType: 'permission',
      payload: { tool: 'Bash' },
      requestId: 'req-9',
    }]);
  });

  test('forwards responses to our requests', () => {
    const router = makeRouter();
    const out = handleMessage(router, { id: 'req-9', result: { ok: true } });

    expect(out).toEqual([{ type: 'response', id: 'req-9', result: { ok: true } }]);
  });

  // ─── error relay (SPEC-03 Slice A: generic + value-minimized) ────────

  test.each([
    ['native -32004 code', { code: -32004, message: 'provider exploded' }],
    ['Authentication-failed message text', { code: 42, message: 'Authentication failed for this account' }],
    ['ordinary protocol error', { code: 500, message: 'boom' }],
  ])('%s forwards as one value-minimized error frame with no raw echo and no auth classification', (_label, error) => {
    const router = makeRouter();
    const out = handleMessage(router, { id: 'e-1', error });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('error');
    expect(out[0].id).toBe('e-1');
    // Fixed neutral string only — chosen and pinned by this suite.
    expect(out[0].message).toBe('The harness reported a protocol error.');
    // No raw msg.error object echo anywhere on the frame.
    expect(out[0]).not.toHaveProperty('error');
    expect(out[0]).not.toHaveProperty('code');
    const serialized = sentMessages.join('');
    expect(serialized).not.toContain('provider exploded');
    expect(serialized).not.toContain('Authentication failed for this account');
    expect(serialized).not.toContain('boom');
    // Transport relay never invents lifecycle scope or thread targeting.
    expect(out[0]).not.toHaveProperty('threadId');
    expect(out[0]).not.toHaveProperty('scope');
    expect(out[0].type).not.toBe('auth_error');
  });

  it('does not leak the raw wire error object even when it carries nested data', () => {
    const router = makeRouter();
    const out = handleMessage(router, {
      id: 'e-9',
      error: { code: 7, message: 'nested', data: { secret: 'value' } },
    });

    const serialized = sentMessages.join('');
    expect(serialized).not.toContain('secret');
    expect(JSON.stringify(out[0])).not.toContain('nested');
  });

  // ─── unknown messages ────────────────────────────────────────────────

  test('forwards unrecognized message shapes as unknown', () => {
    const router = makeRouter();
    const msg = { somethingElse: true };
    const out = handleMessage(router, msg);

    expect(out).toEqual([{ type: 'unknown', data: msg }]);
  });

  // ─── canonical harness event composition ─────────────────────────────

  describe('handleCanonicalHarnessEvent → bindDrainTurn composition', () => {
    let unsubscribeFns;
    let busEvents;

    beforeEach(() => {
      busEvents = [];
      unsubscribeFns = [
        on('*', (event) => {
          if (typeof event?.type === 'string' && event.type.startsWith('chat:')) {
            busEvents.push(event);
          }
        }),
      ];
    });

    afterEach(() => {
      for (const unsubscribe of unsubscribeFns) unsubscribe();
      unsubscribeFns = [];
    });

    function makeDrainEnv(threadId) {
      const runtimeKey = { workspaceId: 'code', scope: 'project', threadId };
      const routeContext = createCanonicalRouteContext({
        workspaceId: 'code',
        workspace: 'workspace:code',
        projectRoot: '/tmp/project',
        scope: 'project',
        threadId,
        acceptedUserInput: 'Hello AI',
        attachments: [],
      });
      const control = createCanonicalDrainControl({
        drainId: `drain-${threadId}`,
        runtimeKey,
        touchThreadSession: () => {},
        stopHarness: async () => {},
      });
      const record = threadRuntimeManager.claimActiveDrain(runtimeKey, control, routeContext);
      return {
        runtimeKey,
        drainId: control.drainId,
        drainContext: { route: record.routeContext, control: record.control },
      };
    }

    test('an accepted turn_begin flows to the bus and binds its server turnId through threadRuntimeManager.bindTurnToDrain', () => {
      const router = makeRouter();
      const env = makeDrainEnv('bind-thread');

      router.handleCanonicalHarnessEvent(
        { type: 'turn_begin', userInput: 'Hello AI' },
        ws,
        env.drainContext
      );

      expect(busEvents.map(e => e.type)).toEqual(['chat:turn_begin']);

      // Bind-once composition actually landed on the manager: the generated
      // server turnId is resolvable for this exact drain.
      const boundTurnId = threadRuntimeManager.resolveBoundTurnId(env.runtimeKey, env.drainId);
      expect(boundTurnId).toBeTruthy();
      expect(busEvents[0].turnId).toBe(boundTurnId);
      // SPEC-02 Slice D: the begin publication carries the initial frontier.
      expect(busEvents[0].streamSeq).toBe(1);
      expect(threadRuntimeManager.getLiveTurn(env.runtimeKey).streamSeq).toBe(1);

      // Bind-once: a second accepted-looking begin cannot rebind or reset.
      router.handleCanonicalHarnessEvent(
        { type: 'turn_begin', userInput: 'Hello again' },
        ws,
        env.drainContext
      );
      expect(busEvents).toHaveLength(1); // duplicate begin never publishes
      expect(threadRuntimeManager.resolveBoundTurnId(env.runtimeKey, env.drainId)).toBe(boundTurnId);
    });

    test('a rejected begin never binds and never publishes', () => {
      const router = makeRouter();

      // Route context carries empty accepted input AND empty payload input:
      // spurious begin. The factory rejects empty input, so this well-formed
      // but empty route is built by hand (same precedent as the applier
      // suite's spurious-begin fixtures).
      const runtimeKey = { workspaceId: 'code', scope: 'project', threadId: 'spurious' };
      const routeContext = Object.freeze({
        workspaceId: 'code',
        workspace: 'workspace:code',
        projectRoot: '/tmp/project',
        scope: 'project',
        threadId: 'spurious',
        acceptedUserInput: '',
        attachments: Object.freeze([]),
      });
      const control = createCanonicalDrainControl({
        drainId: 'drain-spurious',
        runtimeKey,
        touchThreadSession: () => {},
        stopHarness: async () => {},
      });
      threadRuntimeManager.claimActiveDrain(runtimeKey, control, routeContext);

      router.handleCanonicalHarnessEvent({ type: 'turn_begin', userInput: '' }, ws, {
        route: routeContext,
        control,
      });

      expect(busEvents).toEqual([]);
      expect(threadRuntimeManager.resolveBoundTurnId(runtimeKey, 'drain-spurious')).toBeNull();
      expect(threadRuntimeManager.getLiveTurn(runtimeKey)).toBeNull();
    });
  });
});

describe('SPEC-03 shared-classifier absence sweep over lib/', () => {
  const LIB_ROOT = path.join(__dirname, '..', '..', 'lib');
  // The OpenCode adapter boundary is the ONLY sanctioned home for native
  // -32004 / provider-auth-text classification (roadmap §5.5).
  const SANCTIONED_BOUNDARY = path.join(LIB_ROOT, 'harness', 'opencode');

  // Computed synchronously at suite load so the test.each table is real.
  const sources = (function collectLibSources(dir) {
    const found = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (fullPath === SANCTIONED_BOUNDARY) continue;
        if (entry.name === '__tests__') continue; // embedded legacy test dirs
        found.push(...collectLibSources(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
        found.push(fullPath);
      }
    }
    return found;
  })(LIB_ROOT);

  it('walks a non-empty shared lib surface excluding only the sanctioned boundary and tests', () => {
    expect(sources.length).toBeGreaterThan(20);
    for (const file of sources) {
      expect(file.startsWith(SANCTIONED_BOUNDARY)).toBe(false);
      expect(file.includes('__tests__')).toBe(false);
      expect(path.basename(file).endsWith('.test.js')).toBe(false);
    }
    expect(sources).toContain(path.join(LIB_ROOT, 'thread', 'thread-runtime-controller.js'));
    expect(sources).toContain(path.join(LIB_ROOT, 'wire', 'message-router.js'));
  });

  it.each(sources.map((file) => [file]))(
    '%s contains no -32004 classifier and no authentication-message classifier',
    (file) => {
      const source = fs.readFileSync(file, 'utf8');
      // The native protocol code may appear nowhere in shared lib.
      expect(source.includes('-32004')).toBe(false);
      // Authentication classification may only enter as the fixed safe
      // message constant exported by lib/harness/errors.js — never as a
      // regex literal, a constructed RegExp, or a substring-matching call.
      expect(source.includes('/Authentication')).toBe(false);
      expect(source.includes('/authentication')).toBe(false);
      expect(/new\s+RegExp\([^)]*(uthentication|uth\s+failed)/i.test(source)).toBe(false);
      expect(/\.test\([^)]*(uthentication|uth\s+failed)/i.test(source)).toBe(false);
      expect(/includes\([^)]*['"`]authentication/i.test(source)).toBe(false);
      // The retired kimi-login fallback text is gone from shared lib.
      expect(/kimi login/i.test(source)).toBe(false);
    },
  );
});
