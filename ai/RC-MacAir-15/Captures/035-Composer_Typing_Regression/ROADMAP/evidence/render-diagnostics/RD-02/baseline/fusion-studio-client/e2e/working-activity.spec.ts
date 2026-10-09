/**
 * @module e2e/working-activity.spec
 * @role Integrated RCC-0108 browser contract: SPEC-04 routing/frontier plus
 * SPEC-05 Working and terminal-error cases registered from focused support.
 * Proof is public UI except explicitly labeled Node complements.
 */

import { expect, test } from '@playwright/test';
import {
  THREAD_A, THREAD_B, TURN_A1, TURN_B1, begin, chatTurnSaved, content,
  diagnosticReportFrame, exchange, exchangeMetadata, metadataUpdated,
  openedReply, sampleTerminalError, snapshot, statusUpdate, stepBegin,
  subagentEvent, thinking, toolCall, toolCallArgs, toolResult, turnEnd,
} from './support/working-activity-wire';
import type { LiveTurnSnapshot } from '../src/types';
import {
  ConsoleTap, assistantRows, clearOpenReplies, expectStaysAbsent,
  expectTranscript, expectUnfinishedCatchupErrorPresentation, pushFrames, rowOrder, selectThread, setOpenReply,
  startWaSession, streamingCount, transcriptText,
} from './support/working-activity-scenario';
import { registerWorkingCases } from './support/working-activity-working-cases';
import { registerTerminalCases } from './support/working-activity-terminal-cases';
import { registerDiagnosticCases } from './support/working-activity-diagnostic-cases';

const T_A = TURN_A1;

// ─── Routing (SPEC-04 §5 "Routing") ───────────────────────────────────────

test('@routing routing: turn_begin initializes a thread panel with no current turn', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser, { alpha: { threadId: THREAD_A, exchanges: [exchange('HIST-U', [{ type: 'text', content: 'HIST-A' }], 1)] } });
  await pushFrames(fx, [
    begin(THREAD_A, T_A, 1),
    content(THREAD_A, T_A, 2, 'NULLPANEL-WELCOME'),
  ]);
  // History row survived, and the newly begun live turn renders below it.
  await expectTranscript(page, { ordered: ['HIST-A', 'NULLPANEL-WELCOME'] });
  expect(await rowOrder(page)).toEqual(['user', 'assistant', 'assistant']);
  expect((await assistantRows(page)).at(-1)?.isLivePlane).toBe(true);
});

test('@routing routing: same-turnId duplicate begin is idempotent and never resets streamed output', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  await pushFrames(fx, [
    begin(THREAD_A, T_A, 1),
    content(THREAD_A, T_A, 2, 'DUP-KEEP'),
    begin(THREAD_A, T_A, 7), // duplicate ID: idempotent no-op
    content(THREAD_A, T_A, 3, 'DUP-MORE'),
  ]);
  // Both survive IN ORDER: nothing was reset or restarted by the duplicate.
  await expectTranscript(page, { ordered: ['DUP-KEEP', 'DUP-MORE'], counts: [[/DUP-/g, 2]] });
  expect(await assistantRows(page)).toHaveLength(1);
});

test('@routing routing: different-active-turnId begin rejected without reset', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  await pushFrames(fx, [
    begin(THREAD_A, T_A, 1),
    content(THREAD_A, T_A, 2, 'KEEP-FIRST'),
    begin(THREAD_A, 'wa-turn-intruder', 3), // rejected: different active ID
    content(THREAD_A, 'wa-turn-intruder', 4, 'REJECTED-INTRUDER'),
    content(THREAD_A, T_A, 3, 'KEPT-GROWTH'), // original gate still intact
  ]);
  await expectTranscript(page, { ordered: ['KEEP-FIRST', 'KEPT-GROWTH'] });
  await expectStaysAbsent(page, 'REJECTED-INTRUDER');
});

