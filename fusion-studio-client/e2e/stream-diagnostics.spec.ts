import { expect, test, type Page } from '@playwright/test';
import { mountHarness, sentFrames, HARNESS_WORKSPACE as WS, WIKI_VIEW, WIKI_GROUP_A, WIKI_THREAD_A,
  CAPTURE_VIEW, CAPTURE_GROUP_A, CAPTURE_THREAD_A } from './worksurface-harness';
const call = (page: Page, name: string, ...args: unknown[]) => page.evaluate(({ name, args }) => (window as any).__wsFixture[name](...args), { name, args });
async function menu(page: Page, locator = '#worksurface-host') {
  await page.locator(locator).locator('.rv-chat-header-btn[aria-label="More options"]').first().click();
  await page.getByRole('menuitem', { name: 'Diagnostics', exact: true }).click();
}
async function boot(page: Page, view = WIKI_VIEW, group = WIKI_GROUP_A) {
  await page.evaluate(() => { if (!crypto.randomUUID) Object.defineProperty(crypto, 'randomUUID', { value: () => 'fixture-' + Math.random().toString(36).slice(2) }); });
  await mountHarness(page, view); await call(page, 'forceBinding', group, view); await call(page, 'mountRailFor', view);
}
async function native(page: Page, payload: Record<string, unknown> = {}) {
  const subscription = (await sentFrames(page)).filter(f => f.type === 'chat-turn:diagnostic:subscribe').at(-1)!;
  await call(page, 'deliver', { ...subscription, type: 'chat-turn:diagnostic:stream', availability: 'available',
    turnId: 'A', generation: 1, drainId: 'dA', reset: true, baseline: 0, terminal: false, events: [], ...payload });
}
const event = (seq: number, text: string) => ({ seq, text, sourceUnits: text.length, sourceBytes: text.length, count: 1 });

