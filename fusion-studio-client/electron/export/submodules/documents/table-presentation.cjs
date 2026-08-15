'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  TABLE_PRESENTATION_MISMATCH,
  presentationError,
} = require('../../../shared/office-table-presentation-validation.cjs');

const COLLAPSIBLE_SPACE_PATTERN = /[\u0009\u000c\u0020\u00a0]+/g;
const EDGE_SPACE_PATTERN = /^[\u0009\u000c\u0020\u00a0]+|[\u0009\u000c\u0020\u00a0]+$/g;
const GENERATED_STYLE_ID = 'rv-office-table-presentation';
const CONTENT_CLASS = 'rv-office-output-cell-content';
const PRINT_STYLE = `<style id="rv-office-print-page">
@page { margin: 0.5in; size: letter; }
html { background: #fff; }
body { margin: 0; padding: 0; max-width: none !important; color: #111; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 16px; }
p { margin: 12px 0; }
h1 { margin: 0 0 12px; font-size: 16px; line-height: 20px; }
h2 { margin: 16px 0 8px; font-size: 14px; line-height: 20px; break-after: avoid; }
h3 { margin: 16px 0 8px; font-size: 13px; line-height: 20px; }
table { break-inside: avoid; margin: 0 0 12px; }
th, td { padding: 4px 6px; line-height: 16px; }
</style>`;

let parse5Promise;
function getParse5() {
  parse5Promise ??= import('parse5');
  return parse5Promise;
}

function failMismatch() {
  throw presentationError(TABLE_PRESENTATION_MISMATCH);
}

function normalizeSemanticText(value) {
  return value
    .replace(/\r\n?|\n/g, '\n')
    .normalize('NFC')
    .split('\n')
    .map((line) => line.replace(COLLAPSIBLE_SPACE_PATTERN, ' ').replace(EDGE_SPACE_PATTERN, ''))
    .join('\n');
}

function isElement(node, name) {
  return node?.nodeName === name;
}

function directChildren(node, names) {
  const allowed = new Set(names);
  return (node?.childNodes ?? []).filter((child) => allowed.has(child.nodeName));
}

function collectElements(root, name, output = []) {
  if (isElement(root, name)) output.push(root);
  for (const child of root?.childNodes ?? []) collectElements(child, name, output);
  return output;
}

function tableRows(table) {
  const rows = [];
  for (const child of table.childNodes ?? []) {
    if (isElement(child, 'thead')) rows.push(...directChildren(child, ['tr']));
  }
  for (const child of table.childNodes ?? []) {
    if (isElement(child, 'tbody')) rows.push(...directChildren(child, ['tr']));
    if (isElement(child, 'tr')) rows.push(child);
  }
  return rows;
}

function semanticText(node) {
  let text = '';
  const visit = (current) => {
    if (current?.nodeName === '#text') {
      text += current.value ?? '';
      return;
    }
    if (isElement(current, 'br')) text += '\n';
    for (const child of current?.childNodes ?? []) visit(child);
  };
  visit(node);
  return normalizeSemanticText(text);
}

function setAttribute(node, name, value) {
  node.attrs ??= [];
  const existing = node.attrs.find((attribute) => attribute.name === name);
  if (existing) existing.value = value;
  else node.attrs.push({ name, value });
}

function getAttribute(node, name) {
  return node.attrs?.find((attribute) => attribute.name === name)?.value;
}

function generatedElement(tagName, attrs = [], childNodes = []) {
  const node = {
    nodeName: tagName,
    tagName,
    attrs: attrs.map(([name, value]) => ({ name, value })),
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    childNodes,
  };
  for (const child of childNodes) child.parentNode = node;
  return node;
}

function generatedText(value) {
  return { nodeName: '#text', value, parentNode: null };
}

function appendChild(parent, child) {
  parent.childNodes ??= [];
  child.parentNode = parent;
  parent.childNodes.push(child);
}

function replaceBreaksWithSpaces(node) {
  const next = [];
  for (const child of node.childNodes ?? []) {
    if (isElement(child, 'br')) {
      const space = generatedText(' ');
      space.parentNode = node;
      next.push(space);
      continue;
    }
    replaceBreaksWithSpaces(child);
    next.push(child);
  }
  node.childNodes = next;
}

