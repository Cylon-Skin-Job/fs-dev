#!/usr/bin/env node
/**
 * Downloads the Pandoc binary for the current platform and places it at
 * electron/resources/pandoc/<platform>/pandoc(.exe). Idempotent — skips if
 * the target binary already exists.
 *
 * No npm deps: shells out to system `unzip`, `tar`, or PowerShell Expand-Archive.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const PANDOC_VERSION = '3.9.0.2';

const platform = process.platform;
const arch = process.arch;

function resolveSpec() {
  const base = `https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}`;
  if (platform === 'darwin') {
    const macArch = arch === 'arm64' ? 'arm64' : 'x86_64';
    return {
      url: `${base}/pandoc-${PANDOC_VERSION}-${macArch}-macOS.zip`,
      archive: 'zip',
      binName: 'pandoc',
    };
  }
  if (platform === 'win32') {
    return {
      url: `${base}/pandoc-${PANDOC_VERSION}-windows-x86_64.zip`,
      archive: 'zip',
      binName: 'pandoc.exe',
    };
  }
  if (platform === 'linux') {
    const linuxArch = arch === 'arm64' ? 'arm64' : 'amd64';
    return {
      url: `${base}/pandoc-${PANDOC_VERSION}-linux-${linuxArch}.tar.gz`,
      archive: 'tar.gz',
      binName: 'pandoc',
    };
  }
  return null;
}

const spec = resolveSpec();
if (!spec) {
  console.error(`[download-pandoc] Unsupported platform: ${platform}/${arch}`);
  process.exit(1);
}

const RESOURCES_DIR = path.join(__dirname, '..', 'electron', 'resources', 'pandoc', platform);
const TARGET_BIN = path.join(RESOURCES_DIR, spec.binName);

if (fs.existsSync(TARGET_BIN)) {
  console.log(`[download-pandoc] Already present: ${TARGET_BIN}`);
  process.exit(0);
}

fs.mkdirSync(RESOURCES_DIR, { recursive: true });

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl, redirectsLeft) => {
      https
        .get(currentUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectsLeft <= 0) {
              reject(new Error('Too many redirects'));
              return;
            }
            res.resume();
            follow(res.headers.location, redirectsLeft - 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} fetching ${currentUrl}`));
            res.resume();
            return;
          }
          const file = fs.createWriteStream(destPath);
          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
          file.on('error', reject);
        })
        .on('error', reject);
    };
    follow(url, 5);
  });
}

function extract(archivePath, archiveType, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  let result;
  if (archiveType === 'zip') {
    if (platform === 'win32') {
      result = spawnSync(
        'powershell',
        ['-Command', `Expand-Archive -Force -Path "${archivePath}" -DestinationPath "${destDir}"`],
        { stdio: 'inherit' }
      );
    } else {
      result = spawnSync('unzip', ['-o', '-q', archivePath, '-d', destDir], { stdio: 'inherit' });
    }
  } else if (archiveType === 'tar.gz') {
    result = spawnSync('tar', ['-xzf', archivePath, '-C', destDir], { stdio: 'inherit' });
  } else {
    throw new Error(`Unknown archive type: ${archiveType}`);
  }
  if (result.status !== 0) {
    throw new Error(`Extraction failed (exit ${result.status})`);
  }
}

function findBinary(rootDir, binName) {
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name === binName) {
        return full;
      }
    }
  }
  return null;
}

(async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pandoc-dl-'));
  const archivePath = path.join(tmpDir, `pandoc.${spec.archive}`);
  const extractDir = path.join(tmpDir, 'extracted');

  try {
    console.log(`[download-pandoc] Downloading ${spec.url}`);
    await download(spec.url, archivePath);

    console.log(`[download-pandoc] Extracting...`);
    extract(archivePath, spec.archive, extractDir);

    const binary = findBinary(extractDir, spec.binName);
    if (!binary) {
      throw new Error(`Could not find ${spec.binName} inside archive`);
    }

    fs.copyFileSync(binary, TARGET_BIN);
    if (platform !== 'win32') {
      fs.chmodSync(TARGET_BIN, 0o755);
    }

    console.log(`[download-pandoc] Installed: ${TARGET_BIN}`);
  } catch (err) {
    console.error(`[download-pandoc] FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
})();
