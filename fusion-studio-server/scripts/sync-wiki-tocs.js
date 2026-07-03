#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

process.chdir(path.resolve(__dirname, '..'));

const {
  DEFAULT_WORKSPACE_ROOTS,
  wikiFolderNameToLabel,
  resolveWikiRoot,
} = require('../lib/wiki/wiki-tree');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: '', description: '' };

  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*(.+)$/m);

  return {
    name: nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, '') : '',
    description: descMatch ? descMatch[1].trim().replace(/^["']|["']$/g, '') : '',
  };
}

const SECTION_TOC_START = '<!-- section-toc:start -->';
const SECTION_TOC_END = '<!-- section-toc:end -->';

function findHeadingArticlePage(folderPath) {
  const entries = fs.existsSync(folderPath)
    ? fs.readdirSync(folderPath, { withFileTypes: true })
    : [];
  const headingFolder = entries.find((e) => e.isDirectory() && /^000-/.test(e.name));
  if (!headingFolder) return null;

  const pagePath = path.join(folderPath, headingFolder.name, 'PAGE.md');
  return fs.existsSync(pagePath) ? `${headingFolder.name}/PAGE.md` : null;
}

function extractDescription(folderPath) {
  const entries = fs.existsSync(folderPath)
    ? fs.readdirSync(folderPath, { withFileTypes: true })
    : [];

  const headingFolder = entries.find((e) => e.isDirectory() && /^000-/.test(e.name));

  if (headingFolder) {
    const headingPage = path.join(folderPath, headingFolder.name, 'PAGE.md');
    if (fs.existsSync(headingPage)) {
      const { description } = parseFrontmatter(fs.readFileSync(headingPage, 'utf8'));
      if (description && !description.startsWith('Table of contents for')) {
        return description;
      }
    }
  }

  const pagePath = path.join(folderPath, 'PAGE.md');
  if (fs.existsSync(pagePath)) {
    const { description } = parseFrontmatter(fs.readFileSync(pagePath, 'utf8'));
    if (description && !description.startsWith('Table of contents for')) {
      return description;
    }
  }

  return '';
}

function listTOCChildren(folderPath) {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !/^000-/.test(e.name))
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
    lines.push('## User Preferences and Guidance', '');
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
  const startIdx = content.indexOf(SECTION_TOC_START);
  const endIdx = content.indexOf(SECTION_TOC_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return 'no-markers';

  const updated =
    content.slice(0, startIdx + SECTION_TOC_START.length) +
    '\n' + generateHeadingTOC(sectionPath, headingFolderName, technicalLabel) + '\n' +
    content.slice(endIdx);

  if (updated === content) return 'unchanged';
  fs.writeFileSync(pagePath, updated);
  return 'updated';
}

function shouldGenerate(pagePath, folderName) {
  if (/^000-/.test(folderName)) return false;
  if (!fs.existsSync(pagePath)) return true;
  const { description } = parseFrontmatter(fs.readFileSync(pagePath, 'utf8'));
  return !description || description.startsWith('Table of contents for');
}

function syncWikiTOCs(wikiRoot) {
  let updated = 0;
  let skipped = 0;
  let created = 0;

  function walk(folderPath, depth) {
    const folderName = path.basename(folderPath);
    const entries = fs.existsSync(folderPath)
      ? fs.readdirSync(folderPath, { withFileTypes: true })
      : [];
    const childDirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));

    if (childDirs.length > 0) {
      const headingDir = childDirs.find((e) => /^000-/.test(e.name));

      if (headingDir) {
        // The 000- heading article owns this folder's TOC via its marker
        // block; the folder-level PAGE.md is retired and never regenerated.
        const result = syncHeadingArticle(folderPath, headingDir.name, depth === 0 ? 'Wiki Sections' : undefined);
        const headingPagePath = path.join(folderPath, headingDir.name, 'PAGE.md');

        if (result === 'updated') {
          updated++;
          console.log(`  updated: ${path.relative(wikiRoot, headingPagePath)}`);
        } else {
          skipped++;
          if (result !== 'unchanged') {
            console.log(`  skipped (${result}): ${path.relative(wikiRoot, headingPagePath)}`);
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
            console.log(`  created: ${path.relative(wikiRoot, pagePath)}`);
          } else {
            updated++;
            console.log(`  updated: ${path.relative(wikiRoot, pagePath)}`);
          }
        } else {
          skipped++;
        }
      }
    }

    for (const child of childDirs) {
      walk(path.join(folderPath, child.name), depth + 1);
    }
  }

  walk(wikiRoot, 0);
  return { updated, skipped, created };
}

function main() {
  const args = process.argv.slice(2);
  let wikiRoots = [];

  if (args.length > 0 && !args[0].startsWith('--')) {
    const context = resolveWikiRoot(args[0]);
    if (context.exists) {
      wikiRoots = [context.wikiRoot];
    } else {
      console.error(`Wiki root not found: ${context.wikiRoot}`);
      process.exit(1);
    }
  } else {
    for (const root of DEFAULT_WORKSPACE_ROOTS) {
      const context = resolveWikiRoot(root);
      if (context.exists) {
        wikiRoots.push(context.wikiRoot);
      }
    }
  }

  if (wikiRoots.length === 0) {
    console.error('No wiki roots found.');
    process.exit(1);
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const wikiRoot of wikiRoots) {
    const label = path.basename(
      path.dirname(path.dirname(path.dirname(path.dirname(wikiRoot))))
    );
    console.log(`\n=== ${label} ===`);
    const result = syncWikiTOCs(wikiRoot);
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    console.log(`  created: ${result.created}  updated: ${result.updated}  skipped: ${result.skipped}`);
  }

  console.log(`\nTotal: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped`);
}

main();
