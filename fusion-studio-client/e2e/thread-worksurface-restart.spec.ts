/**
 * @module e2e/thread-worksurface-restart.spec
 * @role CHAT-03 / SPEC-03 §10 03B gate: restart/readback, reconnect
 *       re-hydration, multi-window fan-out, lifecycle flush, the second view
 *       adapter, and inactive-mount/late-ack safety.
 *
 * Proves over the real controller, adapters, store, and frame handlers:
 *   - clean fan-out updates a clean cached entry; dirty entries are preserved;
 *   - restart restores only acknowledged, schema-valid content (no chat leakage);
 *   - reconnect hydrates acknowledged server truth and reapplies the exact
 *     pending capture;
 *   - view switch / panel close / workspace detach / teardown flush the outgoing
 *     bound key through the acknowledgement gate;
 *   - the Wiki Viewer second adapter switches groups, restores navigation, and
 *     fails inertly on unavailable content;
 *   - an inactive mounted view issues no duplicate requests and cannot apply
 *     another view's entry.
 *
 * No owner workspace, dev database, or port 3001 is used.
 */

import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  FILE_GROUP_A,
  FILE_GROUP_B,
  FILE_VIEW,
  WIKI_GROUP_A,
  WIKI_GROUP_B,
  WIKI_VIEW,
  fileTab,
  fixtureActivity,
  fixtureStore,
  fixtureWiki,
  mountHarness,
  openDock,
  serverEntries,
  sentFrames,
  type HarnessStoreSnapshot,
} from './worksurface-harness';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.resolve(ROOT, relative), 'utf8');
}

async function waitForGroup(page: Page, groupId: string): Promise<void> {
  await expect.poll(async () => (await fixtureStore(page)).currentGroup).toBe(groupId);
}

async function changeTabs(
  page: Page,
  tabs: Array<ReturnType<typeof fileTab>>,
  activeTabId: string,
): Promise<void> {
  await page.evaluate(([nextTabs, nextActive]) => (
    window as unknown as {
      __wsFixture: { replaceTabs: (t: unknown, a: string) => void };
    }
  ).__wsFixture.replaceTabs(nextTabs, nextActive), [tabs, activeTabId] as const);
}

async function clickGroup(page: Page, groupId: string): Promise<void> {
  await page.locator(`[data-thread-group-id="${groupId}"] .rv-chat-item-text`).click();
}

async function remoteWrite(
  page: Page,
  viewId: string,
  groupId: string,
  content: unknown,
): Promise<void> {
  await page.evaluate(([v, g, c]) => (
    window as unknown as {
      __wsFixture: { remoteWrite: (v: string, g: string, c: unknown) => unknown };
    }
  ).__wsFixture.remoteWrite(v, g, c), [viewId, groupId, content] as const);
}

async function callFixture<T>(
  page: Page,
  method: string,
  args: unknown[] = [],
): Promise<T> {
  return page.evaluate(([name, methodArgs]) => {
    const record = (window as unknown as {
      __wsFixture: Record<string, (...inner: unknown[]) => unknown>;
    }).__wsFixture;
    return record[name](...(methodArgs as unknown[])) as never;
  }, [method, args] as const) as Promise<T>;
}

async function stateOf(page: Page): Promise<HarnessStoreSnapshot> {
  return fixtureStore(page);
}

// ── Source sweeps ───────────────────────────────────────────────────────────

test('lifecycle flush and reconnect hooks are wired into production owners', () => {
  const app = readSource('src/components/App.tsx');
  expect(app).toContain('flushBoundView');
  expect(app).toContain("'view-change'");
  expect(app).toContain("'teardown'");
  const workspaceHandlers = readSource('src/lib/ws/workspace-handlers.ts');
  expect(workspaceHandlers).toContain('reconcileWorksurfacesOnReconnect');
  const workspaceStore = readSource('src/state/workspaceStore.ts');
  expect(workspaceStore).toContain('flushBoundWorkspaceViews');
  const wiki = readSource('src/components/wiki/WikiExplorer.tsx');
  expect(wiki).toContain('ViewWorksurfaceDock');
});

// ── Fan-out ─────────────────────────────────────────────────────────────────

