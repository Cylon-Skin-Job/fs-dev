'use strict';

const { on } = require('../../event-bus');
const { registerCollector } = require('../exchange-metadata-registry');

const activeTurns = new Map();

function turnKey(event) {
  return `${event.workspaceId || event.workspace || 'workspace:unknown'}:${event.threadId}`;
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
  if (!event.threadId) return;
  activeTurns.set(turnKey(event), {
    workspaceId: event.workspaceId || event.workspace,
    threadId: event.threadId,
    startedAt: event.timestamp || Date.now(),
    mutations: [],
  });
});

function captureFileChange(event) {
  const mutation = normalizeMutation(event);
  if (!mutation) return;

  for (const turn of activeTurns.values()) {
    if (event.workspaceId && turn.workspaceId && event.workspaceId !== turn.workspaceId) continue;
    turn.mutations.push(mutation);
  }
}

on('file:changed', captureFileChange);
on('file_changed', captureFileChange);

registerCollector({
  id: 'file-mutations',
  collect(input) {
    const key = `${input.workspaceId || input.workspace || 'workspace:unknown'}:${input.threadId}`;
    const record = activeTurns.get(key);
    activeTurns.delete(key);
    return { fileMutations: record?.mutations || [] };
  },
});
