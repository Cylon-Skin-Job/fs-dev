'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const { createViewRelocationService } = require('../../lib/views/relocation-service');
const { decodeEntryName } = require('../../lib/views/relocation-inventory');

const {
  createFixture,
  requestFor,
  serviceFor,
  writeCapsule,
  writeJson,
} = require('./view-relocation-fixtures');

describe('view relocation manifest, content-root, and link preflight', () => {
  test('preserves every supported content-root declaration without rewriting bytes', async () => {
    const fixture = await createFixture();
    try {
      const externalAbsolute = path.join(fixture.tempRoot, 'absolute-content');
      fs.mkdirSync(externalAbsolute);
      const declarations = [
        ['workspace-viewer', { type: 'workspace-relative', path: 'shared/workspace' }, 'none'],
        ['machine-viewer', { type: 'machine-relative', path: 'Shared' }, 'none'],
        ['project-viewer', { type: 'project-root' }, 'none'],
        ['absolute-viewer', { type: 'absolute', path: externalAbsolute }, 'none'],
        ['selected-viewer', { type: 'selected-folder', path: 'selected/content' }, 'none'],
        ['relative-viewer', { type: 'view-relative', path: 'content' }, 'none'],
        ['selected-null-viewer', { type: 'selected-folder', path: null }, 'selected-folder'],
        ['sqlite-viewer', { type: 'sqlite' }, 'sqlite'],
        ['none-viewer', { type: 'none' }, 'none'],
      ];
      const before = new Map();
      declarations.forEach(([viewId, declaration, dataSource], index) => {
        const folderName = `${String(index + 1).padStart(3, '0')}-${viewId}`;
        const capsule = writeCapsule(fixture.oldRoot, {
          folderName,
          viewId,
          rootDeclaration: declaration,
          dataSource,
        });
        if (declaration.type === 'view-relative') fs.mkdirSync(path.join(capsule, 'content'));
        const contentPath = path.join(capsule, 'content.json');
        before.set(folderName, fs.readFileSync(contentPath));
      });
      const nullCapsule = writeCapsule(fixture.oldRoot, {
        folderName: '010-default-null-viewer',
        viewId: 'default-null-viewer',
      });
      writeJson(path.join(nullCapsule, 'content.json'), { version: 1, dataSource: 'none', root: null });
      before.set('010-default-null-viewer', fs.readFileSync(path.join(nullCapsule, 'content.json')));
      const stringCapsule = writeCapsule(fixture.oldRoot, {
        folderName: '011-string-root-viewer',
        viewId: 'string-root-viewer',
      });
      writeJson(path.join(stringCapsule, 'content.json'), { version: 1, root: 'shared/string' });
      before.set('011-string-root-viewer', fs.readFileSync(path.join(stringCapsule, 'content.json')));

      await serviceFor(fixture).ensureReady(requestFor(fixture));

      for (const [folderName, bytes] of before) {
        expect(fs.readFileSync(path.join(fixture.newRoot, folderName, 'content.json'))).toEqual(bytes);
      }
    } finally {
      await fixture.cleanup();
    }
  });

  test.each([
    ['workspace-relative source', { type: 'workspace-relative', path: 'ai/Fixture-Machine/Views/001-bad' }],
    ['machine-relative canonical', { type: 'machine-relative', path: 'System/Views/001-bad' }],
  ])('rejects relocation-dependent external declaration: %s', async (_name, declaration) => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot, { rootDeclaration: declaration });
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'relocation_dependent_content_root' });
      expect(fs.existsSync(fixture.oldRoot)).toBe(true);
      expect(fs.existsSync(fixture.newRoot)).toBe(false);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test.each([
    ['existing retired-tree alias', (fixture, capsule) => fs.symlinkSync(capsule, path.join(fixture.projectRoot, 'external-alias'))],
    ['projected canonical-tree alias', (fixture) => fs.symlinkSync(
      fixture.newRoot,
      path.join(fixture.projectRoot, 'external-alias'),
    )],
  ])('rejects external declaration through a %s', async (_name, installAlias) => {
    const fixture = await createFixture();
    try {
      const capsule = writeCapsule(fixture.oldRoot, {
        rootDeclaration: { type: 'workspace-relative', path: 'external-alias' },
      });
      installAlias(fixture, capsule);
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'relocation_dependent_content_root' });
      expect(fs.existsSync(fixture.oldRoot)).toBe(true);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('allows a relative internal symlink and preserves its declaration', async () => {
    const fixture = await createFixture();
    try {
      const capsule = writeCapsule(fixture.oldRoot);
      fs.writeFileSync(path.join(capsule, 'target.txt'), 'target', 'utf8');
      fs.symlinkSync('target.txt', path.join(capsule, 'relative-link'));

      await serviceFor(fixture).ensureReady(requestFor(fixture));

      const moved = path.join(fixture.newRoot, '001-example-viewer');
      expect(fs.readlinkSync(path.join(moved, 'relative-link'))).toBe('target.txt');
    } finally {
      await fixture.cleanup();
    }
  });

  test.each([
    ['absolute internal', (fixture, capsule) => fs.symlinkSync(
      path.join(capsule, 'target.txt'), path.join(capsule, 'bad-link'),
    ), 'symlink_absolute_internal'],
    ['absolute internal alias', (fixture, capsule) => {
      const alias = path.join(fixture.tempRoot, 'internal-alias');
      fs.symlinkSync(path.join(capsule, 'target.txt'), alias);
      fs.symlinkSync(alias, path.join(capsule, 'bad-link'));
    }, 'symlink_absolute_internal'],
    ['absolute external', (fixture, capsule) => {
      const external = path.join(fixture.tempRoot, 'external.txt');
      fs.writeFileSync(external, 'external', 'utf8');
      fs.symlinkSync(external, path.join(capsule, 'bad-link'));
    }, 'symlink_escape'],
    ['broken absolute', (fixture, capsule) => fs.symlinkSync(
      path.join(fixture.tempRoot, 'missing-absolute.txt'), path.join(capsule, 'bad-link'),
    ), 'symlink_broken'],
    ['escaping relative', (fixture, capsule) => fs.symlinkSync(
      '../../../../outside.txt', path.join(capsule, 'bad-link'),
    ), 'symlink_escape'],
    ['broken relative', (fixture, capsule) => fs.symlinkSync(
      'missing.txt', path.join(capsule, 'bad-link'),
    ), 'symlink_broken'],
  ])('rejects %s symlink before a journal row', async (_name, installLink, code) => {
    const fixture = await createFixture();
    try {
      const capsule = writeCapsule(fixture.oldRoot);
      fs.writeFileSync(path.join(capsule, 'target.txt'), 'target', 'utf8');
      installLink(fixture, capsule);
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture))).rejects.toMatchObject({ code });
      expect(fs.existsSync(fixture.oldRoot)).toBe(true);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test.each([
    ['missing ID', (capsule) => fs.writeFileSync(path.join(capsule, 'manifest.md'), '---\nname: Missing\n---\n')],
    ['invalid ID', (capsule) => fs.writeFileSync(path.join(capsule, 'manifest.md'), '---\nmetadata:\n  view-id: Bad_ID\n---\n')],
    ['nested ID', (capsule) => fs.writeFileSync(
      path.join(capsule, 'manifest.md'),
      '---\nmetadata:\n  nested:\n    view-id: nested-identity\n---\n',
    )],
    ['prototype-key nested ID', (capsule) => fs.writeFileSync(
      path.join(capsule, 'manifest.md'),
      '---\nmetadata:\n  __proto__:\n    view-id: nested-identity\n---\n',
    )],
    ['duplicate direct ID key', (capsule) => fs.writeFileSync(
      path.join(capsule, 'manifest.md'),
      '---\nmetadata:\n  view-id: capture-viewer\n  view-id: file-viewer\n---\n',
    )],
    ['invalid root', (capsule) => writeJson(path.join(capsule, 'content.json'), {
      version: 1, root: { type: 'view-relative', path: '../../escape' },
    })],
  ])('fails strict preflight for %s', async (_name, mutate) => {
    const fixture = await createFixture();
    try {
      const capsule = writeCapsule(fixture.oldRoot);
      mutate(capsule);
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture))).rejects.toBeDefined();
      expect(fs.existsSync(fixture.oldRoot)).toBe(true);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('rejects duplicate manifest IDs and unsupported special files', async () => {
    const duplicate = await createFixture(null, 'duplicate');
    try {
      writeCapsule(duplicate.oldRoot);
      writeCapsule(duplicate.oldRoot, { folderName: '002-duplicate', viewId: 'example-viewer' });
      await expect(serviceFor(duplicate).ensureReady(requestFor(duplicate)))
        .rejects.toMatchObject({ code: 'view_id_duplicate' });
      expect(fs.existsSync(duplicate.oldRoot)).toBe(true);
    } finally {
      await duplicate.cleanup();
    }

    const special = await createFixture(null, 'special');
    try {
      const capsule = writeCapsule(special.oldRoot);
      const fifo = path.join(capsule, 'unsupported.fifo');
      const result = spawnSync('mkfifo', [fifo], { encoding: 'utf8' });
      expect(result.status).toBe(0);
      await expect(serviceFor(special).ensureReady(requestFor(special)))
        .rejects.toMatchObject({ code: 'special_file_unsupported' });
      expect(fs.existsSync(special.oldRoot)).toBe(true);
    } finally {
      await special.cleanup();
    }
  });

  test('validates top-level directory symlinks exactly like strict registry discovery', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      fs.symlinkSync(
        '001-example-viewer',
        path.join(fixture.oldRoot, '002-alias-viewer'),
      );

      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'view_id_duplicate' });
      expect(fs.existsSync(fixture.oldRoot)).toBe(true);
      expect(fs.existsSync(fixture.newRoot)).toBe(false);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('rejects a source tree reached through a symlinked workspace ancestor before journaling', async () => {
    const fixture = await createFixture();
    try {
      const externalAi = path.join(fixture.tempRoot, 'external-ai');
      fs.rmSync(path.join(fixture.projectRoot, 'ai'), { recursive: true, force: true });
      fs.mkdirSync(path.join(externalAi, fixture.machineIdentity), { recursive: true });
      fs.symlinkSync(externalAi, path.join(fixture.projectRoot, 'ai'));
      writeCapsule(fixture.oldRoot);

      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'root_ancestor_invalid' });
      expect(fs.existsSync(fixture.oldRoot)).toBe(true);
      expect(fs.existsSync(fixture.newRoot)).toBe(false);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('rejects a symlinked destination parent before journaling or moving the source', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      const externalSystem = path.join(fixture.tempRoot, 'external-system');
      fs.mkdirSync(externalSystem);
      fs.rmdirSync(path.dirname(fixture.newRoot));
      fs.symlinkSync(externalSystem, path.dirname(fixture.newRoot));

      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'destination_parent_invalid' });
      expect(fs.existsSync(fixture.oldRoot)).toBe(true);
      expect(fs.existsSync(fixture.newRoot)).toBe(false);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('rejects non-UTF-8 inventory path bytes instead of normalizing them', () => {
    expect(() => decodeEntryName(Buffer.from([0xff])))
      .toThrow(expect.objectContaining({ code: 'inventory_path_invalid' }));
  });

  test('rejects a projected cross-device rename before creating a journal row', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      const destinationParent = path.dirname(fixture.newRoot);
      const fakeFs = {
        ...fsPromises,
        async lstat(target, options) {
          const stat = await fsPromises.lstat(target, options);
          if (path.resolve(target) !== path.resolve(destinationParent)) return stat;
          return {
            ...stat,
            dev: stat.dev + 1n,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          };
        },
      };
      const service = createViewRelocationService({ db: fixture.db, fs: fakeFs });
      await expect(service.ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'cross_device' });
      expect(fs.existsSync(fixture.oldRoot)).toBe(true);
      expect(fs.existsSync(fixture.newRoot)).toBe(false);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });
});
