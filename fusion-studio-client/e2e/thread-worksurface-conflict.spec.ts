/**
 * @module e2e/thread-worksurface-conflict.spec
 * @role CHAT-03 / SPEC-03 §10 03B gate: conflict, lifecycle, and multi-window
 *       continuity.
 *
 * Proves the non-destructive conflict state machine over the real controller,
 * real adapters, real store, and real frame handlers:
 *   - `revision_conflict`/rejection/timeout/`worksurface_unavailable`
 *     classification;
 *   - retained pending capture and outgoing-group retention;
 *   - Retry/Reconcile (adopt the server's returned current revision, including
 *     the identical-capture ack path) and the explicitly warned
 *     `Switch without saving` discard;
 *   - dirty-state preservation against a `state:worksurface_changed` fan-out;
 *   - no `surfaceId`/`threadId` in any worksurface lane.
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
  fileTab,
  fixtureActivity,
  fixtureStore,
  mountHarness,
  serverEntries,
  sentFrames,
  type HarnessStoreSnapshot,
} from './worksurface-harness';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.resolve(ROOT, relative), 'utf8');
}

/**
 * 03D split `worksurfaceController.ts` into focused sibling modules behind a
 * stable facade. The controller state machine is now asserted across the whole
 * `src/lib/worksurface/` implementation, not one file.
 */
function readWorksurfaceModules(): string {
  const dir = path.resolve(ROOT, 'src/lib/worksurface');
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
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

async function conflictState(page: Page): Promise<HarnessStoreSnapshot> {
  return fixtureStore(page);
}

async function callFixture<T>(page: Page, method: string, args: unknown[] = []): Promise<T> {
  return page.evaluate(([name, methodArgs]) => {
    const record = (window as unknown as {
      __wsFixture: Record<string, (...inner: unknown[]) => unknown>;
    }).__wsFixture;
    return record[name](...(methodArgs as unknown[])) as never;
  }, [method, args] as const) as Promise<T>;
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

// ── Source sweeps ───────────────────────────────────────────────────────────

test('the controller implements the conflict/lifecycle state machine with one discard path', () => {
  const controller = readWorksurfaceModules();
  expect(controller).toContain('classifyConflictKind');
  expect(controller).toContain('revision_conflict');
  expect(controller).toContain('retryPendingWorksurfaceCapture');
  expect(controller).toContain('discardPendingWorksurfaceConflict');
  expect(controller).toContain('reconcileWorksurfacesOnReconnect');
  expect(controller).toContain('buildConflict');
  expect(controller).not.toContain('surfaceId');
  const facade = readSource('src/lib/worksurface/worksurfaceController.ts');
  expect(facade).toContain('requestGroupSelection');
  expect(facade).not.toContain('surfaceId');

  const slice = readSource('src/state/slices/worksurfaceSlice.ts');
  expect(slice).toContain('WorksurfaceConflict');
  expect(slice).toContain('lossRisk');
  expect(slice).toContain('worksurfaceConflicts');

  const banner = readSource('src/components/chat/WorksurfaceConflictBanner.tsx');
  expect(banner).toContain('Switch without saving');
  expect(banner).toContain('Retry saving');
  expect(banner).not.toContain('surfaceId');
});

test('the wiki-viewer second adapter is registered and JSON-safe', () => {
  const builtins = readSource('src/lib/worksurface/builtins.ts');
  expect(builtins).toContain('wikiViewerWorksurfaceAdapter');
  const adapter = readSource('src/lib/worksurface/wikiViewerWorksurfaceAdapter.ts');
  expect(adapter).toContain('capture');
  expect(adapter).toContain('sanitize');
  expect(adapter).toContain('restore');
  expect(adapter).not.toContain('surfaceId');
});

// ── Conflict lifecycle ──────────────────────────────────────────────────────

test('revision_conflict is non-destructive and Retry saving reconciles then succeeds', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/A1.md', 'A1.md')], `${FILE_VIEW}:ai/A1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  await page.evaluate(() => (
    window as unknown as { __wsFixture: { forcePutError: (code: string) => void } }
  ).__wsFixture.forcePutError('revision_conflict'));
  await changeTabs(page, [fileTab('ai/A2.md', 'A2.md')], `${FILE_VIEW}:ai/A2.md`);

  await expect.poll(async () => (await conflictState(page)).conflict?.kind)
    .toBe('revision_conflict');
  const conflicted = await conflictState(page);
  // Outgoing group stays selected/mounted; the exact pending capture is retained.
  expect(conflicted.currentGroup).toBe(FILE_GROUP_A);
  expect(conflicted.binding?.threadGroupId).toBe(FILE_GROUP_A);
  expect(conflicted.pending).not.toBeNull();
  expect((conflicted.pending as { content: { tabs: Array<{ path: string }> } })
    .content.tabs.map((t) => t.path)).toEqual(['ai/A2.md']);
  expect(conflicted.conflict?.lossRisk).toBe(true);
  // The conflict banner names the loss rather than describing the change as saved.
  const banner = page.locator(`[data-worksurface-conflict="${FILE_VIEW}"]`);
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute('data-conflict-loss', 'true');

  // Retry/reconcile: adopt the server's returned current revision, resend.
  await page.locator('.rv-worksurface-conflict-retry').click();
  await expect.poll(async () => (await conflictState(page)).conflict).toBeNull();
  await expect.poll(async () => (await conflictState(page)).pending).toBeNull();
  await expect.poll(async () => {
    const entry = (await serverEntries(page))[`${FILE_VIEW}::${FILE_GROUP_A}`];
    return entry ? (entry.content as { tabs: Array<{ path: string }> }).tabs.map((t) => t.path) : null;
  }).toEqual(['ai/A2.md']);
});

