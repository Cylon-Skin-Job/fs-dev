import fs from 'node:fs';
import {systemProcesses, selectOwnedProcesses} from '/Users/rccurtrightjr./projects/fs-dev/scripts/fusion-restart-processes.mjs';
import {resolveTarget} from '/Users/rccurtrightjr./projects/fs-dev/scripts/fusion-restart-target.mjs';
const e = 'planning/commit-supervisor/execution/';
const before = JSON.parse(fs.readFileSync(e + 'S4-race-protected-before.json', 'utf8'));
const records = systemProcesses();
const selected = selectOwnedProcesses(records, resolveTarget(['--repo', '/Users/rccurtrightjr./projects/fs-dev', '--machine', 'RC-MacAir-15', '--dry-run'], {}));
const current = before.protected.map((old) => {
  const now = records.find((r) => r.pid === old.pid);
  const keys = ['pid', 'ppid', 'uid', 'start', 'command', 'cwd', 'env'];
  const same = Boolean(now) && keys.every((k) => JSON.stringify(old[k]) === JSON.stringify(now[k])) && old.executables?.[0] === now.executables?.[0];
  return {pid: old.pid, same, record: now};
});
const proof = {at: new Date().toISOString(), kind: 'READ_ONLY_PROTECTED_PROCESS_FINAL', current,
  selected: selected.map(({pid, ppid, start, command}) => ({pid, ppid, start, command})),
  alphaSelected: selected.some((r) => [48636, 48653].includes(r.pid)), signals: 0};
fs.writeFileSync(e + 'S4-race-protected-final.json', JSON.stringify(proof, null, 2) + '\n');
if (current.some((r) => !r.same) || proof.alphaSelected) throw Error('protected process drift');
console.log(JSON.stringify({protected: current.map(({pid, same}) => ({pid, same})), alphaSelected: proof.alphaSelected, signals: 0}));
