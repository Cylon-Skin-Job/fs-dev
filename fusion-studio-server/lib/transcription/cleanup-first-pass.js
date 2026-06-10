/**
 * @module transcription/cleanup-first-pass
 * @role Extracted deterministic transcription cleanup pass helpers.
 */

const {
  escapeRegExp,
  getPreviousWord,
  getNextWord,
  equalsAny,
  isWordLikeBoundary,
  titleFirst,
  sentenceCleanup,
  stripEdgePunctuation,
  cleanupPunctuationCollisions,
  countWords,
} = require('./cleanup-utils');

function applyReplacementRules(text, rules) {
  const changes = [];
  let output = text;
  const enabledRules = [...(rules.rules || [])]
    .filter((rule) => rule.enabled !== false && rule.match)
    .sort((a, b) => String(b.match).length - String(a.match).length);

  for (const rule of enabledRules) {
    const flags = rule.caseSensitive ? 'g' : 'gi';
    const pattern = new RegExp(escapeRegExp(rule.match), flags);
    output = output.replace(pattern, (match, offset) => {
      if ((rule.wholeWord || rule.wholePhrase) && (!isWordLikeBoundary(output[offset - 1]) || !isWordLikeBoundary(output[offset + match.length]))) {
        return match;
      }

      const previousWord = getPreviousWord(output, offset);
      const nextWord = getNextWord(output, offset + match.length);
      if (equalsAny(previousWord, rule.unlessPrecededBy)) return match;
      if (equalsAny(nextWord, rule.unlessFollowedBy)) return match;
      if (rule.onlyWhenPrecededBy && !equalsAny(previousWord, rule.onlyWhenPrecededBy)) return match;
      if (rule.onlyWhenFollowedBy && !equalsAny(nextWord, rule.onlyWhenFollowedBy)) return match;

      changes.push({ type: 'replacement', ruleId: rule.id, original: match, replacement: rule.replace });
      return rule.replace;
    });
  }

  return { text: output, changes };
}

function removeAlwaysFillers(text, fillers) {
  const changes = [];
  let output = text;
  for (const filler of fillers.removeAlways || []) {
    const pattern = new RegExp(`\\b${escapeRegExp(filler)}\\b[,.]?\\s*`, 'gi');
    output = output.replace(pattern, (match) => {
      changes.push({ type: 'filler', original: match.trim(), replacement: '' });
      return '';
    });
  }
  return { text: output.replace(/\s+([,.!?])/g, '$1'), changes };
}

function applyContextualFillers(text, fillers) {
  const changes = [];
  let output = text;
  for (const rule of fillers.contextual || []) {
    if (rule.defaultAction !== 'remove') continue;
    const pattern = new RegExp(`\\b${escapeRegExp(rule.match)}\\b[,.]?\\s*`, rule.caseSensitive ? 'g' : 'gi');
    output = output.replace(pattern, (match, offset) => {
      const previousWord = getPreviousWord(output, offset);
      const nextWord = getNextWord(output, offset + match.length);
      if (equalsAny(previousWord, rule.preserveWhenPrecededBy)) return match;
      if (equalsAny(nextWord, rule.preserveWhenFollowedBy)) return match;

      changes.push({ type: 'contextual-filler', ruleId: rule.id, original: match.trim(), replacement: '' });
      return '';
    });
  }
  return { text: output.replace(/\s+([,.!?])/g, '$1'), changes };
}

function getAllCorrectionGates(correctionFlags) {
  return [
    ...(correctionFlags.mistakeIndicators || []),
    ...(correctionFlags.replacementIndicators || []),
    ...(correctionFlags.flags || []),
  ]
    .filter(Boolean)
    .sort((a, b) => String(b).length - String(a).length);
}

function findGate(text, gates = []) {
  let best = null;
  for (const gate of gates) {
    const pattern = new RegExp(`\\b${escapeRegExp(gate)}\\b`, 'i');
    const match = String(text || '').match(pattern);
    if (!match) continue;
    if (!best || match.index < best.index || (match.index === best.index && String(gate).length > best.gate.length)) {
      best = { gate: String(gate), index: match.index, end: match.index + match[0].length, match: match[0] };
    }
  }
  return best;
}

