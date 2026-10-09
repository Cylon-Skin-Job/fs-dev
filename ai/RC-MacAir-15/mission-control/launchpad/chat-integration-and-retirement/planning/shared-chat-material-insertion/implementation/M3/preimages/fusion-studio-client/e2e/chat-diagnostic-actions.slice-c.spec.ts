import { expect, test, type Browser } from '@playwright/test';
import {
  NAME_A,
  THREAD_A,
  THREAD_B,
  exchange,
} from './support/working-activity-wire';
import {
  ConsoleTap,
  selectThread,
  startWaSession,
} from './support/working-activity-scenario';

const TURN_ID = 'diagnostic-turn-a';
const DIAGNOSTIC_ID = 'diagnostic-id-a';
const SAFE_TERMINAL_ERROR = {
  kind: 'runtime' as const,
  code: 'MODEL_RESPONSE_FAILED' as const,
  message: 'The model response failed before it completed.',
  recoverable: true as const,
  diagnosticId: DIAGNOSTIC_ID,
};

async function installDiagnosticSendFixture() {
  const { usePanelStore } = await import('../src/state/panelStore');
  const { useWorkspaceStore } = await import('../src/state/workspaceStore');
  const { installProductSendCapability, retireProductSendCapability } = await import('../src/lib/ws/product-send');
  const { createShellSocketAuthenticator } = await import('../src/lib/shell-auth-client');
  const socket = { readyState: WebSocket.OPEN, bufferedAmount: 0, send: (_value: string) => undefined } as WebSocket;
  const generation = 'diagnostic-fixture';
  const auth = createShellSocketAuthenticator({ generation, send: (value) => socket.send(value),
    bufferedAmount: () => socket.bufferedAmount, close: () => undefined,
    authenticated: () => undefined, deliver: () => undefined,
    electronApi: { authorizeShellChallenge: async (challenge, rendererNonce) => ({
      type: 'shell-auth:proof', version: 1, connectionId: challenge.connectionId,
      serverNonce: challenge.serverNonce, rendererNonce, generation,
      expiresAt: challenge.expiresAt, proof: 'p'.repeat(43),
    }) },
  });
  const now = Date.now();
  await auth.receive({ type: 'shell-auth:challenge', version: 1, connectionId: 'diagnostic-fixture',
    serverNonce: 'n'.repeat(43), generation, issuedAt: now, expiresAt: now + 30_000 });
  await auth.receive({ type: 'shell-auth:authenticated', version: 1 });
  useWorkspaceStore.getState().beginInit();
  useWorkspaceStore.getState().applyWorkspaceBinding('diagnostic-workspace', 'diagnostic-epoch', null, null, null, 1);
  usePanelStore.setState({ activeWorkspaceId: 'diagnostic-workspace', ws: socket });
  const serial = useWorkspaceStore.getState().bindingSerial;
  const capability = { socket, generation, isAuthenticated: auth.isAuthenticated,
    captureBinding: (workspaceId: string) => workspaceId === 'diagnostic-workspace'
      ? { workspaceId, workspaceEpoch: 'diagnostic-epoch', bindingRevision: 1, bindingSerial: serial } : null,
    isBindingCurrent: (binding: { bindingSerial: number }) =>
      useWorkspaceStore.getState().bindingSerial === binding.bindingSerial,
    sendProductResult: auth.sendProductResult };
  installProductSendCapability(capability);
  return () => { retireProductSendCapability(capability); auth.retire(); usePanelStore.setState({ ws: null }); };
}

function diagnosticHistory() {
  const saved = exchange('DIAGNOSTIC-PROMPT', [{ type: 'text', content: 'PARTIAL-OUTPUT' }], 41);
  saved.metadata = { turnId: TURN_ID, terminalError: SAFE_TERMINAL_ERROR };
  return saved;
}

async function startDiagnosticSession(browser: Browser) {
  return startWaSession(browser, {
    alpha: { threadId: THREAD_A, exchanges: [diagnosticHistory()] },
    beta: { threadId: THREAD_B },
  });
}

function reportFrame(canary: string) {
  return {
    type: 'chat-turn:diagnostic:report',
    threadId: THREAD_A,
    turnId: TURN_ID,
    diagnosticId: DIAGNOSTIC_ID,
    report: {
      version: 1,
      harnessId: 'opencode',
      category: 'runtime',
      message: `redacted message ${canary}`,
      stderrExcerpt: `redacted stderr ${canary}`,
      hadRenderableOutput: true,
      hadToolCalls: false,
      truncatedFields: [],
    },
  };
}

function diagnosticGets(frames: Array<Record<string, unknown>>) {
  return frames.filter((frame) => frame.type === 'chat-turn:diagnostic:get');
}

