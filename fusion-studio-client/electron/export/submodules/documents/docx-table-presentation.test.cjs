'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { strFromU8, strToU8, unzipSync, zipSync } = require('fflate');

const {
  BORDER_NAMES,
  DOCUMENT_PATH,
  TABLE_PROPERTY_NAMES,
  createOfficeDocxBuilder,
  inspectOfficeDocxPresentation,
  transformOfficeDocxPresentation,
} = require('./docx-table-presentation.cjs');
const {
  createDocumentOutputCoordinator,
  createSharedDocumentAttachmentBuilders,
} = require('./document-output-coordinator.cjs');

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const OFFICE_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const OFFICE_DOCUMENT_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
const HYPERLINK_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
const FOOTNOTES_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes';
const NUMBERING_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering';
const MAIN_DOCUMENT_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';

function getPandocPath() {
  return path.join(
    __dirname, '..', '..', '..', 'resources', 'pandoc', process.platform,
    process.platform === 'win32' ? 'pandoc.exe' : 'pandoc',
  );
}

function exactBody(fullMarkdown) {
  const closing = fullMarkdown.indexOf('\n---\n', 4);
  assert.notEqual(closing, -1);
  return fullMarkdown.slice(closing + 5);
}

async function presentationFixture() {
  const fixtureUrl = pathToFileURL(path.join(
    __dirname, '..', '..', '..', '..', 'e2e', 'office', 'fixture-scenarios.mjs',
  )).href;
  const { FIXTURE_SCENARIOS, renderFixtureDocument } = await import(fixtureUrl);
  const template = FIXTURE_SCENARIOS['presentation-output'].documents[0];
  const fullMarkdown = renderFixtureDocument('presentation-output', template, 1, 1);
  const bodyMarkdown = exactBody(fullMarkdown);
  const { bindOfficeTableSources } = await import('../../../shared/office-table-source-binding.mjs');
  const binding = await bindOfficeTableSources(
    bodyMarkdown,
    async (bytes) => crypto.createHash('sha256').update(bytes).digest('hex'),
  );
  const modes = ['overflow', 'truncate', 'newline'];
  const colors = ['#e11d48', '#16a34a', '#2563eb', '#9333ea'];
  const tables = binding.tables.map((source, index) => {
    if (index === 48) {
      return {
        tableIndex: 48, sourceSha256: source.sourceSha256, logicalWidth: 3,
        columns: null, overflow: 'overflow', titleRow: false,
        borderWidth: 1, borderColor: 'default',
      };
    }
    if (index === 49) {
      return {
        tableIndex: 49, sourceSha256: source.sourceSha256, logicalWidth: 3,
        columns: [96, 96, 96], overflow: 'truncate', titleRow: false,
        borderWidth: 4, borderColor: '#004e89',
      };
    }
    const width = Math.floor(index / 3) % 4 + 1;
    return {
      tableIndex: index,
      sourceSha256: source.sourceSha256,
      logicalWidth: 3,
      columns: [96, 96, 96],
      overflow: modes[index % 3],
      titleRow: index >= 24,
      borderWidth: width,
      borderColor: Math.floor(index / 12) % 2 === 0 ? colors[width - 1] : null,
    };
  });
  const descriptor = { markdownSha256: binding.markdownSha256, tables };
  const payload = {
    sourceType: 'document', sourceFormat: 'markdown', format: 'docx',
    content: bodyMarkdown, filename: 'Presentation Output',
    presentationMode: 'office-tables', tablePresentation: descriptor,
  };
  const request = await createDocumentOutputCoordinator().prepare('export', payload);
  return { bodyMarkdown, descriptor, fullMarkdown, payload, prepared: request.prepared };
}

async function preparedMarkdownFixture(bodyMarkdown, filename = 'Focused Presentation') {
  const { bindOfficeTableSources } = await import('../../../shared/office-table-source-binding.mjs');
  const binding = await bindOfficeTableSources(
    bodyMarkdown,
    async (bytes) => crypto.createHash('sha256').update(bytes).digest('hex'),
  );
  const tables = binding.tables.map((source) => ({
    tableIndex: source.tableIndex,
    sourceSha256: source.sourceSha256,
    logicalWidth: source.logicalWidth,
    columns: null,
    overflow: 'newline',
    titleRow: false,
    borderWidth: 1,
    borderColor: 'default',
  }));
  const descriptor = { markdownSha256: binding.markdownSha256, tables };
  const payload = {
    sourceType: 'document', sourceFormat: 'markdown', format: 'docx',
    content: bodyMarkdown, filename,
    presentationMode: 'office-tables', tablePresentation: descriptor,
  };
  const request = await createDocumentOutputCoordinator().prepare('export', payload);
  return { bodyMarkdown, descriptor, payload, prepared: request.prepared };
}

function hashesExceptDocument(buffer) {
  const entries = unzipSync(new Uint8Array(buffer));
  return Object.fromEntries(Object.entries(entries)
    .filter(([name]) => name !== DOCUMENT_PATH)
    .map(([name, bytes]) => [name, crypto.createHash('sha256').update(bytes).digest('hex')]));
}

function mutateXmlPart(buffer, partName, mutate) {
  const entries = unzipSync(new Uint8Array(buffer));
  const document = new DOMParser().parseFromString(strFromU8(entries[partName]), 'application/xml');
  mutate(document);
  entries[partName] = strToU8(new XMLSerializer().serializeToString(document));
  return Buffer.from(zipSync(entries));
}

function duplicateFirstCentralDirectoryEntry(buffer) {
  const bytes = Buffer.from(buffer);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      const commentLength = bytes.readUInt16LE(offset + 20);
      if (offset + 22 + commentLength === bytes.length) {
        endOffset = offset;
        break;
      }
    }
  }
  assert.notEqual(endOffset, -1);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  assert.equal(bytes.readUInt32LE(centralOffset), 0x02014b50);
  const firstLength = 46
    + bytes.readUInt16LE(centralOffset + 28)
    + bytes.readUInt16LE(centralOffset + 30)
    + bytes.readUInt16LE(centralOffset + 32);
  const duplicate = bytes.subarray(centralOffset, centralOffset + firstLength);
  const nextEnd = Buffer.from(bytes.subarray(endOffset));
  nextEnd.writeUInt16LE(nextEnd.readUInt16LE(8) + 1, 8);
  nextEnd.writeUInt16LE(nextEnd.readUInt16LE(10) + 1, 10);
  nextEnd.writeUInt32LE(nextEnd.readUInt32LE(12) + firstLength, 12);
  return Buffer.concat([bytes.subarray(0, endOffset), duplicate, nextEnd]);
}

function zipDirectory(buffer) {
  const bytes = Buffer.from(buffer);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (bytes.readUInt32LE(offset) !== 0x06054b50) continue;
    if (offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) {
      endOffset = offset;
      break;
    }
  }
  assert.notEqual(endOffset, -1);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  const totalEntries = bytes.readUInt16LE(endOffset + 10);
  const records = [];
  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    records.push({
      name,
      centralOffset: cursor,
      flags: bytes.readUInt16LE(cursor + 8),
      crc: bytes.readUInt32LE(cursor + 16),
      compressedSize: bytes.readUInt32LE(cursor + 20),
      uncompressedSize: bytes.readUInt32LE(cursor + 24),
      localOffset: bytes.readUInt32LE(cursor + 42),
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(cursor, endOffset);
  return { bytes, centralOffset, endOffset, records };
}

function mutateZipRecord(buffer, name, mutate) {
  const directory = zipDirectory(buffer);
  const record = directory.records.find((entry) => entry.name === name);
  assert.ok(record, `missing ZIP record ${name}`);
  assert.equal(directory.bytes.readUInt32LE(record.localOffset), 0x04034b50);
  mutate(directory.bytes, record, directory);
  return directory.bytes;
}

function withDataDescriptor(buffer, { signature = true } = {}) {
  const directory = zipDirectory(buffer);
  const record = directory.records.reduce((latest, candidate) => (
    candidate.localOffset > latest.localOffset ? candidate : latest
  ));
  const localNameLength = directory.bytes.readUInt16LE(record.localOffset + 26);
  const localExtraLength = directory.bytes.readUInt16LE(record.localOffset + 28);
  const payloadEnd = record.localOffset + 30 + localNameLength + localExtraLength
    + record.compressedSize;
  assert.equal(payloadEnd, directory.centralOffset);
  const beforeCentral = Buffer.from(directory.bytes.subarray(0, directory.centralOffset));
  beforeCentral.writeUInt16LE(record.flags | 0x0008, record.localOffset + 6);
  beforeCentral.writeUInt32LE(0, record.localOffset + 14);
  beforeCentral.writeUInt32LE(0, record.localOffset + 18);
  beforeCentral.writeUInt32LE(0, record.localOffset + 22);
  const descriptor = Buffer.alloc(signature ? 16 : 12);
  const descriptorOffset = signature ? 4 : 0;
  if (signature) descriptor.writeUInt32LE(0x08074b50, 0);
  descriptor.writeUInt32LE(record.crc, descriptorOffset);
  descriptor.writeUInt32LE(record.compressedSize, descriptorOffset + 4);
  descriptor.writeUInt32LE(record.uncompressedSize, descriptorOffset + 8);
  const tail = Buffer.from(directory.bytes.subarray(directory.centralOffset));
  const next = Buffer.concat([beforeCentral, descriptor, tail]);
  const nextCentralOffset = directory.centralOffset + descriptor.length;
  const nextRecordOffset = record.centralOffset + descriptor.length;
  next.writeUInt16LE(record.flags | 0x0008, nextRecordOffset + 8);
  const nextEndOffset = directory.endOffset + descriptor.length;
  next.writeUInt32LE(nextCentralOffset, nextEndOffset + 16);
  return next;
}

function assertMismatch(callback, message) {
  assert.throws(callback, (error) => error?.code === 'TABLE_PRESENTATION_MISMATCH', message);
}

function assertFiftyCaseSummary(summary, descriptor) {
  assert.equal(summary.summaries.length, 50);
  for (const [index, table] of summary.summaries.entries()) {
    const entry = descriptor.tables[index];
    assert.equal(table.tableIndex, index);
    assert.equal(table.titleMerged, entry.titleRow);
    const expectedId = index < 48
      ? `po-${index < 24 ? 'ordinary' : 'title'}-${Math.floor(index / 12) % 2 === 0 ? 'real' : 'none'}-${Math.floor(index / 3) % 4 + 1}px-${['overflow', 'truncate', 'newline'][index % 3]}`
      : index === 48 ? 'po-default-keyless' : 'po-stale-title';
    assert.ok(table.matrix.flat().some((cell) => cell.includes(expectedId)), `table order ${index}`);
    assert.ok(table.matrix.flat().some((cell) => cell.includes('AlphaSegmentABCDEFGHIJ\nBetaSegmentKLMNOPQRST')));
    assert.ok(table.breaks.flat().some((count) => count >= 1));
    for (const name of BORDER_NAMES) {
      const attributes = table.borders[name];
      if (entry.borderColor === null) {
        assert.deepEqual(attributes, { val: 'nil' });
      } else {
        assert.equal(attributes.val, 'single');
        assert.equal(attributes.sz, String(entry.borderWidth * 6));
        assert.equal(attributes.space, '0');
        assert.equal(
          attributes.color,
          entry.borderColor === 'default' ? 'D2D1CF' : entry.borderColor.slice(1).toUpperCase(),
        );
      }
    }
  }
  assert.equal(summary.summaries[49].matrix[0][1], 'KEEP ME');
}

test('[slice 11.3] generated DOCX preserves all 50 table semantics and unrelated package parts', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-test-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const fixture = await presentationFixture();
  const builder = createOfficeDocxBuilder({ getPandocPath, temporaryRoot });
  const result = await builder.build(fixture.prepared, { includeDiagnostics: true });
  assert.equal(result.buffer.subarray(0, 2).toString('ascii'), 'PK');
  assert.deepEqual(hashesExceptDocument(result.buffer), hashesExceptDocument(result.original));

  const summary = inspectOfficeDocxPresentation(result.buffer, fixture.prepared, {
    bridgedBreaks: result.bridgedBreaks,
  });
  assertFiftyCaseSummary(summary, fixture.descriptor);

  const tamperedEntries = unzipSync(new Uint8Array(result.original));
  const tamperedDocument = new DOMParser().parseFromString(
    strFromU8(tamperedEntries[DOCUMENT_PATH]),
    'application/xml',
  );
  const firstBreak = tamperedDocument.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'br',
  )[0];
  firstBreak.parentNode.removeChild(firstBreak);
  tamperedEntries[DOCUMENT_PATH] = strToU8(new XMLSerializer().serializeToString(tamperedDocument));
  const adjacentRunsWithoutBreak = Buffer.from(zipSync(tamperedEntries));
  assert.throws(
    () => transformOfficeDocxPresentation(adjacentRunsWithoutBreak, fixture.prepared, result),
    (error) => error?.code === 'TABLE_PRESENTATION_MISMATCH',
  );
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});

test('[slice 11.3] canonical table-cell hyperlinks bind exactly and ignored image alt breaks stay invisible', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-link-image-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const linkMarkdown = [
    '| A | B |',
    '| --- | --- |',
    '| [**Alpha<br>Beta**](https://example.com/path?q=1#fragment) | Keep |',
    '',
  ].join('\n');
  const linkFixture = await preparedMarkdownFixture(linkMarkdown, 'Hyperlink');
  const builder = createOfficeDocxBuilder({ getPandocPath, temporaryRoot });
  const linkResult = await builder.build(linkFixture.prepared, { includeDiagnostics: true });
  const linkSummary = inspectOfficeDocxPresentation(
    linkResult.buffer,
    linkFixture.prepared,
    linkResult,
  );
  assert.equal(linkSummary.summaries[0].matrix[1][0], 'Alpha\nBeta');
  assert.equal(linkSummary.summaries[0].breaks[1][0], 1);
  assert.deepEqual(hashesExceptDocument(linkResult.buffer), hashesExceptDocument(linkResult.original));

  const relationshipPart = 'word/_rels/document.xml.rels';
  const relationshipBytes = unzipSync(new Uint8Array(linkResult.original))[relationshipPart];
  assert.deepEqual(
    unzipSync(new Uint8Array(linkResult.buffer))[relationshipPart],
    relationshipBytes,
    'the hyperlink relationship part must remain byte-exact',
  );

  const documentMutations = {
    missingId(document) {
      document.getElementsByTagNameNS(WORD_NS, 'hyperlink')[0]
        .removeAttributeNS(OFFICE_REL_NS, 'id');
    },
    unknownId(document) {
      document.getElementsByTagNameNS(WORD_NS, 'hyperlink')[0]
        .setAttributeNS(OFFICE_REL_NS, 'r:id', 'rIdMissing');
    },
    extraHyperlinkAttribute(document) {
      document.getElementsByTagNameNS(WORD_NS, 'hyperlink')[0]
        .setAttributeNS(WORD_NS, 'w:history', '1');
    },
    wrappedHyperlink(document) {
      const hyperlink = document.getElementsByTagNameNS(WORD_NS, 'hyperlink')[0];
      const wrapper = document.createElementNS(WORD_NS, 'w:bogus');
      hyperlink.parentNode.replaceChild(wrapper, hyperlink);
      wrapper.appendChild(hyperlink);
    },
    nonRunChild(document) {
      document.getElementsByTagNameNS(WORD_NS, 'hyperlink')[0]
        .appendChild(document.createElementNS(WORD_NS, 'w:smartTag'));
    },
    missingRunStyle(document) {
      const style = document.getElementsByTagNameNS(WORD_NS, 'rStyle')[0];
      style.parentNode.removeChild(style);
    },
    wrongRunStyle(document) {
      document.getElementsByTagNameNS(WORD_NS, 'rStyle')[0]
        .setAttributeNS(WORD_NS, 'w:val', 'NotHyperlink');
    },
    duplicateRunStyle(document) {
      const style = document.getElementsByTagNameNS(WORD_NS, 'rStyle')[0];
      style.parentNode.appendChild(style.cloneNode(true));
    },
    unsupportedRunProperty(document) {
      const properties = document.getElementsByTagNameNS(WORD_NS, 'rStyle')[0].parentNode;
      properties.appendChild(document.createElementNS(WORD_NS, 'w:bogus'));
    },
    attributedRun(document) {
      document.getElementsByTagNameNS(WORD_NS, 'hyperlink')[0]
        .getElementsByTagNameNS(WORD_NS, 'r')[0]
        .setAttributeNS(WORD_NS, 'w:bogus', '1');
    },
    attributedText(document) {
      document.getElementsByTagNameNS(WORD_NS, 'hyperlink')[0]
        .getElementsByTagNameNS(WORD_NS, 't')[0]
        .setAttributeNS(WORD_NS, 'w:bogus', '1');
    },
  };
  for (const [name, mutate] of Object.entries(documentMutations)) {
    const incoming = mutateXmlPart(linkResult.original, DOCUMENT_PATH, mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, linkFixture.prepared, linkResult,
    ), `${name}-incoming`);
    const reopened = mutateXmlPart(linkResult.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, linkFixture.prepared, linkResult,
    ), `${name}-reopened`);
  }

  const relationshipMutations = {
    wrongType(document) {
      const relationship = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttribute('Type') === HYPERLINK_REL
      ));
      relationship.setAttribute('Type', `${OFFICE_DOCUMENT_REL}/image`);
    },
    internalMode(document) {
      const relationship = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttribute('Type') === HYPERLINK_REL
      ));
      relationship.setAttribute('TargetMode', 'Internal');
    },
    malformedExternal(document) {
      const relationship = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttribute('Type') === HYPERLINK_REL
      ));
      relationship.setAttribute('Target', 'relative/%2fpath');
    },
    changedId(document) {
      const relationship = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttribute('Type') === HYPERLINK_REL
      ));
      relationship.setAttribute('Id', 'rIdChanged');
    },
  };
  for (const [name, mutate] of Object.entries(relationshipMutations)) {
    const incoming = mutateXmlPart(linkResult.original, relationshipPart, mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, linkFixture.prepared, linkResult,
    ), `${name}-incoming`);
    const reopened = mutateXmlPart(linkResult.buffer, relationshipPart, mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, linkFixture.prepared, linkResult,
    ), `${name}-reopened`);
  }

  const imageMarkdown = [
    '| A | B |',
    '| --- | --- |',
    '| ![A<br>B](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=) | Visible<br>Break |',
    '',
  ].join('\n');
  const imageFixture = await preparedMarkdownFixture(imageMarkdown, 'Image Alt');
  const imageResult = await builder.build(imageFixture.prepared, { includeDiagnostics: true });
  assert.deepEqual(imageResult.bridgedBreaks, [[[0, 0], [0, 1]]]);
  const imageSummary = inspectOfficeDocxPresentation(
    imageResult.buffer,
    imageFixture.prepared,
    imageResult,
  );
  assert.deepEqual(imageSummary.summaries[0].matrix[1], ['', 'Visible\nBreak']);
  assert.deepEqual(imageSummary.summaries[0].breaks[1], [0, 1]);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});

