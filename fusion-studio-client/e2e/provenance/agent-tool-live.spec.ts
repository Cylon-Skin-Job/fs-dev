import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

type WireMessage = Record<string, unknown> & { type: string };

declare global {
  interface Window {
    __agentProofIncoming: WireMessage[];
    __agentProofOutgoing: WireMessage[];
    __agentProofSockets: WebSocket[];
  }
}

const scenario = process.env.FUSION_PROVENANCE_TEST_SCENARIO;
const nonce = process.env.FUSION_PROVENANCE_TEST_NONCE!;
const appData = process.env.FUSION_APP_USER_DATA!;
const port = Number(process.env.PORT);
let nextRequest = 0;

function requestId(prefix: string) {
  nextRequest += 1;
  return `${prefix}-${nextRequest}`;
}

function parseMessage(event: Event): WireMessage | null {
  try { return JSON.parse(String((event as MessageEvent).data)) as WireMessage; } catch { return null; }
}

async function waitForMessage(
  messages: WireMessage[],
  predicate: (message: WireMessage) => boolean,
  after = 0,
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = messages.slice(after).find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for the isolated agent-tool message.');
}

async function fixtureConnection() {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const messages: WireMessage[] = [];
  socket.addEventListener('message', (event) => {
    const message = parseMessage(event);
    if (message) messages.push(message);
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('Fixture WebSocket failed to open.')), { once: true });
  });
  await waitForMessage(messages, (message) => message.type === 'workspace:init');
  return { socket, messages };
}

function currentPair(messages: WireMessage[]) {
  const message = [...messages].reverse().find((item) => (
    item.type === 'workspace:init' || item.type === 'workspace:switched'
  ));
  if (!message || typeof message.workspaceId !== 'string' || typeof message.workspaceEpoch !== 'string') {
    throw new Error('Fixture connection has no active workspace pair.');
  }
  return { workspaceId: message.workspaceId, workspaceEpoch: message.workspaceEpoch };
}

async function sendAndWait(
  fixture: Awaited<ReturnType<typeof fixtureConnection>>,
  message: WireMessage,
  predicate: (message: WireMessage) => boolean,
) {
  const after = fixture.messages.length;
  fixture.socket.send(JSON.stringify(message));
  return waitForMessage(fixture.messages, predicate, after);
}

async function runAgentFixture(fixture: Awaited<ReturnType<typeof fixtureConnection>>, name: string) {
  const id = requestId('fixture');
  return sendAndWait(fixture, {
    type: 'provenance:test:agent_tool', version: 1, requestId: id, nonce, fixture: name,
  }, (message) => message.type === 'provenance:test:agent_tool_result' && message.requestId === id);
}

async function query(
  fixture: Awaited<ReturnType<typeof fixtureConnection>>,
  subject: 'tool_calls' | 'resource_edges',
  selectors: Record<string, unknown>,
) {
  const id = requestId('query');
  return sendAndWait(fixture, {
    type: 'agent:activity:query', version: 1, requestId: id,
    ...currentPair(fixture.messages), subject, ...selectors, limit: 100,
  }, (message) => message.type === 'agent:activity:result' && message.requestId === id);
}

async function waitForEdge(
  fixture: Awaited<ReturnType<typeof fixtureConnection>>,
  toolCallId: string,
  state: string,
) {
  let item: WireMessage | undefined;
  await expect.poll(async () => {
    const response = await query(fixture, 'resource_edges', { toolCallId });
    item = (response.items as WireMessage[] | undefined)?.[0];
    return (item?.observation as WireMessage | undefined)?.state;
  }, { timeout: 15_000 }).toBe(state);
  if (!item) throw new Error('Expected a resource edge.');
  return item;
}

async function waitForTool(
  fixture: Awaited<ReturnType<typeof fixtureConnection>>,
  toolCallId: string,
  status: string,
  requireBinding = true,
) {
  let item: WireMessage | undefined;
  await expect.poll(async () => {
    const response = await query(fixture, 'tool_calls', { toolCallId });
    item = (response.items as WireMessage[] | undefined)?.[0];
    if (item?.status !== status) return 'wrong-status';
    const fact = item.fact as WireMessage | undefined;
    if (fact?.admissionState !== 'admitted' || fact?.ledgerState !== 'stored') return 'pending-fact';
    if (requireBinding && typeof item.exchangeId !== 'number') return 'pending-bind';
    return 'ready';
  }, { timeout: 15_000 }).toBe('ready');
  if (!item) throw new Error('Expected a tool activity.');
  return item;
}

async function waitForPageMessage(page: Page, predicate: (message: WireMessage) => boolean) {
  let found: WireMessage | undefined;
  await expect.poll(async () => {
    const messages = await page.evaluate(() => window.__agentProofIncoming);
    found = messages.find(predicate);
    return Boolean(found);
  }, { timeout: 15_000 }).toBe(true);
  if (!found) throw new Error('Expected a browser projection.');
  return found;
}

