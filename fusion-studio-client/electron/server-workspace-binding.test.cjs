'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  parseServerWorkspaceBinding,
  createServerWorkspaceBindingParser,
  createServerWorkspaceBindingAuthority,
} = require('./server-workspace-binding.cjs');
const { createViewCapsuleRegistryOwner } = require('./view-capsule-registry.cjs');
const {
  createProtocolRequestHandler,
  setWorkspaceRoot,
  getWorkspaceRoot,
} = require('./protocol-handler.cjs');
const { registerScreenshotHandlers } = require('./ipc/screenshot-handlers.cjs');

function createWorkspace(viewId = 'custom-view') {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-server-binding-')));
  const capsule = path.resolve(root, 'ai/Test-Machine/System/Views/001-custom-view');
  fs.mkdirSync(path.join(capsule, 'app'), { recursive: true });
  fs.writeFileSync(path.join(capsule, 'manifest.md'), `---\nmetadata:\n  view-id: ${viewId}\n---\n`);
  fs.writeFileSync(path.join(capsule, 'app', 'index.html'), root);
  return root;
}

test('private server binding parser accepts only exact bounded chunked frames', () => {
  const bindings = [];
  const errors = [];
  const parser = createServerWorkspaceBindingParser({
    onBinding: (binding) => bindings.push(binding),
    onError: (error) => errors.push(error.message),
  });
  const frame = Buffer.from(`${JSON.stringify({
    version: 1, bindingRevision: 1, workspaceId: 'workspace-one', repoPath: '/private/tmp/workspace-one',
  })}\n${JSON.stringify({ version: 1, bindingRevision: 2, workspaceId: null, repoPath: null })}\n`);
  parser.push(frame.subarray(0, 13));
  parser.push(frame.subarray(13));
  parser.end();
  assert.deepEqual(bindings, [
    { bindingRevision: 1, workspaceId: 'workspace-one', repoPath: '/private/tmp/workspace-one' },
    { bindingRevision: 2, workspaceId: null, repoPath: null },
  ]);
  assert.deepEqual(errors, []);

  for (const value of [
    { version: 1, bindingRevision: 1, workspaceId: 'workspace', repoPath: 'relative' },
    { version: 1, bindingRevision: 1, workspaceId: null, repoPath: '/private/tmp/forged' },
    { version: 1, bindingRevision: 1, workspaceId: 'workspace', repoPath: '/tmp/root', extra: true },
    { version: 1, bindingRevision: 0, workspaceId: 'workspace', repoPath: '/tmp/root' },
  ]) assert.equal(parseServerWorkspaceBinding(value), null);
});

test('private server binding parser rejects oversized tails and invalid UTF-8 before publication', () => {
  const valid = Buffer.from(`${JSON.stringify({
    version: 1, bindingRevision: 1, workspaceId: 'workspace-one', repoPath: '/private/tmp/workspace-one',
  })}\n`);
  for (const suffix of [
    Buffer.alloc(8193, 0x61),
    Buffer.concat([
      Buffer.from('{"version":1,"workspaceId":"w'),
      Buffer.from([0x80]),
      Buffer.from('","repoPath":"/private/tmp/workspace-one"}\n'),
    ]),
  ]) {
    const bindings = [];
    const errors = [];
    const parser = createServerWorkspaceBindingParser({
      onBinding: (binding) => bindings.push(binding),
      onError: (error) => errors.push(error.message),
    });
    parser.push(Buffer.concat([valid, suffix]));
    assert.deepEqual(bindings, []);
    assert.deepEqual(errors, ['server_workspace_binding_invalid']);
  }
});

