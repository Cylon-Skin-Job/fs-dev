/**
 * @module transcription/cleanup-list-pass
 * @role Extracted deterministic transcription cleanup pass helpers.
 */

const {
  escapeRegExp,
  equalsAny,
  sentenceCleanup,
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
} = require('./cleanup-utils');

function hasWeakListEvidence(text, lists, thresholds) {
  const numberMarkers = findNumberMarkers(text, lists.numberMarkers || {});
  const transitionMatches = findTransitionMatches(text, thresholds);

  if (numberMarkers.length >= 1 && transitionMatches.length >= 1) return true;
  if (transitionMatches.length >= 2) return true;
  if (numberMarkers.length >= 2) return true;
  return false;
}

function hasSoftListEvidence(text, thresholds) {
  return findTransitionMatches(text, thresholds).length > 3;
}

function findSoftCategoryStart(text, lists, thresholds) {
  const config = lists.softCategoryStart || {};
  const categories = config.categoryMarkers || [];
  const completions = config.completionMarkers || [];
  const maxWordsBetween = Number(config.maxWordsBetweenCategoryAndCompletion || 8);
  const source = String(text || '');

  for (const category of categories) {
    const categoryMatch = findPhrase(source, [category]);
    if (!categoryMatch) continue;

    const afterCategory = source.slice(categoryMatch.end);
    const completionMatch = findPhrase(afterCategory, completions);
    if (!completionMatch) continue;

    const between = afterCategory.slice(0, completionMatch.index);
    if (countWords(between) > maxWordsBetween) continue;

    const end = categoryMatch.end + completionMatch.end;
    if (!hasSoftListEvidence(source.slice(end), thresholds)) continue;
    return { phrase: source.slice(categoryMatch.index, end), index: categoryMatch.index, end };
  }

  return null;
}

function findTransitionMatches(text, thresholds) {
  const config = thresholds?.forgottenListEnd || {};
  const transitionEntries = getTransitionEntries(config);
  const transitionMatches = [];
  let remaining = String(text || '');
  let offset = 0;

  while (remaining) {
    const transition = findTransition(remaining, transitionEntries, 0);
    if (!transition) break;
    transitionMatches.push({ ...transition, index: offset + transition.index });
    offset += transition.index + transition.phraseText.length;
    remaining = remaining.slice(transition.index + transition.phraseText.length);
  }

  return transitionMatches;
}

function buildNumberMarkerMap(numberMarkers) {
  const entries = [];
  for (const [number, markers] of Object.entries(numberMarkers || {})) {
    for (const marker of markers) {
      entries.push({ number, marker });
    }
  }
  return entries.sort((a, b) => String(b.marker).length - String(a.marker).length);
}

function findNumberMarkers(text, numberMarkers) {
  const entries = buildNumberMarkerMap(numberMarkers);
  const found = [];
  for (const entry of entries) {
    const pattern = new RegExp(`\\b${escapeRegExp(entry.marker)}\\b`, 'gi');
    let match;
    while ((match = pattern.exec(text))) {
      if (/^(?:to|too)$/i.test(entry.marker) && /\b(?:is|need|needs|needed|have|has|had|got)\s+$/i.test(text.slice(0, match.index))) continue;
      found.push({ number: Number(entry.number), marker: match[0], index: match.index, end: match.index + match[0].length });
    }
  }
  return found.sort((a, b) => a.index - b.index).filter((marker, index, all) => {
    return !all.some((other, otherIndex) => otherIndex !== index && other.index <= marker.index && other.end >= marker.end && String(other.marker).length > String(marker.marker).length);
  });
}

function boundaryLooksLikeItemStart(text, index) {
  const before = text.slice(0, index);
  return !before.trim() || /(?:^|[.!?;:]|\n)\s*$/.test(before) || /,\s*$/.test(before);
}

function looksLikeTaskStart(text, thresholds, lists) {
  const cleaned = removeItemTransitionMarker(String(text || '').replace(/^[,.;:\s]+/, ''));
  if (!cleaned) return false;
  const config = thresholds?.forgottenListEnd || {};
  const continuationPhrases = [
    ...(config.itemTransitionMarkers || []),
    ...(config.transitionPhrases || []),
    ...Object.values(lists.numberMarkers || {}).flat(),
  ];
  if (startsWithAnyPhrase(cleaned, continuationPhrases)) return true;
  if (startsWithActionVerb(cleaned, config.actionVerbs || [])) return true;
  return /^(?:we|you)\s+(?:need|have|got)\s+to\b/i.test(cleaned);
}

