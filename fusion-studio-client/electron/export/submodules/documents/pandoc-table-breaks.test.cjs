'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { bridgePandocTableBreaks } = require('./pandoc-table-breaks.cjs');

function pandocPath() {
  return path.join(
    __dirname, '..', '..', '..', 'resources', 'pandoc', process.platform,
    process.platform === 'win32' ? 'pandoc.exe' : 'pandoc',
  );
}

function pandocAst(markdown) {
  const result = spawnSync(pandocPath(), ['-f', 'gfm', '-t', 'json'], {
    input: markdown,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

async function preparedFor(markdown) {
  const { bindOfficeTableSources } = await import('../../../shared/office-table-source-binding.mjs');
  const binding = await bindOfficeTableSources(
    markdown,
    async (bytes) => crypto.createHash('sha256').update(bytes).digest('hex'),
  );
  return {
    bodyMarkdown: markdown,
    sourceTables: binding.tables,
    tablePresentation: {
      markdownSha256: binding.markdownSha256,
      tables: binding.tables.map((source) => ({
        tableIndex: source.tableIndex,
        sourceSha256: source.sourceSha256,
        logicalWidth: source.logicalWidth,
        columns: null,
        overflow: 'newline',
        titleRow: false,
        borderWidth: 1,
        borderColor: 'default',
      })),
    },
  };
}

function collectByType(root, type, output = []) {
  if (root === null || typeof root !== 'object') return output;
  if (root.t === type) output.push(root);
  for (const value of Array.isArray(root) ? root : Object.values(root)) {
    collectByType(value, type, output);
  }
  return output;
}

test('[slice 11.3] trusted Pandoc bridge changes only exact table-cell HTML breaks', async () => {
  const markdown = [
    '| A | B |',
    '| --- | --- |',
    '| Alpha<br>Beta | Keep |',
    '',
    'Outside<br>break.',
    '',
  ].join('\n');
  const ast = pandocAst(markdown);
  const original = structuredClone(ast);
  const result = await bridgePandocTableBreaks(ast, await preparedFor(markdown));

  assert.deepEqual(ast, original, 'the caller-owned AST must not be mutated');
  assert.deepEqual(result.bridgedBreaks, [[[0, 0], [1, 0]]]);
  assert.equal(collectByType(result.ast, 'LineBreak').length, 1);
  const remainingRaw = collectByType(result.ast, 'RawInline');
  assert.equal(remainingRaw.length, 1);
  assert.deepEqual(remainingRaw[0].c, ['html', '<br>']);
});

test('[slice 11.3] bridge rejects semantic drift and leaves noncanonical raw HTML intact', async () => {
  const markdown = '| A | B |\n| --- | --- |\n| Alpha<br>Beta | Keep |\n';
  const ast = pandocAst(markdown);
  const prepared = await preparedFor(markdown);
  const drifted = structuredClone(ast);
  collectByType(drifted, 'Str').find((node) => node.c === 'Alpha').c = 'Altered';
  await assert.rejects(
    bridgePandocTableBreaks(drifted, prepared),
    (error) => error?.code === 'TABLE_PRESENTATION_MISMATCH',
  );

  const noncanonical = structuredClone(ast);
  collectByType(noncanonical, 'RawInline')[0].c[1] = '<br class="not-canonical">';
  const noncanonicalResult = await bridgePandocTableBreaks(noncanonical, prepared);
  assert.equal(collectByType(noncanonicalResult.ast, 'LineBreak').length, 0);
  assert.equal(collectByType(noncanonicalResult.ast, 'RawInline').length, 1);
});

test('[slice 11.3] bridge skips ignored image/note subtrees and follows formatting/link routes', async () => {
  const markdown = [
    '| A | B |',
    '| --- | --- |',
    '| ![A<br>B](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=) | [**Visible<br>Break**](https://example.com) |',
    '',
  ].join('\n');
  const ast = pandocAst(markdown);
  const original = structuredClone(ast);
  const result = await bridgePandocTableBreaks(ast, await preparedFor(markdown));

  assert.deepEqual(ast, original);
  assert.deepEqual(result.bridgedBreaks, [[[0, 0], [0, 1]]]);
  const image = collectByType(result.ast, 'Image')[0];
  assert.ok(image);
  assert.equal(collectByType(image, 'RawInline').length, 1);
  assert.equal(collectByType(image, 'LineBreak').length, 0);
  const link = collectByType(result.ast, 'Link')[0];
  assert.ok(link);
  assert.equal(collectByType(link, 'LineBreak').length, 1);

  const noteAst = structuredClone(ast);
  const firstCellPlain = collectByType(noteAst, 'Plain')[2];
  assert.ok(firstCellPlain);
  firstCellPlain.c.push({
    t: 'Note',
    c: [{ t: 'Para', c: [{ t: 'RawInline', c: ['html', '<br>'] }] }],
  });
  const prepared = await preparedFor(markdown);
  const noteResult = await bridgePandocTableBreaks(noteAst, prepared);
  const note = collectByType(noteResult.ast, 'Note')[0];
  assert.equal(collectByType(note, 'RawInline').length, 1);
  assert.equal(collectByType(note, 'LineBreak').length, 0);
});
