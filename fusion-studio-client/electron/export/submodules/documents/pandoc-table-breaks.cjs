'use strict';

const crypto = require('node:crypto');

const {
  TABLE_PRESENTATION_MISMATCH,
  presentationError,
} = require('../../../shared/office-table-presentation-validation.cjs');
const { normalizeSemanticText } = require('./table-presentation.cjs');

let parse5Promise;
function getParse5() {
  parse5Promise ??= import('parse5');
  return parse5Promise;
}

function failMismatch() {
  throw presentationError(TABLE_PRESENTATION_MISMATCH);
}

function collectPandocTables(root, output = []) {
  if (root === null || typeof root !== 'object') return output;
  if (root.t === 'Table') output.push(root);
  if (Array.isArray(root)) {
    for (const value of root) collectPandocTables(value, output);
  } else {
    for (const value of Object.values(root)) collectPandocTables(value, output);
  }
  return output;
}

function tableRows(table) {
  if (table?.t !== 'Table' || !Array.isArray(table.c) || table.c.length !== 6) failMismatch();
  const headRows = table.c[3]?.[1];
  const bodies = table.c[4];
  const footRows = table.c[5]?.[1];
  if (!Array.isArray(headRows) || !Array.isArray(bodies) || !Array.isArray(footRows)) failMismatch();
  const rows = [...headRows];
  for (const body of bodies) {
    if (!Array.isArray(body) || !Array.isArray(body[2]) || !Array.isArray(body[3])) failMismatch();
    rows.push(...body[2], ...body[3]);
  }
  rows.push(...footRows);
  return rows;
}

function rowCells(row) {
  if (!Array.isArray(row) || !Array.isArray(row[1])) failMismatch();
  return row[1];
}

function cellBlocks(cell) {
  if (!Array.isArray(cell) || cell.length !== 5 || !Array.isArray(cell[4])) failMismatch();
  return cell[4];
}

async function rawHtmlSemanticText(value) {
  if (typeof value !== 'string') failMismatch();
  const { parseFragment } = await getParse5();
  let fragment;
  try {
    fragment = parseFragment(value, { scriptingEnabled: false });
  } catch {
    failMismatch();
  }
  let text = '';
  const visit = (node) => {
    if (node?.nodeName === '#text') {
      text += node.value ?? '';
      return;
    }
    if (node?.nodeName === 'br') text += '\n';
    for (const child of node?.childNodes ?? []) visit(child);
  };
  for (const child of fragment.childNodes ?? []) visit(child);
  return text;
}

async function pandocSemanticText(node) {
  if (node === null || typeof node !== 'object') return '';
  if (Array.isArray(node)) {
    const values = await Promise.all(node.map(pandocSemanticText));
    return values.join('');
  }
  if (node.t === 'Str') return typeof node.c === 'string' ? node.c : failMismatch();
  if (node.t === 'Code') return typeof node.c?.[1] === 'string' ? node.c[1] : failMismatch();
  if (node.t === 'Space' || node.t === 'SoftBreak') return ' ';
  if (node.t === 'LineBreak') return '\n';
  if (node.t === 'Image') return '';
  if (node.t === 'RawInline') {
    if (!Array.isArray(node.c) || node.c.length !== 2) failMismatch();
    return node.c[0] === 'html' ? rawHtmlSemanticText(node.c[1]) : '';
  }
  if (node.t === 'Link') return pandocSemanticText(node.c?.[1]);
  if (node.t === 'Note') return '';
  if (node.t === 'Table') return '';
  if (Object.hasOwn(node, 'c')) return pandocSemanticText(node.c);
  return '';
}

async function matrixForPandocTable(table, logicalWidth) {
  const rows = tableRows(table);
  return Promise.all(rows.map(async (row) => {
    const cells = rowCells(row);
    if (cells.length !== logicalWidth) failMismatch();
    return Promise.all(cells.map(async (cell) => (
      normalizeSemanticText(await pandocSemanticText(cellBlocks(cell)))
    )));
  }));
}

function matricesEqual(actual, expected) {
  return actual.length === expected.length && actual.every((row, rowIndex) => (
    row.length === expected[rowIndex]?.length
    && row.every((cell, cellIndex) => cell === expected[rowIndex][cellIndex])
  ));
}

