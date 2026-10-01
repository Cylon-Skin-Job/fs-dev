import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [token, evidenceRoot, tempRoot, caseFocus] = process.argv.slice(2);
if (caseFocus && caseFocus !== 'r5-current-owner') throw new Error(`unknown R5 fixture focus: ${caseFocus}`);
assert.match(token || '', /^chat-architecture-owner-chat-arch-/);
assert.ok(evidenceRoot && path.isAbsolute(evidenceRoot));
assert.ok(tempRoot && path.isAbsolute(tempRoot));

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const clientRoot = path.join(repoRoot, 'fusion-studio-client');
const result = spawnSync(process.execPath, [
  path.join(clientRoot, 'node_modules', '@playwright', 'test', 'cli.js'),
  'test',
  '--config=playwright.chat-architecture.config.ts',
  'e2e/chat-architecture/observation-boundaries.spec.ts',
  '--output', path.join(evidenceRoot, caseFocus || 'r5-diagnostic-append', 'playwright-results'),
  '--grep',
  caseFocus === 'r5-current-owner' ? 'R5 (current action owner|unknown attempt)' : 'R5 diagnostic Ask AI',
], { cwd: clientRoot, env: { ...process.env }, encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
assert.equal(result.status, 0, `R5 Playwright case exited ${result.status}`);

const evidence = {
  caseId: caseFocus === 'r5-current-owner' ? 'R5-CURRENT-OWNER' : 'R5-DIAGNOSTIC-APPEND',
  status: 'passed',
  actualModules: caseFocus === 'r5-current-owner'
    ? ['chat-action', 'chat-action-controller', 'chatSubmissionStore']
    : ['ChatDiagnosticDetails', 'ChatSessionHost', 'ChatInput', 'chat-diagnostic-handlers'],
  observations: caseFocus === 'r5-current-owner' ? [
    'duplicate mounts insert once in the exact captured session',
    'later view selection leaves sibling draft unchanged',
    'send queues an exact prompt and reports pending, never accepted before server acknowledgement',
    'unknown attempt keeps exact text and attachment insertion available while resend remains blocked',
  ] : [
    'explicit Ask AI retrieves one validated diagnostic report',
    'existing draft is preserved byte-for-byte and diagnostic text is appended',
    'unknown attempt keeps clicked Ask AI insertion available while no prompt is resent',
    'no prompt is sent automatically',
    'visible inserted status is rendered',
  ],
  privateContentRecorded: false,
};
fs.writeFileSync(path.join(evidenceRoot, caseFocus === 'r5-current-owner' ? 'r5-current-owner.json' : 'r5-diagnostic-append.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(caseFocus === 'r5-current-owner' ? 'CHAT_ARCH_R5_CURRENT_OWNER_OK\n' : 'CHAT_ARCH_R5_DIAGNOSTIC_OK\n');
