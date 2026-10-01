import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { build } from 'vite';
import type { SegmentType } from '../src/types';

// Production renderer, controllers, Orb and CSS; only delivery and time are controlled.
const bundlePromise = (async () => {
  const entry = 'virtual:instant-collapse';
  const source = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { LiveSegmentRenderer } from ${JSON.stringify(path.resolve('src/components/LiveSegmentRenderer.tsx'))};
    let props = { turnId: 'A', segments: [] };
    const completions = [];
    const root = createRoot(document.querySelector('#root'));
    const render = (next) => {
      props = { ...props, ...next };
      const turn = props.turnId;
      flushSync(() => root.render(React.createElement(LiveSegmentRenderer, {
        ...props, onRevealComplete: props.terminal ? () => completions.push(turn) : undefined,
      })));
    };
    window.fixture = { render, completions, unmount: () => flushSync(() => root.unmount()) };
  `;
  const result = await build({
    configFile: false, logLevel: 'silent',
    plugins: [{ name: 'instant-collapse-fixture', enforce: 'pre',
      resolveId(id) { return id === entry ? `\0${entry}` : null; },
      load(id) { return id === `\0${entry}` ? source : null; } }],
    build: { write: false, minify: false, cssCodeSplit: false, rollupOptions: { input: entry, output: { format: 'iife' } } },
  });
  if (Array.isArray(result) || !('output' in result)) throw new Error('Unexpected build result');
  return {
    js: result.output.filter(item => item.type === 'chunk').map(item => item.code).join('\n'),
    css: result.output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source).join('\n'),
  };
})();
const item = (type: SegmentType = 'think', complete = true) => ({ type, content: 'first line\nsecond line\n', complete, toolCallId: 'first' });
const next = { type: 'text', content: 'NEXT ITEM', complete: false };
const third = { type: 'read', content: 'THIRD', complete: true, toolCallId: 'third' };
const area = (page: Page) => page.locator('.rv-tool-content-area').first();
async function render(page: Page, props: object) {
  await page.evaluate(props => (window as any).fixture.render(props), props);
}
async function boot(page: Page, props: object) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.setContent('<body><div id="root"></div></body>');
  const bundle = await bundlePromise;
  await page.addStyleTag({ content: bundle.css });
  await page.addScriptTag({ content: bundle.js });
  await render(page, props);
  await page.clock.runFor(500);
}
async function revealed(page: Page) {
  for (let i = 0; i < 3000; i++) {
    if (await page.locator('.rv-tool-header-btn').count() &&
        await page.locator('.rv-shimmer-text').count() === 0) return;
    await page.clock.runFor(1);
  }
  throw new Error('Production reveal did not finish');
}
async function zeroDuration(page: Page) {
  expect(await area(page).evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s, 0s');
  expect(await page.locator('.rv-tool-arrow-icon').first().evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
}

for (const type of ['think', 'shell'] as const) {
  test(`${type}: queued next waits for reveal, zero CSS, 100ms order, once frontier, manual expansion`, async ({ page }) => {
    await boot(page, { segments: [item(type), next, third] });
    await expect(area(page)).toHaveAttribute('data-expanded', 'true');
    await expect(page.locator('.rv-message-assistant-content')).toHaveCount(0);
    await revealed(page);
    await expect(area(page)).not.toHaveAttribute('data-expanded', 'true');
    await expect(area(page)).toContainText('second line');
    await zeroDuration(page);
    await page.clock.runFor(99);
    await expect(page.locator('.rv-message-assistant-content')).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(page.locator('.rv-message-assistant-content')).toHaveCount(1);
    await page.clock.runFor(1500);
    await expect(page.locator('.rv-tool-header-btn')).toHaveCount(1);
    await page.locator('.rv-tool-header-btn').first().click();
    await render(page, { segments: [item(type), { ...next, content: 'NEXT ITEM MORE' }, third] });
    await page.clock.runFor(1000);
    await expect(area(page)).toHaveAttribute('data-expanded', 'true');
    await expect(page.locator('.rv-tool-header-btn')).toHaveCount(1);
  });
}

test('no next preserves 500ms hold, 300ms collapse, 100ms gap, terminal effect once', async ({ page }) => {
  await boot(page, { segments: [item()], terminal: true });
  await revealed(page);
  await expect(area(page)).toHaveAttribute('data-expanded', 'true');
  expect(await area(page).evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0.3s, 0.3s');
  await page.clock.runFor(499);
  await expect(area(page)).toHaveAttribute('data-expanded', 'true');
  await page.clock.runFor(1);
  await expect(area(page)).not.toHaveAttribute('data-expanded', 'true');
  await page.clock.runFor(399);
  expect(await page.evaluate(() => (window as any).fixture.completions)).toEqual([]);
  await page.clock.runFor(1);
  expect(await page.evaluate(() => (window as any).fixture.completions)).toEqual(['A']);
  await render(page, { terminal: true });
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => (window as any).fixture.completions)).toEqual(['A']);
});

for (const delay of [100, 600]) {
  test(`arrival at +${delay}ms interrupts hold/collapse using latest queue`, async ({ page }) => {
    await boot(page, { segments: [item()] });
    await revealed(page);
    await page.clock.runFor(delay);
    await render(page, { segments: [item(), next, third] });
    await expect(area(page)).not.toHaveAttribute('data-expanded', 'true');
    await zeroDuration(page);
    await page.clock.runFor(99);
    await expect(page.locator('.rv-message-assistant-content')).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(page.locator('.rv-message-assistant-content')).toHaveCount(1);
    await page.clock.runFor(2000);
    await expect(page.locator('.rv-tool-header-btn')).toHaveCount(1);
  });
}

test('parser chunks and empty placeholder do not count, updated same-length queue does', async ({ page }) => {
  await boot(page, { segments: [item('think', false), { type: 'text', content: '', complete: false }] });
  await page.clock.runFor(700);
  await expect(area(page)).toHaveAttribute('data-expanded', 'true');
  await render(page, { segments: [item(), { type: 'text', content: '', complete: false }] });
  await revealed(page);
  await expect(area(page)).toHaveAttribute('data-expanded', 'true');
  await page.clock.runFor(200);
  await render(page, { segments: [item(), next] });
  await zeroDuration(page);
});

for (const delay of [0, 100, 600, 850]) {
  test(`replacement retires old continuations at +${delay}ms`, async ({ page }) => {
    await boot(page, { segments: [item()], terminal: true });
    await revealed(page);
    await page.clock.runFor(delay);
    await render(page, { turnId: 'B', segments: [item('shell', false), next], terminal: true });
    await page.clock.runFor(2000);
    expect(await page.evaluate(() => (window as any).fixture.completions)).toEqual([]);
    await expect(page.locator('.rv-tool-header-btn')).toHaveCount(1);
    await expect(page.locator('.rv-message-assistant-content')).toHaveCount(0);
    // Shell awaits its result, so its body is correctly absent on replacement.
    await expect(page.locator('.rv-tool-header-btn')).toHaveAttribute('data-expanded', 'true');
  });
}

test('unmount during hold retires terminal callback', async ({ page }) => {
  await boot(page, { segments: [item()], terminal: true });
  await revealed(page);
  await page.evaluate(() => (window as any).fixture.unmount());
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => (window as any).fixture.completions)).toEqual([]);
  await expect(page.locator('#root')).toBeEmpty();
});

test('subagent bypass stays expanded and mounts next without hold/collapse/gap', async ({ page }) => {
  await boot(page, { segments: [item('subagent', false), next] });
  await page.clock.runFor(1);
  await expect(page.locator('.rv-message-assistant-content')).toHaveCount(1);
  await expect(area(page)).toHaveAttribute('data-expanded', 'true');
  await expect(page.locator('.rv-subagent-waiting-segment')).toHaveCount(1);
  await render(page, { segments: [item('subagent', true), next] });
  await expect(area(page)).not.toHaveAttribute('data-expanded', 'true');
});

test('reduced motion preserves queued policy and reveal completion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, { segments: [item(), next] });
  await revealed(page);
  await zeroDuration(page);
  await page.clock.runFor(100);
  await expect(page.locator('.rv-message-assistant-content')).toHaveCount(1);
});


test('next arrives during reveal: latest queue is read after current completion', async ({ page }) => {
  await boot(page, { segments: [item('think', false)] });
  await page.clock.runFor(300);
  await render(page, { segments: [item('think', false), next] });
  await page.clock.runFor(200);
  await expect(area(page)).toHaveAttribute('data-expanded', 'true');
  await expect(page.locator('.rv-message-assistant-content')).toHaveCount(0);
  await render(page, { segments: [item(), next] });
  await revealed(page);
  await zeroDuration(page);
  await page.clock.runFor(100);
  await expect(page.locator('.rv-message-assistant-content')).toHaveCount(1);
});

test('reveal before terminal waits for current completion callback then fires once', async ({ page }) => {
  await boot(page, { segments: [item()] });
  await revealed(page);
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => (window as any).fixture.completions)).toEqual([]);
  await render(page, { terminal: true });
  expect(await page.evaluate(() => (window as any).fixture.completions)).toEqual(['A']);
  await render(page, { terminal: true });
  expect(await page.evaluate(() => (window as any).fixture.completions)).toEqual(['A']);
});


test('late next arrival cannot recollapse a completed manually opened item', async ({ page }) => {
  await boot(page, { segments: [item()] });
  await revealed(page);
  await page.clock.runFor(900);
  await page.locator('.rv-tool-header-btn').click();
  await render(page, { segments: [item(), next] });
  await page.clock.runFor(200);
  await expect(area(page)).toHaveAttribute('data-expanded', 'true');
});
