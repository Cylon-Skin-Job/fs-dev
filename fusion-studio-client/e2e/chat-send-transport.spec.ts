import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createShellSocketAuthenticator } from '../src/lib/shell-auth-client';
import { installProductSendCapability, retireProductSendCapability, sendChatProduct } from '../src/lib/ws/product-send';
import { startWaSession } from './support/working-activity-scenario';
import { mountHarness, sentFrames, CAPTURE_VIEW, CAPTURE_GROUP_A, CAPTURE_THREAD_B,
  HARNESS_WORKSPACE } from './worksurface-harness';

// The production boundary and authenticator stay in the test path. Only the
// native socket/provider are deterministic fixtures.
async function lane(authenticated = true) {
  const frames: Record<string, unknown>[] = [];
  let throwMode: 'none' | 'before' | 'after' | 'after_equal' | 'unknown' = 'none';
  let afterSend: ((frame: Record<string, unknown>) => void) | null = null;
  let workspaceId = 'send-workspace';
  let workspaceEpoch = 'epoch-1';
  let bindingRevision = 1;
  let bindingSerial = 1;
  const socket = { readyState: WebSocket.OPEN, bufferedAmount: 0,
    send(value: string) {
      if (throwMode === 'before') throw new Error('before');
      if (throwMode === 'after') { this.bufferedAmount += value.length; throw new Error('after'); }
      if (throwMode === 'after_equal') { frames.push(JSON.parse(value)); throw new Error('after equal'); }
      if (throwMode === 'unknown') { this.bufferedAmount = NaN; throw new Error('unknown'); }
      const frame = JSON.parse(value) as Record<string, unknown>;
      frames.push(frame);
      afterSend?.(frame);
    },
  } as unknown as WebSocket;
  const generation = 'send-fixture-generation';
  const auth = createShellSocketAuthenticator({ generation, send: (value) => socket.send(value),
    bufferedAmount: () => socket.bufferedAmount, close: () => { (socket as unknown as { readyState: number }).readyState = WebSocket.CLOSED; },
    authenticated: () => undefined, deliver: () => undefined,
    electronApi: { authorizeShellChallenge: async (challenge, rendererNonce) => ({
      type: 'shell-auth:proof', version: 1, connectionId: challenge.connectionId,
      serverNonce: challenge.serverNonce, rendererNonce, generation,
      expiresAt: challenge.expiresAt, proof: 'p'.repeat(43),
    }) },
  });
  const capability = { socket, generation, isAuthenticated: auth.isAuthenticated,
    captureBinding: (id: string) => id === workspaceId
      ? { workspaceId, workspaceEpoch, bindingRevision, bindingSerial } : null,
    isBindingCurrent: (binding: { workspaceId: string; workspaceEpoch: string; bindingRevision: number; bindingSerial: number }) =>
      binding.workspaceId === workspaceId && binding.workspaceEpoch === workspaceEpoch
        && binding.bindingRevision === bindingRevision && binding.bindingSerial === bindingSerial,
    sendProductResult: auth.sendProductResult,
  };
  installProductSendCapability(capability);
  async function authenticate() {
    const now = Date.now();
    await auth.receive({ type: 'shell-auth:challenge', version: 1,
      connectionId: 'send-fixture-connection', serverNonce: 'n'.repeat(43),
      generation, issuedAt: now, expiresAt: now + 30_000 });
    frames.length = 0; // auth proof is a separate internal lane
    await auth.receive({ type: 'shell-auth:authenticated', version: 1 });
  }
  if (authenticated) await authenticate();
  return { frames, socket, authenticate, setThrow: (mode: typeof throwMode) => { throwMode = mode; },
    setAfterSend: (callback: typeof afterSend) => { afterSend = callback; },
    rebind: (id = workspaceId, epoch = workspaceEpoch, revision = bindingRevision) => {
      workspaceId = id; workspaceEpoch = epoch; bindingRevision = revision; bindingSerial += 1;
    },
    retire: () => { retireProductSendCapability(capability); auth.retire(); },
  };
}