test('@routing routing: wrong-thread and wrong-turn frames drop before any store or helper mutation', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  await pushFrames(fx, [begin(THREAD_A, T_A, 1)]);
  // Same poisoned toolCallId for both mis-routes: buffer pollution would show below.
  const poisonedId = 'wa-poison-x';
  await pushFrames(fx, [
    toolCall(THREAD_A, 'wa-wrong-turn', 2, { toolName: 'read', toolCallId: poisonedId }),
    toolCall(THREAD_B, TURN_B1, 1, { toolName: 'read', toolCallId: poisonedId }),
    content(THREAD_B, TURN_B1, 2, 'CROSS-THREAD-LEAK'),
    content(THREAD_A, 'wa-wrong-turn', 3, 'WRONG-TURN-LEAK'),
  ]);
  await expectStaysAbsent(page, 'CROSS-THREAD-LEAK');
  await expectStaysAbsent(page, 'WRONG-TURN-LEAK');
  await pushFrames(fx, [
    toolCall(THREAD_A, T_A, 2, { toolName: 'read', toolCallId: poisonedId, args: { path: 'WA-POISON-CLEAN.txt' } }),
    toolResult(THREAD_A, T_A, 3, { toolCallId: poisonedId }),
    content(THREAD_A, T_A, 4, 'STILL-STREAMING'),
  ]);
  // Exactly one clean summary line: the poisoned ids never polluted buffers.
  await expectTranscript(page, {
    ordered: ['WA-POISON-CLEAN.txt', 'STILL-STREAMING'],
    counts: [[/WA-POISON-CLEAN\.txt/g, 1]],
  });
});

test('@routing routing: status_update enforces the addressed current turnId', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  await pushFrames(fx, [begin(THREAD_A, T_A, 1)]);
  const meter = page.locator('[title^="Context usage"]').first();
  await expect(meter).toHaveAttribute('title', /^Context usage: 10%/); // seeded by open reply
  await pushFrames(fx, [{
    type: 'status_update', threadId: THREAD_A, turnId: 'wa-not-current',
    streamSeq: 2, contextUsage: 0.12,
  }]);
  await expect(meter).toHaveAttribute('title', /^Context usage: 10%/); // dropped pre-mutation
  // Server-shaped: wired projection input is the top-level contextUsage fraction.
  await pushFrames(fx, [statusUpdate(THREAD_A, T_A, 2, { contextUsage: 0.87 })]);
  await expect(meter).toHaveAttribute('title', 'Context usage: 87%');
});

test('@routing routing: interleaved A/B content, tool args, grouping, subagent and terminal events stay isolated', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  await pushFrames(fx, [
    begin(THREAD_A, T_A, 1),
    content(THREAD_A, T_A, 2, 'ALPHA-PROSE'),
    toolCall(THREAD_A, T_A, 3, { toolName: 'read', toolCallId: 'ra1', args: { path: 'a-one.txt' } }),
    toolCall(THREAD_A, T_A, 4, { toolName: 'read', toolCallId: 'ra2', args: { path: 'a-two.txt' } }),
    toolResult(THREAD_A, T_A, 5, { toolCallId: 'ra1' }),
    toolResult(THREAD_A, T_A, 6, { toolCallId: 'ra2' }),
  ]);
  await expect.poll(() => transcriptText(page), { timeout: 10_000 }).toContain('Read (2 files)');
  await selectThread(fx, page, 'b');
  await pushFrames(fx, [
    begin(THREAD_B, TURN_B1, 1),
    content(THREAD_B, TURN_B1, 2, 'BETA-VISIBLE'),
    toolCall(THREAD_B, TURN_B1, 3, { toolName: 'subagent', toolCallId: 'sb1' }),
    toolCallArgs(THREAD_B, TURN_B1, 4, 'sb1', '{"subagent_type":"explorer"}'),
    subagentEvent(THREAD_B, TURN_B1, 5, 'sb1', 'sa-b'),
    toolResult(THREAD_B, TURN_B1, 6, { toolCallId: 'sb1' }),
    content(THREAD_A, T_A, 7, 'ALPHA-BACKGROUND'), // routed at B's view; lands in A
  ]);
  await expect.poll(() => transcriptText(page), { timeout: 10_000 }).toContain('(sa-b)'); // chunked args → agent-id intro
  const betaText = await transcriptText(page);
  expect(betaText).toContain('BETA-VISIBLE');
  expect(betaText).not.toContain('ALPHA-PROSE');  // A never leaks into B's DOM
  await pushFrames(fx, [turnEnd(THREAD_B, TURN_B1, 7, { fullText: 'BETA-VISIBLE' })]);
  await expect.poll(() => transcriptText(page), { timeout: 10_000 }).toContain('BETA-VISIBLE'); // terminalized into history
});

