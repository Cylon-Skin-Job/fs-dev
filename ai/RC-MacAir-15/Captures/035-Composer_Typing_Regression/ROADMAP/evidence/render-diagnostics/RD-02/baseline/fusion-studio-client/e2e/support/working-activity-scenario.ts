/**
 * @module e2e/support/working-activity-scenario
 * @role One-job scenario ergonomics for the SPEC-04 fixture lane: page
 *       bootstrap, downstream push helpers, transcript readers, and bounded
 *       absence probes over the running packaged client (SPEC-04 §3 Slice D
 *       item 2 — "Scenario API ergonomics").
 *
 * All assertions observe PUBLIC UI structure only: ordered `.rv-message`
 * rows, transcript inner text, and the `.rv-message-assistant-content.streaming`
 * live-plane marker. Thread-open completion is tracked through the
 * fixture controller's outbound frame log (`thread:open` requests), never UI
 * guesses. Wall-clock appears only as bounded assertion dampers.
 */

import {
  expect,
  type Browser,
  type BrowserContextOptions,
  type ConsoleMessage,
  type Page,
} from '@playwright/test';
import {
  NAME_A,
  NAME_B,
  TURN_A1,
  THREAD_A,
  THREAD_B,
  content,
  openedReply,
  sampleTerminalError,
  snapshot,
  turnEnd,
} from './working-activity-wire';
import type { OpenedReplySpec } from './working-activity-wire';
import { installWaFixture } from './working-activity-ws-fixture';
import type { WaFixture } from './working-activity-ws-fixture';

// Multiple workspace panels host MIRRORED chat columns bound to the same
// global thread slot. Readers anchor on the FIRST chat column (DOM-stable)
// so mirrored markup never multiplies assertion counts; sidebar interactions
// restrict themselves to VISIBLE items.
const FIRST_CHAT = '.rv-chat-messages';

export interface RowInfo {
  text: string;
  isLivePlane: boolean;
}

export interface WaPageSpec {
  alpha?: OpenedReplySpec;
  beta?: OpenedReplySpec;
}

export interface WaSession {
  fx: WaFixture;
  page: Page;
}

/** Boot the shell with both canned threads; MRU auto-open selects ALPHA. */
export async function startWaSession(
  browser: Browser,
  spec: WaPageSpec = {},
  contextOptions: BrowserContextOptions = {},
): Promise<WaSession> {
  const context = await browser.newContext(contextOptions);
  const alpha = spec.alpha ?? { threadId: THREAD_A };
  const beta = spec.beta ?? { threadId: THREAD_B };
  const fixture = await installWaFixture(context, {
    list: {
      threads: [THREAD_A, THREAD_B].map((id, index) => ({
        threadId: id,
        entry: {
          name: index === 0 ? NAME_A : NAME_B,
          createdAt: '2026-08-01T00:00:00.000Z',
          messageCount: 0,
          status: 'active',
          scope: 'project',
        },
      })),
    },
    openByThreadId: {
      [THREAD_A]: openedReply(alpha) as Record<string, unknown>,
      [THREAD_B]: openedReply(beta) as Record<string, unknown>,
    },
  });
  const page = await context.newPage();
  await page.goto('/');
  // Deterministic readiness chain: socket routed → workspace:init processed
  // → BOTH canned replies served (thread:list + MRU thread:open) and handed
  // to the renderer → items render with the ALPHA slot hydrated.
  await expect(fixture.whenOpen()).resolves.toBeUndefined();
  await expect(fixture.settled(2)).resolves.toBeUndefined();
  await expect(page.locator(`.rv-chat-item >> visible=true`).first()).toBeVisible({ timeout: 15_000 });
  await expect(fixture.openHandled(THREAD_A, 1)).resolves.toBeUndefined(); // ALPHA slot hydrated
  await expect(page.locator(`section textarea`).first()).toBeEnabled({ timeout: 10_000 });
  return { fx: fixture, page };
}

