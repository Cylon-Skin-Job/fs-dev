/**
 * @module transcription/cleanup-final-pass
 * @role Extracted deterministic transcription cleanup pass helpers.
 */

const {
  escapeRegExp,
  normalizeStandaloneI,
  stripEdgePunctuation,
  ensureTerminalPeriod,
  capitalizeFirstWord,
  findPhrase,
  getTransitionEntries,
  findTransition,
  countWords,
  normalizeParagraphTransition,
  startsWithAnyPhrase,
} = require('./cleanup-utils');

function finalTextPolish(text) {
  const lines = String(text || '').split('\n');
  return lines.map((line) => {
    const normalized = normalizeStandaloneI(line).trimEnd();
    if (!normalized.trim()) return normalized;
    if (/[.!?:]$/.test(normalized.trim())) return normalized;
    return `${normalized}${shouldEndAsQuestion(normalized) ? '?' : '.'}`;
  }).join('\n');
}

function shouldEndAsQuestion(text) {
  const content = String(text || '').replace(/^\s*\d+\.\s+/, '').trim().toLowerCase();
  return /^(?:who|what|when|where|why|how|which|whose|whom)\b/.test(content);
}

function splitLongListItems(text, thresholds) {
  const config = thresholds.forgottenListEnd?.finalListItemSplit || {};
  if (!config.enabled) return { text, changes: [] };

  const lines = String(text || '').split('\n');
  const changes = [];
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const block = [];
    while (index < lines.length) {
      const match = lines[index].match(/^\s*\d+\.\s+(.+)$/);
      if (!match) break;
      block.push({ line: lines[index], content: match[1].trim() });
      index += 1;
    }

    if (block.length === 0) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const splitBlock = splitListBlockOnLongConjunctions(block, config, changes);
    output.push(...splitBlock);
  }

  return { text: output.join('\n'), changes };
}

function splitClosingListParagraphs(text, thresholds) {
  const config = thresholds.forgottenListEnd || {};
  const lines = String(text || '').split('\n');
  const changes = [];
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const block = [];
    while (index < lines.length) {
      const match = lines[index].match(/^\s*\d+\.\s+(.+)$/);
      if (!match) break;
      block.push({ line: lines[index], content: match[1].trim() });
      index += 1;
    }

    if (block.length === 0) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const last = block[block.length - 1];
    const closing = findClosingParagraphSplit(last.content, config);
    if (closing && block.length > 1) {
      const listItems = closing.itemContent
        ? [...block.slice(0, -1).map((item) => item.content), closing.itemContent]
        : block.slice(0, -1).map((item) => item.content);
      output.push(...listItems.map((content, itemIndex) => `${itemIndex + 1}. ${content}`));
      output.push('', ensureTerminalPeriod(normalizeParagraphTransition(closing.paragraph)));
      changes.push({ type: 'list-closing-paragraph', original: last.content, replacement: closing.paragraph, transitionPhrase: closing.transitionPhrase });
      continue;
    }

    output.push(...block.map((item, itemIndex) => `${itemIndex + 1}. ${item.content}`));
  }

  return { text: output.join('\n'), changes };
}

function findClosingParagraphSplit(content, config) {
  if (startsWithAnyPhrase(content, config.listClosingOpeners || [])) {
    return {
      itemContent: '',
      paragraph: content,
      transitionPhrase: 'closing-opener',
    };
  }

  const transition = findTransition(content, getTransitionEntries(config), 0);
  if (transition) {
    const afterTransition = content.slice(transition.index + transition.phraseText.length);
    const closing = findPhrase(afterTransition, config.listClosingOpeners || []);
    if (closing) {
      return {
        itemContent: '',
        paragraph: content,
        transitionPhrase: transition.phraseText,
      };
    }
  }

  const trailingClosing = findTrailingClosingSentence(content, config);
  if (trailingClosing) return trailingClosing;

  const embeddedClosing = findEmbeddedClosingPhrase(content, config);
  if (embeddedClosing) return embeddedClosing;

  const trailingSentence = findTrailingSentence(content);
  if (trailingSentence) return trailingSentence;

  return null;
}

function findEmbeddedClosingPhrase(content, config) {
  const closing = findPhrase(content, config.listClosingOpeners || []);
  if (!closing || closing.index <= 0) return null;
  const itemContent = stripEdgePunctuation(String(content || '').slice(0, closing.index));
  const paragraph = String(content || '').slice(closing.index).trim();
  if (!itemContent || !paragraph) return null;

  return {
    itemContent: ensureTerminalPeriod(itemContent),
    paragraph,
    transitionPhrase: 'embedded-closing',
  };
}

function findTrailingSentence(content) {
  const match = String(content || '').match(/^(.+?[.!?])\s+(.+)$/);
  if (!match) return null;
  const itemContent = stripEdgePunctuation(match[1]);
  const paragraph = match[2].trim();
  if (!itemContent || !paragraph) return null;

  return {
    itemContent: ensureTerminalPeriod(itemContent),
    paragraph,
    transitionPhrase: 'sentence-boundary',
  };
}

function findTrailingClosingSentence(content, config) {
  const match = String(content || '').match(/^(.+?[.!?])\s+(.+)$/);
  if (!match) return null;
  const itemContent = stripEdgePunctuation(match[1]);
  const paragraph = match[2].trim();
  if (!itemContent || !startsWithAnyPhrase(paragraph, config.listClosingOpeners || [])) return null;

  return {
    itemContent: ensureTerminalPeriod(itemContent),
    paragraph,
    transitionPhrase: 'sentence-boundary',
  };
}

function splitListBlockOnLongConjunctions(block, config, changes) {
  const wordCounts = block.map((item) => countWords(item.content));
  const averageWords = wordCounts.reduce((sum, count) => sum + count, 0) / Math.max(1, wordCounts.length);
  const minBefore = Number(config.minWordsBeforeSeparator || 5);
  const minTotal = Number(config.minTotalWords || 11);
  const splitItems = [];

  for (const item of block) {
    const split = findLongConjunctionSplit(item.content, config, averageWords, minBefore, minTotal);
    if (!split) {
      splitItems.push(item.content);
      continue;
    }

    splitItems.push(split.before, split.after);
    changes.push({ type: 'list-item-split', original: item.content, replacement: `${split.before}\n${split.after}`, separator: split.separator });
  }

  return splitItems.map((content, itemIndex) => `${itemIndex + 1}. ${ensureTerminalPeriod(capitalizeFirstWord(stripEdgePunctuation(content)))}`);
}

function findLongConjunctionSplit(content, config, averageWords, minBefore, minTotal) {
  const separators = [...(config.separators || [])].filter(Boolean).sort((a, b) => String(b).length - String(a).length);
  const totalWords = countWords(content);
  if (totalWords < minTotal) return null;
  if (config.requireLongerThanAverage !== false && totalWords <= averageWords) return null;

  for (const separator of separators) {
    const pattern = new RegExp(`\\b${escapeRegExp(separator)}\\b`, 'gi');
    let match;
    while ((match = pattern.exec(content))) {
      const before = stripEdgePunctuation(content.slice(0, match.index));
      const after = stripEdgePunctuation(content.slice(match.index + match[0].length));
      if (countWords(before) < minBefore) continue;
      if (!after || startsWithAnyPhrase(after, config.listClosingOpeners || [])) continue;
      return { before, after, separator: match[0] };
    }
  }

  return null;
}

module.exports = {

  splitClosingListParagraphs,

  splitLongListItems,

  finalTextPolish,

};