function findRiskyHomophoneMarkers(text, riskyHomophoneMarkers, selectedMarkers, thresholds, lists) {
  const found = [];
  const selectedNumbers = new Set(selectedMarkers.map((marker) => marker.number));
  for (const [numberText, markers] of Object.entries(riskyHomophoneMarkers || {})) {
    const number = Number(numberText);
    if (!selectedNumbers.has(number - 1) || selectedNumbers.has(number)) continue;

    for (const marker of markers || []) {
      const pattern = new RegExp(`\\b${escapeRegExp(marker)}\\b`, 'gi');
      let match;
      while ((match = pattern.exec(text))) {
        if (!boundaryLooksLikeItemStart(text, match.index)) continue;
        if (!looksLikeTaskStart(text.slice(match.index + match[0].length), thresholds, lists)) continue;
        found.push({ number, marker: match[0], index: match.index, end: match.index + match[0].length, riskyHomophone: true });
      }
    }
  }
  return found;
}

function formatContinuationItems(content, startNumber, thresholds) {
  const config = thresholds?.forgottenListEnd || {};
  const transitionEntries = getTransitionEntries(config);
  const lines = [];
  let trailing = '';
  let itemNumber = startNumber;
  let remaining = content;

  while (remaining) {
    const transition = findTransition(remaining, transitionEntries);
    if (!transition) {
      const itemText = normalizeListItemContent(stripEdgePunctuation(removeItemTransitionMarker(remaining)));
      for (const itemContent of splitCommaTaskSegments(itemText, config)) {
        if (shouldKeepListItemContent(itemContent, config)) {
          lines.push(`${itemNumber}. ${ensureTerminalPeriod(capitalizeFirstWord(itemContent))}`);
          itemNumber += 1;
        }
      }
      break;
    }

    const before = removeTrailingTransitionPhrase(remaining.slice(0, transition.index).trim(), config);
    const closingInBefore = findPhrase(before, config.listClosingOpeners || []);
    if (closingInBefore) {
      const beforeClosing = normalizeListItemContent(stripEdgePunctuation(before.slice(0, closingInBefore.index)));
      if (beforeClosing) lines.push(`${itemNumber}. ${ensureTerminalPeriod(capitalizeFirstWord(beforeClosing))}`);
      const closingText = `${before.slice(closingInBefore.index)} ${remaining.slice(transition.index)}`.trim();
      trailing = sentenceCleanup(normalizeParagraphTransition(closingText));
      break;
    }

    if (before) {
      const beforeItem = normalizeListItemContent(stripEdgePunctuation(before));
      for (const itemContent of splitCommaTaskSegments(beforeItem, config)) {
        if (shouldKeepListItemContent(itemContent, config) && !isCueOnlyListFragment(itemContent)) {
          lines.push(`${itemNumber}. ${ensureTerminalPeriod(capitalizeFirstWord(itemContent))}`);
          itemNumber += 1;
        }
      }
    }

    const nextRemaining = removeItemTransitionMarker(remaining.slice(transition.index));
    if (startsWithAnyPhrase(nextRemaining, config.listClosingOpeners || [])) {
      trailing = sentenceCleanup(nextRemaining);
      break;
    }

    remaining = nextRemaining;
  }

  return { lines, trailing };
}

