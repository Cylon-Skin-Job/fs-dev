'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { strFromU8, strToU8, unzipSync, zipSync } = require('fflate');
const {
  TABLE_PRESENTATION_MISMATCH,
  presentationError,
} = require('../../../shared/office-table-presentation-validation.cjs');
const { bridgePandocTableBreaks } = require('./pandoc-table-breaks.cjs');
const { normalizeSemanticText, runTrustedPandoc } = require('./table-presentation.cjs');

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const MARKUP_COMPATIBILITY_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const OFFICE_DOCUMENT_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
const HYPERLINK_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
const FOOTNOTES_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes';
const NUMBERING_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering';
const MAIN_DOCUMENT_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const FOOTNOTES_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml';
const RELATIONSHIPS_CONTENT_TYPE = 'application/vnd.openxmlformats-package.relationships+xml';
const DOCUMENT_PATH = 'word/document.xml';
const FOOTNOTES_PATH = 'word/footnotes.xml';
const NUMBERING_PATH = 'word/numbering.xml';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const REQUIRED_PACKAGE_PARTS = Object.freeze([
  '[Content_Types].xml', '_rels/.rels', DOCUMENT_PATH,
]);
const BORDER_NAMES = Object.freeze(['top', 'left', 'bottom', 'right', 'insideH', 'insideV']);
const PARAGRAPH_BORDER_NAMES = Object.freeze(['top', 'left', 'bottom', 'right', 'between', 'bar']);
const BORDER_SIZES = Object.freeze({ 1: '6', 2: '12', 3: '18', 4: '24' });
const NUMBERING_BULLETS = Object.freeze([
  Object.freeze({ glyph: '\uf0b7', font: 'Symbol' }),
  Object.freeze({ glyph: 'o', font: 'Courier New' }),
  Object.freeze({ glyph: '\uf0a7', font: 'Wingdings' }),
]);
const ORDERED_NUMBERING_FORMATS = new Set([
  'decimal', 'lowerRoman', 'upperRoman', 'lowerLetter', 'upperLetter',
]);
const UNSUPPORTED_TABLE_WRAPPERS = new Set([
  'altChunk', 'contentPart',
  'customXml', 'customXmlDelRangeEnd', 'customXmlDelRangeStart',
  'customXmlInsRangeEnd', 'customXmlInsRangeStart', 'customXmlMoveFromRangeEnd',
  'customXmlMoveFromRangeStart', 'customXmlMoveToRangeEnd',
  'customXmlMoveToRangeStart', 'del', 'ins', 'moveFrom', 'moveFromRangeEnd',
  'moveFromRangeStart', 'moveTo', 'moveToRangeEnd', 'moveToRangeStart',
  'permEnd', 'permStart', 'proofErr', 'sdt', 'smartTag', 'subDoc',
]);
const TABLE_PROPERTY_NAMES = Object.freeze([
  'tblPr', 'tblStyle', 'tblpPr', 'tblOverlap', 'bidiVisual',
  'tblStyleRowBandSize', 'tblStyleColBandSize', 'tblW', 'jc',
  'tblCellSpacing', 'tblInd', 'tblBorders', ...BORDER_NAMES, 'between', 'bar', 'shd',
  'tblLayout', 'tblCellMar', 'tblLook', 'tblCaption', 'tblDescription',
  'tblPrChange', 'tblGrid', 'gridCol', 'tblGridChange', 'trPr', 'cnfStyle',
  'divId', 'gridBefore', 'gridAfter', 'wBefore', 'wAfter', 'cantSplit',
  'trHeight', 'tblHeader', 'hidden', 'ins', 'del', 'trPrChange', 'tcPr',
  'tcW', 'gridSpan', 'hMerge', 'vMerge', 'tcBorders', 'noWrap', 'tcMar',
  'textDirection', 'tcFitText', 'vAlign', 'hideMark', 'headers', 'cellIns',
  'cellDel', 'cellMerge', 'tcPrChange',
]);
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const MAX_ZIP_ENTRIES = 4096;
const MAX_ZIP_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 256 * 1024 * 1024;

function failMismatch() {
  throw presentationError(TABLE_PRESENTATION_MISMATCH);
}

function parseXml(bytes) {
  const errors = [];
  let document;
  try {
    document = new DOMParser({
      onError(level, message) {
        if (level !== 'warning') errors.push(message);
      },
    }).parseFromString(typeof bytes === 'string' ? bytes : strFromU8(bytes), 'application/xml');
  } catch {
    failMismatch();
  }
  if (errors.length || !document?.documentElement) failMismatch();
  return document;
}

function elements(node) {
  return Array.from(node?.childNodes ?? []).filter((child) => child.nodeType === 1);
}

function assertWhitespaceOnlyText(node, { recursive = false } = {}) {
  for (const child of Array.from(node?.childNodes ?? [])) {
    if ((child.nodeType === 3 || child.nodeType === 4) && /\S/u.test(child.data ?? '')) {
      failMismatch();
    }
    if (recursive && child.nodeType === 1) assertWhitespaceOnlyText(child, { recursive: true });
  }
}

function assertEmptyElementContent(node) {
  assertWhitespaceOnlyText(node);
  if (elements(node).length) failMismatch();
}

function exactWordAttributes(node, allowedNames, requiredNames = allowedNames) {
  const allowed = new Set(allowedNames);
  const attributes = Object.create(null);
  for (const attribute of Array.from(node.attributes)) {
    if (attribute.namespaceURI === XMLNS_NS) continue;
    if (
      attribute.namespaceURI !== WORD_NS
      || !allowed.has(attribute.localName)
      || Object.hasOwn(attributes, attribute.localName)
    ) failMismatch();
    attributes[attribute.localName] = attribute.value;
  }
  if (requiredNames.some((name) => !Object.hasOwn(attributes, name))) failMismatch();
  return attributes;
}

function exactWordChildren(node, localNames) {
  const children = elements(node);
  if (
    children.length !== localNames.length
    || children.some((child, index) => (
      child.namespaceURI !== WORD_NS || child.localName !== localNames[index]
    ))
  ) failMismatch();
  return children;
}

function exactWordLeaf(node, allowedAttributes, requiredAttributes = allowedAttributes) {
  assertEmptyElementContent(node);
  return exactWordAttributes(node, allowedAttributes, requiredAttributes);
}

function directWordChildren(node, localName) {
  return elements(node).filter((child) => (
    child.namespaceURI === WORD_NS && child.localName === localName
  ));
}

function directChildrenNs(node, namespaceURI, localName) {
  return elements(node).filter((child) => (
    child.namespaceURI === namespaceURI && child.localName === localName
  ));
}

function containsNamespaceElement(node, namespaceURI) {
  for (const child of elements(node)) {
    if (child.namespaceURI === namespaceURI || containsNamespaceElement(child, namespaceURI)) {
      return true;
    }
  }
  return false;
}

function descendantWordElements(node, localName) {
  return Array.from(node.getElementsByTagNameNS(WORD_NS, localName));
}

function hasWordAncestorPath(node, ancestorNames) {
  let current = node.parentNode;
  for (const localName of ancestorNames) {
    if (current?.namespaceURI !== WORD_NS || current.localName !== localName) return false;
    current = current.parentNode;
  }
  return true;
}

function isDirectCellParagraph(paragraph) {
  return paragraph?.namespaceURI === WORD_NS
    && paragraph.localName === 'p'
    && paragraph.parentNode?.namespaceURI === WORD_NS
    && paragraph.parentNode.localName === 'tc';
}

function isDirectBodyParagraph(paragraph, mainBody) {
  return paragraph?.namespaceURI === WORD_NS
    && paragraph.localName === 'p'
    && mainBody?.namespaceURI === WORD_NS
    && mainBody.localName === 'body'
    && paragraph.parentNode === mainBody;
}

function isDirectOrHyperlinkCellRun(run) {
  if (run?.namespaceURI !== WORD_NS || run.localName !== 'r') return false;
  const owner = run.parentNode;
  if (isDirectCellParagraph(owner)) return true;
  return owner?.namespaceURI === WORD_NS
    && owner.localName === 'hyperlink'
    && isDirectCellParagraph(owner.parentNode);
}

function isRichParagraphPropertyOccurrence(node, localName) {
  if (localName === 'jc') return hasWordAncestorPath(node, ['pPr', 'p', 'tc']);
  if (localName === 'shd' || localName === 'cnfStyle') {
    return hasWordAncestorPath(node, ['pPr', 'p', 'tc'])
      || hasWordAncestorPath(node, ['rPr', 'r', 'p', 'tc'])
      || hasWordAncestorPath(node, ['rPr', 'r', 'hyperlink', 'p', 'tc']);
  }
  if (PARAGRAPH_BORDER_NAMES.includes(localName)) {
    return hasWordAncestorPath(node, ['pBdr', 'pPr', 'p', 'tc']);
  }
  return false;
}

function tablePropertyOccurrenceCount(table, localName) {
  return descendantWordElements(table, localName)
    .filter((node) => !isRichParagraphPropertyOccurrence(node, localName)).length;
}

function exactHyperlinkReference(node) {
  let relationshipId = null;
  let anchor = null;
  for (const attribute of Array.from(node.attributes)) {
    if (attribute.namespaceURI === XMLNS_NS) continue;
    if (attribute.namespaceURI === OFFICE_REL_NS && attribute.localName === 'id') {
      if (relationshipId !== null) failMismatch();
      relationshipId = attribute.value;
    } else if (attribute.namespaceURI === WORD_NS && attribute.localName === 'anchor') {
      if (anchor !== null) failMismatch();
      anchor = attribute.value;
    } else {
      failMismatch();
    }
  }
  if ((!relationshipId && !anchor) || (relationshipId && anchor)) failMismatch();
  if (anchor && !validHyperlinkAnchor(anchor)) failMismatch();
  return relationshipId ? { relationshipId } : { anchor };
}

function auditHyperlinkRunContent(node) {
  if (node.localName === 't') {
    if (elements(node).length) failMismatch();
    let spaceSeen = false;
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.namespaceURI === XMLNS_NS) continue;
      if (
        spaceSeen
        || attribute.namespaceURI !== XML_NS
        || attribute.localName !== 'space'
        || attribute.value !== 'preserve'
      ) failMismatch();
      spaceSeen = true;
    }
    return;
  }
  exactWordLeaf(node, [], []);
}

function auditStyledRunProperties(properties, { insideHyperlink }) {
  const propertyChildren = elements(properties);
  const allowedPropertyOrder = ['rStyle', 'b', 'bCs', 'i', 'iCs', 'strike', 'vertAlign'];
  const propertyRanks = propertyChildren.map((child) => (
    child.namespaceURI === WORD_NS ? allowedPropertyOrder.indexOf(child.localName) : -1
  ));
  if (
    !propertyChildren.length
    || propertyChildren[0].localName !== 'rStyle'
    || propertyRanks.some((rank) => rank < 0)
    || new Set(propertyRanks).size !== propertyRanks.length
    || propertyRanks.some((rank, index) => index > 0 && rank <= propertyRanks[index - 1])
  ) failMismatch();
  const style = exactWordLeaf(propertyChildren[0], ['val']).val;
  if (
    (insideHyperlink && !['Hyperlink', 'VerbatimChar'].includes(style))
    || (!insideHyperlink && style !== 'VerbatimChar')
  ) failMismatch();
  const propertyNames = new Set(propertyChildren.map((property) => property.localName));
  if (
    propertyNames.has('b') !== propertyNames.has('bCs')
    || propertyNames.has('i') !== propertyNames.has('iCs')
  ) failMismatch();
  for (const property of propertyChildren.slice(1)) {
    if (property.localName === 'vertAlign') {
      const attributes = exactWordLeaf(property, ['val']);
      if (!['superscript', 'subscript'].includes(attributes.val)) failMismatch();
    } else {
      exactWordLeaf(property, [], []);
    }
  }
  return style;
}

function canonicalPositiveWordId(value) {
  return typeof value === 'string'
    && /^[1-9]\d*$/.test(value)
    && Number.isSafeInteger(Number(value));
}