async function isExactSingleBreakRawInline(node) {
  if (node?.t !== 'RawInline' || node.c?.[0] !== 'html' || typeof node.c?.[1] !== 'string') {
    return false;
  }
  const { parseFragment } = await getParse5();
  let fragment;
  try {
    fragment = parseFragment(node.c[1], { scriptingEnabled: false });
  } catch {
    return false;
  }
  const children = fragment.childNodes ?? [];
  return children.length === 1
    && children[0].nodeName === 'br'
    && (children[0].attrs ?? []).length === 0
    && (children[0].childNodes ?? []).length === 0;
}

async function replaceInlineBreaks(inlines) {
  if (!Array.isArray(inlines)) failMismatch();
  let count = 0;
  for (const inline of inlines) {
    if (inline === null || typeof inline !== 'object' || Array.isArray(inline)) failMismatch();
    if (await isExactSingleBreakRawInline(inline)) {
      delete inline.c;
      inline.t = 'LineBreak';
      count += 1;
      continue;
    }
    // Pandoc treats these subtrees as semantically empty for the cell text
    // contract. Their descriptive content is not written as visible DOCX text.
    if (inline.t === 'Image' || inline.t === 'ImageReference' || inline.t === 'Note') continue;
    if ([
      'Emph', 'Strong', 'Underline', 'Strikeout', 'Superscript', 'Subscript',
      'SmallCaps',
    ].includes(inline.t)) {
      count += await replaceInlineBreaks(inline.c);
    } else if (inline.t === 'Quoted') {
      count += await replaceInlineBreaks(inline.c?.[1]);
    } else if (inline.t === 'Cite') {
      count += await replaceInlineBreaks(inline.c?.[1]);
    } else if (inline.t === 'Link' || inline.t === 'Span') {
      count += await replaceInlineBreaks(inline.c?.[1]);
    }
  }
  return count;
}

async function replaceCellBreaks(blocks) {
  if (!Array.isArray(blocks)) failMismatch();
  let count = 0;
  for (const block of blocks) {
    if (block === null || typeof block !== 'object' || Array.isArray(block)) failMismatch();
    if (block.t === 'Plain' || block.t === 'Para') {
      count += await replaceInlineBreaks(block.c);
    }
  }
  return count;
}

function collectPandocNotes(root, output = []) {
  if (root === null || typeof root !== 'object') return output;
  if (root.t === 'Note') output.push(root);
  if (Array.isArray(root)) {
    for (const value of root) collectPandocNotes(value, output);
  } else {
    for (const value of Object.values(root)) collectPandocNotes(value, output);
  }
  return output;
}

function projectedAnchor(target) {
  const anchor = target.slice(1).normalize('NFC');
  if (/^\p{L}/u.test(anchor)) return anchor;
  const digest = crypto.createHash('sha1').update(anchor).digest('hex');
  return `X${digest.slice(1)}`;
}

function appendProjectedText(output, value, state) {
  if (typeof value !== 'string') failMismatch();
  for (const character of value) {
    output.push({
      kind: 'text',
      value: character,
      code: state.code,
      bold: state.bold,
      italic: state.italic,
      strike: state.strike,
      linkKind: state.linkKind,
      linkTarget: state.linkTarget,
    });
  }
}

async function projectPandocInline(node, state, output, noteIds) {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const value of node) await projectPandocInline(value, state, output, noteIds);
    return;
  }
  if (node.t === 'Str') {
    appendProjectedText(output, node.c, state);
    return;
  }
  if (node.t === 'Code') {
    appendProjectedText(output, node.c?.[1], { ...state, code: true });
    return;
  }
  if (node.t === 'Space' || node.t === 'SoftBreak') {
    appendProjectedText(output, ' ', state);
    return;
  }
  if (node.t === 'LineBreak') {
    appendProjectedText(output, '\n', {
      ...state, code: false, bold: false, italic: false, strike: false,
    });
    return;
  }
  if (node.t === 'Image' || node.t === 'ImageReference' || node.t === 'Table') return;
  if (node.t === 'Note') {
    const id = noteIds.get(node);
    if (!Number.isSafeInteger(id)) failMismatch();
    output.push({ kind: 'note', id });
    return;
  }
  if (node.t === 'RawInline') {
    if (!Array.isArray(node.c) || node.c.length !== 2) failMismatch();
    if (node.c[0] === 'html') appendProjectedText(output, await rawHtmlSemanticText(node.c[1]), state);
    return;
  }
  if (node.t === 'Emph') {
    await projectPandocInline(node.c, { ...state, italic: true }, output, noteIds);
    return;
  }
  if (node.t === 'Strong') {
    await projectPandocInline(node.c, { ...state, bold: true }, output, noteIds);
    return;
  }
  if (node.t === 'Strikeout') {
    await projectPandocInline(node.c, { ...state, strike: true }, output, noteIds);
    return;
  }
  if (node.t === 'Link') {
    const target = node.c?.[2]?.[0];
    if (typeof target !== 'string' || !target) failMismatch();
    await projectPandocInline(node.c?.[1], {
      ...state,
      linkKind: target.startsWith('#') ? 'anchor' : 'external',
      linkTarget: target.startsWith('#') ? projectedAnchor(target) : target,
    }, output, noteIds);
    return;
  }
  if (Object.hasOwn(node, 'c')) await projectPandocInline(node.c, state, output, noteIds);
}