const rows = [
  ['01', 'src/state/slices/chatSlice.ts', 'prompt'],
  ['02', 'src/state/slices/chatSlice.ts', 'thread:warm'],
  ['03', 'src/components/chat/useChatSessionActions.ts', 'turn:stop'],
  ['04', 'src/components/chat/useViewChatHost.ts', 'thread:list'],
  ['05', 'src/lib/chat/thread-group-command-controller.ts', 'thread:action'],
  ['06', 'src/components/chat/ChatSurfaceComponentMount.tsx', 'thread:open'],
  ['07', 'src/lib/worksurface/worksurfaceSwitch.ts', 'thread:open'],
  ['08', 'src/lib/chat-action-creation.ts', 'thread:open-assistant'],
  ['09', 'src/lib/chat/reply-metadata-api.ts', 'chat-turn:metadata:update'],
  ['10', 'src/lib/ws/application-message-router.ts', 'thread:action'],
  ['11', 'src/state/panelStore.ts', 'thread:open-assistant'],
  ['12', 'src/lib/ws/chat-diagnostic-handlers.ts', 'chat-turn:diagnostic:get'],
  ['13', 'src/lib/diagnostics/stream.ts', 'chat-turn:diagnostic:subscribe'],
] as const;

test('SEND-01–13 share production serialization and socket admission; sources have no raw chat send', async () => {
  const fixture = await lane();
  try {
    for (const [id, source, type] of rows) {
      const bytes = fs.readFileSync(path.resolve(import.meta.dirname, '..', source), 'utf8');
      expect(bytes, `SEND-${id} production adoption`).toContain('sendChatProduct');
      const payload = { type, threadId: `thread-${id}`, requestId: `request-${id}` };
      const result = sendChatProduct(payload, { workspaceId: 'send-workspace', policy: 'socket_only', expectedSocket: fixture.socket });
      expect(result).toEqual({ status: 'enqueued', destination: 'socket' });
      expect(fixture.frames.at(-1)).toEqual(payload);
    }
    expect(fixture.frames).toHaveLength(rows.length);
  } finally { fixture.retire(); }
});

test('auth queue is explicit, FIFO, bounded to captured binding, and prompt is never queued', async () => {
  const fixture = await lane(false);
  try {
    expect(sendChatProduct({ type: 'prompt', threadId: 't' },
      { workspaceId: 'send-workspace', policy: 'socket_only' })).toEqual(
      { status: 'not_enqueued', reason: 'auth_not_ready' });
    expect(sendChatProduct({ type: 'chat-turn:metadata:update', threadId: 't', exchangeId: 1 },
      { workspaceId: 'send-workspace', policy: 'auth_queue_allowed' })).toEqual(
      { status: 'enqueued', destination: 'auth_queue' });
    expect(sendChatProduct({ type: 'thread:action', action: 'prompt_receipt_status', requestId: 'r' },
      { workspaceId: 'send-workspace', policy: 'auth_queue_allowed' })).toEqual(
      { status: 'enqueued', destination: 'auth_queue' });
    fixture.rebind('send-workspace', 'epoch-1', 1); // same ID/revision is still a new binding
    await fixture.authenticate();
    expect(fixture.frames).toEqual([]);
  } finally { fixture.retire(); }
});

test('qualified pre-auth frames flush FIFO once and a retired socket cannot deliver to a replacement', async () => {
  const first = await lane(false);
  try {
    for (const exchangeId of [1, 2]) {
      expect(sendChatProduct({ type: 'chat-turn:metadata:update', exchangeId },
        { workspaceId: 'send-workspace', policy: 'auth_queue_allowed', expectedSocket: first.socket }))
        .toEqual({ status: 'enqueued', destination: 'auth_queue' });
    }
    await first.authenticate();
    expect(first.frames).toEqual([
      { type: 'chat-turn:metadata:update', exchangeId: 1 },
      { type: 'chat-turn:metadata:update', exchangeId: 2 },
    ]);
  } finally { first.retire(); }
  const retired = await lane(false);
  expect(sendChatProduct({ type: 'thread:action', action: 'prompt_receipt_status' },
    { workspaceId: 'send-workspace', policy: 'auth_queue_allowed' })).toEqual(
    { status: 'enqueued', destination: 'auth_queue' });
  retired.retire();
  const replacement = await lane();
  try { expect(replacement.frames).toEqual([]); }
  finally { replacement.retire(); }
});