test('@routing routing: one turn terminalization leaves the other pair fully intact', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser, { alpha: {
    threadId: THREAD_A,
    liveTurn: snapshot({ threadId: THREAD_A, turnId: T_A, streamSeq: 5, parts: [{ type: 'text', content: 'SNAPSHOTED-A' }] }),
  } });
  await selectThread(fx, page, 'b');
  await pushFrames(fx, [
    begin(THREAD_B, TURN_B1, 1),
    content(THREAD_B, TURN_B1, 2, 'ISOLATED-B'),
    turnEnd(THREAD_B, TURN_B1, 3, { fullText: 'ISOLATED-B' }),
    content(THREAD_B, TURN_B1, 4, 'ISOLATED-B-DENIED'), // post-terminal denial
  ]);
  await expectTranscript(page, { counts: [[/ISOLATED-B/g, 1]] });
  await expectStaysAbsent(page, 'ISOLATED-B-DENIED');
  await selectThread(fx, page, 'a'); // B terminalization cleared nothing of A
  await pushFrames(fx, [content(THREAD_A, T_A, 6, 'RESUMED-A')]);
  await expectTranscript(page, { ordered: ['SNAPSHOTED-A', 'RESUMED-A'] });
});

test('@routing routing: post-terminal chat-turn:saved and metadata correlate to completed messages', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  await pushFrames(fx, [
    begin(THREAD_A, T_A, 1),
    content(THREAD_A, T_A, 2, 'SAVE-CORPUS'),
    turnEnd(THREAD_A, T_A, 3, { fullText: 'SAVE-CORPUS' }),
  ]);
  await expect.poll(() => transcriptText(page), { timeout: 10_000 }).toContain('SAVE-CORPUS');
  await pushFrames(fx, [
    chatTurnSaved(THREAD_A, T_A, { exchangeId: 901, metadata: { contextUsage: 0.44 } }),
    metadataUpdated(THREAD_A, 901, { contextUsage: 0.55 }),
    exchangeMetadata(THREAD_A, 'SAVE-CORPUS-user', { note: 'post-terminal flood' }),
  ]);
  expect(await assistantRows(page)).toHaveLength(1);
  expect((await transcriptText(page)).match(/SAVE-CORPUS/g)).toHaveLength(1);
});

// ─── Frontier (SPEC-04 §5 "Frontier") ─────────────────────────────────────

function inflightSnapshotBase(seq: number, partText: string, opts: Partial<Pick<LiveTurnSnapshot, 'status' | 'fullText' | 'terminalError'>> = {}) {
  return { threadId: THREAD_A, liveTurn: snapshot({
    threadId: THREAD_A, turnId: TURN_A1, streamSeq: seq, ...opts,
    parts: [{ type: 'text', content: partText }],
  }) };
}

test('@frontier frontier: in-flight snapshot at N installs every baseline segment already revealed', async ({ browser }) => {
  const { page } = await startWaSession(browser, { alpha: { threadId: THREAD_A, liveTurn: snapshot({
    threadId: THREAD_A, turnId: T_A, streamSeq: 5,
    parts: [{ type: 'text', content: 'WA-BASELINE-1' }, { type: 'text', content: ' BASE-THOUGHT-VISIBLE' }],
  }) } });
  await expectTranscript(page, { ordered: ['WA-BASELINE-1', 'BASE-THOUGHT-VISIBLE'] });
  const rows = await assistantRows(page);
  expect(rows).toHaveLength(2);
  expect(rows[0].isLivePlane).toBe(false); // baseline = instant revealed rows
  expect(rows.every((r) => !r.isLivePlane)).toBe(true); // live plane waits for post-N in-flight events
  await expect.poll(() => transcriptText(page), { timeout: 10_000 }).toContain('WA-PROMPT-SNAPSHOT');
});

test('@frontier frontier: unfinished catch-up baseline defers reply chrome to its error terminal tail', async ({ browser }) =>
  expectUnfinishedCatchupErrorPresentation(browser));

test('@frontier frontier: events at or below N never replay over the installed baseline', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser, { alpha: inflightSnapshotBase(5, 'COVERED-BASE') });
  await pushFrames(fx, [
    thinking(THREAD_A, T_A, 1, 'REPLAY-THINK'),
    content(THREAD_A, T_A, 3, 'REPLAY-THREE'),
    content(THREAD_A, T_A, 5, 'REPLAY-FIVE'),
    content(THREAD_A, T_A, 6, 'LIVE-AFTER-N'), // lane proven alive
  ]);
  await expect.poll(() => transcriptText(page), { timeout: 10_000 }).toContain('LIVE-AFTER-N');
  expect((await transcriptText(page)).match(/COVERED-BASE/g)).toHaveLength(1);
  await expectStaysAbsent(page, 'REPLAY-THINK');
  await expectStaysAbsent(page, 'REPLAY-THREE');
  await expectStaysAbsent(page, 'REPLAY-FIVE');
});

