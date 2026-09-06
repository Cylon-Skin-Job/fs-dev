import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

type WireMessage = Record<string, unknown> & { type: string };

declare global {
  interface Window {
    __provenanceIncoming: WireMessage[];
    __provenanceOutgoing: WireMessage[];
    __provenanceSequence: Array<{ kind: string; type?: string; text?: string; payload?: WireMessage }>;
    __provenanceSockets: WebSocket[];
    __provenanceHoldReads: boolean;
    __provenanceHeldRequestIds: Set<string>;
    __provenanceHeldMessages: WireMessage[];
    __provenanceVisibleObserver?: MutationObserver;
  }
}

const scenario = process.env.FUSION_PROVENANCE_TEST_SCENARIO;
const port = Number(process.env.PORT);
const appData = process.env.FUSION_APP_USER_DATA!;
const workspaces = JSON.parse(process.env.FUSION_PROVENANCE_TEST_WORKSPACES || '[]') as Array<{
  id: string;
  label: string;
  repoPath: string;
}>;
const expectedStartupEffects = [
  'calendar-adapters',
  'calendar-broadcaster',
  'cli-config-bootstrap',
  'harness-broadcaster',
  'harness-status-revalidation',
  'hotkey-screenshot-watcher',
  'theme-css-bootstrap',
  'workspace-watcher-trigger-pipeline',
];

function installBrowserWireObserver(page: Page) {
  return page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.__provenanceIncoming = [];
    window.__provenanceOutgoing = [];
    window.__provenanceSequence = [];
    window.__provenanceSockets = [];
    window.__provenanceHoldReads = false;
    window.__provenanceHeldRequestIds = new Set();
    window.__provenanceHeldMessages = [];
    class ObservedWebSocket extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        window.__provenanceSockets.push(this);
        this.addEventListener('message', (event) => {
          try {
            const payload = JSON.parse(String(event.data)) as WireMessage;
            if (window.__provenanceHoldReads
              && typeof payload.requestId === 'string'
              && window.__provenanceHeldRequestIds.has(payload.requestId)) {
              event.stopImmediatePropagation();
              window.__provenanceHeldMessages.push(payload);
              window.__provenanceSequence.push({ kind: 'held-message', type: payload.type, payload });
              return;
            }
            window.__provenanceIncoming.push(payload);
            window.__provenanceSequence.push({ kind: 'message', type: payload.type, payload });
          } catch {
            window.__provenanceSequence.push({ kind: 'invalid-message' });
          }
        });
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data === 'string') {
          try {
            const payload = JSON.parse(data) as WireMessage;
            window.__provenanceOutgoing.push(payload);
            if (window.__provenanceHoldReads && payload.panel === 'file-viewer' && (
              (payload.type === 'file_tree_request' && payload.path === 'target')
              || (payload.type === 'file_content_request' && payload.path === 'target/live.txt')
            )) {
              if (typeof payload.requestId === 'string') window.__provenanceHeldRequestIds.add(payload.requestId);
            }
          } catch {}
        }
        super.send(data);
      }
    }
    Object.defineProperty(window, 'WebSocket', { value: ObservedWebSocket, configurable: false });
  });
}

async function waitForPageMessage(page: Page, predicate: (message: WireMessage) => boolean) {
  let found: WireMessage | undefined;
  await expect.poll(async () => {
    const messages = await page.evaluate(() => window.__provenanceIncoming);
    found = messages.find(predicate);
    return Boolean(found);
  }).toBe(true);
  if (!found) throw new Error('Expected browser message was not retained.');
  return found;
}

async function openFolder(page: Page, name: string) {
  const label = page.locator('.rv-tree-label', {
    hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
  }).first();
  await expect(label).toBeVisible();
  const row = label.locator('..');
  const icon = row.locator(':scope > .rv-tree-icon');
  if ((await icon.textContent())?.trim() !== 'folder_open') {
    await label.click();
    await expect(icon).toHaveText('folder_open');
  }
}

async function openFile(page: Page, folders: string[], fileName: string) {
  for (const folder of folders) await openFolder(page, folder);
  const label = page.getByText(fileName, { exact: true }).first();
  await expect(label).toBeVisible();
  await label.click();
}

function parseMessageEvent(event: Event): WireMessage | null {
  try { return JSON.parse(String((event as MessageEvent).data)) as WireMessage; } catch { return null; }
}