test('actual primary menu opens rightmost closable tab; existing adapterless root preserved and reopen focuses', async ({ page }) => {
  await boot(page); const rail = page.locator('#wiki-viewer-view-tab-rail');
  await expect(rail.locator('.rv-native-wiki-viewer-children')).toBeVisible();
  await menu(page); await expect(rail.getByRole('tab')).toHaveCount(2);
  await expect(rail.getByRole('tab').last()).toHaveText(/Diagnostics/);
  await expect(rail.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Stream diagnostics')).toBeVisible();
  expect((await sentFrames(page)).filter(f => f.type === 'chat-turn:diagnostic:subscribe')).toEqual([
    expect.objectContaining({ workspaceId: WS, threadId: WIKI_THREAD_A }),
  ]);
  await menu(page); await expect(rail.getByRole('tab')).toHaveCount(2);
  expect((await sentFrames(page)).filter(f => f.type === 'chat-turn:diagnostic:subscribe')).toHaveLength(1);
  await rail.getByRole('button', { name: 'Close Diagnostics' }).click();
  await expect(rail.locator('.rv-native-wiki-viewer-children')).toBeVisible();
  expect((await sentFrames(page)).filter(f => f.type === 'chat-turn:diagnostic:unsubscribe')).toHaveLength(1);
  expect((await sentFrames(page)).some(f => f.type === 'turn:stop')).toBe(false);
});

test('native + Side Chat tab order preserved; Side menu targets own chat and close restores Side Chat', async ({ page }) => {
  await boot(page, CAPTURE_VIEW, CAPTURE_GROUP_A);
  await call(page, 'applyCaptureRecords', { schemaVersion: 1, tabs: [{ tabId: 'native', content: { kind: 'component', revision: 1,
    component: { schemaVersion: 1, componentTypeId: 'capture.document', componentInstanceId: 'doc-native', input: { title: 'alpha.md', locationLabels: ['Capture', 'alpha.md'] }, targetKey: 'capture:alpha.md' } } }], activeTabId: 'native', reservations: [] });
  await call(page, 'seedSidePlacementIn', CAPTURE_VIEW, CAPTURE_GROUP_A, 'side', CAPTURE_THREAD_A);
  const rail = page.locator('#capture-viewer-view-tab-rail'); await rail.getByRole('tab', { name: 'Side Chat' }).click();
  await menu(page, '.rv-chat-area[data-chat-host="side-tab"]');
  await expect(rail.getByRole('tab')).toHaveText([/alpha.md/, /Side Chat/, /Diagnostics/]);
  await expect(page.locator('.rv-chat-area[data-chat-host="side-tab"]')).toHaveCount(0);
  expect((await sentFrames(page)).filter(f => f.type === 'chat-turn:diagnostic:subscribe').at(-1)).toMatchObject({ workspaceId: WS, threadId: CAPTURE_THREAD_A });
  await expect(page.getByLabel('Stream diagnostics')).toContainText('Renderer: unavailable');
  await rail.getByRole('button', { name: 'Close Diagnostics' }).click();
  await expect(page.locator('.rv-chat-area[data-chat-host="side-tab"]')).toBeVisible();
});

test('native text stays literal and only diagnostic state changes; duplicates, wrong identities, gaps and new turn reset', async ({ page }) => {
  await boot(page); await menu(page);
  const raw = '<thinking>**not formatted**</thinking><img src=x onerror="window.diagnosticXss=1">';
  await native(page, { events: [event(1, raw)] });
  const stream = page.getByLabel('Native event stream'); await expect(stream).toHaveText(raw + '\n');
  expect(await page.evaluate(() => (window as any).diagnosticXss)).toBeUndefined();
  await expect(stream.locator('img,strong,thinking')).toHaveCount(0);
  await native(page, { events: [event(1, 'DUPLICATE')] });
  await native(page, { threadId: 'wrong', events: [event(2, 'FOREIGN')] });
  await native(page, { workspaceId: 'wrong', events: [event(2, 'FOREIGN')] });
  await native(page, { reset: false, events: [{ ...event(3, 'AFTER GAP'), redacted: true }] });
  await expect(stream).toContainText('AFTER GAP'); await expect(stream).not.toContainText('DUPLICATE'); await expect(stream).not.toContainText('FOREIGN');
  await expect(page.getByLabel('Stream diagnostics')).toContainText('Sequence gap');
  await expect(page.getByLabel('Stream diagnostics')).toContainText('Redaction applied');
  await native(page, { turnId: 'B', generation: 2, events: [event(1, 'NEW TURN')] });
  await expect(stream).toHaveText('NEW TURN\n');
  await expect(page.getByLabel('Stream diagnostics')).not.toContainText('Sequence gap');
  await expect(page.getByLabel('Stream diagnostics')).not.toContainText('Redaction applied');
  await native(page, { events: [event(4, 'OLD TURN LATE')] });
  await expect(stream).toHaveText('NEW TURN\n');
  await expect(page.getByLabel('Stream diagnostics')).toContainText('Native observed: 1 events');
});

test('canonical accepted next turn fences delayed first old native frame; accepted counters ignore duplicates', async ({ page }) => {
  await boot(page);
  await call(page, 'deliver', { type: 'turn_begin', threadId: WIKI_THREAD_A, turnId: 'A', streamSeq: 1, userInput: 'one' });
  await menu(page);
  await call(page, 'deliver', { type: 'turn_end', threadId: WIKI_THREAD_A, turnId: 'A', streamSeq: 2, reason: 'complete' });
  // A different turn begins only after canonical previous-turn terminalization.
  await call(page, 'deliver', { type: 'turn_begin', threadId: WIKI_THREAD_A, turnId: 'B', streamSeq: 1, userInput: 'two' });
  await native(page, { events: [event(1, 'OLD FIRST NATIVE')] });
  await expect(page.getByLabel('Native event stream')).not.toContainText('OLD FIRST NATIVE');
  await native(page, { turnId: 'B', generation: 2, events: [event(1, 'NATIVE B')] });
  const content = { type: 'content', threadId: WIKI_THREAD_A, turnId: 'B', streamSeq: 2, text: 'hello\n\n' };
  await call(page, 'deliver', content); await call(page, 'deliver', content);
  await expect(page.getByLabel('Stream diagnostics')).toContainText('content 1 events / 7 source UTF-16');
  await expect(page.getByLabel('Native event stream')).toHaveText('NATIVE B\n');
});

test('bounded text reports truncation without losing cumulative native counters; reconnect reports gap and old sub is fenced', async ({ page }) => {
  await boot(page); await menu(page);
  const events = Array.from({ length: 4 }, (_, i) => event(i + 1, String(i).repeat(40000)));
  await native(page, { events });
  await expect(page.getByLabel('Stream diagnostics')).toContainText('128 Ki UTF-16 scrollback limit');
  await expect(page.getByLabel('Stream diagnostics')).toContainText('160000 UTF-16 units');
  expect((await page.getByLabel('Native event stream').textContent())!.length).toBe(131072);
  const old = (await sentFrames(page)).filter(f => f.type === 'chat-turn:diagnostic:subscribe').at(-1)!;
  await call(page, 'dropSocket'); await call(page, 'reconnect');
  await expect(page.getByLabel('Stream diagnostics')).toContainText('Connection gap');
  await call(page, 'deliver', { ...old, type: 'chat-turn:diagnostic:stream', generation: 9, turnId: 'old', availability: 'available', reset: true, baseline: 0, events: [event(1, 'LATE SOCKET')] });
  await expect(page.getByLabel('Native event stream')).not.toContainText('LATE SOCKET');
});
