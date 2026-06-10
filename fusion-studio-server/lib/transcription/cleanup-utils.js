/**
 * @module transcription/cleanup-utils
 * @role Extracted deterministic transcription cleanup pass helpers.
 */

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPreviousWord(text, index) {
  const match = text.slice(0, index).match(/([A-Za-z']+)\s*$/);
  return match ? match[1] : '';
}

function getNextWord(text, index) {
  const match = text.slice(index).match(/^\s*([A-Za-z']+)/);
  return match ? match[1] : '';
}

function equalsAny(value, candidates = []) {
  const normalized = String(value || '').toLowerCase();
  return candidates.some((candidate) => normalized === String(candidate).toLowerCase());
}

function isWordLikeBoundary(char) {
  return !char || !/[A-Za-z0-9_]/.test(char);
}

function titleFirst(text) {
  return text.replace(/^\s*([a-z])/, (match, first) => match.replace(first, first.toUpperCase()));
}

function sentenceCleanup(text) {
  let output = String(text || '').replace(/\s+/g, ' ').trim();
  output = output.replace(/\s+([,.!?])/g, '$1');
  output = output.replace(/^[,.;:\s]+/, '');
  output = output.replace(/([.!?])([A-Za-z])/g, '$1 $2');
  output = normalizeStandaloneI(output);
  output = titleFirst(output);
  return output;
}

function normalizeStandaloneI(text) {
  return String(text || '').replace(/\bi\b/g, 'I');
}

function stripEdgePunctuation(text) {
  return String(text || '')
    .trim()
    .replace(/^[,.;:\s]+/, '')
    .replace(/[,.;:\s]+$/, '')
    .trim();
}

function cleanupPunctuationCollisions(text) {
  return String(text || '')
    .replace(/,\./g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/\.,/g, '.')
    .replace(/\.\./g, '.')
    .replace(/,\s*$/g, '.')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ensureTerminalPeriod(text) {
  const trimmed = String(text || '').trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function capitalizeFirstWord(text) {
  return String(text || '').trim().replace(/^([a-z])/, (match) => match.toUpperCase());
}

function findPhrase(text, phrases = []) {
  const lower = text.toLowerCase();
  let best = null;
  for (const phrase of phrases) {
    const phraseText = String(phrase).toLowerCase();
    const pattern = new RegExp(`\\b${escapeRegExp(phraseText)}\\b`, 'i');
    const match = lower.match(pattern);
    const index = match ? match.index : -1;
    if (index !== -1 && (!best || index < best.index || (index === best.index && String(phrase).length > String(best.phrase).length))) {
      best = { phrase, index, end: index + String(phrase).length };
    }
  }
  return best;
}

function uniqueEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.type}:${entry.phraseText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getTransitionEntries(config) {
  const entries = [];
  for (const phrase of config.itemTransitionMarkers || config.transitionPhrases || []) {
    if (phrase) entries.push({ type: 'item', phrase: String(phrase), phraseText: String(phrase).toLowerCase() });
  }
  for (const phrase of config.gatedItemSeparators || []) {
    if (phrase) entries.push({ type: 'gated-item', phrase: String(phrase), phraseText: String(phrase).toLowerCase() });
  }
  for (const phrase of config.paragraphTransitionMarkers || []) {
    if (phrase) entries.push({ type: 'paragraph', phrase: String(phrase), phraseText: String(phrase).toLowerCase() });
  }
  for (const phrase of config.finalParagraphMarkers || []) {
    if (phrase) entries.push({ type: 'final', phrase: String(phrase), phraseText: String(phrase).toLowerCase() });
  }
  for (const phrase of config.transitionPhrases || []) {
    if (phrase) entries.push({ type: 'item', phrase: String(phrase), phraseText: String(phrase).toLowerCase() });
  }
  return uniqueEntries(entries);
}

function findTransition(content, entries, minIndex = 1) {
  const lower = content.toLowerCase();
  let best = null;

  for (const entry of entries || []) {
    const pattern = new RegExp(`\\b${escapeRegExp(entry.phraseText)}\\b`, 'i');
    const match = lower.match(pattern);
    if (!match || match.index < minIndex) continue;

    if (!best || match.index < best.index || (match.index === best.index && entry.phraseText.length > best.phraseText.length)) {
      best = { ...entry, index: match.index };
    }
  }

  return best;
}

function countWords(text) {
  return (String(text || '').match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) || []).length;
}

function normalizeParagraphTransition(text) {
  return capitalizeFirstWord(String(text || '').trim().replace(/^and\s+/i, ''));
}

function startsWithAnyPhrase(text, phrases = []) {
  const normalized = normalizePhraseComparable(text);
  return phrases.some((phrase) => normalized.startsWith(normalizePhraseComparable(phrase)));
}

function normalizePhraseComparable(text) {
  return String(text || '').toLowerCase().replace(/[,.;:!?]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function startsWithActionVerb(text, verbs = []) {
  const firstWord = String(text || '').trim().match(/^([A-Za-z']+)/)?.[1] || '';
  return equalsAny(firstWord, verbs);
}

module.exports = {

  escapeRegExp,

  getPreviousWord,

  getNextWord,

  equalsAny,

  isWordLikeBoundary,

  titleFirst,

  sentenceCleanup,

  normalizeStandaloneI,

  stripEdgePunctuation,

  cleanupPunctuationCollisions,

  ensureTerminalPeriod,

  capitalizeFirstWord,

  findPhrase,

  getTransitionEntries,

  findTransition,

  countWords,

  normalizeParagraphTransition,

  startsWithAnyPhrase,

  startsWithActionVerb,

};