test('renderer correlation cannot select a root outside the server-owned active binding', async (t) => {
  const firstRoot = createWorkspace();
  const secondRoot = createWorkspace();
  t.after(() => {
    setWorkspaceRoot(null);
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });
  const generation = 'generation-authoritative';
  let runtimeGeneration = null;
  let expectedGeneration = generation;
  const registry = createViewCapsuleRegistryOwner({ getRuntimeGeneration: () => runtimeGeneration });
  const authority = createServerWorkspaceBindingAuthority({
    getRuntimeGeneration: () => runtimeGeneration,
    getExpectedGeneration: () => expectedGeneration,
    installBinding: (binding, currentGeneration) => registry.setWorkspaceBinding(binding, currentGeneration),
    revokeBinding: (currentGeneration) => registry.clearWorkspaceBindingForGeneration(currentGeneration),
    getInstalledBinding: () => registry.getWorkspaceBinding(),
    setWorkspaceRoot,
    correlationTimeoutMs: 20,
  });

  assert.equal(authority.accept({ bindingRevision: 1, workspaceId: 'workspace-one', repoPath: firstRoot }, generation), true);
  runtimeGeneration = generation;
  assert.equal(await authority.activate(generation), true);
  assert.equal(await authority.correlate('workspace-one', 1, generation), true);
  assert.equal(getWorkspaceRoot(), firstRoot);
  assert.equal(await authority.correlate('fabricated-workspace', 999, generation), false);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(registry.getWorkspaceBinding(), null);

  assert.equal(authority.accept({ bindingRevision: 2, workspaceId: 'workspace-two', repoPath: secondRoot }, generation), true);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(await authority.correlate('workspace-two', 2, generation), true);
  assert.equal(getWorkspaceRoot(), secondRoot);
  assert.equal(await authority.correlate('workspace-one', 1, generation), false);
  assert.equal(getWorkspaceRoot(), secondRoot);
  assert.deepEqual(registry.getWorkspaceBinding(), {
    workspaceId: 'workspace-two', repoPath: secondRoot,
  });

  expectedGeneration = 'generation-next';
  authority.retire();
  registry.retire();
  runtimeGeneration = 'generation-next';
  assert.equal(await authority.correlate('workspace-two', 2, generation), false);
  assert.equal(getWorkspaceRoot(), null);
});

test('superseded server binding cannot clear a newer capsule and screenshot authority', async (t) => {
  const firstRoot = createWorkspace();
  const secondRoot = createWorkspace();
  const screenshotPath = path.join(
    secondRoot, 'ai', 'Test-Machine', 'Data', 'Screenshots', 'workspace-next.png',
  );
  const previousMachine = process.env.FUSION_LOCAL_MACHINE;
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

  let announceFirst;
  let releaseFirst;
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
  const generation = 'generation-authoritative';
  const registry = createViewCapsuleRegistryOwner({
    getRuntimeGeneration: () => generation,
    fs: delayedFs,
  });
  const authority = createServerWorkspaceBindingAuthority({
    getRuntimeGeneration: () => generation,
    getExpectedGeneration: () => generation,
    installBinding: (binding, currentGeneration) => registry.setWorkspaceBinding(binding, currentGeneration),
    revokeBinding: (currentGeneration) => registry.clearWorkspaceBindingForGeneration(currentGeneration),
    getInstalledBinding: () => registry.getWorkspaceBinding(),
    setWorkspaceRoot,
  });
  const screenshotHandlers = new Map();
  registerScreenshotHandlers({
    handle(channel, handler) { screenshotHandlers.set(channel, handler); },
  });

  assert.equal(authority.accept({ bindingRevision: 1, workspaceId: 'workspace-old', repoPath: firstRoot }, generation), true);
  const staleCorrelation = authority.correlate('workspace-old', 1, generation);
  await firstStarted;
  assert.equal(authority.accept({ bindingRevision: 2, workspaceId: 'workspace-next', repoPath: secondRoot }, generation), true);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(await authority.correlate('workspace-next', 2, generation), true);
  assert.equal(getWorkspaceRoot(), secondRoot);
  assert.equal(await registry.replace({
    version: 1,
    workspaceId: 'workspace-next',
    machineIdentity: 'Test-Machine',
    entries: [{ viewId: 'custom-view', folderName: '001-custom-view' }],
  }, generation), true);
  const winningRegistry = registry.getCurrent();
  assert.equal(winningRegistry.workspaceRoot, secondRoot);
  assert.deepEqual(await screenshotHandlers.get('screenshots:list')(), [{
    name: 'workspace-next.png', path: screenshotPath,
  }]);

  releaseFirst();
  assert.equal(await staleCorrelation, false);
  assert.equal(getWorkspaceRoot(), secondRoot);
  assert.equal(registry.getCurrent(), winningRegistry);
  assert.deepEqual(registry.getWorkspaceBinding(), {
    workspaceId: 'workspace-next', repoPath: secondRoot,
  });
  assert.deepEqual(await screenshotHandlers.get('screenshots:list')(), [{
    name: 'workspace-next.png', path: screenshotPath,
  }]);
});