function acceptedPromptFrame(frames: Array<Record<string, unknown>>, content: string) {
  const prompt = frames.find((frame) => frame.type === 'prompt' && frame.user_input === content);
  if (!prompt || typeof prompt.requestId !== 'string') throw new Error('exact prompt request missing');
  return { type: 'message:sent', workspaceId: 'boot-fixture', threadId: prompt.threadId,
    requestId: prompt.requestId, turnId: `accepted-${prompt.requestId}`, content };
}

async function insertFixtureAttachment(page: import('@playwright/test').Page, threadId: string,
  attachment: Record<string, unknown>) {
  const status = await page.evaluate(({ threadId, attachment }) => new Promise<string>((resolve) => {
    const address = { workspaceId: 'boot-fixture', viewId: 'wa-view',
      threadGroupId: `wa-group-${threadId}`, threadId };
    window.dispatchEvent(new CustomEvent('fusion:chat-action', {
      detail: { target: 'current', delivery: 'insert', attachment, capturedAddress: address,
        claim: () => {}, complete: (result: { status: string }) => resolve(result.status) },
    }));
  }), { threadId, attachment });
  expect(status).toBe('applied');
}

async function expectDiagnosticLogsAllowlisted(tap: ConsoleTap, canaries: string[] = []) {
  const calls = (await tap.calls()).filter((call) => (
    JSON.stringify(call.args).includes('chat-turn:diagnostic:')
  ));
  expect(calls.length).toBeGreaterThan(0);
  for (const call of calls) {
    const serializedArgs = JSON.stringify(call.args);
    for (const canary of canaries) expect(serializedArgs).not.toContain(canary);
    expect(call.args).toHaveLength(3);
    expect(call.args[0]).toBe('[WS] Message received:');
    expect(call.args[1]).toMatch(/^chat-turn:diagnostic:(report|unavailable)$/);
    expect(call.args[2]).toEqual(call.args[1] === 'chat-turn:diagnostic:report' ? {
      type: 'chat-turn:diagnostic:report',
      threadId: THREAD_A,
      turnId: TURN_ID,
      diagnosticId: DIAGNOSTIC_ID,
    } : {
      type: 'chat-turn:diagnostic:unavailable',
      availability: 'unavailable',
      threadId: THREAD_A,
      turnId: TURN_ID,
      diagnosticId: DIAGNOSTIC_ID,
    });
  }
}

test('Slice C: explicit View/Copy/Ask AI validates once, never auto-fetches or auto-sends, and keeps report canaries out of logs', async ({ browser }) => {
  const { fx, page } = await startDiagnosticSession(browser);
  const tap = new ConsoleTap(page);
  tap.attach();
  const view = page.getByRole('button', { name: 'View', exact: true }).first();
  const copy = page.getByRole('button', { name: 'Copy', exact: true }).first();
  const askAI = page.getByRole('button', { name: 'Ask AI', exact: true }).first();
  const textarea = page.locator('section textarea').first();

  await expect(view).toBeVisible();
  await expect(copy).toBeVisible();
  await expect(askAI).toBeVisible();
  await expect(page.locator('.rv-chat-turn-error[role="alert"]')).toHaveCount(1);
  await view.focus();
  await textarea.focus();
  expect(diagnosticGets(fx.sentFrames())).toHaveLength(0);

  await view.click();
  await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
  expect(diagnosticGets(fx.sentFrames())[0]).toEqual({
    type: 'chat-turn:diagnostic:get',
    threadId: THREAD_A,
    turnId: TURN_ID,
    diagnosticId: DIAGNOSTIC_ID,
  });

  const canary = 'SLICE-C-REPORT-CANARY';
  fx.push(reportFrame(canary));
  await expect(page.locator('.rv-chat-diagnostic-report').first()).toContainText(canary);
  expect(tap.dump()).not.toContain(canary);
  await expectDiagnosticLogsAllowlisted(tap, [canary]);
  await expect(page.locator('.rv-chat-turn-error[role="alert"]')).toHaveCount(1);

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async (text: string) => {
      const target = window as Window & { __sliceCCopies?: string[] };
      (target.__sliceCCopies ??= []).push(text);
    },
  } }));
  await copy.click();
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.type === 'clipboard:append').length).toBe(1);
  const append = fx.sentFrames().find((frame) => frame.type === 'clipboard:append');
  fx.push({ type: 'clipboard:append', item: { id: 81, type: 'text', preview: 'redacted', last_used_at: 1 } });
  await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText('Diagnostic copied.');
  const copies = await page.evaluate(() => (window as Window & { __sliceCCopies?: string[] }).__sliceCCopies ?? []);
  expect(copies).toHaveLength(1);
  expect(append).toEqual({ type: 'clipboard:append', text: copies[0], source: 'chat-diagnostic' });
  expect(copies[0]).toContain(canary);

  await textarea.fill('PRESERVED-DRAFT');
  await textarea.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(2, 10));
  const beforeAsk = fx.sentFrames().length;
  await askAI.click();
  await expect(textarea).toHaveValue(/^PRESERVED-DRAFT\n\n/);
  await expect(textarea).toContainText(canary);
  await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText(
    'Diagnostic added to the composer for review.',
  );
  expect(fx.sentFrames().slice(beforeAsk).some((frame) => frame.type === 'prompt')).toBe(false);
  expect(diagnosticGets(fx.sentFrames())).toHaveLength(1);
  expect(tap.dump()).not.toContain(canary);
});