async function fixtureConnection() {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const messages: WireMessage[] = [];
  socket.addEventListener('message', (event) => {
    const message = parseMessageEvent(event);
    if (message) messages.push(message);
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('Fixture WebSocket failed to open.')), { once: true });
  });
  await waitForFixtureMessage(messages, (message) => message.type === 'workspace:init');
  const connected = await waitForFixtureMessage(messages, (message) => message.type === 'connected');
  if (typeof connected.connectionId !== 'string' || !connected.connectionId) {
    throw new Error('Fixture WebSocket did not receive a connection identity.');
  }
  return { socket, messages, connectionId: connected.connectionId };
}

async function waitForFixtureMessage(
  messages: WireMessage[],
  predicate: (message: WireMessage) => boolean,
  after = 0,
) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const found = messages.slice(after).find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for fixture WebSocket message.');
}

async function sendAndWait(
  fixture: Awaited<ReturnType<typeof fixtureConnection>>,
  request: WireMessage,
  predicate: (message: WireMessage) => boolean,
) {
  const after = fixture.messages.length;
  fixture.socket.send(JSON.stringify(request));
  return waitForFixtureMessage(fixture.messages, predicate, after);
}

function currentFixturePair(messages: WireMessage[]) {
  const binding = [...messages].reverse().find((message) => (
    message.type === 'workspace:init' || message.type === 'workspace:switched'
  ));
  if (!binding || typeof binding.workspaceId !== 'string' || typeof binding.workspaceEpoch !== 'string') {
    throw new Error('Fixture connection has no current workspace pair.');
  }
  return { workspaceId: binding.workspaceId, workspaceEpoch: binding.workspaceEpoch };
}

function saveRequest(pair: ReturnType<typeof currentFixturePair>, requestId: string, panel: string, filePath: string, content: string): WireMessage {
  return {
    type: 'file_save', version: 1, requestId,
    ...pair, panel, path: filePath, content, reason: 'manual',
    reportedUiContext: { viewId: 'file-viewer', viewInstanceId: 'isolated-live-proof' },
  };
}

async function assertStartupAudit() {
  const auditPath = path.join(appData, 'isolated-provenance-audit.json');
  await expect.poll(() => fs.existsSync(auditPath)).toBe(true);
  let audit = JSON.parse(fs.readFileSync(auditPath, 'utf8')) as Record<string, unknown>;
  await expect.poll(() => {
    audit = JSON.parse(fs.readFileSync(auditPath, 'utf8')) as Record<string, unknown>;
    const runtimeEffect = (audit.runtimeEffects as WireMessage[] | undefined)?.find((effect) => (
      effect.name === 'harness-http-revalidation'
    ));
    return Number(runtimeEffect?.startRequests || 0);
  }).toBeGreaterThan(0);
  expect(audit).toMatchObject({
    mode: 'isolated-v1', machine: 'Test-Provenance', scenario, port,
    dbExists: true,
    observationGuards: {
      installed: true,
      attempts: { childProcess: 0, filesystemWatch: 0 },
    },
  });
  expect(audit.startupEffects).toEqual(expectedStartupEffects.map((name) => ({
    name,
    startRequests: 1,
    blockedRequests: 1,
    prohibitedAttempts: 0,
    factoryInvocations: 0,
  })));
  const runtimeEffect = (audit.runtimeEffects as WireMessage[]).find((effect) => (
    effect.name === 'harness-http-revalidation'
  ));
  expect(runtimeEffect).toMatchObject({
    blockedRequests: runtimeEffect?.startRequests,
    prohibitedAttempts: 0,
    factoryInvocations: 0,
  });
  expect(audit.registeredWorkspaces).toEqual(workspaces.map(({ id, repoPath }) => ({ id, repoPath })));
}

async function prepareFileViewer(page: Page) {
  await installBrowserWireObserver(page);
  await page.goto('/');
  await expect(page.locator('button[title="Files"]')).toBeVisible();
  await page.locator('button[title="Files"]').click();
  await expect(page.locator('.rv-file-explorer-layout')).toBeVisible();
  await openFile(page, ['other'], 'untouched.txt');
  await expect(page.locator('.rv-file-viewer-content')).toContainText('untouched workspace-a');
  await openFile(page, ['target'], 'live.txt');
  await expect(page.locator('.rv-file-viewer-content')).toContainText('version one Ω');
}