test('local refusal and native throw preserve the closed truthful result vocabulary', async () => {
  const first = await lane();
  try {
    expect(sendChatProduct({ type: 'prompt' }, { workspaceId: 'foreign', policy: 'socket_only' })).toEqual(
      { status: 'not_enqueued', reason: 'binding_unavailable' });
    expect(sendChatProduct({ type: 'prompt' }, { workspaceId: 'send-workspace', policy: 'socket_only',
      expectedSocket: {} as WebSocket })).toEqual({ status: 'not_enqueued', reason: 'stale_connection' });
    expect(sendChatProduct({ type: 'prompt', value: BigInt(1) },
      { workspaceId: 'send-workspace', policy: 'socket_only' })).toEqual(
      { status: 'not_enqueued', reason: 'serialization_failed' });
    first.setThrow('before');
    expect(sendChatProduct({ type: 'prompt' }, { workspaceId: 'send-workspace', policy: 'socket_only' })).toEqual(
      { status: 'uncertain', reason: 'send_outcome_unknown' });
  } finally { first.retire(); }
  const second = await lane();
  try {
    second.setThrow('after');
    expect(sendChatProduct({ type: 'prompt' }, { workspaceId: 'send-workspace', policy: 'socket_only' })).toEqual(
      { status: 'uncertain', reason: 'send_failed_after_enqueue' });
  } finally { second.retire(); }
  const third = await lane();
  try {
    third.setThrow('unknown');
    expect(sendChatProduct({ type: 'prompt' }, { workspaceId: 'send-workspace', policy: 'socket_only' })).toEqual(
      { status: 'uncertain', reason: 'send_outcome_unknown' });
  } finally { third.retire(); }
  const fourth = await lane();
  try {
    fourth.setThrow('after_equal');
    expect(sendChatProduct({ type: 'prompt', requestId: 'possible-acceptance' },
      { workspaceId: 'send-workspace', policy: 'socket_only' })).toEqual(
      { status: 'uncertain', reason: 'send_outcome_unknown' });
    expect(fourth.frames).toEqual([{ type: 'prompt', requestId: 'possible-acceptance' }]);
  } finally { fourth.retire(); }
});

