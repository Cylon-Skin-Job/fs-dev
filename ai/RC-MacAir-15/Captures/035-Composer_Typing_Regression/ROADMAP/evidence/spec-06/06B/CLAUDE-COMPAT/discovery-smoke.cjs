'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const repo = process.cwd();
const current = require(path.join(repo, 'fusion-studio-server/lib/harness/child-environment'));
const previous = require(path.join(__dirname, 'before/fusion-studio-server/lib/harness/child-environment'));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-claude-discovery-'));
const project = path.join(root, 'project');
fs.mkdirSync(project);
const result = { startedAt: new Date().toISOString(), root, command: ['opencode', 'debug', 'skill'], runs: [] };
function run(label, env) {
  const output = path.join(root, `${label}.json`);
  const fd = fs.openSync(output, 'wx', 0o600);
  let child;
  try {
    child = spawnSync('/opt/homebrew/bin/opencode', ['debug', 'skill'], { cwd: project, env, encoding: 'utf8', stdio: ['ignore', fd, 'pipe'], timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  } finally { fs.closeSync(fd); }
  const receipt = { label, status: child.status, signal: child.signal, errorCode: child.error?.code || null, stderrBytes: Buffer.byteLength(child.stderr || '') };
  // Do not retain skill contents, credentials, raw stderr, or environment values.
  assert.equal(child.status, 0, JSON.stringify(receipt));
  receipt.skills = JSON.parse(fs.readFileSync(output, 'utf8')).map(({ name, location }) => ({ name, location })).sort((a, b) => a.name.localeCompare(b.name));
  result.runs.push(receipt);
  return receipt.skills;
}
try {
  result.version = spawnSync('/opt/homebrew/bin/opencode', ['--version'], { encoding: 'utf8' }).stdout.trim();
  assert.equal(result.version, '1.18.32');
  const fixtureHome = path.join(root, 'home');
  const source = { PATH: process.env.PATH, HOME: fixtureHome, XDG_CONFIG_HOME: path.join(root, 'config'), XDG_DATA_HOME: path.join(root, 'data'), XDG_CACHE_HOME: path.join(root, 'cache'), XDG_STATE_HOME: path.join(root, 'state') };
  const sentinels = {
    'claude-global-canary': path.join(fixtureHome, '.claude/skills/claude-global-canary/SKILL.md'),
    'claude-project-canary': path.join(project, '.claude/skills/claude-project-canary/SKILL.md'),
    'agents-global-canary': path.join(fixtureHome, '.agents/skills/agents-global-canary/SKILL.md'),
    'agents-project-canary': path.join(project, '.agents/skills/agents-project-canary/SKILL.md'),
    'native-global-canary': path.join(source.XDG_CONFIG_HOME, 'opencode/skills/native-global-canary/SKILL.md'),
    'native-project-canary': path.join(project, '.opencode/skills/native-project-canary/SKILL.md'),
  };
  for (const [name, file] of Object.entries(sentinels)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `---\nname: ${name}\ndescription: Disposable discovery test sentinel.\n---\nNo actions.\n`);
  }
  const baseline = run('isolated-before', previous.buildHarnessChildEnvironment('opencode', { source }));
  const changed = run('isolated-current', current.buildHarnessChildEnvironment('opencode', { source }));
  for (const name of Object.keys(sentinels)) {
    assert(baseline.some((skill) => skill.name === name), `baseline missing ${name}`);
    assert.equal(changed.some((skill) => skill.name === name), !name.startsWith('claude-'), name);
  }
  // Remove only the marked synthetic project skills before real-home discovery.
  for (const dir of ['.claude', '.agents', '.opencode']) fs.rmSync(path.join(project, dir), { recursive: true, force: true });
  const actualBefore = run('production-environment-before', previous.buildHarnessChildEnvironment('opencode'));
  const actualAfter = run('production-environment-current', current.buildHarnessChildEnvironment('opencode'));
  const isClaude = (skill) => skill.location?.split(path.sep).includes('.claude');
  assert(actualBefore.some(isClaude), 'actual baseline did not calibrate Claude discovery');
  assert(!actualAfter.some(isClaude), 'Claude discovery still enabled');
  for (const skill of actualBefore.filter((skill) => !isClaude(skill))) assert(actualAfter.some((after) => after.name === skill.name && after.location === skill.location), `native skill lost: ${skill.name}`);
  result.status = 'passed';
} catch (error) { result.status = 'failed'; result.failure = error.message; process.exitCode = 1; }
finally {
  fs.rmSync(root, { recursive: true, force: true });
  result.cleanup = { rootAbsent: !fs.existsSync(root) };
  result.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, 'discovery-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, runs: result.runs.map((run) => ({ label: run.label, status: run.status, skillCount: run.skills.length })), cleanup: result.cleanup }));
}
