#!/usr/bin/env node

const path = require('path');

process.chdir(path.resolve(__dirname, '..'));

const {
  DEFAULT_WORKSPACE_ROOTS,
  queryWiki,
} = require('../lib/wiki/wiki-tree');

function printUsage() {
  console.error(`Usage: node scripts/query-wiki.js [options]

Options:
  --workspace <path>      Workspace root, or direct Wiki root. Can be repeated.
  --scope current|all     Query current workspace (default) or all known roots.
  --include-body          Include PAGE.md body text.
  --format json|tree      Output flat JSON nodes (default) or nested tree nodes.
  --section <fragment>    Match depth-1 section label or node path, plus descendants.
  --article <fragment>    Match depth >= 2 article label or node path.
  --limit <n>             Limit returned nodes after filtering.
  --help                  Show this help text.`);
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    workspaces: [],
    scope: 'current',
    includeBody: false,
    format: 'json',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--workspace') {
      options.workspaces.push(readValue(argv, index, arg));
      index += 1;
    } else if (arg === '--scope') {
      options.scope = readValue(argv, index, arg);
      index += 1;
    } else if (arg === '--include-body') {
      options.includeBody = true;
    } else if (arg === '--format') {
      options.format = readValue(argv, index, arg);
      index += 1;
    } else if (arg === '--section') {
      options.section = readValue(argv, index, arg);
      index += 1;
    } else if (arg === '--article') {
      options.article = readValue(argv, index, arg);
      index += 1;
    } else if (arg === '--limit') {
      const value = Number(readValue(argv, index, arg));
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('--limit requires a non-negative integer');
      }
      options.limit = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['current', 'all'].includes(options.scope)) {
    throw new Error('--scope must be current or all');
  }
  if (!['json', 'tree'].includes(options.format)) {
    throw new Error('--format must be json or tree');
  }

  return options;
}

function getWorkspaceRoots(options) {
  if (options.scope === 'all') {
    return [...DEFAULT_WORKSPACE_ROOTS, ...options.workspaces];
  }

  if (options.workspaces.length > 0) {
    return options.workspaces;
  }

  return [process.cwd()];
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const roots = getWorkspaceRoots(options);
  const result = queryWiki(roots, {
    includeBody: options.includeBody,
    format: options.format,
    section: options.section,
    article: options.article,
    limit: options.limit,
  });

  const output = {
    scope: options.scope,
    format: options.format,
    includeBody: options.includeBody,
    count: result.nodes.length,
    warnings: result.warnings,
    nodes: result.nodes,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  printUsage();
  process.exit(1);
}