async function richProjectionForPandocTable(table, logicalWidth, noteIds) {
  const state = {
    code: false,
    bold: false,
    italic: false,
    strike: false,
    linkKind: null,
    linkTarget: null,
  };
  return Promise.all(tableRows(table).map(async (row) => {
    const cells = rowCells(row);
    if (cells.length !== logicalWidth) failMismatch();
    return Promise.all(cells.map(async (cell) => {
      const blocks = cellBlocks(cell);
      const output = [];
      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
        const block = blocks[blockIndex];
        if (block?.t !== 'Plain' && block?.t !== 'Para') failMismatch();
        if (blockIndex > 0) appendProjectedText(output, '\n', state);
        await projectPandocInline(block.c, state, output, noteIds);
      }
      return output;
    }));
  }));
}

function emptyPandocAttributes(value) {
  return Array.isArray(value)
    && value.length === 3
    && value[0] === ''
    && Array.isArray(value[1])
    && value[1].length === 0
    && Array.isArray(value[2])
    && value[2].length === 0;
}

function appendFootnoteProjectedText(output, value, state) {
  if (typeof value !== 'string') failMismatch();
  for (const character of value) {
    output.push({ kind: 'text', value: character, ...state });
  }
}

async function projectFootnoteInlines(node, state, output) {
  if (node === null || typeof node !== 'object') failMismatch();
  if (Array.isArray(node)) {
    for (const value of node) await projectFootnoteInlines(value, state, output);
    return;
  }
  if (node.t === 'Str') {
    appendFootnoteProjectedText(output, node.c, state);
    return;
  }
  if (node.t === 'Code') {
    if (!emptyPandocAttributes(node.c?.[0])) failMismatch();
    appendFootnoteProjectedText(output, node.c[1], { ...state, code: true });
    return;
  }
  if (node.t === 'Space' || node.t === 'SoftBreak') {
    appendFootnoteProjectedText(output, ' ', state);
    return;
  }
  if (node.t === 'LineBreak') {
    appendFootnoteProjectedText(output, '\n', {
      ...state,
      code: false,
      bold: false,
      italic: false,
      strike: false,
      vertical: null,
    });
    return;
  }
  // The bundled DOCX writer drops raw HTML in Note bodies. Nested notes and
  // image descriptions are not visible footnote-body structure either.
  if (node.t === 'RawInline' || node.t === 'Note' || node.t === 'Image' || node.t === 'ImageReference') {
    return;
  }
  if (node.t === 'Strong') {
    await projectFootnoteInlines(node.c, { ...state, bold: true }, output);
    return;
  }
  if (node.t === 'Emph') {
    await projectFootnoteInlines(node.c, { ...state, italic: true }, output);
    return;
  }
  if (node.t === 'Strikeout') {
    await projectFootnoteInlines(node.c, { ...state, strike: true }, output);
    return;
  }
  if (node.t === 'Superscript' || node.t === 'Subscript') {
    await projectFootnoteInlines(node.c, {
      ...state,
      vertical: node.t === 'Superscript' ? 'superscript' : 'subscript',
    }, output);
    return;
  }
  if (node.t === 'Link') {
    if (!emptyPandocAttributes(node.c?.[0])) failMismatch();
    const target = node.c?.[2]?.[0];
    const title = node.c?.[2]?.[1];
    if (typeof target !== 'string' || !target || title !== '') failMismatch();
    await projectFootnoteInlines(node.c[1], {
      ...state,
      linkKind: target.startsWith('#') ? 'anchor' : 'external',
      linkTarget: target.startsWith('#') ? projectedAnchor(target) : target,
    }, output);
    return;
  }
  if (node.t === 'Span') {
    if (!emptyPandocAttributes(node.c?.[0])) failMismatch();
    await projectFootnoteInlines(node.c[1], state, output);
    return;
  }
  failMismatch();
}