test('@frontier frontier: N+1/N+2 apply exactly once in streamSeq order', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser, { alpha: inflightSnapshotBase(5, 'ORDER-BASE') });
  await pushFrames(fx, [
    content(THREAD_A, T_A, 6, 'SEQ-ALPHA'),
    content(THREAD_A, T_A, 7, 'SEQ-BRAVO'),
  ]);
  await expectTranscript(page, { ordered: ['SEQ-ALPHA', 'SEQ-BRAVO'], counts: [[/SEQ-/g, 2]] });
});

test('@frontier frontier: N+2 before N+1 stays buffered until N+1 lands then drains contiguously', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser, { alpha: inflightSnapshotBase(5, 'GAPLESS-BASE') });
  await pushFrames(fx, [content(THREAD_A, T_A, 7, 'GAP-LATER')]);
  await expectStaysAbsent(page, 'GAP-LATER', 500); // gap: nothing may appear
  await pushFrames(fx, [content(THREAD_A, T_A, 6, 'GAP-EARLIER')]);
  // Contiguous drain: EARLIER then LATER, once each, in that order.
  await expectTranscript(page, {
    ordered: ['GAP-EARLIER', 'GAP-LATER'],
    counts: [[/GAP-(EARLIER|LATER)/g, 2]],
  });
});

test('@frontier frontier: newer snapshot advances through a buffered gap without duplication or loss', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser, { alpha: inflightSnapshotBase(5, 'ADVANCE-BASE') });
  await pushFrames(fx, [content(THREAD_A, T_A, 7, 'STRANDED-GAP')]); // buffered behind missing 6
  await setOpenReply(fx, THREAD_A, openedReply({
    threadId: THREAD_A,
    liveTurn: snapshot({ threadId: THREAD_A, turnId: T_A, streamSeq: 9, parts: [{ type: 'text', content: 'CARRY-STRANDED-GAP-ONWARD' }] }),
  }) as Record<string, unknown>);
  await selectThread(fx, page, 'a'); // refreshed open claims the frontier at 9
  await pushFrames(fx, [content(THREAD_A, T_A, 10, 'POST-ADVANCE')]);
  await expectTranscript(page, {
    ordered: ['CARRY-STRANDED-GAP-ONWARD', 'POST-ADVANCE'],
    counts: [[/STRANDED-GAP/g, 1]], // buffered copy dropped; authority carries it — no dup, no loss
  });
});

test('@frontier frontier: live events arriving before hydration buffer and drain contiguously onto the snapshot', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser); // ALPHA opened empty: listed ⇒ KNOWN thread
  await clearOpenReplies(fx);          // server "lagging": next open swallowed
  await selectThread(fx, page, 'a');         // open #2 logged, unanswered
  await pushFrames(fx, [content(THREAD_A, 'wa-straggler-turn', 4, 'PRE-HYDRATION-LIVE')]); // speculative window
  await setOpenReply(fx, THREAD_A, openedReply({
    threadId: THREAD_A,
    liveTurn: snapshot({ threadId: THREAD_A, turnId: 'wa-straggler-turn', streamSeq: 3, parts: [{ type: 'text', content: 'HYDRATION-CORE' }] }),
  }) as Record<string, unknown>);
  await selectThread(fx, page, 'a');         // open #3 answered: snapshot@3 claims buffer @4
  // Snapshot core first, then the once-buffered live straggler drained after.
  await expectTranscript(page, {
    ordered: ['HYDRATION-CORE', 'PRE-HYDRATION-LIVE'],
    counts: [[/PRE-HYDRATION-LIVE/g, 1]],
  });
});

test('@frontier frontier: an older snapshot cannot regress visible content tool or terminal state', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser, { alpha: inflightSnapshotBase(10, 'V2-CURRENT-STATE') });
  await setOpenReply(fx, THREAD_A, openedReply({
    threadId: THREAD_A,
    liveTurn: snapshot({ threadId: THREAD_A, turnId: T_A, streamSeq: 4, parts: [{ type: 'text', content: 'REGRESS-OLD-BASE' }] }),
  }) as Record<string, unknown>);
  await selectThread(fx, page, 'a'); // refused claim ⇒ newest cached projection survives
  await expectStaysAbsent(page, 'REGRESS-OLD-BASE');
  expect((await transcriptText(page)).match(/V2-CURRENT-STATE/g)).toHaveLength(1);
  // Refusal rebuilds instant rows — no live plane without post-N events.
  expect((await assistantRows(page)).every((r) => !r.isLivePlane)).toBe(true);
});

