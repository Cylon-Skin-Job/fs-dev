// Stop only the verified disposable app using the accepted restart owners.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert(config.candidate.startsWith('/private/tmp/mc-s6-'));
assert(config.profile.startsWith('/private/tmp/mc-s6-'));
const load = (name) => import(pathToFileURL(`${config.candidate}/scripts/${name}`).href);
const { resolveTarget } = await load('fusion-restart-target.mjs');
const { selectOwnedProcesses, systemProcesses } = await load('fusion-restart-processes.mjs');
const { stopOwned } = await load('fusion-restart.mjs');
const target = resolveTarget(['--repo', config.candidate, '--machine', config.machine, '--user-data', config.profile]);
const selected = selectOwnedProcesses(systemProcesses(), target);
await stopOwned(selected);
const remaining = selectOwnedProcesses(systemProcesses(), target);
assert.equal(remaining.length, 0);
fs.writeFileSync(process.argv[3], `${JSON.stringify({ kind: 'OWNED_PRIVATE_RUNTIME_STOP',
  selected: selected.map(({ pid, ppid, start, command }) => ({ pid, ppid, start, command })), remaining,
  repo: target.repo, profile: target.profile, machine: target.machine, at: new Date().toISOString() }, null, 2)}\n`);
