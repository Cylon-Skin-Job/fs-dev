/**
 * Defaults for per-view UI state.
 *
 * Precedence: per-user file -> view's layout.json -> these hardcoded values.
 *
 * Maps existing layout.json fields (threadListVisible, threadListWidth,
 * chatWidth) to the ViewUIState shape. These fields were originally from
 * the pre-26c layout system and were repurposed in 26c-2 as view defaults.
 */

const path = require('path');
const fsSync = require('fs');
const aiPaths = require('../workspace/ai-paths');

const HARDCODED_DEFAULTS = {
  collapsed: { leftSidebar: false, leftChat: false },
  widths:    { leftSidebar: 220,   leftChat: 320   },
};

function getDefaults(projectRoot, viewId) {
  const v2Folder = findV2ViewFolder(projectRoot, viewId);
  const layoutPath = v2Folder
    ? path.join(v2Folder, 'styles', 'layout.json')
    : path.join(projectRoot, 'ai', 'views', viewId, 'settings', 'layout.json');
  let layout = null;
  try {
    layout = JSON.parse(fsSync.readFileSync(layoutPath, 'utf8'));
  } catch {
    // No layout.json — use hardcoded
    return HARDCODED_DEFAULTS;
  }

  return {
    collapsed: {
      // threadListVisible === false means the sidebar starts collapsed
      leftSidebar: layout.threadListVisible === false,
      leftChat:    false,  // no existing field; always start expanded
    },
    widths: {
      leftSidebar: typeof layout.threadListWidth === 'number' ? layout.threadListWidth : HARDCODED_DEFAULTS.widths.leftSidebar,
      leftChat:    typeof layout.chatWidth       === 'number' ? layout.chatWidth       : HARDCODED_DEFAULTS.widths.leftChat,
    },
  };
}

function findV2ViewFolder(projectRoot, viewId) {
  const viewsRoot = aiPaths.getMachineViewsRoot(projectRoot);
  try {
    const entries = fsSync.readdirSync(viewsRoot, { withFileTypes: true });
    const match = entries.find((entry) => entry.isDirectory() && (
      entry.name === viewId || entry.name.endsWith(`-${viewId}`)
    ));
    return match ? path.join(viewsRoot, match.name) : null;
  } catch {
    return null;
  }
}

module.exports = {
  getDefaults,
  HARDCODED_DEFAULTS,
};
