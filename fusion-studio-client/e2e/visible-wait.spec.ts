import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { build } from 'vite';
import { snapshot, openedReply } from './support/working-activity-wire';

const bundle = (async () => {
  const entry = 'virtual:visible-wait';
  const source = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { LiveSegmentRenderer } from ${JSON.stringify(path.resolve('src/components/LiveSegmentRenderer.tsx'))};
    import { readRevealSurfaces, RevealProgress } from ${JSON.stringify(path.resolve('src/lib/reveal/progress.ts'))};
    import { animateText } from ${JSON.stringify(path.resolve('src/lib/text/text-animate.ts'))};
    import { animateTool } from ${JSON.stringify(path.resolve('src/lib/tool-animate.ts'))};
    import { DEFAULT_TIMING_PROFILE } from ${JSON.stringify(path.resolve('src/lib/timing.ts'))};
    import { MessageList } from ${JSON.stringify(path.resolve('src/components/MessageList.tsx'))};
    import { usePanelStore } from ${JSON.stringify(path.resolve('src/state/panelStore.ts'))};
    import { handleStreamMessage } from ${JSON.stringify(path.resolve('src/lib/ws/stream-handlers.ts'))};
    import { handleThreadMessage } from ${JSON.stringify(path.resolve('src/lib/ws/thread-handlers.ts'))};
    function Routed() {
      const chat = usePanelStore(s => s.projectChats.thread);
      return React.createElement(MessageList, { workspaceId: 'ws', threadId: 'thread', surfaceId: 'main',
        messages: chat?.messages ?? [], currentTurn: chat?.currentTurn ?? null, segments: chat?.segments ?? [],
        onRequestDiagnostic: async () => null, onCopyDiagnostic: async () => {}, onAskAIWithDiagnostic: async () => false,
        askAIWithDiagnosticEnabled: false });
    }
    const roots = new Map(), props = new Map(), completions = [];
    const render = (next, id = 'main') => {
      if (!roots.has(id)) { const el = document.createElement('div'); el.id = id; document.body.append(el); roots.set(id, createRoot(el)); }
      const value = { workspaceId: 'ws', threadId: 'thread', surfaceId: id, turnId: 'A', segments: [], ...props.get(id), ...next };
      props.set(id, value);
      flushSync(() => roots.get(id).render(value.routed ? React.createElement(Routed) : React.createElement(LiveSegmentRenderer, { ...value,
        onRevealComplete: value.terminal ? () => completions.push(value.turnId) : undefined })));
    };
    window.fixture = { render, completions, read: readRevealSurfaces,
      route(frame) { flushSync(() => handleStreamMessage(frame)); },
      hydrate(frame) { flushSync(() => handleThreadMessage(frame)); },
      stop() { flushSync(() => usePanelStore.getState().setPendingExchangeSave('thread', 'A')); },
      state() { return usePanelStore.getState().projectChats.thread; },
      unmount(id = 'main') { flushSync(() => roots.get(id).unmount()); roots.delete(id); },
      runController(kind, observed) {
        const events = []; const start = Date.now(); const progress = observed ? new RevealProgress() : undefined;
        const emit = value => events.push([Date.now() - start, value]);
        const opts = { contentRef: { current: kind === 'text' ? '# Heading\\n\\nBody & more\\n\\n' : 'one\\ntwo\\n' },
          completeRef: { current: kind !== 'think-live' }, cancelRef: { current: false }, segmentType: kind === 'think-live' ? 'think' : kind,
          getTimingProfile: () => DEFAULT_TIMING_PROFILE, onDone: () => events.push([Date.now() - start, 'DONE']),
          setDisplayedHtml: emit, setDisplayedContent: emit, progress };
        if (kind === 'think-live') {
          opts.contentRef.current = 'partial';
          setTimeout(() => { opts.contentRef.current += ' more'; }, 400);
          setTimeout(() => { opts.completeRef.current = true; }, 1000);
        }
        window.trace = events; (kind === 'text' ? animateText : animateTool)(opts);
      },
    };
  `;
  const result = await build({ configFile: false, logLevel: 'silent',
    plugins: [{ name: entry, resolveId: id => id === entry ? `\0${entry}` : null, load: id => id === `\0${entry}` ? source : null }],
    build: { write: false, minify: false, cssCodeSplit: false, rollupOptions: { input: entry, output: { format: 'iife' } } },
  });
  if (Array.isArray(result) || !('output' in result)) throw new Error('Unexpected build');
  return { js: result.output.filter(x => x.type === 'chunk').map(x => x.code).join('\n'),
    css: result.output.filter(x => x.type === 'asset').map(x => x.source).join('\n') };
})();
async function render(page: Page, props: object, id = 'main') {
  await page.evaluate(({ props, id }) => (window as any).fixture.render(props, id), { props, id });
}
async function boot(page: Page, props: object = {}) {
  await page.clock.install(); await page.clock.pauseAt(new Date()); await page.setContent('<body></body>');
  const built = await bundle;
  await page.addStyleTag({ content: built.css }); await page.addScriptTag({ content: built.js }); await render(page, props);
}
async function read(page: Page) { return page.evaluate(() => (window as any).fixture.read()); }
async function untilWait(page: Page) {
  for (let i = 0; i < 6000; i += 10) {
    const records = await read(page);
    if (records[0]?.waitingSince != null) return records[0].waitingSince as number;
    await page.clock.runFor(10);
  }
  throw new Error('No production-controller wait');
}
async function atWait(page: Page, elapsed: number) {
  const since = await untilWait(page); const now = await page.evaluate(() => Date.now());
  await page.clock.runFor(Math.max(0, since + elapsed - now));
}
const working = (page: Page) => page.locator('.rv-working-activity');
const text = (content = 'first\n\n', complete = false) => ({ type: 'text', content, complete });
const step = { kind: 'working', turnId: 'A', identity: 'step', startedAt: 1, activityRevision: 1 };
for (const kind of ['text', 'think', 'shell', 'read']) {
  test(`${kind}: controller wait 1999 absent / 2000 shows 2s`, async ({ page }) => {
    const segment = kind === 'text' ? text() : { type: kind, content: kind === 'think' ? 'first\n' : '', complete: false };
    await boot(page, { segments: [segment] }); await atWait(page, 1999); await expect(working(page)).toHaveCount(0);
    await page.clock.runFor(1); await expect(page.locator('.rv-working-activity-seconds')).toHaveText('Working… 2s');
    const snapshot = (await read(page))[0];
    expect(snapshot).toMatchObject({ workspaceId: 'ws', threadId: 'thread', surfaceId: 'main', turnId: 'A' });
    expect(snapshot.segments[0]).toMatchObject({ sourceUnit: 'UTF16', phase: 'waiting' });
    if (kind === 'shell') expect(snapshot.segments[0].sourceCursor).toBeNull();
  });
}
test('undisplayable fragments preserve wait; resume hides and next gap resets', async ({ page }) => {
  await boot(page, { segments: [text('```ts\npartial')] }); const first = await untilWait(page);
  expect((await read(page))[0].segments[0]).toMatchObject({ sourceCursor: 0, parserFedSource: 13, receivedSource: 13 });
  await atWait(page, 1800); await render(page, { segments: [text('```ts\npartial more')] }); await atWait(page, 2000);
  expect((await read(page))[0].waitingSince).toBe(first); await expect(page.locator('.rv-working-activity-seconds')).toHaveText('Working… 2s');
  await render(page, { segments: [text('```ts\npartial more\n```\n\n')] }); await page.clock.runFor(30);
  await expect(working(page)).toHaveCount(0); const second = await untilWait(page); expect(second).toBeGreaterThan(first + 2000);
  await atWait(page, 1999); await expect(working(page)).toHaveCount(0);
  await page.clock.runFor(1); await expect(page.locator('.rv-working-activity-seconds')).toHaveText('Working… 2s');
});
test('wait ending before threshold never flashes while resumed characters reveal', async ({ page }) => {
  await boot(page, { segments: [text()] }); await atWait(page, 1969);
  await render(page, { segments: [text('first\n\n' + 'second '.repeat(500) + '\n\n')] }); await page.clock.runFor(30);
  await expect(working(page)).toHaveCount(0); await page.clock.runFor(1500); await expect(working(page)).toHaveCount(0);
  expect((await read(page))[0].segments[0].phase).toBe('revealing');
});
test('step age cannot bypass orb or 2s; no-step orb remains', async ({ page }) => {
  await boot(page); await page.clock.runFor(4000); await expect(page.locator('.rv-orb-wrapper')).toHaveCount(1);
  await expect(working(page)).toHaveCount(0); await render(page, { activity: step });
  await page.clock.runFor(499); await expect(working(page)).toHaveCount(0); await page.clock.runFor(1);
  await atWait(page, 1999); await expect(working(page)).toHaveCount(0);
  await page.clock.runFor(1); await expect(page.locator('.rv-working-activity-seconds')).toHaveText('Working… 2s');
});
test('queued work and animation phases exclude wait; between-segment wait needs no step', async ({ page }) => {
  await boot(page, { segments: [{ type: 'think', content: 'done\n', complete: true }, text('x\n\n', true)] });
  for (let i = 0; i < 250; i++) {
    const state = (await read(page))[0]; if (state.frontier === 2) break;
    expect(state.waitingSince).toBeNull(); await expect(working(page)).toHaveCount(0); await page.clock.runFor(10);
  }
  expect((await read(page))[0].frontier).toBe(2); await atWait(page, 2000); await expect(page.locator('.rv-working-activity-seconds')).toHaveText('Working… 2s');
});
for (const action of ['terminal', 'replacement', 'unmount']) {
  test(`${action} retires clock and stale callbacks`, async ({ page }) => {
    await boot(page, { segments: [text()] }); await atWait(page, 2000); await expect(working(page)).toHaveCount(1);
    if (action === 'terminal') await render(page, { terminal: true, segments: [text('first\n\n', true)] });
    if (action === 'replacement') await render(page, { turnId: 'B', segments: [] });
    if (action === 'unmount') await page.evaluate(() => (window as any).fixture.unmount());
    await expect(working(page)).toHaveCount(0); await page.clock.runFor(5000); await expect(working(page)).toHaveCount(0);
    if (action === 'unmount') expect(await read(page)).toEqual([]);
    if (action === 'terminal') expect(await page.evaluate(() => (window as any).fixture.completions)).toEqual(['A']);
  });
}
test('same-thread surfaces have independent waits and disposal', async ({ page }) => {
  await boot(page, { segments: [text()] }); await atWait(page, 2000);
  await render(page, { segments: [text('```ts\npartial')] }, 'side'); await page.clock.runFor(500);
  expect((await read(page)).map((s: any) => s.surfaceId)).toEqual(['main', 'side']);
  await expect(page.locator('#main .rv-working-activity')).toHaveCount(1); await expect(page.locator('#side .rv-working-activity')).toHaveCount(0);
  await page.evaluate(() => (window as any).fixture.unmount('main')); await page.clock.runFor(2000);
  await expect(page.locator('#side .rv-working-activity')).toHaveCount(1);
  expect((await read(page)).map((s: any) => s.surfaceId)).toEqual(['side']);
});
for (const kind of ['text', 'think', 'shell', 'think-live']) {
  test(`${kind}: observer on/off exact output order and timing`, async ({ page }) => {
    await boot(page); const traces = [];
    for (const observed of [false, true]) {
      await page.evaluate(({ kind, observed }) => (window as any).fixture.runController(kind, observed), { kind, observed });
      await page.clock.runFor(5000); traces.push(await page.evaluate(() => (window as any).trace));
    }
    expect(traces[0].at(-1)[1]).toBe('DONE'); expect(traces[1]).toEqual(traces[0]);
  });
}

