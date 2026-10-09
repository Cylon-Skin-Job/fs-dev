const fs = require('fs');
const path = require('path');
const views = require('../views');
const aiPaths = require('../workspace/ai-paths');
const { createCycleGuard } = require('../fs/cycle-guard');
const { classifyEntrySync } = require('../fs/dirents');

const DEFAULT_WORKSPACE_ROOTS = [
  '/Users/rccurtrightjr./projects/fs-dev/System_Manager',
  '/Users/rccurtrightjr./projects/Fusion-Home',
  '/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/fusion-home',
  '/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/project-repo',
  '/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/media-studio',
  '/Users/rccurtrightjr./projects/solobooks',
  '/Users/rccurtrightjr./projects/media-editor',
  '/Users/rccurtrightjr./projects/fs-dev',
];

function directoryExists(candidate) {
  return Boolean(candidate && fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());
}

function wikiFolderNameToLabel(folderName) {
  return String(folderName || '')
    .replace(/^\d+[-_\s]+/, '')
    .replace(/_/g, ' ');
}

function workspaceRootFromWikiRoot(wikiRoot) {
  const normalized = path.normalize(wikiRoot);
  const parts = normalized.split(path.sep);
  const aiIndex = parts.lastIndexOf('ai');
  if (aiIndex !== -1 && parts[aiIndex + 2] === 'Wiki' && aiIndex + 3 === parts.length) {
    return parts.slice(0, aiIndex).join(path.sep) || path.sep;
  }
  if (
    aiIndex !== -1
    && parts[aiIndex + 2] === 'System'
    && parts[aiIndex + 3] === 'Views'
    && parts[aiIndex + 5] === 'Wiki'
    && aiIndex + 6 === parts.length
  ) {
    return parts.slice(0, aiIndex).join(path.sep) || path.sep;
  }

  return path.dirname(normalized);
}

function defaultMachineWikiRoot(workspacePath) {
  return path.join(aiPaths.getMachineAiRoot(workspacePath), 'Wiki');
}

function resolveWikiRoot(inputPath) {
  const absoluteInput = path.resolve(inputPath || process.cwd());
  const inputIsWikiRoot = path.basename(absoluteInput) === 'Wiki';
  const workspacePath = inputIsWikiRoot
    ? workspaceRootFromWikiRoot(absoluteInput)
    : absoluteInput;
  const wikiRoot = inputIsWikiRoot
    ? absoluteInput
    : views.resolveContentPath(workspacePath, 'wiki-viewer', {
      includeHidden: true,
      strictFilesystemErrors: true,
      strictReadiness: true,
    })
      || defaultMachineWikiRoot(workspacePath);

  return {
    workspaceId: path.basename(workspacePath),
    workspacePath,
    wikiRoot,
    exists: directoryExists(wikiRoot),
  };
}

function readPage(pagePath, includeBody) {
  if (!fs.existsSync(pagePath)) {
    return {
      hasPage: false,
      error: 'Missing PAGE.md',
    };
  }

  const page = { hasPage: true };
  if (includeBody) {
    page.body = fs.readFileSync(pagePath, 'utf8');
  }
  return page;
}

function childDirectoryRealPath(parentDir, entry) {
  if (entry.isSymlink) return entry.realPath || null;
  try {
    return fs.realpathSync(path.join(parentDir, entry.name));
  } catch {
    return null;
  }
}

