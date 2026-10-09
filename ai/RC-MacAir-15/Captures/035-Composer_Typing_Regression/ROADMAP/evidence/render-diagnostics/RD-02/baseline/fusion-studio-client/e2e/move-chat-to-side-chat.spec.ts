/**
 * SPEC-04 slice 04A — Move Chat to Side Chat renderer gate.
 *
 * Drives the REAL production connected host, the REAL connected File rail
 * (`ViewTabBar` + `useFileConnectedAdapter`), the REAL registered
 * `fusion.chat-surface` resolver, and the REAL registered frame handlers over
 * the shared isolated fixture. The server transition itself is proven by
 * `fusion-studio-server/test/ws/thread-group-move-side-chat.integration.test.js`;
 * this spec proves the visible menu intent and the placed Side Chat rail.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  FILE_GROUP_A,
  FILE_THREAD_A,
  FILE_VIEW,
  HARNESS_WORKSPACE,
  mountHarness,
  sentFrames,
} from './worksurface-harness';

interface MoveFixture {
  mountRail: () => void;
  unmountRail: () => void;
  forceBinding: (groupId: string) => void;
  seedSidePlacement: (groupId: string, placementId: string, threadId: string) => unknown;
  sidePlacements: (groupId: string) => string[];
  deliver: (msg: unknown) => void;
}

async function callFixture(
  page: Page,
  method: keyof MoveFixture | string,
  ...args: unknown[]
): Promise<void> {
  await page.evaluate(
    ([name, params]) => {
      const api = (window as unknown as { __wsFixture: Record<string, (...a: unknown[]) => unknown> })
        .__wsFixture;
      (api[name as string] as (...a: unknown[]) => unknown)(...(params as unknown[]));
    },
    [method as string, args] as [string, unknown[]],
  );
}

const MOVE_COMPLETION = {
  type: 'thread:action:completed',
  action: 'move_chat_to_side',
  requestId: 'm-e2e-1',
  threadGroupId: FILE_GROUP_A,
  movedThreadId: FILE_THREAD_A,
  newMainThreadId: 'thread-a-side-2',
  currentPrimarySequence: 2,
  workspaceId: HARNESS_WORKSPACE,
  viewId: FILE_VIEW,
  sideChatPlacementId: 'scp-e2e-1',
  placementStatus: 'applied',
};

test.describe('SPEC-04 Move Chat to Side Chat', () => {
  test('the visible Main Chat menu emits one canonical move_chat_to_side intent', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);

    const more = page.locator(
      '#worksurface-host .rv-chat-header-btn[aria-label="More options"]',
    ).first();
    await more.click();
    const moveItem = page.getByRole('menuitem', { name: 'Move Chat to Side Chat' });
    await expect(moveItem).toBeVisible();
    await expect(moveItem).toBeEnabled();
    await moveItem.click();

    const frames = await sentFrames(page);
    const move = frames.find(
      (frame) => frame.type === 'thread:action' && frame.action === 'move_chat_to_side',
    );
    expect(move).toBeTruthy();
    expect(move).toMatchObject({
      threadGroupId: FILE_GROUP_A,
      threadId: FILE_THREAD_A,
      expectedPrimarySequence: 1,
    });
    // No redundant client workspace/view authority field is sent.
    expect(move).not.toHaveProperty('workspaceId');
    expect(move).not.toHaveProperty('viewId');
    expect(JSON.stringify(frames)).not.toContain('surfaceId');
  });

  test('the moved member renders centered in a Side Chat tab through fusion.chat-surface', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');
    await callFixture(page, 'seedSidePlacement', FILE_GROUP_A, 'scp-e2e-1', FILE_THREAD_A);
    // Settle the initial population reply before the completion frame so the
    // accepted move patch cannot race a late list response.
    await page.waitForFunction(() => (
      (window as unknown as {
        __wsFixture: { population: (v: string) => unknown[] };
      }).__wsFixture.population('file-viewer').length
    ) > 0);

    // The authoritative completion frame patches the visible row and
    // re-reads the placement lane; it is never treated as a request ack alone.
    await callFixture(page, 'clearSent');
    await page.evaluate((msg) => {
      (window as unknown as { __wsFixture: { deliver: (m: unknown) => void } }).__wsFixture.deliver(msg);
    }, MOVE_COMPLETION);
    const afterMove = await sentFrames(page);
    expect(afterMove.some(
      (frame) => frame.type === 'state:worksurface_get'
        && frame.viewId === FILE_VIEW
        && frame.threadGroupId === FILE_GROUP_A,
    )).toBe(true);

    // The visible Thread row keeps its group identity, becomes one row, and
    // now names the new empty Main Chat.
    const rows = await page.evaluate(
      (viewId) => (window as unknown as {
        __wsFixture: { population: (v: string) => Array<Record<string, unknown>> };
      }).__wsFixture.population(viewId),
      FILE_VIEW,
    );
    const movedRows = rows.filter((row) => row.threadGroupId === FILE_GROUP_A);
    expect(movedRows).toHaveLength(1);
    expect(movedRows[0]).toMatchObject({
      threadGroupId: FILE_GROUP_A,
      threadId: 'thread-a-side-2',
      currentPrimarySequence: 2,
    });

    const rail = page.locator('#file-view-tab-rail');
    const sideTab = rail.getByRole('tab', { name: 'Side Chat' });
    await expect(sideTab).toBeVisible();
    await sideTab.click();

    const sideMount = page.locator('.rv-chat-area[data-chat-host="side-tab"]');
    await expect(sideMount).toBeVisible();
    await expect(sideMount).toHaveAttribute('data-chat-thread-id', FILE_THREAD_A);
    await expect(sideMount).toHaveAttribute('data-chat-view-id', FILE_VIEW);
    // No nested thread rail.
    await expect(sideMount.locator('[data-threaded-chat]')).toHaveCount(0);

    // SPEC-04 §3/§12: the Side Chat list button operates the owning shell
    // view's real ThreadRail state, not a retired content-local dock.
    await expect(page.locator('[data-thread-rail-panel="file-viewer"]')).toBeAttached();
    const listButton = sideMount.locator('.rv-chat-thread-dock');
    await expect(listButton).toBeVisible();
    await listButton.click();
    await expect.poll(() => page.evaluate(() => (
      window as unknown as { __wsFixture: { viewState: (v: string) => { collapsed?: { leftSidebar?: boolean } } } }
    ).__wsFixture.viewState('file-viewer')?.collapsed?.leftSidebar)).toBe(true);
    await listButton.click();
    await expect.poll(() => page.evaluate(() => (
      window as unknown as { __wsFixture: { viewState: (v: string) => { collapsed?: { leftSidebar?: boolean } } } }
    ).__wsFixture.viewState('file-viewer')?.collapsed?.leftSidebar)).toBe(false);
  });

  test('a placement-only broadcast after a failed delivery materializes the Side Chat without another trigger', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');

    // The Move completes, but delivery failed: the first lane read has no
    // placement, so no Side Chat tab may appear yet.
    await callFixture(page, 'clearSent');
    await page.evaluate((msg) => {
      (window as unknown as { __wsFixture: { deliver: (m: unknown) => void } }).__wsFixture.deliver(msg);
    }, { ...MOVE_COMPLETION, sideChatPlacementId: 'scp-retry-1', placementStatus: 'failed' });
    const rail = page.locator('#file-view-tab-rail');
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toHaveCount(0);

    // A later retry delivery surfaces ONLY a placement-lane change: same
    // contentRevision, bumped placementRevision (SPEC-04 §7). The clean bound
    // window must re-read and materialize the tab with no other trigger.
    await callFixture(
      page, 'seedServerPlacementEx',
      FILE_GROUP_A, 'scp-retry-1', FILE_THREAD_A, 'forced-cr', 'forced-pr-2',
    );
    await callFixture(page, 'broadcastPlacement', FILE_VIEW, FILE_GROUP_A);
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toBeVisible();
  });

  test('Move is unavailable while the session has an unresolved finalizing Stop boundary', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);

    const more = page.locator(
      '#worksurface-host .rv-chat-header-btn[aria-label="More options"]',
    ).first();
    await more.click();
    const moveItem = page.getByRole('menuitem', { name: 'Move Chat to Side Chat' });
    await expect(moveItem).toBeEnabled();

    await callFixture(page, 'setThreadFinalizing', FILE_THREAD_A, true);
    // The fixture remounts this chat on state delivery. The shared menu closes
    // with its mount; reopen it and inspect the current server-gated intent.
    if (await moveItem.count() === 0) await more.click();
    await expect(moveItem).toBeDisabled();
  });

  test('the delivered placement survives a rail remount (restart/readback)', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');
    await callFixture(page, 'seedSidePlacement', FILE_GROUP_A, 'scp-e2e-1', FILE_THREAD_A);
    await page.evaluate((msg) => {
      (window as unknown as { __wsFixture: { deliver: (m: unknown) => void } }).__wsFixture.deliver(msg);
    }, MOVE_COMPLETION);

    const rail = page.locator('#file-view-tab-rail');
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toBeVisible();

    // Remount the rail: the placement lane restores the Side Chat tab without
    // scanning primary history and without a duplicate.
    await callFixture(page, 'unmountRail');
    await callFixture(page, 'mountRail');
    await expect(page.locator('#file-view-tab-rail').getByRole('tab', { name: 'Side Chat' }))
      .toHaveCount(1);
    const placements = await page.evaluate(
      (groupId) => (window as unknown as {
        __wsFixture: { sidePlacements: (g: string) => string[] };
      }).__wsFixture.sidePlacements(groupId),
      FILE_GROUP_A,
    );
    expect(placements).toEqual(['scp-e2e-1']);
  });
});