function wrapCell(cell) {
  const children = cell.childNodes ?? [];
  if (
    children.length === 1
    && isElement(children[0], 'div')
    && (getAttribute(children[0], 'class') ?? '').split(/\s+/).includes(CONTENT_CLASS)
  ) return children[0];
  const wrapper = generatedElement('div', [['class', CONTENT_CLASS]], children);
  wrapper.parentNode = cell;
  cell.childNodes = [wrapper];
  return wrapper;
}

function matrixForTable(table, logicalWidth) {
  return tableRows(table).map((row) => {
    const cells = directChildren(row, ['th', 'td']);
    if (cells.length !== logicalWidth) failMismatch();
    return cells.map(semanticText);
  });
}

function matricesEqual(actual, expected) {
  return actual.length === expected.length && actual.every((row, rowIndex) => (
    row.length === expected[rowIndex]?.length
    && row.every((cell, cellIndex) => cell === expected[rowIndex][cellIndex])
  ));
}

function styleForEntry(entry) {
  const selector = `table[data-rv-office-output-table="${entry.tableIndex}"]`;
  const color = entry.borderColor === 'default' ? '#d2d1cf' : entry.borderColor;
  const border = color === null ? 'none' : `${entry.borderWidth}px solid ${color}`;
  const topLeftEdge = color === null ? 'none' : `inset 0 0.333333px 0 0 ${color},inset 0.333333px 0 0 0 ${color}`;
  const topLeftRightEdge = color === null ? 'none' : `${topLeftEdge},inset -0.333333px 0 0 0 ${color}`;
  const topLeftBottomEdge = color === null ? 'none' : `${topLeftEdge},inset 0 -0.333333px 0 0 ${color}`;
  const allEdges = color === null ? 'none' : `${topLeftRightEdge},inset 0 -0.333333px 0 0 ${color}`;
  const mode = entry.overflow;
  const whiteSpace = mode === 'newline' ? 'normal' : 'nowrap';
  const overflow = mode === 'newline' ? 'visible' : 'hidden';
  const textOverflow = mode === 'truncate' ? 'ellipsis' : 'clip';
  const tableWidth = entry.columns === null
    ? 'width:100%;'
    : `width:${entry.columns.reduce((total, width) => total + BigInt(width), 0n)}px;`;
  return [
    `${selector}{display:table;${tableWidth}border:0;border-collapse:collapse;border-spacing:0;max-width:100%;overflow:visible;table-layout:fixed;}`,
    `${selector}>tbody{border:0;}`,
    `${selector} th,${selector} td{box-sizing:border-box;border:${border};box-shadow:${topLeftEdge};min-width:0;}`,
    `${selector} tr>*:last-child{box-shadow:${topLeftRightEdge};}`,
    `${selector}>tbody>tr:last-child>*{box-shadow:${topLeftBottomEdge};}`,
    `${selector}>tbody>tr:last-child>*:last-child{box-shadow:${allEdges};}`,
    `${selector} .${CONTENT_CLASS}{display:block;min-width:0;max-width:100%;white-space:${whiteSpace};overflow:${overflow};text-overflow:${textOverflow};}`,
  ].join('');
}

function ensureHead(document) {
  const html = collectElements(document, 'html')[0] ?? document;
  let head = directChildren(html, ['head'])[0];
  if (!head) {
    head = generatedElement('head');
    head.parentNode = html;
    html.childNodes ??= [];
    html.childNodes.unshift(head);
  }
  return head;
}

/**
 * Structurally binds and transforms Pandoc standalone HTML for Office PDF/Print.
 * The prepared graph must already have passed the shared main-process validator.
 */
