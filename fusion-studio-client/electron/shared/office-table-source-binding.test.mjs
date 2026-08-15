import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  bindOfficeTableSources,
  getOfficeDescriptorByteLimit,
} from './office-table-source-binding.mjs'
import { PRESENTATION_OUTPUT_CANONICAL } from '../../e2e/office/fixture-scenarios.mjs'

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const helperPath = path.join(clientRoot, 'electron', 'shared', 'office-table-source-binding.mjs')
const sha256Hex = async (bytes) => createHash('sha256').update(bytes).digest('hex')
const literalHash = (value) => createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex')

test('[slice 11.1] exact GFM source vectors retain offsets, hashes, semantics, and child counts', async () => {
  const vectors = [
    '| A | B |\n| --- | --- |\n| one | two |',
    '| Title |  |  |\n| --- | --- | --- |\n| H1 | H2 | H3 |\n| A | B | C |',
    '| Stale | KEEP ME |  |\n| --- | --- | --- |\n| A | B | C |',
    'Préface 🧪\r\n\r\n| Café\u0301 | Code |\r\n| --- | --- |\r\n| A&nbsp; B | `x`<br>y |\r\n',
    '| D | D |\n| --- | --- |\n| x | y |\n\ntext\n\n| D | D |\n| --- | --- |\n| x | y |',
  ]
  for (const markdown of vectors) {
    const bound = await bindOfficeTableSources(markdown, sha256Hex)
    assert.equal(bound.markdownSha256, literalHash(markdown))
    bound.tables.forEach((table, tableIndex) => {
      assert.equal(table.tableIndex, tableIndex)
      assert.equal(
        table.sourceSha256,
        literalHash(markdown.slice(table.startOffset, table.endOffset)),
      )
      assert.equal(table.semanticRows.length, table.cellChildCounts.length)
      table.semanticRows.forEach((row) => assert.equal(row.length, table.logicalWidth))
      table.cellChildCounts.forEach((row) => assert.equal(row.length, table.logicalWidth))
    })
  }

  const duplicate = await bindOfficeTableSources(vectors[4], sha256Hex)
  assert.equal(duplicate.tables.length, 2)
  assert.equal(duplicate.tables[0].sourceSha256, duplicate.tables[1].sourceSha256)
  assert.deepEqual(duplicate.tables.map((table) => table.tableIndex), [0, 1])
  const unicode = await bindOfficeTableSources(vectors[3], sha256Hex)
  assert.deepEqual(unicode.tables[0].semanticRows[1], ['A B', 'x\ny'])
})

test('[slice 11.1] SHA injection and descriptor byte arithmetic fail closed', async () => {
  await assert.rejects(
    bindOfficeTableSources('| A |\n| --- |\n| B |', async () => 'A'.repeat(64)),
    /invalid digest/,
  )
  assert.equal(getOfficeDescriptorByteLimit(10, 2, 3), 1642)
  assert.equal(
    getOfficeDescriptorByteLimit(Number.MAX_SAFE_INTEGER, 0, 0),
    Number.MAX_SAFE_INTEGER,
  )
  assert.throws(() => getOfficeDescriptorByteLimit(-1, 0, 0), /nonnegative safe integer/)
})

test('[slice 11.1] presentation fixture hashes are independently recomputed from its literal table bytes', async () => {
  const bodyStart = PRESENTATION_OUTPUT_CANONICAL.indexOf('\n---\n', 4) + '\n---\n'.length
  assert(bodyStart > 4)
  const body = PRESENTATION_OUTPUT_CANONICAL.slice(bodyStart)
  const expectedSources = []
  for (const titleKind of ['ordinary', 'title']) {
    for (const borderKind of ['real', 'none']) {
      for (const width of [1, 2, 3, 4]) {
        for (const mode of ['overflow', 'truncate', 'newline']) {
          const id = `po-${titleKind}-${borderKind}-${width}px-${mode}`
          const lines = titleKind === 'title'
            ? [
              `| Title ${id} |  |  |`,
              '| :--- | :---: | ---: |',
              '| Label | Break | Long |',
            ]
            : ['| Label | Break | Long |', '| :--- | :---: | ---: |']
          lines.push(`| ${id}-label | AlphaSegmentABCDEFGHIJ<br>BetaSegmentKLMNOPQRST | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz |`)
          expectedSources.push(lines.join('\n'))
        }
      }
    }
  }
  expectedSources.push([
    '| Label | Break | Long |',
    '| :--- | :---: | ---: |',
    '| po-default-keyless-label | AlphaSegmentABCDEFGHIJ<br>BetaSegmentKLMNOPQRST | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz |',
  ].join('\n'))
  expectedSources.push([
    '| Stale Title | KEEP ME |  |',
    '| :--- | :---: | ---: |',
    '| Label | Break | Long |',
    '| po-stale-title-label | AlphaSegmentABCDEFGHIJ<br>BetaSegmentKLMNOPQRST | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz |',
  ].join('\n'))

  const binding = await bindOfficeTableSources(body, sha256Hex)
  assert.equal(binding.markdownSha256, literalHash(body))
  assert.equal(binding.tables.length, 50)
  assert.deepEqual(
    binding.tables.map((table) => table.sourceSha256),
    expectedSources.map(literalHash),
  )
  binding.tables.forEach((table, index) => {
    assert.equal(body.slice(table.startOffset, table.endOffset), expectedSources[index])
  })
})

test('[slice 11.1] packaged path, direct dependencies, CJS dynamic import, and declaration resolution are present', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(clientRoot, 'package.json'), 'utf8'))
  assert(packageJson.build.files.includes('electron/**/*'))
  for (const name of [
    'mdast-util-from-markdown',
    'mdast-util-gfm',
    'micromark-extension-gfm',
    'parse5',
    'fflate',
    '@xmldom/xmldom',
  ]) assert.equal(typeof packageJson.dependencies[name], 'string')
  assert.equal(typeof packageJson.devDependencies['pdfjs-dist'], 'string')
  assert(fs.existsSync(helperPath.replace(/\.mjs$/, '.d.mts')))

  const dynamicImport = spawnSync(process.execPath, ['-e', [
    `import(${JSON.stringify(pathToFileURL(helperPath).href)})`,
    ".then((module) => { if (typeof module.bindOfficeTableSources !== 'function') process.exit(2) })",
    '.catch(() => process.exit(3))',
  ].join('')], { cwd: clientRoot, encoding: 'utf8' })
  assert.equal(dynamicImport.status, 0, dynamicImport.stderr)

  const typecheck = spawnSync(path.join(clientRoot, 'node_modules', '.bin', 'tsc'), [
    '--noEmit', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--target', 'ES2022',
    path.join(clientRoot, 'src', 'components', 'office', 'officeTableOutputDescriptor.ts'),
  ], { cwd: clientRoot, encoding: 'utf8' })
  assert.equal(typecheck.status, 0, typecheck.stdout + typecheck.stderr)
})
