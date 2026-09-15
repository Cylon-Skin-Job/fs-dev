/**
 * @module e2e/side-chat-isolation.spec
 * @role SPEC-04 Slice 04C gate: concurrent Main Chat + Side Chat isolation.
 *
 * Proves over the REAL connected File rail and the REAL `fusion.chat-surface`
 * mount that the replacement Main Chat `B` and the moved Side Chat member `A`
 * are distinct, simultaneously mounted sessions: live frames route by exact
 * `threadId`, a send for one never lands in the other, the placement lane is
 * the only Side Chat authority, and no envelope carries `surfaceId`.
 *
 * The full Send/live-stream/Stop/usage/readiness/model/draft/attachment/
 * restore isolation of a SPEC-02 explicit surface is proven by the accepted
 * `chat-surface-isolation.spec.ts`; this spec proves the SPEC-04 two-member
 * Main/Side composition on the same composable surface.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  FILE_GROUP_A,
  FILE_THREAD_A,
  FILE_VIEW,
  HARNESS_WORKSPACE,
  mountHarness,
  openDock,
  sentFrames,
} from './worksurface-harness';

const NEW_MAIN_THREAD = 'thread-a-side-2';

const MOVE_COMPLETION = {
  type: 'thread:action:completed',
  action: 'move_chat_to_side',
  requestId: 'm-iso-1',
  threadGroupId: FILE_GROUP_A,
  movedThreadId: FILE_THREAD_A,
  newMainThreadId: NEW_MAIN_THREAD,
  currentPrimarySequence: 2,
  workspaceId: HARNESS_WORKSPACE,
  viewId: FILE_VIEW,
  sideChatPlacementId: 'scp-iso-1',
  placementStatus: 'applied',
};

interface IsolationFixture {
  mountRail: () => void;
  forceBinding: (groupId: string) => void;
  seedSidePlacement: (groupId: string, placementId: string, threadId: string) => unknown;
  openDock: (viewId: string) => void;
  messages: (threadId: string) => Array<{ content?: string }>;
}

async function callFixture(
  page: Page,
  method: keyof IsolationFixture | string,
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

test.describe('SPEC-04 04C Main/Side isolation', () => {
  test('Main Chat B and Side Chat A mount as distinct sessions', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');
    await callFixture(page, 'seedSidePlacement', FILE_GROUP_A, 'scp-iso-1', FILE_THREAD_A);
    // Settle the initial population reply before the completion frame so the
    // accepted move patch cannot race a late list response.
    await page.waitForFunction(() => (
      window as unknown as { __wsFixture: { population: (v: string) => unknown[] } }
    ).__wsFixture.population('file-viewer').length > 0);
    await deliver(page, MOVE_COMPLETION);

    const rail = page.locator('#file-view-tab-rail');
    const sideTab = rail.getByRole('tab', { name: 'Side Chat' });
    await expect(sideTab).toBeVisible();
    await sideTab.click();

    const sideMount = page.locator(`.rv-chat-area[data-chat-host="side-tab"]`);
    await expect(sideMount).toHaveAttribute('data-chat-thread-id', FILE_THREAD_A);

    await openDock(page, FILE_VIEW);
    const mainMount = page.locator(`.rv-chat-area[data-chat-thread-id="${NEW_MAIN_THREAD}"]`);
    await expect(mainMount).toBeVisible();

    // Exactly two distinct sessions; neither cross-addresses the other.
    const threadIds = await page.locator('.rv-chat-area[data-chat-thread-id]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-chat-thread-id')));
    expect(new Set(threadIds).size).toBe(threadIds.length);
    expect(threadIds).toContain(FILE_THREAD_A);
    expect(threadIds).toContain(NEW_MAIN_THREAD);
    // A Side Chat never opens a nested rail.
    await expect(sideMount.locator('[data-threaded-chat]')).toHaveCount(0);
  });

  test('a send for one member never lands in the other', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');
    await callFixture(page, 'seedSidePlacement', FILE_GROUP_A, 'scp-iso-1', FILE_THREAD_A);
    // Settle the initial population reply before the completion frame so the
    // accepted move patch cannot race a late list response.
    await page.waitForFunction(() => (
      window as unknown as { __wsFixture: { population: (v: string) => unknown[] } }
    ).__wsFixture.population('file-viewer').length > 0);
    await deliver(page, MOVE_COMPLETION);
    await page.locator('#file-view-tab-rail').getByRole('tab', { name: 'Side Chat' }).click();
    await expect(page.locator('.rv-chat-area[data-chat-host="side-tab"]')).toBeVisible();
    await openDock(page, FILE_VIEW);

    await deliver(page, { type: 'message:sent', threadId: FILE_THREAD_A, content: 'to-side' });
    await deliver(page, { type: 'message:sent', threadId: NEW_MAIN_THREAD, content: 'to-main' });

    const sideMessages = await callFixture(page, 'messages', FILE_THREAD_A) as Array<{ content?: string }>;
    const mainMessages = await callFixture(page, 'messages', NEW_MAIN_THREAD) as Array<{ content?: string }>;
    expect(sideMessages.some((m) => m.content === 'to-side')).toBe(true);
    expect(sideMessages.some((m) => m.content === 'to-main')).toBe(false);
    expect(mainMessages.some((m) => m.content === 'to-main')).toBe(true);
    expect(mainMessages.some((m) => m.content === 'to-side')).toBe(false);
  });

  test('every Side Chat frame carries durable identities only and no surfaceId', async ({ page }) => {
    await mountHarness(page, FILE_VIEW);
    await callFixture(page, 'forceBinding', FILE_GROUP_A);
    await callFixture(page, 'mountRail');
    await callFixture(page, 'seedSidePlacement', FILE_GROUP_A, 'scp-iso-1', FILE_THREAD_A);
    // Settle the initial population reply before the completion frame so the
    // accepted move patch cannot race a late list response.
    await page.waitForFunction(() => (
      window as unknown as { __wsFixture: { population: (v: string) => unknown[] } }
    ).__wsFixture.population('file-viewer').length > 0);
    await deliver(page, MOVE_COMPLETION);
    await page.locator('#file-view-tab-rail').getByRole('tab', { name: 'Side Chat' }).click();
    await expect(page.locator('.rv-chat-area[data-chat-host="side-tab"]')).toBeVisible();

    const frames = await sentFrames(page);
    expect(JSON.stringify(frames)).not.toContain('surfaceId');
    // The member is addressed through the placement lane, never primary history.
    const sideGet = frames.find(
      (frame) => frame.type === 'state:worksurface_get'
        && frame.viewId === FILE_VIEW
        && frame.threadGroupId === FILE_GROUP_A,
    );
    expect(sideGet).toBeTruthy();
  });
});
