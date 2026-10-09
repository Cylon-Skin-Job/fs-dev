'use strict';

const { canonicalizeJson } = require('../../event-registry/canonical-json');
const { deepFreeze } = require('../deep-freeze');

const DEFAULT_DEDUPE_LIMIT = 4096;

function createResourceRenderProjectionHandler({ dedupeLimit = DEFAULT_DEDUPE_LIMIT } = {}) {
  if (!Number.isSafeInteger(dedupeLimit) || dedupeLimit < 1) {
    throw new TypeError('projection dedupe limit must be a positive integer');
  }
  const publishedByEventId = new Map();

  function diagnose(context, code) {
    try { context.writeDiagnostic(code); } catch (_error) {}
  }

  function recoveryFor(fact) {
    return deepFreeze({
      type: 'resource:refresh_required',
      version: 1,
      workspaceId: fact.workspaceId,
      panel: 'file-viewer',
      path: fact.resource.path,
      operationId: fact.operationId,
      reason: 'projection_failed',
    });
  }

  async function failProjection(fact, context, error, diagnosticCode) {
    diagnose(context, diagnosticCode);
    try {
      await context.publishResourceRefreshRequired(recoveryFor(fact));
    } catch (_recoveryError) {
      // The original projection failure remains the governed delivery result.
    }
    throw error;
  }

  function reserveCapacity() {
    if (publishedByEventId.size < dedupeLimit) return true;
    for (const [eventId, entry] of publishedByEventId) {
      if (entry.state === 'published') {
        publishedByEventId.delete(eventId);
        return true;
      }
    }
    return false;
  }

  return async function handleResourceRenderProjection(fact, context) {
    if (typeof context?.publishResourceChanged !== 'function'
      || typeof context?.publishResourceRefreshRequired !== 'function'
      || typeof context?.writeDiagnostic !== 'function') {
      throw new TypeError('resource render projection capabilities are unavailable');
    }

    let projection;
    let canonicalProjection;
    try {
      projection = deepFreeze({
        type: 'resource:changed',
        version: 1,
        eventId: fact.eventId,
        operationId: fact.operationId,
        workspaceId: fact.workspaceId,
        resourceId: fact.resource.resourceId,
        resourceKind: fact.resource.kind,
        operation: fact.mutation.kind,
        panel: 'file-viewer',
        path: fact.resource.path,
        occurredAt: fact.occurredAt,
      });
      canonicalProjection = canonicalizeJson(projection);
    } catch (error) {
      return failProjection(fact, context, error, 'render_projection_failed');
    }

    const previous = publishedByEventId.get(fact.eventId);
    if (previous !== undefined) {
      if (previous.canonicalProjection !== canonicalProjection) {
        return failProjection(
          fact,
          context,
          new Error('resource render projection conflicts with established event identity'),
          'render_projection_duplicate_conflict',
        );
      }
      await previous.settlement;
      return Object.freeze({ status: 'duplicate' });
    }

    if (!reserveCapacity()) {
      return failProjection(
        fact,
        context,
        new Error('resource render projection dedupe capacity is unavailable'),
        'render_projection_failed',
      );
    }

    const entry = { canonicalProjection, state: 'pending', settlement: null };
    entry.settlement = Promise.resolve().then(() => context.publishResourceChanged(projection));
    publishedByEventId.set(fact.eventId, entry);
    try {
      await entry.settlement;
      entry.state = 'published';
      return Object.freeze({ status: 'published' });
    } catch (error) {
      if (publishedByEventId.get(fact.eventId) === entry) {
        publishedByEventId.delete(fact.eventId);
      }
      return failProjection(fact, context, error, 'render_projection_failed');
    }
  };
}

module.exports = { createResourceRenderProjectionHandler, DEFAULT_DEDUPE_LIMIT };
