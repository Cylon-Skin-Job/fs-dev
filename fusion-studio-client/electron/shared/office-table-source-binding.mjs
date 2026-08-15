import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { parseFragment } from 'parse5'

const SHA256_PATTERN = /^[0-9a-f]{64}$/
const COLLAPSIBLE_SPACE_PATTERN = /[\u0009\u000c\u0020\u00a0]+/g
const EDGE_SPACE_PATTERN = /^[\u0009\u000c\u0020\u00a0]+|[\u0009\u000c\u0020\u00a0]+$/g

function assertSafeCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a nonnegative safe integer`)
  }
}

function validatedHash(value) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error('SHA-256 provider returned an invalid digest')
  }
  return value
}

function normalizeSemanticText(value) {
  return value
    .replace(/\r\n?|\n/g, '\n')
    .normalize('NFC')
    .split('\n')
    .map((line) => line.replace(COLLAPSIBLE_SPACE_PATTERN, ' ').replace(EDGE_SPACE_PATTERN, ''))
    .join('\n')
}

function htmlSemanticText(value) {
  const fragment = parseFragment(value)
  let result = ''
  const visit = (node) => {
    if (node.nodeName === '#text') {
      result += node.value
      return
    }
    if (node.nodeName === 'br') result += '\n'
    if (Array.isArray(node.childNodes)) node.childNodes.forEach(visit)
  }
  fragment.childNodes.forEach(visit)
  return result
}

function mdastSemanticText(node) {
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text' || node.type === 'inlineCode') {
    return typeof node.value === 'string' ? node.value : ''
  }
  if (node.type === 'break') return '\n'
  if (node.type === 'image' || node.type === 'imageReference') return ''
  if (node.type === 'html') {
    return typeof node.value === 'string' ? htmlSemanticText(node.value) : ''
  }
  return Array.isArray(node.children) ? node.children.map(mdastSemanticText).join('') : ''
}

function collectTables(root) {
  const tables = []
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'table') tables.push(node)
    if (Array.isArray(node.children)) node.children.forEach(visit)
  }
  visit(root)
  return tables
}

function bindParsedTable(table, markdown, tableIndex) {
  const startOffset = table.position?.start?.offset
  const endOffset = table.position?.end?.offset
  if (
    !Number.isInteger(startOffset)
    || !Number.isInteger(endOffset)
    || startOffset < 0
    || endOffset > markdown.length
    || startOffset >= endOffset
  ) {
    throw new Error('Parsed GFM table has invalid source offsets')
  }

  const logicalWidth = Array.isArray(table.align) ? table.align.length : 0
  if (!Number.isSafeInteger(logicalWidth) || logicalWidth < 1) {
    throw new Error('Parsed GFM table has invalid logical width')
  }
  if (!Array.isArray(table.children) || table.children.length === 0) {
    throw new Error('Parsed GFM table has no rows')
  }

  const semanticRows = []
  const cellChildCounts = []
  for (const row of table.children) {
    if (row.type !== 'tableRow' || !Array.isArray(row.children) || row.children.length !== logicalWidth) {
      throw new Error('Parsed GFM table row width does not match its header')
    }
    const semanticRow = []
    const childCountRow = []
    for (const cell of row.children) {
      if (cell.type !== 'tableCell' || !Array.isArray(cell.children)) {
        throw new Error('Parsed GFM table contains an invalid cell')
      }
      semanticRow.push(normalizeSemanticText(mdastSemanticText(cell)))
      childCountRow.push(cell.children.length)
    }
    semanticRows.push(semanticRow)
    cellChildCounts.push(childCountRow)
  }

  return {
    tableIndex,
    logicalWidth,
    semanticRows,
    cellChildCounts,
    startOffset,
    endOffset,
  }
}

export async function bindOfficeTableSources(markdown, sha256Hex) {
  if (typeof markdown !== 'string' || typeof sha256Hex !== 'function') {
    throw new TypeError('Markdown and a SHA-256 provider are required')
  }
  const encoder = new TextEncoder()
  const markdownSha256 = validatedHash(await sha256Hex(encoder.encode(markdown)))
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  })
  const parsedTables = collectTables(tree).map((table, tableIndex) => (
    bindParsedTable(table, markdown, tableIndex)
  ))
  const tables = await Promise.all(parsedTables.map(async (table) => ({
    tableIndex: table.tableIndex,
    sourceSha256: validatedHash(await sha256Hex(
      encoder.encode(markdown.slice(table.startOffset, table.endOffset)),
    )),
    logicalWidth: table.logicalWidth,
    semanticRows: table.semanticRows,
    cellChildCounts: table.cellChildCounts,
    startOffset: table.startOffset,
    endOffset: table.endOffset,
  })))
  return { markdownSha256, tables }
}

export function getOfficeDescriptorByteLimit(bodyUtf8Bytes, tableCount, totalLogicalColumns) {
  assertSafeCount(bodyUtf8Bytes, 'bodyUtf8Bytes')
  assertSafeCount(tableCount, 'tableCount')
  assertSafeCount(totalLogicalColumns, 'totalLogicalColumns')
  const limit = 512n
    + BigInt(bodyUtf8Bytes)
    + (512n * BigInt(tableCount))
    + (32n * BigInt(totalLogicalColumns))
  return limit > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(limit)
}
