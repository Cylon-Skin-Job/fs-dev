/**
 * @module transcription/deterministic-cleanup
 * @role Apply JSON-configured deterministic cleanup before local model passes.
 */

const fs = require('fs');
const path = require('path');
const { getTextToSpeechRulesRoot } = require('../resources/resolver');
const {
  sentenceCleanup,
  removeAlwaysFillers,
  applyContextualFillers,
  applyReplacementRules,
  applyCorrectionRules,
  hasCorrectionFlag,
} = require('./cleanup-first-pass');
const {
  applyListRules,
  splitForgottenListEnd,
  normalizeStructuredListItems,
  repairDanglingListContinuations,
  detectForgottenListEnd,
} = require('./cleanup-list-pass');
const {
  splitClosingListParagraphs,
  splitLongListItems,
  finalTextPolish,
} = require('./cleanup-final-pass');

function readJson(fileName) {
  const filePath = path.join(getTextToSpeechRulesRoot(), fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonIfExists(fileName) {
  const filePath = path.join(getTextToSpeechRulesRoot(), fileName);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadListRules() {
  const start = readJsonIfExists(path.join('list', 'start-markers.json'));
  if (!start) return readJson('list-markers.json');

  const category = readJson(path.join('list', 'category-markers.json'));
  const numbers = readJson(path.join('list', 'number-markers.json'));
  const relations = readJson(path.join('list', 'continuation-relations.json'));
  const completions = readJson(path.join('list', 'continuation-completions.json'));
  const statusSegments = readJsonIfExists(path.join('list', 'status-segments.json')) || {};

  return {
    version: start.version,
    description: 'Assembled from split list rule files.',
    startMarkers: start.startMarkers || [],
    weakStartMarkers: start.weakStartMarkers || [],
    softStartMarkers: start.softStartMarkers || [],
    softCategoryStart: category.softCategoryStart || {},
    endMarkers: start.endMarkers || [],
    numberMarkers: numbers.numberMarkers || {},
    riskyHomophoneMarkers: numbers.riskyHomophoneMarkers || {},
    continuationRelations: relations.relations || [],
    continuationCompletions: {
      bucketTerms: completions.bucketTerms || [],
      whatNeedsPatterns: completions.whatNeedsPatterns || [],
      descriptorWords: completions.descriptorWords || [],
      firstItemStarts: completions.firstItemStarts || [],
    },
    statusSegments,
  };
}

function loadThresholdRules() {
  const listThresholds = readJsonIfExists(path.join('list', 'thresholds.json'));
  if (!listThresholds) return readJson('cleanup-thresholds.json');

  const transitions = readJson(path.join('list', 'transition-markers.json'));
  const actions = readJson(path.join('list', 'action-verbs.json'));
  const closings = readJson(path.join('list', 'closing-openers.json'));
  const itemCleanup = readJson(path.join('list', 'item-cleanup.json'));

  return {
    version: listThresholds.version,
    description: 'Assembled from split threshold rule files.',
    selfCorrection: {
      enabled: true,
      modelPass: 'self-correction',
      triggeredBy: 'correction-flags.json',
    },
    forgottenListEnd: {
      enabled: listThresholds.enabled,
      modelPass: listThresholds.modelPass,
      lastItemLengthMultiplier: listThresholds.lastItemLengthMultiplier,
      compareAgainst: listThresholds.compareAgainst,
      itemTransitionMarkers: transitions.itemTransitionMarkers || [],
      gatedItemSeparators: transitions.gatedItemSeparators || [],
      paragraphTransitionMarkers: transitions.paragraphTransitionMarkers || [],
      finalParagraphMarkers: transitions.finalParagraphMarkers || [],
      finalListItemSplit: listThresholds.finalListItemSplit || {},
      actionVerbs: actions.actionVerbs || [],
      paragraphOpeners: closings.paragraphOpeners || [],
      listClosingOpeners: closings.listClosingOpeners || [],
      transitionPhrases: transitions.transitionPhrases || [],
      listItemScaffoldPrefixes: itemCleanup.listItemScaffoldPrefixes || [],
      listItemDanglingEndings: itemCleanup.listItemDanglingEndings || [],
      listItemGerundRewrites: itemCleanup.listItemGerundRewrites || {},
    },
  };
}

function loadCorrectionRules() {
  const gates = readJsonIfExists(path.join('correction', 'gates.json'));
  if (!gates) return readJson('correction-flags.json');

  const replacements = readJson(path.join('correction', 'replacement-indicators.json'));
  const resets = readJson(path.join('correction', 'reset-indicators.json'));
  const boundaries = readJson(path.join('correction', 'replacement-boundary-verbs.json'));
  const determiners = readJson(path.join('correction', 'determiners.json'));

  return {
    version: gates.version,
    description: 'Assembled from split correction rule files.',
    flags: gates.flags || [],
    mistakeIndicators: gates.mistakeIndicators || [],
    replacementIndicators: replacements.replacementIndicators || [],
    removalIndicators: resets.removalIndicators || [],
    xyPatterns: replacements.xyPatterns || [],
    strongResetIndicators: resets.strongResetIndicators || [],
    replacementBoundaryVerbs: boundaries.replacementBoundaryVerbs || [],
    determiners: determiners.determiners || {},
  };
}

function loadRules() {
  return {
    replacements: readJsonIfExists(path.join('text', 'replacements.json')) || readJson('replacement-rules.json'),
    fillers: readJsonIfExists(path.join('text', 'fillers.json')) || readJson('filler-rules.json'),
    lists: loadListRules(),
    correctionFlags: loadCorrectionRules(),
    thresholds: loadThresholdRules(),
  };
}

function applyDeterministicCleanup(input, providedRules = null) {
  const rules = providedRules || loadRules();
  const changes = [];
  let text = sentenceCleanup(input);

  for (const step of [
    () => removeAlwaysFillers(text, rules.fillers),
    () => applyContextualFillers(text, rules.fillers),
    () => applyReplacementRules(text, rules.replacements),
    () => applyCorrectionRules(text, rules.correctionFlags),
    () => applyListRules(text, rules.lists, rules.thresholds),
    () => splitForgottenListEnd(text, rules.thresholds),
    () => normalizeStructuredListItems(text, rules.thresholds),
    () => repairDanglingListContinuations(text),
    () => splitClosingListParagraphs(text, rules.thresholds),
    () => splitLongListItems(text, rules.thresholds),
    () => {
      const polished = finalTextPolish(text);
      return { text: polished, changes: text === polished ? [] : [{ type: 'text-polish' }] };
    },
  ]) {
    const result = step();
    text = result.text;
    changes.push(...result.changes);
  }

  return {
    text,
    changes,
    needsSelfCorrectionPass: hasCorrectionFlag(text, rules.correctionFlags),
    needsListBoundaryPass: detectForgottenListEnd(text, rules.thresholds),
  };
}

module.exports = {
  applyDeterministicCleanup,
  loadRules,
};
