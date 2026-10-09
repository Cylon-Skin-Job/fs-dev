'use strict';

const { assertUuid } = require('../file-mutations/provenance-values');

class AgentProjectionAuthorityError extends Error {
  constructor(code, message = 'Renderer projection authority is unavailable.') {
    super(message);
    this.name = 'AgentProjectionAuthorityError';
    this.code = code;
  }
}

function assertNotCancelled(signal) {
  if (signal?.aborted) throw new AgentProjectionAuthorityError('projection_cancelled');
}

function createAgentRendererProjectionAuthority(db, {
  publishResourceObservedV2,
  publishRefreshRequired,
} = {}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  if (typeof publishRefreshRequired !== 'function') {
    throw new TypeError('renderer refresh publisher is required');
  }

  async function loadCommittedClaim(claim, { signal } = {}) {
    assertNotCancelled(signal);
    const token = assertUuid(claim?.claimToken, 'claimToken');
    const sourceEdgeId = assertUuid(claim?.sourceEdgeId, 'sourceEdgeId');
    const job = await db('agent_renderer_projection_jobs').where({
      source_edge_id: sourceEdgeId,
      state: 'running',
      claim_token: token,
    }).first();
    assertNotCancelled(signal);
    if (!job) throw new AgentProjectionAuthorityError('projection_claim_conflict');
    const edge = await db('agent_tool_resource_edges').where({ edge_id: sourceEdgeId }).first();
    const activity = edge && await db('agent_tool_activities').where({
      activity_id: edge.activity_id,
      workspace_id: edge.workspace_id,
      fact_admission_state: 'admitted',
    }).first();
    assertNotCancelled(signal);
    if (!edge || !activity || edge.observation_state !== job.relation
      || edge.observed_at !== job.observed_at || edge.canonical_path == null) {
      throw new AgentProjectionAuthorityError('projection_owner_conflict');
    }
    let snapshot = null;
    if (edge.snapshot_id) {
      snapshot = await db('agent_resource_snapshots').where({ snapshot_id: edge.snapshot_id }).first();
    }
    assertNotCancelled(signal);
    if (!snapshot || snapshot.workspace_id !== activity.workspace_id
      || snapshot.canonical_path !== edge.canonical_path) {
      throw new AgentProjectionAuthorityError('projection_snapshot_conflict');
    }
    return Object.freeze({ job, edge, activity, snapshot });
  }

  function v2Message(source) {
    const { edge, activity, snapshot } = source;
    const base = {
      type: 'resource:changed',
      version: 2,
      projectionId: edge.edge_id,
      sourceActivityId: activity.activity_id,
      sourceEdgeId: edge.edge_id,
      workspaceId: activity.workspace_id,
      resourceKind: 'file',
      changeKind: 'state_observed',
      relation: edge.observation_state,
      panel: 'file-viewer',
      path: edge.canonical_path,
      occurredAt: edge.observed_at,
      snapshotId: snapshot.snapshot_id,
      ...(snapshot.state === 'bytes'
        ? { state: 'bytes', resourceId: edge.resource_id }
        : { state: 'absent' }),
    };
    if (edge.observation_state !== 'unchanged') {
      base.checkpointEventId = snapshot.event_id;
      base.checkpointObservationId = snapshot.observation_id;
    }
    return Object.freeze(base);
  }

  function refreshMessage(source, reason) {
    return Object.freeze({
      type: 'resource:refresh_required',
      version: 1,
      workspaceId: source.activity.workspace_id,
      panel: 'file-viewer',
      path: source.edge.canonical_path,
      operationId: source.activity.activity_id,
      reason,
    });
  }

  async function deliverClaim(claim, { signal } = {}) {
    const source = await loadCommittedClaim(claim, { signal });
    assertNotCancelled(signal);
    if (source.edge.observation_state !== 'unchanged'
      && source.snapshot.fact_admission_state !== 'admitted') {
      const report = await publishRefreshRequired(
        refreshMessage(source, 'fact_publish_failed'),
        { signal },
      );
      assertNotCancelled(signal);
      return Object.freeze({ settlement: report.matched === 0 ? 'no_recipient' : 'refresh_required_sent' });
    }
    if (typeof publishResourceObservedV2 !== 'function') {
      const report = await publishRefreshRequired(
        refreshMessage(source, 'projection_unavailable'),
        { signal },
      );
      assertNotCancelled(signal);
      return Object.freeze({ settlement: report.matched === 0 ? 'no_recipient' : 'refresh_required_sent' });
    }
    try {
      const report = await publishResourceObservedV2(v2Message(source), { signal });
      assertNotCancelled(signal);
      return Object.freeze({ settlement: report.matched === 0 ? 'no_recipient' : 'v2_sent' });
    } catch (error) {
      assertNotCancelled(signal);
      const report = await publishRefreshRequired(
        refreshMessage(source, 'projection_failed'),
        { signal },
      );
      assertNotCancelled(signal);
      return Object.freeze({ settlement: report.matched === 0 ? 'no_recipient' : 'refresh_required_sent' });
    }
  }

  return Object.freeze({ deliverClaim, loadCommittedClaim });
}

module.exports = { AgentProjectionAuthorityError, createAgentRendererProjectionAuthority };
