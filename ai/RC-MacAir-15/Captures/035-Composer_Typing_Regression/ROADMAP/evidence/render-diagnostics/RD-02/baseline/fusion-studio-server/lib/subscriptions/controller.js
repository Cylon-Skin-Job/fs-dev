'use strict';

const { canonicalizeJson } = require('../event-registry/canonical-json');
const { matchesFilter } = require('../event-registry/filter');
const { compileGeneration } = require('./generation-compiler');
const { deepFreeze } = require('./deep-freeze');

const REQUIRED_ACK_TIMEOUT_MS = 2000;
const MAX_DIAGNOSTICS = 100;
const MAX_DIAGNOSTIC_TEXT = 160;

function boundedText(value) {
  return String(value || 'unknown').replace(/[\r\n\t]+/gu, ' ').slice(0, MAX_DIAGNOSTIC_TEXT);
}

function snapshotFact(fact) {
  return deepFreeze(JSON.parse(canonicalizeJson(fact)));
}

function createSubscriptionController({
  registryAccess,
  handlerCatalog,
  createScopedContext,
  installAdmittedFactDelivery,
  writeDiagnostic = () => {},
}) {
  if (!registryAccess || typeof registryAccess.getEffectiveState !== 'function') {
    throw new TypeError('initialized registry access is required');
  }
  if (!handlerCatalog || typeof handlerCatalog.get !== 'function') {
    throw new TypeError('handler catalog is required');
  }
  if (typeof createScopedContext !== 'function') {
    throw new TypeError('scoped capability factory is required');
  }
  if (typeof installAdmittedFactDelivery !== 'function') {
    throw new TypeError('private admitted-fact delivery installer is required');
  }
  if (typeof writeDiagnostic !== 'function') throw new TypeError('diagnostic writer is required');

  let lifecycle = 'stopped';
  let generation = deepFreeze({ generationId: 0, descriptors: [] });
  let reloadTail = Promise.resolve();
  let startPromise = null;
  let stopPromise = null;
  const inFlightDeliveries = new Set();
  const inFlightRequiredHandlers = new Set();
  const diagnostics = [];

  function diagnose(code, fields = {}, error = null) {
    const item = {
      code: boundedText(code),
      generationId: generation.generationId,
    };
    if (fields.subscriptionId) item.subscriptionId = boundedText(fields.subscriptionId);
    if (fields.handlerKey) item.handlerKey = boundedText(fields.handlerKey);
    if (error) item.errorName = boundedText(error && error.name ? error.name : 'Error');
    const frozen = deepFreeze(item);
    diagnostics.push(frozen);
    if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.splice(0, diagnostics.length - MAX_DIAGNOSTICS);
    try {
      const result = writeDiagnostic(frozen);
      if (result && typeof result.then === 'function') result.catch(() => {});
    } catch (_error) {
      // Diagnostics never alter runtime authority or delivery.
    }
  }

  function inspectGeneration() {
    return deepFreeze({
      lifecycle,
      generationId: generation.generationId,
      descriptorCount: generation.descriptors.length,
      subscriptions: generation.descriptors.map((descriptor) => deepFreeze({
        subscriptionId: descriptor.subscriptionId,
        handlerKey: descriptor.handlerKey,
        priority: descriptor.priority,
        deliveryPolicy: descriptor.deliveryPolicy,
      })),
    });
  }

  function getDiagnostics() {
    return deepFreeze([...diagnostics]);
  }

  function compileOne(effectiveState, entry, generationId) {
    return compileGeneration({
      effectiveState: { ...effectiveState, effectiveSubscriptions: [entry] },
      handlerCatalog,
      createScopedContext,
      generationId,
    }).descriptors[0];
  }

  async function performReload() {
    const nextGenerationId = generation.generationId + 1;
    let effectiveState;
    try {
      effectiveState = await registryAccess.getEffectiveState();
    } catch (error) {
      // A failed authority read cannot prove that any prior grant remains
      // effective. Clear the visible generation before surfacing the
      // infrastructure failure; activation requires a later explicit reload.
      generation = deepFreeze({ generationId: nextGenerationId, descriptors: [] });
      diagnose('subscription_registry_read_failed', {}, error);
      throw error;
    }
    try {
      generation = compileGeneration({
        effectiveState,
        handlerCatalog,
        createScopedContext,
        generationId: nextGenerationId,
      });
      return deepFreeze({ applied: true, mode: 'complete', ...inspectGeneration() });
    } catch (error) {
      const previous = generation;
      const safeState = effectiveState && typeof effectiveState === 'object'
        ? effectiveState
        : { schemas: [], subscriptions: [], effectiveSubscriptions: [], diagnostics: [] };
      const candidatesById = new Map();
      const candidateEntries = Array.isArray(safeState.effectiveSubscriptions)
        ? safeState.effectiveSubscriptions
        : [];
      for (const entry of candidateEntries) {
        if (!entry || typeof entry.subscriptionId !== 'string') continue;
        if (!candidatesById.has(entry.subscriptionId)) candidatesById.set(entry.subscriptionId, []);
        candidatesById.get(entry.subscriptionId).push(entry);
      }
      const survivors = [];
      for (const descriptor of previous.descriptors) {
        const candidates = candidatesById.get(descriptor.subscriptionId) || [];
        if (candidates.length !== 1) {
          diagnose('subscription_authority_removed', descriptor);
          continue;
        }
        try {
          const candidate = compileOne(safeState, candidates[0], nextGenerationId);
          if (candidate.authorityFingerprint === descriptor.authorityFingerprint) {
            survivors.push(descriptor);
          } else {
            diagnose('subscription_authority_changed', descriptor);
          }
        } catch (candidateError) {
          diagnose('subscription_authority_invalid', descriptor, candidateError);
        }
      }
      generation = deepFreeze({ generationId: nextGenerationId, descriptors: survivors });
      diagnose('subscription_reload_failed', {}, error);
      return deepFreeze({ applied: false, mode: 'subtractive', ...inspectGeneration() });
    }
  }

  function enqueueReload() {
    const run = reloadTail.then(performReload, performReload);
    reloadTail = run.catch(() => {});
    return run;
  }

  async function start() {
    if (stopPromise) await stopPromise;
    if (lifecycle === 'started') return inspectGeneration();
    if (startPromise) return startPromise;
    lifecycle = 'starting';
    startPromise = (async () => {
      try {
        await enqueueReload();
        lifecycle = 'started';
        return inspectGeneration();
      } catch (error) {
        lifecycle = 'stopped';
        diagnose('subscription_start_failed', {}, error);
        throw error;
      } finally {
        startPromise = null;
      }
    })();
    return startPromise;
  }

  async function reload() {
    if (lifecycle !== 'started') throw new Error('Subscription controller is not started');
    return enqueueReload();
  }

  function quiesce() {
    if (lifecycle === 'started') lifecycle = 'quiescing';
    return inspectGeneration();
  }

  async function stop() {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      if (startPromise) {
        try { await startPromise; } catch (_error) {}
      }
      if (lifecycle === 'stopped') return inspectGeneration();
      lifecycle = 'stopping';
      await reloadTail;
      while (inFlightDeliveries.size > 0 || inFlightRequiredHandlers.size > 0) {
        await Promise.allSettled([
          ...inFlightDeliveries,
          ...inFlightRequiredHandlers,
        ]);
      }
      lifecycle = 'stopped';
      generation = deepFreeze({ generationId: generation.generationId + 1, descriptors: [] });
      return inspectGeneration();
    })();
    try {
      return await stopPromise;
    } finally {
      stopPromise = null;
    }
  }

  function observeBestEffort(result, descriptor) {
    try {
      Promise.resolve(result).catch((error) => {
        diagnose('subscription_handler_async_failed', descriptor, error);
      });
    } catch (error) {
      diagnose('subscription_handler_async_failed', descriptor, error);
    }
  }

  function observeRequiredAck(result, descriptor) {
    const handler = Promise.resolve(result);
    inFlightRequiredHandlers.add(handler);
    handler.then(
      () => inFlightRequiredHandlers.delete(handler),
      (error) => {
        inFlightRequiredHandlers.delete(handler);
        diagnose('subscription_handler_async_failed', descriptor, error);
      },
    );
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        diagnose('subscription_handler_timed_out', descriptor);
        resolve('timed_out');
      }, REQUIRED_ACK_TIMEOUT_MS);

      handler.then(
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve('completed');
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve('failed');
        },
      );
    });
  }

  async function dispatchAdmittedFact(sourceFact) {
    if (lifecycle !== 'started' && lifecycle !== 'quiescing') return deepFreeze([]);
    const selectedGeneration = generation;
    const fact = snapshotFact(sourceFact);
    const deliveries = [];
    for (const descriptor of selectedGeneration.descriptors) {
      if (!matchesFilter(descriptor.filter, fact)) continue;
      let result;
      try {
        result = descriptor.invoke(fact);
      } catch (error) {
        diagnose('subscription_handler_sync_failed', descriptor, error);
        deliveries.push(deepFreeze({
          subscriptionId: descriptor.subscriptionId,
          handlerKey: descriptor.handlerKey,
          status: 'failed',
        }));
        continue;
      }

      let status = 'invoked';
      if (descriptor.deliveryPolicy === 'required_ack') {
        status = await observeRequiredAck(result, descriptor);
      } else {
        observeBestEffort(result, descriptor);
      }
      deliveries.push(deepFreeze({
        subscriptionId: descriptor.subscriptionId,
        handlerKey: descriptor.handlerKey,
        status,
      }));
    }
    return deepFreeze(deliveries);
  }

  function deliverAdmittedFact(sourceFact) {
    const delivery = dispatchAdmittedFact(sourceFact);
    inFlightDeliveries.add(delivery);
    delivery.then(
      () => inFlightDeliveries.delete(delivery),
      () => inFlightDeliveries.delete(delivery),
    );
    return delivery;
  }

  installAdmittedFactDelivery(Object.freeze(deliverAdmittedFact));

  return Object.freeze({ start, quiesce, stop, reload, inspectGeneration, getDiagnostics });
}

module.exports = { createSubscriptionController, REQUIRED_ACK_TIMEOUT_MS };