async function route(page: Page, frame: object) {
  await page.evaluate(frame => (window as any).fixture.route(frame), { threadId: 'thread', turnId: 'A', ...frame });
}
async function routedWait(page: Page) {
  await boot(page, { routed: true });
  await route(page, { type: 'turn_begin', streamSeq: 1 });
  await route(page, { type: 'step_begin', streamSeq: 2, ...step, startedAt: 1 });
  await atWait(page, 2000);
  await expect(working(page)).toHaveCount(1);
}
for (const reason of ['complete', 'interrupted', 'error']) {
  test(`production route ${reason} clears clock and preserves saved ACK guard`, async ({ page }) => {
    await routedWait(page);
    if (reason === 'interrupted') {
      await page.evaluate(() => (window as any).fixture.stop());
      await expect(working(page)).toHaveCount(0);
      await page.clock.runFor(3000); await expect(working(page)).toHaveCount(0);
    }
    await route(page, { type: 'turn_end', streamSeq: 3, reason });
    await expect(working(page)).toHaveCount(0); await page.clock.runFor(5000);
    await expect(working(page)).toHaveCount(0);
    const state = await page.evaluate(() => (window as any).fixture.state());
    expect(state.currentTurn).toBeNull();
    expect(state.messages.at(-1).exchangeId).toBeUndefined();
    await route(page, { type: 'chat-turn:saved', exchangeId: 999, seq: 1, ts: 1, reason });
    const saved = await page.evaluate(() => (window as any).fixture.state());
    expect(saved.messages.at(-1).exchangeId).toBe(999);
  });
}
test('production step revisions remain canonical while the clock keeps local wait age', async ({ page }) => {
  await routedWait(page); const since = (await read(page))[0].waitingSince;
  await route(page, { type: 'step_begin', streamSeq: 3, identity: 'equal', startedAt: 1, activityRevision: 1 });
  await route(page, { type: 'step_begin', streamSeq: 4, identity: 'new', startedAt: 1, activityRevision: 2 });
  expect((await read(page))[0].waitingSince).toBe(since);
  await expect(page.locator('.rv-working-activity-seconds')).toHaveText('Working… 2s');
  expect((await page.evaluate(() => (window as any).fixture.state())).activity.identity).toBe('new');
  await route(page, { type: 'content', streamSeq: 5, text: 'content\n\n', activityRevision: 3 });
  await page.clock.runFor(30); await expect(working(page)).toHaveCount(0);
  await route(page, { type: 'step_begin', streamSeq: 6, identity: 'step', startedAt: 1, activityRevision: 4 });
  expect((await page.evaluate(() => (window as any).fixture.state())).activity).toBeNull();
});
test('production snapshot return starts local 2s wait instead of restoring server step age', async ({ page }) => {
  await boot(page, { routed: true });
  const frame = openedReply({ threadId: 'thread', liveTurn: snapshot({ threadId: 'thread', turnId: 'A', streamSeq: 7,
    parts: [{ type: 'text', content: 'baseline' }], activityRevision: 4, seenStepIdentities: ['step'],
    activity: { ...step, activityRevision: 4 }, stepCursor: { identity: 'step', startedAt: 1 },
  }) });
  await page.evaluate(frame => (window as any).fixture.hydrate(frame), frame);
  await expect(page.locator('body')).toContainText('baseline');
  await atWait(page, 1999); await expect(working(page)).toHaveCount(0);
  await page.clock.runFor(1); await expect(page.locator('.rv-working-activity-seconds')).toHaveText('Working… 2s');
});

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`clock has one stable announcement and timestamp seconds (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await boot(page, { activity: step }); await atWait(page, 2000);
    const status = page.getByRole('status', { name: 'Model working' });
    await expect(status).toHaveCount(1); await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('.rv-working-activity-seconds')).toHaveAttribute('aria-hidden', 'true');
    await page.clock.runFor(5000);
    await expect(page.locator('.rv-working-activity-seconds')).toHaveText('Working… 7s');
    await expect(status).toHaveCount(1);
  });
}
test('tool result resume clears visible wait before reveal/hold/collapse', async ({ page }) => {
  await boot(page, { segments: [{ type: 'shell', content: '', complete: false }] }); await atWait(page, 2000);
  await render(page, { segments: [{ type: 'shell', content: 'result\n', complete: true }] });
  await page.clock.runFor(30); await expect(working(page)).toHaveCount(0);
  await page.clock.runFor(700); await expect(working(page)).toHaveCount(0);
});

for (const appendAt of [1800, 2200]) {
  test(`empty rendered Markdown at +${appendAt}ms preserves continuous visible wait`, async ({ page }) => {
    await boot(page, { segments: [text()] });
    const since = await untilWait(page); await atWait(page, appendAt);
    const before = (await read(page))[0].segments[0].visible;
    await render(page, { segments: [text('first\n\n\n\n')] });
    await page.clock.runFor(30);
    const after = (await read(page))[0];
    expect(after.waitingSince).toBe(since);
    expect(after.segments[0].visible).toBe(before);
    if (appendAt < 2000) await atWait(page, 2000);
    await expect(page.locator('.rv-working-activity-seconds')).toHaveText('Working… 2s');
  });
}
