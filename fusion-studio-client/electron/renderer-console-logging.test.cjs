'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const test = require('node:test')
const { Writable } = require('node:stream')

const {
  createRendererConsoleLogger,
  createWriteScopedOutputForwarder,
  sanitizeRendererConsoleMessage,
} = require('./renderer-console-logging.cjs')

class ControlledOutput extends EventEmitter {
  constructor(writeImpl = (_entry, callback) => callback()) {
    super()
    this.writeImpl = writeImpl
    this.writable = true
    this.writes = []
  }

  write(entry, callback) {
    this.writes.push(entry)
    return this.writeImpl(entry, callback)
  }
}

test('renderer file logging continues when stdout is already closed and stays disabled', () => {
  const appended = []
  const stdout = new ControlledOutput()
  stdout.destroyed = true
  const logger = createRendererConsoleLogger({
    appendFileSync: (_path, entry) => appended.push(entry),
    rendererLog: '/owned/electron-renderer.log',
    stdout,
  })

  logger.log(1, 'first', 7, 'renderer.ts')
  stdout.destroyed = false
  logger.log(2, 'second', 8, 'renderer.ts')

  assert.equal(appended.length, 2)
  assert.equal(stdout.writes.length, 0)
  assert.equal(logger.forwarder.disabled, true)
})

test('ordinary WebSocket receive diagnostics cannot persist frame fields', () => {
  const canary = 'PROMPT_PROOF_NONCE_CANARY_00B'
  const message = `[WS] Message received: thread:opened {type: thread:opened, history: ${canary}}`
  assert.equal(
    sanitizeRendererConsoleMessage(message),
    '[renderer_console]',
  )

  const appended = []
  const stdout = new ControlledOutput()
  const logger = createRendererConsoleLogger({
    appendFileSync: (_path, entry) => appended.push(entry),
    rendererLog: '/owned/electron-renderer.log',
    stdout,
  })
  logger.log(1, message, 12, 'ws-client.ts')

  assert.equal(appended.length, 1)
  assert.doesNotMatch(appended[0], new RegExp(canary))
  assert.doesNotMatch(stdout.writes[0], new RegExp(canary))
  assert.match(appended[0], /\[renderer_console\]/)
})

test('spoofed PROV prefix and child-frame source cannot authorize durable values', () => {
  const canary = 'SUBFRAME_PROOF_NONCE_CANARY_00B'
  const message = `[WS] Message received: chat-turn:diagnostic:report {diagnosticId: ${canary}}`
  const appended = []
  const stdout = new ControlledOutput()
  const logger = createRendererConsoleLogger({
    appendFileSync: (_path, entry) => appended.push(entry),
    rendererLog: '/owned/electron-renderer.log',
    stdout,
  })
  logger.log(1, message, 99, `fusion-studio://view/frame.html?proof=${canary}`)

  assert.equal(sanitizeRendererConsoleMessage(message), '[renderer_console]')
  assert.doesNotMatch(appended[0], new RegExp(canary))
  assert.doesNotMatch(stdout.writes[0], new RegExp(canary))
  assert.equal(appended[0], '[renderer:info] [renderer_console]\n')
})

test('synchronous EPIPE disables stdout without interrupting durable file logging', () => {
  const appended = []
  const stdout = new ControlledOutput(() => {
    const error = new Error('closed pipe')
    error.code = 'EPIPE'
    throw error
  })
  const logger = createRendererConsoleLogger({
    appendFileSync: (_path, entry) => appended.push(entry),
    rendererLog: '/owned/electron-renderer.log',
    stdout,
  })

  assert.doesNotThrow(() => logger.log(3, 'broken', 9, 'renderer.ts'))
  assert.doesNotThrow(() => logger.log(1, 'after', 10, 'renderer.ts'))
  assert.equal(appended.length, 2)
  assert.equal(stdout.writes.length, 1)
  assert.equal(stdout.listenerCount('error'), 0)
})

test('asynchronous closed-stream callback and error are nonfatal and detach the scoped guard', async () => {
  let callback
  const stdout = new ControlledOutput((_entry, onWrite) => {
    callback = onWrite
    return false
  })
  const reported = []
  const forwarder = createWriteScopedOutputForwarder(stdout, {
    reportNonClosedError: (error) => reported.push(error),
  })

  assert.equal(forwarder.write('entry'), true)
  assert.equal(stdout.listenerCount('error'), 1)
  const error = Object.assign(new Error('async closed pipe'), { code: 'EPIPE' })
  callback(error)
  await new Promise((resolve) => process.nextTick(() => {
    assert.equal(stdout.listenerCount('error'), 1)
    stdout.emit('error', error)
    resolve()
  }))

  assert.equal(forwarder.disabled, true)
  assert.deepEqual(reported, [])
  assert.equal(stdout.listenerCount('error'), 0)
  assert.equal(forwarder.write('later'), false)
  assert.equal(stdout.writes.length, 1)
})