async function installBrowserObserver(page: Page) {
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.__agentProofIncoming = [];
    window.__agentProofOutgoing = [];
    window.__agentProofSockets = [];
    class ObservedWebSocket extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        window.__agentProofSockets.push(this);
        this.addEventListener('message', (event) => {
          try { window.__agentProofIncoming.push(JSON.parse(String(event.data)) as WireMessage); } catch {}
        });
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data === 'string') {
          try { window.__agentProofOutgoing.push(JSON.parse(data) as WireMessage); } catch {}
        }
        super.send(data);
      }
    }
    Object.defineProperty(window, 'WebSocket', { value: ObservedWebSocket, configurable: false });
  });
}

async function openFolder(page: Page, name: string) {
  const label = page.locator('.rv-tree-label', { hasText: new RegExp(`^${name}$`) }).first();
  await expect(label).toBeVisible();
  const row = label.locator('..');
  if ((await row.locator(':scope > .rv-tree-icon').textContent())?.trim() !== 'folder_open') {
    await label.click();
  }
}

async function openFile(page: Page, fileName: string) {
  await openFolder(page, 'target');
  const label = page.getByText(fileName, { exact: true }).first();
  await expect(label).toBeVisible();
  await label.click();
}

async function preparePage(page: Page) {
  await installBrowserObserver(page);
  await page.goto('/');
  await expect(page.locator('button[title="Files"]')).toBeVisible();
  await page.locator('button[title="Files"]').click();
  await expect(page.locator('.rv-file-explorer-layout')).toBeVisible();
  await openFile(page, 'live.txt');
  await expect(page.locator('.rv-file-viewer-content')).toContainText('initial live state');
}

async function assertStartupAudit() {
  const auditPath = path.join(appData, 'isolated-provenance-audit.json');
  await expect.poll(() => fs.existsSync(auditPath)).toBe(true);
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8')) as WireMessage;
  expect(audit).toMatchObject({
    mode: 'isolated-v1', scenario, port, dbExists: true,
    observationGuards: { installed: true, attempts: { childProcess: 0, filesystemWatch: 0 } },
  });
  return audit;
}

