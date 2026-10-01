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
const playwrightCli = path.join(clientRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const result = spawnSync(process.execPath, [
  playwrightCli,
  'test',
  '--config=playwright.chat-architecture.config.ts',
  'e2e/chat-architecture/observation-boundaries.spec.ts',
  '--grep',
  'R9 indicator states',
], {
  cwd: clientRoot,
  env: { ...process.env, FUSION_CHAT_ARCH_EVIDENCE_ROOT: evidenceRoot },
  encoding: 'utf8',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`R9 Playwright characterization exited ${result.status}`);

const evidenceFile = path.join(evidenceRoot, 'r9-result.json');
assert.ok(fs.existsSync(evidenceFile), 'R9 Playwright test did not produce evidence');
const evidence = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
assert.equal(evidence.caseId, 'R9-INDICATOR-DISTINCTION');
assert.equal(evidence.status, 'passed');
assert.equal(evidence.contentCaptured, false);
assert.deepEqual(evidence.states.map((state) => state.label), [
  'prompt-acceptance',
  'turn-finalization',
  'active-work',
  'idle',
]);
assert.ok(evidence.blockedRenderer.endedAt - evidence.blockedRenderer.startedAt >= 75);
process.stdout.write('CHAT_ARCH_R9_OK\n');
