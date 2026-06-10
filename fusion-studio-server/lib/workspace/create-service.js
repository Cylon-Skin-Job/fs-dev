/**
 * create-service — filesystem scaffolding for newly created workspaces.
 *
 * Reads the fixed System Source Files view manifest, validates selected view
 * templates, copies them into a new project's ai/views tree, and writes the
 * workspace view registry. Pure filesystem, no events, no DB.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SYSTEM_SOURCE_ROOT = path.join(REPO_ROOT, 'System Source Files');
const MANIFEST_PATH = path.join(SYSTEM_SOURCE_ROOT, 'views.manifest.json');
const TEMPLATE_ROOT = path.join(SYSTEM_SOURCE_ROOT, 'view-templates');

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function scaffoldProject({ projectPath, viewIds }) {
  const manifest = readManifest();
  const viewsById = new Map(manifest.views.map((view) => [view.id, view]));
  const selectedViews = viewIds.map((viewId) => viewsById.get(viewId));
  const unknownViewId = viewIds.find((viewId, index) => !selectedViews[index]);
  if (unknownViewId) {
    throw new Error('Unknown view template: ' + unknownViewId);
  }

  const targetExisted = fs.existsSync(projectPath);
  if (!targetExisted) {
    fs.mkdirSync(projectPath, { recursive: false });
  }

  try {
    const aiViewsPath = path.join(projectPath, 'ai', 'views');
    fs.mkdirSync(aiViewsPath, { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'ai', 'system', 'workspace'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'ai', 'system', 'state'), { recursive: true });

    selectedViews.forEach((view) => {
      const source = path.resolve(SYSTEM_SOURCE_ROOT, view.templatePath);
      const destination = path.resolve(aiViewsPath, view.id);
      assertUnder(source, TEMPLATE_ROOT, 'Template path escapes view-templates');
      assertUnder(destination, aiViewsPath, 'Destination path escapes ai/views');
      copyTemplateDirectory(source, destination);
    });

    const registry = {
      version: 1,
      sort: 'ranked',
      views: selectedViews.map((view, index) => ({
        id: view.id,
        baseViewId: view.id,
        label: view.label,
        icon: view.icon || 'folder',
        rank: index + 1,
        enabled: true,
        source: view.group === 'default' ? 'default' : 'optional',
        viewPath: 'ai/views/' + view.id,
      })),
    };
    fs.writeFileSync(
      path.join(projectPath, 'ai', 'system', 'workspace', 'views.json'),
      JSON.stringify(registry, null, 2) + '\n',
      'utf8'
    );

    const index = {
      views: selectedViews.map((view, index) => ({
        id: view.id,
        label: view.label,
        icon: view.icon || 'folder',
        rank: index + 1,
      })),
    };
    fs.writeFileSync(path.join(aiViewsPath, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
    return { manifest, selectedViews };
  } catch (err) {
    if (!targetExisted) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
    throw err;
  }
}

function copyTemplateDirectory(source, destination) {
  const stat = fs.lstatSync(source);
  if (!stat.isDirectory()) {
    throw new Error('Template source is not a directory: ' + source);
  }

  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    const entryStat = fs.lstatSync(sourcePath);
    if (entryStat.isSymbolicLink()) continue;
    if (entryStat.isDirectory()) {
      copyTemplateDirectory(sourcePath, destinationPath);
      continue;
    }
    if (entryStat.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function getSystemSourceRoot() {
  return SYSTEM_SOURCE_ROOT;
}

function getTemplateRoot() {
  return TEMPLATE_ROOT;
}

function assertUnder(candidate, root, message) {
  const relative = path.relative(root, candidate);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error(message);
}

module.exports = {
  copyTemplateDirectory,
  getSystemSourceRoot,
  getTemplateRoot,
  readManifest,
  scaffoldProject,
};
