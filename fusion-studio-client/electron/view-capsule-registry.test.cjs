'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  parseManifestViewId,
  parseViewCapsulesProjection,
  createViewCapsuleRegistryOwner,
  commitWorkspaceRootForBindingResult,
} = require('./view-capsule-registry.cjs');
const {
  createProtocolRequestHandler,
  setWorkspaceRoot,
  getWorkspaceRoot,
} = require('./protocol-handler.cjs');
const { registerScreenshotHandlers } = require('./ipc/screenshot-handlers.cjs');

function validProjection(overrides = {}) {
  return { version: 1, workspaceId: 'workspace-123', machineIdentity: 'Test-Machine', entries: [
    { viewId: 'capture-viewer', folderName: '001-capture-viewer' },
    { viewId: 'file-viewer', folderName: '002-file-viewer' },
  ], ...overrides };
}

function createWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-capsule-registry-'));
  for (const entry of validProjection().entries) {
    const capsule = path.join(root, 'ai', 'Test-Machine', 'System', 'Views', entry.folderName);
    fs.mkdirSync(capsule, { recursive: true });
    fs.writeFileSync(path.join(capsule, 'manifest.md'), `---\nname: Test\nmetadata:\n  view-id: ${entry.viewId}\n---\n`);
  }
  return fs.realpathSync(root);
}

test('projection parser accepts only a bounded path-free exact record', () => {
  const parsed = parseViewCapsulesProjection(validProjection());
  assert.deepEqual(parsed, validProjection());
  const invalid = [
    { ...validProjection(), root: '/forged' }, validProjection({ machineIdentity: '..' }),
    validProjection({ entries: [{ viewId: 'Capture-Viewer', folderName: '001-capture-viewer' }] }),
    validProjection({ entries: [{ viewId: 'capture-viewer', folderName: '../capture-viewer' }] }),
    validProjection({ entries: [{ viewId: 'capture-viewer', folderName: 'one' }, { viewId: 'capture-viewer', folderName: 'two' }] }),
    validProjection({ entries: [{ viewId: 'capture-viewer', folderName: 'same' }, { viewId: 'file-viewer', folderName: 'same' }] }),
    validProjection({ entries: Array.from({ length: 257 }, (_, index) => ({ viewId: `view-${index}`, folderName: `${index}-view` })) }),
  ];
  for (const value of invalid) assert.equal(parseViewCapsulesProjection(value), null);
});

test('manifest identity must be the one direct metadata.view-id scalar', () => {
  assert.equal(parseManifestViewId('---\nmetadata:\n  view-id: capture-viewer\n---\n'), 'capture-viewer');
  assert.equal(parseManifestViewId('---\nmetadata:\n  view-id: "capture-viewer"\n---\n'), 'capture-viewer');
  assert.equal(parseManifestViewId("---\nmetadata:\n  view-id: 'capture-viewer'\n---\n"), 'capture-viewer');
  assert.equal(parseManifestViewId('---\nmetadata:\n  view-id: "0x10"\n---\n'), '0x10');
  for (const source of [
    '---\nmetadata:\n  nested:\n    view-id: capture-viewer\n---\n',
    '---\nmetadata:\n  view-id: capture-viewer\n  view-id: file-viewer\n---\n',
    '---\nmetadata:\n  view-id: Capture-Viewer\n---\n',
    '---\nmetadata:\n  view-id: 0x10\n---\n',
    'metadata:\n  view-id: capture-viewer\n',
  ]) assert.equal(parseManifestViewId(source), null);
});

test('quoted canonical manifest identity installs and remains protocol-authoritative', async (t) => {
  const root = createWorkspace();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifestPath = path.join(
    root, 'ai', 'Test-Machine', 'System', 'Views', '001-capture-viewer', 'manifest.md',
  );
  fs.writeFileSync(manifestPath, '---\nmetadata:\n  view-id: "capture-viewer"\n---\n');
  const appPath = path.join(path.dirname(manifestPath), 'app', 'index.html');
  fs.mkdirSync(path.dirname(appPath), { recursive: true });
  fs.writeFileSync(appPath, 'quoted-ok');
  const owner = createViewCapsuleRegistryOwner({ getRuntimeGeneration: () => 'generation-1' });
  await owner.setWorkspaceBinding({ workspaceId: 'workspace-123', repoPath: root }, 'generation-1');
  assert.equal(await owner.replace(validProjection(), 'generation-1'), true);
  assert.equal(owner.getCurrent().capsules.has('capture-viewer'), true);
  const handler = createProtocolRequestHandler({
    getViewCapsuleRegistry: () => owner.getCurrent(),
    fetch: async () => new Response('quoted-ok', { status: 200 }),
  });
  assert.equal((await handler({ url: 'fusion-studio://capture-viewer/app/index.html' })).status, 200);
});

