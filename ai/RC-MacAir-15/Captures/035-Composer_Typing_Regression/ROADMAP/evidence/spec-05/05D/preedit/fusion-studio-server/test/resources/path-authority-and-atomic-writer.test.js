'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAtomicWriter } = require('../../lib/file-mutations/atomic-writer');
const { createPathAuthority } = require('../../lib/file-mutations/path-authority');
const { sha256 } = require('../../lib/file-mutations/text-codec');
const { getAuthoritativePanelPath } = require('../../lib/views/panel-paths');

describe('authoritative save paths and atomic replacement', () => {
  let root;
  let outside;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-save-path-'));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-save-outside-'));
    fs.mkdirSync(path.join(root, 'Office'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  function authority(overrides = {}) {
    return createPathAuthority({
      getWorkspaceById: async (workspaceId) => workspaceId === 'workspace-1'
        ? { id: workspaceId, repoPath: root }
        : null,
      resolvePanelRoot: (workspaceRoot, panel) => panel === 'office-viewer'
        ? path.join(workspaceRoot, 'Office')
        : panel === 'file-viewer' ? workspaceRoot : null,
      ...overrides,
    });
  }

  test('normalizes different panel aliases to one canonical physical path', async () => {
    fs.writeFileSync(path.join(root, 'Office', 'doc.md'), 'old');
    const fileAlias = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'Office/doc.md',
    });
    const officeAlias = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'office-viewer', ingressPath: 'doc.md',
    });
    expect(fileAlias.canonicalPath).toBe('Office/doc.md');
    expect(officeAlias.canonicalPath).toBe(fileAlias.canonicalPath);
    expect(officeAlias.targetPath).toBe(fileAlias.targetPath);
  });

  test('allows in-root filenames whose segments begin with two dots', async () => {
    fs.mkdirSync(path.join(root, 'Office', 'folder'));
    for (const ingressPath of ['..note.md', 'folder/..note.md']) {
      const target = await authority().resolve({
        workspaceId: 'workspace-1', panel: 'office-viewer', ingressPath,
      });
      expect(target.canonicalPath).toBe(`Office/${ingressPath}`);
      expect(target.targetPath).toBe(path.join(target.panelReal, ...ingressPath.split('/')));
    }
  });

  test('normalizes case aliases of an existing physical file to one canonical spelling', async () => {
    const exactPath = path.join(root, 'CaseFile.md');
    const aliasPath = path.join(root, 'casefile.md');
    fs.writeFileSync(exactPath, 'old');
    if (!fs.existsSync(aliasPath)) return; // The production macOS volume is case-insensitive.
    const exact = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'CaseFile.md',
    });
    const alias = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'casefile.md',
    });
    expect(alias.targetPath).toBe(exact.targetPath);
    expect(alias.canonicalPath).toBe('CaseFile.md');
    expect(alias.fingerprint).toEqual(exact.fingerprint);
  });

  test('the production panel resolver does not derive authority from retired unscoped view folders', () => {
    fs.mkdirSync(path.join(root, 'ai', 'views', 'file-viewer'), { recursive: true });
    expect(getAuthoritativePanelPath(root, 'file-viewer')).toBeNull();
    expect(getAuthoritativePanelPath(root, 'unknown-panel')).toBeNull();
  });

  test('uses the workspace registry and rejects traversal, external parents, symlinks, and directories', async () => {
    fs.symlinkSync(outside, path.join(root, 'escape'));
    fs.symlinkSync(path.join(outside, 'target.md'), path.join(root, 'link.md'));
    fs.mkdirSync(path.join(root, 'folder'));
    await expect(authority().resolve({ workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: '../outside.md' }))
      .rejects.toThrow();
    await expect(authority().resolve({ workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'escape/new.md' }))
      .rejects.toThrow(/authority root/u);
    await expect(authority().resolve({ workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'link.md' }))
      .rejects.toThrow(/Symbolic/u);
    await expect(authority().resolve({ workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'folder' }))
      .rejects.toThrow(/regular/u);
  });

  test('writes, syncs, closes and performs exactly one rename', async () => {
    const targetPath = path.join(root, 'doc.md');
    fs.writeFileSync(targetPath, 'old');
    const target = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'doc.md',
    });
    let renames = 0;
    const wrapped = Object.create(fs.promises);
    wrapped.rename = async (...args) => { renames += 1; return fs.promises.rename(...args); };
    const writer = createAtomicWriter({ fsPromises: wrapped });
    const result = await writer.replace({
      target, operationId: '123e4567-e89b-42d3-a456-000000000001',
      bytes: Buffer.from('new'), mutationKind: 'modify', preimageSha256: sha256(Buffer.from('old')),
    });
    expect(result.renamed).toBe(true);
    expect(renames).toBe(1);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('new');
  });

  test('detects preimage conflict before rename and preserves the competing bytes', async () => {
    const targetPath = path.join(root, 'doc.md');
    fs.writeFileSync(targetPath, 'old');
    const target = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'doc.md',
    });
    fs.writeFileSync(targetPath, 'competing');
    const writer = createAtomicWriter();
    await expect(writer.replace({
      target, operationId: '123e4567-e89b-42d3-a456-000000000002',
      bytes: Buffer.from('new'), mutationKind: 'modify', preimageSha256: sha256(Buffer.from('old')),
    })).rejects.toMatchObject({ code: 'preimage_conflict', renamed: false });
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('competing');
  });

  test('cleanup refuses protected hard-link and broken-symlink operation sidecars', async () => {
    const target = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'ordinary.md',
    });
    const protectedFile = path.join(root, 'ai', 'Machine-A', 'System', 'Views', '001-files', 'content.json');
    fs.mkdirSync(path.dirname(protectedFile), { recursive: true });
    fs.writeFileSync(protectedFile, 'protected', 'utf8');
    const writer = createAtomicWriter();
    const hardLinkOperation = '123e4567-e89b-42d3-a456-000000000030';
    const symlinkOperation = '123e4567-e89b-42d3-a456-000000000031';
    const hardLinkTemp = writer.tempPathFor(target, hardLinkOperation);
    const symlinkTemp = writer.tempPathFor(target, symlinkOperation);
    const protectedFutureFile = path.join(path.dirname(protectedFile), 'future.md');
    fs.linkSync(protectedFile, hardLinkTemp);
    fs.symlinkSync(protectedFutureFile, symlinkTemp);

    await expect(writer.cleanup({ target, operationId: hardLinkOperation })).rejects.toBeTruthy();
    await expect(writer.cleanup({ target, operationId: symlinkOperation })).rejects.toBeTruthy();

    expect(fs.existsSync(hardLinkTemp)).toBe(true);
    expect(fs.lstatSync(symlinkTemp).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(protectedFile, 'utf8')).toBe('protected');
    expect(fs.existsSync(protectedFutureFile)).toBe(false);
  });

  test('rejects a same-byte target replacement with a different physical inode', async () => {
    const targetPath = path.join(root, 'doc.md');
    fs.writeFileSync(targetPath, 'old');
    const target = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'doc.md',
    });
    fs.renameSync(targetPath, path.join(root, 'original-away.md'));
    fs.writeFileSync(targetPath, 'old');
    await expect(createAtomicWriter().replace({
      target, operationId: '123e4567-e89b-42d3-a456-000000000022',
      bytes: Buffer.from('new'), mutationKind: 'modify', preimageSha256: sha256(Buffer.from('old')),
    })).rejects.toMatchObject({ code: 'preimage_conflict', renamed: false });
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('old');
  });

  test('rejects operation-temp pathname substitution before rename', async () => {
    const targetPath = path.join(root, 'doc.md');
    fs.writeFileSync(targetPath, 'old');
    const target = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'doc.md',
    });
    const operationId = '123e4567-e89b-42d3-a456-000000000021';
    const tempPath = createAtomicWriter().tempPathFor(target, operationId);
    let substituted = false;
    const wrapped = Object.create(fs.promises);
    wrapped.lstat = async (filePath) => {
      if (filePath === tempPath && !substituted) {
        // The protected-path preflight probes the not-yet-created operation
        // temp. Preserve that ENOENT and substitute only after the writer has
        // created the pathname under test.
        await fs.promises.lstat(tempPath);
        substituted = true;
        await fs.promises.unlink(tempPath);
        await fs.promises.writeFile(tempPath, 'attacker bytes');
      }
      return fs.promises.lstat(filePath);
    };
    await expect(createAtomicWriter({ fsPromises: wrapped }).replace({
      target, operationId, bytes: Buffer.from('new'), mutationKind: 'modify',
      preimageSha256: sha256(Buffer.from('old')),
    })).rejects.toMatchObject({ code: 'preimage_conflict', renamed: false });
    expect(substituted).toBe(true);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('old');
  });

  test('never reports success when the verified temp is substituted inside rename', async () => {
    const targetPath = path.join(root, 'doc.md');
    fs.writeFileSync(targetPath, 'old');
    const target = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'doc.md',
    });
    const operationId = '123e4567-e89b-42d3-a456-000000000023';
    const wrapped = Object.create(fs.promises);
    wrapped.rename = async (from, to) => {
      await fs.promises.unlink(from);
      await fs.promises.writeFile(from, 'BAD');
      return fs.promises.rename(from, to);
    };
    await expect(createAtomicWriter({ fsPromises: wrapped }).replace({
      target, operationId, bytes: Buffer.from('new'), mutationKind: 'modify',
      preimageSha256: sha256(Buffer.from('old')),
    })).rejects.toMatchObject({ code: 'mutation_outcome_unknown', renamed: true });
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('BAD');
  });

  test.each(['create', 'modify'])('rechecks %s target after temp verification as the final pre-rename phase', async (kind) => {
    const targetPath = path.join(root, `${kind}-late.md`);
    if (kind === 'modify') fs.writeFileSync(targetPath, 'captured');
    const target = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: `${kind}-late.md`,
    });
    const operationId = kind === 'create'
      ? '123e4567-e89b-42d3-a456-000000000024'
      : '123e4567-e89b-42d3-a456-000000000025';
    const tempPath = createAtomicWriter().tempPathFor(target, operationId);
    const realOpen = fs.promises.open.bind(fs.promises);
    let substituted = false;
    const wrapped = Object.create(fs.promises);
    wrapped.open = async (filePath, flags, mode) => {
      if (filePath === tempPath && flags !== 'wx' && !substituted) {
        substituted = true;
        if (kind === 'modify') await fs.promises.rename(targetPath, `${targetPath}.away`);
        await fs.promises.writeFile(targetPath, 'competing unsaved bytes');
      }
      return realOpen(filePath, flags, mode);
    };
    await expect(createAtomicWriter({ fsPromises: wrapped }).replace({
      target, operationId, bytes: Buffer.from('intended'), mutationKind: kind,
      preimageSha256: kind === 'modify' ? sha256(Buffer.from('captured')) : null,
    })).rejects.toMatchObject({ code: 'preimage_conflict', renamed: false });
    expect(substituted).toBe(true);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('competing unsaved bytes');
  });

  test('rejects a rebound parent before disclosing intended bytes to an operation temp', async () => {
    const docs = path.join(root, 'docs');
    const movedDocs = path.join(outside, 'moved-docs');
    fs.mkdirSync(docs);
    const target = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'docs/new.md',
    });
    fs.renameSync(docs, movedDocs);
    fs.symlinkSync(movedDocs, docs);
    await expect(createAtomicWriter().replace({
      target, operationId: '123e4567-e89b-42d3-a456-000000000020',
      bytes: Buffer.from('secret intended bytes'), mutationKind: 'create', preimageSha256: null,
    })).rejects.toMatchObject({ code: 'preimage_conflict', renamed: false });
    const tempPath = path.join(movedDocs, '.fusion-save-123e4567-e89b-42d3-a456-000000000020.tmp');
    expect(fs.existsSync(tempPath)).toBe(false);
    expect(fs.existsSync(path.join(movedDocs, 'new.md'))).toBe(false);
  });

  test('distinguishes rename failure from post-rename directory-sync uncertainty', async () => {
    const createTarget = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'create.md',
    });
    const renameFs = Object.create(fs.promises);
    renameFs.rename = async () => { throw Object.assign(new Error('no'), { code: 'EIO' }); };
    await expect(createAtomicWriter({ fsPromises: renameFs }).replace({
      target: createTarget, operationId: '123e4567-e89b-42d3-a456-000000000003',
      bytes: Buffer.from('new'), mutationKind: 'create', preimageSha256: null,
    })).rejects.toMatchObject({ code: 'replace_failed', renamed: false });

    const permissionTarget = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: 'permission.md',
    });
    const permissionFs = Object.create(fs.promises);
    permissionFs.rename = async () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); };
    await expect(createAtomicWriter({ fsPromises: permissionFs }).replace({
      target: permissionTarget, operationId: '123e4567-e89b-42d3-a456-000000000005',
      bytes: Buffer.from('new'), mutationKind: 'create', preimageSha256: null,
    })).rejects.toMatchObject({ code: 'permission_denied', renamed: false });

    const realOpen = fs.promises.open.bind(fs.promises);
    const syncFs = Object.create(fs.promises);
    syncFs.open = async (filePath, flags, mode) => {
      const handle = await realOpen(filePath, flags, mode);
      if (filePath === createTarget.parentReal) handle.sync = async () => { throw new Error('dir sync failed'); };
      return handle;
    };
    await expect(createAtomicWriter({ fsPromises: syncFs }).replace({
      target: createTarget, operationId: '123e4567-e89b-42d3-a456-000000000004',
      bytes: Buffer.from('new'), mutationKind: 'create', preimageSha256: null,
    })).rejects.toMatchObject({ code: 'mutation_outcome_unknown', renamed: true });
    expect(fs.readFileSync(createTarget.targetPath, 'utf8')).toBe('new');
  });

  test.each(['write', 'sync', 'close'])('classifies temp-file %s failure before replacement', async (stage) => {
    const target = await authority().resolve({
      workspaceId: 'workspace-1', panel: 'file-viewer', ingressPath: `${stage}.md`,
    });
    const injected = Object.create(fs.promises);
    const realOpen = fs.promises.open.bind(fs.promises);
    injected.open = async (filePath, flags, mode) => filePath === target.parentReal
      ? realOpen(filePath, flags, mode)
      : ({
      writeFile: async () => { if (stage === 'write') throw new Error('write failed'); },
      sync: async () => { if (stage === 'sync') throw new Error('sync failed'); },
      stat: async () => ({ dev: 1, ino: 2, size: 3, birthtimeMs: 4 }),
      close: async () => { if (stage === 'close') throw new Error('close failed'); },
      });
    await expect(createAtomicWriter({ fsPromises: injected }).replace({
      target, operationId: `123e4567-e89b-42d3-a456-00000000001${stage.length}`,
      bytes: Buffer.from('new'), mutationKind: 'create', preimageSha256: null,
    })).rejects.toMatchObject({ code: 'write_prepare_failed', renamed: false });
    expect(fs.existsSync(target.targetPath)).toBe(false);
  });
});
