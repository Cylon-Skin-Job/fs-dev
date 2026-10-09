import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = path.resolve(moduleDirectory, '..', '..')
const packageJson = JSON.parse(fs.readFileSync(path.join(clientRoot, 'package.json'), 'utf8'))
assert.ok(packageJson.build?.files?.includes('electron/**/*'), 'build.files must include electron/**/*')

function findApps(root) {
  const found = []
  const visit = (candidate) => {
    for (const name of fs.readdirSync(candidate)) {
      const child = path.join(candidate, name)
      const stat = fs.lstatSync(child)
      if (stat.isSymbolicLink()) continue
      if (!stat.isDirectory()) continue
      if (name.endsWith('.app')) found.push(child)
      else visit(child)
    }
  }
  visit(root)
  return found
}

function runPackagedSmoke(executable, smokeModule, asarPath, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [smokeModule, asarPath], {
      env: { ...process.env, ...environment, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error('Packaged Office module smoke timed out'))
    }, 120_000)
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    })
    child.once('close', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (code !== 0 || signal !== null) {
        reject(new Error(`Packaged Office module smoke failed (${code}/${signal}): ${stderr || stdout}`))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

const releaseRoot = path.join(clientRoot, packageJson.build.directories.output)
assert.equal(fs.statSync(releaseRoot).isDirectory(), true, 'Configured release root is missing')
const apps = findApps(releaseRoot)
assert.deepEqual(apps.map((candidate) => path.basename(candidate)), ['Fusion Studio.app'])
const appPath = apps[0]
const asarPath = path.join(appPath, 'Contents', 'Resources', 'app.asar')
const executable = path.join(appPath, 'Contents', 'MacOS', 'Fusion Studio')
const pandoc = path.join(appPath, 'Contents', 'Resources', 'pandoc', process.platform, 'pandoc')
assert.equal(fs.statSync(asarPath).isFile(), true)
assert.equal(fs.statSync(executable).isFile(), true)
assert.equal(fs.statSync(pandoc).isFile(), true)

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-packaged-smoke-'))
try {
  const result = await runPackagedSmoke(
    executable,
    path.join(moduleDirectory, 'packaged-office-modules-smoke.mjs'),
    asarPath,
    { OFFICE_PACKAGED_PANDOC: pandoc, OFFICE_PACKAGED_TEMP: temporaryRoot },
  )
  const lines = result.stdout.trim().split(/\r?\n/)
  const evidence = JSON.parse(lines.at(-1))
  assert.deepEqual(evidence, {
    packagedOfficeModules: true,
    tableHash: '9cd92a1a53633cf73d738d403142874f1b6a2018dadb16d5fd163bdcea6966b1',
    logicalWidth: 2,
    htmlTables: 1,
    docxTables: 1,
  })
  assert.deepEqual(fs.readdirSync(temporaryRoot), [])
  console.log(`PACKAGED_OFFICE_MODULES_OK=${appPath}`)
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}
