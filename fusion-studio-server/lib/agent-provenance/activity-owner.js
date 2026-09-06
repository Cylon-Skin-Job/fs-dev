'use strict';

const { performance } = require('perf_hooks');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');
const { isBusy } = require('../file-mutations/sqlite-contention');
const { boundedCanonicalSha256 } = require('./bounded-canonical-hash');
const { extractOpenCodeCandidates } = require('../harness/opencode/resource-extractor');

const RESERVATION_ATTEMPTS = 5;
const RESERVATION_DEADLINE_MS = 2_000;
const sharedOwners = new WeakMap();
const sharedOwnerSet = new Set();

function immediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createZeroTimeoutReservationConnection(db) {
  const filename = db?.client?.config?.connection?.filename;
  if (typeof filename !== 'string' || !filename || filename === ':memory:') {
    throw new TypeError('File-backed database is required for the provenance reservation connection');
  }
  const connection = new Database(filename);
  connection.pragma('foreign_keys = ON');
  connection.pragma('busy_timeout = 0');
  if (Number(connection.pragma('busy_timeout', { simple: true })) !== 0) {
    connection.close();
    throw new Error('Zero-timeout provenance reservation connection is unavailable');
  }
  let disposed = false;
  return {
    acquireConnection() {
      if (disposed) throw new Error('Provenance reservation connection is closed');
      return connection;
    },
    releaseConnection() {},
    disposeConnection() {
      if (disposed) return;
      disposed = true;
      connection.close();
    },
  };
}

function createTerminalReservationGate({ now = () => performance.now(), timeoutMs = RESERVATION_DEADLINE_MS } = {}) {
  const deadline = now() + timeoutMs;
  let state = 'open';
  let resolveCancellation;
  const cancelled = new Promise((resolve) => { resolveCancellation = resolve; });
  const timer = setTimeout(() => {
    if (state === 'open') {
      state = 'cancelled';
      resolveCancellation(false);
    }
  }, Math.max(0, timeoutMs));
  timer.unref?.();
  return Object.freeze({
    deadline,
    cancelled,
    get state() { return state; },
    remaining() { return Math.max(0, deadline - now()); },
    beginCommit() {
      if (state !== 'open' || now() >= deadline) {
        if (state === 'open') {
          state = 'cancelled';
          clearTimeout(timer);
          resolveCancellation(false);
        }
        return false;
      }
      state = 'committing';
      return true;
    },
    retry() {
      if (state !== 'committing') throw new Error('reservation gate is not committing');
      state = 'open';
    },
    settle() {
      if (state === 'committing' || state === 'open') state = 'settled';
      clearTimeout(timer);
    },
    cancel() {
      if (state !== 'open') return false;
      state = 'cancelled';
      clearTimeout(timer);
      resolveCancellation(false);
      return true;
    },
  });
}

function jsonSafePersistedResult(value) {
  const text = JSON.stringify(value);
  if (text === undefined) throw new TypeError('result has no JSON representation');
  return JSON.parse(text);
}

function fingerprint(value, onDiagnostic) {
  try {
    return boundedCanonicalSha256(value);
  } catch {
    onDiagnostic('agent_tool_fingerprint_omitted');
    return null;
  }
}

function identityFor(authority, snapshot) {
  return {
    activityId: randomUUID(),
    eventId: randomUUID(),
    workspaceId: authority.workspaceId,
    threadId: authority.threadId,
    turnId: authority.turnId,
    harnessId: authority.harnessId,
    provider: authority.provider,
    toolCallId: snapshot.toolCallId,
    toolName: snapshot.toolName,
    nativeToolName: snapshot.nativeToolName,
    authorityRootSha256: authority.authorityRootSha256,
    authorityRootDevice: authority.authorityRootDevice,
    authorityRootInode: authority.authorityRootInode,
  };
}