function canonicalNonnegativeWordInteger(value) {
  return typeof value === 'string'
    && /^(?:0|[1-9]\d*)$/.test(value)
    && Number.isSafeInteger(Number(value));
}

function auditFootnoteReferenceRun(
  run,
  footnoteIds,
  { tableCellOnly = false, mainBody = null, allowedCells = null } = {},
) {
  const paragraph = run?.parentNode;
  const directCell = isDirectCellParagraph(paragraph);
  const packageWideRoute = isDirectBodyParagraph(paragraph, mainBody)
    || (directCell && allowedCells instanceof Set && allowedCells.has(paragraph.parentNode));
  if (
    paragraph?.namespaceURI !== WORD_NS
    || paragraph.localName !== 'p'
    || (tableCellOnly ? !directCell : !packageWideRoute)
  ) failMismatch();
  exactWordAttributes(run, [], []);
  assertWhitespaceOnlyText(run);
  const runChildren = elements(run);
  if (
    runChildren.length !== 2
    || runChildren[0].namespaceURI !== WORD_NS
    || runChildren[0].localName !== 'rPr'
    || runChildren[1].namespaceURI !== WORD_NS
    || runChildren[1].localName !== 'footnoteReference'
  ) failMismatch();
  const properties = runChildren[0];
  exactWordAttributes(properties, [], []);
  assertWhitespaceOnlyText(properties, { recursive: true });
  const propertyChildren = elements(properties);
  if (
    propertyChildren.length !== 1
    || propertyChildren[0].namespaceURI !== WORD_NS
    || propertyChildren[0].localName !== 'rStyle'
    || exactWordLeaf(propertyChildren[0], ['val']).val !== 'FootnoteReference'
  ) failMismatch();
  const reference = exactWordLeaf(runChildren[1], ['id']);
  if (!canonicalPositiveWordId(reference.id) || !footnoteIds?.has(reference.id)) failMismatch();
  return Number(reference.id);
}

function auditFootnoteBodyReferenceRun(run) {
  exactWordAttributes(run, [], []);
  assertWhitespaceOnlyText(run);
  const runChildren = elements(run);
  if (
    runChildren.length !== 2
    || runChildren[0].namespaceURI !== WORD_NS
    || runChildren[0].localName !== 'rPr'
    || runChildren[1].namespaceURI !== WORD_NS
    || runChildren[1].localName !== 'footnoteRef'
  ) failMismatch();
  exactWordAttributes(runChildren[0], [], []);
  assertWhitespaceOnlyText(runChildren[0], { recursive: true });
  const propertyChildren = elements(runChildren[0]);
  if (
    propertyChildren.length !== 1
    || propertyChildren[0].namespaceURI !== WORD_NS
    || propertyChildren[0].localName !== 'rStyle'
    || exactWordLeaf(propertyChildren[0], ['val']).val !== 'FootnoteReference'
  ) failMismatch();
  exactWordLeaf(runChildren[1], [], []);
}

function auditFootnoteSentinel(footnote, id, type, leafName) {
  const attributes = exactWordAttributes(footnote, ['id', 'type']);
  if (attributes.id !== id || attributes.type !== type) failMismatch();
  assertWhitespaceOnlyText(footnote);
  const paragraphs = directWordChildren(footnote, 'p');
  if (paragraphs.length !== 1 || elements(footnote).length !== 1) failMismatch();
  exactWordAttributes(paragraphs[0], [], []);
  assertWhitespaceOnlyText(paragraphs[0]);
  const runs = directWordChildren(paragraphs[0], 'r');
  if (runs.length !== 1 || elements(paragraphs[0]).length !== 1) failMismatch();
  exactWordAttributes(runs[0], [], []);
  assertWhitespaceOnlyText(runs[0]);
  const leaves = directWordChildren(runs[0], leafName);
  if (leaves.length !== 1 || elements(runs[0]).length !== 1) failMismatch();
  exactWordLeaf(leaves[0], [], []);
}

function createNumberingResolver(entries, packageParts, requireNumberingRelationship) {
  const part = packageParts.get(partIdentity(NUMBERING_PATH));
  if (!part) return () => failMismatch();
  const numbering = parseXml(entries[part.name]).documentElement;
  if (numbering.namespaceURI !== WORD_NS || numbering.localName !== 'numbering') failMismatch();
  exactWordAttributes(numbering, [], []);
  assertWhitespaceOnlyText(numbering);
  const numberingChildren = elements(numbering);
  if (numberingChildren.some((child) => (
    child.namespaceURI !== WORD_NS || !['abstractNum', 'num'].includes(child.localName)
  ))) failMismatch();
  const firstNumber = numberingChildren.findIndex((child) => child.localName === 'num');
  if (
    firstNumber >= 0
    && numberingChildren.slice(firstNumber).some((child) => child.localName !== 'num')
  ) failMismatch();
  const abstracts = new Map();
  for (const abstract of directWordChildren(numbering, 'abstractNum')) {
    const id = wordAttribute(abstract, 'abstractNumId');
    if (!/^\d+$/.test(id) || abstracts.has(id)) failMismatch();
    abstracts.set(id, abstract);
  }
  const numbers = new Map();
  for (const number of directWordChildren(numbering, 'num')) {
    const numId = wordAttribute(number, 'numId');
    if (!canonicalPositiveWordId(numId) || numbers.has(numId)) failMismatch();
    numbers.set(numId, number);
  }

  const auditedAbstracts = new Map();
  function auditUsedAbstract(id) {
    if (auditedAbstracts.has(id)) return auditedAbstracts.get(id);
    const abstract = abstracts.get(id);
    if (
      !abstract
      || !canonicalPositiveWordId(id)
      || exactWordAttributes(abstract, ['abstractNumId']).abstractNumId !== id
    ) {
      failMismatch();
    }
    assertWhitespaceOnlyText(abstract, { recursive: true });
    const abstractChildren = elements(abstract);
    const expectedNsid = `A${id}`.padStart(8, '0');
    if (
      expectedNsid.length !== 8
      || abstractChildren.length !== 11
      || abstractChildren[0].namespaceURI !== WORD_NS
      || abstractChildren[0].localName !== 'nsid'
      || exactWordLeaf(abstractChildren[0], ['val']).val !== expectedNsid
      || abstractChildren[1].namespaceURI !== WORD_NS
      || abstractChildren[1].localName !== 'multiLevelType'
      || exactWordLeaf(abstractChildren[1], ['val']).val !== 'multilevel'
      || abstractChildren.slice(2).some((child, index) => (
        child.namespaceURI !== WORD_NS
        || child.localName !== 'lvl'
        || wordAttribute(child, 'ilvl') !== String(index)
      ))
    ) failMismatch();
    const levels = new Map();
    for (const level of abstractChildren.slice(2)) {
      const levelId = exactWordAttributes(level, ['ilvl']).ilvl;
      if (!canonicalNonnegativeWordInteger(levelId) || levels.has(levelId)) failMismatch();
      assertWhitespaceOnlyText(level, { recursive: true });
      const children = elements(level);
      let cursor = 0;
      let start = null;
      if (children[cursor]?.namespaceURI === WORD_NS && children[cursor].localName === 'start') {
        const rawStart = exactWordLeaf(children[cursor], ['val']).val;
        if (!canonicalPositiveWordId(rawStart)) failMismatch();
        start = Number(rawStart);
        cursor += 1;
      }
      const formatNode = children[cursor];
      const patternNode = children[cursor + 1];
      cursor += 2;
      let suffix = null;
      if (children[cursor]?.namespaceURI === WORD_NS && children[cursor].localName === 'suff') {
        suffix = exactWordLeaf(children[cursor], ['val']).val;
        if (!['tab', 'space', 'nothing'].includes(suffix)) failMismatch();
        cursor += 1;
      }
      const justificationNode = children[cursor];
      const paragraphProperties = children[cursor + 1];
      const runProperties = children[cursor + 2] ?? null;
      if (
        formatNode?.namespaceURI !== WORD_NS || formatNode.localName !== 'numFmt'
        || patternNode?.namespaceURI !== WORD_NS || patternNode.localName !== 'lvlText'
        || justificationNode?.namespaceURI !== WORD_NS || justificationNode.localName !== 'lvlJc'
        || paragraphProperties?.namespaceURI !== WORD_NS || paragraphProperties.localName !== 'pPr'
        || (runProperties && (runProperties.namespaceURI !== WORD_NS || runProperties.localName !== 'rPr'))
        || children.length !== cursor + 2 + (runProperties ? 1 : 0)
      ) failMismatch();
      const format = exactWordLeaf(formatNode, ['val']).val;
      const pattern = exactWordLeaf(patternNode, ['val']).val;
      const justification = exactWordLeaf(justificationNode, ['val']).val;
      exactWordAttributes(paragraphProperties, [], []);
      assertWhitespaceOnlyText(paragraphProperties, { recursive: true });
      const paragraphChildren = elements(paragraphProperties);
      let paragraphCursor = 0;
      let tabs = null;
      if (
        paragraphChildren[paragraphCursor]?.namespaceURI === WORD_NS
        && paragraphChildren[paragraphCursor].localName === 'tabs'
      ) {
        const tabsNode = paragraphChildren[paragraphCursor];
        exactWordAttributes(tabsNode, [], []);
        assertWhitespaceOnlyText(tabsNode, { recursive: true });
        const tabNodes = directWordChildren(tabsNode, 'tab');
        if (!tabNodes.length || elements(tabsNode).length !== tabNodes.length) failMismatch();
        tabs = tabNodes.map((tab) => {
          const attributes = exactWordAttributes(tab, ['val', 'pos']);
          if (!canonicalNonnegativeWordInteger(attributes.pos)) failMismatch();
          return { value: attributes.val, position: Number(attributes.pos) };
        });
        paragraphCursor += 1;
      }
      const indentation = paragraphChildren[paragraphCursor];
      if (
        indentation?.namespaceURI !== WORD_NS
        || indentation.localName !== 'ind'
        || paragraphChildren.length !== paragraphCursor + 1
      ) failMismatch();
      const indentationAttributes = exactWordAttributes(indentation, ['left', 'hanging']);
      if (
        !canonicalNonnegativeWordInteger(indentationAttributes.left)
        || !canonicalNonnegativeWordInteger(indentationAttributes.hanging)
      ) {
        failMismatch();
      }
      let markerFont = null;
      if (runProperties) {
        exactWordAttributes(runProperties, [], []);
        assertWhitespaceOnlyText(runProperties, { recursive: true });
        const fonts = exactWordChildren(runProperties, ['rFonts'])[0];
        const fontAttributes = exactWordAttributes(fonts, ['ascii', 'hAnsi', 'cs', 'hint']);
        if (
          fontAttributes.ascii !== fontAttributes.hAnsi
          || fontAttributes.ascii !== fontAttributes.cs
          || fontAttributes.hint !== 'default'
        ) failMismatch();
        markerFont = fontAttributes.ascii;
      }
      levels.set(levelId, {
        format,
        pattern,
        start,
        justification,
        suffix,
        tabs,
        left: Number(indentationAttributes.left),
        hanging: Number(indentationAttributes.hanging),
        markerFont,
      });
    }
    const firstLevel = levels.get('0');
    let family;
    if (
      firstLevel?.format === 'bullet'
      && firstLevel.start === null
      && firstLevel.pattern === ' '
      && firstLevel.markerFont === null
    ) {
      family = { kind: 'continuation', format: 'bullet', start: 1, delimiter: null };
    } else if (
      firstLevel?.format === 'bullet'
      && firstLevel.start === null
      && firstLevel.pattern === NUMBERING_BULLETS[0].glyph
      && firstLevel.markerFont === NUMBERING_BULLETS[0].font
    ) {
      family = { kind: 'bullet', format: 'bullet', start: 1, delimiter: null };
    } else if (firstLevel?.start !== null && ORDERED_NUMBERING_FORMATS.has(firstLevel.format)) {
      const delimiter = firstLevel.pattern === '%1.' ? 'period'
        : firstLevel.pattern === '%1)' ? 'oneParen'
          : firstLevel.pattern === '(%1)' ? 'twoParens'
            : null;
      if (!delimiter) failMismatch();
      family = {
        kind: 'ordered',
        format: firstLevel.format,
        start: firstLevel.start,
        delimiter,
      };
    } else {
      failMismatch();
    }
    for (let levelIndex = 0; levelIndex < 9; levelIndex += 1) {
      const semantics = levels.get(String(levelIndex));
      const bullet = NUMBERING_BULLETS[levelIndex % NUMBERING_BULLETS.length];
      const expectedPattern = family.kind === 'continuation' ? ' '
        : family.kind === 'bullet' ? bullet.glyph
          : family.delimiter === 'period' ? `%${levelIndex + 1}.`
            : family.delimiter === 'oneParen' ? `%${levelIndex + 1})`
              : `(%${levelIndex + 1})`;
      const expectedFont = family.kind === 'bullet' ? bullet.font : null;
      const expectedStart = family.kind === 'ordered' ? family.start : null;
      if (
        !semantics
        || semantics.format !== family.format
        || semantics.pattern !== expectedPattern
        || semantics.start !== expectedStart
        || semantics.justification !== 'left'
        || semantics.suffix !== null
        || semantics.tabs !== null
        || semantics.left !== (levelIndex + 1) * 720
        || semantics.hanging !== 360
        || semantics.markerFont !== expectedFont
      ) failMismatch();
    }
    const audited = { levels, family };
    auditedAbstracts.set(id, audited);
    return audited;
  }

  const auditedNumbers = new Map();
  function auditUsedNumber(numId) {
    if (auditedNumbers.has(numId)) return auditedNumbers.get(numId);
    const number = numbers.get(numId);
    if (!number || exactWordAttributes(number, ['numId']).numId !== numId) failMismatch();
    assertWhitespaceOnlyText(number, { recursive: true });
    const numberChildren = elements(number);
    if (
      !numberChildren.length
      || numberChildren[0].namespaceURI !== WORD_NS
      || numberChildren[0].localName !== 'abstractNumId'
      || numberChildren.slice(1).some((child) => (
        child.namespaceURI !== WORD_NS || child.localName !== 'lvlOverride'
      ))
    ) failMismatch();
    const abstractId = exactWordLeaf(numberChildren[0], ['val']).val;
    const abstract = auditUsedAbstract(abstractId);
    const overrides = new Map();
    for (const [index, override] of numberChildren.slice(1).entries()) {
      const level = exactWordAttributes(override, ['ilvl']).ilvl;
      assertWhitespaceOnlyText(override, { recursive: true });
      const overrideChildren = exactWordChildren(override, ['startOverride']);
      if (
        !canonicalNonnegativeWordInteger(level)
        || level !== String(index)
        || overrides.has(level)
      ) failMismatch();
      const start = exactWordLeaf(overrideChildren[0], ['val']).val;
      if (!canonicalPositiveWordId(start)) failMismatch();
      overrides.set(level, Number(start));
    }
    if (
      (abstract.family.kind === 'ordered' && (
        numberChildren.length !== 10
        || Array.from(overrides.values()).some((start) => start !== abstract.family.start)
      ))
      || (abstract.family.kind !== 'ordered' && numberChildren.length !== 1)
    ) failMismatch();
    const audited = { abstractId, abstract };
    auditedNumbers.set(numId, audited);
    return audited;
  }
  let relationshipAudited = false;
  return (numId, level) => {
    if (!relationshipAudited) {
      requireNumberingRelationship(part);
      relationshipAudited = true;
    }
    const number = auditUsedNumber(numId);
    const semantics = number.abstract.levels.get(String(level));
    if (!semantics) failMismatch();
    return {
      format: semantics.format,
      pattern: semantics.format === 'bullet' ? null : semantics.pattern,
      start: number.abstract.family.start,
      marker: semantics.format !== 'bullet' || semantics.pattern !== ' ',
      markerGlyph: semantics.format === 'bullet' ? semantics.pattern : null,
      justification: semantics.justification,
      suffix: semantics.suffix,
      tabs: semantics.tabs,
      left: semantics.left,
      hanging: semantics.hanging,
      markerFont: semantics.markerFont,
    };
  };
}