test('renderer-first correlation immediately revokes old authority and waits for exact server binding', async (t) => {
  const firstRoot = createWorkspace('first-view');
  const secondRoot = createWorkspace('second-view');
  t.after(() => {
    setWorkspaceRoot(null);
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });
  const generation = 'generation-reversed-order';
  const registry = createViewCapsuleRegistryOwner({ getRuntimeGeneration: () => generation });
  const authority = createServerWorkspaceBindingAuthority({
    getRuntimeGeneration: () => generation,
    getExpectedGeneration: () => generation,
    installBinding: (binding, currentGeneration) => registry.setWorkspaceBinding(binding, currentGeneration),
    revokeBinding: (currentGeneration) => registry.clearWorkspaceBindingForGeneration(currentGeneration),
    getInstalledBinding: () => registry.getWorkspaceBinding(),
    setWorkspaceRoot,
    correlationTimeoutMs: 100,
  });
  const protocol = createProtocolRequestHandler({
    getViewCapsuleRegistry: () => registry.getCurrent(),
    fetch: async () => new Response('ok', { status: 200 }),
  });

  authority.accept({ bindingRevision: 1, workspaceId: 'workspace-a', repoPath: firstRoot }, generation);
  assert.equal(await authority.correlate('workspace-a', 1, generation), true);
  assert.equal(await registry.replace({
    version: 1,
    workspaceId: 'workspace-a',
    machineIdentity: 'Test-Machine',
    entries: [{ viewId: 'first-view', folderName: '001-custom-view' }],
  }, generation), true);
  assert.equal((await protocol({ url: 'fusion-studio://first-view/app/index.html' })).status, 200);

  const correlation = authority.correlate('workspace-b', 2, generation);
  let correlationSettled = false;
  void correlation.then(() => { correlationSettled = true; });
  await Promise.resolve();
  assert.equal(correlationSettled, false);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(registry.getWorkspaceBinding(), null);
  assert.equal(registry.getCurrent(), null);
  assert.equal((await protocol({ url: 'fusion-studio://first-view/app/index.html' })).status, 503);

  assert.equal(authority.accept({ bindingRevision: 2, workspaceId: 'workspace-b', repoPath: secondRoot }, generation), true);
  assert.equal(await correlation, true);
  assert.equal(getWorkspaceRoot(), secondRoot);
  assert.deepEqual(registry.getWorkspaceBinding(), { workspaceId: 'workspace-b', repoPath: secondRoot });
  assert.equal(await registry.replace({
    version: 1,
    workspaceId: 'workspace-b',
    machineIdentity: 'Test-Machine',
    entries: [{ viewId: 'second-view', folderName: '001-custom-view' }],
  }, generation), true);
  assert.equal((await protocol({ url: 'fusion-studio://second-view/app/index.html' })).status, 200);
});

