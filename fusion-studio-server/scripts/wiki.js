#!/usr/bin/env node

/**
 * The universal wiki script (wiki-audit-decisions.md, Decision 18).
 *
 * Two subcommands, one shared scanner (lib/wiki/wiki-tree.js), one
 * state file per wiki:
 *   audit — marker fills + state snapshot (change report in later phases)
 *   query — filtered scans of wiki structure and content
 *
 * Boundary: the script only reads, reports, and writes inside marker
 * blocks. No third subcommand until a need is proven.
 */

const path = require('path');

const originalCwd = process.cwd();
process.chdir(path.resolve(__dirname, '..'));

const { runAudit } = require('../lib/wiki/audit/run');
const { runQuery } = require('../lib/wiki/query/run');

function printUsage() {
  console.error(`Usage: node scripts/wiki.js <audit|query> [options]

audit [workspace-or-wiki-root]
  Fill generated marker blocks and record the audit state snapshot.
  With no path, audits every known workspace wiki.

query [options]
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

function parseQueryArgs(argv) {
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

function resolveInputPath(inputPath) {
  if (!inputPath) return null;
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(originalCwd, inputPath);
}

function auditCommand(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    return;
  }

  const inputPath = argv.length > 0 && !argv[0].startsWith('--')
    ? resolveInputPath(argv[0])
    : null;

  const report = runAudit(inputPath);

  for (const wiki of report.wikis) {
    console.log(`\n=== ${wiki.label} ===`);
    for (const event of wiki.events) {
      const tag = event.reason ? `${event.action} (${event.reason})` : event.action;
      console.log(`  ${tag}: ${event.relPath}`);
    }
    console.log(`  created: ${wiki.created}  updated: ${wiki.updated}  skipped: ${wiki.skipped}`);
  }

  console.log(`\nTotal: ${report.totals.created} created, ${report.totals.updated} updated, ${report.totals.skipped} skipped`);
}

function queryCommand(argv) {
  const options = parseQueryArgs(argv);
  if (options.help) {
    printUsage();
    return;
  }

  const output = runQuery(options);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

function main() {
  const [subcommand, ...rest] = process.argv.slice(2);

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    printUsage();
    process.exit(subcommand ? 0 : 1);
  }

  if (subcommand === 'audit') {
    auditCommand(rest);
  } else if (subcommand === 'query') {
    queryCommand(rest);
  } else {
    throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  printUsage();
  process.exit(1);
}
