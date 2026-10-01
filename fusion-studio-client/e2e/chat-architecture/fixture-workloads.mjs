import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DENSE_ASSISTANT_BYTES = 522 * 1024;
const MIN_WORKSPACE_BYTES = 10 * 1024 * 1024;

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function deterministicText(label, bytes) {
  const line = `${label} :: deterministic Fusion Studio chat architecture workload; no private content.\n`;
  return line.repeat(Math.ceil(bytes / Buffer.byteLength(line))).slice(0, bytes);
}

function writeFixtureFile(root, relativePath, bytes) {
  const absolutePath = path.join(root, relativePath);
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(absolutePath);
  if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`fixture path escaped root: ${relativePath}`);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const content = deterministicText(relativePath, bytes);
  fs.writeFileSync(absolutePath, content);
  return { relativePath, bytes: Buffer.byteLength(content), sha256: sha256(content) };
}

function writeFixtureContent(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(absolutePath);
  if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`fixture path escaped root: ${relativePath}`);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  return { relativePath, bytes: Buffer.byteLength(content), sha256: sha256(content) };
}

function materializeView(root, prefix, id, name, viewType, dataSource) {
  const base = `ai/RC-MacAir-15/System/Views/${prefix}-${id}`;
  return [
    writeFixtureContent(root, `${base}/manifest.md`, [
      '---',
      `name: "${name}"`,
      'description: Deterministic chat architecture action fixture.',
      'metadata:',
      `  view-id: ${id}`,
      `  view-type: ${viewType}`,
      `  data-source: ${dataSource}`,
      '  enabled: true',
      '---',
      '',
    ].join('\n')),
    writeFixtureContent(root, `${base}/state/state.json`, '{"widths":{"leftSidebar":220,"leftChat":320},"collapsed":{"leftSidebar":false,"leftChat":false}}\n'),
    writeFixtureContent(root, `${base}/styles/icon.md`, `---\nmetadata:\n  icon-name: ${id === 'system-viewer' ? 'settings' : 'description'}\n---\n`),
  ];
}

export function buildF2Exchanges() {
  const exchanges = [];
  for (let index = 1; index <= 30; index += 1) {
    const markdown = [
      `## Deterministic exchange ${index}`,
      '',
      'Paragraph text used only by the synthetic architecture workload.',
      '',
      '- first list item',
      '- second list item',
      '',
      '| column | value |',
      '| --- | --- |',
      `| exchange | ${index} |`,
      '',
      '```js',
      `const exchange = ${index};`,
      '```',
    ].join('\n');
    exchanges.push({
      seq: index,
      user: `Synthetic user request ${index}`,
      assistant: {
        parts: [
          { type: 'text', content: markdown },
          {
            type: 'tool_call', toolCallId: `fixture-tool-${index}`, name: 'read',
            arguments: { path: `fixture/files/file-${String(index).padStart(4, '0')}.txt` },
            result: { output: `collapsed deterministic tool result ${index}`, statusMessage: 'Fixture read completed' },
          },
        ],
      },
      metadata: { bookmark: index % 3 === 0 ? { type: 'star' } : null, note: { body: `reply metadata ${index}` } },
    });
  }
  const denseText = deterministicText('F2 dense assistant payload', DENSE_ASSISTANT_BYTES);
  const dense = [
    { seq: 1, user: 'Synthetic dense request one', assistant: { parts: [{ type: 'text', content: denseText }] }, metadata: {} },
    { seq: 2, user: 'Synthetic dense request two', assistant: { parts: [{ type: 'text', content: 'Dense fixture terminal response.' }] }, metadata: {} },
  ];
  const manifest = {
    id: 'F2-DETERMINISTIC-HISTORY-V1',
    exchanges: exchanges.length,
    renderedMessages: exchanges.length * 2,
    includes: ['text', 'code', 'lists', 'tables', 'collapsed-tool-results', 'reply-metadata'],
    dense: { exchanges: 2, assistantPayloadBytes: Buffer.byteLength(denseText), sha256: sha256(denseText) },
  };
  if (manifest.dense.assistantPayloadBytes !== DENSE_ASSISTANT_BYTES) throw new Error('dense fixture byte count drifted');
  return { exchanges, dense, manifest };
}

