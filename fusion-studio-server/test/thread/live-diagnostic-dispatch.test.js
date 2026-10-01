'use strict';
jest.mock('uuid', () => ({ v4: () => require('crypto').randomUUID() }));
jest.mock('../../lib/agent-provenance/turn-authority', () => ({ createAgentTurnAuthorityRef: async () => null, releaseAgentTurnAuthorityRef() {} }));
jest.mock('../../lib/thread/prompt-submission-service', () => ({ claimDispatch: async () => true, noteClaimedFailure: async () => true }));
const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const { dispatchAcceptedTurn } = require('../../lib/thread/runtime-dispatch');
const { subscribeDiagnostic } = require('../../lib/thread/live-diagnostic-service');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
test('real claimed runtime dispatch binds one native observer to the captured route, never selected chat', async () => {
  const route = { workspaceId: 'dispatch-workspace', projectRoot: '/tmp/dispatch-root', workspaceEpoch: 'epoch', scope: 'project', threadId: 'owned' };
  const runtime = threadRuntimeManager.ensureRuntime(route);
  const frames = [], canonical = []; let native, release;
  const paused = new Promise(r => { release = r; });
  const ws = { readyState: 1, send: raw => frames.push(JSON.parse(raw)) };
  const dispose = subscribeDiagnostic({ route, ws, subscriptionId: 'dispatch-sub', isCurrent: () => true });
  const send = jest.fn(async function* (_input, options) {
    native = options.nativeDiagnostic;
    native.available(); native.emit({ text: 'FIRST', sourceUnits: 5, sourceBytes: 5 });
    yield { type: 'turn_begin' };
    await paused;
    native.emit({ text: 'SECOND', sourceUnits: 6, sourceBytes: 6 });
    yield { type: 'turn_end' };
  });
  const wire = { _harnessId: 'fixture', _sendMessage: send };
  const session = { currentWorkspaceId: route.workspaceId, currentThreadId: 'owned', projectRoot: route.projectRoot };
  await dispatchAcceptedTurn({ ws, session, sessions: { ...route, touchSession() {} },
    thread: { entry: { harnessId: 'fixture' } }, threadId: 'owned', requestId: 'request', clientMsg: { user_input: 'hello' },
    wire, runtimeKey: route, ownership: threadRuntimeManager.captureOwnership(route), workspaceBinding: route,
    projectRoot: route.projectRoot, attachments: [], harnessInput: 'hello', turnId: 'exact-turn', receiptIdentity: {},
    failAcceptedBeforeDispatch: jest.fn(), handleCanonicalHarnessEvent: async (event, _ws, context) => canonical.push({ event, context }) });
  const completion = runtime.activeDrain.completion;
  session.currentThreadId = 'other'; session.currentWorkspaceId = 'other-workspace';
  release(); await completion; await sleep(130);
  expect(send).toHaveBeenCalledTimes(1);
  expect(canonical).toHaveLength(2);
  expect(canonical.every(c => c.context.route.threadId === 'owned' && c.context.route.workspaceId === route.workspaceId)).toBe(true);
  expect(frames.flatMap(f => f.events ?? []).map(e => e.text)).toEqual(['FIRST', 'SECOND']);
  expect(frames.at(-1)).toMatchObject({ turnId: 'exact-turn', threadId: 'owned', terminal: true });
  dispose(); threadRuntimeManager.runtimes.delete(threadRuntimeManager.makeKey(route));
});
