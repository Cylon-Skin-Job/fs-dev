import { expect, test } from '@playwright/test';
import { createShellSocketAuthenticator } from '../src/lib/shell-auth-client';
import { handlePromptStatusFrame, requestPromptStatus, resumePromptRecoveryConnection,
  retirePromptRecoveryConnection, settlePromptRecovery, trackAcceptedPromptExecution,
  trackPromptAttempt } from '../src/lib/chat/prompt-submission-recovery';
import { installProductSendCapability, retireProductSendCapability, sendChatProduct } from '../src/lib/ws/product-send';
import { useChatSubmissionStore, chatSubmissionOwnerKey, type ChatSubmissionAttempt } from '../src/state/chatSubmissionStore';
import { usePanelStore } from '../src/state/panelStore';
import { useWorkspaceStore } from '../src/state/workspaceStore';
import { startWaSession } from './support/working-activity-scenario';
import { THREAD_A } from './support/working-activity-wire';

const WORKSPACE = 'recovery-fixture';
const THREAD = 'recovery-thread';

function clock() {
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  let now = 0;
  let sequence = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  globalThis.setTimeout = ((run: () => void, delay = 0) => {
    const id = ++sequence;
    timers.set(id, { at: now + delay, run });
    return id;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: number) => { timers.delete(id); }) as typeof clearTimeout;
  return {
    advance(ms: number) {
      const until = now + ms;
      for (;;) {
        const due = [...timers].filter(([, timer]) => timer.at <= until)
          .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
        if (!due) break;
        now = due[1].at;
        timers.delete(due[0]);
        due[1].run();
      }
      now = until;
    },
    pending() { return [...timers.values()].map((timer) => timer.at - now).sort((a, b) => a - b); },
    restore() { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; },
  };
}

async function lane(authenticated = true) {
  const frames: Record<string, unknown>[] = [];
  let mode: 'normal' | 'uncertain' = 'normal';
  let onSend: ((frame: Record<string, unknown>) => void) | null = null;
  const socket = { readyState: WebSocket.OPEN, bufferedAmount: 0,
    send(value: string) {
      const frame = JSON.parse(value) as Record<string, unknown>;
      frames.push(frame);
      onSend?.(frame);
      if (mode === 'uncertain') { this.bufferedAmount += value.length; throw new Error('post-enqueue'); }
    },
  } as unknown as WebSocket;
  const auth = createShellSocketAuthenticator({ generation: 'recovery-generation',
    send: (value) => socket.send(value), bufferedAmount: () => socket.bufferedAmount,
    close: () => { (socket as unknown as { readyState: number }).readyState = WebSocket.CLOSED; },
    authenticated: () => undefined, deliver: () => undefined,
    electronApi: { authorizeShellChallenge: async (challenge, rendererNonce) => ({
      type: 'shell-auth:proof', version: 1, connectionId: challenge.connectionId,
      serverNonce: challenge.serverNonce, rendererNonce, generation: 'recovery-generation',
      expiresAt: challenge.expiresAt, proof: 'p'.repeat(43),
    }) },
  });
  const capability = { socket, generation: 'recovery-generation', isAuthenticated: auth.isAuthenticated,
    captureBinding: (id: string) => id === WORKSPACE ? { workspaceId: WORKSPACE,
      workspaceEpoch: 'epoch-1', bindingRevision: 1, bindingSerial: useWorkspaceStore.getState().bindingSerial } : null,
    isBindingCurrent: (binding: { bindingSerial: number }) => binding.bindingSerial === useWorkspaceStore.getState().bindingSerial,
    sendProductResult: auth.sendProductResult,
  };
  installProductSendCapability(capability);
  const stamp = Date.now();
  await auth.receive({ type: 'shell-auth:challenge', version: 1,
    connectionId: 'recovery-connection', serverNonce: 'n'.repeat(43),
    generation: 'recovery-generation', issuedAt: stamp, expiresAt: stamp + 30_000 });
  frames.length = 0;
  if (authenticated) await auth.receive({ type: 'shell-auth:authenticated', version: 1 });
  const send = (frame: Record<string, unknown>, workspaceId: string) =>
    sendChatProduct(frame, { workspaceId, policy: 'auth_queue_allowed', expectedSocket: socket });
  return { frames, send, setMode(value: typeof mode) { mode = value; },
    authenticate: () => auth.receive({ type: 'shell-auth:authenticated', version: 1 }),
    onSend(callback: typeof onSend) { onSend = callback; },
    refuse() { retireProductSendCapability(capability); },
    close() { retireProductSendCapability(capability); auth.retire(); },
  };
}