async function transformOfficeTablePresentation(html, prepared) {
  if (typeof html !== 'string' || !prepared || typeof prepared !== 'object') failMismatch();
  const { parse, serialize } = await getParse5();
  let document;
  try {
    document = parse(html, { scriptingEnabled: false });
  } catch {
    failMismatch();
  }
  const tables = collectElements(document, 'table');
  const entries = prepared.tablePresentation?.tables;
  const sources = prepared.sourceTables;
  if (!Array.isArray(entries) || !Array.isArray(sources) || tables.length !== entries.length) {
    failMismatch();
  }

  const bound = tables.map((table, index) => {
    const entry = entries[index];
    const source = sources[index];
    if (!entry || !source || entry.tableIndex !== index || source.tableIndex !== index) failMismatch();
    const rows = tableRows(table);
    const matrix = matrixForTable(table, entry.logicalWidth);
    if (!matricesEqual(matrix, source.semanticRows)) failMismatch();
    return { table, entry, rows };
  });

  for (const { table, entry, rows } of bound) {
    setAttribute(table, 'data-rv-office-output-table', String(entry.tableIndex));
    if (entry.columns !== null) {
      for (const prior of directChildren(table, ['colgroup'])) {
        table.childNodes.splice(table.childNodes.indexOf(prior), 1);
      }
      const columns = entry.columns.map((width) => generatedElement('col', [['style', `width:${width}px`]]));
      const colgroup = generatedElement('colgroup', [], columns);
      colgroup.parentNode = table;
      table.childNodes.unshift(colgroup);
    }

    if (entry.titleRow) {
      const titleCells = directChildren(rows[0], ['th', 'td']);
      if (
        titleCells.length !== entry.logicalWidth
        || titleCells.slice(1).some((cell) => semanticText(cell) !== '')
      ) failMismatch();
      setAttribute(titleCells[0], 'colspan', String(entry.logicalWidth));
      rows[0].childNodes = (rows[0].childNodes ?? []).filter((child) => (
        !titleCells.slice(1).includes(child)
      ));
    }

    for (const row of rows) {
      for (const cell of directChildren(row, ['th', 'td'])) {
        const wrapper = wrapCell(cell);
        if (entry.overflow !== 'newline') replaceBreaksWithSpaces(wrapper);
      }
    }
  }

  const head = ensureHead(document);
  const style = generatedElement('style', [['id', GENERATED_STYLE_ID]], [
    generatedText(bound.map(({ entry }) => styleForEntry(entry)).join('\n')),
  ]);
  appendChild(head, style);
  return serialize(document);
}

async function parseOfficeTablePresentation(html) {
  const { parse } = await getParse5();
  const document = parse(html, { scriptingEnabled: false });
  return collectElements(document, 'table').map((table) => ({
    tableIndex: Number(getAttribute(table, 'data-rv-office-output-table')),
    rows: tableRows(table).map((row) => directChildren(row, ['th', 'td']).map((cell) => ({
      text: semanticText(cell),
      colspan: getAttribute(cell, 'colspan') ?? null,
      wrapped: (cell.childNodes ?? []).some((child) => (
        isElement(child, 'div')
        && (getAttribute(child, 'class') ?? '').split(/\s+/).includes(CONTENT_CLASS)
      )),
    }))),
  }));
}

function withPrintStyle(html) {
  if (html.includes('</head>')) return html.replace('</head>', `${PRINT_STYLE}</head>`);
  return `${PRINT_STYLE}${html}`;
}

function reserveConverterGroup(directory) {
  if (!directory) return {
    clear() {},
    publish() {},
    token: null,
  };
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Invalid converter process-group registry');
  }
  const token = crypto.randomBytes(16).toString('hex');
  const pending = path.join(directory, `${token}.pending`);
  let published = null;
  let failedPublication = null;
  try {
    fs.writeFileSync(pending, `${token}\n`, {
      encoding: 'ascii', flag: 'wx', mode: 0o600,
    });
  } catch (primaryError) {
    let cleanupError = null;
    if (primaryError?.code !== 'EEXIST') {
      try {
        fs.rmSync(pending, { force: true });
      } catch (error) {
        cleanupError = error;
      }
    }
    if (cleanupError) {
      throw new AggregateError(
        [primaryError, cleanupError],
        'Converter registry reservation and cleanup failed',
      );
    }
    throw primaryError;
  }
  return {
    token,
    publish(pid) {
      if (!pid) throw new Error('Converter process group was not created');
      const candidate = path.join(directory, `${pid}.pgid`);
      try {
        fs.writeFileSync(candidate, `${pid}\n`, {
          encoding: 'ascii', flag: 'wx', mode: 0o600,
        });
      } catch (primaryError) {
        let cleanupError = null;
        if (primaryError?.code !== 'EEXIST') {
          try {
            fs.rmSync(candidate, { force: true });
          } catch (error) {
            failedPublication = candidate;
            cleanupError = error;
          }
        }
        if (cleanupError) {
          throw new AggregateError(
            [primaryError, cleanupError],
            'Converter registry publication and cleanup failed',
          );
        }
        throw primaryError;
      }
      published = candidate;
      fs.rmSync(pending, { force: true });
    },
    clear() {
      const errors = [];
      const filenames = new Set([pending, published, failedPublication].filter(Boolean));
      for (const filename of filenames) {
        try {
          fs.rmSync(filename, { force: true });
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 1) {
        throw new AggregateError(errors, 'Converter registry cleanup failed');
      }
      if (errors.length === 1) throw errors[0];
    },
  };
}

