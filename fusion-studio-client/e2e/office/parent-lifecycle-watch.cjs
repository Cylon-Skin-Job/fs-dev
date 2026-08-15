'use strict'

function processIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 1) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

function parentLossError(role, expectedParentPid, currentParentPid) {
  const error = new Error(
    `Office E2E ${role} parent lost: expected=${expectedParentPid} current=${currentParentPid}`,
  )
  error.code = 'OFFICE_E2E_PARENT_LOST'
  error.role = role
  error.expectedParentPid = expectedParentPid
  error.currentParentPid = currentParentPid
  return error
}

function createParentLifecycleWatch(options = {}) {
  const role = options.role
  if (typeof role !== 'string' || role.length === 0) {
    throw new TypeError('Office E2E parent watch requires a role')
  }
  const expectedParentPid = options.expectedParentPid ?? process.ppid
  const readParentPid = options.readParentPid ?? (() => process.ppid)
  const isAlive = options.isAlive ?? processIsAlive
  const intervalMs = options.intervalMs ?? 250
  if (!Number.isSafeInteger(expectedParentPid) || expectedParentPid < 0) {
    throw new TypeError('Office E2E parent watch requires a valid initial parent PID')
  }
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 10 || intervalMs > 60_000) {
    throw new TypeError('Office E2E parent watch interval is out of bounds')
  }

  let stopped = false
  let loss = null
  let resolveLoss
  const lost = new Promise((resolve) => { resolveLoss = resolve })

  const checkNow = () => {
    if (stopped || loss) return loss
    const currentParentPid = readParentPid()
    if (
      expectedParentPid <= 1
      || currentParentPid !== expectedParentPid
      || !isAlive(expectedParentPid)
    ) {
      loss = parentLossError(role, expectedParentPid, currentParentPid)
      clearInterval(timer)
      resolveLoss(loss)
    }
    return loss
  }
  const timer = setInterval(checkNow, intervalMs)
  timer.unref?.()
  queueMicrotask(checkNow)

  return Object.freeze({
    expectedParentPid,
    lost,
    checkNow,
    race(promise) {
      if (stopped) return Promise.resolve(promise)
      const immediateLoss = checkNow()
      if (immediateLoss) return Promise.reject(immediateLoss)
      return Promise.race([
        Promise.resolve(promise),
        lost.then((error) => { throw error }),
      ])
    },
    stop() {
      if (stopped) return
      stopped = true
      clearInterval(timer)
    },
  })
}

module.exports = {
  createParentLifecycleWatch,
  parentLossError,
  processIsAlive,
}
