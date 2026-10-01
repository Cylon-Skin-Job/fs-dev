import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { sourceViolations, graphCycles, inspectOwners, ownerGraph } from './backend-owner-contract.mjs';
const root = path.resolve(import.meta.dirname, '../../..');

test('owner detector fixtures reject facade policy, whole-manager injection, second maps and cycles', () => {
  assert.deepEqual(sourceViolations('ThreadManager.js', 'x\n'.repeat(401)), ['line limit: 401']);
  assert.ok(sourceViolations('/ThreadManager.js', 'db.transaction(async trx => {})').length);
  assert.ok(sourceViolations('/ThreadManager.js', 'for (const item of rows) {}').length);
  assert.ok(sourceViolations('/owner.js', 'createOwner({ manager: this })').length);
  assert.ok(sourceViolations('/owner.js', 'this.runtimeByThread = new Map()').length);
  assert.deepEqual(sourceViolations('/session-manager.js', 'this.activeSessions = new Map()'), []);
  assert.equal(graphCycles({ a: ['b'], b: ['c'], c: ['a'] }).length, 1);
  assert.deepEqual(ownerGraph(root, {
    'x/a.ts': "import { b } from './b';",
    'x/b.tsx': "const c = require('./c');",
    'x/c.js': "export { a } from './a';",
  }), { 'x/a.ts': ['x/b.tsx'], 'x/b.tsx': ['x/c.js'], 'x/c.js': ['x/a.ts'] });
  assert.deepEqual(graphCycles({ facade: ['command'], command: ['repository'], repository: [] }), []);
});

test('all SPEC05 changed and extracted production owners are bounded and acyclic', (t) => {
  const inventory = inspectOwners(root);
  assert.deepEqual(inventory.violations, {});
  assert.deepEqual(graphCycles(inventory.graph), []);
  t.diagnostic(JSON.stringify({ ownerGraph: inventory.graph }));
  const source = (file) => fs.readFileSync(path.join(root, 'fusion-studio-server/lib', file), 'utf8');
  assert.doesNotMatch(source('thread/ThreadIndex.js'), /async (create|delete)\(/);
  assert.match(source('thread/session-lifecycle.js'), /sessionRepository\.insertRow\(trx/);
  assert.match(source('thread-groups/delete-transaction.js'), /sessions\.deleteRows\(trx/);
  assert.match(source('thread-groups/session-transactions.js'), /withGroupMutationLease/);
  assert.match(source('thread/HistoryFile.js'), /mirror-journal/);
  for (const owner of ['runtime-dispatch', 'runtime-stop', 'runtime-activation', 'automation-drain']) {
    assert.match(source(`thread/${owner}.js`), /threadRuntimeManager/);
  }
});
