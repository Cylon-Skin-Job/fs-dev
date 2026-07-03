/**
 * @module source-folder-service
 * @role Read and persist the macOS screenshot source folder path.
 *
 * The source folder is where macOS writes screenshots taken with system
 * hotkeys (Cmd+Shift+3/4/5). We read it from the macOS defaults registry
 * and cache it in SQLite so the hotkey watcher knows where to listen.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const { getDb } = require('../db');

const DEFAULT_SOURCE_FOLDER = path.join(os.homedir(), 'Desktop');
const RECORD_ID = 1;

function expandTilde(input) {
  if (typeof input !== 'string') return input;
  if (input.startsWith('~')) {
    return path.join(os.homedir(), input.slice(1));
  }
  return input;
}

async function readMacScreenshotFolder() {
  return new Promise((resolve) => {
    exec('defaults read com.apple.screencapture location', (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(DEFAULT_SOURCE_FOLDER);
        return;
      }
      const configured = stdout.trim();
      resolve(expandTilde(configured));
    });
  });
}

async function refresh() {
  const sourcePath = await readMacScreenshotFolder();
  const normalized = path.resolve(sourcePath);

  const db = getDb();
  const existing = await db('screenshot_source_folder').where('id', RECORD_ID).first();

  if (existing && existing.path === normalized) {
    return normalized;
  }

  await db('screenshot_source_folder')
    .insert({
      id: RECORD_ID,
      path: normalized,
      updated_at: Date.now(),
    })
    .onConflict('id')
    .merge(['path', 'updated_at']);

  console.log(`[ScreenshotSource] Registered source folder: ${normalized}`);
  return normalized;
}

async function get() {
  const db = getDb();
  const row = await db('screenshot_source_folder').where('id', RECORD_ID).first();
  return row ? row.path : null;
}

module.exports = {
  refresh,
  get,
  DEFAULT_SOURCE_FOLDER,
};