test('real store, group, creation, metadata, recovery, and diagnostic callers use the installed lane', async () => {
  const fixture = await lane();
  const { usePanelStore } = await import('../src/state/panelStore');
  const { useWorkspaceStore } = await import('../src/state/workspaceStore');
  const { useChatSubmissionStore } = await import('../src/state/chatSubmissionStore');
  const { openGroup } = await import('../src/lib/chat/thread-group-command-controller');
  const { consumeCreationAction } = await import('../src/lib/chat-action-creation');
  const { updateReplyMetadata } = await import('../src/lib/chat/reply-metadata-api');
  const { emitFusion } = await import('../src/lib/ws/fusion-response-listeners');
  const recovery = await import('../src/lib/chat/prompt-submission-recovery');
  const diagnostics = await import('../src/lib/ws/chat-diagnostic-handlers');
  const diagnosticStream = await import('../src/lib/diagnostics/stream');
  const { selectViewGroup } = await import('../src/lib/worksurface/worksurfaceSwitch');
  const { retireFusionResponseListeners } = await import('../src/lib/ws/fusion-response-listeners');
  const originalWindow = globalThis.window;
  (globalThis as unknown as { window: object }).window = { dispatchEvent: () => true };
  try {
    useWorkspaceStore.getState().beginInit();
    useWorkspaceStore.getState().applyWorkspaceBinding('send-workspace', 'epoch-1', null, null, null, 1);
    useWorkspaceStore.setState({ hasReceivedInit: true });
    usePanelStore.setState({ activeWorkspaceId: 'send-workspace', ws: fixture.socket,
      currentThreadId: 'thread-01', chatActive: true });
    expect(usePanelStore.getState().sendMessage('one deliberate text', 'thread-01', [],
      { requestId: 'request-01' })).toEqual({ status: 'enqueued', destination: 'socket' });
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'prompt', threadId: 'thread-01', requestId: 'request-01' });
    usePanelStore.getState().warmThread('thread-01');
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'thread:warm', threadId: 'thread-01' });

    expect(openGroup({ workspaceId: 'send-workspace', threadGroupId: 'group-01', threadId: 'thread-01' }, 'view-01')).toBe(true);
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'thread:open', threadGroupId: 'group-01' });
    usePanelStore.getState().setThreadGroupPopulation('send-workspace', 'view-01', [
      { workspaceId: 'send-workspace', viewId: 'view-01', threadId: 'thread-01', threadGroupId: 'group-01' } as never,
    ]);
    const beforeWorksurfaceOpen = fixture.frames.length;
    selectViewGroup('send-workspace', 'view-01', 'group-01');
    expect(fixture.frames).toHaveLength(beforeWorksurfaceOpen + 1);
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'thread:open', threadGroupId: 'group-01' });
    usePanelStore.getState().selectHarness('opencode');
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'thread:open-assistant', harnessId: 'opencode' });
    usePanelStore.getState().createDefaultAssistantThread();
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'thread:open-assistant' });

    const metadata = updateReplyMetadata({ workspaceId: 'send-workspace', threadId: 'thread-01',
      messageId: 'reply-01', exchangeId: 1 }, { bookmark: { type: 'star' } });
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'chat-turn:metadata:update', threadId: 'thread-01', exchangeId: 1 });
    emitFusion('chat-turn:metadata:updated', { type: 'chat-turn:metadata:updated', threadId: 'thread-01',
      exchangeId: 1, metadata: { bookmark: { type: 'star' } } });
    await expect(metadata).resolves.toMatchObject({ exchangeId: 1 });

    const metadataError = updateReplyMetadata({ workspaceId: 'send-workspace', threadId: 'thread-01',
      messageId: 'reply-02', exchangeId: 2 }, { bookmark: { type: 'star' } });
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'chat-turn:metadata:update', exchangeId: 2 });
    emitFusion('chat-turn:metadata:error', { type: 'chat-turn:metadata:error', threadId: 'thread-01',
      exchangeId: 2, message: 'rejected' });
    await expect(metadataError).rejects.toThrow('rejected');

    let appliedAddress: { threadId: string } | undefined;
    consumeCreationAction({ target: 'new', delivery: 'insert', content: 'persisted draft',
      capturedAddress: { workspaceId: 'send-workspace', viewId: 'view-01', threadGroupId: null, threadId: null },
      claim: () => undefined, complete: (result) => {
        if (result.status === 'applied') appliedAddress = result.address as { threadId: string };
      } });
    const successfulCreation = fixture.frames.at(-1)!;
    emitFusion('thread:created', { type: 'thread:created', requestId: successfulCreation.requestId,
      workspaceId: 'send-workspace', workspaceEpoch: 'epoch-1', viewId: 'view-01',
      threadId: 'created-01', threadGroupId: 'group-created-01' });
    emitFusion('thread:opened', { type: 'thread:opened', requestId: successfulCreation.requestId,
      workspaceId: 'send-workspace', workspaceEpoch: 'epoch-1', viewId: 'view-01',
      threadId: 'created-01', threadGroupId: 'group-created-01' });
    expect(appliedAddress).toMatchObject({ threadId: 'created-01' });

    let creationResult: { status: string } | null = null;
    consumeCreationAction({ target: 'new', delivery: 'insert', content: 'draft',
      capturedAddress: { workspaceId: 'send-workspace', viewId: 'view-01', threadGroupId: null, threadId: null },
      claim: () => undefined, complete: (result) => { creationResult = result; } });
    const creationFrame = fixture.frames.at(-1)!;
    expect(creationFrame).toMatchObject({ type: 'thread:open-assistant', viewId: 'view-01' });
    emitFusion('error', { type: 'error', requestId: creationFrame.requestId });
    expect(creationResult).toMatchObject({ status: 'failed' });

    const diagnostic = diagnostics.requestChatTurnDiagnostic({ workspaceId: 'send-workspace',
      threadId: 'thread-01', turnId: 'turn-01', diagnosticId: 'diagnostic-01' });
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'chat-turn:diagnostic:get', threadId: 'thread-01' });
    diagnostics.handleChatDiagnosticUnavailableFrame({ type: 'chat-turn:diagnostic:unavailable',
      threadId: 'thread-01', turnId: 'turn-01', diagnosticId: 'diagnostic-01' } as never);
    await expect(diagnostic).resolves.toBeNull();

    diagnosticStream.openDiagnosticStream('stream-01', { workspaceId: 'send-workspace',
      threadId: 'thread-01', surfaceId: 'surface-01' });
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'chat-turn:diagnostic:subscribe',
      workspaceId: 'send-workspace', threadId: 'thread-01' });
    diagnosticStream.closeDiagnosticStream('stream-01');
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'chat-turn:diagnostic:unsubscribe',
      workspaceId: 'send-workspace', threadId: 'thread-01' });

    const attempt = { workspaceId: 'send-workspace', threadId: 'recovery-01', requestId: 'request-recovery-01',
      text: 'pending', draftRevision: 0, attachmentIds: [], attachmentGenerations: {}, phase: 'unknown' as const };
    useChatSubmissionStore.getState().begin(attempt);
    recovery.trackPromptAttempt(attempt);
    recovery.resumePromptRecoveryConnection((payload, workspaceId) =>
      sendChatProduct(payload, { workspaceId, policy: 'auth_queue_allowed', expectedSocket: fixture.socket }));
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'thread:action', action: 'prompt_receipt_status',
      threadId: 'recovery-01', requestId: 'request-recovery-01' });
    recovery.settlePromptRecovery('send-workspace', 'recovery-01', 'request-recovery-01');
    recovery.retirePromptRecoveryConnection();

    const retiring = updateReplyMetadata({ workspaceId: 'send-workspace', threadId: 'thread-01',
      messageId: 'reply-03', exchangeId: 3 }, { bookmark: { type: 'star' } });
    expect(fixture.frames.at(-1)).toMatchObject({ type: 'chat-turn:metadata:update', exchangeId: 3 });
    retireFusionResponseListeners();
    await expect(retiring).rejects.toThrow('Connection retired');

    usePanelStore.setState({ ws: null, pendingThreadOpens: [] });
    selectViewGroup('send-workspace', 'view-01', 'group-01');
    expect(usePanelStore.getState().pendingThreadOpens).toEqual([]);
  } finally {
    if (originalWindow === undefined) delete (globalThis as unknown as { window?: typeof window }).window;
    else (globalThis as unknown as { window: typeof window }).window = originalWindow;
    fixture.retire();
  }
});