test('owner independently verifies canonical filesystem bytes before atomic install', async (t) => {
  const root = createWorkspace();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let generation = 'generation-1';
  const owner = createViewCapsuleRegistryOwner({ getRuntimeGeneration: () => generation });
  assert.deepEqual(await owner.setWorkspaceBinding({ workspaceId: 'workspace-123', repoPath: root }, generation), {
    workspaceId: 'workspace-123', repoPath: root,
  });
  assert.equal(await owner.replace(validProjection(), generation), true);
  assert.equal(owner.getCurrent().capsules.get('capture-viewer'), path.join(root, 'ai', 'Test-Machine', 'System', 'Views', '001-capture-viewer'));

  assert.equal(await owner.replace(validProjection({ workspaceId: 'forged' }), generation), false);
  assert.equal(owner.getCurrent(), null);
  assert.equal(await owner.replace(validProjection(), generation), true);
  generation = 'generation-2';
  assert.equal(owner.getCurrent(), null);
});

test('mismatch, symlink, workspace switch, and malformed binding clear all authority', async (t) => {
  const root = createWorkspace();
  const other = createWorkspace();
  t.after(() => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(other, { recursive: true, force: true }); });
  const owner = createViewCapsuleRegistryOwner({ getRuntimeGeneration: () => 'generation-1' });
  await owner.setWorkspaceBinding({ workspaceId: 'workspace-123', repoPath: root }, 'generation-1');
  assert.equal(await owner.replace(validProjection(), 'generation-1'), true);
  await owner.setWorkspaceBinding({ workspaceId: 'workspace-next', repoPath: other }, 'generation-1');
  assert.equal(owner.getCurrent(), null);
  assert.equal(await owner.replace(validProjection(), 'generation-1'), false);
  assert.equal(await owner.setWorkspaceBinding(
    { workspaceId: 'workspace-123', repoPath: 'relative' }, 'generation-1',
  ), null);

  await owner.setWorkspaceBinding({ workspaceId: 'workspace-123', repoPath: root }, 'generation-1');
  fs.writeFileSync(path.join(root, 'ai', 'Test-Machine', 'System', 'Views', '001-capture-viewer', 'manifest.md'), '---\nmetadata:\n  view-id: forged\n---\n');
  assert.equal(await owner.replace(validProjection(), 'generation-1'), false);
  assert.equal(owner.getCurrent(), null);
});

test('runtime retirement rejects delayed old-generation installs before and after verification', async (t) => {
  const root = createWorkspace();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let generation = 'generation-old';
  let delayed = false;
  let announceRead;
  let releaseRead;
  const readStarted = new Promise((resolve) => { announceRead = resolve; });
  const readReleased = new Promise((resolve) => { releaseRead = resolve; });
  const asyncFs = fs.promises;
  const delayedFs = {
    realpath: (...args) => asyncFs.realpath(...args),
    lstat: (...args) => asyncFs.lstat(...args),
    readFile: async (...args) => {
      if (!delayed && String(args[0]).endsWith(`${path.sep}manifest.md`)) {
        delayed = true;
        announceRead();
        await readReleased;
      }
      return asyncFs.readFile(...args);
    },
  };
  const owner = createViewCapsuleRegistryOwner({
    getRuntimeGeneration: () => generation,
    fs: delayedFs,
  });
  const handler = createProtocolRequestHandler({
    getViewCapsuleRegistry: () => owner.getCurrent(),
    fetch: async () => new Response('fresh', { status: 200 }),
  });

  await owner.setWorkspaceBinding({ workspaceId: 'workspace-123', repoPath: root }, generation);
  const staleInstall = owner.replace(validProjection(), generation);
  await readStarted;
  owner.retire();
  generation = 'generation-new';
  assert.equal((await handler({ url: 'fusion-studio://capture-viewer/app/index.html' })).status, 503);
  await owner.setWorkspaceBinding({ workspaceId: 'workspace-123', repoPath: root }, generation);
  releaseRead();
  assert.equal(await staleInstall, false);
  assert.equal(owner.getCurrent(), null);
  assert.equal(await owner.replace(validProjection(), 'generation-old'), false);
  assert.equal(owner.getCurrent(), null);
  assert.equal((await handler({ url: 'fusion-studio://capture-viewer/app/index.html' })).status, 503);

  assert.equal(await owner.replace(validProjection(), generation), true);
  const fresh = owner.getCurrent();
  assert.equal(fresh.runtimeGeneration, generation);
  assert.equal(await owner.replace(validProjection(), 'generation-old'), false);
  assert.equal(owner.getCurrent(), fresh);
});

