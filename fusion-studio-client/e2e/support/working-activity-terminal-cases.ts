/** SPEC-05 Slice D permanent @terminal-error lifecycle/presentation matrix. */
import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  THREAD_A, TURN_A1, begin, chatTurnSaved, content, exchange, snapshot,
  terminalError, toolCall, toolResult, turnEnd,
} from './working-activity-wire';
import {
  ConsoleTap, assistantRows, expectStaysAbsent, expectTranscript, pushFrames,
  startWaSession, transcriptText,
} from './working-activity-scenario';

const CHAT = '.rv-chat-messages';
const ALERT = '.rv-chat-turn-error[role="alert"]';
const CHROME = '.rv-assistant-reply-shell';

function durableErrorExchange(prompt: string, turnId: string, body = '') {
  const saved = exchange(prompt, body ? [{ type: 'text' as const, content: body }] : [], 41);
  saved.metadata = { turnId, terminalError: terminalError() };
  return saved;
}

async function expectOneError(page: Page, code = 'MODEL_RESPONSE_FAILED'): Promise<void> {
  const chat = page.locator(CHAT).first();
  await expect(chat.locator(ALERT)).toHaveCount(1);
  await expect(chat.locator(ALERT)).toHaveAttribute('data-error-code', code);
  await expect(chat.locator(CHROME)).toHaveCount(1);
  expect(await chat.locator('.rv-message-assistant').last().evaluate((row) => {
    const error = row.querySelector('.rv-chat-turn-error');
    const chrome = row.querySelector('.rv-assistant-reply-shell');
    return Boolean(error && chrome && (error.compareDocumentPosition(chrome) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
}

async function expectPartialFlush(browser: Browser, kind: 'text' | 'tool'): Promise<void> {
  const { fx, page } = await startWaSession(browser);
  const frames: unknown[] = [begin(THREAD_A, TURN_A1, 1)];
  if (kind === 'text') frames.push(content(THREAD_A, TURN_A1, 2, 'PARTIAL-TEXT'));
  else frames.push(
    toolCall(THREAD_A, TURN_A1, 2, {
      toolName: 'read', toolCallId: 'partial-tool', args: { path: 'PARTIAL-TOOL.txt' },
    }),
    toolResult(THREAD_A, TURN_A1, 3, { toolCallId: 'partial-tool', output: 'PARTIAL-TOOL-RESULT' }),
  );
  frames.push(turnEnd(THREAD_A, TURN_A1, kind === 'text' ? 3 : 4, {
    reason: 'error', fullText: kind === 'text' ? 'PARTIAL-TEXT' : '',
    terminalError: terminalError(),
  }));
  await pushFrames(fx, frames);
  await expectOneError(page);
  await expectTranscript(page, { ordered: [kind === 'text' ? 'PARTIAL-TEXT' : 'PARTIAL-TOOL.txt', 'Response failed'] });
  const sourceSelector = kind === 'text' ? '.rv-segment-text, .rv-message-assistant-content' : '.rv-tool-fade-in';
  expect(await page.locator(CHAT).first().evaluate((chat, { sourceSelector, alertSelector }) => {
    const source = chat.querySelector(sourceSelector);
    const error = chat.querySelector(alertSelector);
    return Boolean(source && error && (source.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING));
  }, { sourceSelector, alertSelector: ALERT })).toBe(true);
}

export function registerTerminalCases(): void {
  test('@terminal-error no-output post-begin failure renders one safe error before reply chrome', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    await pushFrames(fx, [
      begin(THREAD_A, TURN_A1, 1),
      turnEnd(THREAD_A, TURN_A1, 2, { reason: 'error', terminalError: terminalError() }),
    ]);
    await expectOneError(page);
    await expect(page.locator(ALERT).first()).toContainText('The model response failed before it completed.');
  });

  test('@terminal-error partial text flushes immediately before the error', async ({ browser }) =>
    expectPartialFlush(browser, 'text'));

  test('@terminal-error partial tool flushes immediately before the error', async ({ browser }) =>
    expectPartialFlush(browser, 'tool'));

  test('@terminal-error authentication has one inline row plus the existing notification', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    await pushFrames(fx, [
      begin(THREAD_A, TURN_A1, 1),
      turnEnd(THREAD_A, TURN_A1, 2, {
        reason: 'error', terminalError: terminalError('AUTHENTICATION_FAILED'),
      }),
      { type: 'auth_error', threadId: THREAD_A, message: 'Authentication failed' },
    ]);
    await expectOneError(page, 'AUTHENTICATION_FAILED');
    await expect(page.locator('.rv-toast')).toContainText('Authentication failed');
    await expect(page.locator(ALERT)).toHaveCount(1);
  });

  test('@terminal-error pre-begin transport failure creates no transcript row', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    const before = await assistantRows(page);
    await pushFrames(fx, [{ type: 'error', threadId: THREAD_A, error: 'Prompt failed' }]);
    await page.waitForTimeout(250);
    expect(await assistantRows(page)).toHaveLength(before.length);
    await expect(page.locator(ALERT)).toHaveCount(0);
  });

  test('@terminal-error post-terminal companion never duplicates the authoritative inline row', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    await pushFrames(fx, [
      begin(THREAD_A, TURN_A1, 1),
      turnEnd(THREAD_A, TURN_A1, 2, { reason: 'error', terminalError: terminalError() }),
      { type: 'error', threadId: THREAD_A, error: 'Model response failed' },
    ]);
    await expectOneError(page);
    expect((await transcriptText(page)).match(/Response failed/g)).toHaveLength(1);
  });

  test('@terminal-error wrong-turn terminal cannot mutate the active turn', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    await pushFrames(fx, [
      begin(THREAD_A, TURN_A1, 1),
      turnEnd(THREAD_A, 'wrong-turn', 2, { reason: 'error', terminalError: terminalError() }),
      content(THREAD_A, TURN_A1, 2, 'ACTIVE-SURVIVES'),
    ]);
    await expectTranscript(page, { ordered: ['ACTIVE-SURVIVES'] });
    await expect(page.locator(ALERT)).toHaveCount(0);
  });

  test('@terminal-error terminal snapshot before save renders exactly one message and error', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser, { alpha: { threadId: THREAD_A, liveTurn: snapshot({
      threadId: THREAD_A, turnId: TURN_A1, streamSeq: 7, status: 'error',
      fullText: 'SNAPSHOT-PARTIAL', parts: [{ type: 'text', content: 'SNAPSHOT-PARTIAL' }],
      terminalError: terminalError(),
    }) } });
    await expectOneError(page);
    await pushFrames(fx, [chatTurnSaved(THREAD_A, TURN_A1, { exchangeId: 77 })]);
    await expectOneError(page);
    expect((await transcriptText(page)).match(/SNAPSHOT-PARTIAL/g)).toHaveLength(1);
    expect(await assistantRows(page)).toHaveLength(1);
  });

  test('@terminal-error typed live envelope and durable save metadata merge into one completed row', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    const exact = terminalError('MODEL_TIMEOUT');
    await pushFrames(fx, [
      begin(THREAD_A, TURN_A1, 1),
      content(THREAD_A, TURN_A1, 2, 'SAVE-MERGE-BODY'),
      turnEnd(THREAD_A, TURN_A1, 3, { reason: 'error', fullText: 'SAVE-MERGE-BODY', terminalError: exact }),
      chatTurnSaved(THREAD_A, TURN_A1, { exchangeId: 88, metadata: { turnId: TURN_A1, terminalError: exact } }),
    ]);
    await expectOneError(page, 'MODEL_TIMEOUT');
    expect((await transcriptText(page)).match(/SAVE-MERGE-BODY/g)).toHaveLength(1);
    expect(await assistantRows(page)).toHaveLength(1);
  });

  test('@terminal-error saved-history reopen renders one durable safe error', async ({ browser }) => {
    const { page } = await startWaSession(browser, { alpha: {
      threadId: THREAD_A, exchanges: [durableErrorExchange('HISTORY-FAIL', 'history-turn', 'HISTORY-PARTIAL')],
    } });
    await expectOneError(page);
    expect((await transcriptText(page)).match(/Response failed/g)).toHaveLength(1);
  });

  test('@terminal-error hostile raw envelope is sanitized before frontier buffering and logging', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    const tap = new ConsoleTap(page);
    tap.attach();
    const canary = 'RAW-FRONTIER-SECRET-CANARY';
    await pushFrames(fx, [begin(THREAD_A, TURN_A1, 1)]);
    await pushFrames(fx, [{
      type: 'turn_end', threadId: THREAD_A, turnId: TURN_A1, streamSeq: 3,
      activityRevision: 3, reason: 'error', partial: true,
      terminalError: { code: 'PROVIDER_RAW', message: canary, stack: canary, recoverable: false },
    }]);
    await expectStaysAbsent(page, canary);
    await pushFrames(fx, [content(THREAD_A, TURN_A1, 2, 'RAW-BUFFER-PARTIAL')]);
    await expectOneError(page);
    await expectTranscript(page, { ordered: ['RAW-BUFFER-PARTIAL', 'MODEL_RESPONSE_FAILED'] });
    expect(await page.locator(ALERT).first().textContent()).not.toContain(canary);
    expect(tap.dump()).not.toContain(canary);
    expect(JSON.stringify(await tap.calls())).not.toContain(canary);
  });

  test('@terminal-error exactly one alert survives the later save rerender', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    await pushFrames(fx, [
      begin(THREAD_A, TURN_A1, 1),
      turnEnd(THREAD_A, TURN_A1, 2, { reason: 'error', terminalError: terminalError() }),
    ]);
    await expect(page.getByRole('alert')).toHaveCount(1);
    await pushFrames(fx, [chatTurnSaved(THREAD_A, TURN_A1, { exchangeId: 99 })]);
    await expect(page.getByRole('alert')).toHaveCount(1);
  });

  test('@terminal-error unscoped generic error cannot clear or terminalize another active turn', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    await pushFrames(fx, [begin(THREAD_A, TURN_A1, 1)]);
    await pushFrames(fx, [{ type: 'error', error: 'UNSCOPED-RAW-CANARY' }]);
    await pushFrames(fx, [content(THREAD_A, TURN_A1, 2, 'AFTER-UNSCOPED')]);
    await expectTranscript(page, { ordered: ['AFTER-UNSCOPED'] });
    await expect(page.locator(ALERT)).toHaveCount(0);
  });

  test('@terminal-error same-prompt empty retry keeps distinct turn identities through snapshot/save', async ({ browser }) => {
    const first = durableErrorExchange('SAME-PROMPT', 'retry-old');
    const { fx, page } = await startWaSession(browser, { alpha: {
      threadId: THREAD_A, exchanges: [first], liveTurn: snapshot({
        threadId: THREAD_A, turnId: 'retry-new', userInput: 'SAME-PROMPT', streamSeq: 4,
        status: 'error', terminalError: terminalError(),
      }),
    } });
    await expect(page.locator(ALERT)).toHaveCount(2);
    await pushFrames(fx, [chatTurnSaved(THREAD_A, 'retry-new', { exchangeId: 42 })]);
    await expect(page.locator(ALERT)).toHaveCount(2);
    expect(await assistantRows(page)).toHaveLength(2);
  });
}