test('pending correlations are bounded, coalesced, superseded, and retired without renderer grants', async (t) => {
  const firstRoot = createWorkspace();
  const secondRoot = createWorkspace();
  t.after(() => {
    setWorkspaceRoot(null);
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });
  let generation = 'generation-pending';
  let expectedGeneration = generation;
  const registry = createViewCapsuleRegistryOwner({ getRuntimeGeneration: () => generation });
  const authority = createServerWorkspaceBindingAuthority({
    getRuntimeGeneration: () => generation,
    getExpectedGeneration: () => expectedGeneration,
    installBinding: (binding, currentGeneration) => registry.setWorkspaceBinding(binding, currentGeneration),
    revokeBinding: (currentGeneration) => registry.clearWorkspaceBindingForGeneration(currentGeneration),
    getInstalledBinding: () => registry.getWorkspaceBinding(),
    setWorkspaceRoot,
    correlationTimeoutMs: 20,
  });

  authority.accept({ bindingRevision: 1, workspaceId: 'workspace-a', repoPath: firstRoot }, generation);
  assert.equal(await authority.correlate('workspace-a', 1, generation), true);
  const fabricated = authority.correlate('fabricated-workspace', 99, generation);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(await fabricated, false);
  assert.equal(registry.getWorkspaceBinding(), null);

  authority.accept({ bindingRevision: 2, workspaceId: 'workspace-a', repoPath: firstRoot }, generation);
  assert.equal(await authority.correlate('workspace-a', 2, generation), true);

  const firstB = authority.correlate('workspace-b', 3, generation);
  const secondB = authority.correlate('workspace-b', 3, generation);
  authority.accept({ bindingRevision: 3, workspaceId: 'workspace-b', repoPath: secondRoot }, generation);
  assert.equal(await firstB, true);
  assert.equal(await secondB, true);
  assert.deepEqual(registry.getWorkspaceBinding(), { workspaceId: 'workspace-b', repoPath: secondRoot });

  const returnToA = authority.correlate('workspace-a', 4, generation);
  authority.accept({ bindingRevision: 4, workspaceId: 'workspace-a', repoPath: firstRoot }, generation);
  assert.equal(await returnToA, true);
  assert.deepEqual(registry.getWorkspaceBinding(), { workspaceId: 'workspace-a', repoPath: firstRoot });

  const differentLaterBinding = authority.correlate('workspace-b', 5, generation);
  authority.accept({ bindingRevision: 6, workspaceId: 'workspace-a', repoPath: firstRoot }, generation);
  assert.equal(await differentLaterBinding, false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(registry.getWorkspaceBinding(), null);
  assert.equal(await authority.correlate('workspace-a', 6, generation), true);

  const retired = authority.correlate('workspace-b', 7, generation);
  authority.retire();
  assert.equal(await retired, false);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(registry.getWorkspaceBinding(), null);

  const oldGeneration = generation;
  expectedGeneration = 'generation-next';
  generation = 'generation-next';
  assert.equal(await authority.correlate('workspace-a', 6, oldGeneration), false);
});

test('malformed private binding stream retires pending correlation and all workspace authority', async (t) => {
  const root = createWorkspace();
  t.after(() => {
    setWorkspaceRoot(null);
    fs.rmSync(root, { recursive: true, force: true });
  });
  const generation = 'generation-malformed';
  const registry = createViewCapsuleRegistryOwner({ getRuntimeGeneration: () => generation });
  const authority = createServerWorkspaceBindingAuthority({
    getRuntimeGeneration: () => generation,
    getExpectedGeneration: () => generation,
    installBinding: (binding, currentGeneration) => registry.setWorkspaceBinding(binding, currentGeneration),
    revokeBinding: (currentGeneration) => registry.clearWorkspaceBindingForGeneration(currentGeneration),
    getInstalledBinding: () => registry.getWorkspaceBinding(),
    setWorkspaceRoot,
    correlationTimeoutMs: 100,
  });
  authority.accept({ bindingRevision: 1, workspaceId: 'workspace-a', repoPath: root }, generation);
  assert.equal(await authority.correlate('workspace-a', 1, generation), true);
  const pending = authority.correlate('workspace-b', 2, generation);
  const parser = createServerWorkspaceBindingParser({
    onBinding: (binding) => authority.accept(binding, generation),
    onError: () => {
      registry.retire();
      authority.retire();
    },
  });

  parser.push(Buffer.from('{"version":1,"workspaceId":"workspace-b","repoPath":'));
  parser.end();

  assert.equal(await pending, false);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(registry.getWorkspaceBinding(), null);
  assert.equal(registry.getCurrent(), null);
});

test('correlation timeout fences delayed exact binding installation until a fresh correlation', async (t) => {
  const root = createWorkspace();
  t.after(() => {
    setWorkspaceRoot(null);
    fs.rmSync(root, { recursive: true, force: true });
  });
  let announceVerification;
  let releaseVerification;
  const verificationStarted = new Promise((resolve) => { announceVerification = resolve; });
  const verificationReleased = new Promise((resolve) => { releaseVerification = resolve; });
  let delayRoot = true;
  const asyncFs = fs.promises;
  const delayedFs = {
    lstat: (...args) => asyncFs.lstat(...args),
    readFile: (...args) => asyncFs.readFile(...args),
    realpath: async (candidate) => {
      if (delayRoot && path.resolve(candidate) === root) {
        announceVerification();
        await verificationReleased;
      }
      return asyncFs.realpath(candidate);
    },
  };
  const generation = 'generation-timeout';
  const registry = createViewCapsuleRegistryOwner({
    getRuntimeGeneration: () => generation,
    fs: delayedFs,
  });
  const authority = createServerWorkspaceBindingAuthority({
    getRuntimeGeneration: () => generation,
    getExpectedGeneration: () => generation,
    installBinding: (binding, currentGeneration) => registry.setWorkspaceBinding(binding, currentGeneration),
    revokeBinding: (currentGeneration) => registry.clearWorkspaceBindingForGeneration(currentGeneration),
    getInstalledBinding: () => registry.getWorkspaceBinding(),
    setWorkspaceRoot,
    correlationTimeoutMs: 20,
  });

  const correlation = authority.correlate('workspace-b', 1, generation);
  authority.accept({ bindingRevision: 1, workspaceId: 'workspace-b', repoPath: root }, generation);
  await verificationStarted;
  assert.equal(await correlation, false);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(registry.getWorkspaceBinding(), null);

  delayRoot = false;
  releaseVerification();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(registry.getWorkspaceBinding(), null);

  assert.equal(await authority.correlate('workspace-b', 1, generation), true);
  assert.equal(getWorkspaceRoot(), root);
  assert.deepEqual(registry.getWorkspaceBinding(), { workspaceId: 'workspace-b', repoPath: root });
});

test('binding revision prevents cross-channel ABA from matching the wrong same-id transition', async (t) => {
  const firstRoot = createWorkspace('first-a-view');
  const secondRoot = createWorkspace('second-a-view');
  t.after(() => {
    setWorkspaceRoot(null);
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });
  const generation = 'generation-aba';
  const registry = createViewCapsuleRegistryOwner({ getRuntimeGeneration: () => generation });
  const authority = createServerWorkspaceBindingAuthority({
    getRuntimeGeneration: () => generation,
    getExpectedGeneration: () => generation,
    installBinding: (binding, currentGeneration) => registry.setWorkspaceBinding(binding, currentGeneration),
    revokeBinding: (currentGeneration) => registry.clearWorkspaceBindingForGeneration(currentGeneration),
    getInstalledBinding: () => registry.getWorkspaceBinding(),
    setWorkspaceRoot,
    correlationTimeoutMs: 20,
  });

  assert.equal(authority.accept({ bindingRevision: 1, workspaceId: 'workspace-a', repoPath: firstRoot }, generation), true);
  assert.equal(authority.accept({ bindingRevision: 2, workspaceId: 'workspace-b', repoPath: secondRoot }, generation), true);
  assert.equal(authority.accept({ bindingRevision: 3, workspaceId: 'workspace-a', repoPath: secondRoot }, generation), true);

  assert.equal(await authority.correlate('workspace-a', 1, generation), false);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(await authority.correlate('workspace-b', 2, generation), false);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(await authority.correlate('workspace-a', 3, generation), true);
  assert.equal(getWorkspaceRoot(), secondRoot);
  assert.equal(await registry.replace({
    version: 1,
    workspaceId: 'workspace-a',
    machineIdentity: 'Test-Machine',
    entries: [{ viewId: 'second-a-view', folderName: '001-custom-view' }],
  }, generation), true);
  const protocol = createProtocolRequestHandler({
    getViewCapsuleRegistry: () => registry.getCurrent(),
    fetch: async () => new Response('ok', { status: 200 }),
  });
  const winningRegistry = registry.getCurrent();
  assert.equal((await protocol({ url: 'fusion-studio://second-a-view/app/index.html' })).status, 200);
  assert.equal(await authority.correlate('workspace-b', 2, generation), false);
  assert.equal(getWorkspaceRoot(), secondRoot);
  assert.equal(registry.getCurrent(), winningRegistry);
  assert.equal((await protocol({ url: 'fusion-studio://second-a-view/app/index.html' })).status, 200);
  assert.deepEqual(authority.getCurrent(), {
    bindingRevision: 3,
    workspaceId: 'workspace-a',
    repoPath: secondRoot,
    runtimeGeneration: generation,
  });
  assert.equal(authority.accept({ bindingRevision: 4, workspaceId: 'workspace-a', repoPath: firstRoot }, generation), true);
  assert.equal(await authority.correlate('workspace-a', 4, generation), true);
  assert.equal(getWorkspaceRoot(), firstRoot);
});

test('latest renderer ABA correlation survives older ordered fd4 bindings and accepts only its exact revision', async (t) => {
  const firstRoot = createWorkspace('first-a-view');
  const secondRoot = createWorkspace('second-a-view');
  t.after(() => {
    setWorkspaceRoot(null);
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });
  const generation = 'generation-renderer-first-aba';
  const registry = createViewCapsuleRegistryOwner({ getRuntimeGeneration: () => generation });
  const authority = createServerWorkspaceBindingAuthority({
    getRuntimeGeneration: () => generation,
    getExpectedGeneration: () => generation,
    installBinding: (binding, currentGeneration) => registry.setWorkspaceBinding(binding, currentGeneration),
    revokeBinding: (currentGeneration) => registry.clearWorkspaceBindingForGeneration(currentGeneration),
    getInstalledBinding: () => registry.getWorkspaceBinding(),
    setWorkspaceRoot,
    correlationTimeoutMs: 100,
  });

  const firstA = authority.correlate('workspace-a', 1, generation);
  const workspaceB = authority.correlate('workspace-b', 2, generation);
  const latestA = authority.correlate('workspace-a', 3, generation);
  assert.equal(await firstA, false);
  assert.equal(await workspaceB, false);

  assert.equal(authority.accept({ bindingRevision: 1, workspaceId: 'workspace-a', repoPath: firstRoot }, generation), true);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(authority.accept({ bindingRevision: 2, workspaceId: 'workspace-b', repoPath: secondRoot }, generation), true);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(authority.accept({ bindingRevision: 3, workspaceId: 'workspace-a', repoPath: secondRoot }, generation), true);
  assert.equal(await latestA, true);
  assert.equal(getWorkspaceRoot(), secondRoot);
  assert.equal(authority.accept({ bindingRevision: 2, workspaceId: 'workspace-b', repoPath: firstRoot }, generation), false);
  assert.equal(getWorkspaceRoot(), secondRoot);
});

test('exact revision null binding acknowledges a server-owned no-workspace clear', async () => {
  const generation = 'generation-null';
  const registry = createViewCapsuleRegistryOwner({ getRuntimeGeneration: () => generation });
  const authority = createServerWorkspaceBindingAuthority({
    getRuntimeGeneration: () => generation,
    getExpectedGeneration: () => generation,
    installBinding: (binding, currentGeneration) => registry.setWorkspaceBinding(binding, currentGeneration),
    revokeBinding: (currentGeneration) => registry.clearWorkspaceBindingForGeneration(currentGeneration),
    getInstalledBinding: () => registry.getWorkspaceBinding(),
    setWorkspaceRoot,
    correlationTimeoutMs: 20,
  });

  assert.equal(authority.accept({ bindingRevision: 1, workspaceId: null, repoPath: null }, generation), true);
  assert.equal(await authority.correlate(null, 1, generation), true);
  assert.equal(getWorkspaceRoot(), null);
  assert.equal(registry.getWorkspaceBinding(), null);
  assert.deepEqual(authority.getCurrent(), {
    bindingRevision: 1,
    workspaceId: null,
    repoPath: null,
    runtimeGeneration: generation,
  });
});
