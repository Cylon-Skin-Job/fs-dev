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
const { classifyEntrySync } = require('../fs/dirents');

const HARDCODED_DEFAULTS = {
  collapsed: { leftSidebar: false, leftChat: false, rightCol: false, contentArea: false },
  widths: {
    leftSidebar: 220,
    leftChat: 320,
    contentNavLeft: 200,
    contentNavRight: 220,
  },
  docViewerMode: 'active',
  docViewerSelectedPath: null,
  docViewerGridScroll: 0,
  docViewerDocScroll: 0,
  officeViewerMode: 'home',
  officeViewerCurrentFolder: null,
  officeViewerSelectedPath: null,
  officeDocumentSidePanel: 'none',
  officePaperBrightness: 100,
  activity: {
    recents: [],
    navigation: {
      stack: [],
      index: -1,
    },
    tabs: [],
    activeTabId: null,
  },
  collections: {
    starred: [],
    pinnedFolders: [],
  },
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
      rightCol:    false,
      contentArea: false,
    },
    widths: {
      leftSidebar: typeof layout.threadListWidth === 'number' ? layout.threadListWidth : HARDCODED_DEFAULTS.widths.leftSidebar,
      leftChat:    typeof layout.chatWidth       === 'number' ? layout.chatWidth       : HARDCODED_DEFAULTS.widths.leftChat,
      contentNavLeft: HARDCODED_DEFAULTS.widths.contentNavLeft,
      contentNavRight: HARDCODED_DEFAULTS.widths.contentNavRight,
    },
    docViewerMode: HARDCODED_DEFAULTS.docViewerMode,
    docViewerSelectedPath: HARDCODED_DEFAULTS.docViewerSelectedPath,
    docViewerGridScroll: HARDCODED_DEFAULTS.docViewerGridScroll,
    docViewerDocScroll: HARDCODED_DEFAULTS.docViewerDocScroll,
    officeViewerMode: HARDCODED_DEFAULTS.officeViewerMode,
    officeViewerCurrentFolder: HARDCODED_DEFAULTS.officeViewerCurrentFolder,
    officeViewerSelectedPath: HARDCODED_DEFAULTS.officeViewerSelectedPath,
    officeDocumentSidePanel: HARDCODED_DEFAULTS.officeDocumentSidePanel,
    officePaperBrightness: HARDCODED_DEFAULTS.officePaperBrightness,
    activity: HARDCODED_DEFAULTS.activity,
    collections: HARDCODED_DEFAULTS.collections,
  };
}

function findV2ViewFolder(projectRoot, viewId) {
  const viewsRoot = aiPaths.getMachineViewsRoot(projectRoot);
  try {
    const entries = fsSync.readdirSync(viewsRoot, { withFileTypes: true });
    const match = entries.find((entry) => classifyEntrySync(viewsRoot, entry).isDir && (
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
