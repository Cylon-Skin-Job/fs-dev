import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { markOwnedDirectory } from './fixture-lifecycle.mjs';

const require = createRequire(import.meta.url);
const Database = require('../../../fusion-studio-server/node_modules/better-sqlite3');
const [token, behavior, root, receiptPath] = process.argv.slice(2);
if (!token || !behavior || !root || !receiptPath) throw new Error('probe arguments are required');

markOwnedDirectory(root, token, 'lifecycle-probe');
const dbPath = path.join(root, 'fixture.db');
const db = new Database(dbPath);
db.exec('CREATE TABLE proof (value TEXT NOT NULL); INSERT INTO proof VALUES (\'open\')');
const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', token], {
  stdio: 'ignore',
});
fs.writeFileSync(receiptPath, `${JSON.stringify({ phase: 'running', dbPath, probePid: process.pid, grandchildPid: grandchild.pid })}\n`);

let cleaning = false;
async function cleanup(reason) {
  if (cleaning) return;
  cleaning = true;
  db.close();
  if (grandchild.exitCode === null && grandchild.signalCode === null) grandchild.kill('SIGTERM');
  await new Promise((resolve) => {
    if (grandchild.exitCode !== null || grandchild.signalCode !== null) return resolve();
    const timer = setTimeout(resolve, 1_000);
    grandchild.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  fs.rmSync(root, { recursive: true, force: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify({
    phase: 'clean', reason, dbClosed: !db.open, profileRemoved: !fs.existsSync(root),
    probePid: process.pid, grandchildPid: grandchild.pid,
  })}\n`);
}

process.on('SIGTERM', () => { void cleanup('timeout').then(() => process.exit(124)); });
process.on('SIGINT', () => { void cleanup('interrupt').then(() => process.exit(130)); });

try {
  if (behavior === 'success') await new Promise((resolve) => setTimeout(resolve, 30));
  else if (behavior === 'assertion') throw new Error('intentional assertion failure');
  else if (behavior === 'hang') await new Promise(() => {});
  else throw new Error(`unknown behavior: ${behavior}`);
  await cleanup('success');
} catch (error) {
  await cleanup('assertion');
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
