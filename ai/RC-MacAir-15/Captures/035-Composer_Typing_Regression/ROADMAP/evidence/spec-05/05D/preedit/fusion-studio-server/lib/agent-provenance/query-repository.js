'use strict';

const {
  assertTimestamp,
  assertUuid,
  normalizeCanonicalPath,
  normalizeFolderPrefix,
} = require('../file-mutations/provenance-values');
const {
  ACCESS_FAMILIES,
  ACCESS_KINDS,
  STATUSES,
  assertEnum,
  assertScalarBoundedString,
} = require('./values');

function omitNulls(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item != null));
}

function normalizeCursor(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,19}$/u.test(value)) throw new TypeError('cursor is invalid');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new TypeError('cursor is invalid');
  return parsed;
}

function normalizeArray(value, allowed, label) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length < 1 || value.length > 16 || new Set(value).size !== value.length) {
    throw new TypeError(`${label} is invalid`);
  }
  value.forEach((item) => assertEnum(item, allowed, label));
  return value;
}

function normalizeToolNames(value) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length < 1 || value.length > 16 || new Set(value).size !== value.length) {
    throw new TypeError('toolNames is invalid');
  }
  return value.map((name) => assertScalarBoundedString(name, 128, 'toolName'));
}

function normalizePathSelector(value, normalizer, label) {
  assertScalarBoundedString(value, 4096, label, { allowEmpty: label === 'folderPrefix' });
  return normalizer(value);
}

function normalizeFileName(value) {
  const fileName = assertScalarBoundedString(value, 255, 'fileName');
  if (fileName === '.' || fileName === '..' || /[\\/\0]/u.test(fileName)) throw new TypeError('fileName is invalid');
  return fileName;
}

function normalizeQuery(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('query is invalid');
  const allowed = new Set([
    'workspaceId', 'subject', 'path', 'fileName', 'folderPrefix', 'activityId', 'threadId', 'turnId',
    'exchangeId', 'toolCallId', 'harnessId', 'toolNames', 'statuses', 'accessFamilies', 'accessKinds',
    'changedOnly', 'since', 'until', 'cursor', 'limit',
  ]);
  const keys = Reflect.ownKeys(input);
  if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) throw new TypeError('query contains an unknown field');
  if (keys.some((key) => input[key] === null)) throw new TypeError('query optional fields must be omitted rather than null');
  const query = {
    workspaceId: assertScalarBoundedString(input.workspaceId, 128, 'workspaceId'),
    subject: assertEnum(input.subject, ['tool_calls', 'resource_edges'], 'subject'),
    path: input.path == null ? null : normalizePathSelector(input.path, normalizeCanonicalPath, 'path'),
    fileName: input.fileName == null ? null : normalizeFileName(input.fileName),
    folderPrefix: input.folderPrefix == null ? null : normalizePathSelector(input.folderPrefix, normalizeFolderPrefix, 'folderPrefix'),
    activityId: input.activityId == null ? null : assertUuid(input.activityId, 'activityId'),
    threadId: input.threadId == null ? null : assertScalarBoundedString(input.threadId, 128, 'threadId'),
    turnId: input.turnId == null ? null : assertScalarBoundedString(input.turnId, 128, 'turnId'),
    exchangeId: input.exchangeId ?? null,
    toolCallId: input.toolCallId == null ? null : assertScalarBoundedString(input.toolCallId, 512, 'toolCallId'),
    harnessId: input.harnessId == null ? null : assertScalarBoundedString(input.harnessId, 128, 'harnessId'),
    toolNames: normalizeToolNames(input.toolNames),
    statuses: normalizeArray(input.statuses, STATUSES, 'statuses'),
    accessFamilies: normalizeArray(input.accessFamilies, ACCESS_FAMILIES, 'accessFamilies'),
    accessKinds: normalizeArray(input.accessKinds, ACCESS_KINDS, 'accessKinds'),
    changedOnly: input.changedOnly ?? null,
    since: input.since == null ? null : assertTimestamp(input.since, 'since'),
    until: input.until == null ? null : assertTimestamp(input.until, 'until'),
    cursor: normalizeCursor(input.cursor),
    limit: input.limit ?? 50,
  };
  if (query.exchangeId != null && (!Number.isSafeInteger(query.exchangeId) || query.exchangeId <= 0)) throw new TypeError('exchangeId is invalid');
  if (query.changedOnly != null && typeof query.changedOnly !== 'boolean') throw new TypeError('changedOnly is invalid');
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100) throw new TypeError('limit is invalid');
  if (query.since != null && query.until != null && query.since > query.until) throw new TypeError('time range is invalid');
  return Object.freeze(query);
}