function attempt(id: string, phase: ChatSubmissionAttempt['phase'] = 'unknown'): ChatSubmissionAttempt {
  return { workspaceId: WORKSPACE, threadId: THREAD, requestId: id, text: 'draft',
    draftRevision: 0, attachmentIds: [], attachmentGenerations: {}, phase,
    ...(phase === 'accepted' ? { turnId: `turn-${id}` } : {}) };
}

function status(id: string, outcome: string, execution = 'not_dispatched') {
  return { type: 'thread:action:completed', action: 'prompt_receipt_status',
    workspaceId: WORKSPACE, threadId: THREAD, requestId: id,
    receipt: { workspaceId: WORKSPACE, threadId: THREAD, requestId: id,
      outcome, execution, turnId: `turn-${id}`, content: 'draft' } };
}

async function fixture(id: string, phase: ChatSubmissionAttempt['phase'] = 'unknown', authenticated = true) {
  const timer = clock();
  const originalWindow = (globalThis as { window?: Window }).window;
  if (!originalWindow) Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  retirePromptRecoveryConnection();
  useChatSubmissionStore.setState({ attemptsByOwner: {}, provisionalByOwner: {}, feedbackByOwner: {} });
  usePanelStore.setState({ activeWorkspaceId: WORKSPACE, currentThreadId: THREAD,
    threads: [{ threadId: THREAD, entry: { name: 'Recovery', createdAt: '2026-09-28T00:00:00Z',
      messageCount: 0, status: 'active' } }] });
  useWorkspaceStore.setState({ activeWorkspaceId: WORKSPACE, workspaceEpoch: 'epoch-1', bindingRevision: 1,
    bindingSerial: useWorkspaceStore.getState().bindingSerial + 1 });
  const value = attempt(id, phase);
  expect(useChatSubmissionStore.getState().begin(value)).toBe(true);
  const transport = await lane(authenticated);
  return { timer, transport, value, key: chatSubmissionOwnerKey(WORKSPACE, THREAD),
    close() {
      settlePromptRecovery(WORKSPACE, THREAD, id);
      retirePromptRecoveryConnection();
      transport.close();
      timer.restore();
      if (!originalWindow) delete (globalThis as { window?: Window }).window;
    } };
}

test('definite refusal from the real product boundary immediately resolves both watch kinds without a response deadline', async () => {
  for (const kind of ['unknown', 'accepted'] as const) {
    const fx = await fixture(`refused-${kind}`, kind);
    try {
      if (kind === 'accepted') trackAcceptedPromptExecution(fx.value);
      else trackPromptAttempt(fx.value);
      fx.transport.refuse();
      resumePromptRecoveryConnection(fx.transport.send);
      expect(fx.transport.frames).toHaveLength(0);
      expect(fx.timer.pending()).toEqual([1000]); // status-only retry, no 5s deadline
      expect(useChatSubmissionStore.getState().attemptsByOwner[fx.key]?.phase).toBe(kind);
      expect(useChatSubmissionStore.getState().feedbackByOwner[fx.key]).toContain('status unknown');
      fx.timer.advance(1000);
      expect(fx.transport.frames).toHaveLength(0);
      expect(fx.timer.pending()).toEqual([2000]);
      expect(handlePromptStatusFrame(status(fx.value.requestId, 'accepted') as never)).toBeNull();
    } finally { fx.close(); }
  }
});

test('uncertain send waits once; a late exact receipt after timeout and a later refusal remains eligible', async () => {
  const fx = await fixture('late-1');
  try {
    fx.transport.setMode('uncertain');
    trackPromptAttempt(fx.value);
    resumePromptRecoveryConnection(fx.transport.send);
    expect(fx.transport.frames).toHaveLength(1);
    expect(fx.timer.pending()).toEqual([5000]);
    fx.timer.advance(5000);
    expect(fx.timer.pending()).toEqual([1000]);
    fx.transport.refuse();
    fx.timer.advance(1000);
    expect(fx.timer.pending()).toEqual([2000]);
    expect(useChatSubmissionStore.getState().attemptsByOwner[fx.key]?.phase).toBe('unknown');
    const recovered = handlePromptStatusFrame(status('late-1', 'accepted') as never);
    expect(recovered).toMatchObject({ type: 'message:sent', requestId: 'late-1' });
    expect(fx.timer.pending()).toEqual([]);
    expect(handlePromptStatusFrame(status('late-1', 'accepted') as never)).toBeNull();
    expect(fx.transport.frames.filter((frame) => frame.type === 'prompt' || frame.type === 'turn:stop')).toHaveLength(0);
  } finally { fx.close(); }
});