test('@frontier frontier: whole-turn order follows streamSeq across equal lower and greater activityRevision mixes', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  await pushFrames(fx, [
    begin(THREAD_A, T_A, 1),
    content(THREAD_A, T_A, 2, 'MIX-ONE', { activityRevision: 50 }),
    content(THREAD_A, T_A, 3, 'MIX-TWO', { activityRevision: 0 }),
    content(THREAD_A, T_A, 4, 'MIX-THREE', { activityRevision: 50 }),
    stepBegin(THREAD_A, T_A, 5, { identity: 'mix-step', activityRevision: 999 }),
    content(THREAD_A, T_A, 6, 'MIX-FOUR', { activityRevision: 3 }),
  ]);
  // streamSeq order wins; every revision value applied, none suppressed.
  await expectTranscript(page, {
    ordered: ['MIX-ONE', 'MIX-TWO', 'MIX-THREE', 'MIX-FOUR'],
    counts: [[/MIX-/g, 4]],
  });
});

test('@frontier frontier: completed return takes the instant rendering path', async ({ browser }) => {
  const { page } = await startWaSession(browser, { alpha: inflightSnapshotBase(12, 'COMPLETE-FULL-BODY', {
    status: 'complete', fullText: 'COMPLETE-FULL-BODY',
  }) });
  const rows = await assistantRows(page);
  expect(rows).toHaveLength(1);                    // ONE completed row…
  await expectTranscript(page, { counts: [[/COMPLETE-FULL-BODY/, 1]] });
  expect(rows[0].text).toContain('COMPLETE-FULL-BODY');
  expect(rows[0].isLivePlane).toBe(false);         // …instant, not the reveal plane
  expect(await streamingCount(page)).toBe(0);      // completed path bypasses animation
  await expect(page.locator('.rv-chat-messages').first().locator('.rv-assistant-reply-shell')).toHaveCount(1);
  await expect.poll(() => transcriptText(page), { timeout: 10_000 }).toContain('WA-PROMPT-SNAPSHOT');
});

test('@frontier frontier: terminal-snapshot save race yields exactly one completed message without duplicate content', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser, { alpha: inflightSnapshotBase(8, 'TERMINAL-BODY', {
    status: 'error', terminalError: sampleTerminalError(),
  }) });
  await expectTranscript(page, { counts: [[/TERMINAL-BODY/, 1]] });
  await pushFrames(fx, [chatTurnSaved(THREAD_A, T_A, { exchangeId: 707 })]); // ack races after install
  const rows = await assistantRows(page);
  expect(rows).toHaveLength(1);
  expect((await transcriptText(page)).match(/TERMINAL-BODY/g)).toHaveLength(1);
});

test('@frontier frontier: hydrating and draining thread A cannot reset or delay thread B', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser, { alpha: inflightSnapshotBase(5, 'CORE-OF-A') });
  await selectThread(fx, page, 'b');
  await pushFrames(fx, [
    begin(THREAD_B, TURN_B1, 1),
    content(THREAD_B, TURN_B1, 2, 'FLUID-B-ONE'),
  ]);
  await expectTranscript(page, { counts: [[/FLUID-B-ONE/g, 1]] }); // B advances pre-A
  // Canonical mirror carries B's turn; reopen = server-authoritative rehydrate.
  await setOpenReply(fx, THREAD_B, openedReply({ threadId: THREAD_B,
    liveTurn: snapshot({ threadId: THREAD_B, turnId: TURN_B1, streamSeq: 3,
      parts: [{ type: 'text', content: 'FLUID-B-ONE' }, { type: 'text', content: ' FLUID-B-TWO' }] }),
  }) as Record<string, unknown>);
  await selectThread(fx, page, 'a');                          // A hydrates + drains its buffer
  await expect.poll(() => transcriptText(page), { timeout: 10_000 }).toContain('CORE-OF-A');
  await selectThread(fx, page, 'b');                          // B reinstall unaffected by A work
  await expectTranscript(page, {
    ordered: ['FLUID-B-ONE', 'FLUID-B-TWO'], counts: [[/FLUID-B-/g, 2]],
  });
});