test('a clean bound entry is updated from state:worksurface_changed', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/C1.md', 'C1.md')], `${FILE_VIEW}:ai/C1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  await remoteWrite(page, FILE_VIEW, FILE_GROUP_A, {
    tabs: [fileTab('ai/C2.md', 'C2.md')],
    activeTabId: `${FILE_VIEW}:ai/C2.md`,
  });

  // The clean entry re-reads acknowledged server truth and hydrates it.
  await expect.poll(async () => (await fixtureActivity(page, FILE_VIEW)).tabs.map((t) => t.path))
    .toEqual(['ai/C2.md']);
  expect((await stateOf(page)).binding?.threadGroupId).toBe(FILE_GROUP_A);
  expect((await stateOf(page)).pending).toBeNull();
});

// ── Renderer disappearance on delete ────────────────────────────────────────

test('an authoritative delete drops the cached worksurface entry for the exact group', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/D1.md', 'D1.md')], `${FILE_VIEW}:ai/D1.md`);
  await expect.poll(async () => (await stateOf(page)).entries).toHaveProperty(
    `worksurface-workspace::${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  // The server's delete acknowledgement carries durable identities only; every
  // window drops a cached copy of the deleted group (SPEC-03 §8 / 03B-D10).
  // Read synchronously with the delivery: a later re-read is a separate,
  // server-authoritative GET (the real server returns an absent entry).
  const remainingKeys = await page.evaluate(() => {
    const fixture = (window as unknown as {
      __wsFixture: { deliver: (m: unknown) => void; store: () => { entries: Record<string, unknown> } };
    }).__wsFixture;
    fixture.deliver({
      type: 'thread:action:completed',
      action: 'delete',
      requestId: 'd-e2e',
      threadId: 'thread-a',
      threadGroupId: 'group-a',
      workspaceId: 'worksurface-workspace',
      viewId: 'file-viewer',
      deleted: true,
      viewStateCleanup: { status: 'applied', attempts: 1 },
    });
    return Object.keys(fixture.store().entries);
  });
  expect(remainingKeys).not.toContain(`worksurface-workspace::${FILE_VIEW}::${FILE_GROUP_A}`);
});

// ── Restart / reconnect ─────────────────────────────────────────────────────

test('restart/readback restores exact acknowledged content with no chat-state leakage', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(
    page,
    [fileTab('ai/R1.md', 'R1.md'), fileTab('ai/R2.md', 'R2.md')],
    `${FILE_VIEW}:ai/R2.md`,
  );
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  const acknowledged = (await serverEntries(page))[`${FILE_VIEW}::${FILE_GROUP_A}`];
  const serialized = JSON.stringify(acknowledged);
  for (const forbidden of [
    'surfaceId', 'threadId', 'transcript', 'messages', 'draft', 'attachments', 'runtime',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }

  // Restart: remount over the same acknowledged on-disk entries.
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { remount: () => void } }
  ).__wsFixture.remount());
  await openDock(page, FILE_VIEW);
  await waitForGroup(page, FILE_GROUP_A);
  await expect.poll(async () => (await fixtureActivity(page, FILE_VIEW)).tabs.map((t) => t.path))
    .toEqual(['ai/R1.md', 'ai/R2.md']);
  expect((await fixtureActivity(page, FILE_VIEW)).activeTabId).toBe(`${FILE_VIEW}:ai/R2.md`);
  expect(JSON.stringify(await fixtureActivity(page, FILE_VIEW))).not.toContain('surfaceId');
});

test('reconnect hydrates acknowledged truth then reapplies the exact pending capture', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/N1.md', 'N1.md')], `${FILE_VIEW}:ai/N1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  // A local capture is in flight when the socket drops (hold the put).
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { holdNextPut: () => void } }
  ).__wsFixture.holdNextPut());
  await changeTabs(page, [fileTab('ai/N2.md', 'N2.md')], `${FILE_VIEW}:ai/N2.md`);
  await expect.poll(async () => (await stateOf(page)).pending).not.toBeNull();
  // Server truth is still N1; the local capture N2 is not acknowledged.
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { dropSocket: () => void; resetController: () => void } }
  ).__wsFixture.dropSocket());
  await callFixture(page, 'resetController');
  await expect.poll(async () => {
    const entry = (await serverEntries(page))[`${FILE_VIEW}::${FILE_GROUP_A}`];
    const content = entry?.content as { tabs?: Array<{ path: string }> } | null | undefined;
    return Array.isArray(content?.tabs) ? content.tabs.map((t) => t.path) : null;
  }).toEqual(['ai/N1.md']);

  // Reconnect: hydrate server truth, then reapply the retained pending capture.
  await callFixture(page, 'reconnect');
  await expect.poll(async () => {
    const entry = (await serverEntries(page))[`${FILE_VIEW}::${FILE_GROUP_A}`];
    return entry ? (entry.content as { tabs: Array<{ path: string }> }).tabs.map((t) => t.path) : null;
  }).toEqual(['ai/N2.md']);
  await expect.poll(async () => (await stateOf(page)).pending).toBeNull();
});

