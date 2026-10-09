'use strict';

const crypto = require('crypto');

const MAX_BUFFERED_REPLIES = 256;
const MAX_BUFFERED_REPLY_BYTES = 8 * 1024 * 1024;
const OPEN = 1;

function closeForReconnect(ws, reason = 'workspace session requires reconnect') {
  try {
    if (typeof ws?.close === 'function') ws.close(1011, reason.slice(0, 123));
  } catch (_error) {
    try { ws?.terminate?.(); } catch (_terminateError) {}
  }
}

function sendSerialized(ws, serialized) {
  if (!ws || ws.readyState !== OPEN) {
    closeForReconnect(ws, 'workspace reply send failed');
    return Promise.reject(new Error('WebSocket is not open'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) {
        closeForReconnect(ws, 'workspace reply send failed');
        reject(error);
      } else {
        resolve();
      }
    };
    try {
      if (ws.send.length < 2) {
        ws.send(serialized);
        finish();
      } else {
        ws.send(serialized, finish);
      }
    } catch (error) {
      finish(error);
    }
  });
}

function ensureBuffer(session) {
  if (!Array.isArray(session.workspaceReplyBuffer)) session.workspaceReplyBuffer = [];
  if (!Number.isSafeInteger(session.workspaceReplyBufferBytes)) session.workspaceReplyBufferBytes = 0;
}

function beginWorkspaceBind(session, {
  workspaceId,
  repoPath,
  randomUuid = crypto.randomUUID,
} = {}) {
  if (!session || typeof session !== 'object') throw new TypeError('workspace session is required');
  ensureBuffer(session);
  const normalizedWorkspaceId = typeof workspaceId === 'string' && workspaceId ? workspaceId : null;
  const workspaceEpoch = normalizedWorkspaceId ? randomUuid() : null;
  if (workspaceEpoch != null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(workspaceEpoch)) {
    throw new TypeError('workspace epoch generator must return a lowercase UUID');
  }
  session.workspaceBindingState = 'binding';
  session.workspaceReplyFlushState = 'idle';
  session.currentWorkspaceId = null;
  session.workspaceEpoch = null;
  session.projectRoot = null;
  session.pendingWorkspaceId = normalizedWorkspaceId;
  session.pendingWorkspaceEpoch = workspaceEpoch;
  session.pendingProjectRoot = normalizedWorkspaceId && typeof repoPath === 'string' ? repoPath : null;
  return Object.freeze({ workspaceId: normalizedWorkspaceId, workspaceEpoch });
}

function currentWorkspacePair(session) {
  if (session?.workspaceBindingState !== 'active') return null;
  if (typeof session.currentWorkspaceId !== 'string' || typeof session.workspaceEpoch !== 'string') return null;
  return Object.freeze({
    workspaceId: session.currentWorkspaceId,
    workspaceEpoch: session.workspaceEpoch,
  });
}

function pendingWorkspacePair(session) {
  if (session?.workspaceBindingState !== 'binding') return null;
  return Object.freeze({
    workspaceId: session.pendingWorkspaceId ?? null,
    workspaceEpoch: session.pendingWorkspaceEpoch ?? null,
  });
}

function bufferSerializedReply(ws, session, serialized, pair) {
  ensureBuffer(session);
  const byteLength = Buffer.byteLength(serialized, 'utf8');
  if (
    session.workspaceReplyBuffer.length >= MAX_BUFFERED_REPLIES
    || session.workspaceReplyBufferBytes + byteLength > MAX_BUFFERED_REPLY_BYTES
  ) {
    closeForReconnect(ws, 'workspace reply buffer overflow');
    return false;
  }
  session.workspaceReplyBuffer.push(Object.freeze({
    serialized,
    byteLength,
    workspaceId: pair.workspaceId,
    workspaceEpoch: pair.workspaceEpoch,
  }));
  session.workspaceReplyBufferBytes += byteLength;
  return true;
}

async function sendWorkspaceBoundReply(ws, session, message, deliveryPair = null) {
  const serialized = JSON.stringify(message);
  const pair = deliveryPair || (
    typeof message?.workspaceId === 'string' && typeof message?.workspaceEpoch === 'string'
      ? { workspaceId: message.workspaceId, workspaceEpoch: message.workspaceEpoch }
      : null
  );
  const carriesPair = pair !== null;
  if (carriesPair && (
    session?.workspaceBindingState === 'binding'
    || session?.workspaceReplyFlushState === 'flushing'
  )) {
    return bufferSerializedReply(ws, session, serialized, pair);
  }
  await sendSerialized(ws, serialized);
  return true;
}

async function completeWorkspaceBind(ws, session, bindFrame, expectedPair = pendingWorkspacePair(session)) {
  if (!expectedPair || session?.workspaceBindingState !== 'binding') {
    closeForReconnect(ws, 'workspace bind state invalid');
    return false;
  }
  if (
    session.pendingWorkspaceId !== expectedPair.workspaceId
    || session.pendingWorkspaceEpoch !== expectedPair.workspaceEpoch
  ) {
    closeForReconnect(ws, 'workspace bind was superseded');
    return false;
  }
  const frame = {
    ...bindFrame,
    workspaceId: expectedPair.workspaceId,
    workspaceEpoch: expectedPair.workspaceEpoch,
  };
  try {
    await sendSerialized(ws, JSON.stringify(frame));
  } catch (_error) {
    return false;
  }
  if (
    session.pendingWorkspaceId !== expectedPair.workspaceId
    || session.pendingWorkspaceEpoch !== expectedPair.workspaceEpoch
  ) {
    closeForReconnect(ws, 'workspace bind changed during send');
    return false;
  }

  session.currentWorkspaceId = expectedPair.workspaceId;
  session.workspaceEpoch = expectedPair.workspaceEpoch;
  session.projectRoot = session.pendingProjectRoot;
  session.pendingWorkspaceId = null;
  session.pendingWorkspaceEpoch = null;
  session.pendingProjectRoot = null;
  session.workspaceBindingState = 'active';
  session.workspaceReplyFlushState = 'flushing';

  const isExpectedFlush = () => session.workspaceBindingState === 'active'
    && session.workspaceReplyFlushState === 'flushing'
    && session.currentWorkspaceId === expectedPair.workspaceId
    && session.workspaceEpoch === expectedPair.workspaceEpoch;

  try {
    while (session.workspaceReplyBuffer.length > 0) {
      if (!isExpectedFlush()) {
        closeForReconnect(ws, 'workspace bind changed during reply flush');
        return false;
      }
      const next = session.workspaceReplyBuffer[0];
      if (
        next.workspaceId !== expectedPair.workspaceId
        || next.workspaceEpoch !== expectedPair.workspaceEpoch
      ) {
        closeForReconnect(ws, 'workspace reply pair was superseded');
        return false;
      }
      session.workspaceReplyBuffer.shift();
      session.workspaceReplyBufferBytes -= next.byteLength;
      await sendSerialized(ws, next.serialized);
      if (!isExpectedFlush()) {
        closeForReconnect(ws, 'workspace bind changed during reply flush');
        return false;
      }
    }
    session.workspaceReplyBufferBytes = 0;
    session.workspaceReplyFlushState = 'idle';
    return true;
  } catch (_error) {
    return false;
  }
}

module.exports = {
  MAX_BUFFERED_REPLIES,
  MAX_BUFFERED_REPLY_BYTES,
  beginWorkspaceBind,
  completeWorkspaceBind,
  currentWorkspacePair,
  pendingWorkspacePair,
  sendSerialized,
  sendWorkspaceBoundReply,
};
