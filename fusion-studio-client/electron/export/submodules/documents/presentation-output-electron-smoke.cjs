'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const { app, BrowserWindow } = require('electron');

const { htmlToPdf } = require('../../pdf-engine.cjs');
const {
  createDocumentOutputCoordinator,
  createOfficeAttachmentHandlers,
  createOfficePdfHandlers,
  createSharedDocumentAttachmentBuilders,
} = require('./document-output-coordinator.cjs');
const {
  createOfficeDocxBuilder,
  inspectOfficeDocxPresentation,
} = require('./docx-table-presentation.cjs');
const {
  createOfficePdfBuilder,
  parseOfficeTablePresentation,
} = require('./table-presentation.cjs');
const {
  verifyProductionTableInkOwnership,
} = require('./presentation-raster-ownership.cjs');

const ORACLE_PRINT_CSS = `@page { margin: 0.5in; size: letter; }
html { background: #fff; }
body { margin: 0; padding: 0; max-width: none !important; color: #111; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 16px; }
p { margin: 12px 0; }
h1 { margin: 0 0 12px; font-size: 16px; line-height: 20px; }
h2 { margin: 16px 0 8px; font-size: 14px; line-height: 20px; break-after: avoid; }
h3 { margin: 16px 0 8px; font-size: 13px; line-height: 20px; }
table { break-inside: avoid; margin: 0 0 12px; }
th, td { padding: 4px 6px; line-height: 16px; }`;

const requiredEnvironment = [
  'OFFICE_PRESENTATION_USER_DATA',
  'OFFICE_PRESENTATION_SOURCE',
  'OFFICE_PRESENTATION_FULL_MARKDOWN',
  'OFFICE_PRESENTATION_DESCRIPTOR',
  'OFFICE_PRESENTATION_ARTIFACTS',
  'OFFICE_PRESENTATION_STAGING_ROOT',
  'OFFICE_PRESENTATION_CONVERTER_REGISTRY',
];
for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}
app.setPath('userData', process.env.OFFICE_PRESENTATION_USER_DATA);
app.on('window-all-closed', () => {});

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function getPandocPath() {
  const name = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc';
  return path.join(__dirname, '..', '..', '..', 'resources', 'pandoc', process.platform, name);
}

