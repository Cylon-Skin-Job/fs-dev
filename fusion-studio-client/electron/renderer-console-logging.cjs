'use strict'

const CLOSED_OUTPUT_ERROR_CODES = new Set([
  'EPIPE',
  'ERR_STREAM_DESTROYED',
  'ERR_STREAM_PREMATURE_CLOSE',
  'ERR_STREAM_WRITE_AFTER_END',
])

function isClosedOutputError(error) {
  return Boolean(error && CLOSED_OUTPUT_ERROR_CODES.has(error.code))
}

function outputIsClosed(output) {
  return !output
    || output.destroyed === true
    || output.closed === true
    || output.writable === false
    || output.writableEnded === true
    || output.writableFinished === true
}

function surfaceAsUncaught(error) {
  // A meaningful async stream error should retain normal fatal visibility,
  // but only after the write-scoped guard has had its settlement phase to
  // detach. The nested immediate is bounded and does not extend idle life.
  setImmediate(() => {
    setImmediate(() => {
      throw error
    })
  })
}

function createWriteScopedOutputForwarder(output, options = {}) {
  const reportNonClosedError = options.reportNonClosedError ?? surfaceAsUncaught
  let disabled = false
  let activeWrites = 0
  let listenerAttached = false
  let awaitingErrorEvent = false
  const handledErrors = new WeakSet()

  const detach = () => {
    if (!listenerAttached) return
    listenerAttached = false
    output.removeListener('error', onError)
  }
  const handleError = (error) => {
    if (error && typeof error === 'object') {
      if (handledErrors.has(error)) return
      handledErrors.add(error)
    }
    // Once a write has started, the concrete error is authoritative. Node
    // marks a Writable destroyed for meaningful failures such as ENOSPC too.
    if (isClosedOutputError(error)) {
      disabled = true
      return
    }
    reportNonClosedError(error)
  }
  const onError = (error) => {
    awaitingErrorEvent = false
    handleError(error)
    if (activeWrites === 0) detach()
  }

  const attach = () => {
    if (listenerAttached) return
    listenerAttached = true
    output.on('error', onError)
  }

  const settleWrite = (error) => {
    if (error) {
      awaitingErrorEvent = true
      handleError(error)
    }
    activeWrites -= 1
    if (activeWrites !== 0) return
    if (!awaitingErrorEvent) {
      detach()
      return
    }
    // Writable streams may emit their matching `error` after the write
    // callback. Keep this single guard through the next event-loop phase, then
    // detach even if a nonstandard stream never emits the event.
    setImmediate(() => {
      if (activeWrites === 0) {
        awaitingErrorEvent = false
        detach()
      }
    })
  }

  return Object.freeze({
    get disabled() {
      return disabled
    },

    write(entry) {
      if (disabled) return false
      if (outputIsClosed(output)) {
        disabled = true
        return false
      }

      attach()
      activeWrites += 1
      try {
        output.write(entry, settleWrite)
      } catch (error) {
        activeWrites -= 1
        if (activeWrites === 0) detach()
        if (isClosedOutputError(error)) {
          disabled = true
          return false
        }
        throw error
      }
      return true
    },
  })
}

function createRendererConsoleLogger({
  appendFileSync,
  rendererLog,
  reportNonClosedError,
  stdout,
}) {
  const forwarder = createWriteScopedOutputForwarder(stdout, { reportNonClosedError })
  const levels = ['verbose', 'info', 'warn', 'error']

  return Object.freeze({
    forwarder,
    log(level, message, line, sourceId) {
      const tag = levels[level] ?? 'log'
      const entry = `[renderer:${tag}] ${message}  (${sourceId}:${line})\n`
      // File logging is the durable diagnostic path and must not depend on the
      // launcher's stdout pipe still being writable.
      try { appendFileSync(rendererLog, entry) } catch {}
      forwarder.write(entry)
      return entry
    },
  })
}

module.exports = {
  createRendererConsoleLogger,
  createWriteScopedOutputForwarder,
  isClosedOutputError,
  outputIsClosed,
}