test('SEND-05 installs exact open/model correlation before a synchronous server response', async () => {
  const fixture = await lane();
  const { usePanelStore } = await import('../src/state/panelStore');
  const { handleThreadMessage } = await import('../src/lib/ws/thread-handlers');
  const { openGroup, selectGroupModel } = await import('../src/lib/chat/thread-group-command-controller');
  const { selectionForThread } = await import('../src/state/slices/chatSurfaceSlice');
  const address = { workspaceId: 'send-workspace', threadGroupId: 'group-sync', threadId: 'thread-sync' };
  let createdSequence = 0;
  try {
    usePanelStore.setState({ activeWorkspaceId: address.workspaceId, ws: fixture.socket,
      pendingThreadOpens: [], harnessSelectionByThread: {} });
    fixture.setAfterSend((frame) => {
      if (frame.type === 'thread:open') handleThreadMessage({ type: 'thread:opened',
        workspaceId: address.workspaceId, viewId: 'view-sync', threadGroupId: address.threadGroupId,
        threadId: address.threadId, thread: { name: 'Sync', status: 'active' }, exchanges: [] } as never);
      if (frame.type === 'thread:action' && frame.action === 'set_harness_selection') {
        handleThreadMessage({ type: 'thread:action:completed', action: 'set_harness_selection',
          workspaceId: address.workspaceId, threadId: address.threadId,
          requestId: frame.requestId, model: 'sync-model', variant: null, harnessId: 'opencode' } as never);
      }
      if (frame.type === 'thread:open-assistant') {
        createdSequence += 1;
        // Legacy helpers omit viewId; the server preserves that null binding
        // instead of inferring the previously opened view's population.
        handleThreadMessage({ type: 'thread:created', workspaceId: address.workspaceId,
          viewId: frame.viewId ?? null, threadId: `sync-created-${createdSequence}`,
          threadGroupId: `sync-created-group-${createdSequence}`,
          thread: { name: 'Created synchronously', status: 'active' } } as never);
      }
    });
    expect(openGroup(address, 'view-sync')).toBe(true);
    expect(usePanelStore.getState().pendingThreadOpens).toEqual([]);
    expect(selectGroupModel(address, { modelId: 'sync-model' })).toBe(true);
    expect(selectionForThread(usePanelStore.getState(), address.threadId)).toMatchObject({
      acknowledged: { model: 'sync-model' }, pending: null,
    });
    usePanelStore.setState({ currentThreadId: 'old-thread', wireReady: true });
    usePanelStore.getState().selectHarness('opencode');
    expect(usePanelStore.getState().currentThreadId).toBe('sync-created-1');
    usePanelStore.getState().createDefaultAssistantThread();
    expect(usePanelStore.getState().currentThreadId).toBe('sync-created-2');
    fixture.setAfterSend(null);
    usePanelStore.setState({ ws: null });
    expect(openGroup(address, 'view-sync')).toBe(false);
    expect(usePanelStore.getState().pendingThreadOpens).toEqual([]);
    usePanelStore.getState().requestThreadOpen({ ...address, viewId: 'view-sync' });
    expect(openGroup(address, 'view-sync')).toBe(false);
    expect(usePanelStore.getState().pendingThreadOpens).toHaveLength(1);
    usePanelStore.getState().beginHarnessSelection(address.threadId,
      { modelId: 'older-model', variant: null, requestId: 'older-selection' });
    expect(selectGroupModel(address, { modelId: 'newer-model' })).toBe(false);
    expect(selectionForThread(usePanelStore.getState(), address.threadId).pending?.requestId).toBe('older-selection');
  } finally { fixture.retire(); }
});