function createAgentActivityOwner({
  db,
  activityRepository,
  acquireConnection = () => db.client.acquireConnection(),
  releaseConnection = (connection) => db.client.releaseConnection(connection),
  monotonicNow = () => performance.now(),
  onDiagnostic = () => {},
  onTerminalReserved = () => {},
  disposeConnection = null,
} = {}) {
  if (!activityRepository?.reserveTerminalSync) throw new TypeError('Synchronous activity repository port is required');
  const cleanup = new Set();
  const openGates = new Set();
  const announced = new Map();
  const announcedAuthorities = new Map();
  let accepting = true;

  function trackCleanup(promise) {
    const tracked = Promise.resolve(promise);
    cleanup.add(tracked);
    tracked.finally(() => cleanup.delete(tracked)).catch(() => {});
    return tracked;
  }

  function trackRelease(connection) {
    let released;
    try {
      released = releaseConnection(connection);
    } catch (error) {
      released = Promise.reject(error);
    }
    return trackCleanup(Promise.resolve(released).catch(() => {}));
  }

  async function reserve(
    input,
    timeoutMs = RESERVATION_DEADLINE_MS,
    beforeTransaction = null,
    isCurrent = () => true,
    allowQuiescing = false,
  ) {
    if (!accepting && !allowQuiescing) return null;
    const gate = createTerminalReservationGate({ now: monotonicNow, timeoutMs });
    openGates.add(gate);
    try {
      for (let attempt = 0; attempt < RESERVATION_ATTEMPTS; attempt += 1) {
        if (gate.state !== 'open' || gate.remaining() <= 0 || !isCurrent()) {
          gate.cancel();
          break;
        }
        let connection;
        const acquisition = Promise.resolve().then(async () => {
          if (beforeTransaction) await beforeTransaction(attempt);
          return acquireConnection();
        });
        trackCleanup(acquisition);
        const acquired = await Promise.race([acquisition, gate.cancelled]);
        if (!acquired || gate.state !== 'open' || !isCurrent()) {
          gate.cancel();
          const lateCleanup = acquisition.then((lateConnection) => {
            if (lateConnection) return releaseConnection(lateConnection);
            return undefined;
          }).catch(() => {});
          trackCleanup(lateCleanup);
          break;
        }
        connection = acquired;
        try {
          const busyTimeout = connection.pragma('busy_timeout', { simple: true });
          if (Number(busyTimeout) !== 0) {
            onDiagnostic('agent_tool_reservation_unavailable');
            gate.settle();
            return null;
          }
          if (!gate.beginCommit()) break;
          try {
            const result = activityRepository.reserveTerminalSync(connection, input);
            if (result && typeof result.then === 'function') {
              throw new TypeError('Terminal reservation transaction must be synchronous');
            }
            gate.settle();
            onTerminalReserved(result);
            return result;
          } catch (error) {
            if (!isBusy(error) || attempt === RESERVATION_ATTEMPTS - 1) throw error;
            gate.retry();
          }
        } catch (error) {
          if (!isBusy(error) || attempt === RESERVATION_ATTEMPTS - 1) {
            onDiagnostic('agent_tool_reservation_failed');
            gate.settle();
            return null;
          }
        } finally {
          // Connection disposal remains owned by the activity owner, but it
          // cannot hold legacy chat delivery past the reservation deadline.
          // Shutdown dynamically drains this tracked continuation before the
          // database owner is allowed to close.
          if (connection) trackRelease(connection);
        }
        await immediate();
      }
      onDiagnostic('agent_tool_reservation_failed');
      gate.cancel();
      return null;
    } catch {
      onDiagnostic('agent_tool_reservation_failed');
      gate.settle();
      return null;
    } finally {
      openGates.delete(gate);
    }
  }

  async function captureTerminalSnapshot(authority, snapshot, finalResult, options = {}) {
    const retained = extractOpenCodeCandidates({
      nativeToolName: snapshot.nativeToolName,
      args: snapshot.input,
      canonicalRoot: authority.canonicalRoot,
      onDiagnostic,
    });
    const argumentsSha256 = snapshot.hasInput ? fingerprint(snapshot.input, onDiagnostic) : null;
    const resultSha256 = fingerprint(finalResult, onDiagnostic);
    const observedAt = snapshot.observedAt;
    const result = await reserve({
      ...identityFor(authority, snapshot),
      status: snapshot.status,
      argumentsSha256,
      resultSha256,
      candidates: retained.candidates,
      reportedCount: retained.reportedCount,
      truncated: retained.truncated,
      announcedObservedAt: observedAt,
      executionStartedReportedAt: snapshot.executionStartedReportedAt,
      argumentsObservedAt: snapshot.hasInput ? observedAt : null,
      terminalObservedAt: observedAt,
      terminalReportedAt: snapshot.terminalReportedAt,
      terminalSnapshotReportedAt: snapshot.terminalSnapshotReportedAt,
      now: observedAt,
      }, options.timeoutMs, options.beforeTransaction, options.isCurrent);
    announced.delete(`${authority.turnId}\0${snapshot.toolCallId}`);
    announcedAuthorities.delete(`${authority.turnId}\0${snapshot.toolCallId}`);
    return result;
  }

  async function announce(authority, event) {
    if (!accepting || !authority) return null;
    const key = `${authority.turnId}\0${event.toolCallId}`;
    const identity = identityFor(authority, event);
    const record = {
      ...identity,
      input: undefined,
      hasInput: false,
      announcedObservedAt: event.observedAt,
      announcedReportedAt: event.reportedAt,
    };
    announced.set(key, record);
    announcedAuthorities.set(key, authority);
    try {
      return await activityRepository.reserveAnnounced({ ...record, now: event.observedAt });
    } catch {
      onDiagnostic('agent_tool_reservation_failed');
      return null;
    }
  }

  async function acceptArguments(authority, event) {
    if (!authority) return null;
    const key = `${authority.turnId}\0${event.toolCallId}`;
    const record = announced.get(key);
    if (!record || !event.hasCompleteArgs) return null;
    record.input = event.completeArgs;
    record.hasInput = true;
    record.argumentsSha256 = fingerprint(event.completeArgs, onDiagnostic);
    record.argumentsObservedAt = event.observedAt;
    record.argumentsReportedAt = event.reportedAt;
    try {
      return await activityRepository.reserveArguments({
        ...record,
        argumentsObservedAt: event.observedAt,
        argumentsReportedAt: event.reportedAt,
        now: event.observedAt,
      });
    } catch {
      onDiagnostic('agent_tool_reservation_failed');
      return null;
    }
  }

  async function terminalizeAnnounced(authority, event, status, finalResult, blockedBeforeExecution = false) {
    if (!authority) return null;
    const key = `${authority.turnId}\0${event.toolCallId}`;
    const record = announced.get(key);
    if (!record) return null;
    const extracted = extractOpenCodeCandidates({
      nativeToolName: record.nativeToolName,
      args: record.input,
      canonicalRoot: authority.canonicalRoot,
      onDiagnostic,
    });
    const candidates = blockedBeforeExecution
      ? extracted.candidates.map((candidate) => candidate.canonicalPath
        ? { ...candidate, reason: 'blocked_before_execution' }
        : candidate)
      : extracted.candidates;
    try {
      return await reserve({
        ...record,
        status,
        argumentsSha256: record.argumentsSha256 || null,
        resultSha256: blockedBeforeExecution ? null : fingerprint(finalResult, onDiagnostic),
        candidates,
        reportedCount: extracted.reportedCount,
        truncated: extracted.truncated,
        argumentsObservedAt: record.hasInput ? record.argumentsObservedAt : null,
        argumentsReportedAt: record.hasInput ? record.argumentsReportedAt : null,
        terminalObservedAt: event.observedAt,
        terminalReportedAt: event.reportedAt,
        now: event.observedAt,
      }, event.timeoutMs, null, () => true, true);
    } finally {
      announced.delete(key);
      announcedAuthorities.delete(key);
    }
  }

  function blockBeforeExecution(authority, event) {
    return terminalizeAnnounced(authority, event, 'blocked', undefined, true);
  }

  function complete(authority, event, finalResult) {
    return terminalizeAnnounced(authority, event, event.isError ? 'error' : 'completed', finalResult, false);
  }

  async function interruptOpen(authority, { observedAt = Date.now(), timeoutMs = RESERVATION_DEADLINE_MS } = {}) {
    if (!authority) return [];
    const records = [...announced.entries()].filter(([, record]) => record.turnId === authority.turnId);
    const results = [];
    const finalizationDeadline = monotonicNow() + timeoutMs;
    for (const [key, record] of records) {
      const retained = extractOpenCodeCandidates({
        nativeToolName: record.nativeToolName,
        args: record.input,
        canonicalRoot: authority.canonicalRoot,
        onDiagnostic,
      });
      const remaining = Math.max(0, finalizationDeadline - monotonicNow());
      results.push(remaining > 0
        ? await reserve({
          ...record,
          status: 'interrupted',
          argumentsSha256: record.argumentsSha256 || null,
          resultSha256: null,
          candidates: retained.candidates,
          reportedCount: retained.reportedCount,
          truncated: retained.truncated,
        argumentsObservedAt: record.hasInput ? record.argumentsObservedAt : null,
        argumentsReportedAt: record.hasInput ? record.argumentsReportedAt : null,
          terminalObservedAt: observedAt,
          reconciledAt: observedAt,
          now: observedAt,
        }, remaining, null, () => true, true)
        : null);
      announced.delete(key);
      announcedAuthorities.delete(key);
    }
    return results;
  }

  async function shutdown({ timeoutMs = RESERVATION_DEADLINE_MS, deadline = null } = {}) {
    accepting = false;
    const finalDeadline = Math.min(
      monotonicNow() + timeoutMs,
      Number.isFinite(deadline) ? deadline : Number.POSITIVE_INFINITY,
    );
    const authorities = new Map();
    for (const [key, authority] of announcedAuthorities) {
      authorities.set(`${authority.workspaceId}\0${authority.threadId}\0${authority.turnId}`, authority);
      if (!announced.has(key)) announcedAuthorities.delete(key);
    }
    let interruptionsDrained = authorities.size === 0;
    if (authorities.size > 0) {
      const remaining = Math.max(0, finalDeadline - monotonicNow());
      if (remaining > 0) {
        let timer;
        interruptionsDrained = await Promise.race([
          Promise.allSettled([...authorities.values()].map((authority) => interruptOpen(authority, {
            observedAt: Date.now(),
            timeoutMs: Math.max(0, finalDeadline - monotonicNow()),
          }))).then(() => monotonicNow() < finalDeadline),
          new Promise((resolve) => {
            timer = setTimeout(() => resolve(false), remaining);
            timer.unref?.();
          }),
        ]);
        if (timer) clearTimeout(timer);
      }
    }
    for (const gate of openGates) gate.cancel();
    try {
      while (cleanup.size > 0) {
        const remaining = Math.max(0, finalDeadline - monotonicNow());
        if (remaining <= 0) break;
        let timer;
        const settled = await Promise.race([
          Promise.allSettled([...cleanup]).then(() => true),
          new Promise((resolve) => {
            timer = setTimeout(() => resolve(false), remaining);
            timer.unref?.();
          }),
        ]);
        clearTimeout(timer);
        if (!settled) break;
        // Promise reactions may replace a completed acquisition with its owned
        // late-release continuation. Recheck rather than trusting one snapshot.
        await Promise.resolve();
      }
    } finally {
      // The production reservation owner supplies a synchronous disposer. Run
      // it even when tracked cleanup exhausts the absolute shutdown budget so
      // a subsequently resumed acquisition fails closed before touching SQL.
      if (disposeConnection) {
        try { disposeConnection(); } catch { onDiagnostic('agent_tool_reservation_failed'); }
      }
    }
    return interruptionsDrained && cleanup.size === 0 && monotonicNow() < finalDeadline;
  }

  return Object.freeze({
    captureTerminalSnapshot,
    announce,
    acceptArguments,
    blockBeforeExecution,
    complete,
    interruptOpen,
    jsonSafePersistedResult,
    shutdown,
    _reserve: reserve,
    _openGates: openGates,
    _cleanup: cleanup,
  });
}