test('a reconnect with no pending capture re-reads acknowledged server truth', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/P1.md', 'P1.md')], `${FILE_VIEW}:ai/P1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );
  await remoteWrite(page, FILE_VIEW, FILE_GROUP_A, {
    tabs: [fileTab('ai/P2.md', 'P2.md')],
    activeTabId: `${FILE_VIEW}:ai/P2.md`,
  });
  await expect.poll(async () => (await fixtureActivity(page, FILE_VIEW)).tabs.map((t) => t.path))
    .toEqual(['ai/P2.md']);
  await callFixture(page, 'resetController');
  await callFixture(page, 'reconnect');
  await expect.poll(async () => (await stateOf(page)).binding?.threadGroupId).toBe(FILE_GROUP_A);
  await expect.poll(async () => (await fixtureActivity(page, FILE_VIEW)).tabs.map((t) => t.path))
    .toEqual(['ai/P2.md']);
});

// ── Lifecycle flush ─────────────────────────────────────────────────────────

test('view switch / detach / teardown flush the outgoing bound key through the ack gate', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/L1.md', 'L1.md')], `${FILE_VIEW}:ai/L1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  await page.evaluate(() => (
    window as unknown as { __wsFixture: { clearSent: () => void } }
  ).__wsFixture.clearSent());
  const flushed = await callFixture<boolean>(page, 'flushView', [FILE_VIEW, 'view-change']);
  expect(flushed).toBe(true);
  const puts = (await sentFrames(page)).filter(
    (frame) => frame.type === 'state:worksurface_put' && frame.threadGroupId === FILE_GROUP_A,
  );
  expect(puts.length).toBeGreaterThan(0);
  expect(JSON.stringify(puts)).not.toContain('surfaceId');

  // The explicit flush is acknowledged and clears the pending capture.
  await expect.poll(async () => (await stateOf(page)).pending).toBeNull();

  // Teardown flush covers every bound view of the workspace.
  const count = await callFixture<number>(page, 'flushWorkspace', ['teardown']);
  expect(count).toBeGreaterThanOrEqual(1);
});

test('an unacknowledged lifecycle flush is a warned conflict, never described as saved', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/M1.md', 'M1.md')], `${FILE_VIEW}:ai/M1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  await page.evaluate(() => (
    window as unknown as { __wsFixture: { forcePutError: (code: string) => void } }
  ).__wsFixture.forcePutError('revision_conflict'));
  await callFixture(page, 'flushView', [FILE_VIEW, 'view-change']);

  await expect.poll(async () => (await stateOf(page)).conflict?.reason).toBe('view-change');
  const state = await stateOf(page);
  expect(state.pending).not.toBeNull();
  expect(state.currentGroup).toBe(FILE_GROUP_A);
  const banner = page.locator(`[data-worksurface-conflict="${FILE_VIEW}"]`);
  await expect(banner).toContainText('Discard unsaved changes');

  // Detach/teardown use the same gate and the same warned-discard choice.
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { forcePutError: (code: string) => void } }
  ).__wsFixture.forcePutError('revision_conflict'));
  await callFixture(page, 'flushWorkspace', ['detach']);
  await expect.poll(async () => (await stateOf(page)).conflict?.reason).toBe('detach');
});

// ── Second view adapter (Wiki Viewer) ───────────────────────────────────────

test('the Wiki Viewer adapter switches groups and restores navigation', async ({ page }) => {
  await mountHarness(page, WIKI_VIEW);
  await expect.poll(async () => (await stateOf(page)).currentGroup).toBe(WIKI_GROUP_A);
  await callFixture(page, 'seedWiki');
  await callFixture(page, 'selectWikiNode', ['Alpha']);
  await expect.poll(async () => (await fixtureWiki(page)).viewedPath).toBe('Alpha');
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${WIKI_VIEW}::${WIKI_GROUP_A}`,
  );

  await clickGroup(page, WIKI_GROUP_B);
  await waitForGroup(page, WIKI_GROUP_B);
  await callFixture(page, 'selectWikiNode', ['Beta']);
  await expect.poll(async () => (await fixtureWiki(page)).viewedPath).toBe('Beta');
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${WIKI_VIEW}::${WIKI_GROUP_B}`,
  );

  await clickGroup(page, WIKI_GROUP_A);
  await waitForGroup(page, WIKI_GROUP_A);
  await expect.poll(async () => (await fixtureWiki(page)).viewedPath).toBe('Alpha');

  const entries = await serverEntries(page);
  const aStack = (entries[`${WIKI_VIEW}::${WIKI_GROUP_A}`].content as {
    navigation: { stack: Array<{ path: string }> };
  }).navigation.stack.map((item) => item.path);
  expect(aStack).toContain('Alpha');
  expect(JSON.stringify(entries)).not.toContain('surfaceId');
});