function rejectAfterRegistrationCleanup(reject, registration, primaryError) {
  let cleanupError = null;
  try {
    registration?.clear();
  } catch (error) {
    cleanupError = error;
  }
  if (primaryError && cleanupError) {
    reject(new AggregateError(
      [primaryError, cleanupError],
      'Pandoc failed and converter registry cleanup failed',
    ));
  } else {
    reject(primaryError ?? cleanupError);
  }
}

function runPandoc(pandocPath, inputPath, outputPath, {
  conversion = 'gfm-html',
  timeoutMs = 30_000,
  killGraceMs = 1_000,
  stderrLimit = 65_536,
  processGroupRegistry = null,
} = {}) {
  const conversionArguments = Object.freeze({
    'gfm-html': ['-f', 'gfm', '-t', 'html5', '--standalone'],
    'gfm-json': ['-f', 'gfm', '-t', 'json'],
    'json-docx': ['-f', 'json', '-t', 'docx'],
  });
  const trustedArguments = conversionArguments[conversion];
  if (!trustedArguments) throw new TypeError('Unsupported trusted Pandoc conversion');
  return new Promise((resolve, reject) => {
    const ownsProcessGroup = process.platform !== 'win32';
    let registration;
    let processHandle;
    try {
      registration = reserveConverterGroup(processGroupRegistry);
      processHandle = spawn(pandocPath, [
        inputPath,
        ...trustedArguments,
        '-o', outputPath,
      ], {
        detached: ownsProcessGroup,
        env: registration.token
          ? { ...process.env, FUSION_OFFICE_CONVERTER_TOKEN: registration.token }
          : process.env,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
    } catch (error) {
      rejectAfterRegistrationCleanup(reject, registration, error);
      return;
    }
    let stderr = Buffer.alloc(0);
    let timedOut = false;
    let settled = false;
    let terminating = false;
    let spawnError = null;
    let closeResult = null;
    let lifecycleError = null;
    let treeOutlivedLeader = false;
    let windowsTreeKillPending = false;
    let timeout;
    let killTimer;
    let pollTimer;
    const finish = (primaryError = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(killTimer);
      clearInterval(pollTimer);
      let cleanupError = null;
      try {
        registration.clear();
      } catch (error) {
        cleanupError = error;
      }
      if (primaryError && cleanupError) {
        reject(new AggregateError(
          [primaryError, cleanupError],
          'Pandoc failed and converter registry cleanup failed',
        ));
      } else if (primaryError || cleanupError) {
        reject(primaryError ?? cleanupError);
      } else {
        resolve();
      }
    };
    const treeAlive = () => {
      if (!processHandle.pid) return closeResult === null;
      if (!ownsProcessGroup) return closeResult === null || windowsTreeKillPending;
      try {
        process.kill(-processHandle.pid, 0);
        return true;
      } catch (error) {
        if (error?.code === 'ESRCH') return false;
        if (error?.code === 'EPERM') return true;
        throw error;
      }
    };
    const signalPosixTree = (signal) => {
      if (!processHandle.pid) return;
      try {
        process.kill(-processHandle.pid, signal);
      } catch (error) {
        if (error?.code !== 'ESRCH') lifecycleError ??= error;
      }
    };
    const evaluate = () => {
      if (settled || closeResult === null || treeAlive()) return;
      if (lifecycleError) finish(lifecycleError);
      else if (timedOut) finish(new Error(`Pandoc timed out after ${timeoutMs}ms`));
      else if (spawnError) finish(spawnError);
      else if (treeOutlivedLeader) finish(new Error('Pandoc process tree outlived converter'));
      else if (closeResult.code === 0 && fs.existsSync(outputPath)) finish();
      else finish(new Error((stderr.length ? stderr.toString() : 'Pandoc failed').trim()));
    };
    const terminateTree = () => {
      if (terminating) return;
      terminating = true;
      pollTimer = setInterval(evaluate, 25);
      if (ownsProcessGroup) {
        signalPosixTree('SIGTERM');
        killTimer = setTimeout(() => signalPosixTree('SIGKILL'), killGraceMs);
        return;
      }
      if (!processHandle.pid) return;
      windowsTreeKillPending = true;
      const killer = spawn('taskkill', [
        '/pid', String(processHandle.pid), '/T', '/F',
      ], { stdio: 'ignore', windowsHide: true });
      killer.once('error', (error) => {
        lifecycleError ??= error;
        windowsTreeKillPending = false;
        evaluate();
      });
      killer.once('close', (code) => {
        if (code !== 0) lifecycleError ??= new Error(`taskkill failed with code ${code}`);
        windowsTreeKillPending = false;
        evaluate();
      });
    };
    processHandle.stderr.on('data', (data) => {
      const remaining = stderrLimit - stderr.length;
      if (remaining <= 0) return;
      stderr = Buffer.concat([stderr, data.subarray(0, remaining)]);
    });
    processHandle.once('error', (error) => {
      spawnError = error;
      terminateTree();
      evaluate();
    });
    processHandle.once('close', (code, signal) => {
      closeResult = { code, signal };
      const alive = treeAlive();
      if (code !== 0 || signal !== null || alive) {
        if (code === 0 && signal === null && alive) treeOutlivedLeader = true;
        terminateTree();
      }
      evaluate();
    });
    try {
      registration.publish(processHandle.pid);
    } catch (error) {
      spawnError = error;
      terminateTree();
    }
    if (!spawnError) timeout = setTimeout(() => {
      timedOut = true;
      terminateTree();
    }, timeoutMs);
  });
}

/** Shared dormant PDF/Preview-Print builder. */
function createOfficePdfBuilder({
  getPandocPath,
  htmlToPdf,
  temporaryRoot = os.tmpdir(),
  pandocTimeoutMs = 30_000,
  pandocKillGraceMs = 1_000,
  processGroupRegistry = null,
} = {}) {
  if (typeof getPandocPath !== 'function') throw new TypeError('getPandocPath is required');
  const renderPdf = htmlToPdf ?? require('../../pdf-engine.cjs').htmlToPdf;
  if (typeof renderPdf !== 'function') throw new TypeError('htmlToPdf is required');

  return Object.freeze({
    async build(prepared, options = {}) {
      const pandocPath = getPandocPath();
      if (typeof pandocPath !== 'string' || pandocPath.length === 0 || !fs.existsSync(pandocPath)) {
        throw new Error('Pandoc not found in bundle');
      }
      const tmpDir = fs.mkdtempSync(path.join(temporaryRoot, 'fusion-office-pdf-'));
      const nonce = crypto.randomBytes(6).toString('hex');
      const inputPath = path.join(tmpDir, `input-${nonce}.md`);
      const outputPath = path.join(tmpDir, `pandoc-${nonce}.html`);
      try {
        fs.writeFileSync(inputPath, prepared.bodyMarkdown, { encoding: 'utf8', mode: 0o600 });
        await runPandoc(pandocPath, inputPath, outputPath, {
          timeoutMs: pandocTimeoutMs,
          killGraceMs: pandocKillGraceMs,
          processGroupRegistry,
        });
        const pandocHtml = fs.readFileSync(outputPath, 'utf8');
        const transformedHtml = withPrintStyle(
          await transformOfficeTablePresentation(pandocHtml, prepared),
        );
        const buffer = Buffer.from(await renderPdf(transformedHtml, {
          printBackground: true,
          pageSize: 'Letter',
        }));
        if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
          throw new Error('PDF conversion failed');
        }
        return Object.freeze(options.includeHtml
          ? { buffer, transformedHtml, pandocHtml }
          : { buffer });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
  });
}

module.exports = {
  CONTENT_CLASS,
  GENERATED_STYLE_ID,
  PRINT_STYLE,
  createOfficePdfBuilder,
  normalizeSemanticText,
  parseOfficeTablePresentation,
  runTrustedPandoc: runPandoc,
  transformOfficeTablePresentation,
};