async function countOpensFor(fixture: WaFixture, threadId: string): Promise<number> {
  return fixture.sentFrames()
    .filter((frame) => frame.type === 'thread:open' && frame.threadId === threadId)
    .length;
}

/** Switch the visible thread through the sidebar (intercepted open). */
export async function selectThread(fixture: WaFixture, page: Page, which: 'a' | 'b'): Promise<void> {
  const threadId = which === 'b' ? THREAD_B : THREAD_A;
  const before = await countOpensFor(fixture, threadId);
  // The item row bundles name + meta; match containment on a VISIBLE row.
  await page.locator(`.rv-chat-item:has-text("${which === 'b' ? NAME_B : NAME_A}") >> visible=true`).first().click();
  const target = before + 1;
  await expect.poll(() => countOpensFor(fixture, threadId)).toBe(target); // request sent
  await expect(fixture.openHandled(threadId, target)).resolves.toBeUndefined(); // reply handled
  await expect(page.locator(`${FIRST_CHAT} ~ * textarea, section textarea`).first()).toBeEnabled();
}

/** Push authored downstream frames in exact order (in-order dispatch). */
export async function pushFrames(fixture: WaFixture, frames: unknown[]): Promise<void> {
  fixture.push(frames);
}

/** Replace parts of the scenario reply table mid-test. */
export async function setOpenReply(
  fixture: WaFixture,
  threadId: string,
  reply: Record<string, unknown>,
): Promise<void> {
  fixture.setReplies({ openByThreadId: { [threadId]: reply } });
}

/**
 * Drop the whole reply table mid-scenario: subsequent intercepted opens are
 * swallowed silently (still recorded), scripting deterministic server lag.
 */
export async function clearOpenReplies(fixture: WaFixture): Promise<void> {
  fixture.resetReplies();
}

/** Parsed outbound intercepted frames (oldest first). */
export async function sentFrames(fixture: WaFixture): Promise<Array<Record<string, unknown>>> {
  return fixture.sentFrames();
}

/**
 * Ordered assistant/live-plane rows currently rendered for the panel.
 * `isLivePlane` marks the animated current-turn row (`.streaming` marker).
 */
export async function assistantRows(page: Page): Promise<RowInfo[]> {
  return page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((row) => ({
    text: (row.textContent ?? '').trim(),
    isLivePlane: Boolean(row.querySelector('.rv-message-assistant-content.streaming')),
  })), `${FIRST_CHAT} .rv-message-assistant`);
}

/** Whole-transcript text (user + assistant rows + live plane). */
export async function transcriptText(page: Page): Promise<string> {
  return page.evaluate((sel) => document.querySelector(sel)?.textContent ?? '', FIRST_CHAT);
}

/** Ordered user/assistant row classes — DOM order proof of whole transcript. */
export async function rowOrder(page: Page): Promise<Array<'user' | 'assistant'>> {
  return page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(
    (row) => ((row as HTMLElement).classList.contains('rv-message-user') ? 'user' : 'assistant'),
  ), `${FIRST_CHAT} .rv-message`);
}

/**
 * Bounded absence probe: re-check every ~60ms for `ms` total and fail the
 * moment `needle` shows up inside the transcript.
 */
export async function expectStaysAbsent(page: Page, needle: string, ms = 400): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    expect(await transcriptText(page)).not.toContain(needle);
    await page.waitForTimeout(60);
  }
}

/** Streaming-marker count across the panel (live reveal plane size). */
export async function streamingCount(page: Page): Promise<number> {
  return page.evaluate(
    (sel) => document.querySelectorAll(sel).length,
    `${FIRST_CHAT} .rv-message-assistant-content.streaming`,
  );
}

/**
 * Poll until the transcript satisfies every condition: `ordered` tokens must
 * appear in ascending index order, `counts` regexes must match exactly n
 * times. Reveal pacing means multi-segment streams surface progressively,
 * so EVERY positive multi-token assertion rides this poller.
 */