function sentenceBoundsAround(text, index) {
  const before = text.slice(0, index);
  const start = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n')) + 1;
  const after = text.slice(index);
  const stops = ['.', '!', '?', '\n'].map((stop) => after.indexOf(stop)).filter((pos) => pos !== -1);
  const end = stops.length > 0 ? index + Math.min(...stops) + 1 : text.length;
  return { start, end };
}

function nextSentenceEnd(text, start) {
  const after = text.slice(start);
  const stops = ['.', '!', '?', '\n'].map((stop) => after.indexOf(stop)).filter((pos) => pos !== -1);
  return stops.length > 0 ? start + Math.min(...stops) + 1 : text.length;
}

function cleanCorrectionFragment(text) {
  return stripEdgePunctuation(String(text || '')
    .replace(/,\s*(can|could|would|should)\s+we\b.*$/i, '')
    .replace(/,\s*(please|let's|do\s+we|what\s+happened)\b.*$/i, '')
    .replace(/^['"]|['"]$/g, ''));
}

function extractCorrectionContinuation(text) {
  const match = String(text || '').match(/,\s*((?:can|could|would|should)\s+we\b.*|(?:please|let's|do\s+we|what\s+happened)\b.*)$/i);
  return match ? sentenceCleanup(match[1]) : '';
}

function findReplacementIndicator(tail, correctionFlags) {
  return findGate(tail, correctionFlags.replacementIndicators || []);
}

function shouldBridgeWaitCorrection(gate, nextText, correctionFlags) {
  if (!/^(?:oh\s+wait|no\s+wait|wait)$/i.test(String(gate?.match || '').trim())) return false;
  return Boolean(findReplacementIndicator(nextText, correctionFlags));
}

function extractExplicitCorrection(tail) {
  const cleaned = stripEdgePunctuation(tail);
  const patterns = [
    { regex: /^(.+?),\s*not\s+(.+)$/i, order: ['to', 'from'] },
    { regex: /^not\s+(.+?),\s*(?:but\s+|rather\s+|instead\s+)?(.+)$/i, order: ['from', 'to'] },
    { regex: /^(.+?)\s+instead\s+of\s+(.+)$/i, order: ['to', 'from'] },
    { regex: /^(.+?)\s+rather\s+than\s+(.+)$/i, order: ['to', 'from'] },
    { regex: /^replace\s+(.+?)\s+with\s+(.+)$/i, order: ['from', 'to'] },
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern.regex);
    if (!match) continue;
    const values = {};
    values[pattern.order[0]] = cleanCorrectionFragment(match[1]);
    values[pattern.order[1]] = cleanCorrectionFragment(match[2]);
    if (values.from && values.to) return values;
  }

  return null;
}

function extractReplacementFromTail(tail, correctionFlags) {
  const explicit = extractExplicitCorrection(tail);
  if (explicit?.to) return explicit.to;

  const indicator = findReplacementIndicator(tail, correctionFlags);
  if (indicator) {
    return cleanCorrectionFragment(tail.slice(indicator.end));
  }

  const reset = findGate(tail, correctionFlags.strongResetIndicators || []);
  if (reset) {
    return cleanCorrectionFragment(tail.slice(reset.end));
  }

  return cleanCorrectionFragment(tail);
}

function trimCueNoiseBeforeGate(beforeGate, gateMatch) {
  if (/scratch that|strike that|delete that|ignore that|forget that/i.test(gateMatch)) {
    return beforeGate.replace(/\b(no|nope|nah),?\s*$/i, '');
  }
  return beforeGate;
}

function getDeterminerWords(correctionFlags) {
  const determiners = correctionFlags.determiners || {};
  return [
    ...(determiners.articles || []),
    ...(determiners.quantifiers || []),
    ...(determiners.demonstratives || []),
    ...(determiners.possessives || []),
    ...(determiners.ordinals || []),
  ].map((word) => String(word).toLowerCase());
}

function startsWithDeterminer(text, correctionFlags) {
  const first = String(text || '').trim().match(/^([A-Za-z']+)/)?.[1] || '';
  return getDeterminerWords(correctionFlags).includes(first.toLowerCase());
}

function findExactTargetBefore(before, target, replacement, correctionFlags) {
  if (!target) return null;
  const lowerBefore = before.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const index = lowerBefore.lastIndexOf(lowerTarget);
  if (index === -1) return null;

  let start = index;
  const prefix = before.slice(0, index);
  const priorDeterminer = prefix.match(/\b(a|an|the|any|all|every|each|some|my|your|his|her|its|our|their)\s+$/i);
  if (priorDeterminer && startsWithDeterminer(replacement, correctionFlags)) {
    start = index - priorDeterminer[0].length;
  }

  return { start, end: index + target.length, target: before.slice(start, index + target.length) };
}

function findFallbackTargetBefore(before, replacement, correctionFlags) {
  const trailing = before.match(/[,.;:\s]*$/)?.[0] || '';
  const effectiveEnd = before.length - trailing.length;
  const effective = before.slice(0, effectiveEnd);
  if (!effective.trim()) return null;

  const boundaryIndexes = [',', '.', '!', '?', '\n']
    .map((mark) => effective.lastIndexOf(mark))
    .filter((index) => index !== -1)
    .sort((a, b) => b - a);
  let start = (boundaryIndexes[0] ?? -1) + 1;
  if (!effective.slice(start).trim() && boundaryIndexes.length > 1) {
    start = boundaryIndexes[1] + 1;
  }

  let segmentEnd = effectiveEnd;
  if (!effective.slice(start).trim() && boundaryIndexes.length > 0) {
    segmentEnd = boundaryIndexes[0];
    const earlier = effective.slice(0, segmentEnd);
    start = Math.max(earlier.lastIndexOf(','), earlier.lastIndexOf('.'), earlier.lastIndexOf('!'), earlier.lastIndexOf('?'), earlier.lastIndexOf('\n')) + 1;
  }

  const segment = before.slice(start, segmentEnd);
  const segmentOffset = start;
  const determinerPhrase = '(?:a|an|the|any(?:\\s+of(?:\\s+the)?)?|all(?:\\s+of(?:\\s+the)?)?|every|each|some(?:\\s+of(?:\\s+the)?)?|no|both|either|neither|many(?:\\s+of(?:\\s+the)?)?|much|few(?:\\s+of(?:\\s+the)?)?|several|various|multiple|another|this|that|these|those)';

  if (startsWithDeterminer(replacement, correctionFlags)) {
    const trailingDeterminerPhrase = [...segment.matchAll(new RegExp(`\\b${determinerPhrase}\\s+[^,.;!?]+$`, 'gi'))].pop();
    if (trailingDeterminerPhrase) {
      start = segmentOffset + trailingDeterminerPhrase.index;
    } else {
      const prepositionMatch = [...segment.matchAll(/\b(of|for|to|with|in|on|at|into|from|as)\s+/gi)].pop();
      if (prepositionMatch) start += prepositionMatch.index + prepositionMatch[0].length;
    }
  } else {
    const connectorTarget = segment.match(new RegExp(`\\b(?:as\\s+well\\s+as|or|and)\\s+(?:${determinerPhrase}\\s+)?([^,.;!?]+)$`, 'i'));
    const properNounTarget = segment.match(/\b([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*)*)$/);
    if (connectorTarget) {
      start = segmentOffset + connectorTarget.index + connectorTarget[0].length - connectorTarget[1].length;
    } else if (properNounTarget) {
      start = segmentOffset + properNounTarget.index;
    }
  }

  const replacementFirstWord = String(replacement || '').trim().match(/^([A-Za-z']+)/)?.[1] || '';
  if (replacementFirstWord) {
    const prefix = before.slice(0, start);
    const priorWord = prefix.match(/\b([A-Za-z']+)\s*$/)?.[1] || '';
    if (priorWord && priorWord.toLowerCase() === replacementFirstWord.toLowerCase()) {
      start -= prefix.match(/\b([A-Za-z']+)\s*$/)[0].length;
    }
  }

  const candidate = before.slice(start, segmentEnd).trim();
  if (!candidate) return null;
  return { start: start + before.slice(start, segmentEnd).search(/\S/), end: segmentEnd, target: candidate };
}

function findMatchingLeadTargetBefore(before, replacement) {
  const trailing = String(before || '').match(/[,.;:\s]*$/)?.[0] || '';
  const effectiveEnd = String(before || '').length - trailing.length;
  const effective = String(before || '').slice(0, effectiveEnd);
  const firstWord = String(replacement || '').trim().match(/^([A-Za-z']+)/)?.[1] || '';
  if (!firstWord) return null;

  const matches = [...effective.matchAll(new RegExp(`\\b${escapeRegExp(firstWord)}\\b`, 'gi'))];
  const match = matches.pop();
  if (!match) return null;

  const target = effective.slice(match.index).trim();
  if (!target || countWords(target) > 8) return null;
  return { start: match.index, end: effectiveEnd, target };
}

function splitImplicitReplacementToTarget(replacement, target, correctionFlags) {
  const output = String(replacement || '').trim();
  const targetFirst = String(target || '').trim().match(/^([A-Za-z']+)/)?.[1] || '';
  const replacementFirst = output.match(/^([A-Za-z']+)/)?.[1] || '';
  if (!targetFirst || targetFirst.toLowerCase() !== replacementFirst.toLowerCase()) return { replacement: output, remainder: '' };

  const boundaryVerbs = correctionFlags.replacementBoundaryVerbs || [];
  let bestIndex = -1;
  for (const verb of boundaryVerbs) {
    const pattern = new RegExp(`\\b${escapeRegExp(verb)}\\b`, 'gi');
    let match;
    while ((match = pattern.exec(output))) {
      if (match.index === 0) continue;
      if (bestIndex === -1 || match.index < bestIndex) bestIndex = match.index;
    }
  }

  if (bestIndex !== -1) {
    const before = stripEdgePunctuation(output.slice(0, bestIndex));
    const after = stripEdgePunctuation(output.slice(bestIndex));
    if (countWords(before) >= 2) return { replacement: before, remainder: after };
  }

  return { replacement: output, remainder: '' };
}

function findChangeThatTargetBefore(before) {
  const trailing = before.match(/[,.;:\s]*$/)?.[0] || '';
  const effectiveEnd = before.length - trailing.length;
  const effective = before.slice(0, effectiveEnd);
  const objectMatch = [...effective.matchAll(/\b(?:to|as|for|with|into|from|on|in|at)\s+([^,.;!?]+)$/gi)].pop();
  if (objectMatch) {
    const start = objectMatch.index + objectMatch[0].length - objectMatch[1].length;
    return { start, end: effectiveEnd, target: before.slice(start, effectiveEnd).trim() };
  }

  const lastPhrase = effective.match(/([^,.;!?]+)$/);
  if (!lastPhrase) return null;
  const start = effectiveEnd - lastPhrase[1].length;
  return { start, end: effectiveEnd, target: before.slice(start, effectiveEnd).trim() };
}

function cleanupDeterminerCollisions(text, correctionFlags) {
  const determiners = correctionFlags.determiners || {};
  const articles = determiners.articles || ['a', 'an', 'the'];
  const possessives = determiners.possessives || [];
  const demonstratives = determiners.demonstratives || [];
  const quantifiers = (determiners.quantifiers || []).filter((word) => !['other'].includes(String(word).toLowerCase()));
  const allDeterminers = getDeterminerWords(correctionFlags);
  let output = text;

  for (const word of allDeterminers) {
    output = output.replace(new RegExp(`\\b(${escapeRegExp(word)})\\s+\\1\\b`, 'gi'), '$1');
  }

  for (const article of articles) {
    for (const word of [...possessives, ...demonstratives, ...quantifiers]) {
      output = output.replace(new RegExp(`\\b${escapeRegExp(article)}\\s+(${escapeRegExp(word)})\\b`, 'gi'), '$1');
    }
  }

  for (const possessive of possessives) {
    for (const word of [...articles, ...demonstratives, ...quantifiers]) {
      output = output.replace(new RegExp(`\\b(${escapeRegExp(possessive)})\\s+${escapeRegExp(word)}\\b`, 'gi'), '$1');
    }
  }

  for (const demonstrative of demonstratives) {
    for (const article of articles) {
      output = output.replace(new RegExp(`\\b(${escapeRegExp(demonstrative)})\\s+${escapeRegExp(article)}\\b`, 'gi'), '$1');
    }
  }

  return output.replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ');
}

function applyCorrectionRules(text, correctionFlags) {
  const gate = findGate(text, getAllCorrectionGates(correctionFlags));
  if (!gate) return { text, changes: [] };

  const bounds = sentenceBoundsAround(text, gate.index);
  const initialSentence = text.slice(bounds.start, bounds.end);
  const initialBeforeGate = initialSentence.slice(0, gate.index - bounds.start);
  if (!initialBeforeGate.trim()) {
    const earlier = text.slice(0, Math.max(0, bounds.start - 1));
    bounds.start = Math.max(earlier.lastIndexOf('.'), earlier.lastIndexOf('!'), earlier.lastIndexOf('?'), earlier.lastIndexOf('\n')) + 1;
  }

  if (shouldBridgeWaitCorrection(gate, text.slice(bounds.end), correctionFlags)) {
    bounds.end = nextSentenceEnd(text, bounds.end);
  }

  const sentence = text.slice(bounds.start, bounds.end);
  const gateInSentence = gate.index - bounds.start;
  const beforeGate = trimCueNoiseBeforeGate(sentence.slice(0, gateInSentence), gate.match);
  const tail = sentence.slice(gateInSentence);
  const afterGate = sentence.slice(gateInSentence + gate.match.length);
  const explicit = extractExplicitCorrection(afterGate) || extractExplicitCorrection(tail);
  const initialReplacement = explicit?.to || extractReplacementFromTail(afterGate, correctionFlags);
  if (!initialReplacement) return { text, changes: [] };

  const target = explicit?.from
    ? findExactTargetBefore(beforeGate, explicit.from, initialReplacement, correctionFlags)
    : /\bchange\s+that\s+to\b/i.test(afterGate)
      ? findChangeThatTargetBefore(beforeGate)
      : findMatchingLeadTargetBefore(beforeGate, initialReplacement) || findFallbackTargetBefore(beforeGate, initialReplacement, correctionFlags);
  if (!target) return { text, changes: [] };

  const scopedReplacement = explicit?.from
    ? { replacement: initialReplacement, remainder: '' }
    : splitImplicitReplacementToTarget(initialReplacement, target.target, correctionFlags);
  const replacement = scopedReplacement.replacement;

  const sentenceBeforeTarget = beforeGate.slice(0, target.start);
  const sentenceAfterTargetBeforeGate = beforeGate.slice(target.end);
  const replacementRemainder = scopedReplacement.remainder ? ` then ${scopedReplacement.remainder}` : '';
  let repairedSentence = titleFirst(cleanupPunctuationCollisions(cleanupDeterminerCollisions(`${sentenceBeforeTarget}${replacement}${sentenceAfterTargetBeforeGate}${replacementRemainder}`, correctionFlags)));
  const continuation = extractCorrectionContinuation(afterGate);
  if (continuation) {
    if (!/[.!?]$/.test(repairedSentence)) repairedSentence += '.';
    repairedSentence = `${repairedSentence} ${continuation}`;
  }
  const terminal = sentence.trim().match(/[.!?]$/)?.[0] || '';
  if (!continuation && terminal && !/[.!?]$/.test(repairedSentence)) repairedSentence += terminal;
  const repaired = cleanupPunctuationCollisions(`${text.slice(0, bounds.start)}${repairedSentence}${text.slice(bounds.end)}`);
  return {
    text: repaired,
    changes: [{
      type: 'self-correction',
      original: sentence.trim(),
      replacement: repairedSentence,
      target: target.target,
      correction: replacement,
      gate: gate.match,
    }],
  };
}

function hasCorrectionFlag(text, correctionFlags) {
  const lower = text.toLowerCase();
  return (correctionFlags.flags || []).some((flag) => lower.includes(String(flag).toLowerCase()));
}

module.exports = {

  sentenceCleanup,

  removeAlwaysFillers,

  applyContextualFillers,

  applyReplacementRules,

  applyCorrectionRules,

  hasCorrectionFlag,

};
