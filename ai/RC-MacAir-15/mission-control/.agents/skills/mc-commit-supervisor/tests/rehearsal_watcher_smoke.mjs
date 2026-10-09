// Observe the unchanged ordinary watcher through its persisted event ledger.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const require = createRequire(path.join(config.candidate, 'fusion-studio-server/package.json'));
const Database = require('better-sqlite3');
const relative = config.watcherProofRelative || `ai/${config.machine}/watcher-proof.md`;
assert(relative.startsWith(`ai/${config.machine}/`) && !relative.split('/').some((p) => ['', '.', '..'].includes(p)),
  'watcher probe must be an exact owned machine leaf');
const leaf = path.join(config.workspace, relative);
assert(!fs.existsSync(leaf), 'owned watcher leaf must start absent');
const db = new Database(path.join(config.profile, 'server-data/fusion.db'), { readonly: true });
const before = db.prepare('SELECT coalesce(max(created_at),0) AS time FROM event_log').get().time;
fs.writeFileSync(leaf, '# Watcher sample\n\nA private fixture document was created.\n');
try {
  let row;
  for (let i = 0; i < 100; i += 1) {
    row = db.prepare("SELECT * FROM event_log WHERE event_type='file:changed' AND source_module='workspace-watcher' AND created_at>? ORDER BY created_at DESC")
      .all(before).find((entry) => JSON.parse(entry.payload_json).filePath === relative);
    if (row) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(row, 'ordinary watcher must observe the actual private leaf');
  const payload = JSON.parse(row.payload_json);
  assert.equal(payload.projectRoot, config.workspace);
  assert.equal(row.workspace_id, 'rehearsal-workspace');
  assert.equal(row.machine_name, config.machine);
  assert.equal(payload.event, 'create');
  fs.writeFileSync(process.argv[3], `${JSON.stringify({ kind: 'ACTUAL_ORDINARY_WATCHER_READBACK', before, row,
    leaf, bytes: fs.readFileSync(leaf, 'utf8'), isolatedProvenanceMode: false }, null, 2)}\n`);
} finally { db.close(); }