// ─── Labeled complements (exceptions, same file — reasons inline) ──────────

test('@routing complement(node): chat-turn:saved attaches exchange metadata without duplicate rows — reason: merged exchangeId/metadata are invisible in today’s DOM', async () => {
  const { handleStreamMessage } = await import('../src/lib/ws/stream-handlers');
  const { usePanelStore } = await import('../src/state/panelStore');
  usePanelStore.setState({
    projectChats: {
      [THREAD_A]: { messages: [{ id: T_A, type: 'assistant', content: 'MERGE-BODY', timestamp: 1 }], currentTurn: null },
    },
  } as never);
  expect(handleStreamMessage(chatTurnSaved(THREAD_A, T_A, { exchangeId: 55, metadata: { contextUsage: 0.3 } }))).toBe(true);
  expect(handleStreamMessage(metadataUpdated(THREAD_A, 55, { contextUsage: 0.6 }))).toBe(true);
  const slot = usePanelStore.getState().projectChats[THREAD_A];
  expect(slot.messages).toHaveLength(1);
  expect(slot.messages[0]).toMatchObject({ exchangeId: 55, metadata: { contextUsage: 0.6 } });
});

test('@routing complement(browser console): diagnostic report logs ids-only via the exported redactMessageForLog seam — reason: imports of ws-client cannot load under the Node runner (module-time window reference), so the packet’s chosen alternative proves the seam’s exact output shape end-to-end through the packaged client’s own log line', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  const tap = new ConsoleTap(page);
  tap.attach();
  await pushFrames(fx, [diagnosticReportFrame({
    threadId: 't-console', turnId: 'c-turn', diagnosticId: 'diag-console',
    stderrExcerpt: 'CONSOLE-RAW-STDERR', message: 'CONSOLE-RAW-MSG',
  })]);
  await expect.poll(() => tap.dump()).toContain('diag-console');
  const line = tap.dump().split('\n')
    .find((l) => l.includes('chat-turn:diagnostic:report') && l.includes('diag-console')) ?? '';
  expect(line).not.toBe('');
  // App logs `[WS] Message received: <type> <redactMessageForLog(msg)>`; inspect
  // renders the REDUCED object unquoted inline — require the EXACT allowlist only.
  const objectPart = line.slice(line.indexOf('{')).replace(/\s+/g, '');
  expect(objectPart).toBe(
    '{type:chat-turn:diagnostic:report,threadId:t-console,turnId:c-turn,diagnosticId:diag-console}',
  );
  expect(tap.dump()).not.toContain('CONSOLE-RAW-STDERR');
  expect(tap.dump()).not.toContain('CONSOLE-RAW-MSG');
});

test('@routing complement(node): requestChatTurnDiagnostic pending registry resolves on matched report and exact-route denial — reason: registry semantics need SPEC-05 UI to be DOM-visible', async () => {
  const mod = await import('../src/lib/ws/chat-diagnostic-handlers');
  const { usePanelStore } = await import('../src/state/panelStore');
  expect(typeof mod.requestChatTurnDiagnostic).toBe('function'); // definition-only; zero auto callers
  const sent: unknown[] = [];
  usePanelStore.setState({ ws: { readyState: WebSocket.OPEN, send: (raw: string) => { sent.push(JSON.parse(raw)); } } } as never);
  const pending = mod.requestChatTurnDiagnostic({ threadId: 'nt', turnId: 'rt', diagnosticId: 'diag-registry' });
  await mod.handleChatDiagnosticReportFrame({
    type: 'chat-turn:diagnostic:report', threadId: 'nt', turnId: 'rt', diagnosticId: 'diag-registry',
    report: { version: 1, harnessId: 'h', category: 'runtime', hadRenderableOutput: false, hadToolCalls: false, truncatedFields: [] },
  } as never);
  await expect(pending.then((report) => (report ? report.harnessId : null))).resolves.toBe('h');
  const denied = mod.requestChatTurnDiagnostic({ threadId: 'nt', turnId: 'rt2', diagnosticId: 'diag-denied' });
  await mod.handleChatDiagnosticUnavailableFrame({ type: 'chat-turn:diagnostic:unavailable', threadId: 'nt', turnId: 'rt2', diagnosticId: 'diag-denied' } as never);
  await expect(denied).resolves.toBeNull();
  expect(sent).toHaveLength(2);
});

registerWorkingCases();
registerTerminalCases();
registerDiagnosticCases();
