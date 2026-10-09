'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../lib/workspace/create-service', () => ({
  getSystemSourceRoot: jest.fn(() => '/unused'),
  getAiTemplateViewsRoot: jest.fn(() => '/unused'),
  readManifest: jest.fn(() => ({ views: [] })),
  copyTemplateDirectory: jest.fn(),
}));

const views = require('../../lib/views');
const {
  parseCanonicalViewId,
  canonicalViewIdsEqual,
} = require('../../lib/views/view-id');
const { buildViewCapsulesProjection: assembleProjection } = require('../../lib/views/view-capsules-projection');
const { parseSimpleYaml } = require('../../lib/views/simple-yaml');

function writeCapsule(projectRoot, folderName, manifestId) {
  const root = path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'Views', folderName);
  fs.mkdirSync(root, { recursive: true });
  const idLine = manifestId === undefined ? '' : `  view-id: ${manifestId}\n`;
  fs.writeFileSync(path.join(root, 'manifest.md'), `---\nname: Fixture\nmetadata:\n${idLine}  view-type: react\n---\n`);
  return root;
}

describe('canonical view identity and path-free projection', () => {
  let projectRoot;
  let previousMachine;

  beforeEach(() => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'Test-Machine';
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view-identity-'));
  });

  afterEach(() => {
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  test('accepts only already-canonical ASCII IDs and compares exact bytes', () => {
    expect(parseCanonicalViewId('capture-viewer')).toBe('capture-viewer');
    expect(parseCanonicalViewId('a'.repeat(128))).toBe('a'.repeat(128));
    expect(canonicalViewIdsEqual('capture-viewer', 'capture-viewer')).toBe(true);

    for (const invalid of [
      '', ' Capture-viewer', 'capture-viewer ', 'Capture-viewer', 'capture_viewer',
      '-capture', 'capture-', 'capture--viewer', 'café', 'cafe\u0301', 'a'.repeat(129),
      null, 1, {},
    ]) {
      expect(() => parseCanonicalViewId(invalid)).toThrow('invalid metadata.view-id');
    }
  });

  test('preserves YAML scalar types before canonical identity validation', () => {
    expect(parseSimpleYaml('metadata:\n  view-id: 123')).toEqual({
      metadata: { 'view-id': 123 },
    });
    expect(parseSimpleYaml('metadata:\n  view-id: 0x10')).toEqual({
      metadata: { 'view-id': 16 },
    });
    expect(parseSimpleYaml('metadata:\n  view-id: 0o10')).toEqual({
      metadata: { 'view-id': 8 },
    });
    expect(parseSimpleYaml('metadata:\n  view-id: "123"')).toEqual({
      metadata: { 'view-id': '123' },
    });
    expect(parseSimpleYaml('metadata:\n  view-id: "0x10"')).toEqual({
      metadata: { 'view-id': '0x10' },
    });
    const escaped = 'A"B\\C\nD\u0000E';
    expect(parseSimpleYaml(`name: ${JSON.stringify(escaped)}`)).toEqual({ name: escaped });
    expect(parseSimpleYaml('metadata:\n  nested:\n    view-id: nested-identity')).toEqual({
      metadata: { nested: { 'view-id': 'nested-identity' } },
    });
    const prototypeKey = parseSimpleYaml('metadata:\n  __proto__:\n    view-id: nested-identity');
    expect(Object.getPrototypeOf(prototypeKey)).toBe(null);
    expect(Object.getPrototypeOf(prototypeKey.metadata)).toBe(null);
    expect(Object.hasOwn(prototypeKey.metadata, 'view-id')).toBe(false);
    expect(prototypeKey.metadata['view-id']).toBeUndefined();
    expect(() => parseSimpleYaml('metadata: inline\n  view-id: nested-identity'))
      .toThrow('invalid YAML indentation');
    expect(() => parseSimpleYaml('metadata:\n  view-id: capture-viewer\n  view-id: file-viewer'))
      .toThrow('duplicate YAML mapping key');
  });

  test('strict discovery rejects a nested value masquerading as direct metadata.view-id', () => {
    const capsule = writeCapsule(projectRoot, '001-nested-viewer', undefined);
    fs.writeFileSync(
      path.join(capsule, 'manifest.md'),
      '---\nmetadata:\n  nested:\n    view-id: nested-identity\n---\n',
    );
    expect(() => views.listViews(projectRoot, { strictReadiness: true }))
      .toThrow('invalid metadata.view-id');
  });

  test('strict discovery rejects prototype-key nesting masquerading as direct metadata.view-id', () => {
    const capsule = writeCapsule(projectRoot, '001-prototype-viewer', undefined);
    fs.writeFileSync(
      path.join(capsule, 'manifest.md'),
      '---\nmetadata:\n  __proto__:\n    view-id: nested-identity\n---\n',
    );
    expect(() => views.listViews(projectRoot, { strictReadiness: true }))
      .toThrow('invalid metadata.view-id');
  });

  test('strict discovery rejects duplicate direct metadata.view-id keys', () => {
    const capsule = writeCapsule(projectRoot, '001-duplicate-key-viewer', undefined);
    fs.writeFileSync(
      path.join(capsule, 'manifest.md'),
      '---\nmetadata:\n  view-id: capture-viewer\n  view-id: file-viewer\n---\n',
    );
    expect(() => views.listViews(projectRoot, { strictReadiness: true }))
      .toThrow('invalid metadata.view-id');
  });

  test.each([
    ['missing', undefined, null],
    ['noncanonical', 'Capture-Viewer', null],
    ['duplicate', 'capture-viewer', 'capture-viewer'],
  ])('strict discovery rejects %s manifest identity', (_name, firstId, secondId) => {
    writeCapsule(projectRoot, '001-capture-viewer', firstId);
    if (secondId !== null) writeCapsule(projectRoot, '002-other-folder', secondId);
    expect(() => views.listViews(projectRoot, { strictReadiness: true }))
      .toThrow(/invalid metadata\.view-id|Duplicate metadata\.view-id/);
  });

  test.each([
    ['decimal', '123', '"123"'],
    ['hexadecimal', '0x10', '"0x10"'],
    ['octal', '0o10', '"0o10"'],
  ])('strict discovery rejects an unquoted %s YAML id but accepts the quoted string', (_kind, raw, quoted) => {
    writeCapsule(projectRoot, '001-number-view', raw);
    expect(() => views.listViews(projectRoot, { strictReadiness: true }))
      .toThrow('invalid metadata.view-id');

    fs.rmSync(path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'Views'), { recursive: true, force: true });
    writeCapsule(projectRoot, '001-number-view', quoted);
    expect(views.listViews(projectRoot, { strictReadiness: true })).toEqual([
      quoted.slice(1, -1),
    ]);
  });

  test('ordinary discovery and resolution never infer identity from a folder name', () => {
    writeCapsule(projectRoot, '001-folder-inferred-id', undefined);

    const ordinaryCalls = [
      () => views.listViews(projectRoot),
      () => views.listViews(projectRoot, { strictReadiness: false }),
      () => views.loadView(projectRoot, 'folder-inferred-id', { includeHidden: true }),
      () => views.loadAllViews(projectRoot),
      () => views.resolveContentPath(projectRoot, 'folder-inferred-id', { includeHidden: true }),
      () => views.resolveOperationalViewRoot(projectRoot, 'folder-inferred-id'),
      () => views.resolveChatConfig(projectRoot, 'folder-inferred-id'),
    ];
    for (const invoke of ordinaryCalls) {
      expect(invoke).toThrow('invalid metadata.view-id');
    }
  });

  test('ordinary discovery uses immutable manifest identity across folder rename', () => {
    const capsule = writeCapsule(projectRoot, '001-presentation-only-name', 'capture-viewer');
    expect(views.listViews(projectRoot)).toEqual(['capture-viewer']);
    expect(views.loadView(projectRoot, 'capture-viewer', { includeHidden: true })).toMatchObject({
      id: 'capture-viewer',
      viewRoot: capsule,
    });
    expect(views.loadView(projectRoot, 'presentation-only-name', { includeHidden: true })).toBeNull();
  });

  test('ordinary discovery rejects duplicate immutable manifest identities', () => {
    writeCapsule(projectRoot, '001-first-presentation-name', 'capture-viewer');
    writeCapsule(projectRoot, '002-second-presentation-name', 'capture-viewer');
    expect(() => views.listViews(projectRoot)).toThrow('Duplicate metadata.view-id');
    expect(() => views.loadView(projectRoot, 'capture-viewer', { includeHidden: true }))
      .toThrow('Duplicate metadata.view-id');
  });

  test('builds one bounded path-free projection from strict server discovery', () => {
    writeCapsule(projectRoot, '010-capture-viewer', 'capture-viewer');
    writeCapsule(projectRoot, '020-file-viewer', 'file-viewer');

    const projection = views.buildViewCapsulesProjection(projectRoot, 'workspace-123');
    expect(projection).toEqual({
      version: 1,
      workspaceId: 'workspace-123',
      machineIdentity: 'Test-Machine',
      entries: [
        { viewId: 'capture-viewer', folderName: '010-capture-viewer' },
        { viewId: 'file-viewer', folderName: '020-file-viewer' },
      ],
    });
    expect(JSON.stringify(projection)).not.toContain(projectRoot);
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.entries)).toBe(true);
  });

  test('projection rejects unsafe folder basenames and missing roots', () => {
    writeCapsule(projectRoot, '001-bad\\folder', 'capture-viewer');
    expect(() => views.buildViewCapsulesProjection(projectRoot, 'workspace-123'))
      .toThrow('invalid folder basename');
    expect(() => views.buildViewCapsulesProjection(projectRoot, 'workspace-123', { machineIdentity: '..' }))
      .toThrow('canonical machine identity');

    const emptyProject = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view-empty-'));
    try {
      expect(() => views.buildViewCapsulesProjection(emptyProject, 'workspace-123'))
        .toThrow('root is unavailable');
    } finally {
      fs.rmSync(emptyProject, { recursive: true, force: true });
    }
  });

  test('projection enforces the server-side entry bound', () => {
    const entries = Array.from({ length: 257 }, (_, index) => ({
      id: `view-${index}`,
      folderName: `${String(index).padStart(3, '0')}-view-${index}`,
    }));
    expect(() => assembleProjection({
      workspaceId: 'workspace-123',
      machineIdentity: 'Test-Machine',
      entries,
    })).toThrow('entry limit');
  });
});
