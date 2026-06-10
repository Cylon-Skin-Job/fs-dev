#!/usr/bin/env node
/**
 * Downloads or reuses the Whisper large-v3-turbo model for Electron resources.
 * Idempotent: skips when electron/resources/models/whisper/ggml-large-v3-turbo.bin exists.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const MODEL_FILE = 'ggml-large-v3-turbo.bin';
const TARGET_DIR = path.join(__dirname, '..', 'electron', 'resources', 'models', 'whisper');
const TARGET_FILE = path.join(TARGET_DIR, MODEL_FILE);
const LOCAL_CACHE_FILE = path.join(os.homedir(), '.whisper', MODEL_FILE);
const DOWNLOAD_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin';

// TODO: add SHA256 verification when the exact model checksum is pinned.
const EXPECTED_SHA256 = null;

function hasTargetFile() {
  return fs.existsSync(TARGET_FILE) && fs.statSync(TARGET_FILE).size > 0;
}

function linkOrCopy(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.linkSync(sourcePath, targetPath);
    return 'linked';
  } catch {
    fs.copyFileSync(sourcePath, targetPath);
    return 'copied';
  }
}

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl, redirectsLeft) => {
      https
        .get(currentUrl, { headers: { 'User-Agent': 'fusion-studio-model-prep' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectsLeft <= 0) {
              reject(new Error('Too many redirects'));
              return;
            }
            const nextUrl = new URL(res.headers.location, currentUrl).toString();
            res.resume();
            follow(nextUrl, redirectsLeft - 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} fetching ${currentUrl}`));
            res.resume();
            return;
          }

          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          const tmpPath = `${destPath}.tmp`;
          const file = fs.createWriteStream(tmpPath);
          const cleanup = () => fs.rmSync(tmpPath, { force: true });
          res.pipe(file);
          file.on('finish', () => {
            file.close(() => {
              fs.renameSync(tmpPath, destPath);
              resolve();
            });
          });
          file.on('error', (err) => {
            cleanup();
            reject(err);
          });
          res.on('error', (err) => {
            file.destroy();
            cleanup();
            reject(err);
          });
        })
        .on('error', reject);
    };
    follow(url, 5);
  });
}

(async () => {
  try {
    if (hasTargetFile()) {
      console.log(`[download-whisper-model] Already present: ${TARGET_FILE}`);
      return;
    }

    if (fs.existsSync(LOCAL_CACHE_FILE) && fs.statSync(LOCAL_CACHE_FILE).size > 0) {
      const action = linkOrCopy(LOCAL_CACHE_FILE, TARGET_FILE);
      console.log(`[download-whisper-model] ${action}: ${LOCAL_CACHE_FILE} -> ${TARGET_FILE}`);
      return;
    }

    if (EXPECTED_SHA256) {
      // Placeholder until checksum verification is enabled.
    }
    console.log(`[download-whisper-model] Downloading ${DOWNLOAD_URL}`);
    await download(DOWNLOAD_URL, TARGET_FILE);

    if (!hasTargetFile()) {
      throw new Error('Download finished but target model file is missing or empty');
    }

    console.log(`[download-whisper-model] Installed: ${TARGET_FILE}`);
  } catch (err) {
    console.error(`[download-whisper-model] FAILED: ${err.message}`);
    process.exit(1);
  }
})();