async function observeVisibleText(page: Page, text: string) {
  await page.evaluate((expected) => {
    window.__provenanceVisibleObserver?.disconnect();
    const root = document.querySelector('.rv-file-viewer-content');
    if (!root) throw new Error('File Viewer content root is missing.');
    window.__provenanceVisibleObserver = new MutationObserver(() => {
      if (root.textContent?.includes(expected)) {
        window.__provenanceSequence.push({ kind: 'visible', text: expected });
        window.__provenanceVisibleObserver?.disconnect();
      }
    });
    window.__provenanceVisibleObserver.observe(root, { childList: true, characterData: true, subtree: true });
  }, text);
}

async function releaseHeldA1Reads(page: Page, rollbackContent: string, rollbackFileName: string) {
  await page.evaluate(({ content, fileName }) => {
    window.__provenanceHoldReads = false;
    const socket = window.__provenanceSockets.at(-1);
    if (!socket) throw new Error('The application WebSocket is missing.');
    const contentBytes = new TextEncoder().encode(content).byteLength;
    for (const held of window.__provenanceHeldMessages) {
      const message = held.type === 'file_content_response'
        ? { ...held, content, size: contentBytes }
        : held.type === 'file_tree_response'
          ? {
              ...held,
              nodes: [{
                name: fileName,
                path: `target/${fileName}`,
                type: 'file',
                extension: 'txt',
              }],
            }
          : held;
      socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
    }
  }, { content: rollbackContent, fileName: rollbackFileName });
}

