import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanupFixture, closeOwnedApp, createChat, createProject, selectPanel, stageAndLaunch, waitFor, withDb,
} from './electron-case-helpers.mjs';
import { SCENARIOS } from './scenario-inventory.mjs';

const [token, evidenceRoot, tempRoot, scenarioId] = process.argv.slice(2);
assert.match(token || '', /^chat-architecture-owner-chat-arch-/);
assert.ok(evidenceRoot && path.isAbsolute(evidenceRoot));
assert.ok(tempRoot && path.isAbsolute(tempRoot));
assert.ok(['R3-LOST-ACK-STATUS', 'R3-RECONNECT-UI', 'R4-DISTINCT-ATTEMPTS',
  'R4-DISTINCT-RECEIPTS', 'R4-DUPLICATE-MISMATCH', 'R4-LATE-DRAFT-RECOVERY'].includes(scenarioId));
// R4's 02B admission invariant is independent of its 02C late-draft UI invariant.

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const scenario = SCENARIOS.find((item) => item.id === scenarioId);
const projectPath = path.join(tempRoot, `${scenarioId.toLowerCase()}-project`);
const resultPath = path.join(evidenceRoot, `${scenarioId.toLowerCase()}-result.json`);
const deterministicText = `${scenarioId} deterministic submission`;
const revisedDraft = `${scenarioId} revised draft after original attempt`;
let fixture = null;
let runtime = null;
let failure = null;
let result = null;
let lingering = [];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function transportBootstrap() {
  window.__futureSubmit = { sockets: [], sent: [], received: [], recoveryStatusSeen: false };
  const state = window.__futureSubmit;
  state.recoveryStatusVisibleNow = () => [...document.querySelectorAll('.rv-chat-area, .rv-toast')]
    .some((node) => /delivery\s+(?:status\s+)?unknown|status\s+unknown|recovering|checking\s+delivery/i.test(node.innerText || ''));
  setInterval(() => { if (state.recoveryStatusVisibleNow()) state.recoveryStatusSeen = true; }, 50);
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      state.sockets.push(this);
      this.addEventListener('message', (event) => {
        try { state.received.push(JSON.parse(event.data)); } catch {}
      });
      const nativeSend = this.send.bind(this);
      this.send = (payload) => {
        try { state.sent.push(JSON.parse(String(payload))); } catch {}
        return nativeSend(payload);
      };
    }
  };
  state.replay = (frame) => {
    const socket = [...state.sockets].reverse().find((candidate) => candidate.readyState === WebSocket.OPEN);
    if (!socket) throw new Error('no open authenticated socket for replay');
    socket.send(JSON.stringify(frame));
  };
  state.injectInbound = (frame) => {
    const socket = [...state.sockets].reverse().find((candidate) => candidate.readyState === WebSocket.OPEN);
    if (!socket) throw new Error('no open authenticated socket for delayed inbound frame');
    socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(frame) }));
  };
}

const promptFrames = (snapshot) => snapshot.sent.filter((frame) => frame.type === 'prompt');
const acceptanceFrames = (snapshot) => snapshot.received.filter((frame) => frame.type === 'message:sent');
const requestIdOf = (frame) => typeof frame?.requestId === 'string' && frame.requestId.length > 0 ? frame.requestId : null;
const statusAction = 'prompt_receipt_status';
const statusResponse = (frame, requestId) => frame.type === 'thread:action:completed'
  && frame.action === statusAction && requestIdOf(frame) === requestId;
const statusOutcome = (frame) => [frame?.receipt?.outcome, frame?.receipt?.status,
  frame?.result?.outcome, frame?.result?.status, frame?.outcome, frame?.status]
  .find((value) => typeof value === 'string') || null;
const authoritativeTurnId = (frame) => [frame?.receipt?.turnId, frame?.result?.turnId, frame?.turnId]
  .find((value) => typeof value === 'string' && value.length > 0) || null;

