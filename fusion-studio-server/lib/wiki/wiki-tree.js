const fs = require('fs');
const path = require('path');
const views = require('../views');
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
  const legacySuffix = path.join('ai', 'views', 'wiki-viewer', 'Wiki');

  if (normalized.endsWith(legacySuffix)) {
    return normalized.slice(0, normalized.length - legacySuffix.length - 1);
  }

  const parts = normalized.split(path.sep);
  const aiIndex = parts.lastIndexOf('ai');
  if (aiIndex !== -1 && parts[aiIndex + 2] === 'Wiki' && aiIndex + 3 === parts.length) {
    return parts.slice(0, aiIndex).join(path.sep) || path.sep;
  }

  return path.dirname(normalized);
}

function defaultLegacyWikiRoot(workspacePath) {
  return path.join(workspacePath, 'ai', 'views', 'wiki-viewer', 'Wiki');
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // Missing or invalid optional content config falls back to the machine wiki root.
  }
  return null;
}

function isPathInside(candidate, rootPath) {
  const root = path.resolve(rootPath);
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function expandContentPathVariables(value, workspacePath, machineName) {
  return String(value || '')
    .replace(/\$\{machine\}/g, machineName)
    .replace(/\$\{workspace\}/g, path.basename(workspacePath));
}

function resolveRelativeContentPath(rootPath, rawPath, workspacePath, machineName) {
  const expanded = expandContentPathVariables(rawPath, workspacePath, machineName);
  if (!expanded || path.isAbsolute(expanded)) return null;
  const resolved = path.resolve(rootPath, expanded);
  return isPathInside(resolved, rootPath) ? resolved : null;
}

function resolveAbsoluteContentPath(rawPath, workspacePath, machineName) {
  const expanded = expandContentPathVariables(rawPath, workspacePath, machineName);
  if (!expanded || !path.isAbsolute(expanded)) return null;
  return path.resolve(expanded);
}

function resolveDeclaredWikiRoot(workspacePath, machineName, viewRoot, declaration) {
  if (typeof declaration === 'string') {
    return resolveRelativeContentPath(workspacePath, declaration, workspacePath, machineName);
  }
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) {
    return null;
  }

  const machineRoot = path.join(workspacePath, 'ai', machineName);
  const type = declaration.type || 'workspace-relative';
  if (type === 'workspace-relative') {
    return resolveRelativeContentPath(workspacePath, declaration.path, workspacePath, machineName);
  }
  if (type === 'machine-relative') {
    return resolveRelativeContentPath(machineRoot, declaration.path, workspacePath, machineName);
  }
  if (type === 'view-relative') {
    return resolveRelativeContentPath(viewRoot, declaration.path, workspacePath, machineName);
  }
  if (type === 'project-root') {
    return workspacePath;
  }
  if (type === 'absolute') {
    return resolveAbsoluteContentPath(declaration.path, workspacePath, machineName);
  }
  if (type === 'selected-folder') {
    return declaration.path
      ? resolveRelativeContentPath(workspacePath, declaration.path, workspacePath, machineName)
      : viewRoot;
  }
  if (type === 'sqlite' || type === 'none') {
    return viewRoot;
  }
  return null;
}

function isWikiViewerFolder(viewRoot) {
  const folderId = path.basename(viewRoot).replace(/^\d+[-_\s]+/, '');
  if (folderId === 'wiki-viewer') return true;
  try {
    const manifest = fs.readFileSync(path.join(viewRoot, 'manifest.md'), 'utf8');
    return /^\s*view-id:\s*wiki-viewer\s*$/m.test(manifest);
  } catch {
    return false;
  }
}

function discoverMachineScopedWikiRoot(workspacePath) {
  const aiRoot = path.join(workspacePath, 'ai');
  if (!directoryExists(aiRoot)) return null;

  for (const machineEntry of fs.readdirSync(aiRoot, { withFileTypes: true })) {
    if (!machineEntry.isDirectory()) continue;
    const machineName = machineEntry.name;
    const viewsRoot = path.join(aiRoot, machineName, 'Views');
    if (!directoryExists(viewsRoot)) continue;

    const viewEntries = fs.readdirSync(viewsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const viewEntry of viewEntries) {
      const viewRoot = path.join(viewsRoot, viewEntry.name);
      if (!isWikiViewerFolder(viewRoot)) continue;

      const config = readJsonObject(path.join(viewRoot, 'content.json'));
      const declaredRoot = config && config.root !== undefined
        ? resolveDeclaredWikiRoot(workspacePath, machineName, viewRoot, config.root)
        : null;
      return declaredRoot || path.join(aiRoot, machineName, 'Wiki');
    }
  }

  return null;
}

function resolveWikiRoot(inputPath) {
  const absoluteInput = path.resolve(inputPath || process.cwd());
  const inputIsWikiRoot = path.basename(absoluteInput) === 'Wiki';
  const workspacePath = inputIsWikiRoot
    ? workspaceRootFromWikiRoot(absoluteInput)
    : absoluteInput;
  const wikiRoot = inputIsWikiRoot
    ? absoluteInput
    : views.resolveContentPath(workspacePath, 'wiki-viewer', { includeHidden: true })
      || discoverMachineScopedWikiRoot(workspacePath)
      || defaultLegacyWikiRoot(workspacePath);

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
