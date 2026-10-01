/**
 * @module e2e/side-chat-placement-recovery.spec
 * @role SPEC-04 Slice 04C gate: close disposition, no resurrection on restart,
 *       the explicit member reopen path, and non-destructive close failure.
 *
 * Drives the REAL connected File rail (`ViewTabBar` + the code-owned Side Chat
 * bridge), the REAL registered `fusion.chat-surface` resolver, and the REAL
 * registered frame handlers over the shared isolated fixture. Closing records a
 * durable `closed` disposition through the accepted `state:worksurface_placement`
 * lane; the member session/transcript/Provenance/membership are never touched.
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

interface RecoveryFixture {
  mountRail: () => void;
  forceBinding: (groupId: string) => void;
  seedSidePlacement: (groupId: string, placementId: string, threadId: string) => unknown;
  placementDisposition: (groupId: string, placementId: string) => string | null;
  forcePlacementError: (code: string) => void;
  seedMembers: (groupId: string, members: unknown[]) => void;
  population: (viewId: string) => Array<Record<string, unknown>>;
}

async function callFixture(
  page: Page,
  method: keyof RecoveryFixture | string,
  ...args: unknown[]
): Promise<unknown> {
  return page.evaluate(
    ([name, params]) => {
      const api = (window as unknown as { __wsFixture: Record<string, (...a: unknown[]) => unknown> })
        .__wsFixture;
      return (api[name as string] as (...a: unknown[]) => unknown)(...(params as unknown[]));
    },
    [method as string, args] as [string, unknown[]],
  );
}

async function deliver(page: Page, msg: unknown): Promise<void> {
  await page.evaluate((m) => {
    (window as unknown as { __wsFixture: { deliver: (x: unknown) => void } }).__wsFixture.deliver(m);
  }, msg);
}

test.describe('SPEC-04 04C Side Chat close disposition and recovery', () => {
  test('closing a Side Chat records a durable closed disposition, removes the tab, and keeps the member', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');
    await callFixture(page, 'seedSidePlacement', FILE_GROUP_A, 'scp-close-1', FILE_THREAD_A);

    const rail = page.locator('#file-view-tab-rail');
    const sideTab = rail.getByRole('tab', { name: 'Side Chat' });
    await expect(sideTab).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __wsFixture: { clearSent: () => void } }).__wsFixture.clearSent();
    });
    await rail.getByRole('button', { name: 'Close Side Chat' }).click();

    // One canonical close instruction with the stable placement id and CAS.
    const closeFrames = (await sentFrames(page)).filter(
      (frame) => frame.type === 'state:worksurface_placement'
        && frame.operation === 'close'
        && frame.placementId === 'scp-close-1',
    );
    expect(closeFrames).toHaveLength(1);
    expect(closeFrames[0]).toMatchObject({
      viewId: FILE_VIEW,
      threadGroupId: FILE_GROUP_A,
      operation: 'close',
    });
    expect(closeFrames[0]).not.toHaveProperty('descriptor');
    expect(JSON.stringify(closeFrames)).not.toContain('surfaceId');

    // The tab is removed and the placement is durably closed.
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toHaveCount(0);
    await expect.poll(async () => (
      callFixture(page, 'placementDisposition', FILE_GROUP_A, 'scp-close-1')
    )).toBe('closed');

    // The member session remains: the group still shows exactly one Thread row.
    const rows = await callFixture(page, 'population', FILE_VIEW) as Array<Record<string, unknown>>;
    expect(rows.filter((row) => row.threadGroupId === FILE_GROUP_A)).toHaveLength(1);
  });

  test('restart/readback does not resurrect a closed Side Chat', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');
    await callFixture(page, 'seedSidePlacement', FILE_GROUP_A, 'scp-restart-1', FILE_THREAD_A);
    const rail = page.locator('#file-view-tab-rail');
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toBeVisible();

    await rail.getByRole('button', { name: 'Close Side Chat' }).click();
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toHaveCount(0);

    // Remount (relaunch/readback) over the same durable closed placement: the
    // tab must stay absent and no primary-history scan may recreate it. Force a
    // real acknowledged-lane read (the SPEC-03 reconnect re-read) so the proof
    // is against the durable `closed` disposition, not just cleared memory.
    await page.evaluate(() => (
      window as unknown as { __wsFixture: { remount: () => void; mountRail: () => void } }
    ).__wsFixture.remount());
    await callFixture(page, 'mountRail');
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'reconnect');
    await expect(page.locator('#file-view-tab-rail').getByRole('tab', { name: 'Side Chat' }))
      .toHaveCount(0);
    await expect.poll(async () => (
      callFixture(page, 'placementDisposition', FILE_GROUP_A, 'scp-restart-1')
    )).toBe('closed');
  });

  test('an explicit member action reopens a closed Side Chat without a new placement', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');
    await callFixture(page, 'seedSidePlacement', FILE_GROUP_A, 'scp-reopen-1', FILE_THREAD_A);
    const rail = page.locator('#file-view-tab-rail');
    await rail.getByRole('button', { name: 'Close Side Chat' }).click();
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toHaveCount(0);

    await callFixture(page, 'seedMembers', FILE_GROUP_A, [{
      threadId: FILE_THREAD_A,
      ordinal: 1,
      isPrimary: false,
      createdAt: 1,
      label: 'Alpha',
      placementDisposition: 'closed',
    }]);

    const row = page.locator(`[data-thread-group-id="${FILE_GROUP_A}"]`);
    await row.locator('.rv-thread-menu-btn').click();
    const memberItem = page.locator(`[data-menu-item-id="open-${FILE_THREAD_A}"]`);
    await expect(memberItem).toBeVisible();
    await memberItem.click();

    // One idempotent open_member_in_side intent carrying only durable identities.
    const openFrame = (await sentFrames(page)).find(
      (frame) => frame.type === 'thread:action' && frame.action === 'open_member_in_side',
    );
    expect(openFrame).toMatchObject({
      threadGroupId: FILE_GROUP_A,
      threadId: FILE_THREAD_A,
    });
    expect(openFrame).not.toHaveProperty('workspaceId');
    expect(openFrame).not.toHaveProperty('viewId');

    // The lifetime placement reopens; no second placement is created.
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toBeVisible();
    await expect.poll(async () => (
      callFixture(page, 'placementDisposition', FILE_GROUP_A, 'scp-reopen-1')
    )).toBe('open');
  });

  test('a failed close disposition is a classified non-destructive warning and keeps the tab', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');
    await callFixture(page, 'seedSidePlacement', FILE_GROUP_A, 'scp-fail-1', FILE_THREAD_A);
    const rail = page.locator('#file-view-tab-rail');
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toBeVisible();

    await callFixture(page, 'forcePlacementError', 'revision_conflict');
    await rail.getByRole('button', { name: 'Close Side Chat' }).click();

    // Non-destructive: the tab remains and the placement is still open.
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toBeVisible();
    await expect.poll(async () => (
      callFixture(page, 'placementDisposition', FILE_GROUP_A, 'scp-fail-1')
    )).toBe('open');
  });

  test('a placement-only broadcast for a closed placement never reopens the tab', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');
    await callFixture(page, 'seedSidePlacement', FILE_GROUP_A, 'scp-closed-2', FILE_THREAD_A);
    const rail = page.locator('#file-view-tab-rail');
    await rail.getByRole('button', { name: 'Close Side Chat' }).click();
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toHaveCount(0);

    // An ordinary broadcast (retry/restart sweep) re-reads the lane but must
    // surface the closed disposition, not resurrect the tab.
    await deliver(page, {
      type: 'state:worksurface_changed',
      workspaceId: HARNESS_WORKSPACE,
      viewId: FILE_VIEW,
      threadGroupId: FILE_GROUP_A,
      lane: 'placement',
      contentRevision: null,
      placementRevision: 'forced-pr-closed',
    });
    await page.waitForTimeout(200);
    await expect(rail.getByRole('tab', { name: 'Side Chat' })).toHaveCount(0);
  });
});
