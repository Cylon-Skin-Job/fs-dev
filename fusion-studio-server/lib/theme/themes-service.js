/**
 * @module themes-service
 * @role Read/write themes.json and regenerate themes.css.
 *
 * Public API:
 *   list(projectRoot)            → ThemeEntry[]
 *   activate(projectRoot, id)    → ThemeEntry[]
 *   save(projectRoot, entry)     → ThemeEntry[]
 *   deleteTheme(projectRoot, id) → ThemeEntry[]
 *   generateCss(projectRoot, id) → void
 *
 * File operations are atomic (tmp → rename). No DB dependency.
 */
const path = require('path');
const fs   = require('fs').promises;
const themeCssGenerator = require('./theme-css-generator');

function themesPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'settings', 'themes.json');
}

function cssPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'settings', 'themes.css');
}
async function readThemesJson(projectRoot) {
  const file = themesPath(projectRoot);
  const raw  = await fs.readFile(file, 'utf8');
  const data = JSON.parse(raw);
  return data.themes || [];
}

async function writeThemesJson(projectRoot, themes) {
  const file = themesPath(projectRoot);
  const tmp  = `${file}.tmp.${process.pid}.${process.hrtime.bigint()}`;
  await fs.writeFile(tmp, JSON.stringify({ version: '1.0', schema: '2.0', themes }, null, 2));
  await fs.rename(tmp, file);
}
let writeQueue = Promise.resolve();
function serialized(fn) {
  const next = writeQueue.catch(() => {}).then(fn);
  writeQueue = next.catch(() => {});
  return next;
}
async function list(projectRoot) {
  return readThemesJson(projectRoot);
}
async function activate(projectRoot, id) {
  return serialized(async () => {
    const themes = await readThemesJson(projectRoot);
    const target = themes.find(t => t.id === id);
    if (!target) throw new Error(`Theme not found: ${id}`);
    for (const t of themes) t.active = (t.id === id);
    await writeThemesJson(projectRoot, themes);
    await generateCssUnlocked(projectRoot, id, themes);
    return themes;
  });
}
async function save(projectRoot, entry) {
  return serialized(async () => {
    const themes = await readThemesJson(projectRoot);
    const safeEntry = { ...entry, builtin: false };
    const idx = themes.findIndex(t => t.id === safeEntry.id);
    if (idx >= 0) themes[idx] = safeEntry;
    else themes.push(safeEntry);
    await writeThemesJson(projectRoot, themes);
    const activeNow = themes.find(t => t.active);
    if (activeNow && activeNow.id === safeEntry.id) {
      await generateCssUnlocked(projectRoot, safeEntry.id, themes);
    }
    return themes;
  });
}
async function deleteTheme(projectRoot, id) {
  return serialized(async () => {
    const themes = await readThemesJson(projectRoot);
    const target = themes.find(t => t.id === id);
    if (!target) throw new Error(`Theme not found: ${id}`);
    if (target.builtin) throw new Error('Cannot delete a builtin theme.');
    const wasActive = target.active;
    const updated   = themes.filter(t => t.id !== id);
    if (wasActive) {
      const firstBuiltin = updated.find(t => t.builtin);
      if (firstBuiltin) firstBuiltin.active = true;
    }
    await writeThemesJson(projectRoot, updated);
    if (wasActive) {
      const newActive = updated.find(t => t.active);
      if (newActive) await generateCssUnlocked(projectRoot, newActive.id, updated);
    }
    return updated;
  });
}
async function generateCss(projectRoot, id) {
  return serialized(() => generateCssUnlocked(projectRoot, id, null));
}
async function generateCssUnlocked(projectRoot, id, knownThemes) {
  const themes = knownThemes || await readThemesJson(projectRoot);
  const entry  = themes.find(t => t.id === id);
  if (!entry) throw new Error(`Theme not found: ${id}`);
  const css  = themeCssGenerator.render(entry);
  const file = cssPath(projectRoot);
  const tmp  = `${file}.tmp.${process.pid}.${process.hrtime.bigint()}`;
  await fs.writeFile(tmp, css);
  await fs.rename(tmp, file);
}
module.exports = {
  list,
  activate,
  save,
  deleteTheme,
  generateCss,
  writeThemesJson,
};