test('ordinary File Viewer save projects, refetches narrowly, joins provenance, rejects stale/duplicate delivery, rehydrates, and preserves aliases', async ({ page }) => {
  test.skip(scenario !== 'normal');
  await prepareFileViewer(page);
  await assertStartupAudit();
  const fixture = await fixtureConnection();
  try {
    await page.locator('.rv-file-explorer-layout').evaluate((node) => node.setAttribute('data-provenance-mount', 'original'));
    const browserA1 = await waitForPageMessage(page, (message) => message.type === 'workspace:init');
    const firstPair = currentFixturePair(fixture.messages);
    const outgoingBeforeSave = await page.evaluate(() => window.__provenanceOutgoing.length);
    await observeVisibleText(page, 'version two λ');
    const save = await sendAndWait(
      fixture,
      saveRequest(firstPair, 'save-live-1', 'file-viewer', 'target/live.txt', 'version two λ\n'),
      (message) => message.type === 'file_save_response' && message.requestId === 'save-live-1',
    );
    expect(save).toMatchObject({
      success: true, outcome: 'succeeded', workspaceId: firstPair.workspaceId,
      workspaceEpoch: firstPair.workspaceEpoch, panel: 'file-viewer', path: 'target/live.txt',
      canonicalPath: 'target/live.txt', commandFactState: 'admitted', resourceFactState: 'admitted',
      ledgerState: 'stored', provenanceState: 'complete',
    });
    const projection = await waitForPageMessage(page, (message) => (
      message.type === 'resource:changed' && message.eventId === save.resourceEventId
    ));
    expect(projection).toMatchObject({
      version: 1, eventId: save.resourceEventId, operationId: save.operationId,
      workspaceId: save.workspaceId, workspaceEpoch: browserA1.workspaceEpoch,
      resourceId: save.resourceId, resourceKind: 'file', operation: 'modify',
      panel: 'file-viewer', path: 'target/live.txt',
    });
    await expect(page.locator('.rv-file-viewer-content')).toContainText('version two λ');
    const sequence = await page.evaluate(() => window.__provenanceSequence);
    expect(sequence.findIndex((entry) => entry.kind === 'message' && entry.type === 'resource:changed' && entry.payload?.eventId === projection.eventId))
      .toBeLessThan(sequence.findIndex((entry) => entry.kind === 'visible' && entry.text === 'version two λ'));
    await expect(page.locator('.rv-file-explorer-layout')).toHaveAttribute('data-provenance-mount', 'original');
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);

    await expect.poll(async () => page.evaluate((start) => window.__provenanceOutgoing.slice(start).filter((message) => (
      message.type === 'file_content_request' || message.type === 'file_tree_request'
    )), outgoingBeforeSave)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'file_content_request', panel: 'file-viewer', path: 'target/live.txt' }),
      expect.objectContaining({ type: 'file_tree_request', panel: 'file-viewer', path: 'target' }),
    ]));
    const refreshReads = await page.evaluate((start) => window.__provenanceOutgoing.slice(start).filter((message) => (
      message.type === 'file_content_request' || message.type === 'file_tree_request'
    )), outgoingBeforeSave);
    expect(refreshReads.filter((message) => message.type === 'file_content_request' && message.path === 'target/live.txt')).toHaveLength(1);
    expect(refreshReads.filter((message) => message.type === 'file_tree_request' && message.path === 'target')).toHaveLength(1);
    expect(refreshReads.some((message) => message.path === 'other/untouched.txt' || message.path === 'other')).toBe(false);
    expect((await page.evaluate((start) => window.__provenanceOutgoing.slice(start), outgoingBeforeSave))
      .some((message) => message.type === 'set_panel')).toBe(false);

    const query = await sendAndWait(fixture, {
      type: 'resource:provenance:query', version: 1, requestId: 'query-live-1',
      ...firstPair, panel: 'file-viewer', path: 'target/live.txt', operationId: save.operationId, limit: 10,
    }, (message) => message.type === 'resource:provenance:result' && message.requestId === 'query-live-1');
    expect(query).toMatchObject({ workspaceId: firstPair.workspaceId, workspaceEpoch: firstPair.workspaceEpoch });
    const item = (query.items as WireMessage[])[0];
    expect(item).toMatchObject({
      eventId: save.resourceEventId, operationId: save.operationId, commandId: save.commandId,
      commandAcceptedEventId: save.commandAcceptedEventId, resourceId: save.resourceId,
      fileVersionId: save.fileVersionId, canonicalPath: 'target/live.txt',
      ingress: { panel: 'file-viewer', path: 'target/live.txt' },
      origin: {
        kind: 'local_client',
        connectionId: fixture.connectionId,
        assurance: 'transport_only',
      },
    });

    const incomingBeforeRejected = await page.evaluate(() => window.__provenanceIncoming.length);
    const rejected = await sendAndWait(
      fixture,
      saveRequest(firstPair, 'save-rejected-1', 'file-viewer', '../escape.txt', 'must not write\n'),
      (message) => message.type === 'file_save_response' && message.requestId === 'save-rejected-1',
    );
    expect(rejected).toMatchObject({ success: false, outcome: 'rejected' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const afterRejected = await page.evaluate((start) => window.__provenanceIncoming.slice(start), incomingBeforeRejected);
    expect(afterRejected.some((message) => message.type === 'resource:changed' || message.type === 'resource:refresh_required')).toBe(false);
    await expect(page.locator('.rv-file-viewer-content')).toContainText('version two λ');

    const readsBeforeDuplicates = await page.evaluate(() => window.__provenanceOutgoing.length);
    await page.evaluate((message) => {
      const socket = window.__provenanceSockets.at(-1);
      socket?.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
      socket?.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
    }, projection);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await page.evaluate((start) => window.__provenanceOutgoing.slice(start).filter((message) => (
      message.type === 'file_content_request' || message.type === 'file_tree_request'
    )).length, readsBeforeDuplicates)).toBe(0);

    const heldOutgoingStart = await page.evaluate(() => window.__provenanceOutgoing.length);
    await page.evaluate((baseProjection) => {
      window.__provenanceHeldMessages = [];
      window.__provenanceHeldRequestIds.clear();
      window.__provenanceHoldReads = true;
      const socket = window.__provenanceSockets.at(-1);
      socket?.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({
        ...baseProjection,
        eventId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
        occurredAt: Date.now(),
      }) }));
    }, projection);
    await expect.poll(() => page.evaluate(() => window.__provenanceHeldMessages.length)).toBe(2);
    const heldRequests = await page.evaluate((start) => window.__provenanceOutgoing.slice(start).filter((message) => (
      message.type === 'file_content_request' || message.type === 'file_tree_request'
    )), heldOutgoingStart);
    expect(heldRequests).toHaveLength(2);
    expect(new Set(heldRequests.map((message) => `${message.type}:${message.path}`))).toEqual(new Set([
      'file_content_request:target/live.txt', 'file_tree_request:target',
    ]));
    await page.evaluate(() => { window.__provenanceHoldReads = false; });

    const switchStart = fixture.messages.length;
    fixture.socket.send(JSON.stringify({ type: 'workspace:switch_requested', workspaceId: 'provenance-b' }));
    await waitForFixtureMessage(fixture.messages, (message) => message.type === 'workspace:switched' && message.workspaceId === 'provenance-b', switchStart);
    await waitForPageMessage(page, (message) => (
      message.type === 'workspace:switched' && message.workspaceId === 'provenance-b'
    ));
    await releaseHeldA1Reads(page, 'ROLLBACK-AFTER-B', 'rollback-after-b.txt');
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(page.locator('body')).not.toContainText('ROLLBACK-AFTER-B');
    await expect(page.getByText('rollback-after-b.txt', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__provenanceSockets.at(-1)?.readyState)).toBe(1);

    const returnStart = fixture.messages.length;
    fixture.socket.send(JSON.stringify({ type: 'workspace:switch_requested', workspaceId: 'provenance-a' }));
    const returned = await waitForFixtureMessage(fixture.messages, (message) => message.type === 'workspace:switched' && message.workspaceId === 'provenance-a', returnStart);
    expect(returned.workspaceEpoch).not.toBe(firstPair.workspaceEpoch);
    await waitForPageMessage(page, (message) => (
      message.type === 'workspace:switched' && message.workspaceId === 'provenance-a' && message.workspaceEpoch !== browserA1.workspaceEpoch
    ));
    await expect(page.locator('.rv-file-viewer-content')).toContainText('version two λ');
    const readsBeforeStale = await page.evaluate(() => window.__provenanceOutgoing.length);
    await releaseHeldA1Reads(page, 'ROLLBACK-AFTER-A2', 'rollback-after-a2.txt');
    await page.evaluate((oldProjection) => {
      const socket = window.__provenanceSockets.at(-1);
      socket?.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(oldProjection) }));
    }, projection);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(page.locator('body')).not.toContainText('ROLLBACK-AFTER-A2');
    await expect(page.getByText('rollback-after-a2.txt', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__provenanceSockets.at(-1)?.readyState)).toBe(1);
    expect(await page.evaluate((start) => window.__provenanceOutgoing.slice(start).filter((message) => (
      message.type === 'file_content_request' || message.type === 'file_tree_request'
    )).length, readsBeforeStale)).toBe(0);

    const socketCount = await page.evaluate(() => window.__provenanceSockets.length);
    const initCount = await page.evaluate(() => window.__provenanceIncoming.filter((message) => message.type === 'workspace:init').length);
    const reconnectOutgoingStart = await page.evaluate(() => window.__provenanceOutgoing.length);
    await page.evaluate(() => window.__provenanceSockets.at(-1)?.close());
    await expect.poll(() => page.evaluate(() => window.__provenanceSockets.length)).toBeGreaterThan(socketCount);
    await expect.poll(() => page.evaluate(() => window.__provenanceIncoming.filter((message) => message.type === 'workspace:init').length)).toBeGreaterThan(initCount);
    await expect(page.locator('.rv-file-viewer-content')).toContainText('version two λ');
    await expect.poll(() => page.evaluate((start) => (
      [...window.__provenanceOutgoing.slice(start)].reverse().find((message) => (
        message.type === 'file_tree_request' && message.panel === 'file-viewer' && message.path === 'target'
      )) || null
    ), reconnectOutgoingStart)).not.toBeNull();
    const reboundTargetTree = await page.evaluate((start) => (
      [...window.__provenanceOutgoing.slice(start)].reverse().find((message) => (
        message.type === 'file_tree_request' && message.panel === 'file-viewer' && message.path === 'target'
      )) || null
    ), reconnectOutgoingStart);
    await waitForPageMessage(page, (message) => (
      message.type === 'file_tree_response' && message.requestId === reboundTargetTree?.requestId
    ));

    await openFile(page, ['ai', 'Test-Provenance', 'Office'], 'shared.md');
    await expect(page.locator('.rv-file-viewer-content')).toContainText('shared workspace-a');
    const aliasPair = currentFixturePair(fixture.messages);
    const aliasOutgoingStart = await page.evaluate(() => window.__provenanceOutgoing.length);
    const firstAlias = await sendAndWait(
      fixture,
      saveRequest(aliasPair, 'save-alias-file', 'file-viewer', 'ai/Test-Provenance/Office/shared.md', 'shared via file viewer\n'),
      (message) => message.type === 'file_save_response' && message.requestId === 'save-alias-file',
    );
    await waitForPageMessage(page, (message) => message.type === 'resource:changed' && message.eventId === firstAlias.resourceEventId);
    await expect(page.locator('.rv-file-viewer-content')).toContainText('shared via file viewer');
    const officeAlias = await sendAndWait(
      fixture,
      saveRequest(aliasPair, 'save-alias-office', 'office-viewer', 'shared.md', 'shared via office alias\n'),
      (message) => message.type === 'file_save_response' && message.requestId === 'save-alias-office',
    );
    expect(officeAlias.resourceId).toBe(firstAlias.resourceId);
    expect(officeAlias.canonicalPath).toBe('ai/Test-Provenance/Office/shared.md');
    const officeProjection = await waitForPageMessage(page, (message) => message.type === 'resource:changed' && message.eventId === officeAlias.resourceEventId);
    expect(officeProjection).toMatchObject({ panel: 'file-viewer', path: 'ai/Test-Provenance/Office/shared.md' });
    await expect(page.locator('.rv-file-viewer-content')).toContainText('shared via office alias');
    const aliasQuery = await sendAndWait(fixture, {
      type: 'resource:provenance:query', version: 1, requestId: 'query-alias', ...aliasPair,
      panel: 'office-viewer', path: 'shared.md', limit: 10,
    }, (message) => message.type === 'resource:provenance:result' && message.requestId === 'query-alias');
    const aliasItems = aliasQuery.items as WireMessage[];
    expect(aliasItems).toHaveLength(2);
    expect(new Set(aliasItems.map((entry) => entry.resourceId))).toEqual(new Set([firstAlias.resourceId]));
    expect(new Set(aliasItems.map((entry) => (entry.ingress as WireMessage).panel))).toEqual(new Set(['file-viewer', 'office-viewer']));
    expect(new Set(aliasItems.map((entry) => (entry.origin as WireMessage).connectionId))).toEqual(new Set([fixture.connectionId]));
    const aliasTraffic = await page.evaluate((start) => ({
      outgoing: window.__provenanceOutgoing.slice(start),
      incoming: window.__provenanceIncoming,
    }), aliasOutgoingStart);
    expect(aliasTraffic.outgoing.some((message) => message.panel === 'office-viewer' || message.panel === 'email-viewer')).toBe(false);
    expect(aliasTraffic.incoming.some((message) => message.type === 'file_changed')).toBe(false);
    expect(aliasTraffic.incoming.filter((message) => message.type === 'resource:changed').every((message) => message.panel === 'file-viewer')).toBe(true);
  } finally {
    fixture.socket.close();
  }
});

