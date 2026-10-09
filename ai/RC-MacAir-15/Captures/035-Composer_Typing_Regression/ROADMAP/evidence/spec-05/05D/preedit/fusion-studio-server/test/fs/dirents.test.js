'use strict';

const fs = require('fs');
const fsPromises = require('fs').promises;
const os = require('os');
const path = require('path');

const {
  classifyEntry,
  classifyEntrySync,
  isInsidePath,
} = require('../../lib/fs/dirents');
const { createCycleGuard } = require('../../lib/fs/cycle-guard');

function symlinkDir(target, linkPath) {
  fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

function symlinkFile(target, linkPath) {
  fs.symlinkSync(target, linkPath, 'file');
}

function getDirent(parentDir, name) {
  const dirent = fs.readdirSync(parentDir, { withFileTypes: true }).find((entry) => entry.name === name);
  if (!dirent) {
    throw new Error(`Missing test dirent: ${name}`);
  }
  return dirent;
}

async function getDirentAsync(parentDir, name) {
  const entries = await fsPromises.readdir(parentDir, { withFileTypes: true });
  const dirent = entries.find((entry) => entry.name === name);
  if (!dirent) {
    throw new Error(`Missing test dirent: ${name}`);
  }
  return dirent;
}

function normalizeClassification(entry) {
  return {
    name: entry.name,
    isDir: entry.isDir,
    isFile: entry.isFile,
    isSymlink: entry.isSymlink,
    realPath: entry.realPath,
  };
}

async function expectAsyncAndSyncClassification(parentDir, name, expected) {
  const asyncResult = await classifyEntry(parentDir, await getDirentAsync(parentDir, name));
  const syncResult = classifyEntrySync(parentDir, getDirent(parentDir, name));

  expect(normalizeClassification(asyncResult)).toEqual(expected);
  expect(normalizeClassification(syncResult)).toEqual(expected);
}

function makeFixture() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-dirents-'));
  const workspace = path.join(tempRoot, 'workspace');
  const externalRoot = path.join(tempRoot, 'external');
  const sharedReal = path.join(tempRoot, 'shared-real');

  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(externalRoot, { recursive: true });
  fs.mkdirSync(sharedReal, { recursive: true });

  fs.mkdirSync(path.join(workspace, 'regular-dir'));
  fs.writeFileSync(path.join(workspace, 'regular-dir', 'child.txt'), 'child\n', 'utf8');
  fs.writeFileSync(path.join(workspace, 'regular-file.txt'), 'file\n', 'utf8');

  symlinkDir(path.join(workspace, 'regular-dir'), path.join(workspace, 'linked-dir'));
  symlinkFile(path.join(workspace, 'regular-file.txt'), path.join(workspace, 'linked-file.txt'));
  symlinkFile(path.join(tempRoot, 'missing-target.txt'), path.join(workspace, 'broken-link'));
  symlinkDir(path.join(workspace, 'linked-dir'), path.join(workspace, 'link-to-link-dir'));

  const cycleRoot = path.join(workspace, 'cycle-root');
  fs.mkdirSync(cycleRoot);
  fs.writeFileSync(path.join(cycleRoot, 'cycle-file.txt'), 'cycle\n', 'utf8');
  symlinkDir(cycleRoot, path.join(cycleRoot, 'link-back'));

  fs.writeFileSync(path.join(sharedReal, 'shared.txt'), 'shared\n', 'utf8');
  const diamond = path.join(workspace, 'diamond');
  fs.mkdirSync(path.join(diamond, 'a'), { recursive: true });
  fs.mkdirSync(path.join(diamond, 'b'), { recursive: true });
  symlinkDir(sharedReal, path.join(diamond, 'a', 'shared'));
  symlinkDir(sharedReal, path.join(diamond, 'b', 'shared'));

  const externalDir = path.join(externalRoot, 'external-dir');
  fs.mkdirSync(externalDir);
  fs.writeFileSync(path.join(externalDir, 'external.txt'), 'external\n', 'utf8');
  symlinkDir(externalDir, path.join(workspace, 'external-link'));

  return {
    tempRoot,
    workspace,
    externalDir,
    sharedReal,
  };
}

function walkWithGuard(rootPath) {
  const guard = createCycleGuard();
  const entered = [];
  const skipped = [];

  function walkEntered(visiblePath, realPath) {
    entered.push({ visiblePath, realPath });

    for (const dirent of fs.readdirSync(visiblePath, { withFileTypes: true })) {
      const entry = classifyEntrySync(visiblePath, dirent);
      if (!entry.isDir) continue;

      const childPath = path.join(visiblePath, entry.name);
      const childRealPath = entry.realPath || fs.realpathSync(childPath);
      if (!guard.shouldEnter(childRealPath)) {
        skipped.push({ visiblePath: childPath, realPath: childRealPath });
        continue;
      }

      walkEntered(childPath, childRealPath);
    }
  }

  const rootRealPath = fs.realpathSync(rootPath);
  if (guard.shouldEnter(rootRealPath)) {
    walkEntered(rootPath, rootRealPath);
  }

  return { entered, skipped };
}

