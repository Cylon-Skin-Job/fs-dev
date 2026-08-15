import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const [asarPath] = process.argv.slice(2)
assert.equal(typeof asarPath, 'string', 'Packaged app.asar path is required')
assert.equal(path.basename(asarPath), 'app.asar')
// Electron's Node mode mounts app.asar as a virtual directory. The parent
// verifier separately proves the host path itself is one physical archive.
assert.equal(fs.statSync(asarPath).isDirectory(), true)

const packagedRequire = createRequire(path.join(asarPath, 'package.json'))
for (const dependency of ['@xmldom/xmldom', 'fflate', 'parse5']) {
  const resolved = packagedRequire.resolve(dependency)
  assert.ok(resolved.startsWith(`${asarPath}${path.sep}`), `${dependency} resolved outside app.asar: ${resolved}`)
}

const sourceBindingPath = path.join(asarPath, 'electron', 'shared', 'office-table-source-binding.mjs')
const htmlModulePath = path.join(
  asarPath, 'electron', 'export', 'submodules', 'documents', 'table-presentation.cjs',
)
const docxModulePath = path.join(
  asarPath, 'electron', 'export', 'submodules', 'documents', 'docx-table-presentation.cjs',
)
for (const candidate of [sourceBindingPath, htmlModulePath, docxModulePath]) {
  assert.ok(candidate.startsWith(`${asarPath}${path.sep}`))
  assert.equal(fs.statSync(candidate).isFile(), true)
}

const { bindOfficeTableSources } = await import(pathToFileURL(sourceBindingPath).href)
const {
  parseOfficeTablePresentation,
  transformOfficeTablePresentation,
} = packagedRequire(htmlModulePath)
const {
  createOfficeDocxBuilder,
  inspectOfficeDocxPresentation,
} = packagedRequire(docxModulePath)

const bodyMarkdown = '| A | B |\n| --- | --- |\n| one | two |'
const source = await bindOfficeTableSources(
  bodyMarkdown,
  async (bytes) => crypto.createHash('sha256').update(bytes).digest('hex'),
)
assert.equal(source.tables.length, 1)
assert.equal(source.tables[0].logicalWidth, 2)
assert.equal(source.tables[0].sourceSha256, crypto.createHash('sha256').update(bodyMarkdown).digest('hex'))

const tablePresentation = {
  markdownSha256: source.markdownSha256,
  tables: [{
    tableIndex: 0,
    sourceSha256: source.tables[0].sourceSha256,
    logicalWidth: 2,
    columns: [96, 96],
    overflow: 'newline',
    titleRow: false,
    borderWidth: 2,
    borderColor: '#16a34a',
  }],
}
const prepared = { bodyMarkdown, tablePresentation, sourceTables: source.tables }
const transformed = await transformOfficeTablePresentation([
  '<!doctype html><html><head></head><body><table>',
  '<thead><tr><th>A</th><th>B</th></tr></thead>',
  '<tbody><tr><td>one</td><td>two</td></tr></tbody>',
  '</table></body></html>',
].join(''), prepared)
const parsed = await parseOfficeTablePresentation(transformed)
assert.equal(parsed.length, 1)
assert.equal(parsed[0].rows[0].length, 2)

const pandocPath = process.env.OFFICE_PACKAGED_PANDOC
const temporaryRoot = process.env.OFFICE_PACKAGED_TEMP
assert.equal(typeof pandocPath, 'string')
assert.equal(typeof temporaryRoot, 'string')
assert.equal(fs.statSync(pandocPath).isFile(), true)
assert.equal(fs.statSync(temporaryRoot).isDirectory(), true)
const docx = await createOfficeDocxBuilder({
  getPandocPath: () => pandocPath,
  temporaryRoot,
}).build(prepared)
assert.ok(Buffer.isBuffer(docx.buffer))
assert.equal(docx.buffer.subarray(0, 2).toString('ascii'), 'PK')
const summary = inspectOfficeDocxPresentation(docx.buffer, prepared)
assert.equal(summary.summaries.length, 1)

console.log(JSON.stringify({
  packagedOfficeModules: true,
  tableHash: source.tables[0].sourceSha256,
  logicalWidth: source.tables[0].logicalWidth,
  htmlTables: parsed.length,
  docxTables: summary.summaries.length,
}))