function getSharedAgentActivityOwner(options = {}) {
  const db = options.db;
  if (!db || (typeof db !== 'object' && typeof db !== 'function')) {
    return createAgentActivityOwner(options);
  }
  let owner = sharedOwners.get(db);
  if (!owner) {
    const reservationConnection = createZeroTimeoutReservationConnection(db);
    owner = createAgentActivityOwner({
      ...options,
      acquireConnection: reservationConnection.acquireConnection,
      releaseConnection: reservationConnection.releaseConnection,
      disposeConnection: reservationConnection.disposeConnection,
    });
    sharedOwners.set(db, owner);
    sharedOwnerSet.add(owner);
  }
  return owner;
}

async function shutdownSharedAgentActivityOwners(options = {}) {
  const owners = [...sharedOwnerSet];
  const results = await Promise.allSettled(owners.map((owner) => owner.shutdown(options)));
  for (const owner of owners) sharedOwnerSet.delete(owner);
  return results.every((result) => result.status === 'fulfilled' && result.value !== false);
}

module.exports = {
  RESERVATION_ATTEMPTS,
  RESERVATION_DEADLINE_MS,
  createAgentActivityOwner,
  createZeroTimeoutReservationConnection,
  getSharedAgentActivityOwner,
  shutdownSharedAgentActivityOwners,
  createTerminalReservationGate,
  jsonSafePersistedResult,
};