function appendFootnoteDocxText(output, value, state) {
  if (typeof value !== 'string' || value.length === 0) failMismatch();
  for (const character of value) output.push({ kind: 'text', value: character, ...state });
}

function footnoteRunState(run, insideHyperlink) {
  exactWordAttributes(run, [], []);
  assertWhitespaceOnlyText(run);
  const properties = directWordChildren(run, 'rPr')[0];
  if (!properties) {
    return {
      code: false,
      bold: false,
      italic: false,
      strike: false,
      vertical: null,
    };
  }
  exactWordAttributes(properties, [], []);
  assertWhitespaceOnlyText(properties, { recursive: true });
  const children = elements(properties);
  const order = ['rStyle', 'b', 'bCs', 'i', 'iCs', 'strike', 'vertAlign'];
  const ranks = children.map((child) => (
    child.namespaceURI === WORD_NS ? order.indexOf(child.localName) : -1
  ));
  if (
    !children.length
    || ranks.some((rank) => rank < 0)
    || new Set(ranks).size !== ranks.length
    || ranks.some((rank, index) => index > 0 && rank <= ranks[index - 1])
  ) failMismatch();
  const byName = new Map(children.map((child) => [child.localName, child]));
  const style = byName.has('rStyle') ? exactWordLeaf(byName.get('rStyle'), ['val']).val : null;
  if (
    (insideHyperlink && !['Hyperlink', 'VerbatimChar'].includes(style))
    || (!insideHyperlink && style !== null && style !== 'VerbatimChar')
    || byName.has('b') !== byName.has('bCs')
    || byName.has('i') !== byName.has('iCs')
  ) failMismatch();
  for (const [name, property] of byName) {
    if (name === 'rStyle') continue;
    if (name === 'vertAlign') {
      const value = exactWordLeaf(property, ['val']).val;
      if (!['superscript', 'subscript'].includes(value)) failMismatch();
    } else {
      exactWordLeaf(property, [], []);
    }
  }
  return {
    code: style === 'VerbatimChar',
    bold: byName.has('b'),
    italic: byName.has('i'),
    strike: byName.has('strike'),
    vertical: byName.has('vertAlign') ? wordAttribute(byName.get('vertAlign'), 'val') : null,
  };
}

function projectFootnoteDocxRun(run, linkState, output) {
  const state = { ...footnoteRunState(run, linkState.linkKind !== null), ...linkState };
  const children = elements(run);
  const content = children[0]?.localName === 'rPr' ? children.slice(1) : children;
  if (content.length !== 1 || content[0].namespaceURI !== WORD_NS) failMismatch();
  const leaf = content[0];
  if (
    linkState.linkKind !== null
    && children[0]?.localName !== 'rPr'
    && !['br', 'cr'].includes(leaf.localName)
  ) {
    failMismatch();
  }
  if (leaf.localName === 't') {
    auditHyperlinkRunContent(leaf);
    const attributes = Array.from(leaf.attributes).filter((attribute) => attribute.namespaceURI !== XMLNS_NS);
    if (
      attributes.length !== 1
      || attributes[0].namespaceURI !== XML_NS
      || attributes[0].localName !== 'space'
      || attributes[0].value !== 'preserve'
    ) failMismatch();
    appendFootnoteDocxText(output, leaf.textContent, state);
  } else if (leaf.localName === 'tab') {
    exactWordLeaf(leaf, [], []);
    appendFootnoteDocxText(output, '\t', state);
  } else if (leaf.localName === 'br' || leaf.localName === 'cr') {
    exactWordLeaf(leaf, [], []);
    appendFootnoteDocxText(output, '\n', state);
  } else {
    failMismatch();
  }
}

function extractFootnoteParagraphProperties(paragraph, numbering, listKeys) {
  const properties = directWordChildren(paragraph, 'pPr');
  if (properties.length !== 1 || elements(paragraph)[0] !== properties[0]) failMismatch();
  exactWordAttributes(properties[0], [], []);
  assertWhitespaceOnlyText(properties[0], { recursive: true });
  const children = elements(properties[0]);
  if (
    children.length < 1
    || children.length > 2
    || children[0].namespaceURI !== WORD_NS
    || children[0].localName !== 'pStyle'
    || (children[1] && (children[1].namespaceURI !== WORD_NS || children[1].localName !== 'numPr'))
  ) failMismatch();
  const style = exactWordLeaf(children[0], ['val']).val;
  if (!['FootnoteText', 'Compact', 'FootnoteBlockText', 'SourceCode'].includes(style)) failMismatch();
  if (!children[1]) return { style, list: null };
  exactWordAttributes(children[1], [], []);
  assertWhitespaceOnlyText(children[1], { recursive: true });
  const listChildren = exactWordChildren(children[1], ['ilvl', 'numId']);
  const rawLevel = exactWordLeaf(listChildren[0], ['val']).val;
  const numId = exactWordLeaf(listChildren[1], ['val']).val;
  if (!/^\d+$/.test(rawLevel) || !canonicalPositiveWordId(numId)) failMismatch();
  const level = Number(rawLevel);
  if (!listKeys.has(numId)) listKeys.set(numId, listKeys.size + 1);
  const listSemantics = numbering(numId, level);
  return {
    style,
    list: {
      key: listKeys.get(numId),
      level,
      format: listSemantics.format,
      start: listSemantics.start,
      pattern: listSemantics.pattern,
      marker: listSemantics.marker,
      markerGlyph: listSemantics.markerGlyph,
      justification: listSemantics.justification,
      suffix: listSemantics.suffix,
      tabs: listSemantics.tabs,
      left: listSemantics.left,
      hanging: listSemantics.hanging,
      markerFont: listSemantics.markerFont,
    },
  };
}

function extractPositiveFootnoteBody(footnote, relationships, numbering) {
  const attributes = exactWordAttributes(footnote, ['id']);
  if (!canonicalPositiveWordId(attributes.id)) failMismatch();
  assertWhitespaceOnlyText(footnote);
  const paragraphs = directWordChildren(footnote, 'p');
  if (!paragraphs.length || elements(footnote).length !== paragraphs.length) failMismatch();
  const blocks = [];
  const listKeys = new Map();
  let prefixMode = null;
  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex];
    exactWordAttributes(paragraph, [], []);
    assertWhitespaceOnlyText(paragraph);
    const block = { ...extractFootnoteParagraphProperties(paragraph, numbering, listKeys), inlines: [] };
    const children = elements(paragraph);
    let cursor = 1;
    if (paragraphIndex === 0) {
      const reference = children[cursor];
      if (reference?.namespaceURI !== WORD_NS || reference.localName !== 'r') failMismatch();
      auditFootnoteBodyReferenceRun(reference);
      cursor += 1;
      const spacer = children[cursor];
      if (spacer) {
        exactWordAttributes(spacer, [], []);
        const spacerChildren = elements(spacer);
        if (
          spacer.namespaceURI !== WORD_NS
          || spacer.localName !== 'r'
          || spacerChildren.length !== 1
          || spacerChildren[0].namespaceURI !== WORD_NS
          || spacerChildren[0].localName !== 't'
          || spacerChildren[0].textContent !== ' '
        ) failMismatch();
        auditHyperlinkRunContent(spacerChildren[0]);
        prefixMode = 'inline';
        cursor += 1;
      } else {
        prefixMode = 'separate';
      }
    }
    for (; cursor < children.length; cursor += 1) {
      const child = children[cursor];
      if (child.namespaceURI !== WORD_NS) failMismatch();
      if (child.localName === 'r') {
        projectFootnoteDocxRun(child, { linkKind: null, linkTarget: null }, block.inlines);
      } else if (child.localName === 'hyperlink') {
        assertWhitespaceOnlyText(child);
        const reference = exactHyperlinkReference(child);
        let linkState;
        if (reference.relationshipId) {
          const relationship = relationships.get(reference.relationshipId);
          if (
            !relationship
            || relationship.Type !== HYPERLINK_REL
            || relationship.TargetMode !== 'External'
            || !validHyperlinkTargetReference(relationship.Target)
          ) failMismatch();
          linkState = { linkKind: 'external', linkTarget: relationship.Target };
        } else {
          linkState = { linkKind: 'anchor', linkTarget: reference.anchor };
        }
        const runs = elements(child);
        if (!runs.length || runs.some((run) => (
          run.namespaceURI !== WORD_NS || run.localName !== 'r'
        ))) failMismatch();
        for (const run of runs) projectFootnoteDocxRun(run, linkState, block.inlines);
      } else {
        failMismatch();
      }
    }
    if (paragraphIndex === 0 && prefixMode === 'separate') {
      if (block.style !== 'FootnoteText' || block.list !== null || block.inlines.length) failMismatch();
    } else {
      blocks.push(block);
    }
  }
  if (prefixMode === null) failMismatch();
  return {
    id: Number(attributes.id),
    text: blocks.map((block) => block.inlines.map((inline) => inline.value).join('')).join('\n'),
    prefixMode,
    blocks,
  };
}

