/**
 * Section-TOC maintenance — generated marker blocks in heading articles
 * and legacy folder-level TOC pages.
 *
 * The 000- heading article owns its folder's TOC via the section-toc
 * marker block; folders without a 000- child get a generated
 * folder-level PAGE.md until they migrate to the heading paradigm.
 */

const fs = require('fs');
const path = require('path');

const { createCycleGuard } = require('../../fs/cycle-guard');
const { classifyEntrySync } = require('../../fs/dirents');
const { parseFrontmatter } = require('../../frontmatter');
const { wikiFolderNameToLabel } = require('../wiki-tree');
const { replaceMarkerBlock } = require('./markers');

function pageMeta(content) {
  const { frontmatter } = parseFrontmatter(content, 'wiki-page');
  return {
    name: String(frontmatter.name || ''),
    description: String(frontmatter.description || ''),
  };
}

function readDirectoryEntries(folderPath) {
  return fs.existsSync(folderPath)
    ? fs.readdirSync(folderPath, { withFileTypes: true })
    : [];
}

function listDirectoryEntries(folderPath) {
  return readDirectoryEntries(folderPath)
    .map((entry) => classifyEntrySync(folderPath, entry))
    .filter((entry) => entry.isDir);
}

function directoryRealPath(parentDir, entry) {
  if (entry.isSymlink) return entry.realPath || null;
  try {
    return fs.realpathSync(path.join(parentDir, entry.name));
  } catch {
    return null;
  }
}

function findHeadingArticlePage(folderPath) {
  const headingFolder = listDirectoryEntries(folderPath).find((e) => /^000-/.test(e.name));
  if (!headingFolder) return null;

  const pagePath = path.join(folderPath, headingFolder.name, 'PAGE.md');
  return fs.existsSync(pagePath) ? `${headingFolder.name}/PAGE.md` : null;
}

function extractDescription(folderPath) {
  const headingFolder = listDirectoryEntries(folderPath).find((e) => /^000-/.test(e.name));

  if (headingFolder) {
    const headingPage = path.join(folderPath, headingFolder.name, 'PAGE.md');
    if (fs.existsSync(headingPage)) {
      const { description } = pageMeta(fs.readFileSync(headingPage, 'utf8'));
      if (description && !description.startsWith('Table of contents for')) {
        return description;
      }
    }
  }

  const pagePath = path.join(folderPath, 'PAGE.md');
  if (fs.existsSync(pagePath)) {
    const { description } = pageMeta(fs.readFileSync(pagePath, 'utf8'));
    if (description && !description.startsWith('Table of contents for')) {
      return description;
    }
  }

  return '';
}

// 900–999 folders are operational attachments (prompts, checks, smoke
// tests), not content articles — excluded from every generated list.
function isOperationalBand(name) {
  return /^9\d\d-/.test(name);
}

