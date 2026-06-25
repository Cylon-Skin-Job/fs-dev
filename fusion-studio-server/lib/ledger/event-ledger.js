'use strict';

const crypto = require('crypto');

const RECORDED_EVENT_TYPES = new Set([
  'workspace:switched',
  'thread:state_changed',
  'file:changed',
]);

const REDACTED_KEYS = new Set([
  'content',
  'contents',
  'fileContent',
  'rawContent',
  'before',
  'after',
  'diff',
]);

const MAX_STRING_LENGTH = 4000;

function isRecordedEventType(type) {
  return RECORDED_EVENT_TYPES.has(type);
}

async function getMachineIdentity(db) {
  const rows = await db('system_config')
    .whereIn('key', ['local_machine_identity', 'local_machine_name']);
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const machineName = byKey.get('local_machine_name') || null;
  const rawIdentity = byKey.get('local_machine_identity');

  if (rawIdentity) {
    try {
      const identity = JSON.parse(rawIdentity);
      return {
        machineId: identity.machineId || identity.machine_id || null,
        machineName: identity.givenName || identity.machineName || identity.machine_name || machineName,
      };
    } catch {
      return {
        machineId: null,
        machineName,
      };
    }
  }

  return {
    machineId: null,
    machineName,
  };
}

function inferWorkspaceId(event) {
  return event.workspaceId || event.workspace || event.to || null;
}

function inferActor(event) {
  if (event.actor && typeof event.actor === 'object') {
    return {
      actorType: event.actor.type || event.actor.actorType || 'system',
      actorId: event.actor.id || event.actor.actorId || null,
    };
  }

  return {
    actorType: event.actorType || event.actor_type || (event.type === 'file:changed' ? 'user' : 'system'),
    actorId: event.actorId || event.actor_id || null,
  };
}

function inferSourceModule(event) {
  if (event.sourceModule) return event.sourceModule;
  if (event.source) return event.source;
  if (event.type === 'workspace:switched') return 'workspace-controller';
  if (event.type === 'thread:state_changed') return 'thread-lifecycle-controller';
  if (event.type === 'file:changed') return 'workspace-watcher';
  return null;
}

function buildSummary(event) {
  if (event.summary) return String(event.summary);
  if (event.type === 'workspace:switched') {
    return `Workspace switched from ${event.from || 'none'} to ${event.to || 'none'}`;
  }
  if (event.type === 'thread:state_changed') {
    return `Thread ${event.threadId || 'unknown'} changed state to ${event.state || 'unknown'}`;
  }
  if (event.type === 'file:changed') {
    return `${event.context?.type || 'file'} ${event.event || 'changed'}: ${event.filePath || event.path || 'unknown'}`;
  }
  return event.type;
}

function sanitizePayload(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`
      : value;
  }
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item, seen));
  }

  const clean = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (REDACTED_KEYS.has(key)) {
      clean[key] = '[redacted]';
    } else {
      clean[key] = sanitizePayload(entryValue, seen);
    }
  }
  return clean;
}

function tagsForEvent(event) {
  const tags = new Set();
  if (Array.isArray(event.tags)) {
    for (const tag of event.tags) {
      if (tag) tags.add(String(tag));
    }
  }
  if (event.type === 'workspace:switched') tags.add('workspace');
  if (event.type === 'thread:state_changed') tags.add('thread');
  if (event.type === 'file:changed') {
    tags.add('resource');
    tags.add(event.event || 'changed');
  }
  return Array.from(tags);
}

function edgesForEvent(event, machineIdentity) {
  const workspaceId = inferWorkspaceId(event);
  const machineId = machineIdentity.machineId;

  if (event.type === 'file:changed') {
    const filePath = event.filePath || event.path || null;
    const resourceType = event.context?.type || event.resourceType || 'file';
    return [{
      resource_type: resourceType,
      resource_id: event.resourceId || filePath,
      workspace_id: workspaceId,
      machine_id: machineId,
      path: filePath,
      role: event.role || 'subject',
    }];
  }

  return [];
}

async function recordEvent(db, event, options = {}) {
  if (!event || !isRecordedEventType(event.type)) return null;

  const now = Date.now();
  const machineIdentity = await getMachineIdentity(db);
  const actor = inferActor(event);
  const eventId = event.eventId || crypto.randomUUID();
  const occurredAt = Number.isFinite(event.timestamp) ? event.timestamp : now;
  const row = {
    event_id: eventId,
    event_type: event.type,
    workspace_id: inferWorkspaceId(event),
    machine_id: machineIdentity.machineId,
    machine_name: machineIdentity.machineName,
    actor_type: actor.actorType || 'system',
    actor_id: actor.actorId,
    occurred_at: occurredAt,
    summary: buildSummary(event),
    payload_json: JSON.stringify(sanitizePayload(event)),
    source_module: inferSourceModule(event),
    correlation_id: event.correlationId || event.correlation_id || null,
    causation_id: event.causationId || event.causation_id || null,
    created_at: now,
  };
  const edges = edgesForEvent(event, machineIdentity);
  const tags = tagsForEvent(event);

  const trxProvider = options.transaction || ((fn) => db.transaction(fn));
  await trxProvider(async (trx) => {
    await trx('event_log').insert(row);
    if (edges.length > 0) {
      await trx('event_resource_edges').insert(edges.map((edge) => ({
        event_id: eventId,
        ...edge,
      })));
    }
    if (tags.length > 0) {
      await trx('event_tags').insert(tags.map((tag) => ({
        event_id: eventId,
        tag,
      })));
    }
  });

  return {
    eventId,
    row,
    edges,
    tags,
  };
}

async function listRecentEvents(db, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 200);
  let query = db('event_log').orderBy('occurred_at', 'desc').limit(limit);
  if (options.eventType) query = query.where('event_type', options.eventType);
  if (options.workspaceId) query = query.where('workspace_id', options.workspaceId);
  if (options.machineId) query = query.where('machine_id', options.machineId);
  return query;
}

module.exports = {
  RECORDED_EVENT_TYPES,
  isRecordedEventType,
  recordEvent,
  listRecentEvents,
};
