#!/usr/bin/env node
'use strict';

const { initDb, getDb, closeDb } = require('../lib/db');
const { listRecentEvents } = require('../lib/ledger/event-ledger');

function parseArgs(argv) {
  const args = { limit: 20 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--event-type') args.eventType = argv[++i];
    else if (arg === '--workspace-id') args.workspaceId = argv[++i];
    else if (arg === '--machine-id') args.machineId = argv[++i];
  }
  return args;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await initDb();
  const rows = await listRecentEvents(getDb(), options);
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