test('[slice 11.3] inline code and absolute, relative, and local-anchor links preserve canonical semantics', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-inline-links-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const markdown = [
    '| Direct | Relative | Anchor |',
    '| --- | --- | --- |',
    '| `dPlain` **`dBold`** *`dItalic`* ~~`dStrike`~~ ***~~`dNested`~~*** **bold** *italic* ~~strike~~ | [`rPlain`](relative.md) [**`rBold`**](relative-bold.md) [*`rItalic`*](relative-italic.md) [~~`rStrike`~~](relative-strike.md) [***~~`rNested`~~***](relative-nested.md) [https](https://example.com/path?q=1) [mail](mailto:owner@example.com) [tel](tel:+15551212) | [`aPlain`](#section) [**`aBold`**](#section-bold) [*`aItalic`*](#section-italic) [~~`aStrike`~~](#section-strike) [***~~`aNested`~~***](#section-nested) [space](#a%20b) [unicode](#café) [colon](#a:b) [slash](#a/b) [query](#a?b) [latin](#é) [cjk](#漢) [greek](#β) [nfc](#é) [underscore](#_a) [digit](#123) [hyphen](#-a) [dot](#.a) [colonStart](#:a) [emoji](#😀) |',
    '',
  ].join('\n');
  const fixture = await preparedMarkdownFixture(markdown, 'Inline Variants');
  const result = await createOfficeDocxBuilder({ getPandocPath, temporaryRoot })
    .build(fixture.prepared, { includeDiagnostics: true });
  const summary = inspectOfficeDocxPresentation(result.buffer, fixture.prepared, result);
  assert.deepEqual(summary.summaries[0].matrix[1], [
    'dPlain dBold dItalic dStrike dNested bold italic strike',
    'rPlain rBold rItalic rStrike rNested https mail tel',
    'aPlain aBold aItalic aStrike aNested space unicode colon slash query latin cjk greek nfc underscore digit hyphen dot colonStart emoji',
  ]);
  assert.deepEqual(hashesExceptDocument(result.buffer), hashesExceptDocument(result.original));

  const originalDocument = new DOMParser().parseFromString(
    strFromU8(unzipSync(new Uint8Array(result.original))[DOCUMENT_PATH]),
    'application/xml',
  );
  const anchorValues = Array.from(originalDocument.getElementsByTagNameNS(WORD_NS, 'hyperlink'))
    .filter((node) => node.hasAttributeNS(WORD_NS, 'anchor'))
    .map((node) => node.getAttributeNS(WORD_NS, 'anchor'));
  const rewritten = (value) => {
    const digest = crypto.createHash('sha1').update(value.normalize('NFC')).digest('hex');
    return `X${digest.slice(1)}`;
  };
  for (const preserved of ['é', '漢', 'β']) assert.ok(anchorValues.includes(preserved));
  for (const rewrittenSource of ['_a', '123', '-a', '.a', ':a', '😀']) {
    assert.ok(anchorValues.includes(rewritten(rewrittenSource)));
  }

  function styleByValue(document, value) {
    return Array.from(document.getElementsByTagNameNS(WORD_NS, 'rStyle')).find((style) => (
      style.getAttributeNS(WORD_NS, 'val') === value
    ));
  }
  function anchorHyperlink(document) {
    return Array.from(document.getElementsByTagNameNS(WORD_NS, 'hyperlink')).find((node) => (
      node.hasAttributeNS(WORD_NS, 'anchor')
    ));
  }
  function runByText(document, text) {
    const textNode = Array.from(document.getElementsByTagNameNS(WORD_NS, 't')).find((node) => (
      node.textContent === text
    ));
    assert.ok(textNode);
    return textNode.parentNode;
  }
  const inlineCodeMutations = {
    wrongStyle(document) {
      styleByValue(document, 'VerbatimChar').setAttributeNS(WORD_NS, 'w:val', 'Hyperlink');
    },
    duplicateStyle(document) {
      const style = styleByValue(document, 'VerbatimChar');
      style.parentNode.appendChild(style.cloneNode(true));
    },
    attributedStyle(document) {
      styleByValue(document, 'VerbatimChar').setAttributeNS(WORD_NS, 'w:bogus', '1');
    },
    extraCodeProperty(document) {
      const style = styleByValue(document, 'VerbatimChar');
      style.parentNode.appendChild(document.createElementNS(WORD_NS, 'w:b'));
    },
    missingCodeCompanion(document) {
      const properties = runByText(document, 'dBold').getElementsByTagNameNS(WORD_NS, 'rPr')[0];
      properties.removeChild(properties.getElementsByTagNameNS(WORD_NS, 'bCs')[0]);
    },
    reversedCodeProperties(document) {
      const properties = runByText(document, 'dNested').getElementsByTagNameNS(WORD_NS, 'rPr')[0];
      const bold = properties.getElementsByTagNameNS(WORD_NS, 'b')[0];
      properties.appendChild(bold);
    },
    linkedCodeMissingCompanion(document) {
      const properties = runByText(document, 'rItalic').getElementsByTagNameNS(WORD_NS, 'rPr')[0];
      properties.removeChild(properties.getElementsByTagNameNS(WORD_NS, 'iCs')[0]);
    },
    linkedCodeConflictingStyle(document) {
      const properties = runByText(document, 'aPlain').getElementsByTagNameNS(WORD_NS, 'rPr')[0];
      const conflicting = document.createElementNS(WORD_NS, 'w:rStyle');
      conflicting.setAttributeNS(WORD_NS, 'w:val', 'Hyperlink');
      properties.appendChild(conflicting);
    },
    linkedCodeStyleSwap(document) {
      const style = runByText(document, 'rPlain').getElementsByTagNameNS(WORD_NS, 'rStyle')[0];
      style.setAttributeNS(WORD_NS, 'w:val', 'Hyperlink');
    },
    ordinaryLinkStyleSwap(document) {
      const style = runByText(document, 'https').getElementsByTagNameNS(WORD_NS, 'rStyle')[0];
      style.setAttributeNS(WORD_NS, 'w:val', 'VerbatimChar');
    },
    addCompleteBoldToPlainCode(document) {
      const properties = runByText(document, 'dPlain').getElementsByTagNameNS(WORD_NS, 'rPr')[0];
      properties.appendChild(document.createElementNS(WORD_NS, 'w:b'));
      properties.appendChild(document.createElementNS(WORD_NS, 'w:bCs'));
    },
    removeCompleteBoldFromBoldCode(document) {
      const properties = runByText(document, 'dBold').getElementsByTagNameNS(WORD_NS, 'rPr')[0];
      properties.removeChild(properties.getElementsByTagNameNS(WORD_NS, 'b')[0]);
      properties.removeChild(properties.getElementsByTagNameNS(WORD_NS, 'bCs')[0]);
    },
    removeStrikeFromLinkedCode(document) {
      const properties = runByText(document, 'rStrike').getElementsByTagNameNS(WORD_NS, 'rPr')[0];
      properties.removeChild(properties.getElementsByTagNameNS(WORD_NS, 'strike')[0]);
    },
    styleAfterText(document) {
      const style = styleByValue(document, 'VerbatimChar');
      const run = style.parentNode.parentNode;
      run.appendChild(style.parentNode);
    },
    wrappedCodeRun(document) {
      const style = styleByValue(document, 'VerbatimChar');
      const run = style.parentNode.parentNode;
      const wrapper = document.createElementNS(WORD_NS, 'w:smartTag');
      run.parentNode.replaceChild(wrapper, run);
      wrapper.appendChild(run);
    },
    misparentedStyle(document) {
      const style = styleByValue(document, 'VerbatimChar');
      const paragraph = style.parentNode.parentNode.parentNode;
      paragraph.appendChild(style);
    },
  };
  for (const [name, mutate] of Object.entries(inlineCodeMutations)) {
    const incoming = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, fixture.prepared, result,
    ), `${name}-incoming`);
    const reopened = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, fixture.prepared, result,
    ), `${name}-reopened`);
  }

  const anchorMutations = {
    ambiguousReference(document) {
      const anchor = anchorHyperlink(document);
      const relationshipId = Array.from(document.getElementsByTagNameNS(WORD_NS, 'hyperlink'))
        .map((node) => node.getAttributeNS(OFFICE_REL_NS, 'id'))
        .find(Boolean);
      anchor.setAttributeNS(OFFICE_REL_NS, 'r:id', relationshipId);
    },
    emptyAnchor(document) {
      anchorHyperlink(document).setAttributeNS(WORD_NS, 'w:anchor', '');
    },
    malformedAnchor(document) {
      anchorHyperlink(document).setAttributeNS(WORD_NS, 'w:anchor', 'bad anchor');
    },
    rawFragmentDelimiter(document) {
      anchorHyperlink(document).setAttributeNS(WORD_NS, 'w:anchor', 'bad#anchor');
    },
    malformedAnchorEscape(document) {
      anchorHyperlink(document).setAttributeNS(WORD_NS, 'w:anchor', 'bad%ZZ');
    },
    lowercaseAnchorEscape(document) {
      anchorHyperlink(document).setAttributeNS(WORD_NS, 'w:anchor', 'bad%2fanchor');
    },
    encodedAnchorUnreserved(document) {
      anchorHyperlink(document).setAttributeNS(WORD_NS, 'w:anchor', 'b%61d');
    },
    unicodeAnchorAlias(document) {
      runByText(document, 'latin').parentNode.setAttributeNS(WORD_NS, 'w:anchor', 'e%CC%81');
    },
    unicodeAnchorSwap(document) {
      runByText(document, 'latin').parentNode.setAttributeNS(WORD_NS, 'w:anchor', '漢');
    },
    rewrittenAnchorAlias(document) {
      runByText(document, 'underscore').parentNode.setAttributeNS(WORD_NS, 'w:anchor', '_a');
    },
    anchorControl(document) {
      anchorHyperlink(document).setAttributeNS(WORD_NS, 'w:anchor', 'bad\u0001anchor');
    },
    anchorBackslash(document) {
      anchorHyperlink(document).setAttributeNS(WORD_NS, 'w:anchor', 'bad\\anchor');
    },
    unqualifiedAnchor(document) {
      const anchor = anchorHyperlink(document);
      anchor.removeAttributeNS(WORD_NS, 'anchor');
      anchor.setAttribute('anchor', 'section');
    },
    extraAnchorAttribute(document) {
      anchorHyperlink(document).setAttributeNS(WORD_NS, 'w:history', '1');
    },
    wrappedAnchor(document) {
      const anchor = anchorHyperlink(document);
      const wrapper = document.createElementNS(WORD_NS, 'w:smartTag');
      anchor.parentNode.replaceChild(wrapper, anchor);
      wrapper.appendChild(anchor);
    },
    wrongAnchorStyle(document) {
      const anchor = anchorHyperlink(document);
      anchor.getElementsByTagNameNS(WORD_NS, 'rStyle')[0]
        .setAttributeNS(WORD_NS, 'w:val', 'NotAStyle');
    },
  };
  for (const [name, mutate] of Object.entries(anchorMutations)) {
    const incoming = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, fixture.prepared, result,
    ), `${name}-incoming`);
    const reopened = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, fixture.prepared, result,
    ), `${name}-reopened`);
  }

  const relationshipPart = 'word/_rels/document.xml.rels';
  function relativeRelationship(document) {
    return Array.from(document.documentElement.childNodes).find((node) => (
      node.nodeType === 1
      && node.getAttribute('Type') === HYPERLINK_REL
      && node.getAttribute('Target') === 'relative.md'
    ));
  }
  const relativeTargetMutations = {
    empty(document) { relativeRelationship(document).setAttribute('Target', ''); },
    malformedEscape(document) { relativeRelationship(document).setAttribute('Target', 'relative%ZZ'); },
    lowercaseEscape(document) { relativeRelationship(document).setAttribute('Target', 'relative%2fpath'); },
    encodedUnreserved(document) { relativeRelationship(document).setAttribute('Target', 'rel%61tive.md'); },
    backslash(document) { relativeRelationship(document).setAttribute('Target', 'relative\\path'); },
    rawSpace(document) { relativeRelationship(document).setAttribute('Target', 'relative path'); },
    internalMode(document) { relativeRelationship(document).setAttribute('TargetMode', 'Internal'); },
    missingMode(document) { relativeRelationship(document).removeAttribute('TargetMode'); },
    wrongType(document) { relativeRelationship(document).setAttribute('Type', `${OFFICE_DOCUMENT_REL}/image`); },
  };
  for (const [name, mutate] of Object.entries(relativeTargetMutations)) {
    const incoming = mutateXmlPart(result.original, relationshipPart, mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, fixture.prepared, result,
    ), `${name}-incoming`);
    const reopened = mutateXmlPart(result.buffer, relationshipPart, mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, fixture.prepared, result,
    ), `${name}-reopened`);
  }
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});