describe('fs dirent classification', () => {
  let fixture;

  beforeEach(() => {
    fixture = makeFixture();
  });

  afterEach(() => {
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  });

  test('classifies regular directories, regular files, and symlink targets', async () => {
    await expectAsyncAndSyncClassification(fixture.workspace, 'regular-dir', {
      name: 'regular-dir',
      isDir: true,
      isFile: false,
      isSymlink: false,
      realPath: undefined,
    });
    await expectAsyncAndSyncClassification(fixture.workspace, 'regular-file.txt', {
      name: 'regular-file.txt',
      isDir: false,
      isFile: true,
      isSymlink: false,
      realPath: undefined,
    });
    await expectAsyncAndSyncClassification(fixture.workspace, 'linked-dir', {
      name: 'linked-dir',
      isDir: true,
      isFile: false,
      isSymlink: true,
      realPath: fs.realpathSync(path.join(fixture.workspace, 'regular-dir')),
    });
    await expectAsyncAndSyncClassification(fixture.workspace, 'linked-file.txt', {
      name: 'linked-file.txt',
      isDir: false,
      isFile: true,
      isSymlink: true,
      realPath: fs.realpathSync(path.join(fixture.workspace, 'regular-file.txt')),
    });
  });

  test('returns the broken-link shape when a symlink cannot be followed', async () => {
    await expectAsyncAndSyncClassification(fixture.workspace, 'broken-link', {
      name: 'broken-link',
      isDir: false,
      isFile: false,
      isSymlink: true,
      realPath: null,
    });
  });

  test('resolves chained symlinks to the final target path', async () => {
    await expectAsyncAndSyncClassification(fixture.workspace, 'link-to-link-dir', {
      name: 'link-to-link-dir',
      isDir: true,
      isFile: false,
      isSymlink: true,
      realPath: fs.realpathSync(path.join(fixture.workspace, 'regular-dir')),
    });
  });

  test('keeps externally targeted links visible during classification', async () => {
    await expectAsyncAndSyncClassification(fixture.workspace, 'external-link', {
      name: 'external-link',
      isDir: true,
      isFile: false,
      isSymlink: true,
      realPath: fs.realpathSync(fixture.externalDir),
    });

    expect(isInsidePath(fixture.workspace, fs.realpathSync(fixture.externalDir))).toBe(false);
  });

  test('falls back to lstat when a dirent does not report a symlink', async () => {
    const fakeJunctionDirent = {
      name: 'linked-dir',
      isDirectory: () => true,
      isFile: () => false,
      isSymbolicLink: () => false,
    };

    const expected = {
      name: 'linked-dir',
      isDir: true,
      isFile: false,
      isSymlink: true,
      realPath: fs.realpathSync(path.join(fixture.workspace, 'regular-dir')),
    };

    await expect(classifyEntry(fixture.workspace, fakeJunctionDirent)).resolves.toEqual(expected);
    expect(classifyEntrySync(fixture.workspace, fakeJunctionDirent)).toEqual(expected);
  });

  test('swallows lstat errors and keeps the original dirent type', async () => {
    const missingDirent = {
      name: 'missing-but-reported-file.txt',
      isDirectory: () => false,
      isFile: () => true,
      isSymbolicLink: () => false,
    };
    const expected = {
      name: 'missing-but-reported-file.txt',
      isDir: false,
      isFile: true,
      isSymlink: false,
      realPath: undefined,
    };

    await expect(classifyEntry(fixture.workspace, missingDirent)).resolves.toEqual(expected);
    expect(classifyEntrySync(fixture.workspace, missingDirent)).toEqual(expected);
  });

  test('checks containment with path.relative rather than prefix matching', () => {
    fs.mkdirSync(path.join(fixture.workspace, '..valid-child'));

    expect(isInsidePath(fixture.workspace, fixture.workspace)).toBe(true);
    expect(isInsidePath(fixture.workspace, path.join(fixture.workspace, 'regular-dir'))).toBe(true);
    expect(isInsidePath(fixture.workspace, path.join(fixture.workspace, '..valid-child'))).toBe(true);
    expect(isInsidePath(fixture.workspace, `${fixture.workspace}-sibling`)).toBe(false);
    expect(isInsidePath(fixture.workspace, path.dirname(fixture.workspace))).toBe(false);
  });

  test('cycle guard terminates recursive walks and suppresses diamond duplicates', () => {
    const { entered, skipped } = walkWithGuard(fixture.workspace);
    const enteredRealPaths = entered.map((entry) => entry.realPath);
    const enteredSharedCount = enteredRealPaths.filter(
      (realPath) => realPath === fs.realpathSync(fixture.sharedReal)
    ).length;
    const cycleSkip = skipped.find((entry) => entry.visiblePath.endsWith(path.join('cycle-root', 'link-back')));

    expect(entered.length).toBeLessThan(30);
    expect(new Set(enteredRealPaths).size).toBe(enteredRealPaths.length);
    expect(cycleSkip).toMatchObject({
      realPath: fs.realpathSync(path.join(fixture.workspace, 'cycle-root')),
    });
    expect(enteredSharedCount).toBe(1);
    expect(skipped.some((entry) => entry.realPath === fs.realpathSync(fixture.sharedReal))).toBe(true);
  });
});