test('a rejected switch keeps the outgoing group selected until the warned discard', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/B1.md', 'B1.md')], `${FILE_VIEW}:ai/B1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  await page.evaluate(() => (
    window as unknown as { __wsFixture: { forcePutError: (code: string) => void } }
  ).__wsFixture.forcePutError('revision_conflict'));
  await clickGroup(page, FILE_GROUP_B);

  await expect.poll(async () => (await conflictState(page)).conflict?.toGroupId).toBe(FILE_GROUP_B);
  const state = await conflictState(page);
  // The outgoing surface is still the selected/mounted group.
  expect(state.currentGroup).toBe(FILE_GROUP_A);
  expect(state.binding?.threadGroupId).toBe(FILE_GROUP_A);
  expect(state.pending).not.toBeNull();

  const banner = page.locator(`[data-worksurface-conflict="${FILE_VIEW}"]`);
  await expect(banner).toContainText('Switch without saving');
  await expect(banner).toContainText(/discard the unsaved content/);

  // Nothing is discarded until the explicit warned choice.
  expect((await conflictState(page)).pending).not.toBeNull();

  await page.locator(`[data-worksurface-discard="${FILE_VIEW}"]`).click();
  await waitForGroup(page, FILE_GROUP_B);
  await expect.poll(async () => (await conflictState(page)).pending).toBeNull();
  await expect.poll(async () => (await conflictState(page)).conflict).toBeNull();
  // The warned discard never wrote the outgoing capture under the incoming key.
  const entries = await serverEntries(page);
  expect(entries[`${FILE_VIEW}::${FILE_GROUP_B}`]).toBeUndefined();
});

test('Retry saving on a switch conflict reconciles, saves the outgoing key, then switches', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/S1.md', 'S1.md')], `${FILE_VIEW}:ai/S1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  await page.evaluate(() => (
    window as unknown as { __wsFixture: { forcePutError: (code: string) => void } }
  ).__wsFixture.forcePutError('revision_conflict'));
  await clickGroup(page, FILE_GROUP_B);
  await expect.poll(async () => (await conflictState(page)).conflict?.toGroupId).toBe(FILE_GROUP_B);

  await page.locator('.rv-worksurface-conflict-retry').click();
  await waitForGroup(page, FILE_GROUP_B);
  await expect.poll(async () => {
    const entry = (await serverEntries(page))[`${FILE_VIEW}::${FILE_GROUP_A}`];
    return entry ? (entry.content as { tabs: Array<{ path: string }> }).tabs.map((t) => t.path) : null;
  }).toEqual(['ai/S1.md']);
  // The switch itself never created an entry under the incoming key.
  expect((await serverEntries(page))[`${FILE_VIEW}::${FILE_GROUP_B}`]).toBeUndefined();
});

test('selecting another group while conflicted updates the warned-discard target without bypassing the gate', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/T1.md', 'T1.md')], `${FILE_VIEW}:ai/T1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  await page.evaluate(() => (
    window as unknown as { __wsFixture: { forcePutError: (code: string) => void } }
  ).__wsFixture.forcePutError('revision_conflict'));
  await clickGroup(page, FILE_GROUP_B);
  await expect.poll(async () => (await conflictState(page)).conflict?.toGroupId).toBe(FILE_GROUP_B);

  // A later selection only retargets the warned discard; the outgoing group
  // stays selected and no queued switch runs past the conflict.
  await clickGroup(page, 'group-c');
  await expect.poll(async () => (await conflictState(page)).conflict?.toGroupId).toBe('group-c');
  expect((await conflictState(page)).currentGroup).toBe(FILE_GROUP_A);
  expect((await conflictState(page)).binding?.threadGroupId).toBe(FILE_GROUP_A);
  const putsToC = (await sentFrames(page)).filter(
    (frame) => frame.type === 'state:worksurface_put' && frame.threadGroupId === 'group-c',
  );
  expect(putsToC).toHaveLength(0);

  await page.locator(`[data-worksurface-discard="${FILE_VIEW}"]`).click();
  await waitForGroup(page, 'group-c');
});