test('[slice 11.3] table footnotes remain ignored semantic content with exact package binding', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-footnote-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const markdown = [
    '| A | B |',
    '| --- | --- |',
    '| Cell[^1] More[^2] | Keep |',
    '',
    '[^1]: foot<br>note',
    '[^2]: second',
    '',
  ].join('\n');
  const fixture = await preparedMarkdownFixture(markdown, 'Footnote');
  const result = await createOfficeDocxBuilder({ getPandocPath, temporaryRoot })
    .build(fixture.prepared, { includeDiagnostics: true });
  const summary = inspectOfficeDocxPresentation(result.buffer, fixture.prepared, result);
  assert.deepEqual(summary.summaries[0].matrix[1], ['Cell More', 'Keep']);
  assert.deepEqual(result.footnoteBodies.map(({ id, text }) => ({ id, text })), [
    { id: 9, text: 'footnote' },
    { id: 10, text: 'second' },
  ]);
  assert.deepEqual(hashesExceptDocument(result.buffer), hashesExceptDocument(result.original));

  function removeUnusedNumberingRelationship(document) {
    const relationship = Array.from(document.documentElement.childNodes).find((node) => (
      node.nodeType === 1 && node.getAttribute('Type') === NUMBERING_REL
    ));
    assert.ok(relationship);
    relationship.parentNode.removeChild(relationship);
  }
  const unreferencedNumberingIncoming = mutateXmlPart(
    result.original,
    'word/_rels/document.xml.rels',
    removeUnusedNumberingRelationship,
  );
  const unreferencedNumberingOutput = transformOfficeDocxPresentation(
    unreferencedNumberingIncoming,
    fixture.prepared,
    result,
  );
  inspectOfficeDocxPresentation(unreferencedNumberingOutput, fixture.prepared, result);
  const unreferencedNumberingReopened = mutateXmlPart(
    result.buffer,
    'word/_rels/document.xml.rels',
    removeUnusedNumberingRelationship,
  );
  inspectOfficeDocxPresentation(unreferencedNumberingReopened, fixture.prepared, result);

  function referenceRun(document) {
    return document.getElementsByTagNameNS(WORD_NS, 'footnoteReference')[0].parentNode;
  }
  const documentMutations = {
    wrongStyle(document) {
      referenceRun(document).getElementsByTagNameNS(WORD_NS, 'rStyle')[0]
        .setAttributeNS(WORD_NS, 'w:val', 'Hyperlink');
    },
    malformedId(document) {
      referenceRun(document).getElementsByTagNameNS(WORD_NS, 'footnoteReference')[0]
        .setAttributeNS(WORD_NS, 'w:id', '09');
    },
    missingId(document) {
      referenceRun(document).getElementsByTagNameNS(WORD_NS, 'footnoteReference')[0]
        .removeAttributeNS(WORD_NS, 'id');
    },
    duplicateLeaf(document) {
      const run = referenceRun(document);
      run.appendChild(run.getElementsByTagNameNS(WORD_NS, 'footnoteReference')[0].cloneNode(true));
    },
    duplicateRun(document) {
      const run = referenceRun(document);
      run.parentNode.insertBefore(run.cloneNode(true), run.nextSibling);
    },
    hyperlinkedReference(document) {
      const run = referenceRun(document);
      const hyperlink = document.createElementNS(WORD_NS, 'w:hyperlink');
      hyperlink.setAttributeNS(WORD_NS, 'w:anchor', 'section');
      run.parentNode.replaceChild(hyperlink, run);
      hyperlink.appendChild(run);
    },
  };
  for (const [name, mutate] of Object.entries(documentMutations)) {
    const incoming = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, fixture.prepared, result,
    ), `${name}-incoming`);
    const reopened = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, fixture.prepared, result,
    ), `${name}-reopened`);
  }

  const relationshipPart = 'word/_rels/document.xml.rels';
  function footnoteRelationship(document) {
    return Array.from(document.documentElement.childNodes).find((node) => (
      node.nodeType === 1 && node.getAttribute('Type') === FOOTNOTES_REL
    ));
  }
  const relationshipMutations = {
    missing(document) {
      const relationship = footnoteRelationship(document);
      relationship.parentNode.removeChild(relationship);
    },
    duplicate(document) {
      const relationship = footnoteRelationship(document);
      relationship.parentNode.appendChild(relationship.cloneNode(true));
    },
    wrongType(document) {
      footnoteRelationship(document).setAttribute('Type', HYPERLINK_REL);
    },
    externalMode(document) {
      footnoteRelationship(document).setAttribute('TargetMode', 'External');
    },
    explicitInternalMode(document) {
      footnoteRelationship(document).setAttribute('TargetMode', 'Internal');
    },
    wrongTarget(document) {
      footnoteRelationship(document).setAttribute('Target', 'comments.xml');
    },
  };
  for (const [name, mutate] of Object.entries(relationshipMutations)) {
    const incoming = mutateXmlPart(result.original, relationshipPart, mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, fixture.prepared, result,
    ), `${name}-incoming`);
    const reopened = mutateXmlPart(result.buffer, relationshipPart, mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, fixture.prepared, result,
    ), `${name}-reopened`);
  }

  const contentTypeMutations = {
    missing(document) {
      const override = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttribute('PartName') === '/word/footnotes.xml'
      ));
      override.parentNode.removeChild(override);
    },
    wrong(document) {
      const override = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttribute('PartName') === '/word/footnotes.xml'
      ));
      override.setAttribute('ContentType', MAIN_DOCUMENT_CONTENT_TYPE);
    },
  };
  for (const [name, mutate] of Object.entries(contentTypeMutations)) {
    const incoming = mutateXmlPart(result.original, '[Content_Types].xml', mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, fixture.prepared, result,
    ), `${name}-content-type-incoming`);
    const reopened = mutateXmlPart(result.buffer, '[Content_Types].xml', mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, fixture.prepared, result,
    ), `${name}-content-type-reopened`);
  }

  const footnotePartMutations = {
    forgedText(document) {
      const text = Array.from(document.getElementsByTagNameNS(WORD_NS, 't'))
        .find((node) => node.textContent === 'foot');
      text.textContent = 'FORGED';
    },
    forgedWhitespace(document) {
      const text = Array.from(document.getElementsByTagNameNS(WORD_NS, 't'))
        .find((node) => node.textContent === 'foot');
      text.textContent = 'foot ';
    },
    forgedBreak(document) {
      const text = Array.from(document.getElementsByTagNameNS(WORD_NS, 't'))
        .find((node) => node.textContent === 'foot');
      text.parentNode.appendChild(document.createElementNS(WORD_NS, 'w:br'));
    },
    extraParagraph(document) {
      const footnote = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '9'
      ));
      const paragraph = document.createElementNS(WORD_NS, 'w:p');
      const run = document.createElementNS(WORD_NS, 'w:r');
      const text = document.createElementNS(WORD_NS, 'w:t');
      text.appendChild(document.createTextNode('EXTRA'));
      run.appendChild(text);
      paragraph.appendChild(run);
      footnote.appendChild(paragraph);
    },
    missingBody(document) {
      const footnote = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '9'
      ));
      footnote.parentNode.removeChild(footnote);
    },
    duplicateBody(document) {
      const footnote = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '9'
      ));
      footnote.parentNode.appendChild(footnote.cloneNode(true));
    },
    malformedBodyId(document) {
      const footnote = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '9'
      ));
      footnote.setAttributeNS(WORD_NS, 'w:id', '09');
    },
    reorderedBodies(document) {
      const first = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '9'
      ));
      const second = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '10'
      ));
      document.documentElement.insertBefore(second, first);
    },
    reorderedSentinels(document) {
      const continuation = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '0'
      ));
      const separator = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '-1'
      ));
      document.documentElement.insertBefore(separator, continuation);
    },
    missingSentinel(document) {
      const sentinel = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '0'
      ));
      sentinel.parentNode.removeChild(sentinel);
    },
    duplicateSentinel(document) {
      const sentinel = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '0'
      ));
      sentinel.parentNode.insertBefore(sentinel.cloneNode(true), sentinel.nextSibling);
    },
  };
  for (const [name, mutate] of Object.entries(footnotePartMutations)) {
    const incoming = mutateXmlPart(result.original, 'word/footnotes.xml', mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, fixture.prepared, result,
    ), `${name}-incoming`);
    const reopened = mutateXmlPart(result.buffer, 'word/footnotes.xml', mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, fixture.prepared, result,
    ), `${name}-reopened`);
  }

  function remapReferenceId(buffer, nextId) {
    const documentRemap = mutateXmlPart(buffer, DOCUMENT_PATH, (document) => {
      document.getElementsByTagNameNS(WORD_NS, 'footnoteReference')[0]
        .setAttributeNS(WORD_NS, 'w:id', nextId);
    });
    return mutateXmlPart(documentRemap, 'word/footnotes.xml', (document) => {
      const footnote = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '9'
      ));
      footnote.setAttributeNS(WORD_NS, 'w:id', nextId);
    });
  }
  assertMismatch(() => transformOfficeDocxPresentation(
    remapReferenceId(result.original, '11'), fixture.prepared, result,
  ), 'source-bound-id-incoming');
  assertMismatch(() => inspectOfficeDocxPresentation(
    remapReferenceId(result.buffer, '11'), fixture.prepared, result,
  ), 'source-bound-id-reopened');
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});