function summarizeTransport(snapshot) {
  const count = (frames) => Object.fromEntries([...new Set(frames.map((frame) => frame.type || 'unknown'))]
    .map((type) => [type, frames.filter((frame) => (frame.type || 'unknown') === type).length]));
  return {
    sentTypes: count(snapshot.sent), receivedTypes: count(snapshot.received),
    promptRequestIds: promptFrames(snapshot).map(requestIdOf),
    acceptanceRequestIds: acceptanceFrames(snapshot).map(requestIdOf),
    statusRequests: snapshot.sent.filter((frame) => frame.type === 'thread:action'
      && /status|receipt|recover/i.test(String(frame.action))).map((frame) => ({
        requestId: requestIdOf(frame), action: frame.action || frame.name || null,
      })),
  };
}

function dbFacts(dbPath, threadId, requestIds = []) {
  return withDb(dbPath, { readonly: true, fileMustExist: true }, (db) => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name);
    const receiptTables = [];
    let receiptRows = 0;
    for (const table of tables.filter((name) => /receipt|submission|prompt/i.test(name))) {
      const quotedTable = `"${table.replaceAll('"', '""')}"`;
      const columns = db.prepare(`PRAGMA table_info(${quotedTable})`).all().map((row) => row.name);
      const requestColumn = columns.find((name) => name === 'request_id' || name === 'requestId');
      if (!requestColumn) continue;
      const quotedColumn = `"${requestColumn.replaceAll('"', '""')}"`;
      const matchingRows = requestIds.filter(Boolean).reduce((total, requestId) => (
        total + db.prepare(`SELECT COUNT(*) AS n FROM ${quotedTable} WHERE ${quotedColumn} = ?`).get(requestId).n
      ), 0);
      receiptTables.push({ table, requestColumn, matchingRows });
      receiptRows += matchingRows;
    }
    return {
      exchangeCount: db.prepare('SELECT COUNT(*) AS n FROM exchanges WHERE thread_id = ?').get(threadId).n,
      activityCount: db.prepare("SELECT COUNT(*) AS n FROM thread_group_activity_events WHERE thread_id = ? AND kind = 'prompt-accepted'").get(threadId).n,
      activityTurnIds: db.prepare("SELECT turn_id FROM thread_group_activity_events WHERE thread_id = ? AND kind = 'prompt-accepted' ORDER BY rowid").all(threadId).map((row) => row.turn_id),
      receiptTables, receiptRows,
    };
  });
}

