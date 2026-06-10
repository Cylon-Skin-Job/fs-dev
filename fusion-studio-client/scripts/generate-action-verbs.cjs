#!/usr/bin/env node
/**
 * Generate a candidate action verb list from WordNet.
 *
 * This does not replace the curated action-verbs.json used at runtime.
 * It creates action-verbs.generated.json as a reviewable source list.
 */

const fs = require('fs');
const path = require('path');
const wordnet = require('wordnet-db');

const CLIENT_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(CLIENT_ROOT, '..');
const ACTION_VERBS_PATH = path.join(
  REPO_ROOT,
  'System Source Files',
  'resources',
  'text-to-speech',
  'rules',
  'list',
  'action-verbs.json'
);
const GENERATED_PATH = path.join(
  REPO_ROOT,
  'System Source Files',
  'resources',
  'text-to-speech',
  'rules',
  'list',
  'action-verbs.generated.json'
);

function readCuratedVerbs() {
  if (!fs.existsSync(ACTION_VERBS_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(ACTION_VERBS_PATH, 'utf8'));
  return parsed.actionVerbs || [];
}

function isUsefulVerbLemma(lemma) {
  if (!/^[a-z][a-z-]*$/.test(lemma)) return false;
  if (lemma.length < 2) return false;
  return true;
}

function readWordNetVerbLemmas() {
  const indexPath = path.join(wordnet.path, 'index.verb');
  const lines = fs.readFileSync(indexPath, 'utf8').split('\n');
  const verbs = new Set();

  for (const line of lines) {
    if (!line || line.startsWith('  ') || line.startsWith('\t')) continue;
    const lemma = line.split(/\s+/, 1)[0].toLowerCase().replace(/_/g, '-');
    if (isUsefulVerbLemma(lemma)) verbs.add(lemma);
  }

  return [...verbs].sort((a, b) => a.localeCompare(b));
}

const curated = readCuratedVerbs().map((verb) => String(verb).toLowerCase());
const generated = readWordNetVerbLemmas();
const mergedCandidates = [...new Set([...generated, ...curated])].sort((a, b) => a.localeCompare(b));
const curatedNotInWordNet = curated.filter((verb) => !generated.includes(verb));

const output = {
  version: '1.0',
  description: 'Generated candidate verb lemmas from WordNet. Review before copying into action-verbs.json.',
  source: {
    package: 'wordnet-db',
    wordnetVersion: wordnet.version,
    packageVersion: wordnet.libVersion,
    file: 'index.verb'
  },
  stats: {
    generatedCount: generated.length,
    curatedCount: curated.length,
    mergedCandidateCount: mergedCandidates.length,
    curatedNotInWordNetCount: curatedNotInWordNet.length
  },
  generatedVerbs: generated,
  curatedVerbs: curated,
  curatedNotInWordNet,
  mergedCandidates
};

fs.writeFileSync(GENERATED_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`[generate-action-verbs] Wrote ${GENERATED_PATH}`);
console.log(`[generate-action-verbs] WordNet verbs: ${generated.length}`);
console.log(`[generate-action-verbs] Merged candidates: ${mergedCandidates.length}`);