test('synchronous receipt settles before send returns; manual recheck clears initial 15-second deadline', async () => {
  const fx = await fixture('sync-1', 'pending');
  try {
    trackPromptAttempt(fx.value);
    resumePromptRecoveryConnection(fx.transport.send);
    fx.transport.onSend((frame) => {
      if (frame.action === 'prompt_receipt_status') {
        const recovered = handlePromptStatusFrame(status('sync-1', 'accepted') as never);
        expect(recovered).toMatchObject({ type: 'message:sent' });
      }
    });
    requestPromptStatus(WORKSPACE, THREAD);
    expect(fx.transport.frames).toHaveLength(2);
    expect(fx.timer.pending()).toEqual([]);
    fx.timer.advance(20_000);
    expect(fx.transport.frames).toHaveLength(2);
  } finally { fx.close(); }
});

test('same-ID binding rebind retires late eligibility and avoids duplicate resume query', async () => {
  const fx = await fixture('rebind-1');
  try {
    trackPromptAttempt(fx.value);
    resumePromptRecoveryConnection(fx.transport.send);
    resumePromptRecoveryConnection(fx.transport.send);
    expect(fx.transport.frames).toHaveLength(1);
    useWorkspaceStore.getState().beginInit();
    expect(fx.timer.pending()).toEqual([]);
    expect(handlePromptStatusFrame(status('rebind-1', 'accepted') as never)).toBeNull();
    useWorkspaceStore.getState().applyWorkspaceBinding(WORKSPACE, 'epoch-1', null, null, null, 1);
    resumePromptRecoveryConnection(fx.transport.send);
    expect(fx.transport.frames).toHaveLength(2);
    expect(handlePromptStatusFrame(status('wrong', 'accepted') as never)).toBeNull();
    const recovered = handlePromptStatusFrame(status('rebind-1', 'accepted') as never);
    expect(recovered).toMatchObject({ type: 'message:sent', requestId: 'rebind-1' });
    expect(fx.timer.pending()).toEqual([]);
  } finally { fx.close(); }
});

test('pre-auth queue means bounded waiting, not proven delivery or permission to replay the prompt', async () => {
  const fx = await fixture('queued-1', 'unknown', false);
  try {
    trackPromptAttempt(fx.value);
    resumePromptRecoveryConnection(fx.transport.send);
    expect(fx.transport.frames).toHaveLength(0);
    expect(fx.timer.pending()).toEqual([5000]);
    await fx.transport.authenticate();
    expect(fx.transport.frames).toMatchObject([{ type: 'thread:action', action: 'prompt_receipt_status',
      requestId: 'queued-1' }]);
    expect(fx.transport.frames.filter((frame) => frame.type === 'prompt' || frame.type === 'turn:stop')).toHaveLength(0);
  } finally { fx.close(); }
});

test('retry exhaustion retains exact late eligibility until a matched terminal receipt settles it', async () => {
  const fx = await fixture('exhaust-1');
  try {
    trackPromptAttempt(fx.value);
    resumePromptRecoveryConnection(fx.transport.send);
    // Initial inquiry plus five status-only retries; each has a five-second
    // response budget, then no further retry timer remains.
    fx.timer.advance(6_000 + 7_000 + 9_000 + 13_000 + 20_000 + 5_000);
    expect(fx.transport.frames).toHaveLength(6);
    expect(fx.timer.pending()).toEqual([]);
    expect(handlePromptStatusFrame(status('foreign', 'accepted') as never)).toBeNull();
    expect(handlePromptStatusFrame({ ...status('exhaust-1', 'accepted'), workspaceId: 'foreign' } as never)).toBeNull();
    expect(handlePromptStatusFrame(status('exhaust-1', 'cancelled') as never)).toBeNull();
    expect(useChatSubmissionStore.getState().attemptsByOwner[fx.key]?.phase).toBe('rejected');
    expect(handlePromptStatusFrame(status('exhaust-1', 'accepted') as never)).toBeNull();
  } finally { fx.close(); }
});