test('meaningful sync and async errors remain observable', async () => {
  const syncError = Object.assign(new Error('permission denied'), { code: 'EACCES' })
  const syncOutput = new ControlledOutput(() => { throw syncError })
  const syncForwarder = createWriteScopedOutputForwarder(syncOutput)
  assert.throws(() => syncForwarder.write('entry'), syncError)
  assert.equal(syncOutput.listenerCount('error'), 0)

  let callback
  const asyncOutput = new ControlledOutput((_entry, onWrite) => {
    callback = onWrite
    return true
  })
  const reported = []
  const asyncForwarder = createWriteScopedOutputForwarder(asyncOutput, {
    reportNonClosedError: (error) => reported.push(error),
  })
  asyncForwarder.write('entry')
  const asyncError = Object.assign(new Error('disk fault'), { code: 'EIO' })
  callback(asyncError)
  await new Promise((resolve) => process.nextTick(() => {
    asyncOutput.emit('error', asyncError)
    resolve()
  }))

  assert.deepEqual(reported, [asyncError])
  assert.equal(asyncForwarder.disabled, false)
  assert.equal(asyncOutput.listenerCount('error'), 0)
})

test('successful writes attach only a write-scoped listener and later writes remain enabled', () => {
  const stdout = new ControlledOutput()
  const forwarder = createWriteScopedOutputForwarder(stdout)

  assert.equal(stdout.listenerCount('error'), 0)
  assert.equal(forwarder.write('one'), true)
  assert.equal(stdout.listenerCount('error'), 0)
  assert.equal(forwarder.write('two'), true)
  assert.deepEqual(stdout.writes, ['one', 'two'])
  assert.equal(stdout.listenerCount('error'), 0)
  assert.equal(forwarder.disabled, false)
})

test('concurrent pending writes share one scoped listener and leave no listener behind', () => {
  const callbacks = []
  const stdout = new ControlledOutput((_entry, callback) => {
    callbacks.push(callback)
    return false
  })
  const forwarder = createWriteScopedOutputForwarder(stdout)

  for (let index = 0; index < 25; index += 1) {
    assert.equal(forwarder.write(`entry-${index}`), true)
  }
  assert.equal(stdout.listenerCount('error'), 1)
  callbacks.forEach((callback) => callback())
  assert.equal(stdout.listenerCount('error'), 0)
  assert.equal(forwarder.disabled, false)
})

test('real Writable callback-to-error ordering keeps closed output nonfatal and nonclosed errors visible', async () => {
  for (const code of ['EPIPE', 'ENOSPC']) {
    const expected = Object.assign(new Error(code), { code })
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        setImmediate(() => callback(expected))
      },
    })
    const reported = []
    const forwarder = createWriteScopedOutputForwarder(output, {
      reportNonClosedError: (error) => reported.push(error),
    })
    forwarder.write('entry')
    await new Promise((resolve) => output.once('error', () => setImmediate(resolve)))

    assert.equal(output.listenerCount('error'), 0)
    if (code === 'EPIPE') {
      assert.equal(forwarder.disabled, true)
      assert.deepEqual(reported, [])
    } else {
      assert.equal(forwarder.disabled, false)
      assert.deepEqual(reported, [expected])
    }
  }
})

test('default async nonclosed error is uncaught only after its scoped listener detaches', () => {
  const helperPath = path.resolve(__dirname, 'renderer-console-logging.cjs')
  const probe = [
    "const { EventEmitter } = require('node:events')",
    `const { createWriteScopedOutputForwarder } = require(${JSON.stringify(helperPath)})`,
    'const output = new EventEmitter()',
    "output.writable = true",
    "output.write = (_entry, callback) => { const error = Object.assign(new Error('full'), { code: 'ENOSPC' }); process.nextTick(() => { callback(error); output.emit('error', error) }); return false }",
    "process.on('uncaughtException', (error) => { process.stdout.write(`UNCAUGHT=${error.code} LISTENERS=${output.listenerCount('error')}\\n`); process.exit(error.code === 'ENOSPC' && output.listenerCount('error') === 0 ? 0 : 2) })",
    "createWriteScopedOutputForwarder(output).write('entry')",
  ].join(';')
  const result = spawnSync(process.execPath, ['-e', probe], {
    encoding: 'utf8',
    timeout: 5_000,
  })

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /UNCAUGHT=ENOSPC LISTENERS=0/)
})