function auditRichParagraphProperties(table, documentRelationships, footnoteIds) {
  for (const properties of descendantWordElements(table, 'pPr')) {
    const paragraph = properties.parentNode;
    if (
      paragraph?.namespaceURI !== WORD_NS
      || paragraph.localName !== 'p'
      || paragraph.parentNode?.namespaceURI !== WORD_NS
      || paragraph.parentNode.localName !== 'tc'
      || directWordChildren(paragraph, 'pPr').length !== 1
      || elements(paragraph)[0] !== properties
    ) failMismatch();
    exactWordAttributes(properties, [], []);
    assertWhitespaceOnlyText(properties, { recursive: true });
  }
  for (const properties of descendantWordElements(table, 'rPr')) {
    const owner = properties.parentNode;
    const runOwned = isDirectOrHyperlinkCellRun(owner);
    const paragraphOwned = owner?.namespaceURI === WORD_NS
      && owner.localName === 'pPr'
      && owner.parentNode?.namespaceURI === WORD_NS
      && owner.parentNode.localName === 'p'
      && owner.parentNode.parentNode?.namespaceURI === WORD_NS
      && owner.parentNode.parentNode.localName === 'tc';
    if (
      (!runOwned && !paragraphOwned)
      || directWordChildren(owner, 'rPr').length !== 1
      || (runOwned && elements(owner)[0] !== properties)
    ) failMismatch();
    exactWordAttributes(properties, [], []);
    if (runOwned) exactWordAttributes(owner, [], []);
    assertWhitespaceOnlyText(properties, { recursive: true });
  }
  for (const hyperlink of descendantWordElements(table, 'hyperlink')) {
    if (!isDirectCellParagraph(hyperlink.parentNode)) failMismatch();
    assertWhitespaceOnlyText(hyperlink);
    const reference = exactHyperlinkReference(hyperlink);
    if (reference.relationshipId) {
      const relationship = documentRelationships?.get(reference.relationshipId);
      if (
        !relationship
        || relationship.Type !== HYPERLINK_REL
        || relationship.TargetMode !== 'External'
        || !validHyperlinkTargetReference(relationship.Target)
      ) failMismatch();
    }
    const runs = elements(hyperlink);
    if (!runs.length || runs.some((run) => (
      run.namespaceURI !== WORD_NS || run.localName !== 'r'
    ))) failMismatch();
    for (const run of runs) {
      exactWordAttributes(run, [], []);
      assertWhitespaceOnlyText(run);
      const runChildren = elements(run);
      const properties = directWordChildren(run, 'rPr')[0];
      if (!properties) {
        if (
          runChildren.length !== 1
          || runChildren[0].namespaceURI !== WORD_NS
          || !['br', 'cr'].includes(runChildren[0].localName)
        ) failMismatch();
        auditHyperlinkRunContent(runChildren[0]);
        continue;
      }
      if (runChildren[0] !== properties) failMismatch();
      const style = auditStyledRunProperties(properties, { insideHyperlink: true });
      if (style === 'VerbatimChar' && (
        runChildren.length !== 2
        || runChildren[1].namespaceURI !== WORD_NS
        || runChildren[1].localName !== 't'
      )) failMismatch();
      if (runChildren.slice(1).some((child) => (
        child.namespaceURI !== WORD_NS
        || !['t', 'tab', 'br', 'cr'].includes(child.localName)
      ))) failMismatch();
      for (const child of runChildren.slice(1)) auditHyperlinkRunContent(child);
    }
  }
  for (const style of descendantWordElements(table, 'rStyle')) {
    if (directWordChildren(style.parentNode, 'rStyle').length !== 1) failMismatch();
    const insideHyperlink = hasWordAncestorPath(style, ['rPr', 'r', 'hyperlink', 'p', 'tc']);
    const direct = hasWordAncestorPath(style, ['rPr', 'r', 'p', 'tc']);
    if (!insideHyperlink && !direct) failMismatch();
    const rawStyle = exactWordLeaf(style, ['val']).val;
    if (rawStyle === 'FootnoteReference') {
      if (insideHyperlink) failMismatch();
      auditFootnoteReferenceRun(style.parentNode.parentNode, footnoteIds, { tableCellOnly: true });
      continue;
    }
    const styleValue = auditStyledRunProperties(style.parentNode, { insideHyperlink });
    if (styleValue !== 'VerbatimChar') continue;
    const run = style.parentNode.parentNode;
    const runChildren = elements(run);
    if (
      runChildren.length !== 2
      || runChildren[0] !== style.parentNode
      || runChildren[1].namespaceURI !== WORD_NS
      || runChildren[1].localName !== 't'
    ) failMismatch();
    auditHyperlinkRunContent(runChildren[1]);
  }
  for (const borders of descendantWordElements(table, 'pBdr')) {
    if (
      !hasWordAncestorPath(borders, ['pPr', 'p', 'tc'])
      || directWordChildren(borders.parentNode, 'pBdr').length !== 1
    ) failMismatch();
    exactWordAttributes(borders, [], []);
    assertWhitespaceOnlyText(borders);
    const children = elements(borders);
    const ranks = children.map((child) => PARAGRAPH_BORDER_NAMES.indexOf(
      child.namespaceURI === WORD_NS ? child.localName : '',
    ));
    if (
      !children.length
      || ranks.some((rank) => rank < 0)
      || new Set(ranks).size !== ranks.length
      || ranks.some((rank, index) => index > 0 && rank <= ranks[index - 1])
    ) failMismatch();
  }
  for (const alignment of descendantWordElements(table, 'jc')) {
    if (!isRichParagraphPropertyOccurrence(alignment, 'jc')) continue;
    if (directWordChildren(alignment.parentNode, 'jc').length !== 1) failMismatch();
    const attributes = exactWordLeaf(alignment, ['val']);
    if (![
      'left', 'center', 'right', 'both', 'start', 'end', 'distribute',
      'mediumKashida', 'highKashida', 'lowKashida', 'thaiDistribute', 'numTab',
    ].includes(attributes.val)) failMismatch();
  }
  for (const shading of descendantWordElements(table, 'shd')) {
    if (!isRichParagraphPropertyOccurrence(shading, 'shd')) continue;
    if (directWordChildren(shading.parentNode, 'shd').length !== 1) failMismatch();
    const attributes = exactWordLeaf(shading, ['val', 'color', 'fill']);
    if (
      attributes.val !== 'clear'
      || attributes.color !== 'auto'
      || !/^(?:auto|[0-9A-F]{6})$/.test(attributes.fill)
    ) failMismatch();
  }
  for (const style of descendantWordElements(table, 'cnfStyle')) {
    if (!isRichParagraphPropertyOccurrence(style, 'cnfStyle')) continue;
    if (directWordChildren(style.parentNode, 'cnfStyle').length !== 1) failMismatch();
    const attributes = exactWordLeaf(style, ['val']);
    if (!/^[01]{12}$/.test(attributes.val)) failMismatch();
  }
  for (const localName of PARAGRAPH_BORDER_NAMES) {
    for (const edge of descendantWordElements(table, localName)) {
      if (!isRichParagraphPropertyOccurrence(edge, localName)) continue;
      if (directWordChildren(edge.parentNode, localName).length !== 1) failMismatch();
      const attributes = exactWordLeaf(edge, ['val', 'sz', 'space', 'color']);
      const size = Number(attributes.sz);
      const space = Number(attributes.space);
      if (
        attributes.val !== 'single'
        || !/^[1-9]\d*$/.test(attributes.sz)
        || String(size) !== attributes.sz
        || size < 2
        || size > 96
        || !/^\d+$/.test(attributes.space)
        || String(space) !== attributes.space
        || space < 0
        || space > 31
        || !/^(?:auto|[0-9A-F]{6})$/.test(attributes.color)
      ) failMismatch();
    }
  }
}

function singletonWordChild(node, localName, { required = false } = {}) {
  const matches = directWordChildren(node, localName);
  if (matches.length > 1 || (required && matches.length !== 1)) failMismatch();
  return matches[0] ?? null;
}

function wordElements(document, localName) {
  return Array.from(document.getElementsByTagNameNS(WORD_NS, localName));
}

function createWordElement(document, localName) {
  return document.createElementNS(WORD_NS, `w:${localName}`);
}

function wordAttribute(node, localName) {
  return node?.getAttributeNS(WORD_NS, localName) ?? null;
}

function setWordAttribute(node, localName, value) {
  node.setAttributeNS(WORD_NS, `w:${localName}`, value);
}

function clearAttributes(node) {
  while (node.attributes.length) node.removeAttributeNode(node.attributes.item(0));
}

function descendantsExcludingNestedTables(root, visitor) {
  for (const child of elements(root)) {
    if (child.namespaceURI === WORD_NS && child.localName === 'tbl') continue;
    visitor(child);
    descendantsExcludingNestedTables(child, visitor);
  }
}

function paragraphSemanticText(paragraph) {
  let text = '';
  descendantsExcludingNestedTables(paragraph, (node) => {
    if (node.namespaceURI !== WORD_NS) return;
    if (node.localName === 't') text += node.textContent ?? '';
    else if (node.localName === 'tab') text += '\t';
    else if (node.localName === 'br' || node.localName === 'cr') text += '\n';
  });
  return text;
}

function cellSemanticText(cell) {
  const paragraphs = [];
  descendantsExcludingNestedTables(cell, (node) => {
    if (node.namespaceURI === WORD_NS && node.localName === 'p') paragraphs.push(node);
  });
  return normalizeSemanticText(paragraphs.map(paragraphSemanticText).join('\n'));
}

function cellBreakCount(cell) {
  let count = 0;
  descendantsExcludingNestedTables(cell, (node) => {
    if (node.namespaceURI === WORD_NS && (node.localName === 'br' || node.localName === 'cr')) {
      count += 1;
    }
  });
  return count;
}

