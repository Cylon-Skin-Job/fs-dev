import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [token, evidenceRoot] = process.argv.slice(2);
assert.match(token || '', /^chat-architecture-owner-chat-arch-/);
const clientRoot = path.resolve(import.meta.dirname, '../..');
const command = [path.join(clientRoot, 'node_modules/@playwright/test/cli.js'),
  'test', '--config=playwright.chat-architecture.config.ts', 'e2e/chat-surface-identity.spec.ts',
  '--grep', 'history-only|late thread:opened|model selection|passive thread:open',
  '--output', path.join(evidenceRoot, 'member-history-test-results')];
const result = spawnSync(process.execPath, command, { cwd: clientRoot,
  env: process.env, encoding: 'utf8', timeout: 120_000 });
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
fs.writeFileSync(path.join(evidenceRoot, 'r8-member-history-result.json'), JSON.stringify({
  command: [process.execPath, ...command], status: result.status === 0 ? 'passed' : 'failed',
  exitCode: result.status, error: result.error?.message || null,
  assertions: ['exact session history', 'different selected group preserved',
    'pending Main opens preserved even for same group', 'portable selection and late-frame compatibility'],
}, null, 2));
assert.equal(result.status, 0);
