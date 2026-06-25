'use strict';

const fs = require('fs');
const path = require('path');
const { registerCollector } = require('../exchange-metadata-registry');

const MAX_BASENAME_SEARCH_FILES = 3000;
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'release']);

function isNonMarkdownFilePath(candidate) {
  return /\.[^./\s]+$/.test(candidate) && !/\.md$/i.test(candidate);
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, '$1')
    .replace(/[>*_#~]/g, ' ');
}

function extractCandidates(text) {
  const clean = stripMarkdown(text);
  const matches = clean.match(/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,12}/g) || [];
  return Array.from(new Set(matches))
    .filter((candidate) => isNonMarkdownFilePath(candidate))
    .filter((candidate) => !candidate.includes('://'));
}

function toRepoRelative(projectRoot, resolvedPath) {
  const rel = path.relative(projectRoot, resolvedPath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel;
}

function validateDirectPath(projectRoot, candidate) {
  const resolved = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(projectRoot, candidate);
  const rel = toRepoRelative(projectRoot, resolved);
  if (!rel) return null;
  const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
  if (!stat || !stat.isFile()) return null;
  return rel;
}

function findBasename(projectRoot, basename) {
  let visited = 0;
  const stack = [projectRoot];

  while (stack.length > 0 && visited < MAX_BASENAME_SEARCH_FILES) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) stack.push(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      visited++;
      if (entry.name === basename) {
        return toRepoRelative(projectRoot, path.join(dir, entry.name));
      }
      if (visited >= MAX_BASENAME_SEARCH_FILES) break;
    }
  }

  return null;
}

function validateMention(projectRoot, candidate) {
  if (!projectRoot || !isNonMarkdownFilePath(candidate)) return null;
  if (candidate.includes('/') || path.isAbsolute(candidate)) {
    return validateDirectPath(projectRoot, candidate);
  }
  return findBasename(projectRoot, candidate);
}

registerCollector({
  id: 'file-mentions',
  collect(input) {
    const textParts = Array.isArray(input.assistantParts)
      ? input.assistantParts
          .filter((part) => part?.type === 'text')
          .map((part) => part.content || '')
      : [];
    const rawCandidates = extractCandidates([input.userInput, ...textParts].join('\n'));
    const mentions = [];

    for (const candidate of rawCandidates) {
      const validatedPath = validateMention(input.projectRoot, candidate);
      if (!validatedPath) continue;
      mentions.push({
        kind: 'file',
        label: path.basename(validatedPath),
        path: validatedPath,
        source: 'turn-text',
      });
    }

    return { mentions };
  },
});