function dispatchCount(adapterLog) {
  if (!fs.existsSync(adapterLog)) return 0;
  return fs.readFileSync(adapterLog, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
    .filter((event) => event.gate === 'before-dispatch').length;
}

const transportSnapshot = (page) => page.evaluate(() => ({
  sent: window.__futureSubmit.sent.slice(), received: window.__futureSubmit.received.slice(),
}));

async function openExistingThread(page, threadGroupId) {
  const panel = await selectPanel(page, 'capture-viewer', 'Captures');
  await panel.locator(`.rv-chat-item[data-thread-group-id="${threadGroupId}"]`).click();
  return panel;
}

async function waitForIdle(page, panel) {
  await waitFor(page, async () => {
    const composer = panel.locator('textarea.rv-chat-input');
    return await composer.count() === 1 && await composer.isEnabled()
      && await panel.getByRole('button', { name: 'Send message' }).count() === 1;
  }, 'idle composer after attempted submission', 30_000);
}

async function submitFromUi(page, panel, text) {
  const composer = panel.locator('textarea.rv-chat-input');
  await waitFor(page, () => composer.isEnabled(), 'enabled composer');
  await composer.fill(text);
  await panel.getByRole('button', { name: 'Send message' }).click();
}

try {
  const faultSchedule = ['R3-LOST-ACK-STATUS', 'R3-RECONNECT-UI'].includes(scenarioId)
    ? { 'before-ack': { action: 'drop', occurrence: 1 } }
    : scenarioId === 'R4-LATE-DRAFT-RECOVERY'
      ? { 'before-ack': { action: 'delay', delayMs: 17_000, occurrence: 1 } }
      : {};
  fixture = await stageAndLaunch({
    repoRoot, tempRoot, token, casePrefix: scenarioId.toLowerCase(), evidenceRoot,
    faultSchedule, eventScript: { frameIntervalMs: 50, textFrames: 3 }, initScript: transportBootstrap,
  });
  runtime = await fixture.launch();
  await createProject(runtime.app, runtime.page, projectPath, `${scenarioId} ${token.slice(-8)}`);
  await runtime.page.reload();
  await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  await selectPanel(runtime.page, 'capture-viewer', 'Captures');
  let panel = await createChat(runtime.page, fixture.dbPath);
  const identity = withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) => db.prepare(
    'SELECT current_primary_thread_id AS threadId, group_id AS threadGroupId FROM thread_groups ORDER BY rowid DESC LIMIT 1',
  ).get());

  if (['R3-LOST-ACK-STATUS', 'R3-RECONNECT-UI'].includes(scenarioId)) {
    await submitFromUi(runtime.page, panel, deterministicText);
    await waitFor(runtime.page, () => withDb(fixture.dbPath, { readonly: true, fileMustExist: true },
      (db) => db.prepare('SELECT COUNT(*) AS n FROM exchanges WHERE thread_id = ?').get(identity.threadId).n === 1),
    'durable exchange after dropped acceptance ACK');
    const beforeReconnect = await transportSnapshot(runtime.page);
    const requestId = requestIdOf(promptFrames(beforeReconnect)[0]);
    await runtime.page.evaluate(() => {
      const socket = [...window.__futureSubmit.sockets].reverse().find((candidate) => candidate.readyState === WebSocket.OPEN);
      if (!socket) throw new Error('lost-ACK probe has no socket to reconnect');
      socket.close();
    });
    await waitFor(runtime.page, () => runtime.page.evaluate(() => window.__futureSubmit.sockets.length >= 2
      && window.__futureSubmit.sockets.some((socket, index) => index > 0 && socket.readyState === WebSocket.OPEN))
      .then(async (open) => open && (await transportSnapshot(runtime.page)).received
        .filter((frame) => frame.type === 'shell-auth:authenticated').length >= 2),
    'same-renderer authenticated socket reconnect', 30_000);
    if (requestId && scenarioId === 'R3-RECONNECT-UI') {
      await waitFor(runtime.page, () => transportSnapshot(runtime.page).then((snapshot) => snapshot.received.some(
        (frame) => statusResponse(frame, requestId))), 'automatic same-renderer status completion', 20_000).catch(() => {});
    }
    if (requestId && scenarioId === 'R3-LOST-ACK-STATUS') {
      await runtime.page.evaluate(({ requestId: id, threadId, action }) => {
        window.__futureSubmit.replay({ type: 'thread:action', action, requestId: id, threadId });
      }, { requestId, threadId: identity.threadId, action: statusAction });
      await waitFor(runtime.page, () => transportSnapshot(runtime.page).then((snapshot) => snapshot.received.some(
        (frame) => requestIdOf(frame) === requestId && frame.action === statusAction
          && (frame.type === 'thread:action:completed' || frame.type === 'thread:action:error'))),
      'authenticated status action response', 8_000).catch(() => {});
    }
    const afterReconnect = await transportSnapshot(runtime.page);
    const completedStatus = afterReconnect.received.find((frame) => statusResponse(frame, requestId));
    if (scenarioId === 'R3-RECONNECT-UI' && completedStatus) {
      await waitFor(runtime.page, async () => (await panel.locator('.rv-message-user').count()) === 1
        && await panel.locator('textarea.rv-chat-input').isEnabled().catch(() => false),
      'same-renderer accepted status presentation', 8_000).catch(() => {});
    }
    const sameRendererUi = {
      userBubbleCount: await panel.locator('.rv-message-user').count(),
      composerEnabled: await panel.locator('textarea.rv-chat-input').isEnabled().catch(() => false),
      visibleRecoveryStatusSeen: await runtime.page.evaluate(() => window.__futureSubmit.recoveryStatusSeen),
    };
    // UI history readback is a separate passive hydration check. A renderer reload is
    // deliberately *after* the same-session recovery observation, never its trigger.
    await runtime.page.reload();
    await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
    panel = await openExistingThread(runtime.page, identity.threadGroupId);
    await waitFor(runtime.page, () => panel.locator('.rv-message').count().then((count) => count === 2), 'durable exchange history readback');
    const transport = { beforeReconnect: summarizeTransport(beforeReconnect), afterReconnect: summarizeTransport(afterReconnect) };
    const persistence = dbFacts(fixture.dbPath, identity.threadId, [requestId]);
    const observations = {
      acceptanceAckDropped: acceptanceFrames(beforeReconnect).length === 0,
      requestIdAvailable: requestId !== null,
      statusRequestAvailable: transport.afterReconnect.statusRequests.some((frame) => frame.requestId === requestId),
      statusRecoveryAvailable: Boolean(completedStatus),
      statusOutcome: statusOutcome(completedStatus),
      statusTurnId: authoritativeTurnId(completedStatus),
      sameRendererUi,
      userBubbleCount: await panel.locator('.rv-message-user').count(),
      providerDispatchCount: dispatchCount(fixture.adapterLog), persistence,
    };
    assert.equal(observations.acceptanceAckDropped, true, 'fixture did not drop the real acceptance ACK');
    assert.equal(persistence.exchangeCount, 1, 'lost-ACK fixture did not persist one exchange');
    assert.equal(persistence.activityCount, 1, 'lost-ACK fixture did not persist one group activity');
    assert.ok(observations.providerDispatchCount <= 1, 'lost-ACK fixture dispatched provider more than once');
    assert.equal(observations.userBubbleCount, 1, 'reconnected history did not hydrate one user bubble');
    const isRecoveryUi = scenarioId === 'R3-RECONNECT-UI';
    const missingContracts = [!observations.requestIdAvailable ? 'request-id' : null,
      persistence.receiptTables.length === 0 ? 'receipt-persistence' : null,
      !observations.statusRecoveryAvailable ? (isRecoveryUi ? 'automatic-reconnect-status-recovery' : 'authenticated-status-route') : null].filter(Boolean);
    const violations = missingContracts.length ? [] : [persistence.receiptRows !== 1 ? 'receipt-count-not-one' : null,
      !String(observations.statusOutcome || '').startsWith('accepted') ? 'status-not-authoritatively-accepted' : null,
      observations.statusTurnId !== persistence.activityTurnIds[0] ? 'status-turn-identity-mismatch' : null,
      persistence.activityCount !== 1 ? 'group-activity-count-not-one' : null,
      observations.providerDispatchCount > 1 ? 'provider-dispatch-count-exceeds-one' : null,
      observations.userBubbleCount !== 1 ? 'user-bubble-count-not-one' : null,
      isRecoveryUi && sameRendererUi.userBubbleCount !== 1 ? 'same-renderer-bubble-not-reconciled' : null,
      isRecoveryUi && !sameRendererUi.visibleRecoveryStatusSeen ? 'same-renderer-visible-recovery-status-missing' : null,
      isRecoveryUi && !sameRendererUi.composerEnabled ? 'same-renderer-composer-not-editable' : null].filter(Boolean);
    result = { caseId: scenarioId, status: missingContracts.length ? 'blocked' : 'executed', authenticatedShell: true,
      startupPanelReadiness: 'exact-rail-before-activation',
      fixture: scenario.fixture, owner: scenario.owner, missingContracts, assertionsEvaluated: missingContracts.length === 0,
      statusEndpointFabricated: false, promptContentRecorded: false, promptSha256: sha256(deterministicText), transport, observations, violations };
    if (process.env.FUSION_CHAT_ARCH_MODE === 'enforce') {
      assert.deepEqual(missingContracts, [], `${scenarioId} missing contracts after authenticated lost-ACK/reconnect probe: ${missingContracts.join(', ')}`);
      assert.deepEqual(violations, [], `${scenarioId} invariant violations: ${violations.join(', ')}`);
    }
  } else if (['R4-DISTINCT-ATTEMPTS', 'R4-DISTINCT-RECEIPTS'].includes(scenarioId)) {
    await submitFromUi(runtime.page, panel, deterministicText);
    await waitFor(runtime.page, () => withDb(fixture.dbPath, { readonly: true, fileMustExist: true },
      (db) => db.prepare('SELECT COUNT(*) AS n FROM exchanges WHERE thread_id = ?').get(identity.threadId).n === 1), 'first deliberate attempt');
    await waitForIdle(runtime.page, panel);
    await submitFromUi(runtime.page, panel, deterministicText);
    await waitFor(runtime.page, () => withDb(fixture.dbPath, { readonly: true, fileMustExist: true },
      (db) => db.prepare('SELECT COUNT(*) AS n FROM exchanges WHERE thread_id = ?').get(identity.threadId).n === 2), 'second deliberate attempt');
    await waitForIdle(runtime.page, panel);
    const snapshot = await transportSnapshot(runtime.page);
    const requestIds = promptFrames(snapshot).slice(-2).map(requestIdOf);
    const acknowledgements = acceptanceFrames(snapshot);
    const acceptedTurnIds = requestIds.map((id) => acknowledgements.filter((frame) => requestIdOf(frame) === id)
      .map(authoritativeTurnId));
    const persistence = dbFacts(fixture.dbPath, identity.threadId, requestIds);
    assert.equal(promptFrames(snapshot).length, 2, 'deliberate attempts did not send two public-route prompts');
    assert.equal(persistence.exchangeCount, 2, 'deliberate attempts did not persist two exchanges');
    // Re-deliver the first real server acknowledgement only after a *new* draft
    // exists. This exercises the production socket handler without a test-only
    // product endpoint or another provider submission.
    await panel.locator('textarea.rv-chat-input').fill(revisedDraft);
    if (acknowledgements[0]) await runtime.page.evaluate((frame) => window.__futureSubmit.injectInbound(frame), acknowledgements[0]);
    // A replay of the latest accepted ACK after terminalization must also be
    // inert. It cannot reopen Stop/working presentation for a finished turn.
    if (acknowledgements[1]) await runtime.page.evaluate((frame) => window.__futureSubmit.injectInbound(frame), acknowledgements[1]);
    await runtime.page.waitForTimeout(100);
    const lateAckUi = { draftRetained: await panel.locator('textarea.rv-chat-input').inputValue() === revisedDraft,
      userBubbleCount: await panel.locator('.rv-message-user').count(),
      stopButtonCount: await panel.locator('.rv-stop-btn').count(),
      sendButtonCount: await panel.getByRole('button', { name: 'Send message' }).count() };
    const requiresReceipts = scenarioId === 'R4-DISTINCT-RECEIPTS';
    const missingContracts = [requestIds.some((value) => value === null) ? 'request-id' : null,
      requiresReceipts && persistence.receiptTables.length === 0 ? 'receipt-persistence' : null].filter(Boolean);
    const violations = missingContracts.length ? [] : [new Set(requestIds).size !== 2 ? 'deliberate-attempt-request-ids-not-distinct' : null,
      requiresReceipts && persistence.receiptRows !== 2 ? 'distinct-attempt-receipt-count-not-two' : null,
      persistence.activityCount !== 2 ? 'distinct-attempt-activity-count-not-two' : null,
      dispatchCount(fixture.adapterLog) !== 2 ? 'distinct-attempt-dispatch-count-not-two' : null,
      acceptedTurnIds.some((turnIds) => turnIds.length !== 1) ? 'distinct-attempt-correlated-acceptances-not-one-each' : null,
      acceptedTurnIds.some((turnIds, index) => turnIds[0] !== persistence.activityTurnIds[index])
        ? 'distinct-attempt-accepted-turn-identity-mismatch' : null,
      !lateAckUi.draftRetained ? 'old-ack-cleared-newer-draft' : null,
      lateAckUi.userBubbleCount !== 2 ? 'old-ack-created-duplicate-bubble' : null,
      lateAckUi.stopButtonCount !== 0 || lateAckUi.sendButtonCount !== 1
        ? 'current-duplicate-ack-reopened-finished-turn' : null].filter(Boolean);
    result = { caseId: scenarioId, status: missingContracts.length ? 'blocked' : 'executed', authenticatedShell: true,
      startupPanelReadiness: 'exact-rail-before-activation',
      fixture: scenario.fixture, owner: scenario.owner, missingContracts, assertionsEvaluated: missingContracts.length === 0,
      statusEndpointFabricated: false, promptContentRecorded: false,
      submittedSnapshotSha256: sha256(deterministicText), revisedDraftSha256: sha256(revisedDraft),
      transport: summarizeTransport(snapshot),
      observations: { requestIdsPresent: requestIds.map(Boolean), persistence, providerDispatchCount: dispatchCount(fixture.adapterLog),
        acceptedTurnIds, lateAckUi }, violations };
    if (process.env.FUSION_CHAT_ARCH_MODE === 'enforce') {
      assert.deepEqual(missingContracts, [], `${scenarioId} missing contracts after two authenticated deliberate attempts: ${missingContracts.join(', ')}`);
      assert.deepEqual(violations, [], `${scenarioId} invariant violations: ${violations.join(', ')}`);
    }
  } else {
    const requiresLateUi = scenarioId === 'R4-LATE-DRAFT-RECOVERY';
    await submitFromUi(runtime.page, panel, deterministicText);
    await waitFor(runtime.page, () => transportSnapshot(runtime.page).then((snapshot) => promptFrames(snapshot).length >= 1), 'outgoing original attempt');
    const initial = await transportSnapshot(runtime.page);
    const originalPrompt = promptFrames(initial)[0];
    const requestId = requestIdOf(originalPrompt);
    if (!requiresLateUi) {
      await runtime.page.evaluate(({ exact, mismatch }) => {
        window.__futureSubmit.replay(exact);
        window.__futureSubmit.replay(mismatch);
      }, { exact: originalPrompt, mismatch: { ...originalPrompt, user_input: `${deterministicText} mismatch` } });
      if (requestId) await waitFor(runtime.page, () => transportSnapshot(runtime.page).then((snapshot) =>
        acceptanceFrames(snapshot).filter((frame) => requestIdOf(frame) === requestId).length >= 2),
      'original and idempotent duplicate acceptance ACKs', 10_000).catch(() => {});
    }
    await waitFor(runtime.page, () => panel.locator('textarea.rv-chat-input').isEnabled(),
      'editable draft at recovery deadline (Send may remain gated)', 18_000);
    const beforeEdit = await transportSnapshot(runtime.page);
    const acceptanceBeforeEdit = acceptanceFrames(beforeEdit).length;
    const resendGatedBeforeEdit = await panel.getByRole('button', { name: 'Send message' }).isDisabled().catch(() => true);
    const visibleRecoveryStatusBeforeEdit = await runtime.page.evaluate(() => window.__futureSubmit.recoveryStatusVisibleNow());
    let preRestartDraft = null;
    if (requiresLateUi) {
      await panel.locator('textarea.rv-chat-input').fill(revisedDraft);
      await waitFor(runtime.page, () => transportSnapshot(runtime.page).then((snapshot) => acceptanceFrames(snapshot).length >= 1),
      'delayed original acceptance after revised draft', 10_000);
      await selectPanel(runtime.page, 'file-viewer', 'Files');
      panel = await openExistingThread(runtime.page, identity.threadGroupId);
      await runtime.page.waitForTimeout(2_500);
      preRestartDraft = await panel.locator('textarea.rv-chat-input').inputValue();
    }
    const beforeRestart = await transportSnapshot(runtime.page);
    let afterRestart = { sent: [], received: [] };
    if (requiresLateUi) {
      lingering.push(...await closeOwnedApp(runtime));
      runtime = await fixture.launch();
      await runtime.page.reload();
      await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
      panel = await openExistingThread(runtime.page, identity.threadGroupId);
      await runtime.page.waitForTimeout(500);
      afterRestart = await transportSnapshot(runtime.page);
    }
    const persistence = dbFacts(fixture.dbPath, identity.threadId, [requestId]);
    const correlatedFrames = [...beforeRestart.received, ...afterRestart.received].filter((frame) => requestIdOf(frame) === requestId);
    const duplicateAcceptances = acceptanceFrames(beforeRestart).filter((frame) => requestIdOf(frame) === requestId);
    const missingContracts = [requestId === null ? 'request-id' : null,
      persistence.receiptTables.length === 0 ? 'receipt-persistence' : null,
      requiresLateUi && acceptanceBeforeEdit !== 0 ? 'editable-draft-before-late-ack' : null].filter(Boolean);
    const providerDispatchCount = dispatchCount(fixture.adapterLog);
    const userBubbleCount = await panel.locator('.rv-message-user').count();
    const violations = missingContracts.length ? [] : [persistence.receiptRows !== 1 ? 'duplicate-request-receipt-count-not-one' : null,
      persistence.activityCount !== 1 ? 'duplicate-request-activity-count-not-one' : null,
      providerDispatchCount !== 1 ? 'duplicate-request-dispatch-count-not-one' : null,
      persistence.exchangeCount !== 1 ? 'duplicate-request-exchange-count-not-one' : null,
      userBubbleCount !== 1 ? 'duplicate-request-user-bubble-count-not-one' : null,
      !requiresLateUi && duplicateAcceptances.some((frame) => authoritativeTurnId(frame) !== persistence.activityTurnIds[0])
        ? 'idempotent-duplicate-turn-identity-mismatch' : null,
      !requiresLateUi && duplicateAcceptances.length !== 2 ? 'idempotent-duplicate-ack-count-not-two' : null,
      requiresLateUi && duplicateAcceptances.length !== 1 ? 'late-original-ack-count-not-one' : null,
      requiresLateUi && preRestartDraft !== revisedDraft ? 'late-original-response-cleared-revised-draft' : null,
      requiresLateUi && acceptanceBeforeEdit === 0 && !resendGatedBeforeEdit ? 'unresolved-resend-not-gated' : null,
      requiresLateUi && !visibleRecoveryStatusBeforeEdit ? 'visible-unknown-or-recovering-status-missing' : null,
      !requiresLateUi && !correlatedFrames.some((frame) => frame.type === 'error'
        && /mismatch|fingerprint|conflict/i.test([frame.code, frame.reason, frame.message].filter(Boolean).join(' ')))
        ? 'mismatched-fingerprint-rejection-missing' : null].filter(Boolean);
    result = { caseId: scenarioId, status: missingContracts.length ? 'blocked' : 'executed', authenticatedShell: true,
      startupPanelReadiness: 'exact-rail-before-activation',
      fixture: scenario.fixture, owner: scenario.owner, missingContracts, assertionsEvaluated: missingContracts.length === 0,
      statusEndpointFabricated: false,
      promptContentRecorded: false, originalSnapshotSha256: sha256(deterministicText), revisedDraftSha256: sha256(revisedDraft),
      transport: { beforeRestart: summarizeTransport(beforeRestart), afterRestart: summarizeTransport(afterRestart) },
      observations: { exactDuplicateReplayed: !requiresLateUi, mismatchedFingerprintReplayed: !requiresLateUi,
        idempotentAcceptanceCount: duplicateAcceptances.length, acceptanceBeforeEdit, resendGatedBeforeEdit,
        visibleRecoveryStatusBeforeEdit,
        switchedViewAndRemounted: requiresLateUi,
        restarted: requiresLateUi, preRestartDraftRetained: requiresLateUi ? preRestartDraft === revisedDraft : null,
        persistence, providerDispatchCount, userBubbleCount }, violations };
    if (process.env.FUSION_CHAT_ARCH_MODE === 'enforce') {
      assert.deepEqual(missingContracts, [], `${scenarioId} missing contracts after authenticated duplicate/mismatch/remount/restart probe: ${missingContracts.join(', ')}`);
      assert.deepEqual(violations, [], `${scenarioId} invariant violations: ${violations.join(', ')}`);
    }
  }
  assert.equal(result.authenticatedShell, true);
} catch (error) {
  failure = error;
  if (runtime?.page) await runtime.page.screenshot({ path: path.join(evidenceRoot, `${scenarioId.toLowerCase()}-failure.png`), fullPage: true }).catch(() => {});
} finally {
  if (runtime) lingering.push(...await closeOwnedApp(runtime));
  const cleanup = fixture ? cleanupFixture(fixture, token) : null;
  fs.writeFileSync(resultPath, `${JSON.stringify({ ...result, cleanup: { lingering, ...cleanup },
    failure: failure ? { name: failure.name, message: failure.message, stack: failure.stack } : null }, null, 2)}\n`);
}

assert.deepEqual(lingering, []);
if (failure) throw failure;
process.stdout.write(`CHAT_ARCH_FUTURE_SUBMIT_OK ${scenarioId} ${result.status}\n`);
