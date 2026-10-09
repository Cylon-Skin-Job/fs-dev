'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')

const PRESENTATION_OUTPUT_APP_NAME = 'Fusion Studio E2E — Presentation Output'
const PRESENTATION_OUTPUT_APP_BUNDLE_IDENTIFIER_PREFIX = 'studio.fusion.e2e.presentation-output'
const PRESENTATION_OUTPUT_WINDOW_TITLE = PRESENTATION_OUTPUT_APP_NAME

function runChecked(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 120_000,
  })
  if (result.error) throw result.error
  if (result.status !== 0 || result.signal !== null) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(
      `Presentation-output app identity command failed (${command} ${args.join(' ')}): ${detail}`,
    )
  }
  return result.stdout.trim()
}

function electronAppFromExecutable(executable) {
  let cursor = path.resolve(executable)
  while (path.dirname(cursor) !== cursor) {
    if (path.extname(cursor) === '.app') return cursor
    cursor = path.dirname(cursor)
  }
  throw new Error(`Electron executable is not inside a macOS app bundle: ${executable}`)
}

function readBundleValue(plistPath, key) {
  return runChecked('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plistPath])
}

function assertDirectory(candidate, label) {
  const stat = fs.lstatSync(candidate)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a nonsymlink directory: ${candidate}`)
  }
}

function materializePresentationOutputElectronApp(sourceExecutable, destinationRoot) {
  if (process.platform !== 'darwin') {
    throw new Error('Presentation-output macOS app identity requires Darwin')
  }
  const sourceApp = electronAppFromExecutable(sourceExecutable)
  assertDirectory(sourceApp, 'Source Electron app bundle')
  assertDirectory(destinationRoot, 'Presentation-output identity root')
  const canonicalDestinationRoot = fs.realpathSync(destinationRoot)
  const runSuffix = createHash('sha256').update(canonicalDestinationRoot).digest('hex').slice(0, 12)
  const bundleIdentifier = `${PRESENTATION_OUTPUT_APP_BUNDLE_IDENTIFIER_PREFIX}.${runSuffix}`
  const sourcePlist = path.join(sourceApp, 'Contents', 'Info.plist')
  const sourceExecutableName = readBundleValue(sourcePlist, 'CFBundleExecutable')
  const sourceBundleIdentifier = readBundleValue(sourcePlist, 'CFBundleIdentifier')
  if (sourceBundleIdentifier === bundleIdentifier) {
    throw new Error('Source Electron app already has the reserved presentation-output identity')
  }

  const appPath = path.join(destinationRoot, `${PRESENTATION_OUTPUT_APP_NAME}.app`)
  if (fs.existsSync(appPath)) throw new Error(`Presentation-output app already exists: ${appPath}`)
  fs.cpSync(sourceApp, appPath, {
    recursive: true,
    dereference: false,
    errorOnExist: true,
    force: false,
    mode: fs.constants.COPYFILE_FICLONE,
    preserveTimestamps: true,
    verbatimSymlinks: true,
  })

  const plistPath = path.join(appPath, 'Contents', 'Info.plist')
  for (const [key, value] of [
    ['CFBundleIdentifier', bundleIdentifier],
    ['CFBundleName', PRESENTATION_OUTPUT_APP_NAME],
    ['CFBundleDisplayName', PRESENTATION_OUTPUT_APP_NAME],
  ]) {
    runChecked('/usr/bin/plutil', ['-replace', key, '-string', value, plistPath])
  }
  runChecked('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath])
  runChecked('/usr/bin/codesign', ['--verify', '--deep', '--strict', appPath])

  const executablePath = path.join(appPath, 'Contents', 'MacOS', sourceExecutableName)
  if (!fs.statSync(executablePath).isFile()) {
    throw new Error(`Materialized presentation-output executable is missing: ${executablePath}`)
  }
  if (readBundleValue(plistPath, 'CFBundleIdentifier') !== bundleIdentifier
    || readBundleValue(plistPath, 'CFBundleName') !== PRESENTATION_OUTPUT_APP_NAME
    || readBundleValue(plistPath, 'CFBundleDisplayName') !== PRESENTATION_OUTPUT_APP_NAME) {
    throw new Error('Materialized presentation-output app identity did not persist')
  }
  if (readBundleValue(sourcePlist, 'CFBundleIdentifier') !== sourceBundleIdentifier) {
    throw new Error('Source Electron app identity changed during materialization')
  }

  return Object.freeze({
    appName: PRESENTATION_OUTPUT_APP_NAME,
    appPath,
    bundleIdentifier,
    executablePath,
    sourceApp,
    sourceBundleIdentifier,
    windowTitle: PRESENTATION_OUTPUT_WINDOW_TITLE,
  })
}

function applyPresentationOutputAppIdentity(app) {
  app.setName(PRESENTATION_OUTPUT_APP_NAME)
  app.on('browser-window-created', (_event, window) => {
    window.setTitle(PRESENTATION_OUTPUT_WINDOW_TITLE)
    window.webContents.on('page-title-updated', (event) => {
      event.preventDefault()
      window.setTitle(PRESENTATION_OUTPUT_WINDOW_TITLE)
    })
  })
}

module.exports = Object.freeze({
  PRESENTATION_OUTPUT_APP_BUNDLE_IDENTIFIER_PREFIX,
  PRESENTATION_OUTPUT_APP_NAME,
  PRESENTATION_OUTPUT_WINDOW_TITLE,
  applyPresentationOutputAppIdentity,
  materializePresentationOutputElectronApp,
})