export function materializeF3Workspace(projectRoot) {
  const files = [];
  for (let index = 1; index <= 1_000; index += 1) {
    files.push(writeFixtureFile(projectRoot, `fixture/files/file-${String(index).padStart(4, '0')}.txt`, 8_192));
  }
  for (let index = 1; index <= 100; index += 1) {
    files.push(writeFixtureFile(projectRoot, `ai/RC-MacAir-15/Captures/${String(index).padStart(3, '0')}-Fixture/PAGE.md`, 12_288));
  }
  for (let index = 1; index <= 100; index += 1) {
    files.push(writeFixtureFile(projectRoot, `ai/RC-MacAir-15/Wiki/${String(index).padStart(3, '0')}-Fixture/PAGE.md`, 12_288));
  }
  for (let index = 1; index <= 20; index += 1) {
    files.push(writeFixtureFile(projectRoot, `ai/RC-MacAir-15/Office/Fixture/fixture-document-${String(index).padStart(2, '0')}.md`, 20_480));
  }
  const supportFiles = materializeView(projectRoot, '009', 'office-viewer', 'Drive', 'office', 'Office');
  supportFiles.push(writeFixtureContent(projectRoot, 'ai/RC-MacAir-15/System/Views/009-office-viewer/content.json',
    '{"version":1,"dataSource":"Office","root":{"type":"workspace-relative","path":"ai/${machine}/Office"}}\n'));
  supportFiles.push(...materializeView(projectRoot, '010', 'system-viewer', 'System', 'system', 'project-root'));
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes < MIN_WORKSPACE_BYTES) throw new Error(`F3 content is below 10 MiB: ${totalBytes}`);
  const manifest = {
    id: 'F3-DETERMINISTIC-WORKSPACE-V1',
    algorithm: 'label-repeated-to-fixed-byte-count',
    counts: { smallFiles: 1_000, captureFolders: 100, wikiPages: 100, officeDocuments: 20 },
    totalFiles: files.length,
    totalContentBytes: totalBytes,
    root: projectRoot,
    everyPathFixtureContained: files.every((file) => path.resolve(projectRoot, file.relativePath).startsWith(`${path.resolve(projectRoot)}${path.sep}`)),
    files,
    supportFiles,
  };
  manifest.manifestHash = sha256(`${JSON.stringify({ ...manifest, root: '<fixture-root>', files, supportFiles }, null, 2)}\n`);
  return manifest;
}

export function f4Manifest() {
  return {
    id: 'F4-MOUNT-MATRIX-V1',
    cases: [
      { id: 'F4-SAME-SESSION-DUPLICATE', session: 'session-a', mounts: ['main-a', 'duplicate-a'], states: ['visible', 'inactive-mounted'] },
      { id: 'F4-TWO-SESSIONS-VIEWS', sessions: ['session-a', 'session-b'], views: ['capture-viewer', 'wiki-viewer'] },
      { id: 'F4-SIDE-AFTER-MOVE', group: 'group-a', primary: 'session-b', side: 'session-a', placement: 'side-placement-a' },
    ],
  };
}

export const F5_MANIFEST = Object.freeze({
  id: 'F5-CANONICAL-ADAPTER-V1', frameIntervalMs: 50, framesPerSecond: 20,
  maxTextFrameBytes: 200, events: ['thinking', 'tool', 'usage', 'terminal'],
  faults: ['before-admission', 'after-admission', 'before-ack', 'after-ack', 'before-dispatch', 'after-dispatch',
    'before-turn-begin', 'after-turn-begin', 'before-stop', 'after-stop', 'before-save-ack', 'after-save-ack',
    'before-shutdown', 'after-shutdown'],
});