function listChildFolders(folderPath) {
  return fs.readdirSync(folderPath, { withFileTypes: true })
    .map(entry => classifyEntrySync(folderPath, entry))
    .filter(entry => entry.isDir && !entry.name.startsWith('.'))
    .map(entry => ({
      name: entry.name,
      realPath: childDirectoryRealPath(folderPath, entry),
    }))
    .filter(entry => entry.realPath)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function scanNode(context, absoluteFolder, nodePath, depth, options, cycleGuard) {
  const folderName = depth === 0 ? path.basename(context.wikiRoot) : path.basename(absoluteFolder);
  const pagePath = path.join(absoluteFolder, 'PAGE.md');
  const node = {
    workspaceId: context.workspaceId,
    workspacePath: context.workspacePath,
    wikiRoot: context.wikiRoot,
    nodePath,
    pagePath,
    label: depth === 0 ? 'Wiki' : wikiFolderNameToLabel(folderName),
    depth,
    ...readPage(pagePath, options.includeBody),
    children: [],
  };

  const childFolders = listChildFolders(absoluteFolder);
  for (const childFolder of childFolders) {
    if (!cycleGuard.shouldEnter(childFolder.realPath)) continue;
    const childAbsoluteFolder = path.join(absoluteFolder, childFolder.name);
    const childNodePath = nodePath ? `${nodePath}/${childFolder.name}` : childFolder.name;
    node.children.push(scanNode(context, childAbsoluteFolder, childNodePath, depth + 1, options, cycleGuard));
  }

  return node;
}

function scanWikiTree(workspaceRoots, options = {}) {
  const roots = Array.isArray(workspaceRoots) ? workspaceRoots : [workspaceRoots || process.cwd()];
  const warnings = [];
  const trees = [];

  for (const workspaceRoot of roots) {
    const context = resolveWikiRoot(workspaceRoot);
    if (!context.exists) {
      warnings.push({
        workspacePath: context.workspacePath,
        wikiRoot: context.wikiRoot,
        error: 'Wiki root not found',
      });
      continue;
    }

    const cycleGuard = createCycleGuard();
    let rootRealPath = null;
    try {
      rootRealPath = fs.realpathSync(context.wikiRoot);
    } catch {
      warnings.push({
        workspacePath: context.workspacePath,
        wikiRoot: context.wikiRoot,
        error: 'Wiki root realpath failed',
      });
      continue;
    }
    if (!cycleGuard.shouldEnter(rootRealPath)) continue;

    trees.push(scanNode(context, context.wikiRoot, '', 0, {
      includeBody: Boolean(options.includeBody),
    }, cycleGuard));
  }

  return { trees, warnings };
}

function omitChildren(node) {
  const { children, ...rest } = node;
  return rest;
}

function flattenNode(node, output) {
  output.push(omitChildren(node));
  for (const child of node.children || []) {
    flattenNode(child, output);
  }
}

function flattenWikiTree(trees) {
  const treeList = Array.isArray(trees) ? trees : [trees];
  const output = [];
  for (const tree of treeList) {
    if (tree) {
      flattenNode(tree, output);
    }
  }
  return output;
}

function includesMatch(value, fragment) {
  return String(value || '').toLowerCase().includes(fragment);
}

function nodeMatches(node, fragment) {
  return includesMatch(node.label, fragment) || includesMatch(node.nodePath, fragment);
}

function filterNodes(nodes, options = {}) {
  let filtered = nodes;

  if (options.section) {
    const sectionFragment = String(options.section).toLowerCase();
    const matchingSectionPaths = new Set(
      nodes
        .filter(node => node.depth === 1 && nodeMatches(node, sectionFragment))
        .map(node => node.nodePath)
    );

    filtered = filtered.filter(node => {
      for (const sectionPath of matchingSectionPaths) {
        if (node.nodePath === sectionPath || node.nodePath.startsWith(`${sectionPath}/`)) {
          return true;
        }
      }
      return false;
    });
  }

  if (options.article) {
    const articleFragment = String(options.article).toLowerCase();
    filtered = filtered.filter(node => node.depth >= 2 && nodeMatches(node, articleFragment));
  }

  if (Number.isInteger(options.limit) && options.limit >= 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

function pruneTree(node, allowedKeys) {
  const children = (node.children || [])
    .map(child => pruneTree(child, allowedKeys))
    .filter(Boolean);

  if (!allowedKeys.has(`${node.workspacePath}::${node.nodePath}`) && children.length === 0) {
    return null;
  }

  return {
    ...omitChildren(node),
    children,
  };
}

function queryWiki(workspaceRoots, options = {}) {
  const { trees, warnings } = scanWikiTree(workspaceRoots, options);
  const flatNodes = flattenWikiTree(trees);
  const nodes = filterNodes(flatNodes, options);

  if (options.format === 'tree') {
    const allowedKeys = new Set(nodes.map(node => `${node.workspacePath}::${node.nodePath}`));
    return {
      nodes: trees.map(tree => pruneTree(tree, allowedKeys)).filter(Boolean),
      warnings,
    };
  }

  return { nodes, warnings };
}

module.exports = {
  DEFAULT_WORKSPACE_ROOTS,
  wikiFolderNameToLabel,
  resolveWikiRoot,
  scanWikiTree,
  flattenWikiTree,
  queryWiki,
};
