'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createFileExplorerHandlers } = require('../../lib/file-explorer');
const workspaceRegistry = require('../../lib/workspace/registry-service');

function replies(ws, type) {
  return ws.sent.filter((message) => message.type === type);
}

describe('protected view file explorer routes', () => {
  let root;
  let canonicalRoot;
  let retiredRoot;
  let handlers;
  let ws;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view-file-routes-'));
    canonicalRoot = path.join(root, 'ai', 'Test-Machine', 'System', 'Views');
    retiredRoot = path.join(root, 'ai', 'Test-Machine', 'Views');
    fs.mkdirSync(path.join(canonicalRoot, '001-files'), { recursive: true });
    fs.mkdirSync(path.join(retiredRoot, '001-files'), { recursive: true });
    fs.mkdirSync(path.join(root, 'ordinary'), { recursive: true });
    fs.writeFileSync(path.join(retiredRoot, '001-files', 'content.json'), '{"read":true}', 'utf8');
    ws = {
      sent: [],
      send(value) { this.sent.push(JSON.parse(value)); },
    };
    handlers = createFileExplorerHandlers({
      getProjectRoot: () => root,
      getPanelPath: (panel) => panel === '__panels__' ? retiredRoot : root,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('ordinary reads remain available through the retired pseudo-panel alias', async () => {
    await handlers.handleFileContentRequest(ws, {
      type: 'file_content_request',
      panel: '__panels__',
      path: '001-files/content.json',
    });
    expect(replies(ws, 'file_content_response')[0]).toMatchObject({
      success: true,
      content: '{"read":true}',
    });
  });

  test('folder and document creation deny pseudo-panel, direct canonical, encoded, and symlink aliases', async () => {
    const alias = path.join(root, 'ordinary', 'view-alias');
    fs.symlinkSync(path.join(canonicalRoot, '001-files'), alias, 'dir');

    await handlers.handleFolderCreateRequest(ws, {
      type: 'folder_create', panel: '__panels__', parentPath: '001-files', name: 'blocked',
    });
    await handlers.handleDocumentCreateRequest(ws, {
      type: 'document_create', panel: 'file-viewer',
      parentPath: 'ai/Test-Machine/System/Views/001-files', name: 'blocked',
    });
    await handlers.handleFolderCreateRequest(ws, {
      type: 'folder_create', panel: 'file-viewer',
      parentPath: 'ai%2fTest-Machine%2fViews%2f001-files', name: 'blocked',
    });
    await handlers.handleDocumentCreateRequest(ws, {
      type: 'document_create', panel: 'file-viewer', parentPath: 'ordinary/view-alias', name: 'blocked',
    });

    expect(fs.existsSync(path.join(retiredRoot, '001-files', 'blocked'))).toBe(false);
    expect(fs.existsSync(path.join(canonicalRoot, '001-files', 'blocked.md'))).toBe(false);
    expect(fs.existsSync(path.join(canonicalRoot, '001-files', 'blocked'))).toBe(false);
    expect(replies(ws, 'folder_create_response').every((reply) => reply.success === false)).toBe(true);
    expect(replies(ws, 'document_create_response').every((reply) => reply.success === false)).toBe(true);
  });

  test('creation denies a physical protected root projected through a symlinked System ancestor', async () => {
    const physicalSystem = path.join(root, 'physical-system');
    const aliasMachine = path.join(root, 'ai', 'Alias-Machine');
    fs.mkdirSync(physicalSystem, { recursive: true });
    fs.mkdirSync(aliasMachine, { recursive: true });
    fs.symlinkSync(physicalSystem, path.join(aliasMachine, 'System'), 'dir');

    await handlers.handleFolderCreateRequest(ws, {
      type: 'folder_create', panel: 'file-viewer', parentPath: 'physical-system', name: 'Views',
    });

    expect(fs.existsSync(path.join(physicalSystem, 'Views'))).toBe(false);
    expect(replies(ws, 'folder_create_response')[0]).toMatchObject({ success: false });
  });

  test('legacy save preflights and exclusively creates its temporary sidecar', async () => {
    const protectedFile = path.join(canonicalRoot, '001-files', 'content.json');
    const ordinaryFile = path.join(root, 'ordinary', 'note.md');
    fs.writeFileSync(protectedFile, 'protected', 'utf8');
    fs.writeFileSync(ordinaryFile, 'ordinary', 'utf8');
    fs.linkSync(protectedFile, `${ordinaryFile}.tmp`);

    await handlers.handleFileSaveRequest(ws, {
      type: 'file_save', panel: 'file-viewer', path: 'ordinary/note.md', content: 'attack',
    });

    expect(fs.readFileSync(protectedFile, 'utf8')).toBe('protected');
    expect(fs.readFileSync(ordinaryFile, 'utf8')).toBe('ordinary');
    expect(replies(ws, 'file_save_response')[0]).toMatchObject({ success: false });
  });

  test('generic routes cannot mutate outward referents exposed by protected-tree symlinks', async () => {
    const externalFile = path.join(root, 'ordinary', 'capsule-visible.md');
    const externalDirectory = path.join(root, 'ordinary', 'capsule-visible-directory');
    const futureFile = path.join(root, 'ordinary', 'future-capsule-visible.md');
    fs.writeFileSync(externalFile, 'protected-through-link', 'utf8');
    fs.mkdirSync(externalDirectory);
    fs.symlinkSync(externalFile, path.join(canonicalRoot, '001-files', 'external.md'));
    fs.symlinkSync(externalDirectory, path.join(canonicalRoot, '001-files', 'external-directory'), 'dir');
    fs.symlinkSync(futureFile, path.join(canonicalRoot, '001-files', 'future.md'));

    await handlers.handleFileSaveRequest(ws, {
      type: 'file_save', panel: 'file-viewer',
      path: 'ordinary/capsule-visible.md', content: 'attack',
    });
    await handlers.handleFolderCreateRequest(ws, {
      type: 'folder_create', panel: 'file-viewer',
      parentPath: 'ordinary/capsule-visible-directory', name: 'attack',
    });
    await handlers.handleDocumentCreateRequest(ws, {
      type: 'document_create', panel: 'file-viewer', parentPath: 'ordinary',
      name: 'future-capsule-visible',
    });

    expect(fs.readFileSync(externalFile, 'utf8')).toBe('protected-through-link');
    expect(fs.readdirSync(externalDirectory)).toEqual([]);
    expect(fs.existsSync(futureFile)).toBe(false);
    expect(replies(ws, 'file_save_response')[0]).toMatchObject({ success: false });
    expect(replies(ws, 'folder_create_response')[0]).toMatchObject({ success: false });
    expect(replies(ws, 'document_create_response')[0]).toMatchObject({ success: false });
  });

  test('legacy checkpoint save preflights generated Git paths before changing the target', async () => {
    const protectedGitAlias = path.join(root, '.git');
    const ordinaryFile = path.join(root, 'ordinary', 'checkpoint.md');
    fs.writeFileSync(ordinaryFile, 'ordinary', 'utf8');
    fs.symlinkSync(canonicalRoot, protectedGitAlias, 'dir');

    await handlers.handleFileSaveRequest(ws, {
      type: 'file_save', panel: 'file-viewer', path: 'ordinary/checkpoint.md',
      content: 'attack', reason: 'checkpoint',
    });

    expect(fs.readFileSync(ordinaryFile, 'utf8')).toBe('ordinary');
    expect(fs.readdirSync(canonicalRoot).sort()).toEqual(['001-files']);
    expect(replies(ws, 'file_save_response')[0]).toMatchObject({ success: false });
  });

  test('legacy checkpoint rejects a gitfile whose actual Git directory is protected', async () => {
    const protectedGitDir = path.join(canonicalRoot, '001-files', 'git-metadata');
    const ordinaryFile = path.join(root, 'ordinary', 'checkpoint.md');
    fs.writeFileSync(ordinaryFile, 'ordinary', 'utf8');
    execFileSync('git', ['init', '--separate-git-dir', protectedGitDir, root], { stdio: 'ignore' });
    const before = fs.readdirSync(protectedGitDir).sort();

    await handlers.handleFileSaveRequest(ws, {
      type: 'file_save', panel: 'file-viewer', path: 'ordinary/checkpoint.md',
      content: 'attack', reason: 'checkpoint',
    });

    expect(fs.readFileSync(ordinaryFile, 'utf8')).toBe('ordinary');
    expect(fs.readdirSync(protectedGitDir).sort()).toEqual(before);
    expect(replies(ws, 'file_save_response')[0]).toMatchObject({ success: false });
  });

  test('legacy checkpoint rejects a linked-worktree common directory inside a protected capsule', async () => {
    const contentRoot = path.join(root, 'ordinary-worktree');
    const gitDir = path.join(root, 'ordinary-worktree-metadata');
    const protectedCommon = path.join(canonicalRoot, '001-files', 'common-git');
    fs.mkdirSync(contentRoot);
    fs.mkdirSync(gitDir);
    fs.mkdirSync(path.join(protectedCommon, 'objects'), { recursive: true });
    fs.mkdirSync(path.join(protectedCommon, 'refs'), { recursive: true });
    fs.writeFileSync(path.join(contentRoot, '.git'), `gitdir: ${gitDir}\n`);
    fs.writeFileSync(path.join(gitDir, 'commondir'), `${protectedCommon}\n`);
    fs.writeFileSync(path.join(contentRoot, 'checkpoint.md'), 'ordinary');
    const worktreeHandlers = createFileExplorerHandlers({
      getProjectRoot: () => root,
      getPanelPath: () => contentRoot,
    });

    await worktreeHandlers.handleFileSaveRequest(ws, {
      type: 'file_save', panel: 'file-viewer', path: 'checkpoint.md',
      content: 'attack', reason: 'checkpoint',
    });

    expect(fs.readFileSync(path.join(contentRoot, 'checkpoint.md'), 'utf8')).toBe('ordinary');
    expect(replies(ws, 'file_save_response')[0]).toMatchObject({ success: false });
  });

  test('legacy checkpoint remains functional with an ordinary separate Git directory', async () => {
    const gitDir = path.join(root, 'ordinary-git-metadata');
    const ordinaryFile = path.join(root, 'ordinary', 'checkpoint.md');
    fs.writeFileSync(ordinaryFile, 'before', 'utf8');
    execFileSync('git', ['init', '--separate-git-dir', gitDir, root], { stdio: 'ignore' });
    execFileSync('git', ['-C', root, 'config', 'user.name', 'Fusion Test']);
    execFileSync('git', ['-C', root, 'config', 'user.email', 'fusion-test@localhost']);

    await handlers.handleFileSaveRequest(ws, {
      type: 'file_save', panel: 'file-viewer', path: 'ordinary/checkpoint.md',
      content: 'after', reason: 'checkpoint',
    });

    expect(fs.readFileSync(ordinaryFile, 'utf8')).toBe('after');
    expect(execFileSync('git', ['-C', root, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim())
      .toBe('1');
    expect(replies(ws, 'file_save_response')[0]).toMatchObject({ success: true });
  });

  test('registered cross-workspace symlink and hard-link aliases have zero public-route effects', async () => {
    const otherRoot = path.join(root, 'workspace-b');
    const otherProtectedRoot = path.join(
      otherRoot, 'ai', 'Machine-B', 'System', 'Views', '001-files',
    );
    const otherProtectedFile = path.join(otherProtectedRoot, 'content.json');
    fs.mkdirSync(otherProtectedRoot, { recursive: true });
    fs.writeFileSync(otherProtectedFile, 'workspace-b-protected', 'utf8');
    jest.spyOn(workspaceRegistry, 'list').mockResolvedValue([
      { id: 'workspace-a', repoPath: root },
      { id: 'workspace-b', repoPath: otherRoot },
    ]);
    const symlinkAlias = path.join(root, 'ordinary', 'workspace-b-view');
    fs.symlinkSync(otherProtectedRoot, symlinkAlias, 'dir');
    const ordinaryFile = path.join(root, 'ordinary', 'cross-workspace.md');
    fs.writeFileSync(ordinaryFile, 'ordinary', 'utf8');
    fs.linkSync(otherProtectedFile, `${ordinaryFile}.tmp`);

    await handlers.handleFolderCreateRequest(ws, {
      type: 'folder_create', panel: 'file-viewer',
      parentPath: 'ordinary/workspace-b-view', name: 'blocked',
    });
    await handlers.handleDocumentCreateRequest(ws, {
      type: 'document_create', panel: 'file-viewer',
      parentPath: 'workspace-b/ai/Machine-B/System/Views/001-files', name: 'direct-blocked',
    });
    await handlers.handleFileSaveRequest(ws, {
      type: 'file_save', panel: 'file-viewer',
      path: 'ordinary/cross-workspace.md', content: 'attack',
    });

    expect(fs.existsSync(path.join(otherProtectedRoot, 'blocked'))).toBe(false);
    expect(fs.existsSync(path.join(otherProtectedRoot, 'direct-blocked.md'))).toBe(false);
    expect(fs.readFileSync(otherProtectedFile, 'utf8')).toBe('workspace-b-protected');
    expect(fs.readFileSync(ordinaryFile, 'utf8')).toBe('ordinary');
    expect(replies(ws, 'folder_create_response')[0]).toMatchObject({ success: false });
    expect(replies(ws, 'document_create_response')[0]).toMatchObject({ success: false });
    expect(replies(ws, 'file_save_response')[0]).toMatchObject({ success: false });
  });

  test('ordinary folder and document creation remain functional', async () => {
    await handlers.handleFolderCreateRequest(ws, {
      type: 'folder_create', panel: 'file-viewer', parentPath: 'ordinary', name: 'notes',
    });
    await handlers.handleDocumentCreateRequest(ws, {
      type: 'document_create', panel: 'file-viewer', parentPath: 'ordinary/notes', name: 'hello',
    });

    expect(fs.existsSync(path.join(root, 'ordinary', 'notes'))).toBe(true);
    expect(fs.readFileSync(path.join(root, 'ordinary', 'notes', 'hello.md'), 'utf8')).toContain('# hello');
    expect(replies(ws, 'folder_create_response')[0]).toMatchObject({ success: true });
    expect(replies(ws, 'document_create_response')[0]).toMatchObject({ success: true });
  });

  test('ordinary hard-linked files remain writable through the legacy save route', async () => {
    const ordinary = path.join(root, 'ordinary', 'hard-linked.md');
    const backup = path.join(root, 'ordinary', 'hard-linked-backup.md');
    fs.writeFileSync(ordinary, 'before', 'utf8');
    fs.linkSync(ordinary, backup);

    await handlers.handleFileSaveRequest(ws, {
      type: 'file_save', panel: 'file-viewer', path: 'ordinary/hard-linked.md', content: 'after',
    });

    expect(fs.readFileSync(ordinary, 'utf8')).toBe('after');
    expect(fs.readFileSync(backup, 'utf8')).toBe('before');
    expect(replies(ws, 'file_save_response')[0]).toMatchObject({ success: true });
  });

  test('ordinary sibling creation under a machine root remains functional', async () => {
    await handlers.handleFolderCreateRequest(ws, {
      type: 'folder_create', panel: 'file-viewer', parentPath: 'ai/Test-Machine', name: 'Captures',
    });
    await handlers.handleDocumentCreateRequest(ws, {
      type: 'document_create', panel: 'file-viewer', parentPath: 'ai/Test-Machine/Captures', name: 'note',
    });

    expect(fs.existsSync(path.join(root, 'ai', 'Test-Machine', 'Captures', 'note.md'))).toBe(true);
    expect(replies(ws, 'folder_create_response')[0]).toMatchObject({ success: true });
    expect(replies(ws, 'document_create_response')[0]).toMatchObject({ success: true });
  });
});