test('Slice C: clipboard failure preserves the validated report and remaining actions', async ({ browser }) => {
  const { fx, page } = await startDiagnosticSession(browser);
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
  fx.push(reportFrame('COPY-FAILURE-REPORT'));
  const report = page.locator('.rv-chat-diagnostic-report').first();
  await expect(report).toContainText('COPY-FAILURE-REPORT');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });
  await page.getByRole('button', { name: 'Copy', exact: true }).first().click();
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.type === 'clipboard:append').length).toBe(1);
  fx.push({ type: 'clipboard:error', requestType: 'clipboard:append', code: 'WRITE_FAILED', message: 'safe failure' });
  await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText('Unable to copy diagnostic.');
  await expect(report).toContainText('COPY-FAILURE-REPORT');
  await expect(page.getByRole('button', { name: 'Ask AI', exact: true }).first()).toBeEnabled();
  expect(diagnosticGets(fx.sentFrames())).toHaveLength(1);
});

test('Slice C: malformed retrieved report fails closed to the fixed unavailable state', async ({ browser }) => {
  const { fx, page } = await startDiagnosticSession(browser);
  const tap = new ConsoleTap(page);
  tap.attach();
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);

  const canary = 'INVALID-REPORT-CANARY';
  const malformed = reportFrame(canary);
  delete (malformed.report as Record<string, unknown>).category;
  fx.push(malformed);
  await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText(
    'Diagnostic details are unavailable.',
  );
  await expect(page.locator('.rv-chat-diagnostic-report')).toHaveCount(0);
  expect(tap.dump()).not.toContain(canary);
});

test('Slice C: unavailable and stale responses cannot leak across diagnostic rows', async ({ browser }) => {
  const { fx, page } = await startDiagnosticSession(browser);
  const tap = new ConsoleTap(page);
  tap.attach();
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
  await selectThread(fx, page, 'b');

  fx.push(reportFrame('STALE-DIAGNOSTIC-CANARY'));
  await expect(page.locator('.rv-chat-diagnostic-report')).toHaveCount(0);
  await expect(page.locator('section textarea').first()).not.toContainText('STALE-DIAGNOSTIC-CANARY');

  await selectThread(fx, page, 'a');
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(2);
  fx.push({
    type: 'chat-turn:diagnostic:unavailable',
    threadId: THREAD_A,
    turnId: TURN_ID,
    diagnosticId: DIAGNOSTIC_ID,
  });
  await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText(
    'Diagnostic details are unavailable.',
  );
  await expectDiagnosticLogsAllowlisted(tap);
});

test('Slice C: an exact-route in-flight request survives unmount and remount', async ({ browser }) => {
  const { fx, page } = await startDiagnosticSession(browser);
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
  await selectThread(fx, page, 'b');
  await selectThread(fx, page, 'a');
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  expect(diagnosticGets(fx.sentFrames())).toHaveLength(1);
  fx.push(reportFrame('REMOUNT-REPORT-CANARY'));
  await expect(page.locator('.rv-chat-diagnostic-report').first()).toContainText(
    'REMOUNT-REPORT-CANARY',
  );
});

test('Slice C: Ask AI cannot race server-owned prompt acceptance', async ({ browser }) => {
  const { fx, page } = await startDiagnosticSession(browser);
  const askAI = page.getByRole('button', { name: 'Ask AI', exact: true }).first();
  const textarea = page.locator('section textarea').first();
  await askAI.click();
  await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
  await textarea.fill('ACCEPTANCE-OWNED-DRAFT');
  await page.getByRole('button', { name: 'Send message', exact: true }).first().click();
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.type === 'prompt').length).toBe(1);
  await expect(askAI).toBeDisabled();

  fx.push(reportFrame('ACCEPTANCE-RACE-REPORT'));
  await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText(
    'Wait for the current message to be accepted, then try again.',
  );
  await expect(textarea).toHaveValue('ACCEPTANCE-OWNED-DRAFT');
  fx.push(acceptedPromptFrame(fx.sentFrames(), 'ACCEPTANCE-OWNED-DRAFT'));
  await expect(textarea).toHaveValue('');
  await expect(askAI).toBeEnabled();

  const beforeRetry = fx.sentFrames().length;
  await askAI.click();
  await expect(textarea).toContainText('ACCEPTANCE-RACE-REPORT');
  expect(fx.sentFrames().slice(beforeRetry).some((frame) => frame.type === 'prompt')).toBe(false);
  expect(diagnosticGets(fx.sentFrames())).toHaveLength(1);
});