function appendDocxProjectionText(output, value, state) {
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

function docxRunProjectionState(run, linkState) {
  const properties = directWordChildren(run, 'rPr')[0];
  if (!properties) return { ...linkState, code: false, bold: false, italic: false, strike: false };
  const styles = directWordChildren(properties, 'rStyle');
  const style = styles.length === 1 ? wordAttribute(styles[0], 'val') : null;
  const occurrences = Object.fromEntries(['b', 'bCs', 'i', 'iCs', 'strike'].map((name) => (
    [name, directWordChildren(properties, name)]
  )));
  for (const values of Object.values(occurrences)) {
    if (values.length > 1) failMismatch();
    for (const value of values) exactWordLeaf(value, [], []);
  }
  if (
    Boolean(occurrences.b.length) !== Boolean(occurrences.bCs.length)
    || Boolean(occurrences.i.length) !== Boolean(occurrences.iCs.length)
  ) failMismatch();
  return {
    ...linkState,
    code: style === 'VerbatimChar',
    bold: occurrences.b.length === 1,
    italic: occurrences.i.length === 1,
    strike: occurrences.strike.length === 1,
  };
}

function projectDocxRun(run, linkState, footnoteIds, output) {
  const properties = directWordChildren(run, 'rPr')[0];
  const style = properties ? directWordChildren(properties, 'rStyle')[0] : null;
  if (style && wordAttribute(style, 'val') === 'FootnoteReference') {
    output.push({
      kind: 'note',
      id: auditFootnoteReferenceRun(run, footnoteIds, { tableCellOnly: true }),
    });
    return;
  }
  const state = docxRunProjectionState(run, linkState);
  for (const child of elements(run)) {
    if (child.namespaceURI !== WORD_NS || child.localName === 'rPr') continue;
    if (child.localName === 't') appendDocxProjectionText(output, child.textContent ?? '', state);
    else if (child.localName === 'tab') appendDocxProjectionText(output, '\t', state);
    else if (child.localName === 'br' || child.localName === 'cr') {
      appendDocxProjectionText(output, '\n', state);
    }
  }
}

function cellRichProjection(cell, documentRelationships, footnoteIds) {
  const output = [];
  const paragraphs = directWordChildren(cell, 'p');
  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    if (paragraphIndex > 0) {
      appendDocxProjectionText(output, '\n', {
        code: false, bold: false, italic: false, strike: false,
        linkKind: null, linkTarget: null,
      });
    }
    for (const child of elements(paragraphs[paragraphIndex])) {
      if (child.namespaceURI !== WORD_NS) continue;
      if (child.localName === 'r') {
        projectDocxRun(child, { linkKind: null, linkTarget: null }, footnoteIds, output);
      } else if (child.localName === 'hyperlink') {
        const reference = exactHyperlinkReference(child);
        const linkState = reference.relationshipId
          ? {
            linkKind: 'external',
            linkTarget: documentRelationships.get(reference.relationshipId)?.Target ?? failMismatch(),
          }
          : { linkKind: 'anchor', linkTarget: reference.anchor };
        for (const run of directWordChildren(child, 'r')) {
          projectDocxRun(run, linkState, footnoteIds, output);
        }
      }
    }
  }
  return output;
}

function assertRichProjection(
  tables,
  descriptors,
  expected,
  { transformed, documentRelationships, footnoteIds },
) {
  if (!Array.isArray(expected) || expected.length !== tables.length) failMismatch();
  const actual = tables.map((table, tableIndex) => {
    const rows = directWordChildren(table, 'tr').map((row) => (
      directWordChildren(row, 'tc').map((cell) => (
        cellRichProjection(cell, documentRelationships, footnoteIds)
      ))
    ));
    if (transformed && descriptors[tableIndex].titleRow) {
      const expectedTitle = expected[tableIndex]?.[0];
      if (
        !Array.isArray(expectedTitle)
        || expectedTitle.slice(1).some((projection) => projection.length !== 0)
      ) failMismatch();
    }
    return rows;
  });
  const adjustedExpected = expected.map((rows, tableIndex) => {
    if (!transformed || !descriptors[tableIndex].titleRow) return rows;
    return rows.map((row, rowIndex) => (rowIndex === 0 ? [row[0]] : row));
  });
  if (JSON.stringify(actual) !== JSON.stringify(adjustedExpected)) failMismatch();
}

function assertFootnoteBodies(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) failMismatch();
  for (let index = 0; index < expected.length; index += 1) {
    if (
      expected[index]?.id !== index + 9
      || typeof expected[index]?.text !== 'string'
    ) failMismatch();
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failMismatch();
}

function mainDocumentBody(mainDocument) {
  const children = elements(mainDocument);
  const bodies = directWordChildren(mainDocument, 'body');
  if (children.length !== 1 || bodies.length !== 1 || children[0] !== bodies[0]) failMismatch();
  return bodies[0];
}

function auditDocumentFootnoteReferences(document, tables, packageStructure) {
  const mainDocument = document.documentElement;
  const mainBody = mainDocumentBody(mainDocument);
  const allowedCells = new Set();
  for (const table of tables) {
    if (table.parentNode !== mainBody) failMismatch();
    for (const row of directWordChildren(table, 'tr')) {
      for (const cell of directWordChildren(row, 'tc')) allowedCells.add(cell);
    }
  }
  const documentFootnoteIds = descendantWordElements(mainDocument, 'footnoteReference')
    .map((reference) => {
      const run = reference.parentNode;
      const id = auditFootnoteReferenceRun(run, packageStructure.footnoteIds, {
        allowedCells,
        mainBody,
      });
      if (elements(run)[1] !== reference) failMismatch();
      return id;
    });
  if (
    JSON.stringify(documentFootnoteIds)
    !== JSON.stringify(packageStructure.footnoteBodies.map((body) => body.id))
  ) failMismatch();
}

function matricesEqual(actual, expected) {
  return actual.length === expected.length && actual.every((row, rowIndex) => (
    row.length === expected[rowIndex]?.length
    && row.every((cell, cellIndex) => cell === expected[rowIndex][cellIndex])
  ));
}

function tableMatrix(table, logicalWidth, titleMerged = false) {
  return directWordChildren(table, 'tr').map((row, rowIndex) => {
    const cells = directWordChildren(row, 'tc');
    if (titleMerged && rowIndex === 0) {
      if (cells.length !== 1) failMismatch();
      const gridSpan = directWordChildren(directWordChildren(cells[0], 'tcPr')[0], 'gridSpan')[0];
      if (wordAttribute(gridSpan, 'val') !== String(logicalWidth)) failMismatch();
      return [cellSemanticText(cells[0]), ...Array(logicalWidth - 1).fill('')];
    }
    if (cells.length !== logicalWidth) failMismatch();
    return cells.map(cellSemanticText);
  });
}

function tableBreakMatrix(table, logicalWidth, titleMerged = false) {
  return directWordChildren(table, 'tr').map((row, rowIndex) => {
    const cells = directWordChildren(row, 'tc');
    if (titleMerged && rowIndex === 0) {
      if (cells.length !== 1) failMismatch();
      return [cellBreakCount(cells[0]), ...Array(logicalWidth - 1).fill(0)];
    }
    if (cells.length !== logicalWidth) failMismatch();
    return cells.map(cellBreakCount);
  });
}

function auditTableSingletons(
  table,
  logicalWidth,
  { transformed, titleMerged, documentRelationships, footnoteIds },
) {
  if (containsNamespaceElement(table, MARKUP_COMPATIBILITY_NS)) failMismatch();
  for (const localName of UNSUPPORTED_TABLE_WRAPPERS) {
    if (descendantWordElements(table, localName).length) failMismatch();
  }
  auditRichParagraphProperties(table, documentRelationships, footnoteIds);
  const properties = singletonWordChild(table, 'tblPr', { required: true });
  const grid = singletonWordChild(table, 'tblGrid', { required: true });
  assertWhitespaceOnlyText(table);
  exactWordAttributes(table, [], []);
  assertWhitespaceOnlyText(properties, { recursive: true });
  assertWhitespaceOnlyText(grid, { recursive: true });
  exactWordAttributes(properties, [], []);
  exactWordAttributes(grid, [], []);
  const propertyNames = transformed
    ? ['tblStyle', 'tblW', 'tblBorders', 'tblLook']
    : ['tblStyle', 'tblW', 'tblLook'];
  const propertyChildren = exactWordChildren(properties, propertyNames);
  const styleAttributes = exactWordLeaf(propertyChildren[0], ['val']);
  const widthAttributes = exactWordLeaf(propertyChildren[1], ['type', 'w']);
  const lookAttributes = exactWordLeaf(propertyChildren.at(-1), [
    'firstRow', 'lastRow', 'firstColumn', 'lastColumn', 'noHBand', 'noVBand', 'val',
  ]);
  if (
    styleAttributes.val !== 'Table'
    || widthAttributes.type !== 'auto'
    || widthAttributes.w !== '0'
    || lookAttributes.firstRow !== '1'
    || lookAttributes.lastRow !== '0'
    || lookAttributes.firstColumn !== '0'
    || lookAttributes.lastColumn !== '0'
    || lookAttributes.noHBand !== '0'
    || lookAttributes.noVBand !== '0'
    || lookAttributes.val !== '0020'
  ) failMismatch();
  const borders = transformed ? propertyChildren[2] : null;
  if (borders) {
    exactWordAttributes(borders, [], []);
    const edges = exactWordChildren(borders, BORDER_NAMES);
    for (const edge of edges) {
      const attributes = exactWordLeaf(edge, ['val', 'sz', 'space', 'color'], ['val']);
      const allowed = attributes.val === 'nil' ? ['val'] : ['val', 'sz', 'space', 'color'];
      if (
        !allowed.every((name) => Object.hasOwn(attributes, name))
        || Object.keys(attributes).length !== allowed.length
      ) failMismatch();
    }
  }
  const gridColumns = exactWordChildren(grid, Array(logicalWidth).fill('gridCol'));
  for (const gridColumn of gridColumns) {
    const attributes = exactWordLeaf(gridColumn, ['w']);
    const width = Number(attributes.w);
    if (
      !/^[1-9]\d*$/.test(attributes.w)
      || !Number.isSafeInteger(width)
      || String(width) !== attributes.w
    ) {
      failMismatch();
    }
  }
  const rows = directWordChildren(table, 'tr');
  const tableChildren = elements(table);
  if (
    tableChildren[0] !== properties
    || tableChildren[1] !== grid
    || tableChildren.slice(2).length !== rows.length
    || tableChildren.slice(2).some((child, index) => child !== rows[index])
    || descendantWordElements(table, 'tr').length !== rows.length
    || descendantWordElements(table, 'tbl').length !== 0
  ) failMismatch();
  let directCellCount = 0;
  let directRowPropertyCount = 0;
  let directCellPropertyCount = 0;
  let directSpanCount = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const rowProperties = singletonWordChild(rows[rowIndex], 'trPr');
    assertWhitespaceOnlyText(rows[rowIndex]);
    exactWordAttributes(rows[rowIndex], [], []);
    if (rowProperties) {
      directRowPropertyCount += 1;
      assertWhitespaceOnlyText(rowProperties, { recursive: true });
      exactWordAttributes(rowProperties, [], []);
      const [header] = exactWordChildren(rowProperties, ['tblHeader']);
      const attributes = exactWordLeaf(header, ['val']);
      if (attributes.val !== 'on') failMismatch();
    }
    const cells = directWordChildren(rows[rowIndex], 'tc');
    const rowChildren = elements(rows[rowIndex]);
    directCellCount += cells.length;
    const cellOffset = rowProperties ? 1 : 0;
    if (
      (rowProperties && rowChildren[0] !== rowProperties)
      || rowChildren.slice(cellOffset).length !== cells.length
      || rowChildren.slice(cellOffset).some((child, index) => child !== cells[index])
    ) failMismatch();
    const titleRow = transformed && titleMerged && rowIndex === 0;
    if (cells.length !== (titleRow ? 1 : logicalWidth)) failMismatch();
    let occupiedColumns = 0;
    for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      const cellProperties = singletonWordChild(cells[cellIndex], 'tcPr');
      const cellChildren = elements(cells[cellIndex]);
      const blockOffset = cellProperties ? 1 : 0;
      assertWhitespaceOnlyText(cells[cellIndex]);
      exactWordAttributes(cells[cellIndex], [], []);
      if (cellProperties) {
        directCellPropertyCount += 1;
        assertWhitespaceOnlyText(cellProperties, { recursive: true });
        exactWordAttributes(cellProperties, [], []);
      }
      if (
        (cellProperties && cellChildren[0] !== cellProperties)
        || cellChildren.length === blockOffset
        || cellChildren.slice(blockOffset).some((child) => (
          child.namespaceURI !== WORD_NS || child.localName !== 'p'
        ))
      ) failMismatch();
      const expectedCellProperties = titleRow && cellIndex === 0 ? ['gridSpan'] : [];
      let propertyNodes = [];
      if (cellProperties) propertyNodes = exactWordChildren(cellProperties, expectedCellProperties);
      else if (expectedCellProperties.length) failMismatch();
      const span = propertyNodes[0] ?? null;
      if (span) {
        directSpanCount += 1;
        exactWordLeaf(span, ['val']);
      }
      const spanValue = span ? wordAttribute(span, 'val') : '1';
      if (!/^[1-9]\d*$/.test(spanValue)) failMismatch();
      const width = Number(spanValue);
      if (!Number.isSafeInteger(width) || String(width) !== spanValue) failMismatch();
      if (titleRow) {
        if (cellIndex !== 0 || !span || width !== logicalWidth) failMismatch();
      } else if (width !== 1) failMismatch();
      occupiedColumns += width;
    }
    if (occupiedColumns !== logicalWidth) failMismatch();
  }
  if (descendantWordElements(table, 'tc').length !== directCellCount) failMismatch();
  const expectedPropertyCounts = new Map([
    ['tblPr', 1], ['tblStyle', 1], ['tblW', 1], ['tblLook', 1],
    ['tblBorders', transformed ? 1 : 0], ['tblGrid', 1],
    ['gridCol', gridColumns.length], ['trPr', directRowPropertyCount],
    ['tblHeader', directRowPropertyCount], ['tcPr', directCellPropertyCount],
    ['gridSpan', directSpanCount],
    ...BORDER_NAMES.map((name) => [name, transformed ? 1 : 0]),
  ]);
  for (const localName of TABLE_PROPERTY_NAMES) {
    if (
      tablePropertyOccurrenceCount(table, localName)
      !== (expectedPropertyCounts.get(localName) ?? 0)
    ) failMismatch();
  }
}