function folderWhere(builder, alias, folderPrefix) {
  if (folderPrefix === '') builder.where(`${alias}.folder_path`, '');
  else builder.where((nested) => nested
    .where(`${alias}.folder_path`, folderPrefix)
    .orWhereRaw(`substr(??, 1, length(?) + 1) = ?`, [`${alias}.folder_path`, folderPrefix, `${folderPrefix}/`]));
}

function applyActivityFilters(builder, query, activityAlias = 'a', { includeTime = true } = {}) {
  builder.where(`${activityAlias}.workspace_id`, query.workspaceId);
  for (const [property, column] of [
    ['activityId', 'activity_id'], ['threadId', 'thread_id'], ['turnId', 'turn_id'],
    ['exchangeId', 'exchange_id'], ['toolCallId', 'tool_call_id'], ['harnessId', 'harness_id'],
  ]) if (query[property] != null) builder.where(`${activityAlias}.${column}`, query[property]);
  if (query.toolNames) builder.whereIn(`${activityAlias}.tool_name`, query.toolNames);
  if (query.statuses) builder.whereIn(`${activityAlias}.status`, query.statuses);
  if (includeTime && query.since != null) builder.where(`${activityAlias}.terminal_observed_at`, '>=', query.since);
  if (includeTime && query.until != null) builder.where(`${activityAlias}.terminal_observed_at`, '<=', query.until);
}

function applyEdgeFilters(builder, query, edgeAlias = 'e') {
  if (query.path != null) builder.where(`${edgeAlias}.canonical_path`, query.path);
  if (query.fileName != null) builder.where(`${edgeAlias}.file_name`, query.fileName);
  if (query.folderPrefix != null) folderWhere(builder, edgeAlias, query.folderPrefix);
  if (query.accessFamilies) builder.whereIn(`${edgeAlias}.access_family`, query.accessFamilies);
  if (query.accessKinds) builder.whereIn(`${edgeAlias}.access_kind`, query.accessKinds);
  if (query.changedOnly === true) builder.where(`${edgeAlias}.observation_state`, 'changed');
}

function timing(row) {
  return omitNulls({
    announcedObservedAt: row.announced_observed_at,
    announcedReportedAt: row.announced_reported_at,
    executionStartedReportedAt: row.execution_started_reported_at,
    argumentsObservedAt: row.arguments_observed_at,
    argumentsReportedAt: row.arguments_reported_at,
    terminalObservedAt: row.terminal_observed_at,
    terminalReportedAt: row.terminal_reported_at,
    terminalSnapshotReportedAt: row.terminal_snapshot_reported_at,
    reconciledAt: row.reconciled_at,
    exchangeSavedAt: row.exchange_saved_at,
    exchangeBoundAt: row.exchange_bound_at,
  });
}

function detailRef(row) {
  return row.exchange_id == null ? null : Object.freeze({ kind: 'exchange_tool_part', exchangeId: row.exchange_id, toolCallId: row.tool_call_id });
}

