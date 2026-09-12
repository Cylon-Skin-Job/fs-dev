'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ProtectedViewPathError,
  assertGenericViewMutationAllowed,
} = require('../../lib/views/protected-path-policy');

function write(filePath, value = 'protected') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

describe('protected view path policy', () => {
  let root;
  let canonicalFile;
  let retiredFile;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-protected-views-'));
    canonicalFile = path.join(root, 'ai', 'Machine-A', 'System', 'Views', '001-files', 'content.json');
    retiredFile = path.join(root, 'ai', 'Machine-A', 'Views', '001-files', 'content.json');
    write(canonicalFile);
    write(retiredFile);
    write(path.join(root, 'notes', 'ordinary.md'), 'ordinary');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test.each([
    ['canonical direct', () => canonicalFile],
    ['retired direct', () => retiredFile],
    ['protected-tree ancestor', () => path.join(root, 'ai', 'Machine-A')],
    ['canonical-tree ancestor', () => path.join(root, 'ai', 'Machine-A', 'System')],
    ['traversal', () => path.join(root, 'notes', '..', 'ai', 'Machine-A', 'Views', 'new.md')],
    ['encoded separator', () => `${root}/ai%2fMachine-A%2fSystem%2fViews%2fnew.md`],
    ['double-encoded separator', () => `${root}/ai%252fMachine-A%252fViews%252fnew.md`],
    ['alternate separators', () => `${root}\\ai\\Machine-A\\System\\Views\\new.md`],
    ['case alias', () => path.join(root, 'AI', 'Machine-A', 'SYSTEM', 'VIEWS', 'new.md')],
    ['non-existing canonical descendants', () => path.join(root, 'ai', 'New-Machine', 'System', 'Views', 'future', 'state.json')],
    ['non-existing retired descendants', () => path.join(root, 'ai', 'New-Machine', 'Views', 'future', 'state.json')],
  ])('denies %s before mutation', async (_label, target) => {
    await expect(assertGenericViewMutationAllowed({ projectRoot: root, paths: [target()] }))
      .rejects.toBeInstanceOf(ProtectedViewPathError);
  });

  test('denies existing and non-existing targets through a symlink alias', async () => {
    const alias = path.join(root, 'notes', 'view-alias');
    fs.symlinkSync(path.dirname(canonicalFile), alias, 'dir');

    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [path.join(alias, 'content.json')],
    })).rejects.toBeInstanceOf(ProtectedViewPathError);
    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [path.join(alias, 'new', 'nested', 'state.json')],
    })).rejects.toBeInstanceOf(ProtectedViewPathError);
  });

  test('denies broken final and intermediate symlinks projected into protected paths', async () => {
    const brokenFileAlias = path.join(root, 'notes', 'future-file.md');
    const protectedFutureFile = path.join(path.dirname(canonicalFile), 'future.md');
    fs.symlinkSync(protectedFutureFile, brokenFileAlias);
    const brokenDirectoryAlias = path.join(root, 'notes', 'future-dir');
    const protectedFutureDirectory = path.join(path.dirname(canonicalFile), 'future-dir');
    fs.symlinkSync(protectedFutureDirectory, brokenDirectoryAlias, 'dir');

    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [brokenFileAlias],
    })).rejects.toBeInstanceOf(ProtectedViewPathError);
    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [path.join(brokenDirectoryAlias, 'nested.md')],
    })).rejects.toBeInstanceOf(ProtectedViewPathError);
  });

  test('denies a hard-link alias to a protected regular file', async () => {
    const alias = path.join(root, 'notes', 'hard-link.json');
    fs.linkSync(canonicalFile, alias);
    await expect(assertGenericViewMutationAllowed({ projectRoot: root, paths: [alias] }))
      .rejects.toBeInstanceOf(ProtectedViewPathError);
  });

  test('protects existing and broken outward symlink referents reachable from a view tree', async () => {
    const externalFile = path.join(root, 'notes', 'capsule-visible.json');
    const externalDirectory = path.join(root, 'notes', 'capsule-visible-directory');
    const brokenTarget = path.join(root, 'notes', 'future-capsule-visible.json');
    const projectedParent = path.join(root, 'physical-future-parent');
    const projectedBrokenTarget = path.join(projectedParent, 'projected-future.json');
    write(externalFile, 'external');
    write(path.join(externalDirectory, 'existing.md'), 'external-directory');
    fs.symlinkSync(externalFile, path.join(path.dirname(canonicalFile), 'external-file.json'));
    fs.symlinkSync(externalDirectory, path.join(path.dirname(canonicalFile), 'external-directory'), 'dir');
    fs.symlinkSync(brokenTarget, path.join(path.dirname(canonicalFile), 'future-file.json'));
    fs.mkdirSync(projectedParent);
    fs.symlinkSync(projectedParent, path.join(root, 'notes', 'future-parent'), 'dir');
    fs.symlinkSync(
      path.join(root, 'notes', 'future-parent', 'projected-future.json'),
      path.join(path.dirname(canonicalFile), 'projected-future-file.json'),
    );
    const referentHardLink = path.join(root, 'notes', 'capsule-visible-hard-link.json');
    fs.linkSync(externalFile, referentHardLink);

    for (const target of [
      externalFile,
      referentHardLink,
      path.join(externalDirectory, 'existing.md'),
      path.join(externalDirectory, 'future.md'),
      externalDirectory,
      brokenTarget,
      projectedBrokenTarget,
    ]) {
      await expect(assertGenericViewMutationAllowed({ projectRoot: root, paths: [target] }))
        .rejects.toBeInstanceOf(ProtectedViewPathError);
    }
  });

  test('allows unrelated ordinary symlink and hard-link aliases', async () => {
    const ordinary = path.join(root, 'notes', 'ordinary.md');
    const symlinkAlias = path.join(root, 'notes', 'ordinary-symlink.md');
    const hardLinkAlias = path.join(root, 'notes', 'ordinary-hard-link.md');
    fs.symlinkSync(ordinary, symlinkAlias);
    fs.linkSync(ordinary, hardLinkAlias);

    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [symlinkAlias, hardLinkAlias],
    })).resolves.toBe(true);
  });

  test('allows an ordinary regular file with another ordinary hard link', async () => {
    const ordinary = path.join(root, 'notes', 'ordinary.md');
    fs.linkSync(ordinary, path.join(root, 'notes', 'ordinary-backup.md'));

    await expect(assertGenericViewMutationAllowed({ projectRoot: root, paths: [ordinary] }))
      .resolves.toBe(true);
  });

  test('denies an ancestor of a declared protected root when the root is a symlink', async () => {
    const symlinkMachine = path.join(root, 'ai', 'Symlink-Machine');
    const externalRoot = path.join(root, 'external-capsules');
    write(path.join(externalRoot, '001-files', 'content.json'));
    fs.mkdirSync(path.join(symlinkMachine, 'System'), { recursive: true });
    fs.symlinkSync(externalRoot, path.join(symlinkMachine, 'System', 'Views'), 'dir');

    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [path.join(symlinkMachine, 'System')],
    })).rejects.toBeInstanceOf(ProtectedViewPathError);
  });

  test('denies an ancestor of a protected root with alternate segment casing', async () => {
    const actualSystemRoot = path.join(root, 'ai', 'Case-Machine', 'system');
    write(path.join(actualSystemRoot, 'views', '001-files', 'content.json'));

    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [actualSystemRoot],
    })).rejects.toBeInstanceOf(ProtectedViewPathError);
  });

  test('denies a directory move whose projected descendants create a protected namespace', async () => {
    const source = path.join(root, 'staging', 'New-Machine');
    write(path.join(source, 'System', 'Views', '001-files', 'manifest.md'));
    const destination = path.join(root, 'ai', 'New-Machine');

    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [source, destination],
      pathMappings: [{ source, destination }],
    })).rejects.toBeInstanceOf(ProtectedViewPathError);
  });

  test('denies a projected protected namespace reachable through a staged symlink', async () => {
    const source = path.join(root, 'staging', 'Symlink-Machine');
    const externalSystem = path.join(root, 'external-system');
    write(path.join(externalSystem, 'Views', '001-files', 'manifest.md'));
    fs.mkdirSync(source, { recursive: true });
    fs.symlinkSync(externalSystem, path.join(source, 'System'), 'dir');
    const destination = path.join(root, 'ai', 'Symlink-Machine');

    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [source, destination],
      pathMappings: [{ source, destination }],
    })).rejects.toBeInstanceOf(ProtectedViewPathError);
  });

  test('denies physical paths projected through a symlinked ai root before machine entries exist', async () => {
    fs.rmSync(path.join(root, 'ai'), { recursive: true, force: true });
    const storageRoot = path.join(root, 'storage');
    fs.mkdirSync(storageRoot, { recursive: true });
    fs.symlinkSync(storageRoot, path.join(root, 'ai'), 'dir');

    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [path.join(storageRoot, 'Future-Machine', 'System', 'Views', 'new', 'manifest.md')],
    })).rejects.toBeInstanceOf(ProtectedViewPathError);
    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [path.join(storageRoot, 'Other-Future-Machine', 'Views', 'new', 'manifest.md')],
    })).rejects.toBeInstanceOf(ProtectedViewPathError);
  });

  test('denies registered cross-workspace aliases, hard links, direct paths, and tree ancestors', async () => {
    const otherRoot = path.join(root, 'nested-workspace');
    const otherProtectedFile = path.join(
      otherRoot, 'ai', 'Machine-B', 'System', 'Views', '001-files', 'content.json',
    );
    write(otherProtectedFile, 'workspace-b');
    const symlinkAlias = path.join(root, 'notes', 'workspace-b-view');
    fs.symlinkSync(path.dirname(otherProtectedFile), symlinkAlias, 'dir');
    const hardLinkAlias = path.join(root, 'notes', 'workspace-b-hard-link.json');
    fs.linkSync(otherProtectedFile, hardLinkAlias);

    for (const target of [
      path.join(symlinkAlias, 'created.md'),
      hardLinkAlias,
      otherProtectedFile,
      path.join(otherRoot, 'ai', 'Machine-B', 'System'),
    ]) {
      await expect(assertGenericViewMutationAllowed({
        projectRoot: root,
        workspaceRoots: [root, otherRoot],
        paths: [target],
      })).rejects.toBeInstanceOf(ProtectedViewPathError);
    }
  });

  test('allows ordinary existing and non-existing workspace paths', async () => {
    await expect(assertGenericViewMutationAllowed({
      projectRoot: root,
      paths: [
        path.join(root, 'notes', 'ordinary.md'),
        path.join(root, 'notes', 'future', 'nested', 'new.md'),
      ],
    })).resolves.toBe(true);
  });

  test('does not infer protection from view-shaped segments above the workspace root', async () => {
    const shapedWorkspaceRoot = path.join(root, 'container', 'ai', 'decoy', 'Views', 'workspace');
    const target = path.join(shapedWorkspaceRoot, 'notes', 'ordinary.md');
    write(target, 'ordinary');

    await expect(assertGenericViewMutationAllowed({
      projectRoot: shapedWorkspaceRoot,
      workspaceRoots: [shapedWorkspaceRoot],
      paths: [target],
    })).resolves.toBe(true);
  });
});
