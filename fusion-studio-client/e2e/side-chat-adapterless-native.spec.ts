/**
 * SPEC-04 slice 04B — adapterless and native-view Side Chat coverage.
 *
 * Extends the same public Move path through the code-owned Side Chat bridge to:
 *   - the native connect adapter (`capture-viewer`): the adapter stays the
 *     native-tab owner and composed Side Chat tabs join the same visible rail;
 *   - adapterless §6 hosts (`wiki-viewer` complete Move path, `issues-viewer`
 *     seeded presentation): a runtime-only root descriptor keeps the existing
 *     child and managed Side Chats append to it. With zero placements the rail
 *     is children-only (byte-identical).
 *
 * The server transition itself is proven by
 * `fusion-studio-server/test/ws/thread-group-move-side-chat.integration.test.js`;
 * this spec proves the visible rail composition and the served placement.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  CAPTURE_GROUP_A,
  CAPTURE_THREAD_A,
  CAPTURE_VIEW,
  EMAIL_GROUP_A,
  EMAIL_THREAD_A,
  EMAIL_VIEW,
  FILE_VIEW,
  HARNESS_WORKSPACE,
  ISSUES_GROUP_A,
  ISSUES_THREAD_A,
  ISSUES_VIEW,
  OFFICE_GROUP_A,
  OFFICE_THREAD_A,
  OFFICE_VIEW,
  WIKI_GROUP_A,
  WIKI_THREAD_A,
  WIKI_VIEW,
  mountHarness,
  sentFrames,
} from './worksurface-harness';

async function callFixture(page: Page, method: string, ...args: unknown[]): Promise<void> {
  await page.evaluate(
    ([name, params]) => {
      const api = (window as unknown as { __wsFixture: Record<string, (...a: unknown[]) => unknown> })
        .__wsFixture;
      (api[name as string] as (...a: unknown[]) => unknown)(...(params as unknown[]));
    },
    [method, args] as [string, unknown[]],
  );
}

async function population(page: Page, viewId: string): Promise<Array<Record<string, unknown>>> {
  return page.evaluate((target) => (window as unknown as {
    __wsFixture: { population: (v: string) => Array<Record<string, unknown>> };
  }).__wsFixture.population(target), viewId);
}

/** A valid connected Capture records document with one native document tab. */
function captureRecords(tabId: string, title: string, path: string) {
  return {
    schemaVersion: 1,
    tabs: [{
      tabId,
      content: {
        kind: 'component',
        revision: 1,
        component: {
          schemaVersion: 1,
          componentTypeId: 'capture.document',
          componentInstanceId: `cvi-${tabId}`,
          input: { title, locationLabels: ['Capture', path] },
          targetKey: `capture:${path}`,
        },
      },
    }],
    activeTabId: tabId,
    reservations: [],
  };
}

const WIKI_MOVE_COMPLETION = {
  type: 'thread:action:completed',
  action: 'move_chat_to_side',
  requestId: 'm-wiki-e2e',
  threadGroupId: WIKI_GROUP_A,
  movedThreadId: WIKI_THREAD_A,
  newMainThreadId: 'wiki-thread-side-2',
  currentPrimarySequence: 2,
  workspaceId: HARNESS_WORKSPACE,
  viewId: WIKI_VIEW,
  sideChatPlacementId: 'scp-wiki-e2e',
  placementStatus: 'applied',
};

