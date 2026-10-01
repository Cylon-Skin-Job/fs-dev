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
const coverageUnit = spawnSync(process.execPath, [
  '--test',
  path.join(import.meta.dirname, 'coverage-observation.test.mjs'),
  path.join(import.meta.dirname, 'window-focus.test.mjs'),
], { cwd: clientRoot, env: { ...process.env }, encoding: 'utf8' });
if (coverageUnit.stdout) process.stdout.write(coverageUnit.stdout);
if (coverageUnit.stderr) process.stderr.write(coverageUnit.stderr);
if (coverageUnit.error) throw coverageUnit.error;
assert.equal(coverageUnit.status, 0, `R1 coverage authenticity unit exited ${coverageUnit.status}`);

const result = spawnSync(process.execPath, [
  path.join(clientRoot, 'node_modules', '@playwright', 'test', 'cli.js'),
  'test',
  '--config=playwright.chat-architecture.config.ts',
  'e2e/chat-surface-isolation.spec.ts',
  '--grep',
  'duplicate mounts preserve exact draft input semantics|draft-only updates render the exact composer leaf',
], { cwd: clientRoot, env: { ...process.env }, encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
assert.equal(result.status, 0, `R1 composer correctness Playwright case exited ${result.status}`);

fs.writeFileSync(path.join(evidenceRoot, 'r1-composer-correctness.json'), `${JSON.stringify({
  caseId: 'R1-COMPOSER-CORRECTNESS',
  status: 'passed',
  observations: [
    'coverage discovery fails closed when any zero-count target is misspelled or unavailable',
    'measurement focus establishment retries boundedly and fails explicitly when unavailable or lost',
    'same-session duplicate mounts retain one exact shared draft while other sessions stay isolated',
    'selection, composition, paste/drop input types, emoji, autocomplete and resize retain exact text',
    'draft-only updates invoke the connected composer and zero history/header/completed formatter work',
  ],
  privateContentRecorded: false,
}, null, 2)}\n`, { flag: 'wx' });
process.stdout.write('CHAT_ARCH_R1_COMPOSER_CORRECTNESS_OK\n');