function formatListSegment(prefix, listText, suffix, lists, thresholds) {
  const config = thresholds?.forgottenListEnd || {};
  const existingNumbered = [...listText.matchAll(/(?:^|\s)(\d+)\.\s+/g)]
    .map((match) => ({ number: Number(match[1]), index: match.index + match[0].indexOf(match[1]), end: match.index + match[0].length }));
  const existingSequential = selectSequentialMarkers(existingNumbered);
  if (existingSequential.length >= 2) {
    const introText = sentenceCleanup(stripEdgePunctuation(prefix)).replace(/\bso$/i, '').trim();
    const intro = introText ? introText.replace(/[.?!:;]?$/, ':') : '';
    const lines = [];
    for (let i = 0; i < existingSequential.length; i++) {
      const current = existingSequential[i];
      const next = existingSequential[i + 1];
      const content = normalizeListItemContent(removeTrailingFinalMarker(stripEdgePunctuation(listText.slice(current.end, next ? next.index : listText.length)), config));
      for (const itemContent of splitListItemContent(content, current.number + 1, lists, config)) {
        if (shouldKeepListItemContent(itemContent, config)) lines.push(`${lines.length + 1}. ${sentenceCleanup(itemContent).replace(/[.?!]?$/, '.')}`);
      }
    }
    const trailing = sentenceCleanup(suffix);
    if (lines.length >= 2) return joinListWithTrailingParagraph(intro, lines, trailing);
  }

  let markers = selectSequentialMarkers(findNumberMarkers(listText, lists.numberMarkers));
  const riskyMarkers = findRiskyHomophoneMarkers(listText, lists.riskyHomophoneMarkers, markers, thresholds, lists);
  if (riskyMarkers.length > 0) {
    markers = selectSequentialMarkers([...markers, ...riskyMarkers].sort((a, b) => a.index - b.index));
  }
  if (markers.length < 2) {
    if (!thresholds) return null;
    const marker = markers[0];
    const content = marker ? listText.slice(marker.end) : listText;
    const continuation = formatContinuationItems(content, 1, thresholds);
    const lines = continuation.lines;
    if (lines.length < 2) return null;
    const introText = sentenceCleanup(stripEdgePunctuation(prefix)).replace(/\bso$/i, '').trim();
    const intro = introText ? introText.replace(/[.?!:;]?$/, ':') : '';
    const trailing = [continuation.trailing, sentenceCleanup(suffix)].filter(Boolean).join(' ');
    return joinListWithTrailingParagraph(intro, lines, trailing);
  }

  const items = [];
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const next = markers[i + 1];
    const content = normalizeListItemContent(stripEdgePunctuation(listText.slice(current.end, next ? next.index : listText.length)));
    if (!content) continue;
    items.push({ number: items.length + 1, content: sentenceCleanup(content).replace(/[.?!]?$/, '.') });
  }

  if (items.length < 2) return null;

  const introText = sentenceCleanup(stripEdgePunctuation(prefix)).replace(/\bso$/i, '').trim();
  const intro = introText ? introText.replace(/[.?!:;]?$/, ':') : '';
  const lines = items.map((item) => `${item.number}. ${item.content}`);
  const trailing = sentenceCleanup(suffix);
  return joinListWithTrailingParagraph(intro, lines, trailing);
}

function joinListWithTrailingParagraph(intro, lines, trailing) {
  const listBlock = [intro, ...lines].filter(Boolean).join('\n');
  return trailing ? `${listBlock}\n\n${trailing}` : listBlock;
}

function splitEmbeddedOrdinalItem(content, expectedNumber, lists) {
  const markers = findNumberMarkers(content, lists.numberMarkers || {})
    .filter((marker) => marker.number === expectedNumber && marker.index > 0)
    .sort((a, b) => a.index - b.index);
  const marker = markers[0];
  if (!marker) return [content];

  const before = normalizeListItemContent(stripEdgePunctuation(content.slice(0, marker.index)));
  const after = normalizeListItemContent(stripEdgePunctuation(content.slice(marker.end)));
  return [before, after].filter(Boolean);
}

function splitListItemContent(content, expectedNumber, lists, config) {
  return splitEmbeddedOrdinalItem(content, expectedNumber, lists)
    .flatMap((item) => splitCommaTaskSegments(item, config));
}

function splitCommaTaskSegments(content, config) {
  const parts = normalizeCommaTransitionSegments(String(content || ''), config);
  if (parts.length < 2) return [content];
  if (!parts.every((part) => startsWithActionVerb(part, config.actionVerbs || []))) return [content];
  return parts;
}

function normalizeCommaTransitionSegments(content, config) {
  const parts = content.split(/,\s+/).map((part) => stripEdgePunctuation(part)).filter(Boolean);
  for (let index = 0; index < parts.length - 1; index++) {
    const suffixStripped = removeTrailingTransitionPhrase(parts[index], config);
    const prefixStripped = removeItemTransitionMarker(parts[index + 1]);
    if (suffixStripped !== parts[index] && prefixStripped !== parts[index + 1]) {
      parts[index] = suffixStripped;
      parts[index + 1] = prefixStripped;
    }
  }
  return parts.filter(Boolean);
}

