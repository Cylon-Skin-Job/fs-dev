import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildF2Exchanges, f4Manifest, F5_MANIFEST, materializeF3Workspace } from './fixture-workloads.mjs';
import { assertCompleteScenarioInventory, ENFORCE_GROUPS, SCENARIOS } from './scenario-inventory.mjs';

test('R1-R9 inventory has concrete fixture IDs and exact later owners', () => {
  assert.equal(assertCompleteScenarioInventory(), true);
  assert.equal(new Set(SCENARIOS.map((item) => item.id)).size, SCENARIOS.length);
  assert.ok(SCENARIOS.every((item) => /^R[1-9]-/.test(item.id)));
  assert.deepEqual(Object.keys(ENFORCE_GROUPS), ['submit', 'actions', 'render', 'soak', 'backend']);
  assert.deepEqual(ENFORCE_GROUPS.soak, ['R1-FIVE-MINUTE-TYPING']);
});

test('F2 is exactly 30 exchanges / 60 messages and includes a separate exact 522 KiB dense assistant payload', () => {
  const f2 = buildF2Exchanges();
  assert.equal(f2.exchanges.length, 30);
  assert.equal(f2.manifest.renderedMessages, 60);
  assert.deepEqual(f2.manifest.includes, ['text', 'code', 'lists', 'tables', 'collapsed-tool-results', 'reply-metadata']);
  assert.equal(f2.dense.length, 2);
  assert.equal(f2.manifest.dense.assistantPayloadBytes, 522 * 1024);
});

test('F3 has fixed counts, at least 10 MiB, fixture-contained paths, and reproducible hashes', () => {
  const rootA = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-arch-f3-a-'));
  const rootB = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-arch-f3-b-'));
  try {
    const first = materializeF3Workspace(rootA);
    const second = materializeF3Workspace(rootB);
    assert.deepEqual(first.counts, { smallFiles: 1_000, captureFolders: 100, wikiPages: 100, officeDocuments: 20 });
    assert.equal(first.totalFiles, 1_220);
    assert.ok(first.totalContentBytes >= 10 * 1024 * 1024);
    assert.equal(first.everyPathFixtureContained, true);
    assert.equal(first.manifestHash, second.manifestHash);
    assert.deepEqual(first.files.map((item) => item.sha256), second.files.map((item) => item.sha256));
  } finally {
    fs.rmSync(rootA, { recursive: true, force: true });
    fs.rmSync(rootB, { recursive: true, force: true });
  }
});

test('F4 declares duplicate, cross-view, Side-after-Move, visible, and inactive states', () => {
  const serialized = JSON.stringify(f4Manifest());
  for (const value of ['F4-SAME-SESSION-DUPLICATE', 'F4-TWO-SESSIONS-VIEWS', 'F4-SIDE-AFTER-MOVE', 'visible', 'inactive-mounted']) {
    assert.match(serialized, new RegExp(value));
  }
});

test('F5 fixes 20 fps bounded canonical events and every named fault gate', () => {
  assert.equal(F5_MANIFEST.frameIntervalMs, 50);
  assert.equal(F5_MANIFEST.framesPerSecond, 20);
  assert.equal(F5_MANIFEST.maxTextFrameBytes, 200);
  for (const event of ['thinking', 'tool', 'usage', 'terminal']) assert.ok(F5_MANIFEST.events.includes(event));
  for (const gate of ['before-admission', 'after-admission', 'before-ack', 'after-ack', 'before-dispatch', 'after-dispatch',
    'before-turn-begin', 'after-turn-begin', 'before-stop', 'after-stop', 'before-save-ack', 'after-save-ack',
    'before-shutdown', 'after-shutdown']) assert.ok(F5_MANIFEST.faults.includes(gate));
});

test('SPEC-02 receipt/status-dependent R3/R4 assertions fail closed as blocked future contracts', () => {
  const future = SCENARIOS.filter((item) => ['R3', 'R4'].includes(item.requirement));
  assert.ok(future.length >= 3);
  assert.ok(future.every((item) => item.owner.startsWith('SPEC-02/')));
  assert.ok(future.every((item) => item.state.includes('missing-')));
  assert.ok(future.some((item) => item.state.includes('receipt-status')));
});

test('R7-R9 distinguish current characterization, future contract ownership, and owner-native acceptance', () => {
  const r7 = SCENARIOS.find((item) => item.id === 'R7-STREAM-STOP-SAVE');
  const r8 = SCENARIOS.find((item) => item.id === 'R8-GROUP-BACKEND-MATRIX');
  const r9 = SCENARIOS.find((item) => item.id === 'R9-NATIVE-OWNER-SYMPTOMS');
  assert.equal(r7?.state, 'characterize-current-branches');
  assert.equal(r8?.owner, 'SPEC-05/05A-05C');
  assert.equal(r9?.state, 'blocked-owner-native-acceptance');
});

test('five-minute R1 uses the approved wall formula and a fail-closed screenshot quiescence boundary', () => {
  const source = fs.readFileSync(path.join(import.meta.dirname, 'r1-sustained-electron.mjs'), 'utf8');
  assert.match(source, /configuredCharacters \* configuredDelayMs \* 1\.5/);
  assert.doesNotMatch(source, /configuredDurationMs \* 1\.15/);
  for (const type of ['screenshot:capture', 'screenshot:updated', 'screenshot:request', 'screenshot:data']) {
    assert.match(source, new RegExp(`['"]${type.replace(':', '\\:')}['"]`));
  }
  assert.match(source, /metrics\.wsSent !== 0 \? 'typing-time outbound WebSocket frames'/);
  assert.match(source, /outboundEvidenceOverflow/);
});

if (process.env.FUSION_CHAT_ARCH_MODE === 'enforce') {
  test('future backend contracts fail closed until their owning SPEC activates assertions', () => {
    assert.fail(`enforce group is not activated by ${process.env.FUSION_CHAT_ARCH_CASE_ID || 'this slice'}`);
  });
}