const ORDERED_LIST_STYLES = Object.freeze({
  DefaultStyle: 'decimal',
  Decimal: 'decimal',
  LowerRoman: 'lowerRoman',
  UpperRoman: 'upperRoman',
  LowerAlpha: 'lowerLetter',
  UpperAlpha: 'upperLetter',
});

const ORDERED_LIST_DELIMITERS = Object.freeze({
  DefaultDelim: 'period',
  Period: 'period',
  OneParen: 'oneParen',
  TwoParens: 'twoParens',
});

const BULLET_MARKERS = Object.freeze([
  Object.freeze({ glyph: '\uf0b7', font: 'Symbol' }),
  Object.freeze({ glyph: 'o', font: 'Courier New' }),
  Object.freeze({ glyph: '\uf0a7', font: 'Wingdings' }),
]);

function canonicalFootnoteList(list) {
  const marker = list.format === 'bullet'
    ? list.marker ? BULLET_MARKERS[list.level % BULLET_MARKERS.length] : { glyph: ' ', font: null }
    : { glyph: null, font: null };
  return {
    ...list,
    markerGlyph: marker.glyph,
    justification: 'left',
    suffix: null,
    tabs: null,
    left: (list.level + 1) * 720,
    hanging: 360,
    markerFont: marker.font,
  };
}

function expectedListPattern(delimiter, level) {
  const marker = `%${level + 1}`;
  if (delimiter === 'period') return `${marker}.`;
  if (delimiter === 'oneParen') return `${marker})`;
  if (delimiter === 'twoParens') return `(${marker})`;
  return failMismatch();
}

async function projectFootnoteBlocks(blocks, context, output, counters) {
  if (!Array.isArray(blocks)) failMismatch();
  for (const block of blocks) {
    if (block === null || typeof block !== 'object' || Array.isArray(block)) failMismatch();
    if (block.t === 'Plain' || block.t === 'Para') {
      const inlines = [];
      await projectFootnoteInlines(block.c, {
        code: false,
        bold: false,
        italic: false,
        strike: false,
        vertical: null,
        linkKind: null,
        linkTarget: null,
      }, inlines);
      let list = context.list;
      if (list && context.listContinuation) {
        if (!counters.continuation) counters.continuation = ++counters.list;
        list = canonicalFootnoteList({
          key: counters.continuation,
          level: list.level,
          format: 'bullet',
          start: 1,
          pattern: null,
          marker: false,
        });
      }
      output.push({
        style: context.blockquote ? 'FootnoteBlockText' : block.t === 'Plain' ? 'Compact' : 'FootnoteText',
        list,
        inlines,
        directTopLevel: context.directTopLevel,
      });
      continue;
    }
    if (block.t === 'CodeBlock') {
      if (!emptyPandocAttributes(block.c?.[0]) || typeof block.c?.[1] !== 'string') failMismatch();
      const inlines = [];
      const codeState = {
        code: true, bold: false, italic: false, strike: false,
        vertical: null, linkKind: null, linkTarget: null,
      };
      for (const character of block.c[1]) {
        appendFootnoteProjectedText(inlines, character, character === '\n'
          ? { ...codeState, code: false }
          : codeState);
      }
      let list = context.list;
      if (list && context.listContinuation) {
        if (!counters.continuation) counters.continuation = ++counters.list;
        list = canonicalFootnoteList({
          key: counters.continuation,
          level: list.level,
          format: 'bullet',
          start: 1,
          pattern: null,
          marker: false,
        });
      }
      output.push({ style: 'SourceCode', list, inlines, directTopLevel: false });
      continue;
    }
    if (block.t === 'BlockQuote') {
      await projectFootnoteBlocks(block.c, {
        ...context,
        blockquote: true,
        directTopLevel: false,
      }, output, counters);
      continue;
    }
    if (block.t === 'BulletList' || block.t === 'OrderedList') {
      const listKey = ++counters.list;
      let list;
      let items;
      if (block.t === 'BulletList') {
        list = canonicalFootnoteList({
          key: listKey,
          level: context.listDepth,
          format: 'bullet',
          start: 1,
          pattern: null,
          marker: true,
        });
        items = block.c;
      } else {
        const [attributes, orderedItems] = block.c ?? [];
        const start = attributes?.[0];
        const format = ORDERED_LIST_STYLES[attributes?.[1]?.t];
        const delimiter = ORDERED_LIST_DELIMITERS[attributes?.[2]?.t];
        if (!Number.isSafeInteger(start) || start < 1 || !format || !delimiter) failMismatch();
        list = canonicalFootnoteList({
          key: listKey,
          level: context.listDepth,
          format,
          start,
          pattern: expectedListPattern(delimiter, context.listDepth),
          marker: true,
        });
        items = orderedItems;
      }
      if (!Array.isArray(items)) failMismatch();
      for (const item of items) {
        if (!Array.isArray(item)) failMismatch();
        for (let blockIndex = 0; blockIndex < item.length; blockIndex += 1) {
          await projectFootnoteBlocks([item[blockIndex]], {
            ...context,
            list,
            listContinuation: blockIndex > 0,
            listDepth: context.listDepth + 1,
            directTopLevel: false,
          }, output, counters);
        }
      }
      continue;
    }
    // Raw blocks are intentionally omitted by the bundled DOCX writer.
    if (block.t === 'RawBlock') continue;
    if (block.t === 'Div') {
      if (!emptyPandocAttributes(block.c?.[0])) failMismatch();
      await projectFootnoteBlocks(block.c[1], {
        ...context,
        directTopLevel: false,
      }, output, counters);
      continue;
    }
    failMismatch();
  }
}

