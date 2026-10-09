import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { resolveTarget } from '/private/tmp/chat-ar-integration-r6pe5gmi/candidate/scripts/fusion-restart-target.mjs';
import { systemProcesses, selectOwnedProcesses, listenerPids } from '/private/tmp/chat-ar-integration-r6pe5gmi/candidate/scripts/fusion-restart-processes.mjs';
import { stopOwned } from '/private/tmp/chat-ar-integration-r6pe5gmi/candidate/scripts/fusion-restart.mjs';
const root = process.argv[2], nonce = process.argv[3];
assert.equal(fs.readFileSync(path.join(root, '.chat-ar-integration-owned'), 'utf8'), nonce + '\n');
const prep = JSON.parse(fs.readFileSync(path.join(root, 'runtime-preparation.json'), 'utf8'));
const target = resolveTarget(['--repo', '/private/tmp/chat-ar-integration-r6pe5gmi/candidate', '--machine', prep.machine, '--user-data', prep.profile]);
assert.equal(target.profile, fs.realpathSync(prep.profile));
const runs = fs.readdirSync(target.runtime).filter(n => n.startsWith('run-'));
assert.equal(runs.length, 1);
const verified = JSON.parse(fs.readFileSync(path.join(target.runtime, runs[0], 'verified.json'), 'utf8'));
const selected = selectOwnedProcesses(systemProcesses(), target);
assert.ok(selected.some(r => r.pid === verified.mainPid));
assert.ok(selected.some(r => r.pid === verified.serverPid));
fs.writeFileSync(path.join(root, 'runtime-stop-preimage.json'), JSON.stringify({ at: new Date().toISOString(), target, selected }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
await stopOwned(selected);
const after = systemProcesses();
const remaining = selectOwnedProcesses(after, target);
assert.equal(remaining.length, 0);
assert.ok(!after.some(r => selected.some(old => old.pid === r.pid)));
assert.deepEqual(listenerPids(verified.serverPort), []);
assert.deepEqual(listenerPids(verified.debugPort), []);
const receipt = { status: 'OWNED_RUNTIME_STOPPED', at: new Date().toISOString(), profile: target.profile,
  selectedPids: selected.map(r => r.pid), remaining: remaining.length, serverPortReleased: verified.serverPort,
  debugPortReleased: verified.debugPort, evidenceRetained: root,
  scope: 'Verified private-profile tree only; script can use its documented timeout signal fallback, so this is owned cleanup evidence, not unconditional graceful production shutdown proof.' };
fs.writeFileSync(path.join(root, 'runtime-stop-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify(receipt));