test('[slice 11.3] positive footnote bodies preserve canonical block and rich-run structure', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-rich-footnote-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const markdown = [
    'Before[^rich]',
    '',
    '| A | B |',
    '| --- | --- |',
    '| Cell | Keep |',
    '',
    '[^rich]: Plain **bold** *italic* ~~strike~~ `code` [relative](relative.md) [anchor](#section)  ',
    '    hard next raw<br>html',
    '    [linked hard  ',
    '    break](hard.md)',
    '',
    '    Second paragraph soft',
    '    line',
    '',
    '    - item one',
    '    - item **two**',
    '',
    '    3. third',
    '    4. fourth',
    '',
    '    > quote *text*',
    '',
    '        code block',
    '        second code',
    '',
  ].join('\n');
  const fixture = await preparedMarkdownFixture(markdown, 'Rich Footnote');
  const result = await createOfficeDocxBuilder({ getPandocPath, temporaryRoot })
    .build(fixture.prepared, { includeDiagnostics: true });
  const body = result.footnoteBodies[0];
  assert.equal(body.id, 9);
  assert.equal(body.prefixMode, 'inline');
  function expectedList(key, level, format, start, pattern) {
    const bulletMarkers = [
      { glyph: '\uf0b7', font: 'Symbol' },
      { glyph: 'o', font: 'Courier New' },
      { glyph: '\uf0a7', font: 'Wingdings' },
    ];
    const bullet = format === 'bullet' ? bulletMarkers[level % bulletMarkers.length] : null;
    return {
      key,
      level,
      format,
      start,
      pattern,
      marker: true,
      markerGlyph: bullet?.glyph ?? null,
      justification: 'left',
      suffix: null,
      tabs: null,
      left: (level + 1) * 720,
      hanging: 360,
      markerFont: bullet?.font ?? null,
    };
  }
  assert.deepEqual(body.blocks.map((block) => ({
    style: block.style,
    list: block.list,
    text: block.inlines.map((inline) => inline.value).join(''),
  })), [
    { style: 'FootnoteText', list: null, text: 'Plain bold italic strike code relative anchor\nhard next rawhtml linked hard\nbreak' },
    { style: 'FootnoteText', list: null, text: 'Second paragraph soft line' },
    { style: 'Compact', list: expectedList(1, 0, 'bullet', 1, null), text: 'item one' },
    { style: 'Compact', list: expectedList(1, 0, 'bullet', 1, null), text: 'item two' },
    { style: 'Compact', list: expectedList(2, 0, 'decimal', 3, '%1.'), text: 'third' },
    { style: 'Compact', list: expectedList(2, 0, 'decimal', 3, '%1.'), text: 'fourth' },
    { style: 'FootnoteBlockText', list: null, text: 'quote text' },
    { style: 'SourceCode', list: null, text: 'code block\nsecond code' },
  ]);

  function bodyFootnote(document) {
    const footnote = Array.from(document.documentElement.childNodes).find((node) => (
      node.nodeType === 1 && node.getAttributeNS(WORD_NS, 'id') === '9'
    ));
    assert.ok(footnote);
    return footnote;
  }
  function textNode(document, value) {
    const text = Array.from(document.getElementsByTagNameNS(WORD_NS, 't'))
      .find((node) => node.textContent === value);
    assert.ok(text, `missing footnote text ${value}`);
    return text;
  }
  function runForText(document, value) {
    return textNode(document, value).parentNode;
  }
  function prependRunProperties(document, run, names) {
    const properties = document.createElementNS(WORD_NS, 'w:rPr');
    for (const name of names) properties.appendChild(document.createElementNS(WORD_NS, `w:${name}`));
    run.insertBefore(properties, run.firstChild);
  }
  function removeRunProperty(document, value, name) {
    const run = runForText(document, value);
    const property = Array.from(run.getElementsByTagNameNS(WORD_NS, name))[0];
    assert.ok(property);
    property.parentNode.removeChild(property);
  }
  function bodyParagraphs(document) {
    return Array.from(bodyFootnote(document).childNodes).filter((node) => (
      node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'p'
    ));
  }
  const bodyMutations = {
    forgedBoldOnPlain(document) {
      prependRunProperties(document, runForText(document, 'Plain'), ['b', 'bCs']);
    },
    missingBold(document) {
      removeRunProperty(document, 'bold', 'b');
    },
    missingItalic(document) {
      removeRunProperty(document, 'italic', 'i');
    },
    missingStrike(document) {
      removeRunProperty(document, 'strike', 'strike');
    },
    missingCodeStyle(document) {
      removeRunProperty(document, 'code', 'rStyle');
    },
    missingHyperlinkStyle(document) {
      removeRunProperty(document, 'relative', 'rStyle');
    },
    forgedAnchor(document) {
      const hyperlink = Array.from(document.getElementsByTagNameNS(WORD_NS, 'hyperlink'))
        .find((node) => node.getAttributeNS(WORD_NS, 'anchor') === 'section');
      assert.ok(hyperlink);
      hyperlink.setAttributeNS(WORD_NS, 'w:anchor', 'forged-section');
    },
    missingHardBreak(document) {
      const hardBreak = Array.from(document.getElementsByTagNameNS(WORD_NS, 'br'))[0];
      assert.ok(hardBreak);
      hardBreak.parentNode.parentNode.removeChild(hardBreak.parentNode);
    },
    extraEmptyRun(document) {
      bodyParagraphs(document)[1].appendChild(document.createElementNS(WORD_NS, 'w:r'));
    },
    wrappedRun(document) {
      const run = runForText(document, 'Second paragraph soft');
      const wrapper = document.createElementNS(WORD_NS, 'w:smartTag');
      run.parentNode.replaceChild(wrapper, run);
      wrapper.appendChild(run);
    },
    unknownParagraphAttribute(document) {
      bodyParagraphs(document)[1].setAttributeNS(WORD_NS, 'w:forged', '1');
    },
    reorderedParagraphs(document) {
      const [first, second, third] = bodyParagraphs(document);
      assert.ok(first && second && third);
      second.parentNode.insertBefore(third, second);
    },
    forgedListLevel(document) {
      const level = Array.from(document.getElementsByTagNameNS(WORD_NS, 'ilvl'))[0];
      assert.ok(level);
      level.setAttributeNS(WORD_NS, 'w:val', '1');
    },
    forgedBlockquoteStyle(document) {
      const paragraph = bodyParagraphs(document).find((node) => node.textContent.includes('quote text'));
      const style = paragraph.getElementsByTagNameNS(WORD_NS, 'pStyle')[0];
      style.setAttributeNS(WORD_NS, 'w:val', 'FootnoteText');
    },
    forgedCodeBlockStyle(document) {
      const paragraph = bodyParagraphs(document).find((node) => node.textContent.includes('code block'));
      const style = paragraph.getElementsByTagNameNS(WORD_NS, 'pStyle')[0];
      style.setAttributeNS(WORD_NS, 'w:val', 'FootnoteText');
    },
  };
  for (const [name, mutate] of Object.entries(bodyMutations)) {
    const incoming = mutateXmlPart(result.original, 'word/footnotes.xml', mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, fixture.prepared, result,
    ), `${name}-incoming`);
    const reopened = mutateXmlPart(result.buffer, 'word/footnotes.xml', mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, fixture.prepared, result,
    ), `${name}-reopened`);
  }

  function forgeRelativeLinkTarget(document) {
    const relationship = Array.from(document.documentElement.childNodes).find((node) => (
      node.nodeType === 1 && node.getAttribute('Target') === 'relative.md'
    ));
    assert.ok(relationship);
    relationship.setAttribute('Target', 'forged.md');
  }
  for (const [label, buffer, inspect] of [
    ['incoming', result.original, (mutated) => transformOfficeDocxPresentation(
      mutated, fixture.prepared, result,
    )],
    ['reopened', result.buffer, (mutated) => inspectOfficeDocxPresentation(
      mutated, fixture.prepared, result,
    )],
  ]) {
    const mutated = mutateXmlPart(
      buffer, 'word/_rels/footnotes.xml.rels', forgeRelativeLinkTarget,
    );
    assertMismatch(() => inspect(mutated), `forged-relative-link-${label}`);
  }

  const footnoteBlockCases = [
    {
      name: 'list',
      definition: ['[^shape]:', '    - first', '      - nested', '    - second'],
      blocks: [
        { style: 'Compact', key: 1, level: 0, marker: true, text: 'first' },
        { style: 'Compact', key: 2, level: 1, marker: true, text: 'nested' },
        { style: 'Compact', key: 1, level: 0, marker: true, text: 'second' },
      ],
    },
    {
      name: 'loose-list',
      definition: [
        '[^shape]:', '    - first paragraph', '', '      continuation paragraph',
        '    - next item',
      ],
      blocks: [
        { style: 'FootnoteText', key: 1, level: 0, marker: true, text: 'first paragraph' },
        { style: 'FootnoteText', key: 2, level: 0, marker: false, text: 'continuation paragraph' },
        { style: 'FootnoteText', key: 1, level: 0, marker: true, text: 'next item' },
      ],
    },
    {
      name: 'loose-nested-list',
      definition: [
        '[^shape]:', '    - outer first', '      - nested first', '',
        '        nested continuation', '      - nested next', '    - outer next',
      ],
      blocks: [
        { style: 'Compact', key: 1, level: 0, marker: true, text: 'outer first' },
        { style: 'FootnoteText', key: 2, level: 1, marker: true, text: 'nested first' },
        { style: 'FootnoteText', key: 3, level: 1, marker: false, text: 'nested continuation' },
        { style: 'FootnoteText', key: 2, level: 1, marker: true, text: 'nested next' },
        { style: 'Compact', key: 1, level: 0, marker: true, text: 'outer next' },
      ],
    },
    {
      name: 'loose-ordered-list',
      definition: [
        '[^shape]:', '    3. first paragraph', '', '       continuation paragraph',
        '    4. next item',
      ],
      blocks: [
        { style: 'FootnoteText', key: 1, level: 0, marker: true, text: 'first paragraph' },
        { style: 'FootnoteText', key: 2, level: 0, marker: false, text: 'continuation paragraph' },
        { style: 'FootnoteText', key: 1, level: 0, marker: true, text: 'next item' },
      ],
      ordered: { format: 'decimal', start: 3, pattern: '%1.' },
    },
    {
      name: 'ordered-one-paren-list',
      definition: ['[^shape]:', '    3) first item', '    4) next item'],
      blocks: [
        { style: 'Compact', key: 1, level: 0, marker: true, text: 'first item' },
        { style: 'Compact', key: 1, level: 0, marker: true, text: 'next item' },
      ],
      ordered: { format: 'decimal', start: 3, pattern: '%1)' },
    },
    {
      name: 'ordered-default-list',
      definition: ['[^shape]:', '    1. first item', '    2. next item'],
      blocks: [
        { style: 'Compact', key: 1, level: 0, marker: true, text: 'first item' },
        { style: 'Compact', key: 1, level: 0, marker: true, text: 'next item' },
      ],
      ordered: { format: 'decimal', start: 1, pattern: '%1.' },
    },
    {
      name: 'list-code-continuation',
      definition: [
        '[^shape]:', '    - item', '', '      ```', '      coded continuation', '      ```',
      ],
      blocks: [
        { style: 'FootnoteText', key: 1, level: 0, marker: true, text: 'item' },
        { style: 'SourceCode', key: 2, level: 0, marker: false, text: 'coded continuation' },
      ],
    },
    {
      name: 'list-blockquote-continuation',
      definition: ['[^shape]:', '    - item', '', '      > quoted continuation'],
      blocks: [
        { style: 'FootnoteText', key: 1, level: 0, marker: true, text: 'item' },
        { style: 'FootnoteBlockText', key: 2, level: 0, marker: false, text: 'quoted continuation' },
      ],
    },
    {
      name: 'blockquote',
      definition: ['[^shape]:', '    > quoted'],
      blocks: [{ style: 'FootnoteBlockText', key: null, level: null, marker: null, text: 'quoted' }],
    },
    {
      name: 'code',
      definition: ['[^shape]:', '        coded'],
      blocks: [{ style: 'SourceCode', key: null, level: null, marker: null, text: 'coded' }],
    },
    {
      name: 'leading-raw-block',
      definition: ['[^shape]:', '    <div>ignored</div>', '', '    visible'],
      blocks: [{ style: 'FootnoteText', key: null, level: null, marker: null, text: 'visible' }],
    },
    {
      name: 'multiple-leading-raw-blocks',
      definition: [
        '[^shape]:', '    <div>first ignored</div>', '',
        '    <div>second ignored</div>', '', '    visible',
      ],
      blocks: [{ style: 'FootnoteText', key: null, level: null, marker: null, text: 'visible' }],
    },
    {
      name: 'raw-block-only',
      definition: ['[^shape]:', '    <div>ignored</div>'],
      blocks: [],
    },
    {
      name: 'interleaved-raw-block',
      prefixMode: 'inline',
      definition: [
        '[^shape]: first', '', '    <div>ignored</div>', '', '    second',
      ],
      blocks: [
        { style: 'FootnoteText', key: null, level: null, marker: null, text: 'first' },
        { style: 'FootnoteText', key: null, level: null, marker: null, text: 'second' },
      ],
    },
  ];
  for (const separate of footnoteBlockCases) {
    const separateMarkdown = [
      'Before[^shape]', '', '| A | B |', '| --- | --- |', '| Cell | Keep |', '',
      ...separate.definition, '',
    ].join('\n');
    const separateFixture = await preparedMarkdownFixture(
      separateMarkdown, `Separate ${separate.name} Footnote`,
    );
    const separateResult = await createOfficeDocxBuilder({ getPandocPath, temporaryRoot })
      .build(separateFixture.prepared, { includeDiagnostics: true });
    assert.equal(
      separateResult.footnoteBodies[0].prefixMode,
      separate.prefixMode ?? 'separate',
      separate.name,
    );
    assert.deepEqual(separateResult.footnoteBodies[0].blocks.map((block) => ({
      style: block.style,
      key: block.list?.key ?? null,
      level: block.list?.level ?? null,
      marker: block.list?.marker ?? null,
      text: block.inlines.map((inline) => inline.value).join(''),
    })), separate.blocks);
    if (separate.ordered) {
      assert.deepEqual(
        separateResult.footnoteBodies[0].blocks
          .filter((block) => block.list?.marker)
          .map((block) => ({
            format: block.list.format,
            start: block.list.start,
            pattern: block.list.pattern,
          })),
        [separate.ordered, separate.ordered],
      );
    }
    if (separate.name === 'loose-list') {
      function footnoteListIds(document) {
        const paragraphs = bodyParagraphs(document);
        return {
          paragraphs,
          mainId: paragraphs[1].getElementsByTagNameNS(WORD_NS, 'numId')[0]
            .getAttributeNS(WORD_NS, 'val'),
          continuationId: paragraphs[2].getElementsByTagNameNS(WORD_NS, 'numId')[0]
            .getAttributeNS(WORD_NS, 'val'),
        };
      }
      const continuationMutations = {
        continuationUsesMarkerNumbering(document) {
          const { paragraphs, mainId } = footnoteListIds(document);
          paragraphs[2].getElementsByTagNameNS(WORD_NS, 'numId')[0]
            .setAttributeNS(WORD_NS, 'w:val', mainId);
        },
        markerUsesContinuationNumbering(document) {
          const { paragraphs, continuationId } = footnoteListIds(document);
          paragraphs[1].getElementsByTagNameNS(WORD_NS, 'numId')[0]
            .setAttributeNS(WORD_NS, 'w:val', continuationId);
        },
        continuationLevelChanged(document) {
          const { paragraphs } = footnoteListIds(document);
          paragraphs[2].getElementsByTagNameNS(WORD_NS, 'ilvl')[0]
            .setAttributeNS(WORD_NS, 'w:val', '1');
        },
      };
      for (const mutate of Object.values(continuationMutations)) {
        const incoming = mutateXmlPart(separateResult.original, 'word/footnotes.xml', mutate);
        assertMismatch(() => transformOfficeDocxPresentation(
          incoming, separateFixture.prepared, separateResult,
        ));
        const reopened = mutateXmlPart(separateResult.buffer, 'word/footnotes.xml', mutate);
        assertMismatch(() => inspectOfficeDocxPresentation(
          reopened, separateFixture.prepared, separateResult,
        ));
      }
      const relationshipPart = 'word/_rels/document.xml.rels';
      function numberingRelationship(document) {
        const relationship = Array.from(document.documentElement.childNodes).find((node) => (
          node.nodeType === 1 && node.getAttribute('Type') === NUMBERING_REL
        ));
        assert.ok(relationship);
        return relationship;
      }
      const numberingRelationshipMutations = {
        missing(document) {
          const relationship = numberingRelationship(document);
          relationship.parentNode.removeChild(relationship);
        },
        duplicate(document) {
          const relationship = numberingRelationship(document);
          const duplicate = relationship.cloneNode(true);
          duplicate.setAttribute('Id', 'rIdFusionDuplicateNumbering');
          relationship.parentNode.appendChild(duplicate);
        },
        wrongType(document) {
          numberingRelationship(document).setAttribute('Type', HYPERLINK_REL);
        },
        wrongTarget(document) {
          numberingRelationship(document).setAttribute('Target', 'styles.xml');
        },
        externalMode(document) {
          const relationship = numberingRelationship(document);
          relationship.setAttribute('TargetMode', 'External');
          relationship.setAttribute('Target', 'https://fusion.invalid/numbering.xml');
        },
        explicitInternalMode(document) {
          numberingRelationship(document).setAttribute('TargetMode', 'Internal');
        },
        ambiguousTargetAlias(document) {
          const relationship = numberingRelationship(document);
          const alias = relationship.cloneNode(true);
          alias.setAttribute('Id', 'rIdFusionNumberingAlias');
          alias.setAttribute('Type', HYPERLINK_REL);
          alias.setAttribute('Target', 'Numbering.xml');
          relationship.parentNode.appendChild(alias);
        },
      };
      for (const [name, mutate] of Object.entries(numberingRelationshipMutations)) {
        const incoming = mutateXmlPart(separateResult.original, relationshipPart, mutate);
        assertMismatch(() => transformOfficeDocxPresentation(
          incoming, separateFixture.prepared, separateResult,
        ), `${name}-numbering-relationship-incoming`);
        const reopened = mutateXmlPart(separateResult.buffer, relationshipPart, mutate);
        assertMismatch(() => inspectOfficeDocxPresentation(
          reopened, separateFixture.prepared, separateResult,
        ), `${name}-numbering-relationship-reopened`);
      }
      function useCaseCanonicalNumberingTarget(document) {
        numberingRelationship(document).setAttribute('Target', 'Numbering.xml');
      }
      const caseCanonicalIncoming = mutateXmlPart(
        separateResult.original,
        relationshipPart,
        useCaseCanonicalNumberingTarget,
      );
      const caseCanonicalOutput = transformOfficeDocxPresentation(
        caseCanonicalIncoming,
        separateFixture.prepared,
        separateResult,
      );
      inspectOfficeDocxPresentation(
        caseCanonicalOutput,
        separateFixture.prepared,
        separateResult,
      );
      const caseCanonicalReopened = mutateXmlPart(
        separateResult.buffer,
        relationshipPart,
        useCaseCanonicalNumberingTarget,
      );
      inspectOfficeDocxPresentation(
        caseCanonicalReopened,
        separateFixture.prepared,
        separateResult,
      );
      const numberingMutations = {
        explicitDefaultStart(document) {
          const level = document.getElementsByTagNameNS(WORD_NS, 'lvl')[0];
          const start = document.createElementNS(WORD_NS, 'w:start');
          start.setAttributeNS(WORD_NS, 'w:val', '1');
          level.insertBefore(start, level.firstChild);
        },
        exposeContinuationMarker(document) {
          const pattern = Array.from(document.getElementsByTagNameNS(WORD_NS, 'lvlText'))
            .find((node) => node.getAttributeNS(WORD_NS, 'val') === ' ');
          assert.ok(pattern);
          pattern.setAttributeNS(WORD_NS, 'w:val', 'x');
        },
        changedJustification(document) {
          document.getElementsByTagNameNS(WORD_NS, 'lvlJc')[0]
            .setAttributeNS(WORD_NS, 'w:val', 'right');
        },
        addedSuffix(document) {
          const justification = document.getElementsByTagNameNS(WORD_NS, 'lvlJc')[0];
          const suffix = document.createElementNS(WORD_NS, 'w:suff');
          suffix.setAttributeNS(WORD_NS, 'w:val', 'nothing');
          justification.parentNode.insertBefore(suffix, justification);
        },
        changedIndentation(document) {
          document.getElementsByTagNameNS(WORD_NS, 'ind')[0]
            .setAttributeNS(WORD_NS, 'w:left', '721');
        },
        noncanonicalIndentation(document) {
          document.getElementsByTagNameNS(WORD_NS, 'ind')[0]
            .setAttributeNS(WORD_NS, 'w:left', '0720');
        },
        changedHangingIndent(document) {
          document.getElementsByTagNameNS(WORD_NS, 'ind')[0]
            .setAttributeNS(WORD_NS, 'w:hanging', '359');
        },
        addedTabStop(document) {
          const indentation = document.getElementsByTagNameNS(WORD_NS, 'ind')[0];
          const tabs = document.createElementNS(WORD_NS, 'w:tabs');
          const tab = document.createElementNS(WORD_NS, 'w:tab');
          tab.setAttributeNS(WORD_NS, 'w:val', 'left');
          tab.setAttributeNS(WORD_NS, 'w:pos', '720');
          tabs.appendChild(tab);
          indentation.parentNode.insertBefore(tabs, indentation);
        },
        changedBulletFont(document) {
          document.getElementsByTagNameNS(WORD_NS, 'rFonts')[0]
            .setAttributeNS(WORD_NS, 'w:ascii', 'Arial');
        },
        changedMultilevelType(document) {
          document.getElementsByTagNameNS(WORD_NS, 'multiLevelType')[0]
            .setAttributeNS(WORD_NS, 'w:val', 'singleLevel');
        },
        reorderedLevels(document) {
          const abstract = document.getElementsByTagNameNS(WORD_NS, 'abstractNum')[0];
          const levels = Array.from(abstract.childNodes).filter((node) => (
            node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'lvl'
          ));
          abstract.insertBefore(levels[1], levels[0]);
        },
        changedSelectedFamilyNsid(document) {
          document.getElementsByTagNameNS(WORD_NS, 'nsid')[0]
            .setAttributeNS(WORD_NS, 'w:val', '00000001');
        },
        changedSelectedFamilyLastLevel(document) {
          const levels = document.getElementsByTagNameNS(WORD_NS, 'lvl');
          levels[8].getElementsByTagNameNS(WORD_NS, 'lvlJc')[0]
            .setAttributeNS(WORD_NS, 'w:val', 'right');
        },
        changedSelectedFamilyLastLevelAttribute(document) {
          const levels = document.getElementsByTagNameNS(WORD_NS, 'lvl');
          levels[8].setAttributeNS(WORD_NS, 'w:forged', '1');
        },
        reorderedSelectedFamilyLastLevelChildren(document) {
          const levels = document.getElementsByTagNameNS(WORD_NS, 'lvl');
          const format = levels[8].getElementsByTagNameNS(WORD_NS, 'numFmt')[0];
          const pattern = levels[8].getElementsByTagNameNS(WORD_NS, 'lvlText')[0];
          levels[8].insertBefore(pattern, format);
        },
        removedSelectedFamilyLastLevel(document) {
          const levels = document.getElementsByTagNameNS(WORD_NS, 'lvl');
          levels[8].parentNode.removeChild(levels[8]);
        },
        unknownNumberingChild(document) {
          document.documentElement.appendChild(document.createElementNS(WORD_NS, 'w:forged'));
        },
        unknownLevelAttribute(document) {
          document.getElementsByTagNameNS(WORD_NS, 'lvl')[0]
            .setAttributeNS(WORD_NS, 'w:forged', '1');
        },
        duplicateJustification(document) {
          const justification = document.getElementsByTagNameNS(WORD_NS, 'lvlJc')[0];
          justification.parentNode.insertBefore(justification.cloneNode(true), justification);
        },
        reorderedLevelChildren(document) {
          const level = document.getElementsByTagNameNS(WORD_NS, 'lvl')[0];
          const format = level.getElementsByTagNameNS(WORD_NS, 'numFmt')[0];
          const pattern = level.getElementsByTagNameNS(WORD_NS, 'lvlText')[0];
          level.insertBefore(pattern, format);
        },
      };
      for (const mutate of Object.values(numberingMutations)) {
        for (const [buffer, inspect] of [
          [separateResult.original, (mutated) => transformOfficeDocxPresentation(
            mutated, separateFixture.prepared, separateResult,
          )],
          [separateResult.buffer, (mutated) => inspectOfficeDocxPresentation(
            mutated, separateFixture.prepared, separateResult,
          )],
        ]) {
          const mutated = mutateXmlPart(buffer, 'word/numbering.xml', mutate);
          assertMismatch(() => inspect(mutated));
        }
      }
      function addUnusedNumberingDefinition(document) {
        const root = document.documentElement;
        const sourceAbstract = document.getElementsByTagNameNS(WORD_NS, 'abstractNum')[0];
        const sourceNumber = document.getElementsByTagNameNS(WORD_NS, 'num')[0];
        const unusedAbstract = sourceAbstract.cloneNode(true);
        unusedAbstract.setAttributeNS(WORD_NS, 'w:abstractNumId', '777');
        unusedAbstract.getElementsByTagNameNS(WORD_NS, 'nsid')[0]
          .setAttributeNS(WORD_NS, 'w:val', '00000309');
        const unusedNumber = sourceNumber.cloneNode(true);
        unusedNumber.setAttributeNS(WORD_NS, 'w:numId', '7777');
        unusedNumber.getElementsByTagNameNS(WORD_NS, 'abstractNumId')[0]
          .setAttributeNS(WORD_NS, 'w:val', '777');
        root.insertBefore(unusedAbstract, sourceNumber);
        root.appendChild(unusedNumber);
      }
      const unusedIncoming = mutateXmlPart(
        separateResult.original, 'word/numbering.xml', addUnusedNumberingDefinition,
      );
      const transformedUnused = transformOfficeDocxPresentation(
        unusedIncoming, separateFixture.prepared, separateResult,
      );
      assert.deepEqual(
        unzipSync(new Uint8Array(transformedUnused))['word/numbering.xml'],
        unzipSync(new Uint8Array(unusedIncoming))['word/numbering.xml'],
      );
      inspectOfficeDocxPresentation(transformedUnused, separateFixture.prepared, separateResult);
      const unusedReopened = mutateXmlPart(
        separateResult.buffer, 'word/numbering.xml', addUnusedNumberingDefinition,
      );
      inspectOfficeDocxPresentation(unusedReopened, separateFixture.prepared, separateResult);
    }
    if (separate.name === 'loose-ordered-list') {
      const originalEntries = unzipSync(new Uint8Array(separateResult.original));
      const originalFootnotes = new DOMParser().parseFromString(
        strFromU8(originalEntries['word/footnotes.xml']), 'application/xml',
      );
      const usedOrderedNumId = originalFootnotes.getElementsByTagNameNS(WORD_NS, 'numId')[0]
        .getAttributeNS(WORD_NS, 'val');
      function orderedNumber(document) {
        const number = Array.from(document.getElementsByTagNameNS(WORD_NS, 'num'))
          .find((node) => node.getAttributeNS(WORD_NS, 'numId') === usedOrderedNumId);
        assert.ok(number);
        return number;
      }
      function orderedLevel(document) {
        const number = orderedNumber(document);
        const abstractId = number.getElementsByTagNameNS(WORD_NS, 'abstractNumId')[0]
          .getAttributeNS(WORD_NS, 'val');
        const abstract = Array.from(document.getElementsByTagNameNS(WORD_NS, 'abstractNum'))
          .find((node) => node.getAttributeNS(WORD_NS, 'abstractNumId') === abstractId);
        assert.ok(abstract);
        return Array.from(abstract.getElementsByTagNameNS(WORD_NS, 'lvl'))
          .find((node) => node.getAttributeNS(WORD_NS, 'ilvl') === '0');
      }
      function orderedAbstract(document) {
        return orderedLevel(document).parentNode;
      }
      const orderedLevelMutations = {
        changedOrderedStart(document) {
          const override = orderedNumber(document)
            .getElementsByTagNameNS(WORD_NS, 'startOverride')[0];
          const start = override ?? orderedLevel(document).getElementsByTagNameNS(WORD_NS, 'start')[0];
          start.setAttributeNS(WORD_NS, 'w:val', '4');
        },
        changedOrderedFormat(document) {
          orderedLevel(document).getElementsByTagNameNS(WORD_NS, 'numFmt')[0]
            .setAttributeNS(WORD_NS, 'w:val', 'lowerRoman');
        },
        changedOrderedDelimiter(document) {
          orderedLevel(document).getElementsByTagNameNS(WORD_NS, 'lvlText')[0]
            .setAttributeNS(WORD_NS, 'w:val', '%1)');
        },
        changedOrderedJustification(document) {
          orderedLevel(document).getElementsByTagNameNS(WORD_NS, 'lvlJc')[0]
            .setAttributeNS(WORD_NS, 'w:val', 'right');
        },
        addedOrderedSuffix(document) {
          const level = orderedLevel(document);
          const justification = level.getElementsByTagNameNS(WORD_NS, 'lvlJc')[0];
          const suffix = document.createElementNS(WORD_NS, 'w:suff');
          suffix.setAttributeNS(WORD_NS, 'w:val', 'nothing');
          level.insertBefore(suffix, justification);
        },
        changedOrderedIndentation(document) {
          orderedLevel(document).getElementsByTagNameNS(WORD_NS, 'ind')[0]
            .setAttributeNS(WORD_NS, 'w:left', '721');
        },
        noncanonicalOrderedStart(document) {
          orderedLevel(document).getElementsByTagNameNS(WORD_NS, 'start')[0]
            .setAttributeNS(WORD_NS, 'w:val', '03');
        },
        changedOrderedLastLevel(document) {
          const levels = orderedAbstract(document).getElementsByTagNameNS(WORD_NS, 'lvl');
          levels[8].getElementsByTagNameNS(WORD_NS, 'lvlJc')[0]
            .setAttributeNS(WORD_NS, 'w:val', 'right');
        },
        removedOrderedLastOverride(document) {
          const overrides = orderedNumber(document).getElementsByTagNameNS(WORD_NS, 'lvlOverride');
          overrides[8].parentNode.removeChild(overrides[8]);
        },
        reorderedOrderedOverrides(document) {
          const number = orderedNumber(document);
          const overrides = number.getElementsByTagNameNS(WORD_NS, 'lvlOverride');
          number.insertBefore(overrides[2], overrides[1]);
        },
        changedOrderedLastOverride(document) {
          const overrides = orderedNumber(document).getElementsByTagNameNS(WORD_NS, 'lvlOverride');
          overrides[8].getElementsByTagNameNS(WORD_NS, 'startOverride')[0]
            .setAttributeNS(WORD_NS, 'w:val', '4');
        },
        addedOrderedOverride(document) {
          const number = orderedNumber(document);
          const overrides = number.getElementsByTagNameNS(WORD_NS, 'lvlOverride');
          const extra = overrides[8].cloneNode(true);
          extra.setAttributeNS(WORD_NS, 'w:ilvl', '9');
          number.appendChild(extra);
        },
      };
      for (const [name, mutate] of Object.entries(orderedLevelMutations)) {
        const incoming = mutateXmlPart(separateResult.original, 'word/numbering.xml', mutate);
        assertMismatch(() => transformOfficeDocxPresentation(
          incoming, separateFixture.prepared, separateResult,
        ), `${name}-incoming`);
        const reopened = mutateXmlPart(separateResult.buffer, 'word/numbering.xml', mutate);
        assertMismatch(() => inspectOfficeDocxPresentation(
          reopened, separateFixture.prepared, separateResult,
        ), `${name}-reopened`);
      }
    }
  }
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});

