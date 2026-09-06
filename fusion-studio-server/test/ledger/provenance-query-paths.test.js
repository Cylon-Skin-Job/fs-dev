'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPathAuthority } = require('../../lib/file-mutations/path-authority');
const {
  ProvenanceQuerySelectorError,
  createProvenanceQueryPathNormalizer,
} = require('../../lib/ledger/provenance-query-paths');

describe('provenance query panel alias normalization', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-provenance-query-'));
    fs.mkdirSync(path.join(root, 'office', 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'office', 'docs', 'a.md'), 'before');
    fs.symlinkSync('docs', path.join(root, 'office', 'alias'));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function normalizer(panelRoot = path.join(root, 'office')) {
    return createProvenanceQueryPathNormalizer({
      getWorkspaceById: async (id) => (id === 'workspace-1' ? { repoPath: root } : null),
      resolvePanelRoot: (_workspaceRoot, panel) => (panel === 'office-viewer' ? panelRoot : null),
    });
  }

  test('converts recognized panel path and folder aliases to canonical workspace paths', async () => {
    await expect(normalizer().normalize({
      workspaceId: 'workspace-1', panel: 'office-viewer', path: 'draft.md', folderPrefix: '',
    })).resolves.toEqual({ canonicalPath: 'office/draft.md', folderPrefix: 'office' });
  });

  test('matches mediated-save physical identity through an in-root symlinked parent', async () => {
    const options = {
      getWorkspaceById: async () => ({ repoPath: root }),
      resolvePanelRoot: () => path.join(root, 'office'),
    };
    const saveTarget = await createPathAuthority(options).resolve({
      workspaceId: 'workspace-1', panel: 'office-viewer', ingressPath: 'alias/a.md',
    });
    expect(saveTarget.canonicalPath).toBe('office/docs/a.md');
    await expect(createProvenanceQueryPathNormalizer(options).normalize({
      workspaceId: 'workspace-1', panel: 'office-viewer',
      path: 'alias/a.md', folderPrefix: 'alias',
    })).resolves.toEqual({
      canonicalPath: saveTarget.canonicalPath,
      folderPrefix: 'office/docs',
    });
  });

  test('allows exact and folder selectors whose in-root segments begin with two dots', async () => {
    fs.mkdirSync(path.join(root, 'office', '..folder'));
    fs.writeFileSync(path.join(root, 'office', '..note.md'), 'top');
    fs.writeFileSync(path.join(root, 'office', 'docs', '..note.md'), 'nested');

    await expect(normalizer().normalize({
      workspaceId: 'workspace-1', panel: 'office-viewer', path: '..note.md',
    })).resolves.toEqual({ canonicalPath: 'office/..note.md' });
    await expect(normalizer().normalize({
      workspaceId: 'workspace-1', panel: 'office-viewer',
      path: 'docs/..note.md', folderPrefix: '..folder',
    })).resolves.toEqual({
      canonicalPath: 'office/docs/..note.md',
      folderPrefix: 'office/..folder',
    });
  });

  test('keeps already-canonical selectors canonical when panel is omitted', async () => {
    await expect(normalizer().normalize({
      workspaceId: 'workspace-1', path: 'office/draft.md', folderPrefix: '',
    })).resolves.toEqual({ canonicalPath: 'office/draft.md', folderPrefix: '' });
  });

  test('rejects unknown panels, traversal, and panel roots outside the workspace', async () => {
    await expect(normalizer().normalize({
      workspaceId: 'workspace-1', panel: 'unknown', path: 'draft.md',
    })).rejects.toBeInstanceOf(ProvenanceQuerySelectorError);
    await expect(normalizer().normalize({
      workspaceId: 'workspace-1', panel: 'office-viewer', path: '../draft.md',
    })).rejects.toBeInstanceOf(ProvenanceQuerySelectorError);
    await expect(normalizer(os.tmpdir()).normalize({
      workspaceId: 'workspace-1', panel: 'office-viewer', path: 'draft.md',
    })).rejects.toMatchObject({
      name: 'ProvenanceQuerySelectorError', message: expect.stringMatching(/leaves the workspace/u),
    });
  });

  test('leaves registry and filesystem infrastructure failures untyped for query_failed routing', async () => {
    const registryFailure = new Error('registry unavailable');
    await expect(createProvenanceQueryPathNormalizer({
      getWorkspaceById: async () => { throw registryFailure; },
    }).normalize({
      workspaceId: 'workspace-1', panel: 'office-viewer', path: 'draft.md',
    })).rejects.toBe(registryFailure);

    const filesystemFailure = Object.assign(new Error('filesystem unavailable'), { code: 'EIO' });
    await expect(createProvenanceQueryPathNormalizer({
      getWorkspaceById: async () => ({ repoPath: root }),
      resolvePanelRoot: () => path.join(root, 'office'),
      fsPromises: { ...fs.promises, realpath: async () => { throw filesystemFailure; } },
    }).normalize({
      workspaceId: 'workspace-1', panel: 'office-viewer', path: 'draft.md',
    })).rejects.toBe(filesystemFailure);

    const statFailure = Object.assign(new Error('panel stat unavailable'), { code: 'EIO' });
    const stat = jest.spyOn(fs, 'statSync').mockImplementation(() => { throw statFailure; });
    try {
      await expect(createProvenanceQueryPathNormalizer({
        getWorkspaceById: async () => ({ repoPath: root }),
      }).normalize({
        workspaceId: 'workspace-1', panel: '__apps__', path: 'draft.md',
      })).rejects.toBe(statFailure);
    } finally {
      stat.mockRestore();
    }
  });
});