function listTOCChildren(folderPath) {
  return listDirectoryEntries(folderPath)
    .filter((e) => !e.name.startsWith('.') && !/^000-/.test(e.name) && !isOperationalBand(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
    .filter((name) =>
      fs.existsSync(path.join(folderPath, name, 'PAGE.md'))
      || findHeadingArticlePage(path.join(folderPath, name)) !== null
    );
}

function generateTOC(folderPath, sectionName) {
  const children = listTOCChildren(folderPath);

  const lines = [
    '---',
    `name: ${sectionName}`,
    `description: Table of contents for ${sectionName}.`,
    'metadata:',
    '  incoming-edges: []',
    '  outgoing-edges: []',
    '  source-files: []',
    '  connected-skills: []',
    '  related-trigger-files: []',
    '---',
    '',
  ];

  for (const child of children) {
    const childPath = path.join(folderPath, child);
    const label = wikiFolderNameToLabel(child);
    const desc = extractDescription(childPath);
    const target = `${child}/${findHeadingArticlePage(childPath) || 'PAGE.md'}`;
    if (desc) {
      lines.push(`- [${label}](${target}) - ${desc}`);
    } else {
      lines.push(`- [${label}](${target})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function headingTOCLines(parentPath, children, linkPrefix) {
  const lines = [];
  for (const child of children) {
    const childPath = path.join(parentPath, child);
    const label = wikiFolderNameToLabel(child);
    const desc = extractDescription(childPath);
    const target = `${linkPrefix}${child}/${findHeadingArticlePage(childPath) || 'PAGE.md'}`;
    lines.push(desc ? `- [${label}](${target}) - ${desc}` : `- [${label}](${target})`);
  }
  return lines;
}

function generateHeadingTOC(sectionPath, headingFolderName, technicalLabel) {
  const headingPath = path.join(sectionPath, headingFolderName);
  const guidanceChildren = listTOCChildren(headingPath);
  const technicalChildren = listTOCChildren(sectionPath);
  const lines = [];

  if (guidanceChildren.length > 0) {
    lines.push('## Guidance and Preferences', '');
    lines.push(...headingTOCLines(headingPath, guidanceChildren, ''));
  }

  if (technicalChildren.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(`## ${technicalLabel || 'Technical Articles in this Wiki Section'}`, '');
    lines.push(...headingTOCLines(sectionPath, technicalChildren, '../'));
  }

  return lines.join('\n');
}

function syncHeadingArticle(sectionPath, headingFolderName, technicalLabel) {
  const pagePath = path.join(sectionPath, headingFolderName, 'PAGE.md');
  if (!fs.existsSync(pagePath)) return 'missing-page';

  const content = fs.readFileSync(pagePath, 'utf8');
  const generated = generateHeadingTOC(sectionPath, headingFolderName, technicalLabel);
  const result = replaceMarkerBlock(content, 'section-toc', generated);

  if (result.status === 'updated') {
    fs.writeFileSync(pagePath, result.content);
  }
  return result.status;
}

function childMeta(folderPath) {
  const headingPage = findHeadingArticlePage(folderPath);
  const pagePath = headingPage
    ? path.join(folderPath, headingPage)
    : path.join(folderPath, 'PAGE.md');
  if (!fs.existsSync(pagePath)) return { name: '', description: '' };
  return pageMeta(fs.readFileSync(pagePath, 'utf8'));
}

function generateChildrenList(folderPath) {
  const children = listTOCChildren(folderPath);
  if (children.length === 0) return '';

  const lines = ['## Children', ''];
  for (const child of children) {
    const childPath = path.join(folderPath, child);
    const meta = childMeta(childPath);
    const label = meta.name || wikiFolderNameToLabel(child);
    const desc = meta.description && !meta.description.startsWith('Table of contents for')
      ? meta.description
      : '';
    const target = `${child}/${findHeadingArticlePage(childPath) || 'PAGE.md'}`;
    lines.push(desc ? `- [${label}](${target}) - ${desc}` : `- [${label}](${target})`);
  }
  return lines.join('\n');
}

function syncChildrenBlock(folderPath, pagePath) {
  if (!fs.existsSync(pagePath)) return 'missing-page';

  const content = fs.readFileSync(pagePath, 'utf8');
  const result = replaceMarkerBlock(content, 'children', generateChildrenList(folderPath));

  if (result.status === 'updated') {
    fs.writeFileSync(pagePath, result.content);
  }
  return result.status;
}

function shouldGenerate(pagePath, folderName) {
  if (/^000-/.test(folderName)) return false;
  if (!fs.existsSync(pagePath)) return true;
  const { description } = pageMeta(fs.readFileSync(pagePath, 'utf8'));
  return !description || description.startsWith('Table of contents for');
}

/**
 * Fill section-toc marker blocks (and legacy folder TOC pages) across a
 * wiki. Returns counts plus an events list for the caller to log:
 * [{ action: 'created'|'updated'|'skipped', reason?, relPath }].
 */
function syncWikiTOCs(wikiRoot) {
  let updated = 0;
  let skipped = 0;
  let created = 0;
  const events = [];
  const cycleGuard = createCycleGuard();

  let rootRealPath = null;
  try {
    rootRealPath = fs.realpathSync(wikiRoot);
  } catch {
    return { updated, skipped, created, events };
  }

  if (!cycleGuard.shouldEnter(rootRealPath)) {
    return { updated, skipped, created, events };
  }

  function walk(folderPath, depth) {
    const folderName = path.basename(folderPath);
    const childDirs = listDirectoryEntries(folderPath)
      .filter((e) => !e.name.startsWith('.'));
    const headingDir = childDirs.find((e) => /^000-/.test(e.name));

    if (childDirs.length > 0) {
      if (headingDir) {
        // The 000- heading article owns this folder's TOC via its marker
        // block; the folder-level PAGE.md is retired and never regenerated.
        const result = syncHeadingArticle(folderPath, headingDir.name, depth === 0 ? 'Wiki Sections' : undefined);
        const headingPagePath = path.join(folderPath, headingDir.name, 'PAGE.md');
        const relPath = path.relative(wikiRoot, headingPagePath);

        if (result === 'updated') {
          updated++;
          events.push({ action: 'updated', relPath });
        } else {
          skipped++;
          if (result !== 'unchanged') {
            events.push({ action: 'skipped', reason: result, relPath });
          }
        }
      } else {
        const pagePath = path.join(folderPath, 'PAGE.md');
        const sectionName = depth === 0 ? 'Wiki Guide' : wikiFolderNameToLabel(folderName);

        if (shouldGenerate(pagePath, folderName)) {
          const toc = generateTOC(folderPath, sectionName);
          const isNew = !fs.existsSync(pagePath);
          fs.writeFileSync(pagePath, toc);
          if (isNew) {
            created++;
            events.push({ action: 'created', relPath: path.relative(wikiRoot, pagePath) });
          } else {
            updated++;
            events.push({ action: 'updated', relPath: path.relative(wikiRoot, pagePath) });
          }
        } else {
          skipped++;
        }
      }
    }

    // Children marker blocks live on article pages, not heading articles
    // (the section-toc block covers those). Runs on leaf folders too so a
    // page whose children were all removed gets its block emptied.
    if (!headingDir) {
      const pagePath = path.join(folderPath, 'PAGE.md');
      const childrenResult = syncChildrenBlock(folderPath, pagePath);
      if (childrenResult === 'updated') {
        updated++;
        events.push({ action: 'updated', reason: 'children', relPath: path.relative(wikiRoot, pagePath) });
      }
    }

    for (const child of childDirs) {
      const childRealPath = directoryRealPath(folderPath, child);
      if (!cycleGuard.shouldEnter(childRealPath)) continue;
      walk(path.join(folderPath, child.name), depth + 1);
    }
  }

  walk(wikiRoot, 0);
  return { updated, skipped, created, events };
}

module.exports = {
  syncWikiTOCs,
};