test('SEND-04 active host lists and opens its exact view through the real browser socket', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  try {
    const sent = fx.sentFrames();
    expect(sent.some((frame) => frame.type === 'thread:list' && typeof frame.viewId === 'string')).toBe(true);
    expect(sent.some((frame) => frame.type === 'thread:open' && typeof frame.threadGroupId === 'string')).toBe(true);
  } finally { await page.context().close(); }
});

test('SEND-03 Stop and SEND-06 passive component history use the installed product lane', async ({ page }) => {
  await mountHarness(page, CAPTURE_VIEW);
  await page.evaluate(({ group, view, sideThread }) => {
    const fixture = (window as any).__wsFixture;
    fixture.forceBinding(group, view);
    fixture.mountRailFor(view);
    fixture.seedSidePlacementIn(view, group, 'c2-side', sideThread);
  }, { group: CAPTURE_GROUP_A, view: CAPTURE_VIEW, sideThread: CAPTURE_THREAD_B });
  await page.locator('#capture-viewer-view-tab-rail').getByRole('tab', { name: 'Side Chat' }).click();
  const side = page.locator('.rv-chat-area[data-chat-host="side-tab"]');
  await expect(side).toBeVisible();
  await expect.poll(async () => (await sentFrames(page)).filter((frame) => frame.type === 'thread:open'
    && frame.historyOnly === true && frame.threadId === CAPTURE_THREAD_B).length).toBe(1);
  await side.locator('textarea.rv-chat-input').fill('C2 exact side');
  await side.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(async () => (await sentFrames(page)).filter((frame) => frame.type === 'prompt').length).toBe(1);
  const prompt = (await sentFrames(page)).find((frame) => frame.type === 'prompt')!;
  await page.evaluate(({ workspaceId, threadId, requestId }) => (window as any).__wsFixture.deliver({
    type: 'message:sent', workspaceId, threadId, requestId, turnId: 'c2-side-turn', content: 'C2 exact side',
  }), { workspaceId: HARNESS_WORKSPACE, threadId: CAPTURE_THREAD_B, requestId: prompt.requestId });
  await expect(side.locator('.rv-message-user').last()).toContainText('C2 exact side');
  await page.evaluate((threadId) => (window as any).__wsFixture.deliver({
    type: 'turn_begin', threadId, turnId: 'c2-side-turn', streamSeq: 1, userInput: 'C2 exact side',
  }), CAPTURE_THREAD_B);
  await side.locator('.rv-stop-btn').click();
  await expect.poll(async () => (await sentFrames(page)).filter((frame) => frame.type === 'turn:stop').length).toBe(1);
  expect((await sentFrames(page)).find((frame) => frame.type === 'turn:stop')).toMatchObject({ threadId: CAPTURE_THREAD_B });
});