test('post-write fact publication failure emits targeted recovery before the visible refetch', async ({ page }) => {
  test.skip(scenario !== 'fact-publish-failure');
  await prepareFileViewer(page);
  await assertStartupAudit();
  const fixture = await fixtureConnection();
  try {
    const pair = currentFixturePair(fixture.messages);
    await observeVisibleText(page, 'recovered visible μ');
    const response = await sendAndWait(
      fixture,
      saveRequest(pair, 'save-recovery-1', 'file-viewer', 'target/live.txt', 'recovered visible μ\n'),
      (message) => message.type === 'file_save_response' && message.requestId === 'save-recovery-1',
    );
    expect(response).toMatchObject({
      success: true, outcome: 'succeeded', resourceFactState: 'pending',
      provenanceState: 'pending_reconciliation', warningCodes: ['provenance_pending'],
    });
    const recovery = await waitForPageMessage(page, (message) => (
      message.type === 'resource:refresh_required' && message.operationId === response.operationId
    ));
    expect(recovery).toMatchObject({
      version: 1, workspaceId: pair.workspaceId, panel: 'file-viewer',
      path: 'target/live.txt', reason: 'fact_publish_failed',
    });
    await expect(page.locator('.rv-file-viewer-content')).toContainText('recovered visible μ');
    const sequence = await page.evaluate(() => window.__provenanceSequence);
    expect(sequence.findIndex((entry) => entry.kind === 'message' && entry.type === 'resource:refresh_required' && entry.payload?.operationId === response.operationId))
      .toBeLessThan(sequence.findIndex((entry) => entry.kind === 'visible' && entry.text === 'recovered visible μ'));
    expect((await page.evaluate(() => window.__provenanceIncoming)).some((message) => (
      message.type === 'resource:changed' && message.operationId === response.operationId
    ))).toBe(false);
    expect(fs.readFileSync(path.join(workspaces[0].repoPath, 'target', 'live.txt'), 'utf8')).toBe('recovered visible μ\n');

    const incomingStart = await page.evaluate(() => window.__provenanceIncoming.length);
    const rejected = await sendAndWait(
      fixture,
      saveRequest(pair, 'save-recovery-rejected', 'file-viewer', '../escape.txt', 'no write\n'),
      (message) => message.type === 'file_save_response' && message.requestId === 'save-recovery-rejected',
    );
    expect(rejected).toMatchObject({ success: false, outcome: 'rejected' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect((await page.evaluate((start) => window.__provenanceIncoming.slice(start), incomingStart)).some((message) => (
      message.type === 'resource:changed' || message.type === 'resource:refresh_required'
    ))).toBe(false);
  } finally {
    fixture.socket.close();
  }
});

test('production workspace bind module gates replies behind the bind frame and closes on overflow', async () => {
  test.skip(scenario !== 'normal');
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  const sessionModule = require('../fusion-studio-server/lib/ws/workspace-session.js') as {
    MAX_BUFFERED_REPLIES: number;
    beginWorkspaceBind: (session: WireMessage, input: WireMessage) => WireMessage;
    completeWorkspaceBind: (socket: WireMessage, session: WireMessage, frame: WireMessage, pair: WireMessage) => Promise<boolean>;
    sendWorkspaceBoundReply: (socket: WireMessage, session: WireMessage, message: WireMessage, pair?: WireMessage) => Promise<boolean>;
  };
  const state = {
    workspaceBindingState: 'binding', workspaceReplyFlushState: 'idle',
    workspaceReplyBuffer: [], workspaceReplyBufferBytes: 0,
  } as unknown as WireMessage;
  const sent: WireMessage[] = [];
  const closes: Array<[number, string]> = [];
  const socket = {
    readyState: 1,
    send(serialized: string, callback?: (error?: Error) => void) {
      sent.push(JSON.parse(serialized) as WireMessage);
      callback?.();
    },
    close(code: number, reason: string) { closes.push([code, reason]); this.readyState = 3; },
  } as unknown as WireMessage;
  const pair = sessionModule.beginWorkspaceBind(state, {
    workspaceId: 'A', repoPath: '/owned/A', randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
  });
  await sessionModule.sendWorkspaceBoundReply(socket, state, {
    type: 'file_content_response', workspaceId: 'A', workspaceEpoch: pair.workspaceEpoch, requestId: 'read-during-bind',
  }, pair);
  await sessionModule.sendWorkspaceBoundReply(socket, state, {
    type: 'resource:changed', workspaceId: 'A', workspaceEpoch: pair.workspaceEpoch, eventId: 'event-during-bind',
  }, pair);
  expect(sent).toEqual([]);
  await expect(sessionModule.completeWorkspaceBind(socket, state, { type: 'workspace:init' }, pair)).resolves.toBe(true);
  expect(sent.map((message) => message.type)).toEqual(['workspace:init', 'file_content_response', 'resource:changed']);

  const overflowState = {
    workspaceBindingState: 'binding', workspaceReplyFlushState: 'idle',
    workspaceReplyBuffer: [], workspaceReplyBufferBytes: 0,
  } as unknown as WireMessage;
  const overflowSocket = {
    readyState: 1, send() {}, close(code: number, reason: string) { closes.push([code, reason]); this.readyState = 3; },
  } as unknown as WireMessage;
  const overflowPair = sessionModule.beginWorkspaceBind(overflowState, {
    workspaceId: 'A', repoPath: '/owned/A', randomUuid: () => '123e4567-e89b-42d3-a456-426614174001',
  });
  for (let index = 0; index < sessionModule.MAX_BUFFERED_REPLIES; index += 1) {
    await expect(sessionModule.sendWorkspaceBoundReply(overflowSocket, overflowState, {
      type: 'resource:changed', workspaceId: 'A', workspaceEpoch: overflowPair.workspaceEpoch, index,
    }, overflowPair)).resolves.toBe(true);
  }
  await expect(sessionModule.sendWorkspaceBoundReply(overflowSocket, overflowState, {
    type: 'resource:changed', workspaceId: 'A', workspaceEpoch: overflowPair.workspaceEpoch,
    index: sessionModule.MAX_BUFFERED_REPLIES,
  }, overflowPair)).resolves.toBe(false);
  expect(closes.at(-1)?.[0]).toBe(1011);
});
