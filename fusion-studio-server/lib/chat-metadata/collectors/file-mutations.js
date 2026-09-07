'use strict';

const { on } = require('../../event-bus');
const { registerCollector } = require('../exchange-metadata-registry');

const activeTurns = new Map();
const TURN_IDENTITY_FIELDS = ['workspaceEpoch', 'threadId', 'turnId'];

function turnKey(event) {
  if (typeof event?.workspaceId !== 'string' || !event.workspaceId
    || typeof event?.projectRoot !== 'string' || !event.projectRoot
    || typeof event?.workspaceEpoch !== 'string' || !event.workspaceEpoch
    || typeof event?.threadId !== 'string' || !event.threadId
    || typeof event?.turnId !== 'string' || !event.turnId) return null;
  return JSON.stringify([
    event.workspaceId, event.projectRoot, event.workspaceEpoch, event.threadId, event.turnId,
  ]);
}

function normalizeMutation(event) {
  const path = event.filePath || event.path;
  if (!path) return null;
  return {
    event: event.event || event.change || 'changed',
    path,
    source: event.type || 'file-change',
    ts: event.timestamp || Date.now(),
  };
}

on('chat:turn_begin', (event) => {
  const key = turnKey(event);
  if (!key) return;
  activeTurns.set(key, {
    workspaceId: event.workspaceId || event.workspace,
    projectRoot: event.projectRoot,
    threadId: event.threadId,
    workspaceEpoch: event.workspaceEpoch,
    turnId: event.turnId,
    startedAt: event.timestamp || Date.now(),
    ended: false,
    mutations: [],
  });
});

on('chat:turn_end', (event) => {
  const key = turnKey(event);
  const record = key ? activeTurns.get(key) : null;
  if (record) record.ended = true;
});

function captureFileChange(event) {
  if (typeof event.workspaceId !== 'string' || !event.workspaceId
    || typeof event.projectRoot !== 'string' || !event.projectRoot) return;

  const hasAnyTurnIdentity = TURN_IDENTITY_FIELDS.some((field) => Object.hasOwn(event, field));
  const hasCompleteTurnIdentity = TURN_IDENTITY_FIELDS.every((field) => (
    typeof event[field] === 'string' && event[field]
  ));
  if (hasAnyTurnIdentity && !hasCompleteTurnIdentity) return;

  let target = null;
  if (hasCompleteTurnIdentity) {
    const key = turnKey(event);
    const exact = key ? activeTurns.get(key) : null;
    if (exact && !exact.ended) target = exact;
  } else {
    for (const turn of activeTurns.values()) {
      if (turn.ended || event.workspaceId !== turn.workspaceId
        || event.projectRoot !== turn.projectRoot) continue;
      if (target) return;
      target = turn;
    }
  }

  if (!target) return;
  const mutation = normalizeMutation(event);
  if (!mutation) return;
  target.mutations.push(mutation);
}

on('file:changed', captureFileChange);

registerCollector({
  id: 'file-mutations',
  collect(input) {
    const key = turnKey(input);
    const record = key ? activeTurns.get(key) : null;
    if (key) activeTurns.delete(key);
    return {
      fileMutations: record?.projectRoot === input.projectRoot ? record.mutations : [],
    };
  },
});
