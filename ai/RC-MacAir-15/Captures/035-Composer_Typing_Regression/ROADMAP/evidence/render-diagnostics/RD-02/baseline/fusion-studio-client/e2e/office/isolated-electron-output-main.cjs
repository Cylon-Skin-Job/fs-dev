'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {
  PRESENTATION_OUTPUT_APP_NAME,
  applyPresentationOutputAppIdentity,
} = require('./presentation-output-app-identity.cjs')
const { createParentLifecycleWatch } = require('./parent-lifecycle-watch.cjs')

function sanitizedFilename(item) {
  const requested = path.basename(item.getFilename()).replace(/[^a-zA-Z0-9._ ()-]/g, '_')
  if (!requested || requested === '.' || requested === '..') {
    throw new Error('Renderer download has no safe filename')
  }
  return requested
}

function createDownloadSink({ canonicalOutput, fail, ledger, writeLedger }) {
  const reservedNames = new Set()
  const installedSessions = new WeakSet()
  return function installDownloadSink(targetSession) {
    if (installedSessions.has(targetSession)) return
    installedSessions.add(targetSession)
    targetSession.on('will-download', (_event, item) => {
      let filename
      try {
        filename = sanitizedFilename(item)
        if (reservedNames.has(filename)) throw new Error(`Colliding renderer download: ${filename}`)
        reservedNames.add(filename)
        const savePath = path.join(canonicalOutput, filename)
        const relative = path.relative(canonicalOutput, savePath)
        if (relative.startsWith('..') || path.isAbsolute(relative) || fs.existsSync(savePath)) {
          throw new Error(`Unsafe or colliding renderer download: ${filename}`)
        }
        item.setSavePath(savePath)
        item.once('done', (_doneEvent, state) => {
          if (state !== 'completed') {
            fail(`Renderer download ${filename} finished as ${state}`)
            return
          }
          try {
            const stat = fs.statSync(savePath)
            if (!stat.isFile() || stat.size === 0) throw new Error('download is missing or empty')
            ledger.downloads.push({ filename, state, bytes: stat.size })
            writeLedger()
          } catch (error) {
            fail(`Renderer download ${filename} failed verification: ${error.message}`)
          }
        })
      } catch (error) {
        item.cancel()
        fail(error.message)
      }
    })
  }
}

function runWrapper() {
  const { app, session } = require('electron')
  const outputDirectory = process.env.FUSION_OFFICE_E2E_OUTPUT_DIR
  const ledgerPath = process.env.FUSION_OFFICE_E2E_DOWNLOAD_LEDGER
  const productionMain = process.env.FUSION_OFFICE_E2E_PRODUCTION_MAIN
  if (!outputDirectory || !ledgerPath || !productionMain) {
    throw new Error('Presentation-output wrapper requires output, ledger, and production-main paths')
  }
  const canonicalOutput = fs.realpathSync(outputDirectory)
  const ledger = { downloads: [], errors: [] }
  let failed = false
  const launcherParentWatch = createParentLifecycleWatch({
    role: 'presentation-output-electron-wrapper',
  })
  function writeLedger() {
    const temporary = `${ledgerPath}.partial`
    fs.writeFileSync(temporary, `${JSON.stringify(ledger)}\n`)
    fs.renameSync(temporary, ledgerPath)
  }
  function fail(message) {
    ledger.errors.push(message)
    if (failed) return
    failed = true
    process.exitCode = 1
    try {
      writeLedger()
    } catch (error) {
      try {
        fs.writeSync(process.stderr.fd, `OFFICE_E2E_WRAPPER_LEDGER_FAILURE=${error.code ?? error.message}\n`)
      } catch {}
    } finally {
      setImmediate(() => app.exit(1))
    }
  }
  const installDownloadSink = createDownloadSink({ canonicalOutput, fail, ledger, writeLedger })
  launcherParentWatch.lost.then((error) => {
    fail(`${error.code} role=${error.role} expectedParentPid=${error.expectedParentPid} currentParentPid=${error.currentParentPid}`)
  })
  app.on('session-created', installDownloadSink)
  app.whenReady().then(() => installDownloadSink(session.defaultSession)).catch((error) => fail(error.message))
  app.on('will-quit', () => {
    try { writeLedger() } catch {}
  })
  app.on('will-quit', () => launcherParentWatch.stop())
  applyPresentationOutputAppIdentity(app)
  require(productionMain)
  // Production deliberately sets its normal name during module initialization.
  // Reassert the test-only wrapper identity before Electron reaches readiness.
  app.setName(PRESENTATION_OUTPUT_APP_NAME)
}

module.exports = { createDownloadSink, sanitizedFilename }

if (require.main === module || process.env.FUSION_OFFICE_E2E_PRODUCTION_MAIN) runWrapper()
