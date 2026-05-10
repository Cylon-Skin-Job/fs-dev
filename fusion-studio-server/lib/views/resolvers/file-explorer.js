/**
 * @module file-explorer resolver
 * @role Content path resolution for file-explorer display type
 *
 * file-viewer points to the project root (browses the whole repo).
 * Other file-explorer views point to their own content/ folder.
 */

const path = require('path');

module.exports = {
  resolveContentPath(projectRoot, viewId, view, context) {
    // file-viewer is special: it browses the project root, not its own folder
    if (viewId === 'file-viewer') {
      return context.sessionRoot || projectRoot;
    }

    // All other file-explorer views serve from their content/ folder
    return path.join(view.viewRoot, 'content');
  },
};
