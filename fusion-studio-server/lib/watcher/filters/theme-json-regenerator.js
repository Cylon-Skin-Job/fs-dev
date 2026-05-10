const themesService = require('../../theme/themes-service');

function getProjectRoot() {
  const workspaceController = require('../../workspace/workspace-controller');
  const active = workspaceController.getActiveWorkspaceSync();
  return active ? active.repo_path : null;
}

function regenerateThemesCss(filePath, ctx) {
  if (!filePath.endsWith('themes.json')) return;

  const root = getProjectRoot();
  if (!root) return;

  themesService.list(root)
    .then(themes => {
      const active = themes.find(t => t.active);
      if (active) {
        return themesService.generateCss(root, active.id);
      }
    })
    .then(() => {
      console.log('[Watcher] Regenerated themes.css after themes.json change');
    })
    .catch(err => {
      console.warn('[Watcher] themes.json regeneration failed:', err.message);
    });
}

module.exports = {
  name: 'theme-json-regenerator',

  shouldWatch(filePath, ctx) {
    if (ctx.basename.startsWith('themes.json.tmp')) return false;
    return filePath.includes('ai/settings/') && ctx.basename.includes('themes.json');
  },

  onModify: regenerateThemesCss,

  onRename(oldPath, newPath, oldCtx, newCtx) {
    if (newPath.endsWith('themes.json')) {
      regenerateThemesCss(newPath, newCtx);
    }
  },
};
