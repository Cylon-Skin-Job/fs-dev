/**
 * View-state — STATE_OVERRIDE_SPEC.
 *
 * Workspace default:  ai/<machine>/System/state/state.json
 * Per-view override:  ai/<machine>/Views/<view-folder>/state/state.json
 *
 * Resolver deep-merges workspace ← override. Writer routes each leaf key
 * to whichever file already owns it (override wins when pinned).
 */

const { resolveViewState } = require('./resolver');
const { writeViewStatePatch } = require('./writer');

module.exports = {
  resolveViewState,
  writeViewStatePatch,
};
