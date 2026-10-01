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
  'test', '--config=playwright.chat-architecture.config.ts',
  'e2e/chat-architecture/observation-boundaries.spec.ts', '--grep', 'R6 ',
], { cwd: clientRoot, env: { ...process.env, FUSION_CHAT_ARCH_MODE: 'characterize' }, encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
const observation = (marker) => {
  const line = result.stdout?.split('\n').find((entry) => entry.startsWith(`${marker} `));
  return line ? JSON.parse(line.slice(marker.length + 1)) : null;
};
const evidence = {
  caseId: 'R6-LIFETIME-BOUNDARIES', requestedMode: process.env.FUSION_CHAT_ARCH_MODE,
  executionMode: 'characterize', gateRole: 'source-only Legacy host hazard; not authenticated production R6 enforcement',
  status: result.status === 0 ? 'passed' : 'failed', exitCode: result.status,
  assertions: ['prompt wait retired-socket listener ownership',
    'complete same-workspace competing open listener and draft readback',
    'prompt resolution and create completion listener cleanup'],
  observations: {
    promptLifetime: observation('CHAT_ARCH_R6_PROMPT_LIFETIME'),
    unrelatedOpen: observation('CHAT_ARCH_R6_UNRELATED_OPEN'),
    createLifetime: observation('CHAT_ARCH_R6_CREATE_LIFETIME'),
    promptCompletion: observation('CHAT_ARCH_R6_AFTER_PROMPT_COMPLETION'),
  },
  productSourcePatched: false,
};
fs.writeFileSync(path.join(evidenceRoot, 'r6-lifetime-boundaries.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
assert.equal(result.status, 0, `R6 lifetime Playwright cases exited ${result.status}`);
process.stdout.write('CHAT_ARCH_R6_BOUNDARIES_OK\n');
