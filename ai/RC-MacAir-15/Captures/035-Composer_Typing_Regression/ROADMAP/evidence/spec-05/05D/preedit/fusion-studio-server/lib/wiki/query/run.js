/**
 * Query command — the `query` subcommand of scripts/wiki.js.
 *
 * Section/article fragment filters over the shared scanner. Type,
 * tag, and source-path filters land here in later phases
 * (wiki-audit-decisions.md, Decisions 18–19).
 */

const { DEFAULT_WORKSPACE_ROOTS, queryWiki } = require('../wiki-tree');

function resolveQueryRoots(options) {
  if (options.scope === 'all') {
    return [...DEFAULT_WORKSPACE_ROOTS, ...options.workspaces];
  }

  if (options.workspaces.length > 0) {
    return options.workspaces;
  }

  return [process.cwd()];
}

/**
 * Run a wiki query. Options match the CLI flags:
 * { workspaces: [], scope, includeBody, format, section?, article?, limit? }
 */
function runQuery(options) {
  const roots = resolveQueryRoots(options);
  const result = queryWiki(roots, {
    includeBody: options.includeBody,
    format: options.format,
    section: options.section,
    article: options.article,
    limit: options.limit,
  });

  return {
    scope: options.scope,
    format: options.format,
    includeBody: options.includeBody,
    count: result.nodes.length,
    warnings: result.warnings,
    nodes: result.nodes,
  };
}

module.exports = {
  runQuery,
};