export async function expectTranscript(
  page: Page,
  opts: { ordered?: string[]; counts?: Array<[RegExp, number]> },
): Promise<void> {
  await expect.poll(async () => {
    const text = await transcriptText(page);
    let cursor = -1;
    for (const token of opts.ordered ?? []) {
      const at = text.indexOf(token);
      if (at <= cursor) return false;
      cursor = at;
    }
    return (opts.counts ?? []).every(([pattern, n]) =>
      (text.match(pattern) ?? []).length === n);
  }, { timeout: 10_000 }).toBe(true);
}

/**
 * Public-UI proof for the unfinished snapshot projection boundary: baseline
 * output has no message chrome; the later error tail owns the only alert and
 * reply shell, in that order.
 */
export async function expectUnfinishedCatchupErrorPresentation(browser: Browser): Promise<void> {
  const { fx, page } = await startWaSession(browser, { alpha: { threadId: THREAD_A, liveTurn: snapshot({
    threadId: THREAD_A,
    turnId: TURN_A1,
    streamSeq: 5,
    parts: [
      { type: 'text', content: 'CATCHUP-BASELINE-OUTPUT' },
      {
        type: 'tool_call',
        toolCallId: 'catchup-tool',
        name: 'read',
        arguments: { path: 'CATCHUP-BASELINE-TOOL.txt' },
        result: { output: 'baseline tool result' },
      },
    ],
  }) } });
  const chat = page.locator(FIRST_CHAT).first();
  await expectTranscript(page, { ordered: ['CATCHUP-BASELINE-OUTPUT', 'baseline tool result'] });
  await expect(chat.locator('.rv-assistant-reply-shell')).toHaveCount(0);

  await pushFrames(fx, [
    content(THREAD_A, TURN_A1, 6, 'CATCHUP-LATER-OUTPUT'),
    turnEnd(THREAD_A, TURN_A1, 7, {
      reason: 'error',
      fullText: 'CATCHUP-BASELINE-OUTPUT CATCHUP-LATER-OUTPUT',
      terminalError: sampleTerminalError(),
    }),
  ]);
  await expectTranscript(page, {
    ordered: ['CATCHUP-BASELINE-OUTPUT', 'baseline tool result', 'CATCHUP-LATER-OUTPUT', 'Response failed'],
    counts: [[/CATCHUP-LATER-OUTPUT/g, 1], [/Response failed/g, 1]],
  });
  const rows = chat.locator('.rv-message-assistant');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.rv-assistant-reply-shell')).toHaveCount(0);
  await expect(rows.nth(1)).toContainText('CATCHUP-LATER-OUTPUT');
  await expect(rows.nth(1).locator('.rv-chat-turn-error')).toHaveCount(1);
  await expect(rows.nth(1).locator('.rv-assistant-reply-shell')).toHaveCount(1);
  expect(await rows.nth(1).evaluate((row) => {
    const error = row.querySelector('.rv-chat-turn-error');
    const chrome = row.querySelector('.rv-assistant-reply-shell');
    return Boolean(error && chrome && (error.compareDocumentPosition(chrome) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await expect(chat.locator('.rv-assistant-reply-shell')).toHaveCount(1);
}

export interface CapturedConsoleCall {
  text: string;
  args: unknown[];
}

/** Console collector retaining both rendered text and every argument value. */
export class ConsoleTap {
  private readonly lines: string[] = [];
  private readonly captures: Array<Promise<CapturedConsoleCall>> = [];
  private readonly handler = (msg: ConsoleMessage): void => {
    this.lines.push(msg.text());
    this.captures.push(Promise.all(msg.args().map(async (arg) => {
      try {
        return await arg.jsonValue();
      } catch {
        return '<unserializable-console-argument>';
      }
    })).then((args) => ({ text: msg.text(), args })));
  };

  constructor(private readonly page: Page) {}

  attach(): void {
    this.page.on('console', this.handler);
  }

  dump(): string {
    return this.lines.join('\n');
  }

  async calls(): Promise<CapturedConsoleCall[]> {
    return Promise.all(this.captures);
  }
}
