const path = require('path');
const fs = require('fs').promises;

function layoutPath(projectRoot, viewName) {
  return path.join(projectRoot, 'ai', 'views', viewName, 'settings', 'layout.json');
}

async function getLayout(projectRoot, viewName) {
  const file = layoutPath(projectRoot, viewName);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function setLayout(projectRoot, viewName, layout) {
  const file = layoutPath(projectRoot, viewName);
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(layout, null, 2));
  return layout;
}

module.exports = { getLayout, setLayout };