test('synchronous native-send ACK keeps the prompt attempt and Stop terminal state exact', async ({ page }) => {
  await mountHarness(page, CAPTURE_VIEW);
  const main = page.locator('#worksurface-host .rv-chat-area:not([data-chat-host="side-tab"])').first();
  await expect(main).toBeVisible();
  await page.evaluate(() => (window as any).__wsFixture.setImmediateResponse('prompt_ack'));
  await main.locator('textarea.rv-chat-input').fill('sync accepted prompt');
  await main.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(async () => (await sentFrames(page)).filter((frame) => frame.type === 'prompt').length).toBe(1);
  const prompt = (await sentFrames(page)).find((frame) => frame.type === 'prompt')!;
  await expect(main.locator('.rv-message-user').last()).toContainText('sync accepted prompt');
  const afterAck = await page.evaluate((threadId) => (window as any).__wsFixture.submission(threadId), prompt.threadId);
  expect(afterAck).toMatchObject({ requestId: prompt.requestId, phase: 'accepted' });
  await page.evaluate((threadId) => {
    const fixture = (window as any).__wsFixture;
    fixture.deliver({ type: 'turn_begin', threadId, turnId: 'sync-accepted-turn', streamSeq: 1,
      userInput: 'sync accepted prompt' });
    fixture.setImmediateResponse('stop_turn_begin');
  }, prompt.threadId);
  await main.locator('.rv-stop-btn').click();
  await expect.poll(async () => (await sentFrames(page)).filter((frame) => frame.type === 'turn:stop').length).toBe(1);
  const afterStop = await page.evaluate((threadId) => (window as any).__wsFixture.chat(threadId), prompt.threadId);
  expect(afterStop).toMatchObject({ currentTurn: null, pendingExchangeSaveTurnId: null });
});

test('definitely refused prompt keeps the draft and releases only its provisional attempt', async ({ page }) => {
  await mountHarness(page, CAPTURE_VIEW);
  const main = page.locator('#worksurface-host .rv-chat-area:not([data-chat-host="side-tab"])').first();
  const composer = main.locator('textarea.rv-chat-input');
  await composer.fill('retain this draft');
  await page.evaluate(() => (window as any).__wsFixture.setBindingAvailable(false));
  await main.getByRole('button', { name: 'Send message' }).click();
  expect((await sentFrames(page)).filter((frame) => frame.type === 'prompt')).toEqual([]);
  await expect(composer).toHaveValue('retain this draft');
  const attempt = await page.evaluate(() => (window as any).__wsFixture.submission('capture-thread-a'));
  expect(attempt).toBeNull();
});

test('refused later prompt preserves a prior accepted attempt and its original ACK', async ({ page }) => {
  await mountHarness(page, CAPTURE_VIEW);
  const main = page.locator('#worksurface-host .rv-chat-area:not([data-chat-host="side-tab"])').first();
  const composer = main.locator('textarea.rv-chat-input');
  await page.evaluate(() => (window as any).__wsFixture.setImmediateResponse('prompt_ack'));
  await composer.fill('accepted first');
  await main.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(async () => (await sentFrames(page)).filter((frame) => frame.type === 'prompt').length).toBe(1);
  const accepted = await page.evaluate(() => (window as any).__wsFixture.submission('capture-thread-a'));
  expect(accepted).toMatchObject({ phase: 'accepted' });
  await page.evaluate(() => (window as any).__wsFixture.setBindingAvailable(false));
  await composer.fill('retain second');
  await main.getByRole('button', { name: 'Send message' }).click();
  expect((await sentFrames(page)).filter((frame) => frame.type === 'prompt')).toHaveLength(1);
  await expect(composer).toHaveValue('retain second');
  expect(await page.evaluate(() => (window as any).__wsFixture.submission('capture-thread-a')))
    .toMatchObject({ requestId: accepted.requestId, phase: 'accepted' });
});
