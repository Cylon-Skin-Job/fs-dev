'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  FileViewerReadError,
  createFileViewerReadService,
  decodeSupportedText,
} = require('../../lib/file-reads/file-viewer-read-service');

describe('File Viewer read service', () => {
  let root;
  let service;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fusion-file-read-'));
    service = createFileViewerReadService({
      getWorkspaceById: async (workspaceId) => ({ id: workspaceId, repoPath: root }),
      resolvePanelRoot: () => root,
    });
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  test('returns deterministic bounded tree nodes with exact symlink fields and hidden-folder policy', async () => {
    await fs.promises.mkdir(path.join(root, 'z-folder'));
    await fs.promises.writeFile(path.join(root, 'z-folder', 'child.txt'), 'child');
    await fs.promises.mkdir(path.join(root, '.hidden-folder'));
    await fs.promises.writeFile(path.join(root, '.hidden-file'), 'hidden');
    await fs.promises.writeFile(path.join(root, 'b.TXT'), 'b');
    await fs.promises.writeFile(path.join(root, 'a.md'), 'a');
    await fs.promises.symlink(path.join(root, 'a.md'), path.join(root, 'linked.md'));

    const ordinary = await service.readTree({ workspaceId: 'workspace-A', path: '' });
    expect(ordinary.nodes.map((node) => node.name)).toEqual(['z-folder', 'a.md', 'b.TXT', 'linked.md']);
    expect(ordinary.nodes[0]).toMatchObject({ type: 'folder', hasChildren: true });
    expect(ordinary.nodes.find((node) => node.name === 'b.TXT')).toMatchObject({ extension: 'txt' });
    expect(ordinary.nodes.find((node) => node.name === 'linked.md')).toEqual({
      name: 'linked.md', path: 'linked.md', type: 'file', extension: 'md',
      isSymlink: true, symlinkTarget: await fs.promises.realpath(path.join(root, 'a.md')),
    });

    const withHiddenFolders = await service.readTree({
      workspaceId: 'workspace-A', path: '', includeHiddenFolders: true,
    });
    expect(withHiddenFolders.nodes.some((node) => node.name === '.hidden-folder')).toBe(true);
    expect(withHiddenFolders.nodes.some((node) => node.name === '.hidden-file')).toBe(false);
  });

  test('enforces the 1000 returned-node cap after filtering ignored entries', async () => {
    await fs.promises.mkdir(path.join(root, 'ignored'));
    for (let index = 0; index < 1001; index += 1) {
      await fs.promises.writeFile(path.join(root, `visible-${index}`), 'x');
    }
    await expect(service.readTree({ workspaceId: 'workspace-A', path: '' }))
      .rejects.toMatchObject({ name: 'FileViewerReadError', code: 'too_many_entries' });

    const filteredRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fusion-file-read-hidden-'));
    try {
      for (let index = 0; index < 1001; index += 1) {
        await fs.promises.writeFile(path.join(filteredRoot, `.hidden-${index}`), 'x');
      }
      const filtered = createFileViewerReadService({
        getWorkspaceById: async () => ({ repoPath: filteredRoot }),
        resolvePanelRoot: () => filteredRoot,
      });
      await expect(filtered.readTree({ workspaceId: 'workspace-A', path: '' }))
        .resolves.toMatchObject({ nodes: [] });
    } finally {
      await fs.promises.rm(filteredRoot, { recursive: true, force: true });
    }
  }, 20_000);

  test('returns exact UTF-8 bytes/mtime and rejects malformed UTF-8 or NUL without replacement', async () => {
    const text = 'hello 🦊';
    await fs.promises.writeFile(path.join(root, 'ok.txt'), text);
    const result = await service.readContent({ workspaceId: 'workspace-A', path: 'ok.txt' });
    expect(result.content).toBe(text);
    expect(result.size).toBe(Buffer.byteLength(text));
    expect(Number.isSafeInteger(result.lastModified)).toBe(true);

    await fs.promises.writeFile(path.join(root, 'bad.bin'), Buffer.from([0xc3, 0x28]));
    await expect(service.readContent({ workspaceId: 'workspace-A', path: 'bad.bin' }))
      .rejects.toMatchObject({ code: 'unsupported_text' });
    await fs.promises.writeFile(path.join(root, 'nul.txt'), Buffer.from('a\0b'));
    await expect(service.readContent({ workspaceId: 'workspace-A', path: 'nul.txt' }))
      .rejects.toMatchObject({ code: 'unsupported_text' });
    expect(decodeSupportedText(Buffer.from([0xef, 0xbb, 0xbf, 0x61]))).toBe('\ufeffa');
  });

  test.each([
    ['tree traversal', 'tree', '../outside'],
    ['content traversal', 'content', '../outside'],
    ['content folder', 'content', 'folder'],
    ['missing tree', 'tree', 'missing'],
    ['missing content', 'content', 'missing'],
  ])('maps %s to a stable domain code', async (_label, kind, requestPath) => {
    await fs.promises.mkdir(path.join(root, 'folder'));
    const promise = kind === 'tree'
      ? service.readTree({ workspaceId: 'workspace-A', path: requestPath })
      : service.readContent({ workspaceId: 'workspace-A', path: requestPath });
    const code = requestPath.startsWith('..')
      ? 'path_not_allowed'
      : requestPath === 'folder' ? 'is_directory' : 'not_found';
    await expect(promise).rejects.toEqual(expect.any(FileViewerReadError));
    await expect(promise).rejects.toMatchObject({ code });
  });
});
