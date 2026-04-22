/**
 * CLI-config barrel (CLI_CONFIG_SPEC).
 */

const { CATALOG, CATALOG_BY_ID } = require('./catalog');
const {
  workspacePath,
  viewPath,
  loadWorkspaceConfig,
  loadViewConfig,
  ensureWorkspaceFile,
} = require('./loader');
const { resolveCliConfig, resolveViewDelta } = require('./resolver');

module.exports = {
  CATALOG,
  CATALOG_BY_ID,
  workspacePath,
  viewPath,
  loadWorkspaceConfig,
  loadViewConfig,
  ensureWorkspaceFile,
  resolveCliConfig,
  resolveViewDelta,
};