function assertBridgedBreaks(actual, expected) {
  if (!Array.isArray(expected) || actual.length !== expected.length) failMismatch();
  for (let rowIndex = 0; rowIndex < actual.length; rowIndex += 1) {
    if (actual[rowIndex].length !== expected[rowIndex]?.length) failMismatch();
    for (let cellIndex = 0; cellIndex < actual[rowIndex].length; cellIndex += 1) {
      if (actual[rowIndex][cellIndex] < expected[rowIndex][cellIndex]) failMismatch();
    }
  }
}

function ensureTableProperties(table) {
  let properties = directWordChildren(table, 'tblPr')[0];
  if (!properties) {
    properties = createWordElement(table.ownerDocument, 'tblPr');
    table.insertBefore(properties, table.firstChild);
  }
  return properties;
}

function ensureTableBorders(properties) {
  let borders = directWordChildren(properties, 'tblBorders')[0];
  if (borders) return borders;
  borders = createWordElement(properties.ownerDocument, 'tblBorders');
  const followingNames = new Set([
    'shd', 'tblLayout', 'tblCellMar', 'tblLook', 'tblCaption', 'tblDescription',
  ]);
  const following = elements(properties).find((child) => (
    child.namespaceURI === WORD_NS && followingNames.has(child.localName)
  ));
  properties.insertBefore(borders, following ?? null);
  return borders;
}

function applyBorders(table, entry) {
  const borders = ensureTableBorders(ensureTableProperties(table));
  for (const name of BORDER_NAMES) {
    let edge = directWordChildren(borders, name)[0];
    if (!edge) {
      edge = createWordElement(table.ownerDocument, name);
      borders.appendChild(edge);
    }
    clearAttributes(edge);
    if (entry.borderColor === null) {
      setWordAttribute(edge, 'val', 'nil');
    } else {
      setWordAttribute(edge, 'val', 'single');
      setWordAttribute(edge, 'sz', BORDER_SIZES[entry.borderWidth]);
      setWordAttribute(edge, 'space', '0');
      setWordAttribute(
        edge,
        'color',
        entry.borderColor === 'default' ? 'D2D1CF' : entry.borderColor.slice(1).toUpperCase(),
      );
    }
  }
}

function ensureCellProperties(cell) {
  let properties = directWordChildren(cell, 'tcPr')[0];
  if (!properties) {
    properties = createWordElement(cell.ownerDocument, 'tcPr');
    cell.insertBefore(properties, cell.firstChild);
  }
  return properties;
}

function applyTitleMerge(table, logicalWidth) {
  const firstRow = directWordChildren(table, 'tr')[0];
  const cells = directWordChildren(firstRow, 'tc');
  if (
    cells.length !== logicalWidth
    || cells.slice(1).some((cell) => cellSemanticText(cell) !== '')
  ) failMismatch();
  const properties = ensureCellProperties(cells[0]);
  let gridSpan = directWordChildren(properties, 'gridSpan')[0];
  if (!gridSpan) {
    gridSpan = createWordElement(table.ownerDocument, 'gridSpan');
    const followingNames = new Set(['hMerge', 'vMerge', 'tcBorders', 'shd']);
    const following = elements(properties).find((child) => (
      child.namespaceURI === WORD_NS && followingNames.has(child.localName)
    ));
    properties.insertBefore(gridSpan, following ?? null);
  }
  clearAttributes(gridSpan);
  setWordAttribute(gridSpan, 'val', String(logicalWidth));
  for (const cell of cells.slice(1)) firstRow.removeChild(cell);
}

function decodeZipName(nameBytes, flags) {
  try {
    if ((flags & 0x0800) !== 0) {
      return new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
    }
    if (nameBytes.some((value) => value > 0x7f)) failMismatch();
    return nameBytes.toString('ascii');
  } catch {
    failMismatch();
  }
}

function centralDirectoryRecords(buffer) {
  const bytes = Buffer.from(buffer);
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== EOCD_SIGNATURE) continue;
    const commentLength = bytes.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === bytes.length) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset === -1) failMismatch();
  const diskNumber = bytes.readUInt16LE(endOffset + 4);
  const centralDisk = bytes.readUInt16LE(endOffset + 6);
  const diskEntries = bytes.readUInt16LE(endOffset + 8);
  const totalEntries = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  if (
    diskNumber !== 0
    || centralDisk !== 0
    || diskEntries !== totalEntries
    || totalEntries === 0
    || totalEntries > MAX_ZIP_ENTRIES
    || totalEntries === 0xffff
    || centralSize === 0xffffffff
    || centralOffset === 0xffffffff
    || centralOffset + centralSize !== endOffset
  ) failMismatch();

  const records = [];
  const seen = new Set();
  const localOffsets = new Set();
  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > endOffset || bytes.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      failMismatch();
    }
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const crc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const diskStart = bytes.readUInt16LE(cursor + 34);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (
      next > endOffset
      || diskStart !== 0
      || compressedSize === 0xffffffff
      || uncompressedSize === 0xffffffff
      || localOffset === 0xffffffff
      || compressedSize > bytes.length
      || uncompressedSize > MAX_ZIP_ENTRY_BYTES
      || ![0, 8].includes(method)
      || (flags & 0x0001) !== 0
      || localOffsets.has(localOffset)
    ) failMismatch();
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decodeZipName(nameBytes, flags);
    if (!name || seen.has(name)) failMismatch();
    seen.add(name);
    localOffsets.add(localOffset);
    records.push({
      name,
      nameBytes: Buffer.from(nameBytes),
      flags,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    cursor = next;
  }
  if (cursor !== endOffset) failMismatch();

  let totalUncompressedSize = 0;
  const regions = records.map((record) => {
    const localOffset = record.localOffset;
    if (
      localOffset + 30 > centralOffset
      || bytes.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER_SIGNATURE
    ) failMismatch();
    const localFlags = bytes.readUInt16LE(localOffset + 6);
    const localMethod = bytes.readUInt16LE(localOffset + 8);
    const localCrc = bytes.readUInt32LE(localOffset + 14);
    const localCompressedSize = bytes.readUInt32LE(localOffset + 18);
    const localUncompressedSize = bytes.readUInt32LE(localOffset + 22);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const localNameStart = localOffset + 30;
    const localNameEnd = localNameStart + localNameLength;
    const payloadStart = localNameEnd + localExtraLength;
    const payloadEnd = payloadStart + record.compressedSize;
    if (payloadEnd > centralOffset) failMismatch();
    const localNameBytes = bytes.subarray(localNameStart, localNameEnd);
    const localName = decodeZipName(localNameBytes, localFlags);
    if (
      localFlags !== record.flags
      || localMethod !== record.method
      || localName !== record.name
      || !localNameBytes.equals(record.nameBytes)
    ) failMismatch();

    let end = payloadEnd;
    if ((record.flags & 0x0008) !== 0) {
      const localMetadataEmpty = localCrc === 0
        && localCompressedSize === 0
        && localUncompressedSize === 0;
      const localMetadataExact = localCrc === record.crc
        && localCompressedSize === record.compressedSize
        && localUncompressedSize === record.uncompressedSize;
      if (!localMetadataEmpty && !localMetadataExact) failMismatch();
      const descriptorOffsets = bytes.readUInt32LE(payloadEnd) === DATA_DESCRIPTOR_SIGNATURE
        ? [payloadEnd + 4, payloadEnd]
        : [payloadEnd];
      const descriptorOffset = descriptorOffsets.find((offset) => (
        offset + 12 <= centralOffset
        && bytes.readUInt32LE(offset) === record.crc
        && bytes.readUInt32LE(offset + 4) === record.compressedSize
        && bytes.readUInt32LE(offset + 8) === record.uncompressedSize
      ));
      if (descriptorOffset === undefined) failMismatch();
      end = descriptorOffset + 12;
    } else if (
      localCrc !== record.crc
      || localCompressedSize !== record.compressedSize
      || localUncompressedSize !== record.uncompressedSize
    ) failMismatch();
    totalUncompressedSize += record.uncompressedSize;
    if (totalUncompressedSize > MAX_ZIP_TOTAL_BYTES) failMismatch();
    return { start: localOffset, end };
  }).sort((left, right) => left.start - right.start);
  let localCursor = 0;
  for (const region of regions) {
    if (region.start !== localCursor || region.end <= region.start) failMismatch();
    localCursor = region.end;
  }
  if (localCursor !== centralOffset) failMismatch();
  return records;
}

let crcTable;
function crc32(bytes) {
  crcTable ??= Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    return value >>> 0;
  });
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function packageEntries(buffer) {
  const centralRecords = centralDirectoryRecords(buffer);
  let entries;
  try {
    entries = unzipSync(new Uint8Array(buffer));
  } catch {
    failMismatch();
  }
  for (const name of REQUIRED_PACKAGE_PARTS) {
    if (!(entries[name] instanceof Uint8Array)) failMismatch();
  }
  if (
    Object.keys(entries).length !== centralRecords.length
    || centralRecords.some((record) => !Object.hasOwn(entries, record.name))
  ) failMismatch();
  for (const record of centralRecords) {
    const bytes = entries[record.name];
    if (bytes.length !== record.uncompressedSize || crc32(bytes) !== record.crc) failMismatch();
  }
  for (const name of Object.keys(entries)) {
    if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) failMismatch();
  }
  return entries;
}

function relationshipSourceDirectory(relationshipName) {
  const sourcePart = relationshipSourcePartName(relationshipName);
  return sourcePart ? sourcePart.split('/').slice(0, -1).join('/') : '';
}

