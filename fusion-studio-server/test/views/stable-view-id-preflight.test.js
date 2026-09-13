'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runStableViewIdPreflight,
} = require('../../lib/views/stable-view-id-preflight');
const { parseSimpleYaml } = require('../../lib/views/simple-yaml');

const MACHINE = 'Fixture-Machine';

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'view-id-preflight-'));
  fs.mkdirSync(path.join(root, 'ai', MACHINE, 'System', 'Views'), { recursive: true });
  return root;
}

function writeCapsule(root, folderName, lines, body = '') {
  const capsule = path.join(root, 'ai', MACHINE, 'System', 'Views', folderName);
  fs.mkdirSync(path.join(capsule, 'state'), { recursive: true });
  fs.writeFileSync(path.join(capsule, 'manifest.md'), lines, 'utf8');
  fs.writeFileSync(path.join(capsule, 'state', 'state.json'), '{"keep":true}\n', 'utf8');
  if (body) fs.writeFileSync(path.join(capsule, 'body.txt'), body, 'utf8');
  return capsule;
}

function readFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const match = text.match(/^---\s*\n([\s\S]*?)\n---([\s\S]*)$/);
  return { frontmatter: parseSimpleYaml(match[1]), body: match[2] };
}

describe('stable view-id preflight', () => {
  let root;

  beforeEach(() => {
    root = makeWorkspace();
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('present-but-invalid ID stops before any write and leaves bytes untouched', () => {
    const capsule = writeCapsule(root, '003-bad-viewer', [
      '---',
      'name: Bad',
      'metadata:',
      '  view-id: Bad_ID',
      '  data-source: Captures',
      '---',
      'Body.',
    ].join('\n'));
    const before = fs.readFileSync(path.join(capsule, 'manifest.md'), 'utf8');

    const result = runStableViewIdPreflight(root, { mintId: () => 'view-should-not-be-used' });
    expect(result.ok).toBe(false);
    expect(result.assigned).toEqual([]);
    expect(result.diagnostics.some((entry) => /Invalid metadata\.view-id/.test(entry.message))).toBe(true);
    expect(fs.readFileSync(path.join(capsule, 'manifest.md'), 'utf8')).toBe(before);

    // Repairing the manifest to a valid ID grandfathered on the next run.
    fs.writeFileSync(path.join(capsule, 'manifest.md'), before.replace('Bad_ID', 'bad-viewer'), 'utf8');
    const repaired = runStableViewIdPreflight(root, { mintId: () => 'view-should-not-be-used' });
    expect(repaired.ok).toBe(true);
    expect(repaired.viewIds).toEqual(['bad-viewer']);
  });

  test('unwritable capsule stops with a repair diagnostic and no partial write', () => {
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      // Root bypasses POSIX directory write bits; the branch is still proven by
      // the injected-writer failure note in the handoff.
      return;
    }
    const capsule = writeCapsule(root, '005-readonly-viewer', [
      '---',
      'name: Readonly',
      'metadata:',
      '  data-source: Captures',
      '---',
      '',
    ].join('\n'));
    const before = fs.readFileSync(path.join(capsule, 'manifest.md'), 'utf8');
    fs.chmodSync(capsule, 0o555);
    try {
      const result = runStableViewIdPreflight(root, { mintId: () => 'view-readonly-1' });
      expect(result.ok).toBe(false);
      expect(result.diagnostics.some((entry) => /Unable to assign metadata\.view-id/.test(entry.message))).toBe(true);
      expect(fs.readFileSync(path.join(capsule, 'manifest.md'), 'utf8')).toBe(before);
    } finally {
      fs.chmodSync(capsule, 0o755);
    }
  });

  test('assigns an ID when the manifest has no frontmatter block', () => {
    const capsule = writeCapsule(root, '004-plain', 'Plain body without frontmatter.\n');
    const result = runStableViewIdPreflight(root, { mintId: () => 'view-plain-1' });
    expect(result.ok).toBe(true);
    expect(result.viewIds).toEqual(['view-plain-1']);
    const { frontmatter } = readFrontmatter(path.join(capsule, 'manifest.md'));
    expect(frontmatter.metadata['view-id']).toBe('view-plain-1');
  });

  test('grandfathers valid IDs and is a no-op on re-run', () => {
    writeCapsule(root, '001-alpha-viewer', [
      '---',
      'name: Alpha',
      'metadata:',
      '  view-id: alpha-viewer',
      '  data-source: Captures',
      '---',
      '',
    ].join('\n'));
    const before = fs.readFileSync(
      path.join(root, 'ai', MACHINE, 'System', 'Views', '001-alpha-viewer', 'manifest.md'),
      'utf8',
    );

    const first = runStableViewIdPreflight(root, { mintId: () => 'view-fixed' });
    expect(first.ok).toBe(true);
    expect(first.assigned).toEqual([]);
    expect(first.viewIds).toEqual(['alpha-viewer']);

    const second = runStableViewIdPreflight(root, { mintId: () => 'view-fixed' });
    expect(second.ok).toBe(true);
    expect(second.assigned).toEqual([]);
    const after = fs.readFileSync(
      path.join(root, 'ai', MACHINE, 'System', 'Views', '001-alpha-viewer', 'manifest.md'),
      'utf8',
    );
    expect(after).toBe(before);
  });

  test('assigns an opaque ID atomically while preserving keys, body, and sibling files', () => {
    const capsule = writeCapsule(root, '002-capture-viewer', [
      '---',
      'name: Captures',
      'description: keep me',
      'metadata:',
      '  data-source: Captures',
      '  icon-name: folder',
      '---',
      'Body content that must survive.',
    ].join('\n'), 'sibling');

    const result = runStableViewIdPreflight(root, { mintId: () => 'view-opaque-1' });
    expect(result.ok).toBe(true);
    expect(result.assigned).toEqual([{ capsule: '002-capture-viewer', viewId: 'view-opaque-1' }]);

    const { frontmatter, body } = readFrontmatter(path.join(capsule, 'manifest.md'));
    expect(frontmatter.name).toBe('Captures');
    expect(frontmatter.description).toBe('keep me');
    expect(frontmatter.metadata['view-id']).toBe('view-opaque-1');
    expect(frontmatter.metadata['data-source']).toBe('Captures');
    expect(frontmatter.metadata['icon-name']).toBe('folder');
    expect(body).toContain('Body content that must survive.');
    expect(fs.readFileSync(path.join(capsule, 'state', 'state.json'), 'utf8')).toBe('{"keep":true}\n');
    expect(fs.readFileSync(path.join(capsule, 'body.txt'), 'utf8')).toBe('sibling');
  });

  test('duplicate valid IDs stop activation with a repair diagnostic', () => {
    for (const folder of ['001-one', '002-two']) {
      writeCapsule(root, folder, [
        '---',
        'name: Dup',
        'metadata:',
        '  view-id: dup-viewer',
        '---',
        '',
      ].join('\n'));
    }
    const result = runStableViewIdPreflight(root);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((entry) => /Duplicate metadata\.view-id/.test(entry.message))).toBe(true);
  });

  test('unparseable frontmatter stops before any write', () => {
    const capsule = writeCapsule(root, '001-broken', [
      '---',
      'name: Broken',
      '  bad: indentation',
      '---',
      '',
    ].join('\n'));
    const before = fs.readFileSync(path.join(capsule, 'manifest.md'), 'utf8');
    const result = runStableViewIdPreflight(root);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(fs.readFileSync(path.join(capsule, 'manifest.md'), 'utf8')).toBe(before);
  });

  test('folder rename preserves assigned identity', () => {
    writeCapsule(root, '001-named-viewer', [
      '---',
      'name: Named',
      'metadata:',
      '  data-source: Captures',
      '---',
      '',
    ].join('\n'));
    const first = runStableViewIdPreflight(root, { mintId: () => 'view-stable-1' });
    expect(first.viewIds).toEqual(['view-stable-1']);

    const viewsRoot = path.join(root, 'ai', MACHINE, 'System', 'Views');
    fs.renameSync(path.join(viewsRoot, '001-named-viewer'), path.join(viewsRoot, '009-named-viewer'));

    const second = runStableViewIdPreflight(root, { mintId: () => 'view-should-not-be-used' });
    expect(second.ok).toBe(true);
    expect(second.assigned).toEqual([]);
    expect(second.viewIds).toEqual(['view-stable-1']);
  });
});