function removeTrailingTransitionPhrase(text, config) {
  let output = stripEdgePunctuation(text);
  const entries = getTransitionEntries(config)
    .filter((entry) => entry.type === 'item')
    .sort((a, b) => b.phraseText.length - a.phraseText.length);
  for (const entry of entries) {
    const pattern = new RegExp(`\\b${escapeRegExp(entry.phraseText)}$`, 'i');
    if (pattern.test(output)) return stripEdgePunctuation(output.replace(pattern, ''));
  }
  return output;
}

function shouldKeepListItemContent(content, config) {
  return Boolean(content) && !isVacuousListItemContent(content) && !isTransitionOnlyListFragment(content, config);
}

function selectSequentialMarkers(markers) {
  const selected = [];
  let expected = 1;

  for (const marker of markers) {
    if (marker.number !== expected) continue;
    selected.push(marker);
    expected += 1;
  }

  return selected;
}

function applyListRules(text, lists, thresholds) {
  let start = findPhrase(text, lists.startMarkers || []);
  let preserveStartAsIntro = /(?:task|todo|punch|completion|final)\s+list|(?:last|remaining)\s+(?:items|tickets|issues)|last\s+(?:few|remaining)\s+(?:tickets|issues)/i.test(String(start?.phrase || ''));
  if (start && /\blist\b/i.test(String(start.phrase || ''))) preserveStartAsIntro = true;
  if (!start) {
    const colonList = String(text || '').match(/\b(?:(?:we|you|i)\s+)?(?:need|needs|needed|have|has|had|got)\s+to\s*:\s*(?=\d+\.\s+)/i);
    if (colonList) {
      start = { phrase: colonList[0], index: colonList.index, end: colonList.index + colonList[0].length };
      preserveStartAsIntro = true;
    }
  }
  if (!start) {
    const letsList = String(text || '').match(/\blet(?:'|’)s\s*:\s*(?=\d+\.\s+)/i);
    if (letsList) {
      start = { phrase: letsList[0], index: letsList.index, end: letsList.index + letsList[0].length };
      preserveStartAsIntro = true;
    }
  }
  if (!start) {
    const weakStart = findPhrase(text, lists.weakStartMarkers || []);
    if (weakStart && hasWeakListEvidence(text.slice(weakStart.end), lists, thresholds)) {
      start = weakStart;
      preserveStartAsIntro = true;
    }
  }
  if (!start) {
    const softStart = findPhrase(text, lists.softStartMarkers || []);
    if (softStart && hasSoftListEvidence(text.slice(softStart.end), thresholds)) {
      start = softStart;
      preserveStartAsIntro = true;
    }
  }
  if (!start) {
    const softCategoryStart = findSoftCategoryStart(text, lists, thresholds);
    if (softCategoryStart) {
      start = softCategoryStart;
      preserveStartAsIntro = true;
    }
  }
  if (!start) {
    const statusExample = formatStatusExampleList(text, lists);
    if (statusExample) return { text: statusExample, changes: [{ type: 'list-format', original: text, replacement: statusExample }] };
    return { text, changes: [] };
  }

  let beforeStart = preserveStartAsIntro
    ? text.slice(0, start.end).trim()
    : text.slice(0, start.index).trim();
  let afterStart = text.slice(start.end).trim();
  const continuation = extractListTriggerContinuation(afterStart, lists);
  if (continuation && /\blist\b/i.test(String(start.phrase || ''))) {
    beforeStart = `${beforeStart} ${continuation.text}`.trim();
    afterStart = continuation.remaining;
  }
  const end = findPhrase(afterStart, lists.endMarkers || []);
  const listText = end ? afterStart.slice(0, end.index).trim() : afterStart;
  const suffix = end ? afterStart.slice(end.end).trim() : '';
  const formatted = formatListSegment(beforeStart, listText, suffix, lists, thresholds);
  if (!formatted) return { text, changes: [] };
  return { text: formatted, changes: [{ type: 'list-format', original: text, replacement: formatted }] };
}

function regexAlternates(values) {
  return values.map((entry) => escapeRegExp(entry).replace(/\s+/g, '\\s+')).join('|');
}

function formatStatusExampleList(text, lists = {}) {
  const config = lists.statusSegments || {};
  const introMarkers = config.introMarkers || [];
  const statusPhrases = config.statusPhrases || [];
  const minimumSegments = Number(config.minimumSegments || 2);
  if (!introMarkers.length || !statusPhrases.length) return null;

  const source = String(text || '');
  const intro = findPhrase(source, introMarkers);
  if (!intro) return null;

  const beforeIntro = source.slice(0, intro.index).trim();
  const afterIntro = source.slice(intro.end).replace(/^[,.;:\s]+/, '').trim();
  const segments = splitStatusSegments(afterIntro, statusPhrases);
  if (segments.length < minimumSegments) return null;

  const introText = sentenceCleanup(source.slice(intro.index, intro.end)).replace(/[.?!:;]?$/, ':');
  const lines = segments.map((segment, index) => `${index + 1}. ${ensureTerminalPeriod(sentenceCleanup(segment))}`);
  return [beforeIntro, [introText, ...lines].join('\n')].filter(Boolean).join('\n\n');
}

function splitStatusSegments(text, statusPhrases) {
  return String(text || '')
    .split(/,\s+(?:and\s+)?/i)
    .map((segment) => stripEdgePunctuation(segment.replace(/^and\s+/i, '')))
    .filter((segment) => segment && hasStatusPhrase(segment, statusPhrases));
}

function hasStatusPhrase(segment, statusPhrases) {
  const normalized = segment.toLowerCase();
  return statusPhrases.some((phrase) => new RegExp(`\\b${escapeRegExp(String(phrase).toLowerCase())}\\b`, 'i').test(normalized));
}

function extractListTriggerContinuation(text, lists = {}) {
  const source = String(text || '').trim().replace(/^[,.;:\s]+/, '');
  const completionRules = lists.continuationCompletions || {};
  const relations = lists.continuationRelations || ['of', 'with', 'containing', 'including', 'that includes', 'that include', 'for', 'about', 'around', 'covering', 'related to', 'made up of', 'composed of', 'consisting of', 'comprising', 'focused on'];
  const bucketTerms = completionRules.bucketTerms || ['things', 'items', 'tasks', 'issues', 'tickets', 'work', 'action items', 'todos', 'to-dos'];
  const whatNeedsPatterns = completionRules.whatNeedsPatterns || ['what needs to be completed', 'what need to be completed', 'what needs to be complete', 'what need to be complete', 'what needs to be done', 'what need to be done', 'what needs to be finished', 'what need to be finished', 'what needs to get done', 'what need to get done', 'what needs to get finished', 'what need to get finished', 'what we need to do', 'what you need to do'];
  const descriptorWords = completionRules.descriptorWords || ['that', 'we', 'you', 'still', 'are', 'is', 'remain', 'remains', 'need', 'needs', 'to', 'be', 'completed', 'complete', 'done', 'finished', 'unfinished', 'undone', 'remaining', 'left', 'get', 'do', 'handle', 'finish', 'wrap', 'up', 'have', 'not', 'been', "haven't"];
  const firstItemStarts = completionRules.firstItemStarts || ['we need to', 'you need to', 'we have to', 'you have to', 'we got to', 'you got to', "we're going to need to", 'we are going to need to', "we're going to have to", 'we are going to have to', 'i want to', 'file', 'push', 'finish', 'complete', 'submit', 'create', 'open', 'deploy', 'then', 'after that'];
  const relation = `(?:${regexAlternates(relations)})`;
  const bucket = `(?:(?:the|our|all|a few|some)\\s+)?(?:${regexAlternates(bucketTerms)})`;
  const whatNeeds = `(?:${regexAlternates(whatNeedsPatterns)})`;
  const descriptor = `(?:\\s+(?:${regexAlternates(descriptorWords)})){0,14}?`;
  const nextItem = `(?=(?:[.!?]\\s*)?(?:${regexAlternates(firstItemStarts)})\\b)`;
  const match = source.match(new RegExp(`^(${relation}\\s+(?:${bucket}${descriptor}|${whatNeeds}))[.!?\\s]+${nextItem}`, 'i'));
  if (!match) return null;
  return {
    text: match[1].trim(),
    remaining: source.slice(match[0].length).replace(/^[.!?\s]+/, '').trim(),
  };
}
function detectForgottenListEnd(text, thresholds) {
  const config = thresholds.forgottenListEnd || {};
  if (!config.enabled || !/^\s*1\./m.test(text)) return false;
  const itemMatches = [...text.matchAll(/^\s*\d+\.\s+(.+)$/gm)].map((match) => match[1].trim());
  if (itemMatches.length < 2) return false;
  const last = itemMatches[itemMatches.length - 1];
  const priorMax = Math.max(...itemMatches.slice(0, -1).map((item) => item.length));
  const tooLong = priorMax > 0 && last.length > priorMax * Number(config.lastItemLengthMultiplier || 2);
  const hasTransition = getTransitionEntries(config).some((entry) => last.toLowerCase().includes(entry.phraseText));
  return tooLong && hasTransition;
}

function removeItemTransitionMarker(text) {
  return String(text || '')
    .trim()
    .replace(/^and\s+then\s+/i, '')
    .replace(/^and\s+the\s+/i, '')
    .replace(/^then\s+/i, '')
    .replace(/^so\s+(?:we're|we\s+are)\s+going\s+to\s+need\s+to\s+/i, '')
    .replace(/^(?:we're|we\s+are)\s+going\s+to\s+need\s+to\s+/i, '')
    .replace(/^(?:we're|we\s+are)\s+going\s+to\s+have\s+to\s+/i, '')
    .replace(/^we\s+need\s+to\s+/i, '')
    .replace(/^need\s+to\s+/i, '')
    .replace(/^you\s+need\s+to\s+/i, '')
    .replace(/^we\s+have\s+to\s+/i, '')
    .replace(/^you\s+have\s+to\s+/i, '')
    .replace(/^we\s+have\s+got\s+to\s+/i, '')
    .replace(/^you\s+have\s+got\s+to\s+/i, '')
    .replace(/^we\s+got\s+to\s+/i, '')
    .replace(/^you\s+got\s+to\s+/i, '')
    .replace(/^(?:we|you)(?:'ll|\s+will)\s+/i, '')
    .replace(/^get\s+started\s+on\s+/i, '')
    .replace(/^begin\s+with\s+/i, '')
    .replace(/^continue\s+(?:on\s+)?with\s+/i, '')
    .replace(/^contiune\s+on\s+with\s+/i, '')
    .replace(/^after\s+that\s+/i, '')
    .replace(/^next\s+up\s+/i, '')
    .replace(/^next\s+/i, '')
    .replace(/^afterwards\s+/i, '')
    .replace(/^once\s+that\s+is\s+done\s+/i, '')
    .replace(/^when\s+that's\s+(?:done|finished)\s+/i, '')
    .replace(/^from\s+there\s+/i, '')
    .replace(/^following\s+that\s+/i, '')
    .replace(/^followed\s+by\s+/i, '')
    .replace(/^and\s+finally,?\s+/i, '')
    .replace(/^then\s+finally,?\s+/i, '')
    .replace(/^finally,?\s+/i, '')
    .replace(/^lastly,?\s+/i, '')
    .trim();
}

function normalizeListItemContent(text) {
  return String(text || '')
    .trim()
    .replace(/^to\s+/i, '')
    .replace(/^i\s+want\s+to\s+/i, '')
    .replace(/^so\s+(?:we're|we\s+are)\s+going\s+to\s+need\s+to\s+/i, '')
    .replace(/^(?:we're|we\s+are)\s+going\s+to\s+need\s+to\s+/i, '')
    .replace(/^(?:we're|we\s+are)\s+going\s+to\s+have\s+to\s+/i, '')
    .replace(/^(?:we|you)\s+need\s+to\s+/i, '')
    .replace(/^we\s+can\s+/i, '')
    .replace(/^(?:we|you)\s+have\s+to\s+/i, '')
    .replace(/^(?:we|you)\s+have\s+got\s+to\s+/i, '')
    .replace(/^(?:we|you)\s+got\s+to\s+/i, '')
    .replace(/^(?:we|you)(?:'ll|\s+will)\s+/i, '')
    .replace(/^get\s+started\s+on\s+/i, '')
    .replace(/^begin\s+with\s+/i, '')
    .replace(/^continue\s+(?:on\s+)?with\s+/i, '')
    .replace(/^contiune\s+on\s+with\s+/i, '')
    .trim();
}

function isCueOnlyListFragment(text) {
  return /^(?:so|okay|ok|all right|alright)[,.!?;:\s]*$/i.test(String(text || '').trim());
}

function isTransitionOnlyListFragment(text, config = {}) {
  const stripped = stripEdgePunctuation(String(text || '').trim());
  const normalized = stripped.toLowerCase();
  const transitionOnly = getTransitionEntries(config).some((entry) => normalized === entry.phraseText);
  return Boolean(stripped) && (transitionOnly || !removeItemTransitionMarker(stripped));
}

function isVacuousListItemContent(text) {
  return /^(?:of\s+)?(?:things|items|tasks)(?:\s+to\s+do|\s+that\s+need\s+to\s+be\s+done)?[.!?\s]*$/i.test(String(text || '').trim());
}

function removeTrailingFinalMarker(text, config) {
  let output = String(text || '').trim();
  const markers = [...(config.finalParagraphMarkers || [])]
    .filter(Boolean)
    .sort((a, b) => String(b).length - String(a).length);

  for (const marker of markers) {
    output = output.replace(new RegExp(`(?:^|[\\s.!?;:]+)${escapeRegExp(marker)}[,.;:!?\\s]*$`, 'i'), '').trim();
  }

  return output;
}

function stripListItemScaffold(text, config) {
  let output = String(text || '').trim();
  const prefixes = [...(config.listItemScaffoldPrefixes || [])]
    .filter(Boolean)
    .sort((a, b) => String(b).length - String(a).length);

  for (const prefix of prefixes) {
    const pattern = new RegExp(`^${escapeRegExp(prefix)}\\b[,.;:\\s-]*`, 'i');
    if (pattern.test(output)) {
      output = output.replace(pattern, '').trim();
      break;
    }
  }

  const firstWord = output.match(/^([A-Za-z']+)/)?.[1] || '';
  const rewrite = (config.listItemGerundRewrites || {})[firstWord.toLowerCase()];
  if (rewrite) output = output.replace(/^([A-Za-z']+)/, rewrite);
  output = removeListItemDanglingEndings(output, config);
  output = removeDanglingAndSentence(output);
  return cleanupPunctuationCollisions(removeTrailingFinalMarker(output, config));
}

function removeDanglingAndSentence(text) {
  return String(text || '').replace(/(?:^|\s+)(?:and|then)[.!?]+\s*$/i, '').trim();
}

function removeListItemDanglingEndings(text, config) {
  let output = String(text || '').trim();
  const endings = [...(config.listItemDanglingEndings || [])]
    .filter(Boolean)
    .sort((a, b) => String(b).length - String(a).length);

  for (const ending of endings) {
    const pattern = new RegExp(`[,;:\\s]+${escapeRegExp(ending)}[,.;:!?\\s]*$`, 'i');
    output = output.replace(pattern, '').trim();
  }

  return output;
}

function normalizeStructuredListItems(text, thresholds) {
  const config = thresholds.forgottenListEnd || {};
  const changes = [];
  const output = String(text || '').split('\n').map((line) => {
    const match = line.match(/^(\s*\d+\.\s+)(.+)$/);
    if (!match) return cleanupPunctuationCollisions(line);

    const originalContent = match[2].trim();
    if (isTransitionOnlyListFragment(originalContent, config)) {
      changes.push({ type: 'list-item-normalize', original: originalContent, replacement: '' });
      return null;
    }
    const normalizedContent = ensureTerminalPeriod(capitalizeFirstWord(stripListItemScaffold(originalContent, config)));
    if (normalizedContent !== originalContent) {
      changes.push({ type: 'list-item-normalize', original: originalContent, replacement: normalizedContent });
    }
    return `${match[1]}${normalizedContent}`;
  }).filter((line) => line !== null).join('\n');

  return { text: output, changes };
}

function repairDanglingListContinuations(text) {
  const lines = String(text || '').split('\n');
  const changes = [];
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const block = [];
    while (index < lines.length) {
      const match = lines[index].match(/^\s*\d+\.\s+(.+)$/);
      if (!match) break;
      block.push(match[1].trim());
      index += 1;
    }

    if (block.length === 0) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const repaired = [];
    for (let itemIndex = 0; itemIndex < block.length; itemIndex++) {
      const current = block[itemIndex];
      const next = block[itemIndex + 1];
      const split = splitDanglingVerbContinuation(current, next);
      if (!split) {
        repaired.push(current);
        continue;
      }

      repaired.push(split.current, split.next);
      changes.push({ type: 'list-continuation-repair', original: `${current}\n${next}`, replacement: `${split.current}\n${split.next}` });
      itemIndex += 1;
    }

    output.push(...repaired.map((content, itemIndex) => `${itemIndex + 1}. ${content}`));
  }

  return { text: output.join('\n'), changes };
}

function splitDanglingVerbContinuation(current, next) {
  if (!next) return null;
  const match = String(current || '').match(/^(.+?)\s+and\s+(file|submit|open|create|finish|complete|push|deploy)[.!?]*$/i);
  if (!match) return null;
  if (!/^(?:the|our|all|remaining|rest\b|the\s+rest\b)/i.test(String(next || '').trim())) return null;

  return {
    current: ensureTerminalPeriod(stripEdgePunctuation(match[1])),
    next: ensureTerminalPeriod(capitalizeFirstWord(`${match[2]} ${lowerLeadingArticle(stripEdgePunctuation(next))}`)),
  };
}

function lowerLeadingArticle(text) {
  return String(text || '').replace(/^(The|Our|All|Remaining|Rest)\b/, (match) => match.toLowerCase());
}

function classifyTransitionAfter(marker, afterText, nextTransition, maxItemLength, config) {
  if (marker.type === 'paragraph') return 'paragraph';
  if (marker.type === 'final') return 'item';
  const itemText = removeItemTransitionMarker(afterText);
  if (!itemText) return 'paragraph';
  if (startsWithAnyPhrase(itemText, config.listClosingOpeners || [])) return 'paragraph';
  if (startsWithAnyPhrase(itemText, config.paragraphOpeners || [])) return 'paragraph';

  const candidate = nextTransition ? itemText.slice(0, nextTransition.index).trim() : itemText;
  if (nextTransition && nextTransition.index <= maxItemLength) return 'item';
  if (startsWithActionVerb(candidate, config.actionVerbs || []) && candidate.length <= maxItemLength) return 'item';
  return 'paragraph';
}

function getListItemNumber(prefix) {
  const match = String(prefix || '').match(/(\d+)\.\s*$/);
  return match ? Number(match[1]) : 1;
}

function splitForgottenListEnd(text, thresholds) {
  const changes = [];
  const config = thresholds.forgottenListEnd || {};
  if (!config.enabled || !detectForgottenListEnd(text, thresholds)) return { text, changes };

  const itemMatches = [...text.matchAll(/^(\s*\d+\.\s+)(.+)$/gm)];
  if (itemMatches.length < 2) return { text, changes };

  const lastMatch = itemMatches[itemMatches.length - 1];
  const fullLine = lastMatch[0];
  const prefix = lastMatch[1];
  const content = lastMatch[2].trim();
  const maxItemLength = Math.max(24, Math.round(Math.max(...itemMatches.slice(0, -1).map((match) => match[2].trim().length)) * Number(config.lastItemLengthMultiplier || 2)));
  const transitionEntries = getTransitionEntries(config);
  const split = findTransition(content, transitionEntries);
  if (!split) return { text, changes };

  let itemNumber = getListItemNumber(prefix);
  let remaining = content;
  const newLines = [];
  let paragraph = '';

  while (remaining) {
    const transition = findTransition(remaining, transitionEntries);
    if (!transition) {
      newLines.push(`${itemNumber}. ${ensureTerminalPeriod(capitalizeFirstWord(remaining))}`);
      break;
    }

    const before = remaining.slice(0, transition.index).trim();
    const afterWithMarker = remaining.slice(transition.index).trim();
    const afterAsItem = removeItemTransitionMarker(afterWithMarker);
    const nextTransition = findTransition(afterAsItem, transitionEntries);
    const classification = classifyTransitionAfter(transition, afterWithMarker, nextTransition, maxItemLength, config);

    if (before) {
      newLines.push(`${itemNumber}. ${ensureTerminalPeriod(capitalizeFirstWord(before))}`);
      itemNumber += 1;
    }

    if (classification === 'paragraph') {
      paragraph = ensureTerminalPeriod(normalizeParagraphTransition(afterWithMarker));
      break;
    }

    remaining = afterAsItem;
  }

  if (newLines.length < 1) return { text, changes };
  const replacement = paragraph ? `${newLines.join('\n')}\n\n${paragraph}` : newLines.join('\n');
  const output = `${text.slice(0, lastMatch.index)}${replacement}${text.slice(lastMatch.index + fullLine.length)}`;
  changes.push({
    type: 'list-boundary-split',
    original: fullLine,
    replacement,
    transitionPhrase: split.phrase,
  });
  return { text: output, changes };
}

module.exports = {
  applyListRules,
  splitForgottenListEnd,
  normalizeStructuredListItems,
  repairDanglingListContinuations,
  detectForgottenListEnd,
};