async function independentOracleHtml(baseHtml, descriptor) {
  const win = new BrowserWindow({
    show: false,
    width: 720,
    height: 1600,
    webPreferences: { javascript: true, webSecurity: false },
  });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(baseHtml)}`);
    return await win.webContents.executeJavaScript(`(async () => {
      const descriptor = ${JSON.stringify(descriptor)};
      const tables = Array.from(document.querySelectorAll('table'));
      if (tables.length !== descriptor.tables.length) throw new Error('oracle table count');
      for (const [index, table] of tables.entries()) {
        const entry = descriptor.tables[index];
        const rows = Array.from(table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr'));
        table.dataset.rvOracleTable = String(index);
        table.style.borderCollapse = 'collapse';
        table.style.borderSpacing = '0';
        table.style.border = '0';
        table.style.display = 'table';
        table.style.overflow = 'visible';
        table.style.maxWidth = '100%';
        table.style.width = entry.columns ? entry.columns.reduce((sum, width) => sum + width, 0) + 'px' : '100%';
        table.style.tableLayout = 'fixed';
        table.querySelectorAll(':scope > tbody').forEach((body) => { body.style.border = '0'; });
        if (entry.columns) {
          table.querySelector(':scope > colgroup')?.remove();
          const colgroup = document.createElement('colgroup');
          for (const width of entry.columns) {
            const col = document.createElement('col');
            col.style.width = width + 'px';
            colgroup.append(col);
          }
          table.prepend(colgroup);
        }
        if (entry.titleRow) {
          const cells = Array.from(rows[0].children).filter((cell) => /^(TH|TD)$/.test(cell.tagName));
          cells[0].colSpan = entry.logicalWidth;
          cells.slice(1).forEach((cell) => cell.remove());
        }
        const color = entry.borderColor === 'default' ? '#d2d1cf' : entry.borderColor;
        for (const cell of table.querySelectorAll('th,td')) {
          cell.style.boxSizing = 'border-box';
          cell.style.border = color === null ? 'none' : entry.borderWidth + 'px solid ' + color;
          cell.style.boxShadow = 'none';
          cell.style.minWidth = '0';
          const wrapper = document.createElement('div');
          wrapper.style.display = 'block';
          wrapper.style.minWidth = '0';
          wrapper.style.maxWidth = '100%';
          wrapper.style.whiteSpace = entry.overflow === 'newline' ? 'normal' : 'nowrap';
          wrapper.style.overflow = entry.overflow === 'newline' ? 'visible' : 'hidden';
          wrapper.style.textOverflow = entry.overflow === 'truncate' ? 'ellipsis' : 'clip';
          while (cell.firstChild) wrapper.append(cell.firstChild);
          cell.append(wrapper);
          if (entry.overflow !== 'newline') {
            wrapper.querySelectorAll('br').forEach((br) => br.replaceWith(document.createTextNode(' ')));
          }
        }
      }
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(ORACLE_PRINT_CSS)};
      document.head.append(style);
      if (document.fonts) await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const relativeRect = (rect, anchor) => ({
        left: rect.left - anchor.left,
        top: rect.top - anchor.top,
        width: rect.width,
        height: rect.height,
      });
      const geometry = tables.map((table, index) => {
        const heading = table.previousElementSibling;
        if (!heading || heading.tagName !== 'H2') throw new Error('oracle heading');
        const range = document.createRange();
        range.selectNodeContents(heading);
        const anchor = range.getBoundingClientRect();
        const rows = Array.from(table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr'));
        return {
          index,
          anchor: heading.textContent.trim(),
          table: relativeRect(table.getBoundingClientRect(), anchor),
          rows: rows.map((row) => ({
            rect: relativeRect(row.getBoundingClientRect(), anchor),
            cells: Array.from(row.children)
              .filter((cell) => /^(TH|TD)$/.test(cell.tagName))
              .map((cell) => ({
                rect: relativeRect(cell.getBoundingClientRect(), anchor),
                content: relativeRect(cell.firstElementChild.getBoundingClientRect(), anchor),
              })),
          })),
        };
      });
      return { html: '<!doctype html>' + document.documentElement.outerHTML, geometry };
    })()`);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function inspectProductionDom(html, descriptor) {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: true } });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await win.webContents.executeJavaScript(`(() => {
      const expected = ${JSON.stringify(descriptor.tables)};
      const tables = Array.from(document.querySelectorAll('table[data-rv-office-output-table]'));
      const checks = tables.map((table, index) => {
        const entry = expected[index];
        const rows = Array.from(table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr'));
        const cells = Array.from(table.querySelectorAll('th,td'));
        const titleCells = Array.from(rows[0].children).filter((cell) => /^(TH|TD)$/.test(cell.tagName));
        const breakCount = table.querySelectorAll('br').length;
        const sample = cells[cells.length - 2].firstElementChild;
        const cellStyle = getComputedStyle(cells[cells.length - 1]);
        const contentStyle = getComputedStyle(sample);
        return {
          index,
          titleCells: titleCells.length,
          titleSpan: titleCells[0]?.colSpan ?? 1,
          keepMe: table.textContent.includes('KEEP ME'),
          wrapped: cells.every((cell) => cell.children.length === 1 && cell.firstElementChild?.classList.contains('rv-office-output-cell-content')),
          breakCount,
          borderStyle: cellStyle.borderTopStyle,
          borderWidth: cellStyle.borderTopWidth,
          borderColor: cellStyle.borderTopColor,
          whiteSpace: contentStyle.whiteSpace,
          overflow: contentStyle.overflow,
          textOverflow: contentStyle.textOverflow,
          expected: entry,
        };
      });
      return { count: tables.length, checks };
    })()`);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function compareAndRasterize(productionPdf, oraclePdf, oracleGeometry, descriptor) {
  const pdfModule = pathToFileURL(path.join(
    __dirname, '..', '..', '..', '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs',
  )).href;
  const pdfWorkerModule = pathToFileURL(path.join(
    __dirname, '..', '..', '..', '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs',
  )).href;
  const win = new BrowserWindow({
    show: false,
    webPreferences: { javascript: true, webSecurity: false },
  });
  try {
    await win.loadURL('data:text/html;charset=utf-8,<html><body></body></html>');
    const rasterScript = `(async () => {
      try {
      const pdfjs = await import(${JSON.stringify(pdfModule)});
      pdfjs.GlobalWorkerOptions.workerSrc = ${JSON.stringify(pdfWorkerModule)};
      const decode = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
      const fixtureGeometry = ${JSON.stringify(oracleGeometry)};
      const fixtureDescriptor = ${JSON.stringify(descriptor.tables)};
      const verifyProductionTableInkOwnership = ${verifyProductionTableInkOwnership.toString()};
      const production = await pdfjs.getDocument({ data: decode(${JSON.stringify(productionPdf.toString('base64'))}), disableWorker: true }).promise;
      const oracle = await pdfjs.getDocument({ data: decode(${JSON.stringify(oraclePdf.toString('base64'))}), disableWorker: true }).promise;
      if (production.numPages !== oracle.numPages) throw new Error('PDF page count mismatch');
      let matching = 0;
      let pixels = 0;
      let absolute = 0;
      let largestRegion = 0;
      let text = '';
      let firstProductionPng = null;
      let firstOraclePng = null;
      const dimensions = [];
      const pageMetrics = [];
      const localized = [];
      const productionTableBounds = [];
      let verticalCorrection = null;
      const rgb = (color) => [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
      const colorMatches = (data, pixel, color) => {
        const expected = rgb(color);
        const offset = pixel * 4;
        return Math.max(
          Math.abs(data[offset] - expected[0]),
          Math.abs(data[offset + 1] - expected[1]),
          Math.abs(data[offset + 2] - expected[2]),
        ) <= 12;
      };
      const pixelDistance = (data, firstPixel, secondPixel) => {
        const first = firstPixel * 4;
        const second = secondPixel * 4;
        return Math.max(
          Math.abs(data[first] - data[second]),
          Math.abs(data[first + 1] - data[second + 1]),
          Math.abs(data[first + 2] - data[second + 2]),
        );
      };
      const mappedRect = (rect, anchor) => ({
        left: anchor.left + rect.left * 3,
        top: anchor.top + rect.top * 3,
        right: anchor.left + (rect.left + rect.width) * 3,
        bottom: anchor.top + (rect.top + rect.height) * 3,
      });
      const edgeProbe = (data, width, rect, edge, color, target) => {
        const vertical = edge === 'left' || edge === 'right';
        const fixed = vertical ? rect[edge] : rect[edge];
        const low = vertical ? rect.top : rect.left;
        const high = vertical ? rect.bottom : rect.right;
        const start = Math.ceil(low + (high - low) * 0.25);
        const end = Math.floor(high - (high - low) * 0.25);
        let tested = 0;
        let matched = 0;
        const widths = [];
        for (let along = start; along <= end; along += 2) {
          let longest = 0;
          let run = 0;
          for (let across = Math.round(fixed) - target - 5; across <= Math.round(fixed) + target + 5; across += 1) {
            const x = vertical ? across : along;
            const y = vertical ? along : across;
            if (x < 0 || y < 0) continue;
            if (colorMatches(data, y * width + x, color)) {
              run += 1;
              longest = Math.max(longest, run);
            } else run = 0;
          }
          tested += 1;
          widths.push(longest);
          if (Math.abs(longest - target) <= 1) matched += 1;
        }
        return { coverage: matched / tested, min: Math.min(...widths), max: Math.max(...widths) };
      };
      const noneProbe = (data, width, rect, edge) => {
        const vertical = edge === 'left' || edge === 'right';
        const fixed = Math.round(rect[edge]);
        const low = vertical ? rect.top : rect.left;
        const high = vertical ? rect.bottom : rect.right;
        const start = Math.ceil(low + (high - low) * 0.25);
        const end = Math.floor(high - (high - low) * 0.25);
        const inward = edge === 'left' || edge === 'top' ? 6 : -6;
        let tested = 0;
        let matchingBackground = 0;
        let longest = 0;
        for (let along = start; along <= end; along += 1) {
          const edgeX = vertical ? fixed : along;
          const edgeY = vertical ? along : fixed;
          let adjacentInk = false;
          for (let distance = 6; distance <= 18 && !adjacentInk; distance += 1) for (const direction of [-1, 1]) {
            const x = edgeX + (vertical ? distance * direction : 0);
            const y = edgeY + (vertical ? 0 : distance * direction);
            const offset = (y * width + x) * 4;
            if (Math.max(255 - data[offset], 255 - data[offset + 1], 255 - data[offset + 2]) > 8) {
              adjacentInk = true;
              break;
            }
          }
          if (adjacentInk) continue;
          const backgroundX = vertical ? fixed + inward : along;
          const backgroundY = vertical ? along : fixed + inward;
          const reference = backgroundY * width + backgroundX;
          let run = 0;
          for (let offset = -3; offset <= 3; offset += 1) {
            const x = edgeX + (vertical ? offset : 0);
            const y = edgeY + (vertical ? 0 : offset);
            const isBackground = pixelDistance(data, y * width + x, reference) <= 8;
            tested += 1;
            if (isBackground) {
              matchingBackground += 1;
              run = 0;
            } else {
              run += 1;
              longest = Math.max(longest, run);
            }
          }
        }
        return { backgroundFraction: tested === 0 ? 0 : matchingBackground / tested, longest, tested };
      };
      const inkComponents = (data, width, rect) => {
        const left = Math.max(0, Math.ceil(rect.left));
        const top = Math.max(0, Math.ceil(rect.top));
        const right = Math.floor(rect.right);
        const bottom = Math.floor(rect.bottom);
        const cropWidth = Math.max(0, right - left);
        const cropHeight = Math.max(0, bottom - top);
        const mask = new Uint8Array(cropWidth * cropHeight);
        const occupiedRows = new Uint8Array(cropHeight);
        for (let y = 0; y < cropHeight; y += 1) for (let x = 0; x < cropWidth; x += 1) {
          const offset = ((top + y) * width + left + x) * 4;
          if (Math.max(255 - data[offset], 255 - data[offset + 1], 255 - data[offset + 2]) > 32) {
            mask[y * cropWidth + x] = 1;
            occupiedRows[y] = 1;
          }
        }
        const components = [];
        const stack = [];
        for (let start = 0; start < mask.length; start += 1) {
          if (!mask[start]) continue;
          mask[start] = 0;
          stack.push(start);
          let size = 0;
          let sumX = 0;
          let sumY = 0;
          while (stack.length) {
            const current = stack.pop();
            const x = current % cropWidth;
            const y = Math.floor(current / cropWidth);
            size += 1;
            sumX += x;
            sumY += y;
            for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
              if ((!dx && !dy) || x + dx < 0 || x + dx >= cropWidth || y + dy < 0 || y + dy >= cropHeight) continue;
              const next = current + dy * cropWidth + dx;
              if (mask[next]) { mask[next] = 0; stack.push(next); }
            }
          }
          if (size >= 2) components.push({ size, x: sumX / size, y: sumY / size });
        }
        components.sort((first, second) => first.x - second.x || first.y - second.y);
        const bands = [];
        for (let y = 0; y < occupiedRows.length; y += 1) {
          if (!occupiedRows[y]) continue;
          const start = y;
          while (y + 1 < occupiedRows.length && occupiedRows[y + 1]) y += 1;
          bands.push([start, y]);
        }
        return { components, bands };
      };
      for (let pageNumber = 1; pageNumber <= production.numPages; pageNumber += 1) {
        const productionPage = await production.getPage(pageNumber);
        const oraclePage = await oracle.getPage(pageNumber);
        const viewport = productionPage.getViewport({ scale: 4 });
        const oracleViewport = oraclePage.getViewport({ scale: 4 });
        if (viewport.width !== oracleViewport.width || viewport.height !== oracleViewport.height) throw new Error('PDF raster dimensions mismatch');
        const makeCanvas = () => {
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          return canvas;
        };
        const productionCanvas = makeCanvas();
        const oracleCanvas = makeCanvas();
        await productionPage.render({ canvasContext: productionCanvas.getContext('2d'), viewport }).promise;
        await oraclePage.render({ canvasContext: oracleCanvas.getContext('2d'), viewport: oracleViewport }).promise;
        if (pageNumber === 1) {
          firstProductionPng = productionCanvas.toDataURL('image/png').split(',')[1];
          firstOraclePng = oracleCanvas.toDataURL('image/png').split(',')[1];
        }
        const a = productionCanvas.getContext('2d').getImageData(0, 0, viewport.width, viewport.height).data;
        const b = oracleCanvas.getContext('2d').getImageData(0, 0, viewport.width, viewport.height).data;
        const hot = new Uint8Array(viewport.width * viewport.height);
        let pageMatching = 0;
        let pageAbsolute = 0;
        let pageLargestRegion = 0;
        let minInkX = viewport.width;
        let minInkY = viewport.height;
        let maxInkX = -1;
        let maxInkY = -1;
        for (let offset = 0, pixel = 0; offset < a.length; offset += 4, pixel += 1) {
          const red = Math.abs(a[offset] - b[offset]);
          const green = Math.abs(a[offset + 1] - b[offset + 1]);
          const blue = Math.abs(a[offset + 2] - b[offset + 2]);
          const maximum = Math.max(red, green, blue);
          if (maximum <= 8) { matching += 1; pageMatching += 1; }
          if (maximum > 24) hot[pixel] = 1;
          absolute += red + green + blue;
          pageAbsolute += red + green + blue;
          pixels += 1;
          if (Math.max(255 - a[offset], 255 - a[offset + 1], 255 - a[offset + 2]) > 8) {
            const x = pixel % viewport.width;
            const y = Math.floor(pixel / viewport.width);
            minInkX = Math.min(minInkX, x);
            minInkY = Math.min(minInkY, y);
            maxInkX = Math.max(maxInkX, x);
            maxInkY = Math.max(maxInkY, y);
          }
        }
        const stack = [];
        for (let start = 0; start < hot.length; start += 1) {
          if (!hot[start]) continue;
          hot[start] = 0;
          stack.push(start);
          let size = 0;
          while (stack.length) {
            const current = stack.pop();
            size += 1;
            const x = current % viewport.width;
            const y = Math.floor(current / viewport.width);
            for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
              if ((!dx && !dy) || x + dx < 0 || x + dx >= viewport.width || y + dy < 0 || y + dy >= viewport.height) continue;
              const next = current + dy * viewport.width + dx;
              if (hot[next]) { hot[next] = 0; stack.push(next); }
            }
          }
          largestRegion = Math.max(largestRegion, size);
          pageLargestRegion = Math.max(pageLargestRegion, size);
        }
        const content = await productionPage.getTextContent();
        const oracleContent = await oraclePage.getTextContent();
        text += content.items.map((item) => item.str).join(' ') + '\\n';
        const mappedPageTables = [];
        const pageGeometry = fixtureGeometry.filter((entry) => (
          oracleContent.items.some((item) => item.str === entry.anchor)
        ));
        for (const geometry of pageGeometry) {
          const entry = fixtureDescriptor[geometry.index];
          const item = oracleContent.items.find((candidate) => candidate.str === geometry.anchor);
          const productionItem = content.items.find((candidate) => candidate.str === geometry.anchor);
          if (!productionItem) throw new Error('production heading anchor ' + geometry.index);
          const transform = pdfjs.Util.transform(oracleViewport.transform, item.transform);
          const anchor = {
            left: transform[4],
            top: transform[5] - Math.hypot(transform[2], transform[3]),
          };
          if (geometry.index === 0 && verticalCorrection === null) {
            const predicted = mappedRect(geometry.table, anchor);
            let bestY = Math.round(predicted.top);
            let bestCount = -1;
            for (let y = Math.round(predicted.top) - 24; y <= Math.round(predicted.top) + 24; y += 1) {
              let count = 0;
              for (
                let x = Math.ceil(predicted.left + (predicted.right - predicted.left) * 0.25);
                x <= Math.floor(predicted.right - (predicted.right - predicted.left) * 0.25);
                x += 1
              ) if (colorMatches(b, y * viewport.width + x, '#e11d48')) count += 1;
              if (count > bestCount) { bestCount = count; bestY = y; }
            }
            if (bestCount < 100) throw new Error('oracle anchor calibration failed');
            verticalCorrection = bestY - predicted.top;
          }
          anchor.top += verticalCorrection ?? 0;
          const table = mappedRect(geometry.table, anchor);
          const rows = geometry.rows.map((row) => ({
            rect: mappedRect(row.rect, anchor),
            cells: row.cells.map((cell) => ({
              rect: mappedRect(cell.rect, anchor),
              content: mappedRect(cell.content, anchor),
            })),
          }));
          if (table.left < 141 || table.right > 2307 || table.top < 141 || table.bottom > 3099) {
            throw new Error('table ' + geometry.index + ' outside printable bounds ' + JSON.stringify(table));
          }
          mappedPageTables.push({
            index: geometry.index,
            oracle: table,
          });
          const color = entry.borderColor === 'default' ? '#d2d1cf' : entry.borderColor;
          for (const row of rows) for (const cell of row.cells) for (const edge of ['top', 'right', 'bottom', 'left']) {
            if (color === null) {
              const probe = noneProbe(a, viewport.width, cell.rect, edge);
              if (probe.backgroundFraction < 0.98 || probe.longest > 1) {
                throw new Error('None edge ' + geometry.index + ' ' + edge + ' ' + JSON.stringify(probe));
              }
            } else {
              const probe = edgeProbe(a, viewport.width, cell.rect, edge, color, entry.borderWidth * 3);
              if (probe.coverage < 0.9) {
                const diagnosticColumns = [];
                for (let x = 140; x < 1050; x += 1) {
                  let count = 0;
                  for (let y = 320; y < 390; y += 1) if (colorMatches(a, y * viewport.width + x, color)) count += 1;
                  if (count > 20) diagnosticColumns.push([x, count]);
                }
                throw new Error('real edge ' + geometry.index + ' ' + edge + ' ' + JSON.stringify({ probe, rect: cell.rect, table, anchor, diagnosticColumns }));
              }
            }
          }
          if (entry.titleRow) {
            const title = rows[0].rect;
            for (let column = 1; column < entry.logicalWidth; column += 1) {
              const x = table.left + column * ((table.right - table.left) / entry.logicalWidth);
              const probe = noneProbe(a, viewport.width, {
                left: x, right: x, top: title.top, bottom: title.bottom,
              }, 'left');
              if (probe.backgroundFraction < 0.98 || probe.longest > 1) {
                throw new Error('title internal seam ' + geometry.index + ' ' + JSON.stringify(probe));
              }
            }
          }
          const header = rows[entry.titleRow ? 1 : 0];
          for (let column = 0; column < header.cells.length - 1; column += 1) {
            const boundary = header.cells[column].rect.right;
            const probeRect = { left: boundary, right: boundary, top: header.rect.top, bottom: header.rect.bottom };
            if (color === null) {
              const probe = noneProbe(a, viewport.width, probeRect, 'left');
              if (probe.backgroundFraction < 0.98 || probe.longest > 1) {
                throw new Error('None header seam ' + geometry.index + ' ' + JSON.stringify(probe));
              }
            } else {
              const probe = edgeProbe(a, viewport.width, probeRect, 'left', color, entry.borderWidth * 3);
              if (probe.coverage < 0.9) {
                throw new Error('real header seam ' + geometry.index + ' ' + JSON.stringify(probe));
              }
            }
          }
          const dataRow = rows[rows.length - 1];
          const breakContent = dataRow.cells[1].content;
          const productionBreak = inkComponents(a, viewport.width, breakContent).bands;
          if (entry.overflow === 'newline') {
            if (productionBreak.length < 2 || productionBreak[1][0] - productionBreak[0][1] < 6) {
              throw new Error('newline bands ' + geometry.index + ' ' + JSON.stringify(productionBreak));
            }
          } else if (productionBreak.length !== 1) {
            throw new Error('single-line bands ' + geometry.index + ' ' + JSON.stringify(productionBreak));
          }
          const longContent = dataRow.cells[2].content;
          const tail = { ...longContent, left: Math.max(longContent.left, longContent.right - 54) };
          const productionTail = inkComponents(a, viewport.width, tail).components;
          const oracleTail = inkComponents(b, viewport.width, tail).components;
          if (entry.overflow !== 'newline') {
            if (productionTail.length !== oracleTail.length || productionTail.some((component, index) => (
              Math.hypot(component.x - oracleTail[index].x, component.y - oracleTail[index].y) > 2
            ))) {
              throw new Error('tail components ' + geometry.index + ' production=' + JSON.stringify(productionTail) + ' oracle=' + JSON.stringify(oracleTail));
            }
          }
          if (entry.overflow === 'truncate' && oracleTail.length < 3) {
            throw new Error('missing ellipsis components ' + geometry.index + ' ' + JSON.stringify(oracleTail));
          }
          localized.push({
            index: geometry.index,
            pageNumber,
            mode: entry.overflow,
            tail: oracleTail.map((component) => [component.x, component.y, component.size]),
          });
        }
        mappedPageTables.sort((first, second) => first.oracle.top - second.oracle.top);
        const nonTableAnchors = new Set([
          ...pageGeometry.map((entry) => entry.anchor),
          'Before matrix.',
          'After matrix.',
        ]);
        const nonTableRects = oracleContent.items
          .filter((item) => nonTableAnchors.has(item.str))
          .map((item) => {
            const transform = pdfjs.Util.transform(oracleViewport.transform, item.transform);
            const fontHeight = Math.hypot(transform[2], transform[3]);
            return {
              left: transform[4] - 4,
              top: transform[5] - fontHeight + (verticalCorrection ?? 0) - 4,
              right: transform[4] + item.width * oracleViewport.scale + 4,
              bottom: transform[5] + (verticalCorrection ?? 0) + 4,
            };
          });
        if (nonTableRects.length !== pageGeometry.length
          + Number(oracleContent.items.some((item) => item.str === 'Before matrix.'))
          + Number(oracleContent.items.some((item) => item.str === 'After matrix.'))) {
          throw new Error('non-table glyph anchor mismatch on page ' + pageNumber);
        }
        const actualBounds = verifyProductionTableInkOwnership({
          data: a,
          oracleData: b,
          width: viewport.width,
          height: viewport.height,
          tableRects: mappedPageTables.map((mapped) => ({
            ...mapped.oracle,
            index: mapped.index,
            pageNumber,
          })),
          nonTableRects,
          printable: { left: 141, top: 141, right: 2307, bottom: 3099 },
          tolerance: 3,
          glyphDilation: 3,
        });
        productionTableBounds.push(...actualBounds);
        const pagePixels = viewport.width * viewport.height;
        pageMetrics.push({
          matchingFraction: pageMatching / pagePixels,
          meanAbsolutePerChannel: pageAbsolute / (pagePixels * 3),
          largestRegionFraction: pageLargestRegion / pagePixels,
          inkBounds: [minInkX, minInkY, maxInkX, maxInkY],
        });
        dimensions.push([viewport.width, viewport.height]);
      }
      if (localized.length !== fixtureGeometry.length) throw new Error('localized table count ' + localized.length);
      for (let index = 0; index < 48; index += 3) {
        const overflow = localized.find((entry) => entry.index === index);
        const truncate = localized.find((entry) => entry.index === index + 1);
        if (JSON.stringify(overflow.tail) === JSON.stringify(truncate.tail)) {
          throw new Error('overflow/truncate tail components not distinct ' + index);
        }
      }
      return {
        ok: true,
        pages: production.numPages,
        dimensions,
        matchingFraction: matching / pixels,
        meanAbsolutePerChannel: absolute / (pixels * 3),
        largestRegionFraction: largestRegion / (dimensions[0][0] * dimensions[0][1]),
        pageMetrics,
        localizedCount: localized.length,
        tableBoundsCount: productionTableBounds.length,
        text,
        firstProductionPng,
        firstOraclePng,
      };
      } catch (error) {
        return { ok: false, error: String(error && (error.stack || error.message) || error) };
      }
    })()`;
    try {
      new vm.Script(rasterScript, { filename: 'raster-oracle-eval.js' });
    } catch (error) {
      throw new Error(`Invalid raster oracle script: ${error.stack}`);
    }
    const result = await win.webContents.executeJavaScript(rasterScript);
    if (!result?.ok) throw new Error(`PDF.js raster failed: ${result?.error ?? 'unknown'}`);
    assert.ok(result.matchingFraction >= 0.995, `matching fraction ${result.matchingFraction}`);
    assert.ok(result.meanAbsolutePerChannel <= 1.5, `mean error ${result.meanAbsolutePerChannel}`);
    assert.ok(result.largestRegionFraction <= 0.0005, `region ${result.largestRegionFraction}`);
    for (const [index, metric] of result.pageMetrics.entries()) {
      assert.ok(metric.matchingFraction >= 0.995, `page ${index + 1} matching fraction ${metric.matchingFraction}`);
      assert.ok(metric.meanAbsolutePerChannel <= 1.5, `page ${index + 1} mean error ${metric.meanAbsolutePerChannel}`);
      assert.ok(metric.largestRegionFraction <= 0.0005, `page ${index + 1} region ${metric.largestRegionFraction}`);
      assert.ok(metric.inkBounds[0] >= 143 && metric.inkBounds[2] <= 2305, `page ${index + 1} horizontal print bounds`);
      assert.ok(metric.inkBounds[1] >= 143 && metric.inkBounds[3] <= 3097, `page ${index + 1} vertical print bounds`);
    }
    assert.equal(result.localizedCount, 50);
    assert.equal(result.tableBoundsCount, 50);
    return result;
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

function assertDomMatrix(dom) {
  assert.equal(dom.count, 50);
  for (const check of dom.checks) {
    const entry = check.expected;
    assert.equal(check.index, entry.tableIndex);
    assert.equal(check.wrapped, true);
    assert.equal(check.titleCells, entry.titleRow ? 1 : 3);
    assert.equal(check.titleSpan, entry.titleRow ? 3 : 1);
    assert.equal(check.breakCount > 0, entry.overflow === 'newline');
    assert.equal(check.borderStyle, entry.borderColor === null ? 'none' : 'solid');
    if (entry.borderColor === null) assert.equal(check.borderWidth, '0px');
    else assert.equal(check.borderWidth, `${entry.borderWidth}px`);
    assert.equal(check.whiteSpace, entry.overflow === 'newline' ? 'normal' : 'nowrap');
    assert.equal(check.overflow, entry.overflow === 'newline' ? 'visible' : 'hidden');
    assert.equal(check.textOverflow, entry.overflow === 'truncate' ? 'ellipsis' : 'clip');
  }
  assert.equal(dom.checks[49].keepMe, true);
}

async function main() {
  await app.whenReady();
  process.stderr.write('presentation-smoke: ready\n');
  const artifacts = process.env.OFFICE_PRESENTATION_ARTIFACTS;
  fs.mkdirSync(artifacts, { recursive: true });
  const bodyMarkdown = fs.readFileSync(process.env.OFFICE_PRESENTATION_SOURCE, 'utf8');
  const fullMarkdown = fs.readFileSync(process.env.OFFICE_PRESENTATION_FULL_MARKDOWN, 'utf8');
  const tablePresentation = JSON.parse(fs.readFileSync(process.env.OFFICE_PRESENTATION_DESCRIPTOR, 'utf8'));
  const payload = {
    sourceType: 'document', sourceFormat: 'markdown', format: 'pdf',
    content: bodyMarkdown, filename: 'Presentation Output',
    presentationMode: 'office-tables', tablePresentation,
  };
  const validatingCoordinator = createDocumentOutputCoordinator();
  const request = await validatingCoordinator.prepare('export', payload);
  assert.equal(request.mode, 'office-tables');
  process.stderr.write('presentation-smoke: source-bound\n');

  const pdfBuilder = createOfficePdfBuilder({
    getPandocPath,
    htmlToPdf,
    temporaryRoot: process.env.OFFICE_PRESENTATION_STAGING_ROOT,
    processGroupRegistry: process.env.OFFICE_PRESENTATION_CONVERTER_REGISTRY,
  });
  const includeHtmlBuilder = {
    build: (prepared) => pdfBuilder.build(prepared, { includeHtml: true }),
  };
  const coordinator = createDocumentOutputCoordinator({
    officeHandlers: createOfficePdfHandlers(includeHtmlBuilder),
  });
  const exportResult = await coordinator.run('export', payload, () => assert.fail('legacy export fallback'));
  const emailResult = await coordinator.run('email', {
    format: 'pdf', content: bodyMarkdown, filename: 'Presentation Output',
    presentationMode: 'office-tables', tablePresentation,
  }, () => assert.fail('legacy email fallback'));
  const printResult = await coordinator.run('print', {
    content: bodyMarkdown, filename: 'Presentation Output',
    presentationMode: 'office-tables', tablePresentation,
  }, () => assert.fail('legacy print fallback'));
  process.stderr.write('presentation-smoke: production-pdfs\n');

  const docxBuilder = createOfficeDocxBuilder({
    getPandocPath,
    temporaryRoot: process.env.OFFICE_PRESENTATION_STAGING_ROOT,
    processGroupRegistry: process.env.OFFICE_PRESENTATION_CONVERTER_REGISTRY,
  });
  const attachments = createSharedDocumentAttachmentBuilders({
    pdfBuilder,
    docxBuilder,
  });
  const attachmentCoordinator = createDocumentOutputCoordinator({
    officeHandlers: createOfficeAttachmentHandlers(attachments),
  });
  const exportDocx = await attachmentCoordinator.run('export', {
    ...payload,
    format: 'docx',
  }, () => assert.fail('legacy DOCX export fallback'));
  const emailDocx = await attachmentCoordinator.run('email', {
    format: 'docx', content: bodyMarkdown, filename: 'Presentation Output',
    presentationMode: 'office-tables', tablePresentation,
  }, () => assert.fail('legacy DOCX email fallback'));
  const emailMarkdown = attachments.buildMarkdownEmail(fullMarkdown);
  const exportDocxSummary = inspectOfficeDocxPresentation(exportDocx.buffer, request.prepared);
  const emailDocxSummary = inspectOfficeDocxPresentation(emailDocx.buffer, request.prepared);
  assert.deepEqual(exportDocxSummary.summaries, emailDocxSummary.summaries);
  assert.equal(exportDocxSummary.summaries.length, 50);
  assert.equal(exportDocxSummary.summaries[49].matrix[0][1], 'KEEP ME');
  assert.deepEqual(emailMarkdown.buffer, Buffer.from(fullMarkdown, 'utf8'));
  process.stderr.write('presentation-smoke: production-docx-markdown\n');

  const parsed = await parseOfficeTablePresentation(exportResult.transformedHtml);
  assert.equal(parsed.length, 50);
  const dom = await inspectProductionDom(exportResult.transformedHtml, tablePresentation);
  assertDomMatrix(dom);
  process.stderr.write('presentation-smoke: dom-matrix\n');
  const oracle = await independentOracleHtml(exportResult.pandocHtml, tablePresentation);
  process.stderr.write('presentation-smoke: oracle-html\n');
  const oraclePdf = Buffer.from(await htmlToPdf(oracle.html, { printBackground: true, pageSize: 'Letter' }));
  process.stderr.write('presentation-smoke: oracle-pdf\n');
  const raster = await compareAndRasterize(
    exportResult.buffer,
    oraclePdf,
    oracle.geometry,
    tablePresentation,
  );
  process.stderr.write('presentation-smoke: raster\n');
  assert.equal((raster.text.match(/KEEP ME/g) ?? []).length, 1);
  let cursor = -1;
  for (let index = 0; index < 50; index += 1) {
    const id = index < 48
      ? `po-${index < 24 ? 'ordinary' : 'title'}-${Math.floor(index / 12) % 2 === 0 ? 'real' : 'none'}-${Math.floor(index / 3) % 4 + 1}px-${['overflow', 'truncate', 'newline'][index % 3]}`
      : index === 48 ? 'po-default-keyless' : 'po-stale-title';
    cursor = raster.text.indexOf(id, cursor + 1);
    assert.notEqual(cursor, -1, `missing ordered PDF anchor ${id}`);
  }

  const files = {
    'source.md': Buffer.from(bodyMarkdown),
    'descriptor.json': Buffer.from(`${JSON.stringify(tablePresentation, null, 2)}\n`),
    'transformed.html': Buffer.from(exportResult.transformedHtml),
    'print-layout.png': Buffer.from(raster.firstOraclePng, 'base64'),
    'pdf-raster.png': Buffer.from(raster.firstProductionPng, 'base64'),
    'oracle.pdf': oraclePdf,
    'preview-print.pdf': printResult.buffer,
    'export.pdf': exportResult.buffer,
    'email.pdf': emailResult.buffer,
    'export.docx': exportDocx.buffer,
    'email.docx': emailDocx.buffer,
    'email.md': emailMarkdown.buffer,
  };
  for (const [name, bytes] of Object.entries(files)) fs.writeFileSync(path.join(artifacts, name), bytes);
  const assertions = {
    scenario: 'presentation-output/matrix',
    sourceSha256: sha256(files['source.md']),
    descriptorSha256: sha256(files['descriptor.json']),
    files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, {
      bytes: bytes.length,
      sha256: sha256(bytes),
    }])),
    passedAssertionGroups: [
      'source-binding-50', 'structural-dom-50', 'title-and-stale',
      'border-width-color-none-default', 'overflow-truncate-newline-hardbreak',
      'shared-export-email-print-builder', 'production-pdf-parse-raster',
      'independent-oracle-thresholds', 'ordered-text-anchors',
      'localized-table-cell-edges', 'localized-title-header-seams',
      'localized-line-bands-ellipsis', 'per-table-bounds-nonoverlap',
      'docx-50-title-border-break-package', 'shared-docx-download-email',
      'exact-full-frontmatter-markdown',
    ],
  };
  fs.writeFileSync(path.join(artifacts, 'assertions.json'), `${JSON.stringify(assertions, null, 2)}\n`);
}

main().then(() => app.exit(0), (error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  app.exit(1);
});