test.describe('SPEC-04 04B Side Chat adapterless and native coverage', () => {
  test('capture-native: the connected adapter keeps its native tab and the composed Side Chat renders', async ({ page }) => {
    await mountHarness(page, CAPTURE_VIEW);
    await callFixture(page, 'forceBinding', CAPTURE_GROUP_A, CAPTURE_VIEW);
    await callFixture(page, 'mountRailFor', CAPTURE_VIEW);
    await callFixture(page, 'applyCaptureRecords', captureRecords('cvt-cap-1', 'alpha.md', 'docs/alpha.md'));

    const rail = page.locator('#capture-viewer-view-tab-rail');
    // The native Capture tab is still owned by the connected adapter.
    await expect(rail.getByRole('tab', { name: 'alpha.md' })).toBeVisible();
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toHaveCount(0);

    // A Move placement composes a Side Chat into the SAME rail.
    await callFixture(page, 'seedSidePlacementIn', CAPTURE_VIEW, CAPTURE_GROUP_A, 'scp-cap-1', CAPTURE_THREAD_A);
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toBeVisible();
    await expect(rail.getByRole('tab', { name: 'alpha.md' })).toBeVisible();

    await rail.getByRole('tab', { name: 'Side Chat' }).click();
    const sideMount = page.locator('.rv-chat-area[data-chat-host="side-tab"]');
    await expect(sideMount).toBeVisible();
    await expect(sideMount).toHaveAttribute('data-chat-thread-id', CAPTURE_THREAD_A);
    await expect(sideMount).toHaveAttribute('data-chat-view-id', CAPTURE_VIEW);
    // No nested thread rail.
    await expect(sideMount.locator('[data-threaded-chat]')).toHaveCount(0);
  });

  test('adapterless wiki: children-only until a placement exists, then the complete Move path', async ({ page }) => {
    await mountHarness(page, WIKI_VIEW);
    await callFixture(page, 'forceBinding', WIKI_GROUP_A, WIKI_VIEW);
    await callFixture(page, 'mountRailFor', WIKI_VIEW);
    await expect.poll(async () => (await population(page, WIKI_VIEW)).length).toBeGreaterThan(0);

    const rail = page.locator('#wiki-viewer-view-tab-rail');
    // No placement: `ViewTabBar` renders only the existing wiki child — no
    // tab rail is injected.
    await expect(rail.locator('.rv-view-tab-rail')).toHaveCount(0);
    await expect(rail.locator('.rv-native-wiki-viewer-children')).toBeVisible();

    // The visible Main Chat menu emits the canonical Move intent.
    const more = page.locator(
      '#worksurface-host .rv-chat-header-btn[aria-label="More options"]',
    ).first();
    await more.click();
    const moveItem = page.getByRole('menuitem', { name: 'Move Chat to Side Chat' });
    await expect(moveItem).toBeEnabled();
    await moveItem.click();
    const move = (await sentFrames(page)).find(
      (frame) => frame.type === 'thread:action' && frame.action === 'move_chat_to_side',
    );
    expect(move).toMatchObject({
      threadGroupId: WIKI_GROUP_A,
      threadId: WIKI_THREAD_A,
      expectedPrimarySequence: 1,
    });
    expect(move).not.toHaveProperty('workspaceId');
    expect(move).not.toHaveProperty('viewId');

    // The committed placement is served on the exact lane; the completion
    // frame drives the read (never reconstructed from primary history).
    await callFixture(page, 'seedServerPlacementIn', WIKI_VIEW, WIKI_GROUP_A, 'scp-wiki-e2e', WIKI_THREAD_A);
    await callFixture(page, 'clearSent');
    await page.evaluate((msg) => {
      (window as unknown as { __wsFixture: { deliver: (m: unknown) => void } }).__wsFixture.deliver(msg);
    }, WIKI_MOVE_COMPLETION);
    expect((await sentFrames(page)).some(
      (frame) => frame.type === 'state:worksurface_get'
        && frame.viewId === WIKI_VIEW
        && frame.threadGroupId === WIKI_GROUP_A,
    )).toBe(true);

    // The runtime-only root keeps the existing child; the Side Chat appends.
    await expect(rail.getByRole('tab')).toHaveCount(2);
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toBeVisible();
    await expect(rail.locator('.rv-native-wiki-viewer-children')).toBeVisible();

    await rail.getByRole('tab', { name: 'Side Chat' }).click();
    const sideMount = page.locator('.rv-chat-area[data-chat-host="side-tab"]');
    await expect(sideMount).toBeVisible();
    await expect(sideMount).toHaveAttribute('data-chat-thread-id', WIKI_THREAD_A);
    await expect(sideMount).toHaveAttribute('data-chat-view-id', WIKI_VIEW);
    await expect(sideMount.locator('[data-threaded-chat]')).toHaveCount(0);

    // SPEC-04 §3/§12: the Side Chat list button operates the owning shell
    // view's real ThreadRail state, never a nested or content-local rail.
    await expect(page.locator('[data-thread-rail-panel="wiki-viewer"]')).toBeAttached();
    const listButton = sideMount.locator('.rv-chat-thread-dock');
    await listButton.click();
    await expect.poll(() => page.evaluate(() => (
      window as unknown as { __wsFixture: { viewState: (v: string) => { collapsed?: { leftSidebar?: boolean } } } }
    ).__wsFixture.viewState('wiki-viewer')?.collapsed?.leftSidebar)).toBe(true);
    await listButton.click();
    await expect.poll(() => page.evaluate(() => (
      window as unknown as { __wsFixture: { viewState: (v: string) => { collapsed?: { leftSidebar?: boolean } } } }
    ).__wsFixture.viewState('wiki-viewer')?.collapsed?.leftSidebar)).toBe(false);

    // Returning to the root tab restores the children-only presentation.
    await rail.getByRole('tab').first().click();
    await expect(sideMount).toHaveCount(0);
    await expect(rail.locator('.rv-native-wiki-viewer-children')).toBeVisible();
  });

  test('adapterless issues: a seeded server placement presents root + Side Chat with dedupe/focus', async ({ page }) => {
    await mountHarness(page, ISSUES_VIEW, { dock: false });
    await callFixture(page, 'mountRailFor', ISSUES_VIEW);
    await callFixture(page, 'forceBinding', ISSUES_GROUP_A, ISSUES_VIEW);
    await callFixture(page, 'seedSidePlacementIn', ISSUES_VIEW, ISSUES_GROUP_A, 'scp-issues-1', ISSUES_THREAD_A);
    // A repeated delivery focuses/acknowledges the same placement: no duplicate.
    await callFixture(page, 'seedSidePlacementIn', ISSUES_VIEW, ISSUES_GROUP_A, 'scp-issues-1', ISSUES_THREAD_A);

    const rail = page.locator('#issues-viewer-view-tab-rail');
    await expect(rail.getByRole('tab')).toHaveCount(2);
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toHaveCount(1);
    // The existing child is the default (root) presentation.
    await expect(rail.locator('.rv-native-issues-viewer-children')).toBeVisible();
    await expect(page.locator('.rv-chat-area[data-chat-host="side-tab"]')).toHaveCount(0);

    await rail.getByRole('tab', { name: 'Side Chat' }).click();
    const sideMount = page.locator('.rv-chat-area[data-chat-host="side-tab"]');
    await expect(sideMount).toBeVisible();
    await expect(sideMount).toHaveAttribute('data-chat-thread-id', ISSUES_THREAD_A);
    await expect(sideMount).toHaveAttribute('data-chat-view-id', ISSUES_VIEW);
    // No nested rail and no nested dock: this host has no outer dock.
    await expect(sideMount.locator('[data-threaded-chat]')).toHaveCount(0);

    // Focus is transient renderer state; the placement identity stays durable.
    await rail.getByRole('tab').first().click();
    await expect(page.locator('.rv-chat-area[data-chat-host="side-tab"]')).toHaveCount(0);
    await expect(rail.locator('.rv-native-issues-viewer-children')).toBeVisible();
  });

  for (const host of [
    { viewId: OFFICE_VIEW, groupId: OFFICE_GROUP_A, threadId: OFFICE_THREAD_A },
    { viewId: EMAIL_VIEW, groupId: EMAIL_GROUP_A, threadId: EMAIL_THREAD_A },
  ]) {
    test(`adapterless ${host.viewId}: the generic runtime-root composition presents the Side Chat`, async ({ page }) => {
      await mountHarness(page, host.viewId, { dock: false });
      await callFixture(page, 'mountRailFor', host.viewId);
      await callFixture(page, 'forceBinding', host.groupId, host.viewId);
      await callFixture(page, 'seedSidePlacementIn', host.viewId, host.groupId, `scp-${host.viewId}-1`, host.threadId);

      const rail = page.locator(`#${host.viewId}-view-tab-rail`);
      await expect(rail.getByRole('tab')).toHaveCount(2);
      await expect(rail.getByRole('tab', { name: 'Side Chat' })).toBeVisible();
      await expect(rail.locator(`.rv-native-${host.viewId}-children`)).toBeVisible();

      await rail.getByRole('tab', { name: 'Side Chat' }).click();
      const sideMount = page.locator('.rv-chat-area[data-chat-host="side-tab"]');
      await expect(sideMount).toBeVisible();
      await expect(sideMount).toHaveAttribute('data-chat-thread-id', host.threadId);
      await expect(sideMount).toHaveAttribute('data-chat-view-id', host.viewId);
      await expect(sideMount.locator('[data-threaded-chat]')).toHaveCount(0);
    });
  }

  test('the non-Move file rail stays byte-identical (no injected root)', async ({ page }) => {
    // Regression guard for the 04A native path: with no placement the File rail
    // returns the base adapter unchanged (no runtime root tab).
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'mountRail', FILE_VIEW);
    const rail = page.locator('#file-view-tab-rail');
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toHaveCount(0);
    await expect(rail.locator('.rv-native-file-viewer-children')).toBeVisible();
  });

  test('dockless restart/readback materializes on active-view population without an action frame', async ({ page }) => {
    // After relaunch an unbound/dockless adapterless host has no worksurface
    // binding. Activating its explicit view host requests exactly that view's
    // population; the list response then issues the exact per-group entry read
    // carrying the managed-placement lane. Inactive views do no hidden sweep.
    await mountHarness(page, ISSUES_VIEW, { dock: false });
    await callFixture(page, 'mountRailFor', ISSUES_VIEW);
    // Seed ONLY the server entry: no store seed, no binding, no action frame.
    await callFixture(page, 'seedServerPlacementIn', ISSUES_VIEW, ISSUES_GROUP_A, 'scp-issues-restart', ISSUES_THREAD_A);

    const rail = page.locator('#issues-viewer-view-tab-rail');
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toHaveCount(0);
    await expect(rail.locator('.rv-native-issues-viewer-children')).toBeVisible();

    await callFixture(page, 'mountView', ISSUES_VIEW);

    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toBeVisible();
    await rail.getByRole('tab', { name: 'Side Chat' }).click();
    const sideMount = page.locator('.rv-chat-area[data-chat-host="side-tab"]');
    await expect(sideMount).toHaveAttribute('data-chat-thread-id', ISSUES_THREAD_A);
    await expect(sideMount).toHaveAttribute('data-chat-view-id', ISSUES_VIEW);
    // The active-view read never injects a root into a view with no placement
    // and never carries surfaceId.
    const frames = await sentFrames(page);
    expect(JSON.stringify(frames)).not.toContain('surfaceId');
  });
});
