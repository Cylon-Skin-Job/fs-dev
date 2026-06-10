#!/usr/bin/env node
/**
 * Downloads the Transformers.js-compatible Gwen/Qwen model snapshot into
 * electron/resources/models/gwen-0-8b/. Idempotent: skips when the required
 * marker files already exist for the expected underlying model.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_ID = 'onnx-community/Qwen3-0.6B-ONNX';
const REVISION = 'main';
const TARGET_DIR = path.join(__dirname, '..', 'electron', 'resources', 'models', 'gwen-0-8b');
const MODEL_MARKER = path.join(TARGET_DIR, '.model-id');
const REQUIRED_FILES = [
  'config.json',
  'added_tokens.json',
  'special_tokens_map.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'generation_config.json',
  'onnx/model_q4f16.onnx',
];

// TODO: add SHA256 verification when exact release checksums are pinned.
const SHA256_BY_FILE = {};

function hasRequiredFiles() {
  if (!fs.existsSync(MODEL_MARKER) || fs.readFileSync(MODEL_MARKER, 'utf8').trim() !== MODEL_ID) {
    return false;
  }

  return REQUIRED_FILES.every((file) => {
    const fullPath = path.join(TARGET_DIR, file);
    return fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0;
  });
}

function clearStaleModelFiles() {
  if (!fs.existsSync(TARGET_DIR)) return;
  const currentModelId = fs.existsSync(MODEL_MARKER)
    ? fs.readFileSync(MODEL_MARKER, 'utf8').trim()
    : null;

  if (currentModelId === MODEL_ID) return;

  console.log(`[download-gwen-model] Replacing stale model snapshot: ${currentModelId || 'unknown'} -> ${MODEL_ID}`);
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
}

function requestJson(url) {
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

          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          });
        })
        .on('error', reject);
    };
    follow(url, 5);
  });
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

function encodePath(filePath) {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

function validateTree(files) {
  const paths = new Set(files.map((file) => file.path));
  const missing = REQUIRED_FILES.filter((file) => !paths.has(file));
  if (missing.length > 0) {
    throw new Error(
      `Model repo is missing expected Transformers.js files: ${missing.join(', ')}. ` +
        `Update REQUIRED_FILES before using this script for ${MODEL_ID}.`
    );
  }
}

(async () => {
  try {
    if (hasRequiredFiles()) {
      console.log(`[download-gwen-model] Already present: ${TARGET_DIR}`);
      return;
    }

    clearStaleModelFiles();
    fs.mkdirSync(TARGET_DIR, { recursive: true });

    const treeUrl = `https://huggingface.co/api/models/${MODEL_ID}/tree/${REVISION}?recursive=1`;
    console.log(`[download-gwen-model] Reading model file list: ${MODEL_ID}`);
    const tree = await requestJson(treeUrl);
    const files = tree.filter((entry) => entry.type === 'file' && REQUIRED_FILES.includes(entry.path));
    validateTree(files);

    for (const file of files) {
      const targetPath = path.join(TARGET_DIR, file.path);
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
        continue;
      }
      if (SHA256_BY_FILE[file.path]) {
        // Placeholder until checksums are pinned.
      }
      const url = `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}/${encodePath(file.path)}`;
      console.log(`[download-gwen-model] Downloading ${file.path}`);
      await download(url, targetPath);
    }

    if (!hasRequiredFiles()) {
      fs.writeFileSync(MODEL_MARKER, `${MODEL_ID}\n`);
    }

    if (!hasRequiredFiles()) {
      throw new Error('Download finished but required model files are incomplete');
    }

    console.log(`[download-gwen-model] Installed: ${TARGET_DIR}`);
  } catch (err) {
    console.error(`[download-gwen-model] FAILED: ${err.message}`);
    process.exit(1);
  }
})();