test('conflicting inner receipt identities leave the current inquiry and deadline unchanged', async () => {
  const fx = await fixture('inner-identity');
  try {
    trackPromptAttempt(fx.value);
    resumePromptRecoveryConnection(fx.transport.send);
    const feedback = useChatSubmissionStore.getState().feedbackByOwner[fx.key];
    for (const field of ['workspaceId', 'threadId', 'requestId'] as const) {
      const wrong = status('inner-identity', 'accepted');
      wrong.receipt[field] = `wrong-${field}`;
      expect(handlePromptStatusFrame(wrong as never)).toBeNull();
      expect(handlePromptStatusFrame({ ...wrong, type: 'thread:action:error' } as never)).toBeNull();
      expect(useChatSubmissionStore.getState().attemptsByOwner[fx.key]?.phase).toBe('unknown');
      expect(useChatSubmissionStore.getState().feedbackByOwner[fx.key]).toBe(feedback);
      expect(fx.timer.pending()).toEqual([5000]);
      expect(fx.transport.frames).toHaveLength(1);
    }
    expect(handlePromptStatusFrame(status('inner-identity', 'accepted') as never))
      .toMatchObject({ type: 'message:sent', requestId: 'inner-identity' });
    expect(fx.timer.pending()).toEqual([]);
  } finally { fx.close(); }
});

test('execution watch rejects the wrong accepted turn, then handles exact failed-before-dispatch once', async () => {
  const fx = await fixture('execution-1', 'accepted');
  try {
    trackAcceptedPromptExecution(fx.value);
    resumePromptRecoveryConnection(fx.transport.send);
    const feedback = useChatSubmissionStore.getState().feedbackByOwner[fx.key];
    const wrongTurn = status('execution-1', 'accepted', 'failed_before_dispatch');
    wrongTurn.receipt.turnId = 'other-turn';
    expect(handlePromptStatusFrame(wrongTurn as never)).toBeNull();
    expect(useChatSubmissionStore.getState().attemptsByOwner[fx.key]?.phase).toBe('accepted');
    expect(useChatSubmissionStore.getState().feedbackByOwner[fx.key]).toBe(feedback);
    expect(fx.timer.pending()).toEqual([5000]);
    expect(fx.transport.frames).toHaveLength(1);
    expect(handlePromptStatusFrame(status('execution-1', 'accepted', 'failed_before_dispatch') as never)).toBeNull();
    expect(useChatSubmissionStore.getState().feedbackByOwner[fx.key]).toContain('could not start');
    expect(fx.timer.pending()).toEqual([]);
    expect(handlePromptStatusFrame(status('execution-1', 'accepted', 'failed_before_dispatch') as never)).toBeNull();
  } finally { fx.close(); }
});

test('replaced attempt and workspace A-to-B-to-A cannot inherit an old receipt window', async () => {
  const fx = await fixture('old-attempt');
  try {
    trackPromptAttempt(fx.value);
    resumePromptRecoveryConnection(fx.transport.send);
    usePanelStore.setState({ activeWorkspaceId: 'other-workspace' });
    usePanelStore.setState({ activeWorkspaceId: WORKSPACE });
    expect(handlePromptStatusFrame(status('old-attempt', 'accepted') as never)).toBeNull();
    useChatSubmissionStore.getState().clearSession(WORKSPACE, THREAD);
    const replacement = attempt('new-attempt');
    expect(useChatSubmissionStore.getState().begin(replacement)).toBe(true);
    trackPromptAttempt(replacement);
    resumePromptRecoveryConnection(fx.transport.send);
    expect(handlePromptStatusFrame(status('old-attempt', 'accepted') as never)).toBeNull();
    expect(handlePromptStatusFrame(status('new-attempt', 'accepted') as never))
      .toMatchObject({ type: 'message:sent', requestId: 'new-attempt' });
  } finally {
    settlePromptRecovery(WORKSPACE, THREAD, 'new-attempt');
    fx.close();
  }
});

