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
  fx.push({ type: 'message:sent', threadId: THREAD_A, content: 'ACCEPTANCE-OWNED-DRAFT' });
  await expect(textarea).toHaveValue('');
  await expect(askAI).toBeEnabled();

  const beforeRetry = fx.sentFrames().length;
  await askAI.click();
  await expect(textarea).toContainText('ACCEPTANCE-RACE-REPORT');
  expect(fx.sentFrames().slice(beforeRetry).some((frame) => frame.type === 'prompt')).toBe(false);
  expect(diagnosticGets(fx.sentFrames())).toHaveLength(1);
});
test('Slice C: pending acceptance survives secondary-chat minimize and restore', async ({ browser }) => {
  const { fx, page } = await startDiagnosticSession(browser);
  await selectThread(fx, page, 'b');
  const alphaRow = page.locator('.rv-chat-item').filter({ hasText: NAME_A }).first();
  await alphaRow.hover();
  await alphaRow.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('button', { name: 'Open a side chat' }).click();
  await expect(page.locator('.rv-secondary-body')).toBeVisible();
  let secondary = page.locator('.rv-secondary-body');
  await secondary.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
  await secondary.locator('textarea').fill('SECONDARY-PENDING-DRAFT');
  await secondary.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.type === 'prompt').length).toBe(1);
  await page.getByRole('button', { name: 'Minimize secondary chat' }).click();
  await expect(page.getByRole('button', { name: 'Restore secondary chat' })).toBeVisible();
  fx.push(reportFrame('MINIMIZE-STALE-REPORT'));
  fx.push({ type: 'error', threadId: THREAD_A, error: 'Prompt failed' });
  await page.getByRole('button', { name: 'Restore secondary chat' }).click();
  secondary = page.locator('.rv-secondary-body');
  await expect(secondary).toBeVisible();
  await expect(secondary.locator('textarea')).toBeEnabled();
  await expect(secondary.locator('textarea')).toHaveValue('SECONDARY-PENDING-DRAFT');
  await expect(secondary.getByRole('button', { name: 'Ask AI', exact: true })).toBeEnabled();
  await secondary.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.type === 'prompt').length).toBe(2);
  fx.push({ type: 'message:sent', threadId: THREAD_A, content: 'SECONDARY-PENDING-DRAFT' });
  await expect(secondary.locator('textarea')).toHaveValue('');
  const askAI = secondary.getByRole('button', { name: 'Ask AI', exact: true });
  await expect(askAI).toBeEnabled();
  await askAI.click();
  await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(2);
  fx.push(reportFrame('MINIMIZE-RESTORED-REPORT'));
  await expect(secondary.locator('textarea')).toContainText('MINIMIZE-RESTORED-REPORT');
  expect(fx.sentFrames().filter((frame) => frame.type === 'prompt')).toHaveLength(2);
});

test('Slice C: unavailable frames require the complete pending route tuple', async () => {
  const mod = await import('../src/lib/ws/chat-diagnostic-handlers');
  const { usePanelStore } = await import('../src/state/panelStore');
  usePanelStore.setState({
    ws: { readyState: WebSocket.OPEN, send: () => undefined },
  } as never);
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
});

test('Slice C: an unattributable null echo resolves only through the bounded timeout', async () => {
  const mod = await import('../src/lib/ws/chat-diagnostic-handlers');
  const { usePanelStore } = await import('../src/state/panelStore');
  usePanelStore.setState({
    ws: { readyState: WebSocket.OPEN, send: () => undefined },
  } as never);
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
  await page.evaluate((value) => window.dispatchEvent(new CustomEvent('fusion:chat-action', { detail: { target: 'current', attachment: value } })), attachment);
  await textarea.fill('LATE-A-DRAFT');
  await page.getByRole('button', { name: 'Send message', exact: true }).first().click();
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.type === 'prompt').length).toBe(1);
  await selectThread(fx, page, 'b');
  await expect(textarea).toHaveValue('');
  await expect(page.getByLabel('Chat attachments')).toHaveCount(0);
  await page.evaluate((value) => window.dispatchEvent(new CustomEvent('fusion:chat-action', { detail: { target: 'current', attachment: value } })), attachment);
  await textarea.fill('KEEP-B-DRAFT');
  fx.push({ type: 'message:sent', threadId: THREAD_A, content: 'LATE-A-DRAFT' });
  await expect(textarea).toHaveValue('KEEP-B-DRAFT');
  await expect(page.getByLabel('Chat attachments').first()).toContainText('owner.txt');
});