async function projectedFootnoteBody(note) {
  const firstBlock = Array.isArray(note.c) ? note.c[0] : null;
  const prefixMode = firstBlock?.t === 'Plain' || firstBlock?.t === 'Para'
    ? 'inline'
    : 'separate';
  const blocks = [];
  await projectFootnoteBlocks(note.c, {
    blockquote: false,
    directTopLevel: true,
    list: null,
    listContinuation: false,
    listDepth: 0,
  }, blocks, { list: 0, continuation: null });
  for (const block of blocks) delete block.directTopLevel;
  return {
    text: blocks.map((block) => block.inlines.map((inline) => inline.value).join('')).join('\n'),
    prefixMode,
    blocks,
  };
}

/**
 * Validate Pandoc's pre-writer table semantics and bridge only exact table-cell
 * raw-HTML breaks. The input AST is never mutated.
 */
async function bridgePandocTableBreaks(ast, prepared) {
  if (ast === null || typeof ast !== 'object' || Array.isArray(ast)) failMismatch();
  if (!prepared || !Array.isArray(prepared.sourceTables) || !Array.isArray(prepared.tablePresentation?.tables)) {
    failMismatch();
  }
  let copy;
  try {
    copy = structuredClone(ast);
  } catch {
    failMismatch();
  }
  const tables = collectPandocTables(copy);
  const entries = prepared.tablePresentation.tables;
  const sources = prepared.sourceTables;
  if (tables.length !== entries.length || tables.length !== sources.length) failMismatch();

  const bridgedBreaks = [];
  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const entry = entries[tableIndex];
    const source = sources[tableIndex];
    if (entry?.tableIndex !== tableIndex || source?.tableIndex !== tableIndex) failMismatch();
    const matrix = await matrixForPandocTable(tables[tableIndex], entry.logicalWidth);
    if (!matricesEqual(matrix, source.semanticRows)) failMismatch();
    const rows = tableRows(tables[tableIndex]);
    const tableBreaks = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const cells = rowCells(rows[rowIndex]);
      const rowBreaks = [];
      for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
        rowBreaks.push(await replaceCellBreaks(cellBlocks(cells[cellIndex])));
      }
      tableBreaks.push(rowBreaks);
    }
    bridgedBreaks.push(tableBreaks);
  }

  const notes = collectPandocNotes(copy);
  const noteIds = new Map(notes.map((note, index) => [note, index + 9]));
  const richProjection = await Promise.all(tables.map((table, tableIndex) => (
    richProjectionForPandocTable(table, entries[tableIndex].logicalWidth, noteIds)
  )));
  const footnoteBodies = await Promise.all(notes.map(async (note, index) => ({
    id: index + 9,
    ...await projectedFootnoteBody(note),
  })));

  return Object.freeze({ ast: copy, bridgedBreaks, richProjection, footnoteBodies });
}

module.exports = {
  bridgePandocTableBreaks,
  collectPandocTables,
  matrixForPandocTable,
};
