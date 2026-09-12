'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createActionHandlers } = require('../../lib/watcher/actions');
const { buildFilter } = require('../../lib/watcher/filter-loader');

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

describe('drop-file protected view boundary', () => {
  let root;
  let canonicalFile;
  let retiredFile;
  let consoleErrorSpy;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-drop-file-protection-'));
    canonicalFile = path.join(root, 'ai', 'Machine-A', 'System', 'Views', '001-files', 'manifest.md');
    retiredFile = path.join(root, 'ai', 'Machine-A', 'Views', '001-files', 'manifest.md');
    write(canonicalFile, 'canonical-before');
    write(retiredFile, 'retired-before');
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  function filterFor(target, content = 'after') {
    return buildFilter({
      name: 'drop-file-test',
      events: ['create'],
      action: 'drop-file',
      path: target,
      content,
    }, createActionHandlers({ projectRoot: root }));
  }

  test('denies canonical and retired direct targets before overwriting', async () => {
    await filterFor(canonicalFile).onCreate('source.md', {});
    await filterFor(retiredFile).onCreate('source.md', {});

    expect(fs.readFileSync(canonicalFile, 'utf8')).toBe('canonical-before');
    expect(fs.readFileSync(retiredFile, 'utf8')).toBe('retired-before');
  });

  test('denies symlink aliases and non-existing protected targets without partial creation', async () => {
    const alias = path.join(root, 'ordinary', 'view-alias');
    fs.mkdirSync(path.dirname(alias), { recursive: true });
    fs.symlinkSync(path.dirname(canonicalFile), alias, 'dir');
    const aliasTarget = path.join(alias, 'generated.md');
    const nonExistingTarget = path.join(root, 'ai', 'New-Machine', 'System', 'Views', 'new', 'generated.md');

    await filterFor(aliasTarget).onCreate('source.md', {});
    await filterFor(nonExistingTarget).onCreate('source.md', {});

    expect(fs.existsSync(path.join(path.dirname(canonicalFile), 'generated.md'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'ai', 'New-Machine'))).toBe(false);
  });

  test('denies a physical destination projected through a symlinked System ancestor', async () => {
    const physicalSystem = path.join(root, 'physical-system');
    const aliasMachine = path.join(root, 'ai', 'Alias-Machine');
    fs.mkdirSync(physicalSystem, { recursive: true });
    fs.mkdirSync(aliasMachine, { recursive: true });
    fs.symlinkSync(physicalSystem, path.join(aliasMachine, 'System'), 'dir');
    const target = path.join(physicalSystem, 'Views', '001-files', 'manifest.md');

    await filterFor(target).onCreate('source.md', {});

    expect(fs.existsSync(path.join(physicalSystem, 'Views'))).toBe(false);
  });

  test('denies a future machine through the physical target of a symlinked ai root', async () => {
    fs.rmSync(path.join(root, 'ai'), { recursive: true, force: true });
    const storageRoot = path.join(root, 'storage');
    fs.mkdirSync(storageRoot, { recursive: true });
    fs.symlinkSync(storageRoot, path.join(root, 'ai'), 'dir');
    const target = path.join(
      storageRoot, 'Future-Machine', 'System', 'Views', '001-files', 'manifest.md',
    );

    await filterFor(target).onCreate('source.md', {});

    expect(fs.existsSync(path.join(storageRoot, 'Future-Machine'))).toBe(false);
  });

  test('denies broken final and intermediate symlinks into non-existing protected targets', async () => {
    const ordinaryRoot = path.join(root, 'ordinary');
    fs.mkdirSync(ordinaryRoot, { recursive: true });
    const brokenFileAlias = path.join(ordinaryRoot, 'future.md');
    const protectedFutureFile = path.join(path.dirname(canonicalFile), 'future.md');
    fs.symlinkSync(protectedFutureFile, brokenFileAlias);
    const brokenDirectoryAlias = path.join(ordinaryRoot, 'future-dir');
    const protectedFutureDirectory = path.join(path.dirname(canonicalFile), 'future-dir');
    fs.symlinkSync(protectedFutureDirectory, brokenDirectoryAlias, 'dir');

    await filterFor(brokenFileAlias).onCreate('source.md', {});
    await filterFor(path.join(brokenDirectoryAlias, 'nested.md')).onCreate('source.md', {});

    expect(fs.lstatSync(brokenFileAlias).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(protectedFutureFile)).toBe(false);
    expect(fs.lstatSync(brokenDirectoryAlias).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(protectedFutureDirectory)).toBe(false);
  });

  test('ordinary relative destinations still create and write through the action', async () => {
    const target = path.join('generated', 'notes', 'result.md');
    await filterFor(target, 'ordinary').onCreate('source.md', {});

    expect(fs.readFileSync(path.join(root, target), 'utf8')).toBe('ordinary');
  });
});