test('agent tool provenance reaches the open File Viewer through v2 and survives all truth branches', async ({ page }) => {
  test.skip(scenario !== 'agent-tool-live');
  await preparePage(page);
  await assertStartupAudit();
  const fixture = await fixtureConnection();
  try {
    const firstResult = await runAgentFixture(fixture, 'edit-first-a');
    const firstEdge = await waitForEdge(fixture, firstResult.toolCallId as string, 'first_observation');
    const firstActivity = await waitForTool(fixture, firstResult.toolCallId as string, 'completed');
    const firstProjection = await waitForPageMessage(page, (message) => (
      message.type === 'resource:changed' && message.version === 2
      && message.sourceEdgeId === firstEdge.edgeId
    ));
    expect(firstProjection).toMatchObject({
      projectionId: firstEdge.edgeId, sourceActivityId: firstEdge.activityId,
      sourceEdgeId: firstEdge.edgeId, relation: 'first_observation', state: 'bytes',
      snapshotId: (firstEdge.observation as WireMessage).snapshotId,
      checkpointEventId: expect.any(String), checkpointObservationId: expect.any(String),
      panel: 'file-viewer', path: 'target/live.txt',
    });
    expect(firstProjection.occurredAt).toBe((firstEdge.observation as WireMessage).observedAt);
    expect(firstActivity).toMatchObject({
      threadId: firstResult.threadId, turnId: firstResult.turnId,
      toolCallId: firstResult.toolCallId, toolName: 'edit', status: 'completed',
      detailRef: { kind: 'exchange_tool_part', toolCallId: firstResult.toolCallId },
    });
    expect(firstActivity.timing).toMatchObject({
      executionStartedReportedAt: 1_800_000_000_101,
      terminalReportedAt: 1_800_000_000_202,
      terminalSnapshotReportedAt: 1_800_000_000_303,
    });
    await expect(page.locator('.rv-file-viewer-content')).toContainText('agent state A Ω');

    const readsBeforeReplay = await page.evaluate(() => window.__agentProofOutgoing.length);
    await page.evaluate((projection) => {
      const socket = window.__agentProofSockets.at(-1);
      socket?.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(projection) }));
      socket?.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(projection) }));
    }, firstProjection);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await page.evaluate((start) => window.__agentProofOutgoing.slice(start).filter((message) => (
      message.type === 'file_tree_request' || message.type === 'file_content_request'
    )).length, readsBeforeReplay)).toBe(0);

    const pair = currentPair(fixture.messages);
    const saveId = requestId('save');
    const saved = await sendAndWait(fixture, {
      type: 'file_save', version: 1, requestId: saveId, ...pair,
      panel: 'file-viewer', path: 'target/live.txt', content: 'mediated state B β\n', reason: 'manual',
      reportedUiContext: { viewId: 'file-viewer', viewInstanceId: 'agent-tool-live-proof' },
    }, (message) => message.type === 'file_save_response' && message.requestId === saveId);
    expect(saved).toMatchObject({ success: true, provenanceState: 'complete' });
    await waitForPageMessage(page, (message) => (
      message.type === 'resource:changed' && message.version === 1 && message.eventId === saved.resourceEventId
    ));
    await expect(page.locator('.rv-file-viewer-content')).toContainText('mediated state B β');

    const returnResult = await runAgentFixture(fixture, 'edit-return-a');
    const returnEdge = await waitForEdge(fixture, returnResult.toolCallId as string, 'unchanged');
    await waitForTool(fixture, returnResult.toolCallId as string, 'completed');
    const unchangedProjection = await waitForPageMessage(page, (message) => (
      message.type === 'resource:changed' && message.version === 2
      && message.sourceEdgeId === returnEdge.edgeId
    ));
    expect(unchangedProjection).toMatchObject({ relation: 'unchanged', state: 'bytes' });
    expect((returnEdge.observation as WireMessage).snapshotId)
      .toBe((firstEdge.observation as WireMessage).snapshotId);
    expect(unchangedProjection).not.toHaveProperty('checkpointEventId');
    expect(unchangedProjection).not.toHaveProperty('checkpointObservationId');
    await expect(page.locator('.rv-file-viewer-content')).toContainText('agent state A Ω');

    const readResult = await runAgentFixture(fixture, 'read-a');
    const readEdge = await waitForEdge(fixture, readResult.toolCallId as string, 'unchanged');
    await waitForTool(fixture, readResult.toolCallId as string, 'completed');
    expect((readEdge.observation as WireMessage).snapshotId)
      .toBe((firstEdge.observation as WireMessage).snapshotId);

    const errorResult = await runAgentFixture(fixture, 'error-partial');
    const errorEdge = await waitForEdge(fixture, errorResult.toolCallId as string, 'changed');
    const errorActivity = await waitForTool(fixture, errorResult.toolCallId as string, 'error');
    await waitForPageMessage(page, (message) => (
      message.type === 'resource:changed' && message.version === 2 && message.sourceEdgeId === errorEdge.edgeId
    ));
    expect(errorActivity.timing).toMatchObject({
      executionStartedReportedAt: 1_800_000_003_101,
      terminalReportedAt: 1_800_000_003_202,
      terminalSnapshotReportedAt: 1_800_000_003_303,
    });
    await expect(page.locator('.rv-file-viewer-content')).toContainText('partial error state ε');

    const interruptedResult = await runAgentFixture(fixture, 'interrupt-partial');
    const interruptedEdge = await waitForEdge(fixture, interruptedResult.toolCallId as string, 'changed');
    const interrupted = await waitForTool(
      fixture, interruptedResult.toolCallId as string, 'interrupted', false,
    );
    await waitForPageMessage(page, (message) => (
      message.type === 'resource:changed' && message.version === 2 && message.sourceEdgeId === interruptedEdge.edgeId
    ));
    expect(interrupted.timing).not.toHaveProperty('terminalReportedAt');
    expect(interrupted.timing).not.toHaveProperty('terminalSnapshotReportedAt');
    expect(interrupted.timing).toMatchObject({
      announcedReportedAt: 1_800_000_004_303,
      argumentsReportedAt: 1_800_000_004_303,
    });
    await expect(page.locator('.rv-file-viewer-content')).toContainText('partial interrupted state ι');

    const absentFirstResult = await runAgentFixture(fixture, 'read-absent-first');
    const absentFirstEdge = await waitForEdge(fixture, absentFirstResult.toolCallId as string, 'first_observation');
    await waitForTool(fixture, absentFirstResult.toolCallId as string, 'completed');
    const absentFirstProjection = await waitForPageMessage(page, (message) => (
      message.type === 'resource:changed' && message.version === 2 && message.sourceEdgeId === absentFirstEdge.edgeId
    ));
    expect(absentFirstProjection).toMatchObject({ relation: 'first_observation', state: 'absent' });
    expect(absentFirstProjection).not.toHaveProperty('resourceId');

    const absentSaveId = requestId('save-absent');
    const absentSaved = await sendAndWait(fixture, {
      type: 'file_save', version: 1, requestId: absentSaveId, ...currentPair(fixture.messages),
      panel: 'file-viewer', path: 'target/absent.txt', content: 'mediated absent B\n', reason: 'manual',
      reportedUiContext: { viewId: 'file-viewer', viewInstanceId: 'agent-tool-live-proof' },
    }, (message) => message.type === 'file_save_response' && message.requestId === absentSaveId);
    expect(absentSaved.success).toBe(true);
    await waitForPageMessage(page, (message) => (
      message.type === 'resource:changed' && message.version === 1 && message.eventId === absentSaved.resourceEventId
    ));
    await openFile(page, 'absent.txt');
    await expect(page.locator('.rv-file-viewer-content')).toContainText('mediated absent B');

    const absentAgainResult = await runAgentFixture(fixture, 'read-absent-unchanged');
    const absentAgainEdge = await waitForEdge(fixture, absentAgainResult.toolCallId as string, 'unchanged');
    await waitForTool(fixture, absentAgainResult.toolCallId as string, 'completed');
    const absentAgainProjection = await waitForPageMessage(page, (message) => (
      message.type === 'resource:changed' && message.version === 2 && message.sourceEdgeId === absentAgainEdge.edgeId
    ));
    expect(absentAgainProjection).toMatchObject({ relation: 'unchanged', state: 'absent' });
    expect((absentAgainEdge.observation as WireMessage).snapshotId)
      .toBe((absentFirstEdge.observation as WireMessage).snapshotId);
    await expect(page.locator('.rv-file-viewer-content')).not.toContainText('mediated absent B');

    const allLiveTools = await query(fixture, 'tool_calls', { path: 'target/live.txt' });
    expect((allLiveTools.items as WireMessage[]).map((item) => item.toolCallId)).toEqual(expect.arrayContaining([
      'fixture-edit-first-a', 'fixture-edit-return-a', 'fixture-read-a',
      'fixture-error-partial', 'fixture-interrupt-partial',
    ]));
    const writesInThread = await query(fixture, 'resource_edges', {
      path: 'target/live.txt', threadId: firstResult.threadId, accessFamilies: ['write'],
    });
    expect((writesInThread.items as WireMessage[]).length).toBeGreaterThanOrEqual(4);
    const reads = await query(fixture, 'resource_edges', {
      path: 'target/live.txt', accessFamilies: ['read'],
    });
    expect((reads.items as WireMessage[]).some((item) => item.toolCallId === 'fixture-read-a')).toBe(true);
    const changedOnly = await query(fixture, 'resource_edges', {
      path: 'target/live.txt', changedOnly: true,
    });
    expect(new Set((changedOnly.items as WireMessage[]).map((item) => item.toolCallId)))
      .toEqual(new Set(['fixture-error-partial', 'fixture-interrupt-partial']));

    const require = createRequire(import.meta.url);
    const Database = require('../../../fusion-studio-server/node_modules/better-sqlite3');
    const db = new Database(path.join(appData, 'server-data', 'fusion.db'), { readonly: true });
    try {
      await expect.poll(() => db.prepare("SELECT COUNT(*) AS count FROM event_log WHERE event_type='agent.tool_completed'").get().count)
        .toBe(7);
      await expect.poll(() => db.prepare("SELECT COUNT(*) AS count FROM event_log WHERE event_type='resource.state_observed'").get().count)
        .toBe(4);
      expect(db.prepare('SELECT COUNT(*) AS count FROM agent_resource_snapshots').get().count).toBe(4);
      expect(db.prepare('SELECT COUNT(*) AS count FROM agent_snapshot_blobs').get().count).toBe(3);
      expect(db.prepare('SELECT COUNT(*) AS count FROM agent_tool_activities WHERE exchange_id IS NOT NULL').get().count)
        .toBeGreaterThanOrEqual(6);
    } finally {
      db.close();
    }

    const incoming = await page.evaluate(() => window.__agentProofIncoming);
    expect(incoming.some((message) => message.type === 'file_changed')).toBe(false);
    const audit = await assertStartupAudit();
    expect(audit.observationGuards).toEqual({
      installed: true,
      attempts: { childProcess: 0, filesystemWatch: 0 },
    });
  } finally {
    fixture.socket.close();
  }
});

test('same database restart retains activity and exact locked authority', async ({ page }) => {
  test.skip(scenario !== 'agent-tool-restart');
  await installBrowserObserver(page);
  await page.goto('/');
  await assertStartupAudit();
  const fixture = await fixtureConnection();
  try {
    const persisted = await query(fixture, 'tool_calls', { path: 'target/live.txt' });
    expect((persisted.items as WireMessage[]).length).toBeGreaterThanOrEqual(5);
    expect((persisted.items as WireMessage[]).every((item) => (
      (item.fact as WireMessage).admissionState === 'admitted'
    ))).toBe(true);
  } finally {
    fixture.socket.close();
  }
});