test('[slice 11.3] document-wide footnote references bind source order outside tables', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-document-footnote-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const markdown = [
    'Before[^a] repeat[^a]',
    '',
    '| A | B |',
    '| --- | --- |',
    '| Cell | Keep |',
    '',
    'After[^b]',
    '',
    '[^a]: first',
    '[^b]: second',
    '',
  ].join('\n');
  const fixture = await preparedMarkdownFixture(markdown, 'Document Footnotes');
  const result = await createOfficeDocxBuilder({ getPandocPath, temporaryRoot })
    .build(fixture.prepared, { includeDiagnostics: true });
  const summary = inspectOfficeDocxPresentation(result.buffer, fixture.prepared, result);
  assert.deepEqual(summary.summaries[0].matrix[1], ['Cell', 'Keep']);
  assert.deepEqual(result.footnoteBodies.map(({ id, text }) => ({ id, text })), [
    { id: 9, text: 'first' },
    { id: 10, text: 'first' },
    { id: 11, text: 'second' },
  ]);

  function references(document) {
    return Array.from(document.getElementsByTagNameNS(WORD_NS, 'footnoteReference'));
  }
  const documentMutations = {
    swappedIds(document) {
      const [first, second] = references(document);
      const firstId = first.getAttributeNS(WORD_NS, 'id');
      first.setAttributeNS(WORD_NS, 'w:id', second.getAttributeNS(WORD_NS, 'id'));
      second.setAttributeNS(WORD_NS, 'w:id', firstId);
    },
    danglingId(document) {
      references(document)[0].setAttributeNS(WORD_NS, 'w:id', '12');
    },
    duplicateReference(document) {
      const run = references(document)[0].parentNode;
      run.parentNode.insertBefore(run.cloneNode(true), run.nextSibling);
    },
    missingReference(document) {
      const run = references(document)[0].parentNode;
      run.parentNode.removeChild(run);
    },
    hiddenWrapper(document) {
      const run = references(document)[0].parentNode;
      const wrapper = document.createElementNS(WORD_NS, 'w:smartTag');
      run.parentNode.replaceChild(wrapper, run);
      wrapper.appendChild(run);
    },
    paragraphContentControl(document) {
      const paragraph = references(document)[0].parentNode.parentNode;
      const contentControl = document.createElementNS(WORD_NS, 'w:sdt');
      const content = document.createElementNS(WORD_NS, 'w:sdtContent');
      paragraph.parentNode.replaceChild(contentControl, paragraph);
      contentControl.appendChild(content);
      content.appendChild(paragraph);
    },
    nestedDocumentBody(document) {
      const paragraph = references(document)[0].parentNode.parentNode;
      const nestedDocument = document.createElementNS(WORD_NS, 'w:document');
      const nestedBody = document.createElementNS(WORD_NS, 'w:body');
      paragraph.parentNode.replaceChild(nestedDocument, paragraph);
      nestedDocument.appendChild(nestedBody);
      nestedBody.appendChild(paragraph);
    },
    secondDirectBody(document) {
      const paragraph = references(document)[0].parentNode.parentNode;
      const body = document.createElementNS(WORD_NS, 'w:body');
      document.documentElement.insertBefore(body, document.documentElement.firstChild);
      body.appendChild(paragraph);
    },
    bodyLevelFakeCell(document) {
      const paragraph = references(document)[0].parentNode.parentNode;
      const cell = document.createElementNS(WORD_NS, 'w:tc');
      paragraph.parentNode.replaceChild(cell, paragraph);
      cell.appendChild(paragraph);
    },
    wrappedAuditedTable(document) {
      const table = document.getElementsByTagNameNS(WORD_NS, 'tbl')[0];
      const contentControl = document.createElementNS(WORD_NS, 'w:sdt');
      const content = document.createElementNS(WORD_NS, 'w:sdtContent');
      table.parentNode.replaceChild(contentControl, table);
      contentControl.appendChild(content);
      content.appendChild(table);
    },
  };
  for (const [name, mutate] of Object.entries(documentMutations)) {
    const incoming = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, fixture.prepared, result,
    ), `${name}-incoming`);
    const reopened = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, fixture.prepared, result,
    ), `${name}-reopened`);
  }
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});

test('[slice 11.3] OPC identities are case-folded across parts, overrides, sources, and targets', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-casefold-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const fixture = await presentationFixture();
  const result = await createOfficeDocxBuilder({ getPandocPath, temporaryRoot })
    .build(fixture.prepared, { includeDiagnostics: true });

  const duplicateMutations = {
    mainPart(entries) {
      entries['word/Document.xml'] = entries[DOCUMENT_PATH];
    },
    ordinaryPart(entries) {
      entries['word/Styles.xml'] = entries['word/styles.xml'];
    },
    relationshipMetadata(entries) {
      entries['word/_rels/Document.xml.rels'] = entries['word/_rels/document.xml.rels'];
    },
    override(entries) {
      const document = new DOMParser().parseFromString(
        strFromU8(entries['[Content_Types].xml']),
        'application/xml',
      );
      const override = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.localName === 'Override'
        && node.getAttribute('PartName').toLowerCase() === `/${DOCUMENT_PATH}`
      ));
      const duplicate = override.cloneNode(true);
      duplicate.setAttribute('PartName', '/word/Document.xml');
      document.documentElement.appendChild(duplicate);
      entries['[Content_Types].xml'] = strToU8(new XMLSerializer().serializeToString(document));
    },
  };
  for (const [name, mutate] of Object.entries(duplicateMutations)) {
    for (const [buffer, inspect] of [
      [result.original, (candidate) => transformOfficeDocxPresentation(
        candidate, fixture.prepared, result,
      )],
      [result.buffer, (candidate) => inspectOfficeDocxPresentation(
        candidate, fixture.prepared, result,
      )],
    ]) {
      const entries = unzipSync(new Uint8Array(buffer));
      mutate(entries);
      assertMismatch(() => inspect(Buffer.from(zipSync(entries))), name);
    }
  }

  const references = unzipSync(new Uint8Array(result.original));
  const types = new DOMParser().parseFromString(
    strFromU8(references['[Content_Types].xml']),
    'application/xml',
  );
  const mainOverride = Array.from(types.documentElement.childNodes).find((node) => (
    node.nodeType === 1 && node.localName === 'Override'
    && node.getAttribute('PartName').toLowerCase() === `/${DOCUMENT_PATH}`
  ));
  mainOverride.setAttribute('PartName', '/word/Document.xml');
  references['[Content_Types].xml'] = strToU8(new XMLSerializer().serializeToString(types));
  const rootRelationships = new DOMParser().parseFromString(
    strFromU8(references['_rels/.rels']),
    'application/xml',
  );
  const officeRelationship = Array.from(rootRelationships.documentElement.childNodes).find((node) => (
    node.nodeType === 1 && node.getAttribute('Type') === OFFICE_DOCUMENT_REL
  ));
  officeRelationship.setAttribute('Target', 'Word/Document.xml');
  references['_rels/.rels'] = strToU8(new XMLSerializer().serializeToString(rootRelationships));
  references['word/_rels/Document.xml.rels'] = references['word/_rels/document.xml.rels'];
  delete references['word/_rels/document.xml.rels'];
  const documentRelationships = new DOMParser().parseFromString(
    strFromU8(references['word/_rels/Document.xml.rels']),
    'application/xml',
  );
  const internalRelationship = Array.from(documentRelationships.documentElement.childNodes).find((node) => (
    node.nodeType === 1 && node.getAttribute('TargetMode') !== 'External'
  ));
  internalRelationship.setAttribute(
    'Target',
    internalRelationship.getAttribute('Target').replace('styles.xml', 'Styles.xml'),
  );
  references['word/_rels/Document.xml.rels'] = strToU8(
    new XMLSerializer().serializeToString(documentRelationships),
  );
  const caseReferenced = Buffer.from(zipSync(references));
  const caseOutput = transformOfficeDocxPresentation(caseReferenced, fixture.prepared, result);
  inspectOfficeDocxPresentation(caseOutput, fixture.prepared, result);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});

