/** SPEC-05 Slice D permanent @terminal-error explicit diagnostic matrix. */
import { expect, test, type Browser } from '@playwright/test';
import {
  THREAD_A, THREAD_B, exchange, terminalError,
} from './working-activity-wire';
import {
  ConsoleTap, selectThread, startWaSession,
} from './working-activity-scenario';

const TURN_ID = 'terminal-diagnostic-turn';
const DIAGNOSTIC_ID = 'terminal-diagnostic-id';

function diagnosticHistory() {
  const saved = exchange('DIAGNOSTIC-PROMPT', [{ type: 'text', content: 'DIAGNOSTIC-PARTIAL' }], 51);
  saved.metadata = { turnId: TURN_ID, terminalError: terminalError('MODEL_RESPONSE_FAILED', DIAGNOSTIC_ID) };
  return saved;
}

async function startDiagnostic(browser: Browser) {
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

export function registerDiagnosticCases(): void {
  test('@terminal-error View is explicit-only, uses the exact tuple, and report canaries never enter any console argument', async ({ browser }) => {
    const { fx, page } = await startDiagnostic(browser);
    const tap = new ConsoleTap(page);
    tap.attach();
    const view = page.getByRole('button', { name: 'View', exact: true }).first();
    await expect(view).toBeVisible();
    await view.focus();
    await page.locator('section textarea').first().focus();
    expect(diagnosticGets(fx.sentFrames())).toHaveLength(0);
    await view.click();
    await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
    expect(diagnosticGets(fx.sentFrames())[0]).toEqual({
      type: 'chat-turn:diagnostic:get', threadId: THREAD_A,
      turnId: TURN_ID, diagnosticId: DIAGNOSTIC_ID,
    });
    const canary = 'PERMANENT-DIAGNOSTIC-LOG-CANARY';
    fx.push(reportFrame(canary));
    await expect(page.locator('.rv-chat-diagnostic-report').first()).toContainText(canary);
    expect(tap.dump()).not.toContain(canary);
    const calls = await tap.calls();
    expect(JSON.stringify(calls)).not.toContain(canary);
    const diagnosticCalls = calls.filter((call) => JSON.stringify(call.args).includes('chat-turn:diagnostic:report'));
    expect(diagnosticCalls).toHaveLength(1);
    expect(diagnosticCalls[0].args).toEqual([
      '[WS] Message received:', 'chat-turn:diagnostic:report', {
        type: 'chat-turn:diagnostic:report', threadId: THREAD_A,
        turnId: TURN_ID, diagnosticId: DIAGNOSTIC_ID,
      },
    ]);
  });

  test('@terminal-error Copy fetches only on activation and copies only the validated report', async ({ browser }) => {
    const { fx, page } = await startDiagnostic(browser);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => {
          const target = window as Window & { __terminalCopies?: string[] };
          (target.__terminalCopies ??= []).push(text);
        } },
      });
    });
    const copy = page.getByRole('button', { name: 'Copy', exact: true }).first();
    expect(diagnosticGets(fx.sentFrames())).toHaveLength(0);
    expect(fx.sentFrames().filter((frame) => frame.type === 'clipboard:append')).toHaveLength(0);
    expect(await page.evaluate(() => (window as Window & { __terminalCopies?: string[] }).__terminalCopies ?? [])).toHaveLength(0);
    await copy.click();
    await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
    fx.push(reportFrame('COPY-VALIDATED-CANARY'));
    await expect.poll(() => fx.sentFrames().filter((frame) => frame.type === 'clipboard:append').length).toBe(1);
    fx.push({ type: 'clipboard:append', item: { id: 91, type: 'text', preview: 'redacted', last_used_at: 1, source: 'chat-diagnostic' } });
    await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText('Diagnostic copied.');
    const copies = await page.evaluate(() => (window as Window & { __terminalCopies?: string[] }).__terminalCopies ?? []);
    expect(copies).toHaveLength(1);
    const copied = copies[0];
    expect(copied).toContain('COPY-VALIDATED-CANARY');
    expect(copied).not.toContain('[object Object]');
    expect(fx.sentFrames().filter((frame) => frame.type === 'clipboard:append')).toEqual([{
      type: 'clipboard:append', text: copied, source: 'chat-diagnostic',
    }]);
  });

  test('@terminal-error Ask AI adds the report to the draft without sending a prompt', async ({ browser }) => {
    const { fx, page } = await startDiagnostic(browser);
    const textarea = page.locator('section textarea').first();
    await textarea.fill('KEEP-EXISTING-DRAFT');
    const ask = page.getByRole('button', { name: 'Ask AI', exact: true }).first();
    await ask.click();
    await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
    fx.push(reportFrame('ASK-AI-REPORT-CANARY'));
    await expect(textarea).toHaveValue(/^KEEP-EXISTING-DRAFT\n\n/);
    await expect(textarea).toContainText('ASK-AI-REPORT-CANARY');
    expect(fx.sentFrames().filter((frame) => frame.type === 'prompt')).toHaveLength(0);
    await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText(
      'Diagnostic added to the composer for review.',
    );
  });

  test('@terminal-error Ask AI cannot overwrite a server-owned pending acceptance', async ({ browser }) => {
    const { fx, page } = await startDiagnostic(browser);
    const textarea = page.locator('section textarea').first();
    const ask = page.getByRole('button', { name: 'Ask AI', exact: true }).first();
    await ask.click();
    await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
    await textarea.fill('ACCEPTANCE-DRAFT');
    await page.getByRole('button', { name: 'Send message', exact: true }).first().click();
    await expect.poll(() => fx.sentFrames().filter((frame) => frame.type === 'prompt').length).toBe(1);
    fx.push(reportFrame('PENDING-REPORT-CANARY'));
    await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText(
      'Wait for the current message to be accepted, then try again.',
    );
    await expect(textarea).toHaveValue('ACCEPTANCE-DRAFT');
    expect(fx.sentFrames().filter((frame) => frame.type === 'prompt')).toHaveLength(1);
  });

  test('@terminal-error missing expired or rejected diagnostic returns one fixed unavailable state', async ({ browser }) => {
    const { fx, page } = await startDiagnostic(browser);
    await page.getByRole('button', { name: 'View', exact: true }).first().click();
    await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
    fx.push({
      type: 'chat-turn:diagnostic:unavailable', threadId: THREAD_A,
      turnId: TURN_ID, diagnosticId: DIAGNOSTIC_ID,
    });
    await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText(
      'Diagnostic details are unavailable.',
    );
    await expect(page.locator('.rv-chat-diagnostic-report')).toHaveCount(0);
  });

  test('@terminal-error malformed retrieved report fails closed without displaying its canary', async ({ browser }) => {
    const { fx, page } = await startDiagnostic(browser);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => {
          (window as Window & { __invalidDiagnosticCopy?: boolean }).__invalidDiagnosticCopy = true;
        } },
      });
    });
    await page.getByRole('button', { name: 'Copy', exact: true }).first().click();
    await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
    const malformed = reportFrame('MALFORMED-REPORT-CANARY');
    (malformed.report as Record<string, unknown>).rawError = 'RAW-UNKNOWN-FIELD-CANARY';
    fx.push(malformed);
    await expect(page.locator('.rv-chat-diagnostic-status').first()).toHaveText(
      'Diagnostic details are unavailable.',
    );
    await expect(page.locator('.rv-chat-diagnostic-report')).toHaveCount(0);
    expect(fx.sentFrames().filter((frame) => frame.type === 'clipboard:append')).toHaveLength(0);
    expect(await page.evaluate(() => (window as Window & { __invalidDiagnosticCopy?: boolean }).__invalidDiagnosticCopy)).not.toBe(true);
  });

  test('@terminal-error exact-route request survives unmount/remount without a duplicate fetch', async ({ browser }) => {
    const { fx, page } = await startDiagnostic(browser);
    await page.getByRole('button', { name: 'View', exact: true }).first().click();
    await expect.poll(() => diagnosticGets(fx.sentFrames()).length).toBe(1);
    await selectThread(fx, page, 'b');
    await selectThread(fx, page, 'a');
    await page.getByRole('button', { name: 'View', exact: true }).first().click();
    expect(diagnosticGets(fx.sentFrames())).toHaveLength(1);
    fx.push(reportFrame('REMOUNT-DIAGNOSTIC-CANARY'));
    await expect(page.locator('.rv-chat-diagnostic-report').first()).toContainText('REMOUNT-DIAGNOSTIC-CANARY');
  });

  test('@terminal-error complement(node): unavailable response requires the exact route tuple', async () => {
    const mod = await import('../../src/lib/ws/chat-diagnostic-handlers');
    const { usePanelStore } = await import('../../src/state/panelStore');
    usePanelStore.setState({ ws: { readyState: WebSocket.OPEN, send: () => undefined } } as never);
    let settled = false;
    const pending = mod.requestChatTurnDiagnostic({
      threadId: 'tuple-a', turnId: 'tuple-turn', diagnosticId: 'tuple-diagnostic',
    });
    void pending.then(() => { settled = true; });
    mod.handleChatDiagnosticUnavailableFrame({
      type: 'chat-turn:diagnostic:unavailable', threadId: 'tuple-b',
      turnId: 'tuple-turn', diagnosticId: 'tuple-diagnostic',
    } as never);
    await Promise.resolve();
    expect(settled).toBe(false);
    mod.handleChatDiagnosticUnavailableFrame({
      type: 'chat-turn:diagnostic:unavailable', threadId: 'tuple-a',
      turnId: 'tuple-turn', diagnosticId: 'tuple-diagnostic',
    } as never);
    await expect(pending).resolves.toBeNull();
  });
}
