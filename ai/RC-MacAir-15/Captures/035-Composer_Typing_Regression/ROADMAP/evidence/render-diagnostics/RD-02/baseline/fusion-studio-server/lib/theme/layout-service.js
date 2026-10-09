const path = require('path');
const fs = require('fs').promises;
const views = require('../views');

function layoutPath(projectRoot, viewName) {
  const viewRoot = views.resolveViewRoot(projectRoot, viewName, {
    includeHidden: true,
    strictFilesystemErrors: true,
    strictReadiness: true,
  });
  return viewRoot ? path.join(viewRoot, 'styles', 'layout.json') : null;
}

async function getLayout(projectRoot, viewName) {
  const file = layoutPath(projectRoot, viewName);
  if (!file) return {};
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function setLayout(projectRoot, viewName, layout) {
  const file = layoutPath(projectRoot, viewName);
  if (!file) throw new Error(`View capsule is unavailable: ${viewName}`);
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(layout, null, 2));
  return layout;
}

module.exports = { getLayout, setLayout };