test('rejection, timeout, and worksurface_unavailable are classified distinctly', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);

  // Rejection (bounded server error).
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { forcePutError: (code: string) => void } }
  ).__wsFixture.forcePutError('content_too_large'));
  await changeTabs(page, [fileTab('ai/C1.md', 'C1.md')], `${FILE_VIEW}:ai/C1.md`);
  await expect.poll(async () => (await conflictState(page)).conflict?.kind).toBe('rejected');
  expect((await conflictState(page)).conflict?.code).toBe('content_too_large');
  await callFixture(page, 'discard', [FILE_VIEW]);
  await expect.poll(async () => (await conflictState(page)).conflict).toBeNull();

  // Timeout (no acknowledgement within the bounded window).
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { holdNextPut: () => void } }
  ).__wsFixture.holdNextPut());
  await changeTabs(page, [fileTab('ai/C2.md', 'C2.md')], `${FILE_VIEW}:ai/C2.md`);
  await expect.poll(async () => (await conflictState(page)).conflict?.kind, { timeout: 5000 })
    .toBe('timeout');
  expect((await conflictState(page)).pending).not.toBeNull();
  await callFixture(page, 'resetController');
  await callFixture(page, 'discard', [FILE_VIEW]);
  await expect.poll(async () => (await conflictState(page)).conflict).toBeNull();

  // Workspace unavailable (socket down).
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { dropSocket: () => void } }
  ).__wsFixture.dropSocket());
  await changeTabs(page, [fileTab('ai/C3.md', 'C3.md')], `${FILE_VIEW}:ai/C3.md`);
  await expect.poll(async () => (await conflictState(page)).conflict?.kind)
    .toBe('worksurface_unavailable');
  expect((await conflictState(page)).pending).not.toBeNull();
});

test('a dirty local entry records newer remote state and is never silently replaced', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/D1.md', 'D1.md')], `${FILE_VIEW}:ai/D1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  // Hold the local write so a newer capture is dirty/in-flight.
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { holdNextPut: () => void } }
  ).__wsFixture.holdNextPut());
  await changeTabs(page, [fileTab('ai/D2.md', 'D2.md')], `${FILE_VIEW}:ai/D2.md`);
  await expect.poll(async () => (await conflictState(page)).pending).not.toBeNull();

  const getsBefore = (await sentFrames(page)).filter(
    (frame) => frame.type === 'state:worksurface_get' && frame.threadGroupId === FILE_GROUP_A,
  ).length;

  // Another window writes; the dirty entry records the newer remote state.
  await remoteWrite(page, FILE_VIEW, FILE_GROUP_A, {
    tabs: [fileTab('ai/D3.md', 'D3.md')],
    activeTabId: `${FILE_VIEW}:ai/D3.md`,
  });
  await page.waitForTimeout(100);

  const state = await conflictState(page);
  // The pending local capture is preserved; the fan-out did not replace it.
  expect((state.pending as { content: { tabs: Array<{ path: string }> } })
    .content.tabs.map((t) => t.path)).toEqual(['ai/D2.md']);
  expect(state.binding?.threadGroupId).toBe(FILE_GROUP_A);
  // A dirty entry does not issue a hydrating read.
  const getsAfter = (await sentFrames(page)).filter(
    (frame) => frame.type === 'state:worksurface_get' && frame.threadGroupId === FILE_GROUP_A,
  ).length;
  expect(getsAfter).toBe(getsBefore);

  // Releasing the stale write conflicts; the newer pending capture survives (F2).
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { releasePut: () => void } }
  ).__wsFixture.releasePut());
  await expect.poll(async () => (await conflictState(page)).conflict).not.toBeNull();
  expect((await conflictState(page)).pending).not.toBeNull();
  expect((await conflictState(page)).warnings).toContain('revision_conflict');
});

test('no worksurface request or entry carries surfaceId or threadId', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await changeTabs(page, [fileTab('ai/E1.md', 'E1.md')], `${FILE_VIEW}:ai/E1.md`);
  await expect.poll(async () => Object.keys(await serverEntries(page))).toContain(
    `${FILE_VIEW}::${FILE_GROUP_A}`,
  );

  const serializedFrames = JSON.stringify(await sentFrames(page));
  expect(serializedFrames).not.toContain('surfaceId');
  expect(serializedFrames).not.toContain('threadId');
  const serializedEntries = JSON.stringify(await serverEntries(page));
  expect(serializedEntries).not.toContain('surfaceId');
  expect(serializedEntries).not.toContain('threadId');
  expect(serializedEntries).not.toContain('transcript');
  expect(serializedEntries).not.toContain('runtime');
});

test('activity content is captured under the outgoing group only', async ({ page }) => {
  await mountHarness(page);
  await waitForGroup(page, FILE_GROUP_A);
  await page.evaluate(() => (
    window as unknown as { __wsFixture: { clearSent: () => void } }
  ).__wsFixture.clearSent());
  await changeTabs(page, [fileTab('ai/F1.md', 'F1.md')], `${FILE_VIEW}:ai/F1.md`);
  await expect.poll(async () => (await fixtureActivity(page, FILE_VIEW)).tabs.map((t) => t.path))
    .toEqual(['ai/F1.md']);
  // Exactly one owning lane: the controller's content put, never `state:set`.
  const frames = await sentFrames(page);
  expect(frames.some((frame) => frame.type === 'state:set')).toBe(false);
});
