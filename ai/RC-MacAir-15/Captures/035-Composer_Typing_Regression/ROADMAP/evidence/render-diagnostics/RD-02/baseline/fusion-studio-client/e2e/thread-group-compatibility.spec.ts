import { expect, test } from '@playwright/test';

import {
  makeThreadActionRequestId,
  threadActionCopyLink,
  threadActionDelete,
  threadActionRename,
  threadActionViewMarkdown,
  threadGroupRowFromProjection,
  threadOpenRequest,
  threadRowsFromProjections,
} from '../src/lib/ws/threadGroupRows';

/**
 * SPEC-01 Slice 01A renderer compatibility.
 *
 * The current rail must consume group-backed rows without extracting the
 * composable surfaces owned by SPEC-02. These checks pin the pure translation
 * boundary; the browser check confirms the isolated app shell (fresh temp
 * profile, migrations applied) mounts the rendered client.
 */
test.describe('Thread Group renderer compatibility', () => {
  test('maps a group projection to a row with primary routing and group identity', () => {
    const row = threadGroupRowFromProjection({
      threadGroupId: 'tg-1',
      workspaceId: 'workspace-1',
      viewId: null,
      name: 'Alpha',
      currentPrimaryThreadId: 't-1',
      currentPrimarySequence: 1,
      memberCount: 1,
      createdAt: 1000,
      updatedAt: 2000,
      entry: {
        name: 'Alpha',
        createdAt: '2026-09-13T00:00:00.000Z',
        messageCount: 2,
        status: 'suspended',
      },
    });

    expect(row.threadId).toBe('t-1');
    expect(row.threadGroupId).toBe('tg-1');
    expect(row.viewId).toBeNull();
    expect(row.memberCount).toBe(1);
    expect(row.entry.name).toBe('Alpha');
    expect(JSON.stringify(row)).not.toContain('surfaceId');
  });

  test('rows open by threadGroupId, falling back to the exact session for legacy consumers', () => {
    expect(threadOpenRequest('tg-1', 't-1')).toEqual({ type: 'thread:open', threadGroupId: 'tg-1' });
    expect(threadOpenRequest(undefined, 't-1')).toEqual({ type: 'thread:open', threadId: 't-1' });
  });

  test('preserves one row per projection and never invents a group identity', () => {
    const rows = threadRowsFromProjections([
      {
        currentPrimaryThreadId: 't-1',
        currentPrimarySequence: 1,
        memberCount: 1,
        entry: { name: 'A', createdAt: 'x', messageCount: 0, status: 'suspended' },
      },
      {
        threadGroupId: 'tg-2',
        currentPrimaryThreadId: 't-2',
        currentPrimarySequence: 1,
        memberCount: 1,
        entry: { name: 'B', createdAt: 'y', messageCount: 0, status: 'suspended' },
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].threadGroupId).toBeUndefined();
    expect(rows[1].threadGroupId).toBe('tg-2');
    expect(rows.map((row) => row.threadId)).toEqual(['t-1', 't-2']);
  });

  test('rename and delete intents are canonical thread:action group mutations', () => {
    const rename = threadActionRename({ threadGroupId: 'tg-1', threadId: 't-1', name: 'Renamed' });
    expect(rename).toMatchObject({
      type: 'thread:action',
      action: 'rename',
      threadGroupId: 'tg-1',
      threadId: 't-1',
      name: 'Renamed',
    });
    expect(rename.requestId).toEqual(expect.any(String));
    expect(rename.requestId.length).toBeGreaterThan(0);
    expect(JSON.stringify(rename)).not.toContain('surfaceId');

    const remove = threadActionDelete({ threadGroupId: 'tg-1', threadId: 't-1' });
    expect(remove).toMatchObject({
      type: 'thread:action',
      action: 'delete',
      threadGroupId: 'tg-1',
      threadId: 't-1',
    });
    expect(remove.requestId).not.toBe(rename.requestId);
    expect(JSON.stringify(remove)).not.toContain('surfaceId');
  });

  test('each action requestId is unique and bounded', () => {
    const ids = new Set(Array.from({ length: 32 }, () => makeThreadActionRequestId()));
    expect(ids.size).toBe(32);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(128);
  });

  test('copy_link and view_markdown are canonical thread:action intents with no raw route', () => {
    const copy = threadActionCopyLink({ threadGroupId: 'tg-1', threadId: 't-1' });
    expect(copy).toMatchObject({
      type: 'thread:action',
      action: 'copy_link',
      threadGroupId: 'tg-1',
      threadId: 't-1',
    });
    expect(copy.requestId).toEqual(expect.any(String));
    expect(JSON.stringify(copy)).not.toContain('surfaceId');

    const markdown = threadActionViewMarkdown({ threadGroupId: 'tg-1', threadId: 't-1' });
    expect(markdown).toMatchObject({
      type: 'thread:action',
      action: 'view_markdown',
      threadGroupId: 'tg-1',
      threadId: 't-1',
    });
    expect(JSON.stringify(markdown)).not.toContain('thread:copyLink');
    expect(JSON.stringify(markdown)).not.toContain('surfaceId');
    expect(markdown.requestId).not.toBe(copy.requestId);
  });

  test('isolated app shell mounts and reports no page error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});