test('[slice 11.3] ZIP central records bind one exact bounded local record', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-zip-bind-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const fixture = await presentationFixture();
  const result = await createOfficeDocxBuilder({ getPandocPath, temporaryRoot })
    .build(fixture.prepared, { includeDiagnostics: true });

  const mutations = {
    localNameCase(buffer) {
      return mutateZipRecord(buffer, DOCUMENT_PATH, (bytes, record) => {
        const nameStart = record.localOffset + 30;
        bytes[nameStart + 'word/'.length] = 'D'.charCodeAt(0);
      });
    },
    localFlags(buffer) {
      return mutateZipRecord(buffer, DOCUMENT_PATH, (bytes, record) => {
        bytes.writeUInt16LE(record.flags ^ 0x0800, record.localOffset + 6);
      });
    },
    localMethod(buffer) {
      return mutateZipRecord(buffer, DOCUMENT_PATH, (bytes, record) => {
        bytes.writeUInt16LE(0, record.localOffset + 8);
      });
    },
    localCrc(buffer) {
      return mutateZipRecord(buffer, DOCUMENT_PATH, (bytes, record) => {
        bytes.writeUInt32LE(record.crc ^ 1, record.localOffset + 14);
      });
    },
    localCompressedSize(buffer) {
      return mutateZipRecord(buffer, DOCUMENT_PATH, (bytes, record) => {
        bytes.writeUInt32LE(record.compressedSize + 1, record.localOffset + 18);
      });
    },
    localUncompressedSize(buffer) {
      return mutateZipRecord(buffer, DOCUMENT_PATH, (bytes, record) => {
        bytes.writeUInt32LE(record.uncompressedSize + 1, record.localOffset + 22);
      });
    },
    forgedMatchingCrc(buffer) {
      return mutateZipRecord(buffer, DOCUMENT_PATH, (bytes, record) => {
        const forged = record.crc ^ 1;
        bytes.writeUInt32LE(forged, record.localOffset + 14);
        bytes.writeUInt32LE(forged, record.centralOffset + 16);
      });
    },
    forgedMatchingUncompressedSize(buffer) {
      return mutateZipRecord(buffer, DOCUMENT_PATH, (bytes, record) => {
        const forged = record.uncompressedSize + 1;
        bytes.writeUInt32LE(forged, record.localOffset + 22);
        bytes.writeUInt32LE(forged, record.centralOffset + 24);
      });
    },
    duplicateLocalOffset(buffer) {
      const directory = zipDirectory(buffer);
      const first = directory.records[0];
      const second = directory.records[1];
      directory.bytes.writeUInt32LE(first.localOffset, second.centralOffset + 42);
      return directory.bytes;
    },
    outOfRangeLocalOffset(buffer) {
      return mutateZipRecord(buffer, DOCUMENT_PATH, (bytes, record, directory) => {
        bytes.writeUInt32LE(directory.centralOffset, record.centralOffset + 42);
      });
    },
    orphanLocalRecord(buffer) {
      const directory = zipDirectory(buffer);
      const orphan = Buffer.from(directory.bytes.subarray(0, directory.records[1].localOffset));
      const next = Buffer.concat([
        directory.bytes.subarray(0, directory.centralOffset),
        orphan,
        directory.bytes.subarray(directory.centralOffset),
      ]);
      const nextEnd = directory.endOffset + orphan.length;
      next.writeUInt32LE(directory.centralOffset + orphan.length, nextEnd + 16);
      return next;
    },
    invalidDataDescriptor(buffer) {
      const candidate = withDataDescriptor(buffer);
      const directory = zipDirectory(candidate);
      candidate[directory.centralOffset - 12] ^= 1;
      return candidate;
    },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const incoming = mutate(result.original);
    assertMismatch(() => transformOfficeDocxPresentation(
      incoming, fixture.prepared, result,
    ), `${name}-incoming`);
    const reopened = mutate(result.buffer);
    assertMismatch(() => inspectOfficeDocxPresentation(
      reopened, fixture.prepared, result,
    ), `${name}-reopened`);
  }

  for (const signature of [true, false]) {
    const descriptorPackage = withDataDescriptor(result.original, { signature });
    const descriptorOutput = transformOfficeDocxPresentation(
      descriptorPackage,
      fixture.prepared,
      result,
    );
    inspectOfficeDocxPresentation(descriptorOutput, fixture.prepared, result);
  }
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});

test('[slice 11.3] future download/email DOCX adapters are semantically equal and Markdown is exact', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-adapters-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const fixture = await presentationFixture();
  const docxBuilder = createOfficeDocxBuilder({ getPandocPath, temporaryRoot });
  const attachments = createSharedDocumentAttachmentBuilders({
    pdfBuilder: { build: () => assert.fail('PDF builder was not expected') },
    docxBuilder,
  });
  const download = await attachments.buildDownload(fixture.prepared, 'docx', { includeDiagnostics: true });
  const email = await attachments.buildEmail(fixture.prepared, 'docx', { includeDiagnostics: true });
  const downloadSummary = inspectOfficeDocxPresentation(download.buffer, fixture.prepared, download);
  const emailSummary = inspectOfficeDocxPresentation(email.buffer, fixture.prepared, email);
  assert.deepEqual(downloadSummary.summaries, emailSummary.summaries);
  assert.deepEqual(hashesExceptDocument(download.buffer), hashesExceptDocument(download.original));
  assert.deepEqual(hashesExceptDocument(email.buffer), hashesExceptDocument(email.original));

  const markdown = attachments.buildMarkdownEmail(fixture.fullMarkdown);
  assert.deepEqual(markdown.buffer, Buffer.from(fixture.fullMarkdown, 'utf8'));
  assert.equal(markdown.buffer.toString('utf8'), fixture.fullMarkdown);
  assert.ok(markdown.buffer.toString('utf8').startsWith('---\n'));
  assert.ok(markdown.buffer.toString('utf8').includes("preserveUnknown: 'keep-me'"));
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});

test('[slice 11.3] conflicting OPC keys and interpreted OOXML singletons fail closed', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-duplicates-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const fixture = await presentationFixture();
  const result = await createOfficeDocxBuilder({ getPandocPath, temporaryRoot })
    .build(fixture.prepared, { includeDiagnostics: true });

  assertMismatch(() => transformOfficeDocxPresentation(
    duplicateFirstCentralDirectoryEntry(result.original),
    fixture.prepared,
    result,
  ));

  const duplicateRelationship = mutateXmlPart(result.original, '_rels/.rels', (document) => {
    const relationships = Array.from(document.documentElement.childNodes)
      .filter((node) => node.nodeType === 1);
    assert.ok(relationships.length >= 2);
    const duplicate = relationships[0].cloneNode(true);
    duplicate.setAttribute('Target', relationships[1].getAttribute('Target'));
    document.documentElement.appendChild(duplicate);
  });
  assertMismatch(() => transformOfficeDocxPresentation(
    duplicateRelationship, fixture.prepared, result,
  ));

  const duplicateOverride = mutateXmlPart(result.original, '[Content_Types].xml', (document) => {
    const overrides = Array.from(document.documentElement.childNodes)
      .filter((node) => node.nodeType === 1 && node.localName === 'Override');
    assert.ok(overrides.length >= 1);
    const duplicate = overrides[0].cloneNode(true);
    duplicate.setAttribute('ContentType', 'application/vnd.fusion-conflict+xml');
    document.documentElement.appendChild(duplicate);
  });
  assertMismatch(() => transformOfficeDocxPresentation(
    duplicateOverride, fixture.prepared, result,
  ));

  const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const singletonMutations = {
    tblPr(document) {
      const table = document.getElementsByTagNameNS(wordNamespace, 'tbl')[0];
      const properties = Array.from(table.childNodes)
        .find((node) => node.nodeType === 1 && node.localName === 'tblPr');
      table.insertBefore(properties.cloneNode(true), properties.nextSibling);
    },
    tblGrid(document) {
      const table = document.getElementsByTagNameNS(wordNamespace, 'tbl')[0];
      const grid = Array.from(table.childNodes)
        .find((node) => node.nodeType === 1 && node.localName === 'tblGrid');
      table.insertBefore(grid.cloneNode(true), grid.nextSibling);
    },
    tcPr(document) {
      const cell = document.getElementsByTagNameNS(wordNamespace, 'tc')[0];
      const properties = Array.from(cell.childNodes)
        .find((node) => node.nodeType === 1 && node.localName === 'tcPr');
      cell.insertBefore(properties.cloneNode(true), properties.nextSibling);
    },
    gridSpan(document) {
      const properties = document.getElementsByTagNameNS(wordNamespace, 'tcPr')[0];
      for (let index = 0; index < 2; index += 1) {
        const span = document.createElementNS(wordNamespace, 'w:gridSpan');
        span.setAttributeNS(wordNamespace, 'w:val', '1');
        properties.appendChild(span);
      }
    },
    tblBorders(document) {
      const properties = document.getElementsByTagNameNS(wordNamespace, 'tblPr')[0];
      for (let index = 0; index < 2; index += 1) {
        const borders = document.createElementNS(wordNamespace, 'w:tblBorders');
        const top = document.createElementNS(wordNamespace, 'w:top');
        borders.appendChild(top);
        properties.appendChild(borders);
      }
    },
    borderEdge(document) {
      const properties = document.getElementsByTagNameNS(wordNamespace, 'tblPr')[0];
      const borders = document.createElementNS(wordNamespace, 'w:tblBorders');
      for (let index = 0; index < 2; index += 1) {
        borders.appendChild(document.createElementNS(wordNamespace, 'w:top'));
      }
      properties.appendChild(borders);
    },
  };
  for (const [name, mutate] of Object.entries(singletonMutations)) {
    const ambiguous = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
    assertMismatch(
      () => transformOfficeDocxPresentation(ambiguous, fixture.prepared, result),
      name,
    );
  }

  const ambiguousReopen = mutateXmlPart(result.buffer, DOCUMENT_PATH, (document) => {
    const properties = document.getElementsByTagNameNS(wordNamespace, 'tblPr')[0];
    const borders = document.getElementsByTagNameNS(wordNamespace, 'tblBorders')[0];
    properties.appendChild(borders.cloneNode(true));
  });
  assertMismatch(() => inspectOfficeDocxPresentation(ambiguousReopen, fixture.prepared));
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});