test('unavailable wiki content fails inertly with a classified warning', async ({ page }) => {
  await mountHarness(page, WIKI_VIEW);
  await expect.poll(async () => (await stateOf(page)).currentGroup).toBe(WIKI_GROUP_A);
  await callFixture(page, 'seedWiki');

  // Seed group B with a navigation stack that references a missing folder.
  await page.evaluate(([viewId, groupId]) => (
    window as unknown as {
      __wsFixture: { setEntry: (v: string, g: string, e: unknown) => void };
    }
  ).__wsFixture.setEntry(viewId, groupId, {
    schemaVersion: 1,
    adapterId: 'wiki-viewer',
    adapterVersion: 1,
    contentRevision: 'cr-missing',
    placementRevision: 'pr-missing',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: {
      navigation: {
        stack: [{
          id: 'wiki-viewer::Missing',
          panel: 'wiki-viewer',
          path: 'Missing',
          title: 'Missing',
          kind: 'page',
          extension: 'md',
          openedAt: 1,
        }],
        index: 0,
      },
    },
    managedComponentPlacements: {},
  }), [WIKI_VIEW, WIKI_GROUP_B] as const);

  await clickGroup(page, WIKI_GROUP_B);
  await waitForGroup(page, WIKI_GROUP_B);
  await expect.poll(async () => (await stateOf(page)).warnings).toContain('unavailable_content');
  // Inert fallback: the missing path never becomes the viewed page.
  expect((await fixtureWiki(page)).viewedPath).not.toBe('Missing');
  expect((await stateOf(page)).binding?.threadGroupId).toBe(WIKI_GROUP_B);
});

// ── Inactive mounts / late acknowledgements ─────────────────────────────────

test('an inactive mounted view issues no duplicate requests and cannot apply another view entry', async ({ page }) => {
  await mountHarness(page, FILE_VIEW);
  await waitForGroup(page, FILE_GROUP_A);

  await page.evaluate(([fileView, wikiView]) => (
    window as unknown as {
      __wsFixture: { mountViews: (v: Array<{ viewId: string; active: boolean }>) => void };
    }
  ).__wsFixture.mountViews([
    { viewId: fileView, active: true },
    { viewId: wikiView, active: false },
  ]), [FILE_VIEW, WIKI_VIEW] as const);
  // Open the inactive wiki dock so its host is genuinely mounted while inactive.
  await openDock(page, WIKI_VIEW);
  await waitForGroup(page, FILE_GROUP_A);
  await page.waitForTimeout(300);

  const frames = await sentFrames(page);
  expect(frames.filter((f) => f.type === 'thread:list' && f.viewId === WIKI_VIEW)).toHaveLength(0);
  expect((await stateOf(page)).binding?.threadGroupId).toBe(FILE_GROUP_A);

  // A fan-out for the inactive view's group never binds it or changes selection.
  await remoteWrite(page, WIKI_VIEW, WIKI_GROUP_A, { navigation: { stack: [], index: -1 } });
  await page.waitForTimeout(100);
  const after = await stateOf(page);
  expect(after.binding?.threadGroupId).toBe(FILE_GROUP_A);
  const bindingKeys = Object.keys(after.entries);
  expect(bindingKeys.some((key) => key.includes(`::${WIKI_VIEW}::`))).toBe(false);
});

test('a late read acknowledgement cannot steal the selected group', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/Q1.md', 'Q1.md')], `${FILE_VIEW}:ai/Q1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  // Hold group B's read, then complete a later selection to group C.
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { holdNextGet: () => void; forceBinding: (g: string) => void } }
  ).__wsFixture.holdNextGet());
  await clickGroup(page, FILE_GROUP_B);
  await waitForGroup(page, FILE_GROUP_B);
  await callFixture(page, 'forceBinding', ['group-c']);
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { releaseGet: () => void } }
  ).__wsFixture.releaseGet());
  await page.waitForTimeout(200);

  expect((await stateOf(page)).binding?.threadGroupId).toBe('group-c');
  expect((await stateOf(page)).currentGroup).toBe('group-c');
});
