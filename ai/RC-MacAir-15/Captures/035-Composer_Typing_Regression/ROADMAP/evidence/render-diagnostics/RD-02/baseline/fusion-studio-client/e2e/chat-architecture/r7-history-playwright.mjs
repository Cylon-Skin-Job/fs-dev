import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [token, evidenceRoot, tempRoot] = process.argv.slice(2);
assert.match(token || '', /^chat-architecture-owner-chat-arch-/);
assert.ok(evidenceRoot && path.isAbsolute(evidenceRoot));
assert.ok(tempRoot && path.isAbsolute(tempRoot));

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const clientRoot = path.join(repoRoot, 'fusion-studio-client');
const result = spawnSync(process.execPath, [
  path.join(clientRoot, 'node_modules', '@playwright', 'test', 'cli.js'),
  'test',
  '--config=playwright.chat-architecture.config.ts',
  'e2e/chat-surface-isolation.spec.ts',
  '--grep',
  '20fps live frontier|metadata invalidation',
], { cwd: clientRoot, env: { ...process.env }, encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
assert.equal(result.status, 0, `R7 completed-history observation exited ${result.status}`);

fs.writeFileSync(path.join(evidenceRoot, 'r7-history-live.json'), `${JSON.stringify({
  caseId: 'R7-HISTORY-LIVE-OBSERVATION',
  status: 'passed',
  observations: [
    'twenty canonical content frames delivered at 50ms intervals invoke zero completed formatter/history renderer work',
    'history DOM identity, selection, scroll position, tool expansion, links, and bookmark chrome survive the live frontier',
    'metadata revision changes only the addressed message and does not rerun unchanged Markdown formatting',
    'same-id hydration with edited content remounts bounded row caches and cannot display stale content or metadata',
  ],
  cacheLifetime: 'mounted completed-message row; retirement/hydration unmount releases derived useMemo values',
  privateContentRecorded: false,
}, null, 2)}\n`, { flag: 'wx' });
process.stdout.write('CHAT_ARCH_R7_HISTORY_LIVE_OK\n');
