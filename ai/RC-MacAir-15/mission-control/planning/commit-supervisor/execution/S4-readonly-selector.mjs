import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolveTarget } from '/Users/rccurtrightjr./projects/fs-dev/scripts/fusion-restart-target.mjs';
import { selectOwnedProcesses, systemProcesses } from '/Users/rccurtrightjr./projects/fs-dev/scripts/fusion-restart-processes.mjs';
const target = resolveTarget(['--repo', '/Users/rccurtrightjr./projects/fs-dev', '--machine', 'RC-MacAir-15', '--dry-run'], {});
const before = execFileSync('ps', ['-p', '77002,77007,48636,48653', '-o', 'pid=,ppid=,command='], { encoding: 'utf8' });
const records = systemProcesses();
const selected = selectOwnedProcesses(records, target);
const after = execFileSync('ps', ['-p', '77002,77007,48636,48653', '-o', 'pid=,ppid=,command='], { encoding: 'utf8' });
if (before !== after || !selected.some((r) => r.pid === 77002) || !selected.some((r) => r.pid === 77007) || selected.some((r) => r.pid === 48636 || r.pid === 48653)) throw new Error('selected/protected identity regression');
const output = { at: new Date().toISOString(), operations: 'read-only; no signals/cache/port/profile/app launch', target,
  selected: selected.map(({ pid, ppid, command, cwd, env, executables }) => ({ pid, ppid, command, cwd, env, executable: executables?.[0] })), protectedBefore: before, protectedAfter: after };
fs.writeFileSync(new URL('S4-readonly-selector.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
