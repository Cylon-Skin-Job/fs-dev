import { expect, test } from '@playwright/test';
import { abandonWsResponseTracking, handleMessage, onFusionMessage, onFusionResponse } from '../src/lib/ws-client';
import { usePanelStore } from '../src/state/panelStore';
import { useSecretsStore } from '../src/state/secretsStore';
import { startWaSession } from './support/working-activity-scenario';
import { THREAD_A } from './support/working-activity-wire';
import { mountHarness, sentFrames, HARNESS_WORKSPACE, CAPTURE_VIEW, CAPTURE_GROUP_A,
  CAPTURE_THREAD_A, CAPTURE_THREAD_B } from './worksurface-harness';

test('ordered response notifications and retirement preserve persistent listeners', () => {
  const seen: string[] = [];
  const persistent = onFusionMessage('chat-turn:metadata:updated', () => seen.push('persistent'));
  const scoped = onFusionResponse('chat-turn:metadata:updated', () => seen.push('scoped'), () => seen.push('retired'));
  try {
    handleMessage({ type: 'chat-turn:metadata:updated', threadId: 'entry-thread' });
    expect(seen).toEqual(['persistent', 'scoped']);
    abandonWsResponseTracking();
    abandonWsResponseTracking();
    expect(seen).toEqual(['persistent', 'scoped', 'retired']);
    handleMessage({ type: 'chat-turn:metadata:updated', threadId: 'entry-thread' });
    expect(seen).toEqual(['persistent', 'scoped', 'retired', 'persistent']);
  } finally {
    scoped();
    persistent();
  }
});

test('retired socket callback cannot deliver a shell response or secrets projection', () => {
  const notices: string[] = [];
  const off = onFusionMessage('clipboard:list', () => notices.push('clipboard'));
  useSecretsStore.getState().setApiKeys([]);
  try {
    handleMessage({ type: 'clipboard:list', items: [] }, () => false);
    handleMessage({ type: 'secrets:api-keys:state', items: [{ id: 'should-not-appear' }] }, () => false);
    expect(notices).toEqual([]);
    expect(useSecretsStore.getState().apiKeys).toEqual([]);
    handleMessage({ type: 'clipboard:list', items: [] }, () => true);
    expect(notices).toEqual(['clipboard']);
  } finally {
    off();
  }
});

test('shell families project through their existing listeners and store owners', () => {
  const seen: string[] = [];
  const off = [
    onFusionMessage('fusion:tabs', () => seen.push('fusion')),
    onFusionMessage('clipboard:state', () => seen.push('clipboard')),
    onFusionMessage('emoji_recents:list', () => seen.push('emoji')),
  ];
  try {
    handleMessage({ type: 'fusion:tabs' });
    handleMessage({ type: 'clipboard:state' });
    handleMessage({ type: 'emoji_recents:list' });
    expect(seen).toEqual(['fusion', 'clipboard', 'emoji']);
    usePanelStore.setState({ currentPanel: 'file-viewer' });
    handleMessage({ type: 'panel_changed', panel: 'file-viewer', cliConfigDelta: {} });
    expect(usePanelStore.getState().cliConfigViewDelta['file-viewer']).toEqual({});
  } finally {
    off.forEach((unsubscribe) => unsubscribe());
  }
});

test('public Main prompt is one deliberate route and its bubble waits for the exact server ACK', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  const composer = page.locator('section textarea').first();
  await composer.fill('C1-B exact main prompt');
  await page.getByRole('button', { name: 'Send message', exact: true }).first().click();
  await expect.poll(() => fx.sentFrames().filter((frame) => frame.type === 'prompt').length).toBe(1);
  const prompt = fx.sentFrames().find((frame) => frame.type === 'prompt')!;
  expect(prompt).toMatchObject({ threadId: THREAD_A, user_input: 'C1-B exact main prompt' });
  expect(typeof prompt.requestId).toBe('string');
  await expect(page.locator('.rv-message-user')).toHaveCount(0);
  await fx.push({ type: 'message:sent', workspaceId: 'boot-fixture', threadId: THREAD_A,
    requestId: prompt.requestId, turnId: 'c1b-main-turn', content: 'C1-B exact main prompt' });
  await expect(page.locator('.rv-message-user').first()).toContainText('C1-B exact main prompt');
  expect(fx.sentFrames().filter((frame) => frame.type === 'prompt')).toHaveLength(1);
});

test('view-bound Main and Side actions address their own session and Stop keeps server ownership', async ({ page }) => {
  await mountHarness(page, CAPTURE_VIEW);
  await page.evaluate(({ group, view, sideThread }) => {
    const fixture = (window as any).__wsFixture;
    fixture.forceBinding(group, view);
    fixture.mountRailFor(view);
    fixture.seedSidePlacementIn(view, group, 'c1b-side', sideThread);
  }, { group: CAPTURE_GROUP_A, view: CAPTURE_VIEW, sideThread: CAPTURE_THREAD_B });
  const main = page.locator('#worksurface-host .rv-chat-area:not([data-chat-host="side-tab"])').first();
  await main.locator('textarea.rv-chat-input').fill('C1-B main');
  await main.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(async () => (await sentFrames(page)).filter((frame) => frame.type === 'prompt').length).toBe(1);
  const first = (await sentFrames(page)).find((frame) => frame.type === 'prompt')!;
  expect(first).toMatchObject({ threadId: CAPTURE_THREAD_A, user_input: 'C1-B main' });
  expect(first.harnessConfig).toEqual({ model: 'm1', variant: 'high' });
  expect(first).not.toHaveProperty('attachments');
  await expect(main.locator('.rv-message-user')).not.toContainText('C1-B main');
  const rail = page.locator('#capture-viewer-view-tab-rail');
  await rail.getByRole('tab', { name: 'Side Chat' }).click();
  const side = page.locator('.rv-chat-area[data-chat-host="side-tab"]');
  await expect(side).toBeVisible();
  await side.locator('textarea.rv-chat-input').fill('C1-B side');
  await side.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(async () => (await sentFrames(page)).filter((frame) => frame.type === 'prompt').length).toBe(2);
  const second = (await sentFrames(page)).filter((frame) => frame.type === 'prompt')[1];
  expect(second).toMatchObject({ threadId: CAPTURE_THREAD_B, user_input: 'C1-B side' });
  expect(second).not.toHaveProperty('harnessConfig');
  expect(second).not.toHaveProperty('attachments');
  await expect(side.locator('.rv-message-user')).not.toContainText('C1-B side');
  await page.evaluate(({ workspaceId, sideThread, requestId }) => (window as any).__wsFixture.deliver({
    type: 'message:sent', workspaceId, threadId: sideThread,
    requestId, turnId: 'c1b-side-turn', content: 'C1-B side',
  }), { workspaceId: HARNESS_WORKSPACE, sideThread: CAPTURE_THREAD_B, requestId: second.requestId });
  await expect(side.locator('.rv-message-user').last()).toContainText('C1-B side');
  await page.evaluate((sideThread) => (window as any).__wsFixture.deliver({
    type: 'turn_begin', threadId: sideThread, turnId: 'c1b-side-turn', streamSeq: 1,
    userInput: 'C1-B side',
  }), CAPTURE_THREAD_B);
  await side.locator('.rv-stop-btn').click();
  await expect.poll(async () => (await sentFrames(page)).filter((frame) => frame.type === 'turn:stop').length).toBe(1);
  expect((await sentFrames(page)).find((frame) => frame.type === 'turn:stop')).toMatchObject({ threadId: CAPTURE_THREAD_B });
});