test('unqualified same-socket error after rebind cannot borrow the active workspace', async () => {
  const fx = await fixture('error-rebind');
  try {
    trackPromptAttempt(fx.value);
    resumePromptRecoveryConnection(fx.transport.send);
    useWorkspaceStore.getState().beginInit();
    useWorkspaceStore.getState().applyWorkspaceBinding(WORKSPACE, 'epoch-2', null, null, null, 2);
    resumePromptRecoveryConnection(fx.transport.send);
    const oldError = { type: 'thread:action:error', action: 'prompt_receipt_status',
      threadId: THREAD, requestId: 'error-rebind', code: 'not_found' };
    expect(handlePromptStatusFrame(oldError as never)).toBeNull();
    expect(useChatSubmissionStore.getState().feedbackByOwner[fx.key]).toContain('Checking delivery');
    expect(fx.timer.pending()).toEqual([5000]);
    fx.timer.advance(5000);
    expect(useChatSubmissionStore.getState().feedbackByOwner[fx.key]).toContain('status unknown');
  } finally { fx.close(); }
});

test('public composer scheduled inquiry accepts a late exact receipt without sending the prompt twice', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  await page.clock.install();
  const textarea = page.locator('section textarea').first();
  await textarea.fill('RECOVERY-LATE');
  await page.getByRole('button', { name: 'Send message', exact: true }).first().click();
  const prompt = fx.sentFrames().find((frame) => frame.type === 'prompt' && frame.threadId === THREAD_A);
  expect(prompt?.requestId).toEqual(expect.any(String));
  const requestId = String(prompt?.requestId);
  fx.holdStatusReply(requestId);
  await page.clock.runFor(15_000);
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.action === 'prompt_receipt_status'
    && frame.requestId === requestId).length).toBe(1);
  await page.clock.runFor(5_000);
  await expect(page.getByRole('button', { name: 'Check status' }).first()).toBeVisible();
  await fx.push({ type: 'thread:action:completed', action: 'prompt_receipt_status',
    workspaceId: 'boot-fixture', threadId: THREAD_A, requestId,
    receipt: { workspaceId: 'boot-fixture', threadId: THREAD_A, requestId,
      outcome: 'accepted', execution: 'not_dispatched', turnId: 'recovered-turn', content: 'RECOVERY-LATE' } });
  await expect(page.locator('.rv-chat-messages').first()).toContainText('RECOVERY-LATE');
  await page.clock.runFor(2_000); // past the retired acceptance retry, before execution watch's 15s deadline
  expect(fx.sentFrames().filter((frame) => frame.type === 'prompt' && frame.threadId === THREAD_A)).toHaveLength(1);
  expect(fx.sentFrames().filter((frame) => frame.action === 'prompt_receipt_status'
    && frame.requestId === requestId)).toHaveLength(1);
  expect(fx.sentFrames().filter((frame) => frame.type === 'turn:stop')).toHaveLength(0);
});

test('public Check status uses the existing route for an accepted execution watch', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  await page.clock.install();
  const textarea = page.locator('section textarea').first();
  await textarea.fill('RECOVERY-EXECUTION');
  await page.getByRole('button', { name: 'Send message', exact: true }).first().click();
  const prompt = fx.sentFrames().find((frame) => frame.type === 'prompt' && frame.threadId === THREAD_A);
  expect(prompt?.requestId).toEqual(expect.any(String));
  const requestId = String(prompt?.requestId);
  await fx.push({ type: 'message:sent', workspaceId: 'boot-fixture', threadId: THREAD_A,
    requestId, turnId: 'execution-turn', content: 'RECOVERY-EXECUTION' });
  fx.holdStatusReply(requestId);
  await page.clock.runFor(15_000);
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.action === 'prompt_receipt_status'
    && frame.requestId === requestId).length).toBe(1);
  await expect(page.getByRole('button', { name: 'Check status' }).first()).toBeVisible();
  fx.setStatusReply(requestId, { type: 'thread:action:completed', action: 'prompt_receipt_status',
    workspaceId: 'boot-fixture', threadId: THREAD_A, requestId,
    receipt: { workspaceId: 'boot-fixture', threadId: THREAD_A, requestId,
      outcome: 'accepted', execution: 'failed_before_dispatch', turnId: 'execution-turn', content: 'RECOVERY-EXECUTION' } });
  await page.getByRole('button', { name: 'Check status' }).first().click();
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.action === 'prompt_receipt_status'
    && frame.requestId === requestId).length).toBe(2);
  await expect(page.locator('section').first()).toContainText('response could not start');
  await page.clock.runFor(20_000);
  expect(fx.sentFrames().filter((frame) => frame.type === 'prompt' && frame.threadId === THREAD_A)).toHaveLength(1);
  expect(fx.sentFrames().filter((frame) => frame.type === 'turn:stop')).toHaveLength(0);
});