function createAgentActivityQueryRepository(db) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');

  async function toolCalls(query) {
    let builder = db('agent_tool_activities as a').select('a.*');
    applyActivityFilters(builder, query);
    if (query.cursor != null) builder.where('a.id', '<', query.cursor);
    const hasEdgeFilters = [query.path, query.fileName, query.folderPrefix].some((v) => v != null)
      || query.accessFamilies || query.accessKinds || query.changedOnly === true;
    if (hasEdgeFilters) {
      builder.whereExists(function edgeExists() {
        this.select(db.raw('1')).from('agent_tool_resource_edges as e').whereRaw('e.activity_id = a.activity_id');
        applyEdgeFilters(this, query, 'e');
      });
    }
    const rows = await builder.orderBy('a.id', 'desc').limit(query.limit + 1);
    const page = rows.slice(0, query.limit);
    const ids = page.map((row) => row.activity_id);
    const edges = ids.length ? await db('agent_tool_resource_edges').whereIn('activity_id', ids) : [];
    const items = page.map((row) => {
      const owned = edges.filter((edge) => edge.activity_id === row.activity_id && edge.canonical_path != null);
      const paths = new Set(owned.map((edge) => edge.canonical_path));
      const changed = new Set(owned.filter((edge) => edge.observation_state === 'changed').map((edge) => edge.canonical_path));
      return Object.freeze({
        kind: 'tool_call',
        activityId: row.activity_id,
        eventId: row.event_id,
        workspaceId: row.workspace_id,
        threadId: row.thread_id,
        turnId: row.turn_id,
        ...(row.exchange_id == null ? {} : { exchangeId: row.exchange_id }),
        harnessId: row.harness_id,
        provider: row.provider,
        toolCallId: row.tool_call_id,
        toolName: row.tool_name,
        nativeToolName: row.native_tool_name,
        status: row.status,
        timing: timing(row),
        fingerprints: omitNulls({ argumentsSha256: row.arguments_sha256, resultSha256: row.result_sha256 }),
        candidates: { reported: row.candidate_reported_count, retained: row.candidate_retained_count, truncated: Boolean(row.candidates_truncated) },
        resources: { count: paths.size, changedCount: changed.size },
        fact: { admissionState: row.fact_admission_state, ledgerState: row.ledger_state },
        ...(detailRef(row) ? { detailRef: detailRef(row) } : {}),
      });
    });
    return Object.freeze({
      items: Object.freeze(items),
      ...(rows.length > query.limit ? { nextCursor: String(page[page.length - 1].id) } : {}),
    });
  }

  async function resourceEdges(query) {
    let builder = db('agent_tool_resource_edges as e')
      .join('agent_tool_activities as a', 'a.activity_id', 'e.activity_id')
      .leftJoin('agent_resource_snapshots as s', 's.snapshot_id', 'e.snapshot_id')
      .select('e.*',
        'a.thread_id', 'a.turn_id', 'a.exchange_id', 'a.harness_id', 'a.tool_call_id', 'a.tool_name', 'a.status',
        's.state as snapshot_state', 's.blob_sha256 as snapshot_sha256', 's.byte_length as snapshot_byte_length', 's.relation as snapshot_relation');
    applyActivityFilters(builder, query, 'a', { includeTime: false });
    applyEdgeFilters(builder, query);
    if (query.cursor != null) builder.where('e.id', '<', query.cursor);
    if (query.since != null) builder.where('e.observed_at', '>=', query.since);
    if (query.until != null) builder.where('e.observed_at', '<=', query.until);
    const rows = await builder.orderBy('e.id', 'desc').limit(query.limit + 1);
    const page = rows.slice(0, query.limit);
    const items = page.map((row) => {
      let observation = { state: row.observation_state };
      if (['skipped', 'failed'].includes(row.observation_state)) observation = { ...observation, reason: row.observation_reason, observedAt: row.observed_at };
      if (['first_observation', 'changed', 'unchanged'].includes(row.observation_state)) {
        observation = {
          ...observation,
          observedAt: row.observed_at,
          snapshotId: row.snapshot_id,
          ...(row.previous_snapshot_id == null ? {} : { previousSnapshotId: row.previous_snapshot_id }),
          snapshot: row.snapshot_state === 'bytes'
            ? { state: 'bytes', sha256: row.snapshot_sha256, byteLength: row.snapshot_byte_length, relation: row.snapshot_relation }
            : { state: 'absent', byteLength: 0, relation: row.snapshot_relation },
        };
      }
      return Object.freeze({
        kind: 'resource_edge',
        edgeId: row.edge_id,
        activityId: row.activity_id,
        workspaceId: row.workspace_id,
        threadId: row.thread_id,
        turnId: row.turn_id,
        ...(row.exchange_id == null ? {} : { exchangeId: row.exchange_id }),
        harnessId: row.harness_id,
        toolCallId: row.tool_call_id,
        toolName: row.tool_name,
        status: row.status,
        candidateSha256: row.candidate_sha256,
        ...(row.canonical_path == null ? {} : { resource: omitNulls({ resourceId: row.resource_id, path: row.canonical_path, fileName: row.file_name, folderPath: row.folder_path }) }),
        access: { family: row.access_family, kind: row.access_kind, extractionBasis: row.extraction_basis },
        observation,
        ...(detailRef(row) ? { detailRef: detailRef(row) } : {}),
      });
    });
    return Object.freeze({
      items: Object.freeze(items),
      ...(rows.length > query.limit ? { nextCursor: String(page[page.length - 1].id) } : {}),
    });
  }

  return Object.freeze({
    async query(input) {
      const query = normalizeQuery(input);
      return query.subject === 'tool_calls' ? toolCalls(query) : resourceEdges(query);
    },
  });
}

module.exports = { createAgentActivityQueryRepository, normalizeQuery };
