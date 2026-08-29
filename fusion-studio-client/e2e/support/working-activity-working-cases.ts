/** SPEC-05 Slice D permanent @working browser matrix. */
import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  THREAD_A, TURN_A1, begin, content, exchange, openedReply, snapshot,
  stepBegin, thinking, toolCall, toolResult,
} from './working-activity-wire';
import {
  assistantRows, expectStaysAbsent, expectTranscript, pushFrames, selectThread,
  setOpenReply, startWaSession, streamingCount, transcriptText,
} from './working-activity-scenario';

const WORKING = '.rv-working-activity';
const SECONDS = '.rv-working-activity-seconds';
const CHAT = '.rv-chat-messages';

async function waitForWorking(page: Page, timeout = 10_000): Promise<void> {
  await expect(page.locator(WORKING).first()).toBeVisible({ timeout });
}

async function startStep(browser: Browser, startedAt = Date.now() - 2_200) {
  const session = await startWaSession(browser);
  await pushFrames(session.fx, [
    begin(THREAD_A, TURN_A1, 1),
    stepBegin(THREAD_A, TURN_A1, 2, {
      identity: 'working-step-1', startedAt, activityRevision: 1,
    }),
  ]);
  await waitForWorking(session.page);
  return session;
}

async function expectOutputReplacesWorking(
  browser: Browser,
  kind: 'thinking' | 'content' | 'tool',
): Promise<void> {
  const { fx, page } = await startStep(browser);
  if (kind === 'thinking') {
    await pushFrames(fx, [thinking(THREAD_A, TURN_A1, 3, 'VISIBLE-THINKING', { activityRevision: 2 })]);
    await expectTranscript(page, { ordered: ['VISIBLE-THINKING'] });
  } else if (kind === 'content') {
    await pushFrames(fx, [content(THREAD_A, TURN_A1, 3, 'VISIBLE-CONTENT', { activityRevision: 2 })]);
    await expectTranscript(page, { ordered: ['VISIBLE-CONTENT'] });
  } else {
    await pushFrames(fx, [toolCall(THREAD_A, TURN_A1, 3, {
      toolName: 'read', toolCallId: 'tool-first', args: { path: 'VISIBLE-TOOL.txt' },
      activityRevision: 2,
    })]);
    await expect(page.locator('.rv-tool-fade-in').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.rv-tool-label').first()).toContainText('Read');
  }
  await expect(page.locator(WORKING)).toHaveCount(0);
}

export function registerWorkingCases(): void {
  test('@working delayed first step keeps the orb fallback, then shows a truthful nonzero label', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    await pushFrames(fx, [begin(THREAD_A, TURN_A1, 1)]);
    await expect(page.locator('.rv-orb-wrapper').first()).toBeVisible();
    await expect(page.locator(WORKING)).toHaveCount(0);
    await page.waitForTimeout(150);
    await pushFrames(fx, [stepBegin(THREAD_A, TURN_A1, 2, {
      identity: 'delayed', startedAt: Date.now() - 2_400, activityRevision: 1,
    })]);
    await waitForWorking(page);
    await expect(page.locator(SECONDS).first()).toHaveText(/^Working… [1-9]\d*s$/);
    await expect(page.locator(`${WORKING} .rv-hourglass-flow--sm`).first()).toBeVisible();
  });

  test('@working blank or opaque initial thinking keeps Working and creates no blank assistant row', async ({ browser }) => {
    const { page } = await startStep(browser);
    const before = await assistantRows(page);
    // The accepted server contract suppresses blank canonical output before
    // publication. An opaque step therefore has no downstream content frame.
    await page.waitForTimeout(250);
    await waitForWorking(page);
    expect(await assistantRows(page)).toHaveLength(before.length);
    expect(await transcriptText(page)).not.toMatch(/\n\s+\n/);
  });

  test('@working readable thinking replaces Working', async ({ browser }) =>
    expectOutputReplacesWorking(browser, 'thinking'));

  test('@working assistant content replaces Working', async ({ browser }) =>
    expectOutputReplacesWorking(browser, 'content'));

  test('@working tool-first output replaces Working', async ({ browser }) =>
    expectOutputReplacesWorking(browser, 'tool'));

  test('@working output during orb collapse prevents a Working flash', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    await pushFrames(fx, [
      begin(THREAD_A, TURN_A1, 1),
      stepBegin(THREAD_A, TURN_A1, 2, {
        identity: 'collapse-step', startedAt: Date.now() - 2_000, activityRevision: 1,
      }),
      content(THREAD_A, TURN_A1, 3, 'COLLAPSE-OUTPUT', { activityRevision: 2 }),
    ]);
    await expectTranscript(page, { ordered: ['COLLAPSE-OUTPUT'] });
    await expectStaysAbsent(page, 'Working…', 750);
  });

  test('@working a post-tool step appears after the already-revealed tool', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    await pushFrames(fx, [
      begin(THREAD_A, TURN_A1, 1),
      toolCall(THREAD_A, TURN_A1, 2, {
        toolName: 'read', toolCallId: 'post-tool', args: { path: 'POST-TOOL.txt' }, activityRevision: 1,
      }),
      toolResult(THREAD_A, TURN_A1, 3, { toolCallId: 'post-tool', output: 'POST-TOOL-RESULT' }),
      stepBegin(THREAD_A, TURN_A1, 4, {
        identity: 'post-tool-step', startedAt: Date.now() - 1_500, activityRevision: 2,
      }),
    ]);
    await waitForWorking(page);
    await expectTranscript(page, { ordered: ['POST-TOOL.txt', 'Working…'] });
    const ordered = await page.locator(CHAT).first().evaluate((chat) => {
      const tool = chat.querySelector('.rv-tool-fade-in');
      const working = chat.querySelector('.rv-working-activity');
      return Boolean(tool && working && (tool.compareDocumentPosition(working) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(ordered).toBe(true);
  });

  test('@working duplicate/stale step and stale snapshot cannot reset or resurrect cleared activity', async ({ browser }) => {
    const { fx, page } = await startStep(browser, Date.now() - 8_000);
    await pushFrames(fx, [content(THREAD_A, TURN_A1, 3, 'CLEAR-ACTIVITY', { activityRevision: 2 })]);
    await expectTranscript(page, { ordered: ['CLEAR-ACTIVITY'] });
    await expect(page.locator(WORKING)).toHaveCount(0);
    await pushFrames(fx, [stepBegin(THREAD_A, TURN_A1, 4, {
      identity: 'working-step-1', startedAt: Date.now() - 20_000, activityRevision: 3,
    })]);
    await expectStaysAbsent(page, 'Working…');
    await setOpenReply(fx, THREAD_A, openedReply({ threadId: THREAD_A, liveTurn: snapshot({
      threadId: THREAD_A, turnId: TURN_A1, streamSeq: 2, activityRevision: 1,
      activity: { kind: 'working', turnId: TURN_A1, identity: 'stale-snapshot', startedAt: 1, activityRevision: 1 },
      stepCursor: { identity: 'stale-snapshot', startedAt: 1 },
    }) }));
    await selectThread(fx, page, 'a');
    await expectStaysAbsent(page, 'Working…');
  });

  test('@working activity revision is strictly greater while valid output still follows streamSeq', async ({ browser }) => {
    const { fx, page } = await startStep(browser);
    await pushFrames(fx, [
      stepBegin(THREAD_A, TURN_A1, 3, { identity: 'equal-rev', startedAt: 1, activityRevision: 1 }),
      stepBegin(THREAD_A, TURN_A1, 4, { identity: 'lower-rev', startedAt: 1, activityRevision: 0 }),
    ]);
    await expect(page.locator(SECONDS).first()).not.toContainText(/Working… \d{6,}s/);
    await pushFrames(fx, [stepBegin(THREAD_A, TURN_A1, 5, {
      identity: 'greater-rev', startedAt: Date.now() - 1_500, activityRevision: 2,
    })]);
    await expect(page.locator(SECONDS).first()).toHaveText(/^Working… [1-9]\d?s$/);
    await pushFrames(fx, [content(THREAD_A, TURN_A1, 6, 'X', { activityRevision: 1 })]);
    await expectTranscript(page, { ordered: ['X'] });
    await pushFrames(fx, [content(THREAD_A, TURN_A1, 7, 'GREATER-CLEAR', { activityRevision: 3 })]);
    await expectTranscript(page, { ordered: ['X', 'GREATER-CLEAR'] });
    await expect(page.locator(WORKING)).toHaveCount(0);
  });

  test('@working a harness with no step event retains the orb fallback', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser);
    await pushFrames(fx, [begin(THREAD_A, TURN_A1, 1)]);
    await page.waitForTimeout(700);
    await expect(page.locator('.rv-orb-wrapper').first()).toBeVisible();
    await expect(page.locator(WORKING)).toHaveCount(0);
  });

  test('@working in-flight return restores original startedAt over an already-revealed baseline', async ({ browser }) => {
    const startedAt = Date.now() - 8_500;
    const { page } = await startWaSession(browser, { alpha: { threadId: THREAD_A, liveTurn: snapshot({
      threadId: THREAD_A, turnId: TURN_A1, streamSeq: 7,
      parts: [{ type: 'text', content: 'RETURN-BASELINE' }],
      activityRevision: 4, seenStepIdentities: ['return-step'],
      activity: { kind: 'working', turnId: TURN_A1, identity: 'return-step', startedAt, activityRevision: 4 },
      stepCursor: { identity: 'return-step', startedAt },
    }) } });
    await expectTranscript(page, { ordered: ['RETURN-BASELINE'] });
    expect((await assistantRows(page))[0].isLivePlane).toBe(false);
    await waitForWorking(page);
    await expect(page.locator(SECONDS).first()).toHaveText(/^Working… (?:[89]|\d{2,})s$/);
  });

  test('@working completed return is instant and historical metadata never creates Working', async ({ browser }) => {
    const historical = exchange('HISTORY-PROMPT', [{ type: 'text', content: 'HISTORY-CONTENT' }], 8);
    historical.metadata = { activity: { kind: 'working', startedAt: 1 } };
    const { page } = await startWaSession(browser, { alpha: {
      threadId: THREAD_A,
      exchanges: [historical],
      liveTurn: snapshot({ threadId: THREAD_A, turnId: TURN_A1, streamSeq: 9,
        status: 'complete', fullText: 'COMPLETE-INSTANT', parts: [{ type: 'text', content: 'COMPLETE-INSTANT' }] }),
    } });
    await expectTranscript(page, { ordered: ['HISTORY-CONTENT', 'COMPLETE-INSTANT'] });
    await expect(page.locator(WORKING)).toHaveCount(0);
    expect(await streamingCount(page)).toBe(0);
  });

  test('@working exposes one stable announcement while visual seconds change', async ({ browser }) => {
    const { page } = await startStep(browser);
    const status = page.getByRole('status', { name: 'Model working' });
    await expect(status).toHaveCount(1);
    await expect(status).toHaveAttribute('aria-live', 'polite');
    const seconds = page.locator(SECONDS).first();
    await expect(seconds).toHaveAttribute('aria-hidden', 'true');
    const before = await seconds.textContent();
    await expect.poll(() => seconds.textContent(), { timeout: 2_500 }).not.toBe(before);
    await expect(status).toHaveCount(1);
    await expect(status).toHaveAttribute('aria-label', 'Model working');
  });

  test('@working reduced motion keeps the status visible and clamps hourglass animation', async ({ browser }) => {
    const { fx, page } = await startWaSession(browser, {}, { reducedMotion: 'reduce' });
    await pushFrames(fx, [
      begin(THREAD_A, TURN_A1, 1),
      stepBegin(THREAD_A, TURN_A1, 2, { identity: 'reduced', startedAt: Date.now() - 1_000, activityRevision: 1 }),
    ]);
    await waitForWorking(page);
    const motion = await page.locator(`${WORKING} .rv-hourglass-flow-icon`).first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { duration: style.animationDuration, iterations: style.animationIterationCount };
    });
    expect(motion.iterations).toBe('1');
    expect(['0.001s', '0s']).toContain(motion.duration);
  });
}