test('same-generation clear invalidates an in-flight replacement and stays closed', async (t) => {
  const root = createWorkspace();
  const appPath = path.join(
    root, 'ai', 'Test-Machine', 'System', 'Views', '001-capture-viewer', 'app', 'index.html',
  );
  fs.mkdirSync(path.dirname(appPath), { recursive: true });
  fs.writeFileSync(appPath, 'authorized');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const generation = 'generation-one';
  let delayed = false;
  let announceRead;
  let releaseRead;
  const readStarted = new Promise((resolve) => { announceRead = resolve; });
  const readReleased = new Promise((resolve) => { releaseRead = resolve; });
  const asyncFs = fs.promises;
  const delayedFs = {
    realpath: (...args) => asyncFs.realpath(...args),
    lstat: (...args) => asyncFs.lstat(...args),
    readFile: async (...args) => {
      if (!delayed && String(args[0]).endsWith(`${path.sep}manifest.md`)) {
        delayed = true;
        announceRead();
        await readReleased;
      }
      return asyncFs.readFile(...args);
    },
  };
  const owner = createViewCapsuleRegistryOwner({
    getRuntimeGeneration: () => generation,
    fs: delayedFs,
  });
  const handler = createProtocolRequestHandler({
    getViewCapsuleRegistry: () => owner.getCurrent(),
    fetch: async () => new Response('authorized', { status: 200 }),
  });
  await owner.setWorkspaceBinding({ workspaceId: 'workspace-123', repoPath: root }, generation);

  const delayedReplace = owner.replace(validProjection(), generation);
  await readStarted;
  assert.equal(owner.clearForGeneration(generation), true);
  assert.equal(owner.getCurrent(), null);
  assert.equal((await handler({ url: 'fusion-studio://capture-viewer/app/index.html' })).status, 503);
  releaseRead();
  assert.equal(await delayedReplace, false);
  assert.equal(owner.getCurrent(), null);
  assert.equal((await handler({ url: 'fusion-studio://capture-viewer/app/index.html' })).status, 503);

  assert.equal(await owner.replace(validProjection(), generation), true);
  const fresh = owner.getCurrent();
  assert.equal(owner.clearForGeneration('generation-stale'), false);
  assert.equal(owner.getCurrent(), fresh);
  assert.equal((await handler({ url: 'fusion-studio://capture-viewer/app/index.html' })).status, 200);
});

test('same-generation workspace binding clears before delayed prior verification completes', async (t) => {
  const firstRoot = createWorkspace();
  const secondRoot = createWorkspace();
  const secondApp = path.join(
    secondRoot, 'ai', 'Test-Machine', 'System', 'Views',
    '001-capture-viewer', 'app', 'index.html',
  );
  fs.mkdirSync(path.dirname(secondApp), { recursive: true });
  fs.writeFileSync(secondApp, 'workspace-next');
  t.after(() => {
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });
  const generation = 'generation-one';
  let shouldDelay = false;
  let delayed = false;
  let announceRead;
  let releaseRead;
  const readStarted = new Promise((resolve) => { announceRead = resolve; });
  const readReleased = new Promise((resolve) => { releaseRead = resolve; });
  const asyncFs = fs.promises;
  const delayedFs = {
    realpath: (...args) => asyncFs.realpath(...args),
    lstat: (...args) => asyncFs.lstat(...args),
    readFile: async (...args) => {
      if (shouldDelay && !delayed && String(args[0]).endsWith(`${path.sep}manifest.md`)) {
        delayed = true;
        announceRead();
        await readReleased;
      }
      return asyncFs.readFile(...args);
    },
  };
  const owner = createViewCapsuleRegistryOwner({
    getRuntimeGeneration: () => generation,
    fs: delayedFs,
  });
  const handler = createProtocolRequestHandler({
    getViewCapsuleRegistry: () => owner.getCurrent(),
    fetch: async () => new Response('authorized', { status: 200 }),
  });

  await owner.setWorkspaceBinding({ workspaceId: 'workspace-123', repoPath: firstRoot }, generation);
  assert.equal(await owner.replace(validProjection(), generation), true);
  shouldDelay = true;
  const staleRefresh = owner.replace(validProjection(), generation);
  await readStarted;
  const nextBinding = owner.setWorkspaceBinding({
    workspaceId: 'workspace-next', repoPath: secondRoot,
  }, generation);
  assert.equal((await handler({ url: 'fusion-studio://capture-viewer/app/index.html' })).status, 503);
  assert.deepEqual(await nextBinding, { workspaceId: 'workspace-next', repoPath: secondRoot });
  const nextProjection = validProjection({ workspaceId: 'workspace-next' });
  assert.equal(await owner.replace(nextProjection, generation), true);
  const fresh = owner.getCurrent();
  assert.equal(fresh.projection.workspaceId, 'workspace-next');
  assert.equal((await handler({ url: 'fusion-studio://capture-viewer/app/index.html' })).status, 200);

  releaseRead();
  assert.equal(await staleRefresh, false);
  assert.equal(owner.getCurrent(), fresh);
  assert.equal((await handler({ url: 'fusion-studio://capture-viewer/app/index.html' })).status, 200);
});

