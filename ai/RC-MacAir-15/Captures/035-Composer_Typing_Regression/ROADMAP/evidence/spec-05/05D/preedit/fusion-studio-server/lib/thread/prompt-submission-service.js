'use strict';

/** Session receipt admission and same-key recovery serialization. */
const { createHash, randomUUID } = require('crypto');
const { getDb } = require('../db');
const repository = require('./prompt-submission-repository');
const { normalizeRouteAttachments } = require('./canonical-drain-context');

const generation = randomUUID();
const locks = new Map();
const validRequestId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value);
const validTargetId = (value) => typeof value === 'string' && value.length > 0
  && Buffer.byteLength(value, 'utf8') <= 256;

function identityKey(identity) {
  return `${identity.workspaceId}\0${identity.threadId}\0${identity.requestId}`;
}

async function withAttemptLock(identity, work) {
  const key = identityKey(identity);
  const prior = locks.get(key) || Promise.resolve();
  let release;
  const done = new Promise((resolve) => { release = resolve; });
  locks.set(key, done);
  await prior;
  try {
    return await work();
  } finally {
    if (locks.get(key) === done) locks.delete(key);
    release();
  }
}

function canonicalSnapshot(message) {
  return {
    userInput: message.user_input,
    attachments: normalizeRouteAttachments(message.attachments),
    harnessConfig: {
      model: message.harnessConfig?.model ?? null,
      variant: message.harnessConfig?.variant ?? null,
    },
  };
}

function fingerprint(snapshot) {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function project(row) {
  return {
    workspaceId: row.workspace_id,
    threadId: row.thread_id,
    requestId: row.request_id,
    outcome: row.outcome,
    execution: row.outcome === 'accepted' && row.execution === 'claimed'
      ? 'unknown_after_dispatch_claim' : row.execution,
    turnId: row.turn_id || null,
    reason: row.reason || null,
    ...(row.outcome === 'accepted' && row.snapshot_json
      ? { content: JSON.parse(row.snapshot_json).userInput } : {}),
  };
}

async function ownsThread(db, identity) {
  const row = await db('threads').where({ thread_id: identity.threadId,
    workspace_id: identity.workspaceId }).first('thread_id');
  return Boolean(row);
}

async function begin(identity, message) {
  const db = getDb();
  if (!validRequestId(identity.requestId) || !validTargetId(identity.threadId)
    || !validTargetId(identity.workspaceId) || !await ownsThread(db, identity)) {
    return { ok: false, code: 'request_invalid' };
  }
  const snapshot = canonicalSnapshot(message);
  const hash = fingerprint(snapshot);
  const previous = await repository.get(db, identity);
  if (previous) {
    if (previous.fingerprint && previous.fingerprint !== hash) {
      return { ok: false, code: 'request_mismatch' };
    }
    return { ok: previous.outcome === 'accepted', replayed: true,
      code: previous.outcome, receipt: project(previous) };
  }
  const receipt = await repository.reserve(db, identity, {
    fingerprint: hash, snapshotJson: JSON.stringify(snapshot), generation,
  });
  return { ok: true, replayed: false, receipt: project(receipt) };
}

async function isReserved(identity) {
  const row = await repository.get(getDb(), identity);
  return row?.outcome === 'reserved' && row.generation === generation;
}

async function reject(identity, reason) {
  return repository.transition(getDb(), identity, 'reserved', {
    outcome: 'rejected', reason, snapshot_json: null,
  });
}

async function accept(identity, turnId, groupService) {
  const db = getDb();
  if (!await isReserved(identity)) return { ok: false, code: 'cancelled' };
  return db.transaction(async (trx) => {
    const row = await repository.get(trx, identity);
    if (row?.outcome !== 'reserved' || row.generation !== generation) {
      return { ok: false, code: 'cancelled' };
    }
    const activity = await groupService.recordPromptAccepted({ threadId: identity.threadId,
      turnId, db: trx });
    if (!activity?.ok) throw new Error('prompt acceptance activity failed');
    const changed = await repository.transition(trx, identity, 'reserved', {
      outcome: 'accepted', turn_id: turnId,
    });
    if (!changed) throw new Error('receipt transition lost reservation');
    return { ok: true, receipt: project(await repository.get(trx, identity)) };
  });
}

async function claimDispatch(identity) {
  return repository.claimDispatch(getDb(), identity);
}

async function failBeforeDispatch(identity, reason) {
  return repository.failBeforeDispatch(getDb(), identity, reason);
}

async function noteClaimedFailure(identity, reason) {
  return repository.noteClaimedFailure(getDb(), identity, reason);
}

async function status(identity) {
  if (!validRequestId(identity.requestId) || !validTargetId(identity.threadId)
    || !validTargetId(identity.workspaceId)) return { ok: false, code: 'request_invalid' };
  return withAttemptLock(identity, async () => {
    const db = getDb();
    if (!await ownsThread(db, identity)) return { ok: false, code: 'not_found' };
    let row = await repository.get(db, identity);
    if (!row) row = await repository.cancelAbsent(db, identity, generation);
    // The lock means an active original finishes before status. A stale
    // reservation left by a crashed generation is cancelled, never replayed.
    if (row.outcome === 'reserved' && row.generation !== generation) {
      await repository.transition(db, identity, 'reserved', {
        outcome: 'cancelled', reason: 'server_restart', snapshot_json: null,
      });
      row = await repository.get(db, identity);
    }
    return { ok: true, receipt: project(row) };
  });
}

async function recoverInterrupted() {
  return repository.recoverInterrupted(getDb());
}

module.exports = { withAttemptLock, begin, isReserved, reject, accept,
  claimDispatch, failBeforeDispatch, noteClaimedFailure, status, recoverInterrupted,
  canonicalSnapshot, fingerprint };
