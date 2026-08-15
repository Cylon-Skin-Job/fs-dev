'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [root, parentPidText] = process.argv.slice(2);
const parentPid = Number(parentPidText);
const rootParent = root ? path.dirname(root) : '';
if (
  !root
  || fs.realpathSync(rootParent) !== fs.realpathSync(os.tmpdir())
  || !/^fusion-office-preload-sandbox-[A-Za-z0-9]{6}$/.test(path.basename(root))
  || !Number.isSafeInteger(parentPid)
  || parentPid <= 0
) {
  throw new Error('Invalid sandbox cleanup target');
}

const deadline = Date.now() + 30_000;
const timer = setInterval(() => {
  let parentRunning = true;
  try {
    process.kill(parentPid, 0);
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
    parentRunning = false;
  }
  if (parentRunning && Date.now() < deadline) return;
  clearInterval(timer);
  if (parentRunning) throw new Error(`Sandbox parent ${parentPid} did not exit`);
  fs.rmSync(root, { force: true, recursive: true });
}, 10);
