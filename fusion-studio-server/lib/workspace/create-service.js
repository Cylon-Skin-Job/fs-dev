/**
 * create-service — filesystem scaffolding for newly created workspaces.
 *
 * Reads System_Manager/ai-template, validates selected V2 view templates, and
 * copies them into a new project's ai/<machine>/Views tree. Pure filesystem,
 * no events, no DB.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { getLocalMachineName, sanitizeMachineName } = require('./ai-paths');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SYSTEM_SOURCE_ROOT = path.join(REPO_ROOT, 'System_Manager');
const AI_TEMPLATE_ROOT = path.join(SYSTEM_SOURCE_ROOT, 'ai-template');
const AI_TEMPLATE_VIEW_TEMPLATES_ROOT = path.join(AI_TEMPLATE_ROOT, 'templates', 'view-templates');
const AI_TEMPLATE_WORKSPACE_TEMPLATES_ROOT = path.join(AI_TEMPLATE_ROOT, 'templates', 'workspace-templates');
const DEFAULT_WORKSPACE_TEMPLATE_ID = 'new';
const DEFAULT_SELECTED_VIEW_IDS = new Set(['capture-viewer', 'file-viewer', 'wiki-viewer', 'issues-viewer', 'agents-viewer']);
const VIEW_DATA_ROOTS = new Set(['Captures', 'Wiki', 'Issues', 'Agents', 'Office']);
const ALWAYS_COPY_V2_ROOTS = new Set(['System']);

function readManifest() {
  return readV2Manifest();
}

function scaffoldProject({ projectPath, viewIds, workspaceTemplateId, machineName = getLocalMachineName() }) {
  return scaffoldProjectV2({ projectPath, viewIds, workspaceTemplateId, machineName });
}

function scaffoldProjectV2({ projectPath, viewIds, workspaceTemplateId, machineName }) {
  const workspaceTemplate = readWorkspaceTemplate(workspaceTemplateId || DEFAULT_WORKSPACE_TEMPLATE_ID);
  const selectedViewIds = Array.isArray(viewIds) && viewIds.length > 0
    ? viewIds
    : workspaceTemplate.selectedViewIds;
  const manifest = readV2Manifest();
  const viewsById = new Map(manifest.views.map((view) => [view.id, view]));
  const requestedIds = Array.from(new Set(selectedViewIds));
  const unknownViewId = requestedIds.find((viewId) => !viewsById.has(viewId));
  if (unknownViewId) {
    throw new Error('Unknown view template: ' + unknownViewId);
  }

  const selectedViews = requestedIds.map((viewId) => viewsById.get(viewId));
  const safeMachineName = sanitizeMachineName(machineName);
  const targetExisted = fs.existsSync(projectPath);
  if (!targetExisted) {
    fs.mkdirSync(projectPath, { recursive: false });
  }

  try {
    const aiRoot = path.join(projectPath, 'ai');
    const machineRoot = path.join(aiRoot, safeMachineName);
    fs.mkdirSync(machineRoot, { recursive: true });

    const rootsToCopy = getV2TemplateRootsForViews(selectedViews);
    for (const entry of fs.readdirSync(AI_TEMPLATE_ROOT, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (!rootsToCopy.has(entry.name)) continue;

      const sourcePath = path.join(AI_TEMPLATE_ROOT, entry.name);
      const destinationPath = path.join(machineRoot, entry.name);
      copyTemplateEntry(sourcePath, destinationPath);
    }

    const destinationViewsRoot = path.join(machineRoot, 'Views');
    fs.mkdirSync(destinationViewsRoot, { recursive: true });
    const viewTemplatesRoot = getAiTemplateViewsRoot();
    selectedViews.forEach((view, index) => {
      const source = path.resolve(SYSTEM_SOURCE_ROOT, view.templatePath);
      assertUnder(source, viewTemplatesRoot, 'Template path escapes ai-template view templates');
      const destination = path.join(destinationViewsRoot, `${String(index + 1).padStart(3, '0')}-${view.id}`);
      assertUnder(destination, destinationViewsRoot, 'Destination path escapes machine Views');
      copyTemplateDirectory(source, destination);
    });

    createWorkspaceMirrorDatabase(machineRoot);

    return {
      manifest,
      selectedViews: selectedViews.map((view, index) => ({
        ...view,
        rank: index + 1,
        viewPath: path.join('ai', safeMachineName, 'Views', `${String(index + 1).padStart(3, '0')}-${view.id}`),
      })),
      machineName: safeMachineName,
      machineRoot,
      workspaceTemplate,
    };
  } catch (err) {
    if (!targetExisted) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
    throw err;
  }
}

function getV2TemplateRootsForViews(selectedViews) {
  const roots = new Set(ALWAYS_COPY_V2_ROOTS);
  for (const view of selectedViews) {
    if (VIEW_DATA_ROOTS.has(view.dataSource)) {
      roots.add(view.dataSource);
    }
  }
  return roots;
}

function createWorkspaceMirrorDatabase(machineRoot) {
  const dbDir = path.join(machineRoot, 'Data', 'Workspace-db');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'workspace.db');
  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mirror_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        source_id TEXT,
        status TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        summary TEXT,
        payload_json TEXT
      );
      CREATE TABLE IF NOT EXISTS chatlogs (
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        file_path TEXT,
        exported_at INTEGER,
        title TEXT,
        metadata_json TEXT
      );
      CREATE TABLE IF NOT EXISTS universal_event_ledger (
        id TEXT PRIMARY KEY,
        event_type TEXT,
        source TEXT,
        occurred_at INTEGER,
        payload_json TEXT
      );
      CREATE TABLE IF NOT EXISTS file_versioning (
        id TEXT PRIMARY KEY,
        file_path TEXT,
        version_id TEXT,
        captured_at INTEGER,
        metadata_json TEXT
      );
      CREATE INDEX IF NOT EXISTS runs_started_at_idx ON runs(started_at);
      CREATE INDEX IF NOT EXISTS chatlogs_exported_at_idx ON chatlogs(exported_at);
      CREATE INDEX IF NOT EXISTS universal_event_ledger_occurred_at_idx ON universal_event_ledger(occurred_at);
      CREATE INDEX IF NOT EXISTS file_versioning_captured_at_idx ON file_versioning(captured_at);
    `);
    db.prepare(`
      INSERT INTO mirror_metadata (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run({
      key: 'schema_version',
      value: '1',
      updated_at: Date.now(),
    });
  } finally {
    db.close();
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

function copyTemplateEntry(source, destination) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    copyTemplateDirectory(source, destination);
    return;
  }
  if (stat.isFile()) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

function getSystemSourceRoot() {
  return SYSTEM_SOURCE_ROOT;
}

function getAiTemplateRoot() {
  return AI_TEMPLATE_ROOT;
}

function getAiTemplateViewsRoot() {
  return AI_TEMPLATE_VIEW_TEMPLATES_ROOT;
}

function readV2Manifest() {
  const viewTemplatesRoot = getAiTemplateViewsRoot();
  const entries = fs.readdirSync(viewTemplatesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const match = entry.name.match(/^(\d+)-(.+)$/);
      return {
        folderName: entry.name,
        order: match ? Number(match[1]) : 999,
        fallbackId: match ? match[2] : entry.name,
      };
    })
    .sort((a, b) => {
      const orderDiff = a.order - b.order;
      if (orderDiff !== 0) return orderDiff;
      return a.folderName.localeCompare(b.folderName);
    });

  return {
    version: 2,
    templateRoot: path.relative(REPO_ROOT, AI_TEMPLATE_ROOT),
    viewTemplatesRoot: path.relative(REPO_ROOT, viewTemplatesRoot),
    workspaceTemplates: listWorkspaceTemplates(),
    views: entries.map((entry) => {
      const viewRoot = path.join(viewTemplatesRoot, entry.folderName);
      const manifest = readFrontmatter(path.join(viewRoot, 'manifest.md'));
      const icon = readFrontmatter(path.join(viewRoot, 'styles', 'icon.md'));
      const id = manifest.metadata?.['view-id'] || entry.fallbackId;
      const enabled = manifest.metadata?.enabled !== false;
      return {
        id,
        baseViewId: id,
        label: manifest.name || displayLabelFromId(id),
        description: manifest.description || '',
        group: DEFAULT_SELECTED_VIEW_IDS.has(id) ? 'default' : 'optional',
        status: enabled ? (manifest.metadata?.availability || 'ready') : 'hidden',
        icon: icon.metadata?.['icon-name'] || 'folder',
        templatePath: path.relative(SYSTEM_SOURCE_ROOT, viewRoot),
        folderName: entry.folderName,
        order: entry.order,
        enabled,
        availability: manifest.metadata?.availability || 'stable',
        dataSource: manifest.metadata?.['data-source'] || null,
      };
    }),
  };
}

function readWorkspaceTemplate(templateId = DEFAULT_WORKSPACE_TEMPLATE_ID) {
  const safeTemplateId = String(templateId || DEFAULT_WORKSPACE_TEMPLATE_ID).trim() || DEFAULT_WORKSPACE_TEMPLATE_ID;
  const candidates = safeTemplateId === DEFAULT_WORKSPACE_TEMPLATE_ID
    ? [
        path.join(AI_TEMPLATE_WORKSPACE_TEMPLATES_ROOT, 'new', 'profile.json'),
      ]
    : [
        path.join(AI_TEMPLATE_WORKSPACE_TEMPLATES_ROOT, safeTemplateId, 'profile.json'),
        path.join(AI_TEMPLATE_WORKSPACE_TEMPLATES_ROOT, 'startup', safeTemplateId, 'profile.json'),
      ];

  for (const filePath of candidates) {
    try {
      const profile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return normalizeWorkspaceTemplate(profile, filePath);
    } catch (err) {
      if (err && err.code !== 'ENOENT') throw err;
    }
  }

  if (safeTemplateId === DEFAULT_WORKSPACE_TEMPLATE_ID) {
    return normalizeWorkspaceTemplate({
      schemaVersion: 1,
      id: DEFAULT_WORKSPACE_TEMPLATE_ID,
      label: 'New Workspace',
      category: 'new',
      selectedViewIds: Array.from(DEFAULT_SELECTED_VIEW_IDS),
    }, null);
  }

  throw new Error('Unknown workspace template: ' + safeTemplateId);
}

function listWorkspaceTemplates() {
  const profiles = [];
  const newProfilePath = path.join(AI_TEMPLATE_WORKSPACE_TEMPLATES_ROOT, 'new', 'profile.json');
  if (fs.existsSync(newProfilePath)) {
    profiles.push(normalizeWorkspaceTemplate(JSON.parse(fs.readFileSync(newProfilePath, 'utf8')), newProfilePath));
  }

  const startupRoot = path.join(AI_TEMPLATE_WORKSPACE_TEMPLATES_ROOT, 'startup');
  try {
    for (const entry of fs.readdirSync(startupRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const profilePath = path.join(startupRoot, entry.name, 'profile.json');
      if (!fs.existsSync(profilePath)) continue;
      profiles.push(normalizeWorkspaceTemplate(JSON.parse(fs.readFileSync(profilePath, 'utf8')), profilePath));
    }
  } catch (err) {
    if (err && err.code !== 'ENOENT') throw err;
  }

  return profiles.sort((a, b) => {
    if (a.category !== b.category) return a.category === 'new' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

function normalizeWorkspaceTemplate(profile, filePath) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('Invalid workspace template profile: ' + filePath);
  }
  if (!Array.isArray(profile.selectedViewIds) || profile.selectedViewIds.length === 0) {
    throw new Error('Workspace template requires selectedViewIds: ' + filePath);
  }
  return {
    schemaVersion: profile.schemaVersion || 1,
    id: profile.id || DEFAULT_WORKSPACE_TEMPLATE_ID,
    label: profile.label || displayLabelFromId(profile.id || DEFAULT_WORKSPACE_TEMPLATE_ID),
    category: profile.category || 'new',
    description: profile.description || '',
    selectedViewIds: profile.selectedViewIds,
    profilePath: filePath ? path.relative(REPO_ROOT, filePath) : null,
  };
}

function readFrontmatter(filePath) {
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return {};
  }
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  return parseSimpleYaml(match[1]);
}

function parseSimpleYaml(yamlText) {
  const result = {};
  let currentObject = result;
  for (const rawLine of yamlText.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const indent = rawLine.match(/^\s*/)[0].length;
    const line = rawLine.trim();
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (indent === 0) {
      if (rawValue === '') {
        result[key] = {};
        currentObject = result[key];
      } else {
        result[key] = parseYamlScalar(rawValue);
        currentObject = result;
      }
      continue;
    }
    if (currentObject && typeof currentObject === 'object') {
      currentObject[key] = parseYamlScalar(rawValue);
    }
  }
  return result;
}

function parseYamlScalar(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  return value.replace(/^['"]|['"]$/g, '');
}

function displayLabelFromId(id) {
  return String(id || '')
    .replace(/-viewer$/, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'View';
}

function assertUnder(candidate, root, message) {
  const relative = path.relative(root, candidate);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error(message);
}

module.exports = {
  copyTemplateDirectory,
  createWorkspaceMirrorDatabase,
  getAiTemplateRoot,
  getAiTemplateViewsRoot,
  getSystemSourceRoot,
  listWorkspaceTemplates,
  readManifest,
  readWorkspaceTemplate,
  scaffoldProject,
};