function decodedCanonicalSegment(segment) {
  if (!segment || segment === '.' || segment === '..') failMismatch();
  const escapes = segment.match(/%[0-9A-Fa-f]{2}/g) ?? [];
  const unescaped = segment.replace(/%[0-9A-Fa-f]{2}/g, '');
  if (
    unescaped.includes('%')
    || (unescaped && !/^[A-Za-z0-9._~!$&'()*+,;=:@-]+$/.test(unescaped))
  ) failMismatch();
  for (const escape of escapes) {
    const value = Number.parseInt(escape.slice(1), 16);
    const character = String.fromCharCode(value);
    if (
      escape !== escape.toUpperCase()
      || value === 0x2e
      || value === 0x2f
      || value === 0x5c
      || value === 0x23
      || value === 0x3f
      || value <= 0x1f
      || value === 0x7f
      || /^[A-Za-z0-9._~!$&'()*+,;=:@-]$/.test(character)
    ) failMismatch();
  }
  let decoded;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    failMismatch();
  }
  if (
    !decoded
    || decoded === '.'
    || decoded === '..'
    || decoded.endsWith('.')
    || decoded.normalize('NFC') !== decoded
    || /[\\/?#\u0000-\u001f\u007f]/u.test(decoded)
  ) failMismatch();
  return decoded;
}

function canonicalPartName(partName) {
  if (
    typeof partName !== 'string'
    || !partName.startsWith('/')
    || partName.endsWith('/')
    || /[\\?#\u0000-\u001f\u007f]/u.test(partName)
  ) failMismatch();
  const segments = partName.slice(1).split('/').map(decodedCanonicalSegment);
  return `/${segments.join('/')}`;
}

function partIdentity(partName) {
  return partName.normalize('NFC').toLowerCase();
}

function canonicalRelationshipTarget(sourceDirectory, target) {
  if (
    typeof target !== 'string'
    || !target
    || target.startsWith('/')
    || target.endsWith('/')
    || /[\\?#\u0000-\u001f\u007f]/u.test(target)
  ) failMismatch();
  const targetSegments = target.split('/').map(decodedCanonicalSegment);
  const sourceSegments = !sourceDirectory ? [] : sourceDirectory.split('/');
  const resolved = [...sourceSegments, ...targetSegments].join('/');
  if (!resolved) failMismatch();
  return resolved;
}

function relationshipSourcePartName(name) {
  const parts = name.split('/');
  const relsIndexes = parts
    .map((part, index) => (part === '_rels' ? index : -1))
    .filter((index) => index !== -1);
  if (relsIndexes.length !== 1) failMismatch();
  const relsIndex = relsIndexes[0];
  const filename = parts.at(-1);
  if (relsIndex !== parts.length - 2 || !filename.endsWith('.rels')) failMismatch();
  if (filename === '.rels') {
    if (name !== '_rels/.rels') failMismatch();
    return null;
  }
  const sourceFilename = filename.slice(0, -'.rels'.length);
  if (!sourceFilename) failMismatch();
  return [...parts.slice(0, relsIndex), sourceFilename].join('/');
}

function validContentType(value) {
  return typeof value === 'string'
    && /^[!#$&^_.+A-Za-z0-9-]+\/[!#$&^_.+A-Za-z0-9-]+$/.test(value);
}

function validAbsoluteUri(value, { allowFragment = true } = {}) {
  if (
    typeof value !== 'string'
    || !value
    || /[\\\s\u0000-\u001f\u007f]/u.test(value)
    || !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
    || value.replace(/%[0-9A-Fa-f]{2}/g, '').includes('%')
    || (!allowFragment && value.includes('#'))
  ) return false;
  try {
    const parsed = new URL(value);
    if (
      ['http:', 'https:'].includes(parsed.protocol)
      && (!parsed.hostname || !/^https?:\/\/[^/?#]+(?:[/?#]|$)/i.test(value))
    ) return false;
    return true;
  } catch {
    return false;
  }
}

function validHyperlinkTargetReference(value) {
  if (
    typeof value !== 'string'
    || !value
    || value.normalize('NFC') !== value
    || /[\\\s\u0000-\u001f\u007f<>"{}|^`]/u.test(value)
    || value.replace(/%[0-9A-Fa-f]{2}/g, '').includes('%')
  ) return false;
  for (const escape of value.match(/%[0-9A-Fa-f]{2}/g) ?? []) {
    const decoded = String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    if (escape !== escape.toUpperCase() || /^[A-Za-z0-9._~-]$/.test(decoded)) return false;
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return validAbsoluteUri(value);
  try {
    const parsed = new URL(value, 'https://fusion.invalid/base/');
    if (value.startsWith('//') && !parsed.hostname) return false;
    return true;
  } catch {
    return false;
  }
}

function validHyperlinkAnchor(value) {
  if (
    typeof value !== 'string'
    || !value
    || value.normalize('NFC') !== value
    || /[#\\\s\u0000-\u001f\u007f<>"{}|^`]/u.test(value)
    || value.replace(/%[0-9A-Fa-f]{2}/g, '').includes('%')
  ) return false;
  for (const escape of value.match(/%[0-9A-Fa-f]{2}/g) ?? []) {
    const decoded = String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    if (escape !== escape.toUpperCase() || /^[A-Za-z0-9._~-]$/.test(decoded)) return false;
  }
  return true;
}

function exactOwnAttributes(node, allowedNames, requiredNames = allowedNames) {
  const allowed = new Set(allowedNames);
  const attributes = Object.create(null);
  for (const attribute of Array.from(node.attributes)) {
    if (attribute.namespaceURI === XMLNS_NS) continue;
    if (
      attribute.namespaceURI
      || !allowed.has(attribute.name)
      || Object.hasOwn(attributes, attribute.name)
    ) {
      failMismatch();
    }
    attributes[attribute.name] = attribute.value;
  }
  if (requiredNames.some((name) => !Object.hasOwn(attributes, name))) failMismatch();
  return attributes;
}

function assertNamespaceAttributesOnly(node) {
  for (const attribute of Array.from(node.attributes)) {
    if (attribute.namespaceURI !== XMLNS_NS) failMismatch();
  }
}

function exactRelationshipAttributes(relationship) {
  const attributes = exactOwnAttributes(
    relationship,
    ['Id', 'Type', 'Target', 'TargetMode'],
    ['Id', 'Type', 'Target'],
  );
  if (
    !/^[A-Za-z_][A-Za-z0-9._-]*$/.test(attributes.Id ?? '')
    || !validAbsoluteUri(attributes.Type, { allowFragment: false })
    || typeof attributes.Target !== 'string'
    || !attributes.Target
    || (attributes.TargetMode !== undefined
      && attributes.TargetMode !== 'Internal'
      && attributes.TargetMode !== 'External')
  ) failMismatch();
  return attributes;
}

function verifyPackageStructure(entries) {
  const packageParts = new Map();
  const relationshipParts = new Map();
  const canonicalPackageNames = new Set();
  for (const name of Object.keys(entries)) {
    if (name === '[Content_Types].xml') continue;
    const canonicalName = canonicalPartName(`/${name}`).slice(1);
    if (
      canonicalName.toLowerCase() === '[content_types].xml'
      || canonicalName.split('/').some((segment) => (
        segment.toLowerCase() === '_rels' && segment !== '_rels'
      ))
      || (canonicalName.toLowerCase().endsWith('.rels') && !canonicalName.endsWith('.rels'))
    ) failMismatch();
    const identity = partIdentity(canonicalName);
    if (canonicalPackageNames.has(identity)) failMismatch();
    canonicalPackageNames.add(identity);
    if (canonicalName.split('/').includes('_rels')) {
      const sourcePart = relationshipSourcePartName(canonicalName);
      relationshipParts.set(identity, { canonicalName, name, sourcePart });
      continue;
    }
    if (canonicalName.endsWith('.rels')) failMismatch();
    if (packageParts.has(identity)) failMismatch();
    packageParts.set(identity, { canonicalName, name });
  }
  for (const { sourcePart } of relationshipParts.values()) {
    if (sourcePart !== null && !packageParts.has(partIdentity(sourcePart))) failMismatch();
  }
  for (const [name, bytes] of Object.entries(entries)) {
    if (name.toLowerCase().endsWith('.xml')) parseXml(bytes);
  }
  const contentTypes = parseXml(entries['[Content_Types].xml']).documentElement;
  if (contentTypes.namespaceURI !== CONTENT_TYPES_NS || contentTypes.localName !== 'Types') {
    failMismatch();
  }
  assertNamespaceAttributesOnly(contentTypes);
  assertWhitespaceOnlyText(contentTypes);
  const defaultExtensions = new Map();
  const overrideParts = new Map();
  let mainDocumentOverrideCount = 0;
  for (const child of elements(contentTypes)) {
    if (child.namespaceURI !== CONTENT_TYPES_NS) failMismatch();
    assertEmptyElementContent(child);
    if (child.localName === 'Default') {
      const attributes = exactOwnAttributes(child, ['Extension', 'ContentType']);
      const extension = attributes.Extension;
      const contentType = attributes.ContentType;
      const key = extension.toLowerCase();
      if (
        !/^[A-Za-z0-9]+$/.test(extension)
        || !validContentType(contentType)
        || defaultExtensions.has(key)
      ) {
        failMismatch();
      }
      defaultExtensions.set(key, contentType);
    } else if (child.localName === 'Override') {
      const attributes = exactOwnAttributes(child, ['PartName', 'ContentType']);
      const partName = attributes.PartName;
      const contentType = attributes.ContentType;
      const canonicalName = canonicalPartName(partName);
      const key = partIdentity(canonicalName);
      if (
        !validContentType(contentType)
        || overrideParts.has(key)
        || !packageParts.has(partIdentity(canonicalName.slice(1)))
      ) failMismatch();
      overrideParts.set(key, contentType);
      if (key === partIdentity(`/${DOCUMENT_PATH}`)) {
        mainDocumentOverrideCount += 1;
        if (contentType !== MAIN_DOCUMENT_CONTENT_TYPE) failMismatch();
      }
    } else {
      failMismatch();
    }
  }
  if (
    mainDocumentOverrideCount !== 1
    || defaultExtensions.get('rels') !== RELATIONSHIPS_CONTENT_TYPE
  ) failMismatch();
  for (const [identity, { canonicalName }] of packageParts) {
    if (overrideParts.has(partIdentity(`/${identity}`))) continue;
    const filename = canonicalName.split('/').at(-1);
    const dot = filename.lastIndexOf('.');
    const extension = dot > 0 && dot < filename.length - 1
      ? filename.slice(dot + 1).toLowerCase()
      : '';
    if (!extension || !defaultExtensions.has(extension)) failMismatch();
  }
  const mainDocumentPart = packageParts.get(partIdentity(DOCUMENT_PATH));
  if (!mainDocumentPart) failMismatch();
  const mainDocument = parseXml(entries[mainDocumentPart.name]).documentElement;
  if (mainDocument.namespaceURI !== WORD_NS || mainDocument.localName !== 'document') failMismatch();
  mainDocumentBody(mainDocument);

  let officeDocumentRelationshipCount = 0;
  let footnotePartName = null;
  const relationshipsBySource = new Map();
  const relationshipRecordsBySource = new Map();
  for (const { canonicalName, name, sourcePart } of relationshipParts.values()) {
    const bytes = entries[name];
    const document = parseXml(bytes);
    const root = document.documentElement;
    if (root.namespaceURI !== REL_NS || root.localName !== 'Relationships') failMismatch();
    assertNamespaceAttributesOnly(root);
    assertWhitespaceOnlyText(root);
    const relationshipIds = new Set();
    const sourceIdentity = sourcePart === null ? '' : partIdentity(sourcePart);
    const sourceRelationships = new Map();
    relationshipsBySource.set(sourceIdentity, sourceRelationships);
    const sourceRelationshipRecords = [];
    relationshipRecordsBySource.set(sourceIdentity, sourceRelationshipRecords);
    for (const relationship of elements(root)) {
      if (relationship.namespaceURI !== REL_NS || relationship.localName !== 'Relationship') {
        failMismatch();
      }
      assertEmptyElementContent(relationship);
      const attributes = exactRelationshipAttributes(relationship);
      const relationshipId = attributes.Id;
      if (relationshipIds.has(relationshipId)) failMismatch();
      relationshipIds.add(relationshipId);
      sourceRelationships.set(relationshipId, attributes);
      const relationshipRecord = { attributes, resolvedIdentity: null };
      sourceRelationshipRecords.push(relationshipRecord);
      const targetMode = attributes.TargetMode;
      if (targetMode === 'External') {
        if (
          sourcePart === null
          && attributes.Type === OFFICE_DOCUMENT_REL
        ) {
          failMismatch();
        }
        const validTarget = attributes.Type === HYPERLINK_REL
          ? validHyperlinkTargetReference(attributes.Target)
          : validAbsoluteUri(attributes.Target);
        if (!validTarget) failMismatch();
        continue;
      }
      const resolved = canonicalRelationshipTarget(
        relationshipSourceDirectory(canonicalName),
        attributes.Target,
      );
      relationshipRecord.resolvedIdentity = partIdentity(resolved);
      if (!packageParts.has(relationshipRecord.resolvedIdentity)) failMismatch();
      if (sourceIdentity === partIdentity(DOCUMENT_PATH) && attributes.Type === FOOTNOTES_REL) {
        if (
          footnotePartName !== null
          || attributes.TargetMode !== undefined
          || partIdentity(resolved) !== partIdentity(FOOTNOTES_PATH)
        ) failMismatch();
        footnotePartName = packageParts.get(partIdentity(resolved)).name;
      }
      if (
        sourcePart === null
        && attributes.Type === OFFICE_DOCUMENT_REL
      ) {
        officeDocumentRelationshipCount += 1;
        if (partIdentity(resolved) !== partIdentity(DOCUMENT_PATH)) failMismatch();
      }
    }
  }
  if (officeDocumentRelationshipCount !== 1) failMismatch();
  function requireNumberingRelationship(numberingPart) {
    const numberingIdentity = partIdentity(NUMBERING_PATH);
    if (numberingPart !== packageParts.get(numberingIdentity)) failMismatch();
    const documentRelationships = relationshipRecordsBySource.get(
      partIdentity(DOCUMENT_PATH),
    ) ?? [];
    const typedRelationships = documentRelationships.filter(({ attributes }) => (
      attributes.Type === NUMBERING_REL
    ));
    const targetedRelationships = documentRelationships.filter(({ resolvedIdentity }) => (
      resolvedIdentity === numberingIdentity
    ));
    if (
      typedRelationships.length !== 1
      || targetedRelationships.length !== 1
      || typedRelationships[0] !== targetedRelationships[0]
      || typedRelationships[0].attributes.TargetMode !== undefined
    ) failMismatch();
  }
  const footnoteIds = new Set();
  let footnoteBodies = [];
  if (footnotePartName !== null) {
    if (
      overrideParts.get(partIdentity(`/${footnotePartName}`)) !== FOOTNOTES_CONTENT_TYPE
    ) failMismatch();
    const footnotes = parseXml(entries[footnotePartName]).documentElement;
    if (footnotes.namespaceURI !== WORD_NS || footnotes.localName !== 'footnotes') failMismatch();
    assertNamespaceAttributesOnly(footnotes);
    assertWhitespaceOnlyText(footnotes);
    const footnoteElements = elements(footnotes);
    if (footnoteElements.some((node) => (
      node.namespaceURI !== WORD_NS || node.localName !== 'footnote'
    ))) failMismatch();
    if (footnoteElements.length < 2) failMismatch();
    auditFootnoteSentinel(footnoteElements[0], '0', 'continuationSeparator', 'continuationSeparator');
    auditFootnoteSentinel(footnoteElements[1], '-1', 'separator', 'separator');
    const footnoteRelationships = relationshipsBySource.get(partIdentity(FOOTNOTES_PATH)) ?? new Map();
    const numbering = createNumberingResolver(
      entries,
      packageParts,
      requireNumberingRelationship,
    );
    footnoteBodies = footnoteElements.slice(2).map((footnote) => (
      extractPositiveFootnoteBody(footnote, footnoteRelationships, numbering)
    ));
    for (const body of footnoteBodies) {
      const id = String(body.id);
      if (footnoteIds.has(id)) failMismatch();
      footnoteIds.add(id);
    }
  }
  return Object.freeze({
    documentName: mainDocumentPart.name,
    documentRelationships: relationshipsBySource.get(partIdentity(DOCUMENT_PATH)) ?? new Map(),
    footnoteIds,
    footnoteBodies,
  });
}

function inspectOfficeDocxPresentation(
  buffer,
  prepared,
  { bridgedBreaks = null, richProjection = null, footnoteBodies = null } = {},
) {
  const entries = packageEntries(buffer);
  const packageStructure = verifyPackageStructure(entries);
  const document = parseXml(entries[packageStructure.documentName]);
  const tables = wordElements(document, 'tbl');
  const descriptors = prepared?.tablePresentation?.tables;
  const sources = prepared?.sourceTables;
  if (!Array.isArray(descriptors) || !Array.isArray(sources) || tables.length !== descriptors.length) {
    failMismatch();
  }
  const summaries = tables.map((table, tableIndex) => {
    const entry = descriptors[tableIndex];
    const source = sources[tableIndex];
    if (entry?.tableIndex !== tableIndex || source?.tableIndex !== tableIndex) failMismatch();
    auditTableSingletons(table, entry.logicalWidth, {
      transformed: true,
      titleMerged: entry.titleRow,
      documentRelationships: packageStructure.documentRelationships,
      footnoteIds: packageStructure.footnoteIds,
    });
    const matrix = tableMatrix(table, entry.logicalWidth, entry.titleRow);
    if (!matricesEqual(matrix, source.semanticRows)) failMismatch();
    const breaks = tableBreakMatrix(table, entry.logicalWidth, entry.titleRow);
    if (bridgedBreaks) assertBridgedBreaks(breaks, bridgedBreaks[tableIndex]);
    const properties = directWordChildren(table, 'tblPr')[0];
    const borders = directWordChildren(properties, 'tblBorders')[0];
    if (!borders) failMismatch();
    const borderSummary = Object.fromEntries(BORDER_NAMES.map((name) => {
      const edge = directWordChildren(borders, name)[0];
      if (!edge) failMismatch();
      const attributes = Object.fromEntries(Array.from(edge.attributes).map((attribute) => [
        attribute.localName, attribute.value,
      ]));
      if (entry.borderColor === null) {
        if (attributes.val !== 'nil' || Object.keys(attributes).length !== 1) failMismatch();
      } else {
        const color = entry.borderColor === 'default'
          ? 'D2D1CF'
          : entry.borderColor.slice(1).toUpperCase();
        if (
          attributes.val !== 'single'
          || attributes.sz !== BORDER_SIZES[entry.borderWidth]
          || attributes.space !== '0'
          || attributes.color !== color
          || Object.keys(attributes).length !== 4
        ) failMismatch();
      }
      return [name, attributes];
    }));
    return {
      tableIndex,
      titleMerged: entry.titleRow,
      matrix,
      breaks,
      borders: borderSummary,
    };
  });
  auditDocumentFootnoteReferences(document, tables, packageStructure);
  if (richProjection) {
    assertRichProjection(tables, descriptors, richProjection, {
      transformed: true,
      documentRelationships: packageStructure.documentRelationships,
      footnoteIds: packageStructure.footnoteIds,
    });
  }
  if (footnoteBodies) assertFootnoteBodies(packageStructure.footnoteBodies, footnoteBodies);
  return Object.freeze({
    entryNames: Object.keys(entries).sort(),
    summaries,
  });
}

function transformOfficeDocxPresentation(
  buffer,
  prepared,
  { bridgedBreaks, richProjection, footnoteBodies } = {},
) {
  const originalEntries = packageEntries(buffer);
  const packageStructure = verifyPackageStructure(originalEntries);
  const originalNames = Object.keys(originalEntries).sort();
  const originalHashes = Object.fromEntries(originalNames
    .filter((name) => name !== packageStructure.documentName)
    .map((name) => [name, crypto.createHash('sha256').update(originalEntries[name]).digest('hex')]));
  const document = parseXml(originalEntries[packageStructure.documentName]);
  const tables = wordElements(document, 'tbl');
  const entries = prepared?.tablePresentation?.tables;
  const sources = prepared?.sourceTables;
  if (!Array.isArray(entries) || !Array.isArray(sources) || tables.length !== entries.length) {
    failMismatch();
  }
  if (!Array.isArray(richProjection) || !Array.isArray(footnoteBodies)) failMismatch();
  assertFootnoteBodies(packageStructure.footnoteBodies, footnoteBodies);

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const table = tables[tableIndex];
    const entry = entries[tableIndex];
    const source = sources[tableIndex];
    if (entry?.tableIndex !== tableIndex || source?.tableIndex !== tableIndex) failMismatch();
    auditTableSingletons(table, entry.logicalWidth, {
      transformed: false,
      titleMerged: false,
      documentRelationships: packageStructure.documentRelationships,
      footnoteIds: packageStructure.footnoteIds,
    });
    const matrix = tableMatrix(table, entry.logicalWidth);
    if (!matricesEqual(matrix, source.semanticRows)) failMismatch();
    const breaks = tableBreakMatrix(table, entry.logicalWidth);
    assertBridgedBreaks(breaks, bridgedBreaks?.[tableIndex]);
  }
  auditDocumentFootnoteReferences(document, tables, packageStructure);
  assertRichProjection(tables, entries, richProjection, {
    transformed: false,
    documentRelationships: packageStructure.documentRelationships,
    footnoteIds: packageStructure.footnoteIds,
  });

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const entry = entries[tableIndex];
    if (entry.titleRow) applyTitleMerge(tables[tableIndex], entry.logicalWidth);
    applyBorders(tables[tableIndex], entry);
  }

  const nextEntries = { ...originalEntries };
  nextEntries[packageStructure.documentName] = strToU8(
    new XMLSerializer().serializeToString(document),
  );
  let repacked;
  try {
    repacked = Buffer.from(zipSync(nextEntries, { level: 6 }));
  } catch {
    failMismatch();
  }
  const reopened = packageEntries(repacked);
  if (JSON.stringify(Object.keys(reopened).sort()) !== JSON.stringify(originalNames)) failMismatch();
  for (const [name, digest] of Object.entries(originalHashes)) {
    if (crypto.createHash('sha256').update(reopened[name]).digest('hex') !== digest) failMismatch();
  }
  inspectOfficeDocxPresentation(repacked, prepared, {
    bridgedBreaks, richProjection, footnoteBodies,
  });
  return repacked;
}

/** Shared dormant Markdown→JSON→DOCX builder with trusted constant conversions. */
function createOfficeDocxBuilder({
  getPandocPath,
  temporaryRoot = os.tmpdir(),
  pandocTimeoutMs = 30_000,
  pandocKillGraceMs = 1_000,
  processGroupRegistry = null,
} = {}) {
  if (typeof getPandocPath !== 'function') throw new TypeError('getPandocPath is required');
  return Object.freeze({
    async build(prepared, options = {}) {
      const pandocPath = getPandocPath();
      if (typeof pandocPath !== 'string' || !pandocPath || !fs.existsSync(pandocPath)) {
        throw new Error('Pandoc not found in bundle');
      }
      const temporaryDirectory = fs.mkdtempSync(path.join(temporaryRoot, 'fusion-office-docx-'));
      const nonce = crypto.randomBytes(6).toString('hex');
      const markdownPath = path.join(temporaryDirectory, `input-${nonce}.md`);
      const astPath = path.join(temporaryDirectory, `pandoc-${nonce}.json`);
      const bridgedPath = path.join(temporaryDirectory, `bridged-${nonce}.json`);
      const docxPath = path.join(temporaryDirectory, `pandoc-${nonce}.docx`);
      const runOptions = {
        timeoutMs: pandocTimeoutMs,
        killGraceMs: pandocKillGraceMs,
        processGroupRegistry,
      };
      try {
        fs.writeFileSync(markdownPath, prepared.bodyMarkdown, { encoding: 'utf8', mode: 0o600 });
        await runTrustedPandoc(pandocPath, markdownPath, astPath, {
          ...runOptions,
          conversion: 'gfm-json',
        });
        let ast;
        try {
          ast = JSON.parse(fs.readFileSync(astPath, 'utf8'));
        } catch {
          failMismatch();
        }
        const bridged = await bridgePandocTableBreaks(ast, prepared);
        fs.writeFileSync(bridgedPath, JSON.stringify(bridged.ast), { encoding: 'utf8', mode: 0o600 });
        await runTrustedPandoc(pandocPath, bridgedPath, docxPath, {
          ...runOptions,
          conversion: 'json-docx',
        });
        const original = fs.readFileSync(docxPath);
        const buffer = transformOfficeDocxPresentation(original, prepared, bridged);
        return Object.freeze(options.includeDiagnostics
          ? {
            buffer,
            original,
            bridgedBreaks: bridged.bridgedBreaks,
            richProjection: bridged.richProjection,
            footnoteBodies: bridged.footnoteBodies,
          }
          : { buffer });
      } finally {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
      }
    },
  });
}

module.exports = {
  BORDER_NAMES,
  BORDER_SIZES,
  DOCUMENT_PATH,
  TABLE_PROPERTY_NAMES,
  WORD_NS,
  createOfficeDocxBuilder,
  inspectOfficeDocxPresentation,
  transformOfficeDocxPresentation,
};
