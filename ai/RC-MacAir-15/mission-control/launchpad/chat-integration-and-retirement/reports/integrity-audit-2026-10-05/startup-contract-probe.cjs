'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const serverRoot = '/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server';
const req = createRequire(path.join(serverRoot, 'package.json'));
const runtimeModule = req('./lib/testing/isolated-provenance-runtime');
const startupSource = fs.readFileSync(path.join(serverRoot, 'lib/startup.js'), 'utf8');
const ast = req('@babel/parser').parse(startupSource, { sourceType: 'script' });
const actualNames = [];
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression'
      && node.callee.object?.name === 'isolatedProvenance'
      && node.callee.property?.name === 'defineStartupEffect') actualNames.push(node.arguments[0].value);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
const normalRuntime = runtimeModule.createIsolatedProvenanceRuntime({ environment: {} });
let factoryRan = false;
let registryError = null;
try { normalRuntime.defineStartupEffect('workspace-automation-pipeline', () => { factoryRan = true; }).start(); }
catch (error) { registryError = error.message; }
const nameCheck = {
  actualNames,
  unsupported: actualNames.filter(name => !runtimeModule.EXPECTED_STARTUP_EFFECTS.includes(name)),
  expectedButUnregistered: runtimeModule.EXPECTED_STARTUP_EFFECTS.filter(name => !actualNames.includes(name)),
  normalMode: { registryError, factoryRan },
};
process.env.FUSION_LOCAL_MACHINE = 'Test-Integrity';
const probeOutput = fs.mkdtempSync(path.join(fs.realpathSync(require('os').tmpdir()), 'chat-ar-startup-probe-'));
const fixture = path.join(probeOutput, 'readiness-fixture');
const machineRoot = path.join(fixture, 'ai', 'Test-Integrity');
for (const [folder, id, contentRoot] of [
  ['001-issues-viewer', 'issues-viewer', 'Issues'],
  ['002-agents-viewer', 'agents-viewer', 'Agents'],
]) {
  const capsule = path.join(machineRoot, 'System', 'Views', folder);
  fs.mkdirSync(capsule, { recursive: true });
  fs.writeFileSync(path.join(capsule, 'manifest.md'), `---\nname: Fixture\nmetadata:\n  view-id: ${id}\n  view-type: custom\n  enabled: true\n---\n`);
  fs.writeFileSync(path.join(capsule, 'content.json'), JSON.stringify({ version: 1, root: { type: 'machine-relative', path: contentRoot } }));
}
const scriptDir = path.join(machineRoot, 'System', 'Views', '001-issues-viewer', 'scripts');
fs.mkdirSync(scriptDir, { recursive: true });
fs.writeFileSync(path.join(scriptDir, 'create-ticket.js'), "module.exports = () => null;\n");
fs.mkdirSync(path.join(machineRoot, 'Agents'), { recursive: true });
fs.writeFileSync(path.join(machineRoot, 'Agents', 'registry.json'), JSON.stringify({ agents: {} }));
const readiness = req('./lib/views/readiness-runtime');
const { ViewRelocationError } = req('./lib/views/relocation-errors');
let readinessRequests = 0;
let leaseRequests = 0;
readiness.installViewReadinessOwner({
  ensureReady: async () => { readinessRequests++; throw new ViewRelocationError('view_registry_unavailable'); },
  acquireLease: () => { leaseRequests++; throw new ViewRelocationError('view_registry_unavailable'); },
  getStatus: () => ({ status: 'unavailable', verified: false }),
});
const effects = [];
const modules = {
  './watcher/actions': { createActionHandlers: () => ({}) },
  './triggers/hold-registry': { createHoldRegistry: () => ({}) },
  './triggers/trigger-loader': { loadTriggers: () => { effects.push('event-trigger-registration'); return { cronTriggers: [] }; } },
  './triggers/cron-scheduler': { createCronScheduler: () => { throw new Error('unused'); } },
  './watcher/filter-loader': { evaluateCondition: () => true },
  './runner': { checkHeartbeats: () => { effects.push('runner-heartbeat-start'); } },
};
const fn = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === '_startPipeline');
const context = {
  fs, path, views: req('./lib/views'), global: {}, getDb: () => ({}),
  loadComponents: () => { effects.push('component-load'); }, getModalDefinition: () => null,
  console: { log() {}, warn() {}, error() {} },
  require(id) {
    if (Object.hasOwn(modules, id)) return modules[id];
    if (path.isAbsolute(id) && id.startsWith(fixture + path.sep)) { effects.push('workspace-script-load'); return req(id); }
    throw new Error(`Unexpected dependency ${id}`);
  },
};
vm.createContext(context);
vm.runInContext(startupSource.slice(fn.start, fn.end) + '\nthis.pipeline = _startPipeline;', context);
(async () => {
  let oldFactoryCalls = 0;
  const oldResult = await req('./lib/views/readiness-startup').startWorkspacePipelineWhenReady({
    sessions: new Map(), getProjectRoot: () => fixture, getWorkspaceId: () => 'audit-fixture',
    startPipeline: () => { oldFactoryCalls++; }, warn() {},
  });
  const countsBeforeDirect = { readinessRequests, leaseRequests };
  // Invoke the exact current factory separately so defect 1 cannot mask defect 2.
  context.pipeline({ sessions: new Map(), projectRoot: fixture });
  const readinessCheck = {
    mode: 'current-production-factory-extracted-with-benign-effect-stubs-and-real-view-resolver',
    status: readiness.getViewReadinessStatus({ projectRoot: fixture, workspaceId: 'audit-fixture' }),
    oldResult, oldFactoryCalls, countsBeforeDirect,
    newFactory: { effects, readinessRequestsAdded: readinessRequests - countsBeforeDirect.readinessRequests, leaseRequestsAdded: leaseRequests - countsBeforeDirect.leaseRequests },
  };
  const result = { evidenceRoot: probeOutput, nameCheck, readinessCheck };
  fs.writeFileSync(path.join(probeOutput, 'startup-contract-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