test('[slice 11.3] Pack URI, main relationship, and grid occupancy ambiguity fail closed', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-docx-validity-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const fixture = await presentationFixture();
  const result = await createOfficeDocxBuilder({ getPandocPath, temporaryRoot })
    .build(fixture.prepared, { includeDiagnostics: true });

  function mainOverride(document) {
    return Array.from(document.documentElement.childNodes).find((node) => (
      node.nodeType === 1 && node.localName === 'Override'
      && node.getAttribute('PartName') === '/word/document.xml'
    ));
  }
  function relationshipDefault(document) {
    return Array.from(document.documentElement.childNodes).find((node) => (
      node.nodeType === 1 && node.localName === 'Default'
      && node.getAttribute('Extension').toLowerCase() === 'rels'
    ));
  }

  const packageMutations = {
    encodedDot(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word/%2E/document.xml');
      document.documentElement.appendChild(duplicate);
    },
    rawDot(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word/./document.xml');
      document.documentElement.appendChild(duplicate);
    },
    encodedSeparator(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word%2Fdocument.xml');
      document.documentElement.appendChild(duplicate);
    },
    encodedBackslash(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word%5Cdocument.xml');
      document.documentElement.appendChild(duplicate);
    },
    encodedControl(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word/%00document.xml');
      document.documentElement.appendChild(duplicate);
    },
    query(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word/document.xml?conflict=1');
      document.documentElement.appendChild(duplicate);
    },
    fragment(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word/document.xml#conflict');
      document.documentElement.appendChild(duplicate);
    },
    invalidEscape(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word/%ZZ/document.xml');
      document.documentElement.appendChild(duplicate);
    },
    lowercaseEscape(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word/%2edocument.xml');
      document.documentElement.appendChild(duplicate);
    },
    encodedUnreserved(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word/%64ocument.xml');
      document.documentElement.appendChild(duplicate);
    },
    rawSpace(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word/document copy.xml');
      document.documentElement.appendChild(duplicate);
    },
    emptySegment(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word//document.xml');
      document.documentElement.appendChild(duplicate);
    },
    reservedContentTypesStream(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/[Content_Types].xml');
      duplicate.setAttribute('ContentType', 'application/xml');
      document.documentElement.appendChild(duplicate);
    },
    reservedRootRelationshipStream(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/_rels/.rels');
      duplicate.setAttribute(
        'ContentType',
        'application/vnd.openxmlformats-package.relationships+xml',
      );
      document.documentElement.appendChild(duplicate);
    },
    reservedDocumentRelationshipStream(document) {
      const duplicate = mainOverride(document).cloneNode(true);
      duplicate.setAttribute('PartName', '/word/_rels/document.xml.rels');
      duplicate.setAttribute(
        'ContentType',
        'application/vnd.openxmlformats-package.relationships+xml',
      );
      document.documentElement.appendChild(duplicate);
    },
    missingMainOverride(document) {
      const override = mainOverride(document);
      override.parentNode.removeChild(override);
    },
    wrongMainContentType(document) {
      mainOverride(document).setAttribute('ContentType', 'application/vnd.fusion-conflict+xml');
    },
    missingRelationshipDefault(document) {
      const definition = relationshipDefault(document);
      definition.parentNode.removeChild(definition);
    },
    wrongRelationshipContentType(document) {
      relationshipDefault(document).setAttribute('ContentType', 'application/xml');
    },
    unknownContentTypesRootAttribute(document) {
      document.documentElement.setAttribute('Unexpected', 'value');
    },
    unknownDefaultAttribute(document) {
      relationshipDefault(document).setAttribute('Unexpected', 'value');
    },
    unknownOverrideAttribute(document) {
      mainOverride(document).setAttribute('Unexpected', 'value');
    },
    contentTypesRootText(document) {
      document.documentElement.appendChild(document.createTextNode('invalid'));
    },
    defaultText(document) {
      relationshipDefault(document).appendChild(document.createTextNode('invalid'));
    },
    nestedDefault(document) {
      relationshipDefault(document).appendChild(document.createElementNS(
        document.documentElement.namespaceURI,
        'Nested',
      ));
    },
    overrideText(document) {
      mainOverride(document).appendChild(document.createTextNode('invalid'));
    },
    nestedOverride(document) {
      mainOverride(document).appendChild(document.createElementNS(
        document.documentElement.namespaceURI,
        'Nested',
      ));
    },
  };
  for (const [name, mutate] of Object.entries(packageMutations)) {
    const originalMutation = mutateXmlPart(result.original, '[Content_Types].xml', mutate);
    assertMismatch(
      () => transformOfficeDocxPresentation(originalMutation, fixture.prepared, result),
      name,
    );
    const reopenedMutation = mutateXmlPart(result.buffer, '[Content_Types].xml', mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared), name);
  }
  for (const [buffer, inspect] of [
    [result.original, (candidate) => transformOfficeDocxPresentation(
      candidate, fixture.prepared, result,
    )],
    [result.buffer, (candidate) => inspectOfficeDocxPresentation(candidate, fixture.prepared)],
  ]) {
    const entries = unzipSync(new Uint8Array(buffer));
    entries['word/%64ocument.xml'] = entries[DOCUMENT_PATH];
    assertMismatch(() => inspect(Buffer.from(zipSync(entries))));
    delete entries['word/%64ocument.xml'];
    entries['fusion/untyped'] = strToU8('untyped');
    assertMismatch(() => inspect(Buffer.from(zipSync(entries))));
    const emptyRelationships = strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
    );
    for (const relationshipName of [
      'word/_rels/ghost.xml.rels',
      '_rels/ghost.rels',
      'word/_rels/x/_rels/y.rels',
      'word/bad.rels',
      '_rels/[Content_Types].xml.rels',
    ]) {
      const relationshipEntries = unzipSync(new Uint8Array(buffer));
      relationshipEntries[relationshipName] = emptyRelationships;
      assertMismatch(() => inspect(Buffer.from(zipSync(relationshipEntries))));
    }
    for (const [alias, source] of [
      ['%5BContent_Types%5D.xml', '[Content_Types].xml'],
      ['%5BCONTENT_TYPES%5D.xml', '[Content_Types].xml'],
      ['_RELS/.rels', '_rels/.rels'],
      ['word/_RELS/document.xml.rels', 'word/_rels/document.xml.rels'],
      ['word/_rels/document.xml.RELS', 'word/_rels/document.xml.rels'],
    ]) {
      const aliasEntries = unzipSync(new Uint8Array(buffer));
      assert.ok(aliasEntries[source]);
      aliasEntries[alias] = aliasEntries[source];
      assertMismatch(() => inspect(Buffer.from(zipSync(aliasEntries))));
    }
    const linkedAliasEntries = unzipSync(new Uint8Array(buffer));
    linkedAliasEntries['%5BContent_Types%5D.xml'] = linkedAliasEntries['[Content_Types].xml'];
    const aliasTypes = new DOMParser().parseFromString(
      strFromU8(linkedAliasEntries['[Content_Types].xml']), 'application/xml',
    );
    const aliasOverride = mainOverride(aliasTypes).cloneNode(true);
    aliasOverride.setAttribute('PartName', '/%5BContent_Types%5D.xml');
    aliasOverride.setAttribute('ContentType', 'application/xml');
    aliasTypes.documentElement.appendChild(aliasOverride);
    linkedAliasEntries['[Content_Types].xml'] = strToU8(
      new XMLSerializer().serializeToString(aliasTypes),
    );
    const aliasRelationships = new DOMParser().parseFromString(
      strFromU8(linkedAliasEntries['_rels/.rels']), 'application/xml',
    );
    const aliasRelationship = Array.from(aliasRelationships.documentElement.childNodes)
      .find((node) => node.nodeType === 1 && node.getAttribute('Type') !== OFFICE_DOCUMENT_REL);
    aliasRelationship.setAttribute('Target', '%5BContent_Types%5D.xml');
    linkedAliasEntries['_rels/.rels'] = strToU8(
      new XMLSerializer().serializeToString(aliasRelationships),
    );
    assertMismatch(() => inspect(Buffer.from(zipSync(linkedAliasEntries))));
  }

  function officeRelationship(document) {
    return Array.from(document.documentElement.childNodes).find((node) => (
      node.nodeType === 1 && node.localName === 'Relationship'
      && node.getAttribute('Type') === OFFICE_DOCUMENT_REL
    ));
  }
  const relationshipMutations = {
    retargetMain(document) {
      officeRelationship(document).setAttribute('Target', 'docProps/core.xml');
    },
    duplicateMain(document) {
      const duplicate = officeRelationship(document).cloneNode(true);
      duplicate.setAttribute('Id', 'rIdFusionDuplicateOfficeDocument');
      document.documentElement.appendChild(duplicate);
    },
    externalMain(document) {
      officeRelationship(document).setAttribute('TargetMode', 'External');
    },
    dotTarget(document) {
      officeRelationship(document).setAttribute('Target', 'word/./document.xml');
    },
    encodedDotTarget(document) {
      officeRelationship(document).setAttribute('Target', 'word/%2E/document.xml');
    },
    encodedUnreservedTarget(document) {
      officeRelationship(document).setAttribute('Target', 'word/%64ocument.xml');
    },
    reservedStreamTarget(document) {
      const relationship = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.localName === 'Relationship'
        && node.getAttribute('Type') !== OFFICE_DOCUMENT_REL
      ));
      assert.ok(relationship);
      relationship.setAttribute('Target', '[Content_Types].xml');
    },
    reservedRelationshipTarget(document) {
      const relationship = Array.from(document.documentElement.childNodes).find((node) => (
        node.nodeType === 1 && node.localName === 'Relationship'
        && node.getAttribute('Type') !== OFFICE_DOCUMENT_REL
      ));
      assert.ok(relationship);
      relationship.setAttribute('Target', '_rels/.rels');
    },
    invalidIdStart(document) {
      officeRelationship(document).setAttribute('Id', '1invalid');
    },
    invalidIdColon(document) {
      officeRelationship(document).setAttribute('Id', 'invalid:id');
    },
    invalidTypeRelative(document) {
      officeRelationship(document).setAttribute('Type', 'relative/type');
    },
    invalidTypeEncoding(document) {
      officeRelationship(document).setAttribute('Type', 'https://example.com/%ZZ');
    },
    invalidTypeFragment(document) {
      officeRelationship(document).setAttribute('Type', `${OFFICE_DOCUMENT_REL}#fragment`);
    },
    absoluteInternalTarget(document) {
      officeRelationship(document).setAttribute('Target', '/word/document.xml');
    },
    invalidTargetModeCase(document) {
      officeRelationship(document).setAttribute('TargetMode', 'external');
    },
    unknownOwnAttribute(document) {
      officeRelationship(document).setAttribute('Unexpected', 'value');
    },
    relationshipRootBase(document) {
      document.documentElement.setAttributeNS(
        'http://www.w3.org/XML/1998/namespace',
        'xml:base',
        'https://example.com/base/',
      );
    },
    relationshipRootText(document) {
      document.documentElement.appendChild(document.createTextNode('invalid'));
    },
    relationshipText(document) {
      officeRelationship(document).appendChild(document.createTextNode('invalid'));
    },
    nestedRelationship(document) {
      officeRelationship(document).appendChild(document.createElementNS(
        document.documentElement.namespaceURI,
        'Nested',
      ));
    },
  };
  for (const [name, mutate] of Object.entries(relationshipMutations)) {
    const originalMutation = mutateXmlPart(result.original, '_rels/.rels', mutate);
    assertMismatch(
      () => transformOfficeDocxPresentation(originalMutation, fixture.prepared, result),
      name,
    );
    const reopenedMutation = mutateXmlPart(result.buffer, '_rels/.rels', mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared), name);
  }

  function addHyperlinkRelationship(document, overrides = {}) {
    const relationship = document.createElementNS(
      'http://schemas.openxmlformats.org/package/2006/relationships',
      'Relationship',
    );
    relationship.setAttribute('Id', overrides.Id ?? 'rIdFusionExternalHyperlink');
    relationship.setAttribute(
      'Type',
      overrides.Type
        ?? 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
    );
    relationship.setAttribute('Target', overrides.Target ?? 'https://example.com/path?q=1#fragment');
    relationship.setAttribute('TargetMode', overrides.TargetMode ?? 'External');
    if (overrides.Unexpected) relationship.setAttribute('Unexpected', overrides.Unexpected);
    document.documentElement.appendChild(relationship);
  }
  const validExternalOriginal = mutateXmlPart(
    result.original,
    'word/_rels/document.xml.rels',
    addHyperlinkRelationship,
  );
  const validExternalOutput = transformOfficeDocxPresentation(
    validExternalOriginal, fixture.prepared, result,
  );
  inspectOfficeDocxPresentation(validExternalOutput, fixture.prepared, result);
  assert.deepEqual(hashesExceptDocument(validExternalOutput), hashesExceptDocument(validExternalOriginal));
  const validExternalReopen = mutateXmlPart(
    result.buffer,
    'word/_rels/document.xml.rels',
    addHyperlinkRelationship,
  );
  inspectOfficeDocxPresentation(validExternalReopen, fixture.prepared);
  const validMailtoReopen = mutateXmlPart(
    result.buffer,
    'word/_rels/document.xml.rels',
    (document) => addHyperlinkRelationship(document, {
      Id: 'rIdFusionExternalMailto', Target: 'mailto:owner@example.com',
    }),
  );
  inspectOfficeDocxPresentation(validMailtoReopen, fixture.prepared);
  const validRelativeReopen = mutateXmlPart(
    result.buffer,
    'word/_rels/document.xml.rels',
    (document) => addHyperlinkRelationship(document, {
      Id: 'rIdFusionExternalRelative', Target: 'relative/hyperlink.md?mode=1#section',
    }),
  );
  inspectOfficeDocxPresentation(validRelativeReopen, fixture.prepared);

  const invalidExternalRelationships = {
    invalidEncoding: { Target: 'https://example.com/%ZZ' },
    lowercaseEncoding: { Target: 'relative/%2fpath' },
    encodedUnreserved: { Target: 'relative/%61.txt' },
    rawBackslash: { Target: 'relative\\path' },
    rawSpace: { Target: 'https://example.com/a b' },
    missingHttpHost: { Target: 'https://' },
    relativeType: { Type: 'relationships/hyperlink' },
    invalidId: { Id: 'bad:id' },
    invalidModeCase: { TargetMode: 'external' },
    unknownAttribute: { Unexpected: 'value' },
  };
  for (const [name, overrides] of Object.entries(invalidExternalRelationships)) {
    const originalMutation = mutateXmlPart(
      result.original,
      'word/_rels/document.xml.rels',
      (document) => addHyperlinkRelationship(document, overrides),
    );
    assertMismatch(
      () => transformOfficeDocxPresentation(originalMutation, fixture.prepared, result),
      name,
    );
    const reopenedMutation = mutateXmlPart(
      result.buffer,
      'word/_rels/document.xml.rels',
      (document) => addHyperlinkRelationship(document, overrides),
    );
    assertMismatch(() => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared), name);
  }

  function firstOrdinaryCell(document) {
    return document.getElementsByTagNameNS(WORD_NS, 'tbl')[0]
      .getElementsByTagNameNS(WORD_NS, 'tc')[0];
  }
  function ensureCellProperties(document) {
    const cell = firstOrdinaryCell(document);
    let properties = Array.from(cell.childNodes).find((node) => (
      node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'tcPr'
    ));
    if (!properties) {
      properties = document.createElementNS(WORD_NS, 'w:tcPr');
      cell.insertBefore(properties, cell.firstChild);
    }
    return properties;
  }
  function addGridSpan(document, value) {
    const span = document.createElementNS(WORD_NS, 'w:gridSpan');
    if (value !== null) span.setAttributeNS(WORD_NS, 'w:val', value);
    ensureCellProperties(document).appendChild(span);
  }
  function addRowOffset(document, localName) {
    const row = document.getElementsByTagNameNS(WORD_NS, 'tr')[0];
    let properties = Array.from(row.childNodes).find((node) => (
      node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'trPr'
    ));
    if (!properties) {
      properties = document.createElementNS(WORD_NS, 'w:trPr');
      row.insertBefore(properties, row.firstChild);
    }
    properties.appendChild(document.createElementNS(WORD_NS, `w:${localName}`));
  }
  function ensureRowProperties(document) {
    const row = document.getElementsByTagNameNS(WORD_NS, 'tr')[0];
    let properties = Array.from(row.childNodes).find((node) => (
      node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'trPr'
    ));
    if (!properties) {
      properties = document.createElementNS(WORD_NS, 'w:trPr');
      row.insertBefore(properties, row.firstChild);
    }
    return properties;
  }
  function addWrappedTableChild(document, wrapperName, childName) {
    const table = document.getElementsByTagNameNS(WORD_NS, 'tbl')[0];
    const row = Array.from(table.childNodes).find((node) => (
      node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'tr'
    ));
    const cell = Array.from(row.childNodes).find((node) => (
      node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'tc'
    ));
    const wrapper = document.createElementNS(WORD_NS, `w:${wrapperName}`);
    let container = wrapper;
    if (wrapperName === 'sdt') {
      container = document.createElementNS(WORD_NS, 'w:sdtContent');
      wrapper.appendChild(container);
    }
    container.appendChild((childName === 'tr' ? row : cell).cloneNode(true));
    (childName === 'tr' ? table : row).appendChild(wrapper);
  }
  const gridMutations = {
    nestedTableProperties(document) {
      const properties = document.getElementsByTagNameNS(WORD_NS, 'tblPr')[0];
      properties.appendChild(document.createElementNS(WORD_NS, 'w:tblPr'));
    },
    nestedCellProperties(document) {
      ensureCellProperties(document).appendChild(document.createElementNS(WORD_NS, 'w:tcPr'));
    },
    nestedGridColumn(document) {
      const column = document.getElementsByTagNameNS(WORD_NS, 'gridCol')[0];
      column.appendChild(document.createElementNS(WORD_NS, 'w:gridCol'));
    },
    unsupportedTableProperty(document) {
      document.getElementsByTagNameNS(WORD_NS, 'tblPr')[0]
        .appendChild(document.createElementNS(WORD_NS, 'w:tblInd'));
    },
    unsupportedRowProperty(document) {
      ensureRowProperties(document).appendChild(document.createElementNS(WORD_NS, 'w:cantSplit'));
    },
    unsupportedCellProperty(document) {
      ensureCellProperties(document).appendChild(document.createElementNS(WORD_NS, 'w:tcW'));
    },
    tablePropertyAttribute(document) {
      document.getElementsByTagNameNS(WORD_NS, 'tblPr')[0]
        .setAttributeNS(WORD_NS, 'w:unexpected', 'value');
    },
    cellPropertyAttribute(document) {
      ensureCellProperties(document).setAttributeNS(WORD_NS, 'w:unexpected', 'value');
    },
    gridColumnAttribute(document) {
      document.getElementsByTagNameNS(WORD_NS, 'gridCol')[0]
        .setAttributeNS(WORD_NS, 'w:unexpected', 'value');
    },
    noncanonicalGridColumn(document) {
      document.getElementsByTagNameNS(WORD_NS, 'gridCol')[0]
        .setAttributeNS(WORD_NS, 'w:w', '02640');
    },
    misparentedTableProperties(document) {
      const paragraph = firstOrdinaryCell(document).getElementsByTagNameNS(WORD_NS, 'p')[0];
      paragraph.appendChild(document.createElementNS(WORD_NS, 'w:tblPr'));
    },
    misparentedCellProperties(document) {
      const paragraph = firstOrdinaryCell(document).getElementsByTagNameNS(WORD_NS, 'p')[0];
      paragraph.appendChild(document.createElementNS(WORD_NS, 'w:tcPr'));
    },
    misparentedTableWidth(document) {
      const paragraph = firstOrdinaryCell(document).getElementsByTagNameNS(WORD_NS, 'p')[0];
      paragraph.appendChild(document.createElementNS(WORD_NS, 'w:tblW'));
    },
    tablePropertiesAfterRows(document) {
      const table = document.getElementsByTagNameNS(WORD_NS, 'tbl')[0];
      table.appendChild(Array.from(table.childNodes).find((node) => (
        node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'tblPr'
      )));
    },
    tableGridAfterRows(document) {
      const table = document.getElementsByTagNameNS(WORD_NS, 'tbl')[0];
      table.appendChild(Array.from(table.childNodes).find((node) => (
        node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'tblGrid'
      )));
    },
    rowPropertiesAfterCells(document) {
      const properties = ensureRowProperties(document);
      properties.parentNode.appendChild(properties);
    },
    repeatedRowProperties(document) {
      const properties = ensureRowProperties(document);
      properties.parentNode.insertBefore(properties.cloneNode(true), properties.nextSibling);
    },
    cellPropertiesAfterParagraphs(document) {
      const properties = ensureCellProperties(document);
      properties.parentNode.appendChild(properties);
    },
    tableText(document) {
      document.getElementsByTagNameNS(WORD_NS, 'tbl')[0]
        .appendChild(document.createTextNode('invalid'));
    },
    rowText(document) {
      document.getElementsByTagNameNS(WORD_NS, 'tr')[0]
        .appendChild(document.createTextNode('invalid'));
    },
    cellText(document) {
      firstOrdinaryCell(document).appendChild(document.createTextNode('invalid'));
    },
    tablePropertiesText(document) {
      document.getElementsByTagNameNS(WORD_NS, 'tblPr')[0]
        .appendChild(document.createTextNode('invalid'));
    },
    tableGridText(document) {
      document.getElementsByTagNameNS(WORD_NS, 'tblGrid')[0]
        .appendChild(document.createTextNode('invalid'));
    },
    rowPropertiesText(document) {
      ensureRowProperties(document).appendChild(document.createTextNode('invalid'));
    },
    cellPropertiesText(document) {
      ensureCellProperties(document).appendChild(document.createTextNode('invalid'));
    },
    unsupportedCellBlock(document) {
      firstOrdinaryCell(document).appendChild(document.createElementNS(WORD_NS, 'w:sectPr'));
    },
    overOccupancy(document) { addGridSpan(document, '2'); },
    zeroSpan(document) { addGridSpan(document, '0'); },
    noncanonicalSpan(document) { addGridSpan(document, '01'); },
    missingSpan(document) { addGridSpan(document, null); },
    horizontalMerge(document) {
      ensureCellProperties(document).appendChild(document.createElementNS(WORD_NS, 'w:hMerge'));
    },
    verticalMerge(document) {
      ensureCellProperties(document).appendChild(document.createElementNS(WORD_NS, 'w:vMerge'));
    },
    gridBefore(document) { addRowOffset(document, 'gridBefore'); },
    gridAfter(document) { addRowOffset(document, 'gridAfter'); },
    trackedRowProperties(document) { addRowOffset(document, 'trPrChange'); },
    trackedCellProperties(document) {
      ensureCellProperties(document).appendChild(document.createElementNS(WORD_NS, 'w:tcPrChange'));
    },
    trackedCellMerge(document) {
      const row = document.getElementsByTagNameNS(WORD_NS, 'tr')[0];
      row.appendChild(document.createElementNS(WORD_NS, 'w:cellMerge'));
    },
    markupCompatibilitySpan(document) {
      const markupCompatibility = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
      const word2010 = 'http://schemas.microsoft.com/office/word/2010/wordml';
      const xmlns = 'http://www.w3.org/2000/xmlns/';
      const alternate = document.createElementNS(markupCompatibility, 'mc:AlternateContent');
      alternate.setAttributeNS(xmlns, 'xmlns:mc', markupCompatibility);
      alternate.setAttributeNS(xmlns, 'xmlns:w14', word2010);
      const choice = document.createElementNS(markupCompatibility, 'mc:Choice');
      choice.setAttribute('Requires', 'w14');
      const span = document.createElementNS(WORD_NS, 'w:gridSpan');
      span.setAttributeNS(WORD_NS, 'w:val', '2');
      choice.appendChild(span);
      alternate.appendChild(choice);
      alternate.appendChild(document.createElementNS(markupCompatibility, 'mc:Fallback'));
      ensureCellProperties(document).appendChild(alternate);
    },
    structuredDocumentRow(document) { addWrappedTableChild(document, 'sdt', 'tr'); },
    customXmlRow(document) { addWrappedTableChild(document, 'customXml', 'tr'); },
    insertedRow(document) { addWrappedTableChild(document, 'ins', 'tr'); },
    deletedRow(document) { addWrappedTableChild(document, 'del', 'tr'); },
    movedRow(document) { addWrappedTableChild(document, 'moveTo', 'tr'); },
    structuredDocumentCell(document) { addWrappedTableChild(document, 'sdt', 'tc'); },
    customXmlCell(document) { addWrappedTableChild(document, 'customXml', 'tc'); },
    smartTagCell(document) { addWrappedTableChild(document, 'smartTag', 'tc'); },
    proofMarkup(document) {
      const row = document.getElementsByTagNameNS(WORD_NS, 'tr')[0];
      row.appendChild(document.createElementNS(WORD_NS, 'w:proofErr'));
    },
    alternateChunk(document) {
      firstOrdinaryCell(document).appendChild(document.createElementNS(WORD_NS, 'w:altChunk'));
    },
    contentPart(document) {
      firstOrdinaryCell(document).appendChild(document.createElementNS(WORD_NS, 'w:contentPart'));
    },
    subDocument(document) {
      firstOrdinaryCell(document).appendChild(document.createElementNS(WORD_NS, 'w:subDoc'));
    },
    compensatedPhysicalWidth(document) {
      const table = document.getElementsByTagNameNS(WORD_NS, 'tbl')[0];
      const row = Array.from(table.childNodes).find((node) => (
        node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'tr'
      ));
      const cells = Array.from(row.childNodes).filter((node) => (
        node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'tc'
      ));
      addGridSpan(document, '2');
      row.removeChild(cells[1]);
    },
  };
  for (const [name, mutate] of Object.entries(gridMutations)) {
    const originalMutation = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
    assertMismatch(
      () => transformOfficeDocxPresentation(originalMutation, fixture.prepared, result),
      name,
    );
    const reopenedMutation = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared), name);
  }

  for (const localName of TABLE_PROPERTY_NAMES) {
    const mutate = (document) => {
      const paragraph = firstOrdinaryCell(document).getElementsByTagNameNS(WORD_NS, 'p')[0];
      paragraph.appendChild(document.createElementNS(WORD_NS, `w:${localName}`));
    };
    const originalMutation = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
    assertMismatch(
      () => transformOfficeDocxPresentation(originalMutation, fixture.prepared, result),
      `misparented-${localName}-incoming`,
    );
    const reopenedMutation = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(
      () => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared),
      `misparented-${localName}-reopened`,
    );
  }

  for (const [namespace, prefix] of [[WORD_NS, 'w'], ['urn:fusion-invalid', 'invalid']]) {
    for (const localName of ['tbl', 'tr', 'tc']) {
      const mutate = (document) => {
        document.getElementsByTagNameNS(WORD_NS, localName)[0]
          .setAttributeNS(namespace, `${prefix}:unexpected`, 'value');
      };
      const originalMutation = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
      assertMismatch(
        () => transformOfficeDocxPresentation(originalMutation, fixture.prepared, result),
        `${prefix}-${localName}-attribute-incoming`,
      );
      const reopenedMutation = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
      assertMismatch(
        () => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared),
        `${prefix}-${localName}-attribute-reopened`,
      );
    }
  }

  const forgedRichPropertyPaths = {
    runParagraphAlignment: ['r', 'pPr', 'jc'],
    runParagraphShading: ['r', 'pPr', 'shd'],
    runBorders: ['r', 'pBdr', 'top'],
    runAlignment: ['r', 'rPr', 'jc'],
    paragraphBordersDirect: ['pBdr', 'top'],
  };
  for (const localName of ['top', 'left', 'bottom', 'right', 'between', 'bar']) {
    forgedRichPropertyPaths[`runBorder-${localName}`] = ['r', 'pBdr', localName];
  }
  for (const [name, pathNames] of Object.entries(forgedRichPropertyPaths)) {
    const mutate = (document) => {
      const paragraph = firstOrdinaryCell(document).getElementsByTagNameNS(WORD_NS, 'p')[0];
      let parent = paragraph;
      for (const localName of pathNames) {
        const child = document.createElementNS(WORD_NS, `w:${localName}`);
        parent.appendChild(child);
        parent = child;
      }
    };
    const originalMutation = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
    assertMismatch(
      () => transformOfficeDocxPresentation(originalMutation, fixture.prepared, result),
      `${name}-incoming`,
    );
    const reopenedMutation = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(
      () => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared),
      `${name}-reopened`,
    );
  }

  for (const [name, localName] of [['paragraphRunStyle', 'cnfStyle'], ['paragraphRunShading', 'shd']]) {
    const mutate = (document) => {
      const paragraph = firstOrdinaryCell(document).getElementsByTagNameNS(WORD_NS, 'p')[0];
      let properties = Array.from(paragraph.childNodes).find((node) => (
        node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'pPr'
      ));
      if (!properties) {
        properties = document.createElementNS(WORD_NS, 'w:pPr');
        paragraph.insertBefore(properties, paragraph.firstChild);
      }
      const runProperties = document.createElementNS(WORD_NS, 'w:rPr');
      runProperties.appendChild(document.createElementNS(WORD_NS, `w:${localName}`));
      properties.appendChild(runProperties);
    };
    const originalMutation = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
    assertMismatch(
      () => transformOfficeDocxPresentation(originalMutation, fixture.prepared, result),
      `${name}-incoming`,
    );
    const reopenedMutation = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(
      () => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared),
      `${name}-reopened`,
    );
  }

  for (const [name, namespace, qualifiedName] of [
    ['wordWrapper', WORD_NS, 'w:bogus'],
    ['foreignWrapper', 'urn:fusion-invalid', 'invalid:bogus'],
    ['unsupportedHyperlink', WORD_NS, 'w:hyperlink'],
  ]) {
    const mutate = (document) => {
      const paragraph = firstOrdinaryCell(document).getElementsByTagNameNS(WORD_NS, 'p')[0];
      const wrapper = document.createElementNS(namespace, qualifiedName);
      const run = document.createElementNS(WORD_NS, 'w:r');
      const runProperties = document.createElementNS(WORD_NS, 'w:rPr');
      const shading = document.createElementNS(WORD_NS, 'w:shd');
      shading.setAttributeNS(WORD_NS, 'w:val', 'clear');
      shading.setAttributeNS(WORD_NS, 'w:color', 'auto');
      shading.setAttributeNS(WORD_NS, 'w:fill', 'FFF2CC');
      runProperties.appendChild(shading);
      run.appendChild(runProperties);
      wrapper.appendChild(run);
      paragraph.appendChild(wrapper);
    };
    const originalMutation = mutateXmlPart(result.original, DOCUMENT_PATH, mutate);
    assertMismatch(
      () => transformOfficeDocxPresentation(originalMutation, fixture.prepared, result),
      `${name}-incoming`,
    );
    const reopenedMutation = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(
      () => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared),
      `${name}-reopened`,
    );
  }

  function addParagraphBorder(document, { size, space }) {
    const paragraph = firstOrdinaryCell(document).getElementsByTagNameNS(WORD_NS, 'p')[0];
    let properties = Array.from(paragraph.childNodes).find((node) => (
      node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'pPr'
    ));
    if (!properties) {
      properties = document.createElementNS(WORD_NS, 'w:pPr');
      paragraph.insertBefore(properties, paragraph.firstChild);
    }
    const borders = document.createElementNS(WORD_NS, 'w:pBdr');
    const edge = document.createElementNS(WORD_NS, 'w:top');
    edge.setAttributeNS(WORD_NS, 'w:val', 'single');
    edge.setAttributeNS(WORD_NS, 'w:sz', size);
    edge.setAttributeNS(WORD_NS, 'w:space', space);
    edge.setAttributeNS(WORD_NS, 'w:color', 'auto');
    borders.appendChild(edge);
    properties.appendChild(borders);
  }
  for (const [name, bounds] of Object.entries({
    sizeBelowMinimum: { size: '1', space: '0' },
    sizeAboveMaximum: { size: '97', space: '0' },
    spaceAboveMaximum: { size: '8', space: '32' },
  })) {
    const originalMutation = mutateXmlPart(
      result.original,
      DOCUMENT_PATH,
      (document) => addParagraphBorder(document, bounds),
    );
    assertMismatch(
      () => transformOfficeDocxPresentation(originalMutation, fixture.prepared, result),
      `${name}-incoming`,
    );
    const reopenedMutation = mutateXmlPart(
      result.buffer,
      DOCUMENT_PATH,
      (document) => addParagraphBorder(document, bounds),
    );
    assertMismatch(
      () => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared),
      `${name}-reopened`,
    );
  }
  for (const bounds of Object.values({
    minimumBorderMeasures: { size: '2', space: '0' },
    maximumBorderMeasures: { size: '96', space: '31' },
  })) {
    const originalMutation = mutateXmlPart(
      result.original,
      DOCUMENT_PATH,
      (document) => addParagraphBorder(document, bounds),
    );
    const output = transformOfficeDocxPresentation(originalMutation, fixture.prepared, result);
    inspectOfficeDocxPresentation(output, fixture.prepared, result);
    const reopenedMutation = mutateXmlPart(
      result.buffer,
      DOCUMENT_PATH,
      (document) => addParagraphBorder(document, bounds),
    );
    inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared, result);
  }

  const validParagraphProperty = mutateXmlPart(result.original, DOCUMENT_PATH, (document) => {
    const paragraph = firstOrdinaryCell(document).getElementsByTagNameNS(WORD_NS, 'p')[0];
    let properties = Array.from(paragraph.childNodes).find((node) => (
      node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'pPr'
    ));
    if (!properties) {
      properties = document.createElementNS(WORD_NS, 'w:pPr');
      paragraph.insertBefore(properties, paragraph.firstChild);
    }
    if (!Array.from(properties.childNodes).some((node) => (
      node.nodeType === 1 && node.namespaceURI === WORD_NS && node.localName === 'jc'
    ))) {
      const alignment = document.createElementNS(WORD_NS, 'w:jc');
      alignment.setAttributeNS(WORD_NS, 'w:val', 'left');
      properties.appendChild(alignment);
    }
    const addShading = (owner) => {
      const shading = document.createElementNS(WORD_NS, 'w:shd');
      shading.setAttributeNS(WORD_NS, 'w:val', 'clear');
      shading.setAttributeNS(WORD_NS, 'w:color', 'auto');
      shading.setAttributeNS(WORD_NS, 'w:fill', 'FFF2CC');
      owner.appendChild(shading);
    };
    addShading(properties);
    const style = document.createElementNS(WORD_NS, 'w:cnfStyle');
    style.setAttributeNS(WORD_NS, 'w:val', '100000000000');
    properties.appendChild(style);
    const borders = document.createElementNS(WORD_NS, 'w:pBdr');
    for (const localName of ['top', 'left', 'bottom', 'right', 'between', 'bar']) {
      const edge = document.createElementNS(WORD_NS, `w:${localName}`);
      edge.setAttributeNS(WORD_NS, 'w:val', 'single');
      edge.setAttributeNS(WORD_NS, 'w:sz', '8');
      edge.setAttributeNS(WORD_NS, 'w:space', '0');
      edge.setAttributeNS(WORD_NS, 'w:color', 'auto');
      borders.appendChild(edge);
    }
    properties.appendChild(borders);
    const run = document.createElementNS(WORD_NS, 'w:r');
    const runProperties = document.createElementNS(WORD_NS, 'w:rPr');
    addShading(runProperties);
    const runStyle = style.cloneNode(true);
    runProperties.appendChild(runStyle);
    run.appendChild(runProperties);
    paragraph.appendChild(run);
  });
  const validParagraphOutput = transformOfficeDocxPresentation(
    validParagraphProperty,
    fixture.prepared,
    result,
  );
  inspectOfficeDocxPresentation(validParagraphOutput, fixture.prepared, result);

  const reopenedPropertyMutations = {
    nestedTableBorders(document) {
      const borders = document.getElementsByTagNameNS(WORD_NS, 'tblBorders')[0];
      borders.appendChild(document.createElementNS(WORD_NS, 'w:tblBorders'));
    },
    nestedBorderEdge(document) {
      const edge = document.getElementsByTagNameNS(WORD_NS, 'top')[0];
      edge.appendChild(document.createElementNS(WORD_NS, 'w:top'));
    },
    borderEdgeAttribute(document) {
      document.getElementsByTagNameNS(WORD_NS, 'top')[0]
        .setAttributeNS(WORD_NS, 'w:unexpected', 'value');
    },
    nestedTitleSpan(document) {
      const titleTable = document.getElementsByTagNameNS(WORD_NS, 'tbl')[24];
      const span = titleTable.getElementsByTagNameNS(WORD_NS, 'gridSpan')[0];
      span.appendChild(document.createElementNS(WORD_NS, 'w:gridSpan'));
    },
    titleSpanAttribute(document) {
      const titleTable = document.getElementsByTagNameNS(WORD_NS, 'tbl')[24];
      titleTable.getElementsByTagNameNS(WORD_NS, 'gridSpan')[0]
        .setAttributeNS(WORD_NS, 'w:unexpected', 'value');
    },
  };
  for (const [name, mutate] of Object.entries(reopenedPropertyMutations)) {
    const reopenedMutation = mutateXmlPart(result.buffer, DOCUMENT_PATH, mutate);
    assertMismatch(() => inspectOfficeDocxPresentation(reopenedMutation, fixture.prepared), name);
  }

  const wrongTitleSpan = mutateXmlPart(result.buffer, DOCUMENT_PATH, (document) => {
    const titleTable = document.getElementsByTagNameNS(WORD_NS, 'tbl')[24];
    const span = titleTable.getElementsByTagNameNS(WORD_NS, 'gridSpan')[0];
    span.setAttributeNS(WORD_NS, 'w:val', '2');
  });
  assertMismatch(() => inspectOfficeDocxPresentation(wrongTitleSpan, fixture.prepared));

  const originalEntries = unzipSync(new Uint8Array(result.original));
  const contentTypes = new DOMParser().parseFromString(
    strFromU8(originalEntries['[Content_Types].xml']), 'application/xml',
  );
  assert.equal(mainOverride(contentTypes).getAttribute('ContentType'), MAIN_DOCUMENT_CONTENT_TYPE);
  assert.deepEqual(hashesExceptDocument(result.buffer), hashesExceptDocument(result.original));
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
});