test('superseded binding completion cannot clear the winning workspace root', async (t) => {
  const firstRoot = createWorkspace();
  const secondRoot = createWorkspace();
  const previousMachine = process.env.FUSION_LOCAL_MACHINE;
  const screenshotPath = path.join(
    secondRoot, 'ai', 'Test-Machine', 'Data', 'Screenshots', 'workspace-next.png',
  );
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  fs.writeFileSync(screenshotPath, 'workspace-next');
  process.env.FUSION_LOCAL_MACHINE = 'Test-Machine';
  t.after(() => {
    setWorkspaceRoot(null);
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });
  let releaseFirst;
  let announceFirst;
  const firstStarted = new Promise((resolve) => { announceFirst = resolve; });
  const firstReleased = new Promise((resolve) => { releaseFirst = resolve; });
  const asyncFs = fs.promises;
  const delayedFs = {
    lstat: (...args) => asyncFs.lstat(...args),
    readFile: (...args) => asyncFs.readFile(...args),
    realpath: async (candidate) => {
      if (path.resolve(candidate) === firstRoot) {
        announceFirst();
        await firstReleased;
      }
      return asyncFs.realpath(candidate);
    },
  };
  const owner = createViewCapsuleRegistryOwner({
    getRuntimeGeneration: () => 'generation-one',
    fs: delayedFs,
  });
  const screenshotHandlers = new Map();
  registerScreenshotHandlers({
    handle(channel, handler) { screenshotHandlers.set(channel, handler); },
  });
  const staleBinding = owner.setWorkspaceBinding({
    workspaceId: 'workspace-old', repoPath: firstRoot,
  }, 'generation-one');
  await firstStarted;
  const acceptedBinding = await owner.setWorkspaceBinding({
    workspaceId: 'workspace-next', repoPath: secondRoot,
  }, 'generation-one');
  assert.equal(commitWorkspaceRootForBindingResult(
    acceptedBinding, owner.getWorkspaceBinding(), setWorkspaceRoot,
  ), true);
  assert.equal(getWorkspaceRoot(), secondRoot);
  assert.equal(await owner.replace(
    validProjection({ workspaceId: 'workspace-next' }), 'generation-one',
  ), true);
  const winningRegistry = owner.getCurrent();
  assert.equal(winningRegistry.workspaceRoot, secondRoot);
  assert.deepEqual(await screenshotHandlers.get('screenshots:list')(), [{
    name: 'workspace-next.png', path: screenshotPath,
  }]);

  releaseFirst();
  const staleResult = await staleBinding;
  assert.equal(staleResult, null);
  assert.equal(commitWorkspaceRootForBindingResult(
    staleResult, owner.getWorkspaceBinding(), setWorkspaceRoot,
  ), false);
  assert.equal(getWorkspaceRoot(), secondRoot);
  assert.equal(owner.getCurrent(), winningRegistry);
  assert.deepEqual(await screenshotHandlers.get('screenshots:list')(), [{
    name: 'workspace-next.png', path: screenshotPath,
  }]);
  assert.deepEqual(owner.getWorkspaceBinding(), {
    workspaceId: 'workspace-next', repoPath: secondRoot,
  });

  const cleared = await owner.setWorkspaceBinding({ workspaceId: null, repoPath: null }, 'generation-one');
  assert.equal(commitWorkspaceRootForBindingResult(
    cleared, owner.getWorkspaceBinding(), setWorkspaceRoot,
  ), false);
  assert.equal(getWorkspaceRoot(), null);
});