test('Slice C: unavailable frames require the complete pending route tuple', async () => {
  const mod = await import('../src/lib/ws/chat-diagnostic-handlers');
  const cleanup = await installDiagnosticSendFixture();
  let settled = false;
  const pending = mod.requestChatTurnDiagnostic({
    threadId: 'route-a',
    turnId: 'turn-shared',
    diagnosticId: 'diag-exact-route',
  });
  const sharedPending = mod.requestChatTurnDiagnostic({
    threadId: 'route-a',
    turnId: 'turn-shared',
    diagnosticId: 'diag-exact-route',
  });
  expect(sharedPending).toBe(pending);
  void pending.then(() => { settled = true; });
  const conflictingPending = mod.requestChatTurnDiagnostic({
    threadId: 'route-b',
    turnId: 'turn-shared',
    diagnosticId: 'diag-exact-route',
  });
  expect(conflictingPending).not.toBe(pending);
  await expect(conflictingPending).resolves.toBeNull();
  expect(settled).toBe(false);

  mod.handleChatDiagnosticUnavailableFrame({
    type: 'chat-turn:diagnostic:unavailable',
    threadId: 'route-b',
    turnId: 'turn-shared',
    diagnosticId: 'diag-exact-route',
  } as never);
  mod.handleChatDiagnosticUnavailableFrame({
    type: 'chat-turn:diagnostic:unavailable',
    threadId: null,
    turnId: 'turn-shared',
    diagnosticId: null,
  } as never);
  await Promise.resolve();
  expect(settled).toBe(false);

  mod.handleChatDiagnosticUnavailableFrame({
    type: 'chat-turn:diagnostic:unavailable',
    threadId: 'route-a',
    turnId: 'turn-shared',
    diagnosticId: 'diag-exact-route',
  } as never);
  await expect(pending).resolves.toBeNull();
  await expect(sharedPending).resolves.toBeNull();
  cleanup();
});

test('Slice C: an unattributable null echo resolves only through the bounded timeout', async () => {
  const mod = await import('../src/lib/ws/chat-diagnostic-handlers');
  const cleanup = await installDiagnosticSendFixture();
  const nativeSetTimeout = globalThis.setTimeout;
  const nativeClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = ((callback: () => void) => {
    queueMicrotask(callback);
    return 1 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
  try {
    const pending = mod.requestChatTurnDiagnostic({
      threadId: 'timeout-route',
      turnId: 'timeout-turn',
      diagnosticId: 'timeout-diagnostic',
    });
    mod.handleChatDiagnosticUnavailableFrame({
      type: 'chat-turn:diagnostic:unavailable',
      threadId: null,
      turnId: null,
      diagnosticId: null,
    } as never);
    await expect(pending).resolves.toBeNull();
  } finally {
    cleanup();
    globalThis.setTimeout = nativeSetTimeout;
    globalThis.clearTimeout = nativeClearTimeout;
  }
});

test('Slice C: diagnostic IDs enforce the frozen UTF-8 byte bound', async () => {
  const { isValidDiagnosticId } = await import('../src/lib/chat/terminal-error');
  expect(isValidDiagnosticId('💥'.repeat(32))).toBe(true);
  expect(isValidDiagnosticId('💥'.repeat(33))).toBe(false);
});

test('Slice C: late acceptance cannot clear another thread draft', async ({ browser }) => {
  const { fx, page } = await startDiagnosticSession(browser);
  const textarea = page.locator('section textarea').first();
  const attachment = { id: 'same-file-id', kind: 'file', label: 'owner.txt', path: '/owner.txt', sourceName: 'owner.txt' };
  await insertFixtureAttachment(page, THREAD_A, attachment);
  await textarea.fill('LATE-A-DRAFT');
  await page.getByRole('button', { name: 'Send message', exact: true }).first().click();
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.type === 'prompt').length).toBe(1);
  await selectThread(fx, page, 'b');
  await expect(textarea).toHaveValue('');
  await expect(page.getByLabel('Chat attachments')).toHaveCount(0);
  await insertFixtureAttachment(page, THREAD_B, attachment);
  await textarea.fill('KEEP-B-DRAFT');
  fx.push(acceptedPromptFrame(fx.sentFrames(), 'LATE-A-DRAFT'));
  await expect(textarea).toHaveValue('KEEP-B-DRAFT');
  await expect(page.getByLabel('Chat attachments').first()).toContainText('owner.txt');
});
