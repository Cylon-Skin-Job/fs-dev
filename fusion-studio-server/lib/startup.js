/**
 * Server startup orchestrator.
 *
 * Extracted from server.js — handles the full bootstrap sequence:
 *   1. initDb
 *   2. initialize locked event registry authority
 *   3. createFusionHandlers + createClipboardHandlers
 *   4. startAuditSubscriber
 *   5. server.listen()
 *   6. wiki hooks
 *   7. project file watcher + loadComponents + createActionHandlers
 *   8. agent triggers + cron scheduler
 *   9. runner heartbeat monitor
 *  10. SIGTERM/SIGINT handlers for clean shutdown
 *  11. material-symbols static mount (post-listen, DB-resolved path)
 *
 * Ordering is load-bearing. Do not reorder steps. See the gotchas in
 * SPEC-01b for the specific hard dependencies.
 *
 * Returns { fusionHandlers, clipboardHandlers } so server.js can wire
 * them into the client message router (which reads from module-level
 * mutable references).
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const { performance } = require('perf_hooks');

const { initDb, getDb, closeDb, DB_PATH } = require('./db');
const createFusionHandlers = require('./fusion/ws-handlers');
const createClipboardHandlers = require('./secrets/clipboard/handlers');
const createBookmarksHandlers = require('./bookmarks/handlers');
const createEmojiRecentsHandlers = require('./emoji-recents/handlers');
const createThemeHandlers = require('./ws/theme-handlers');
const { createHandlers: createSecretsHandlers } = require('./secrets/index');
const createScreenshotHandlers = require('./screenshot/ws-handlers');
const themesService = require('./theme/themes-service');
const { drainAuditSaves, startAuditSubscriber } = require('./audit/audit-subscriber');
const { startThreadLifecycle } = require('./thread/thread-lifecycle-controller');
const { loadComponents, getModalDefinition } = require('./components/component-loader');
const views = require('./views');
const viewReadiness = require('./views/readiness-runtime');
const { createViewReadinessCoordinator } = require('./views/readiness-coordinator');
const { createViewRelocationService } = require('./views/relocation-service');
const { startWorkspacePipelineWhenReady } = require('./views/readiness-startup');
const { createShutdownHandler } = require('./shutdown');

const {
  LOOPBACK_HOST,
  parseLoopbackPort,
  validateLoopbackHost,
} = require('./startup-loopback');
const PORT = parseLoopbackPort(process.env.PORT ?? '3001');
const SERVER_HOST = validateLoopbackHost(LOOPBACK_HOST);
const { createIsolatedProvenanceRuntime } = require('./testing/isolated-provenance-runtime');

async function initializeRuntimeMachineIdentity({ initializeIdentity, resolveIdentity } = {}) {
  if (typeof initializeIdentity !== 'function' || typeof resolveIdentity !== 'function') {
    throw new TypeError('machine identity initialization capabilities are required');
  }
  // Persistence must be initialized before registry policy runs, but the
  // effective runtime identity can be an explicit FUSION_LOCAL_MACHINE
  // override (notably the isolated Alpha profile). Bind readiness to the same
  // resolver used by every ordinary workspace path consumer.
  await initializeIdentity();
  return resolveIdentity();
}

function createAgentWorkspaceRootResolver({ getWorkspaceById, realpath = fs.promises.realpath } = {}) {
  if (typeof getWorkspaceById !== 'function' || typeof realpath !== 'function') {
    throw new TypeError('workspace-root resolution capabilities are required');
  }
  return async function resolveWorkspaceRoot(workspaceId) {
    const workspace = await getWorkspaceById(workspaceId);
    const declared = workspace?.repoPath ?? workspace?.repo_path;
    if (typeof declared !== 'string') return null;
    try {
      return await realpath(declared);
    } catch (_error) {
      // A captured workspace that disappeared or became unresolvable is a
      // terminal authority failure, not a retryable scheduler transition.
      return null;
    }
  };
}

function createAgentPhaseAOwner({
  shutdownActiveTurns,
  drainAuditSaves: drainAuditSaveOwner,
  drainEventLedgerWrites = async () => Object.freeze({ drained: true }),
  shutdownActivityOwners,
  binderOwner,
  announcedOwner,
  admissionOwner,
  ledgerOwner,
  observationOwner,
  rendererProjectionOwner,
  shutdownThreadManagers,
  closeReconciliationDatabase,
  monotonicNow = () => performance.now(),
}) {
  if (typeof drainAuditSaveOwner !== 'function') {
    throw new TypeError('audit save drain owner is required');
  }
  return async function shutdownAgentOwners(options) {
    const beforeDeadline = () => monotonicNow() < options.deadline;
    const bounded = (maximumMs) => ({
      ...options,
      timeoutMs: Math.min(maximumMs, Math.max(0, options.deadline - monotonicNow())),
    });
    const runBeforeDeadline = async (work, maximumMs) => {
      if (!beforeDeadline()) return false;
      const result = await work(bounded(maximumMs));
      const drained = result !== false && result?.drained !== false;
      return drained && beforeDeadline();
    };

    // Durable crash-recovery work is independent and can quiesce immediately.
    // Turn finalizers remain the first prerequisite because they may reserve
    // terminal activity and synchronously start exchange persistence. Audit
    // saves then drain before the binder can stop; unrelated durable owners
    // still drain concurrently under this same absolute Phase-A deadline.
    const announcedDrain = runBeforeDeadline(
      (boundedOptions) => announcedOwner.shutdown(boundedOptions),
      2_000,
    );
    const causalDrain = (async () => {
      if (!await runBeforeDeadline(shutdownActiveTurns, 5_000)) return false;
      if (shutdownThreadManagers
        && !await runBeforeDeadline(shutdownThreadManagers, 3_000)) return false;
      const auditDrain = runBeforeDeadline(drainAuditSaveOwner, 5_000);
      const legacyLedgerDrain = runBeforeDeadline(drainEventLedgerWrites, 5_000);
      const binderDrain = binderOwner
        ? (async () => {
          if (!await auditDrain) return false;
          return runBeforeDeadline(
            (boundedOptions) => binderOwner.shutdown(boundedOptions), 2_000,
          );
        })()
        : auditDrain;
      const results = await Promise.allSettled([
        runBeforeDeadline(shutdownActivityOwners, 2_000),
        binderDrain,
        legacyLedgerDrain,
        runBeforeDeadline(
          (boundedOptions) => admissionOwner.shutdown(boundedOptions), 2_000,
        ),
        runBeforeDeadline(
          (boundedOptions) => ledgerOwner.shutdown(boundedOptions), 2_000,
        ),
        ...(observationOwner ? [runBeforeDeadline(
          (boundedOptions) => observationOwner.shutdown(boundedOptions), 2_000,
        )] : []),
        ...(rendererProjectionOwner ? [runBeforeDeadline(
          (boundedOptions) => rendererProjectionOwner.shutdown(boundedOptions), 2_000,
        )] : []),
      ]);
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected) throw rejected.reason;
      return results.every((result) => result.value === true);
    })();

    const [announcedResult, causalResult] = await Promise.allSettled([announcedDrain, causalDrain]);
    if (announcedResult.status === 'rejected') throw announcedResult.reason;
    if (causalResult.status === 'rejected') throw causalResult.reason;
    if (!announcedResult.value || !causalResult.value || !beforeDeadline()) return false;
    await closeReconciliationDatabase();
    return beforeDeadline();
  };
}

/**
 * Bootstrap and start the server. Must be called after the http.Server
 * has been created but before any client connections can arrive.
 *
 * @param {object} deps
 * @param {import('http').Server} deps.server
 * @param {import('express').Express} deps.app
 * @param {Map} deps.sessions
 * @param {object} deps.productSessionRegistry
 * @param {object} deps.transportConnectionRegistry
 * @param {(ws?: import('ws').WebSocket) => string|null} deps.getProjectRoot
 * @returns {Promise<{ fusionHandlers: object, clipboardHandlers: object, themeHandlers: object, secretsHandlers: object }>}
 */
async function start({
  server,
  app,
  sessions,
  productSessionRegistry,
  transportConnectionRegistry,
  getProjectRoot,
  installProtocolRoutes,
}) {
  if (typeof installProtocolRoutes !== 'function') {
    throw new TypeError('atomic protocol route installer is required');
  }
  if (
    !productSessionRegistry
    || typeof productSessionRegistry.getAllClients !== 'function'
    || typeof productSessionRegistry.getClientByConnectionId !== 'function'
    || typeof productSessionRegistry.getSessionForClient !== 'function'
  ) {
    throw new TypeError('product session registry is required');
  }
  if (!transportConnectionRegistry || typeof transportConnectionRegistry.terminateAll !== 'function') {
    throw new TypeError('transport connection registry is required');
  }
  const isolatedProvenance = createIsolatedProvenanceRuntime({
    port: PORT,
    dbPath: DB_PATH,
  });
  isolatedProvenance.installObservationGuards();
  if (isolatedProvenance.enabled) {
    process.once('exit', isolatedProvenance.restoreObservationGuards);
  }
  const harnessHttpRevalidation = isolatedProvenance.defineRuntimeEffect(
    'harness-http-revalidation',
    (service) => service.revalidateAll(),
  );
  const {
    installBackgroundRevalidationRunner,
  } = require('./http/harness-routes');
  installBackgroundRevalidationRunner((service) => harnessHttpRevalidation.start(service));

  // 1. DB init — fusion.db lives at <server>/data/fusion.db (fixed,
  // workspace-independent). It is intentionally NOT tied to the active
  // workspace, because the workspace registry is *in* the DB —
  // chicken-and-egg. The DB is the registry's home; workspaces resolve
  // through it, not the other way around.
  await initDb();
  await isolatedProvenance.initializeProfile(getDb());
  process.env.ROBIN_DB = DB_PATH;
  console.log('[DB] fusion.db initialized');

  // 1b. Harness error diagnostics cleanup (RCC-0108 SPEC-03 Slice C) — the
  // SAME purge-expired + evict-to-caps cleanup as insertion-time, run once
  // at boot after migrations have applied. Best-effort by contract: warns
  // on failure and NEVER blocks boot.
  const { runStartupDiagnosticCleanup } = require('./thread/harness-diagnostic-service');
  await runStartupDiagnosticCleanup();

  // Registry authority is reconstructed from SQLite immediately after
  // migrations and before any fact producer, subscriber, watcher, or public
  // socket can start. Row-local seed corruption is diagnosed/inactivated by
  // the registry; an infrastructure bootstrap failure remains startup-fatal.
  const { initializeEventRegistry } = require('./event-registry');
  const registryAccess = await initializeEventRegistry(getDb(), {
    installedHandlers: [
      'system.provenance-ledger',
      'system.agent-provenance-ledger',
      'system.agent-resource-observer',
      'system.resource-render-projection',
    ],
  });

  // The governed controller, durable save owner, ledger subscriber, and both
  // public protocol routes are composed as one startup unit before any legacy
  // listener, workspace module, watcher, or public socket can observe them.
  const {
    createHandlerCatalog,
    createScopedCapabilityFactory,
    createSubscriptionController,
  } = require('./subscriptions');
  const { bootstrapFileProvenanceAdmission } = require('./subscriptions/file-provenance-bootstrap');
  const { createFileSaveOwner } = require('./file-mutations/save-owner');
  const { createResourceProvenanceRepository } = require('./ledger/resource-provenance-repository');
  const { createProvenanceLedgerHandler } = require('./ledger/provenance-ledger-handler');
  const {
    createAgentFactAuthorityRepository,
  } = require('./agent-provenance/fact-authority-repository');
  const {
    createAgentFactAdmissionReconciler,
  } = require('./agent-provenance/fact-admission-reconciler');
  const { createAgentLedgerRepository } = require('./agent-provenance/agent-ledger-repository');
  const { createAgentLedgerReconciler } = require('./agent-provenance/agent-ledger-reconciler');
  const { createAgentActivityRepository } = require('./agent-provenance/activity-repository');
  const { createAgentActivityQueryRepository } = require('./agent-provenance/query-repository');
  const { createAgentExchangeBindRepository } = require('./agent-provenance/exchange-bind-repository');
  const { createAgentExchangeBinder } = require('./agent-provenance/exchange-binder');
  const { createAgentObservationJobRepository } = require('./agent-provenance/observation-job-repository');
  const { createAgentCheckpointRepository } = require('./agent-provenance/checkpoint-repository');
  const { createAgentResourceIdentityService } = require('./agent-provenance/resource-identity');
  const { createAgentResourceObserver } = require('./agent-provenance/resource-observer');
  const { createAgentRendererProjectionJobRepository } = require('./agent-provenance/renderer-projection-job-repository');
  const { createAgentRendererProjectionAuthority } = require('./agent-provenance/renderer-projection-authority');
  const { createAgentRendererProjectionOwner } = require('./agent-provenance/renderer-projection-scheduler');
  const { createStableResourceRepository } = require('./file-mutations/stable-resource-repository');
  const { createPathCoordinator } = require('./file-mutations/save-mutex');
  const secureFileObserver = require('../native/secure-file-observer');
  const {
    createAgentReconciliationDb,
  } = require('./agent-provenance/reconciliation-db');
  const {
    createAnnouncedActivityReconciler,
  } = require('./agent-provenance/announced-activity-reconciler');
  const {
    getSharedAgentActivityOwner,
    shutdownSharedAgentActivityOwners,
  } = require('./agent-provenance/activity-owner');
  const {
    shutdownActiveTurnLifecycles,
  } = require('./wire/canonical-harness-event-bridge');
  const {
    createAgentProvenanceLedgerHandler,
  } = require('./subscriptions/handlers/agent-provenance-ledger');
  const {
    createAgentResourceObserverHandler,
  } = require('./subscriptions/handlers/agent-resource-observer');
  const {
    createResourceRenderProjectionHandler,
  } = require('./subscriptions/handlers/resource-render-projection');
  const { createResourceProjectionPublishers } = require('./ws/resource-projection-publisher');
  const { createFileSaveRoute } = require('./ws/file-save-route');
  const { createResourceProvenanceRoute } = require('./ws/resource-provenance-route');
  const { createAgentActivityRoute } = require('./ws/agent-activity-route');
  const { createFileViewerReadRoute } = require('./ws/file-viewer-read-route');
  const { createAgentToolFixtureRoute } = require('./testing/agent-tool-fixture-route');
  const writeGovernedDiagnostic = (item) => {
    console.warn(`[Subscriptions] ${item.code}`);
  };
  const provenanceRepository = createResourceProvenanceRepository(getDb());
  const agentReconciliationDb = await createAgentReconciliationDb(getDb());
  const agentExchangeBindRepository = createAgentExchangeBindRepository(agentReconciliationDb);
  const agentExchangeBinder = createAgentExchangeBinder(agentExchangeBindRepository, {
    writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
  });
  const { installAgentExchangeBinding } = require('./thread/HistoryFile');
  installAgentExchangeBinding({
    insertInTransaction: agentExchangeBindRepository.insertInTransaction,
    signal: agentExchangeBinder.signal,
  });
  let agentFactAdmissionOwner;
  const agentFactAuthority = createAgentFactAuthorityRepository(agentReconciliationDb, {
    canAttempt: () => agentFactAdmissionOwner?.isAccepting() !== false,
  });
  agentFactAdmissionOwner = createAgentFactAdmissionReconciler({
    authority: agentFactAuthority,
    writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
  });
  let agentLedgerOwner;
  const agentLedgerRepository = createAgentLedgerRepository(agentReconciliationDb, {
    canAttempt: () => agentLedgerOwner?.isAccepting() !== false,
  });
  agentLedgerOwner = createAgentLedgerReconciler({
    repository: agentLedgerRepository,
    writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
  });
  // Construct the accepted 01b singleton before public work so all foreground
  // and headless routers inherit the shutdown-registered owner and wake the
  // same admission reconciler after a terminal reservation commits.
  const agentActivityRepository = createAgentActivityRepository(getDb(), {
    onDiagnostic: (code) => writeGovernedDiagnostic({ code }),
  });
  getSharedAgentActivityOwner({
    db: getDb(),
    activityRepository: agentActivityRepository,
    onDiagnostic: (code) => writeGovernedDiagnostic({ code }),
    onTerminalReserved: () => agentFactAdmissionOwner.signal(),
  });
  const announcedActivityReconciler = createAnnouncedActivityReconciler({
    db: agentReconciliationDb,
    activityRepository: createAgentActivityRepository(agentReconciliationDb, {
      onDiagnostic: (code) => writeGovernedDiagnostic({ code }),
    }),
    writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
    onTerminalReserved: () => agentFactAdmissionOwner.signal(),
  });
  const resourceProjectionPublishers = createResourceProjectionPublishers({
    sessions,
    registryAccess,
  });
  const pathCoordinator = createPathCoordinator();
  const observationJobs = createAgentObservationJobRepository(agentReconciliationDb);
  const stableResources = createStableResourceRepository(agentReconciliationDb);
  const checkpoints = createAgentCheckpointRepository(agentReconciliationDb, {
    resourceIdentity: createAgentResourceIdentityService(agentReconciliationDb, stableResources),
  });
  const rendererProjectionJobs = createAgentRendererProjectionJobRepository(agentReconciliationDb);
  const rendererProjectionAuthority = createAgentRendererProjectionAuthority(agentReconciliationDb, {
    publishResourceObservedV2: resourceProjectionPublishers.publishResourceObservedV2,
    publishRefreshRequired: resourceProjectionPublishers.publishAgentObservationRefreshRequired,
  });
  const rendererProjectionOwner = createAgentRendererProjectionOwner({
    repository: rendererProjectionJobs,
    authority: rendererProjectionAuthority,
    writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
  });
  const observationOwner = createAgentResourceObserver({
    repository: observationJobs,
    checkpointRepository: checkpoints,
    pathCoordinator,
    nativeObserver: secureFileObserver,
    resolveWorkspaceRoot: createAgentWorkspaceRootResolver({
      getWorkspaceById: async (workspaceId) => agentReconciliationDb('workspaces')
        .where({ id: workspaceId }).select('repo_path').first(),
    }),
    onObservationReserved: () => agentFactAdmissionOwner.signal(),
    onProjectionReserved: () => rendererProjectionOwner.signal(),
    writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
  });
  const fileSaveOwner = createFileSaveOwner({
    db: getDb(),
    publishResourceRefreshRequired:
      resourceProjectionPublishers.publishControllerRefreshRequired,
    controllerOptions: {
      mutex: pathCoordinator,
      writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
    },
    reconcilerOptions: {
      writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
    },
  });
  let deliverAdmittedFact = null;
  const subscriptionController = createSubscriptionController({
    registryAccess,
    handlerCatalog: createHandlerCatalog({
      'system.provenance-ledger': createProvenanceLedgerHandler(),
      'system.agent-provenance-ledger': createAgentProvenanceLedgerHandler(),
      'system.agent-resource-observer': createAgentResourceObserverHandler(),
      'system.resource-render-projection': createResourceRenderProjectionHandler(),
    }),
    createScopedContext: createScopedCapabilityFactory({
      appendResourceFact: provenanceRepository.appendResourceFact,
      appendAgentFact: agentLedgerOwner.appendAgentFact,
      scheduleAgentObservation(fact) {
        if (fact?.eventType !== 'agent.tool_completed' || fact?.schemaVersion !== 1) {
          throw new TypeError('agent observation requires an admitted tool fact');
        }
        observationOwner.signal();
        return Object.freeze({ scheduled: true, activityId: fact.operationId });
      },
      publishResourceChanged: resourceProjectionPublishers.publishResourceChanged,
      publishResourceRefreshRequired:
        resourceProjectionPublishers.publishSubscriberRefreshRequired,
      writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
    }),
    installAdmittedFactDelivery(delivery) {
      if (deliverAdmittedFact) throw new Error('Admitted-fact delivery is already installed');
      deliverAdmittedFact = delivery;
    },
    writeDiagnostic: writeGovernedDiagnostic,
  });
  await subscriptionController.start();
  bootstrapFileProvenanceAdmission({
    registryAccess,
    deliverAdmittedFact,
    writeDiagnostic: writeGovernedDiagnostic,
    fileSaveOwner: isolatedProvenance.wrapFileSaveOwner(fileSaveOwner),
    agentFactAuthority,
    agentFactAdmissionOwner,
    onAgentAdmissionCommitted: (fact) => {
      agentLedgerOwner.signal();
      if (fact?.eventType === 'agent.tool_completed') observationOwner.signal();
      if (fact?.eventType === 'resource.state_observed') rendererProjectionOwner.signal();
    },
  });
  announcedActivityReconciler.deferContinuations();
  agentExchangeBinder.deferContinuations();
  agentFactAdmissionOwner.deferContinuations();
  agentLedgerOwner.deferContinuations();
  observationOwner.deferContinuations();
  await announcedActivityReconciler.start();
  await agentExchangeBinder.start();
  await agentFactAdmissionOwner.start();
  await agentLedgerOwner.start();
  await observationOwner.start();
  await rendererProjectionOwner.start();
  await fileSaveOwner.reconcile();

  const fileSaveRoute = createFileSaveRoute({
    registryAccess,
    fileSaveOwner,
    writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
  });
  const resourceProvenanceRoute = createResourceProvenanceRoute({
    registryAccess,
    repository: provenanceRepository,
    writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
  });
  const agentActivityRoute = createAgentActivityRoute({
    registryAccess,
    repository: createAgentActivityQueryRepository(getDb()),
    writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
  });
  const fileViewerReadRoute = createFileViewerReadRoute({
    registryAccess,
    writeDiagnostic: (code) => writeGovernedDiagnostic({ code }),
  });
  const {
    getLocalMachineName,
    initializeLocalMachineIdentity,
  } = require('./workspace/ai-paths');
  const localMachineName = await initializeRuntimeMachineIdentity({
    initializeIdentity: initializeLocalMachineIdentity,
    resolveIdentity: getLocalMachineName,
  });
  viewReadiness.installViewReadinessOwner(createViewReadinessCoordinator({
    migrationService: createViewRelocationService({ db: getDb() }),
    machineIdentity: localMachineName,
  }));
  console.log('[Workspace] local machine name: ' + localMachineName);

  // The isolated provenance fixture gets a process-owned, provider-free
  // thread before any public socket can connect. Fixture requests may select
  // this exact existing thread, but can never create a durable session.
  let fixtureThreadTarget = null;
  const fixtureThreadId = await isolatedProvenance.provisionAgentToolThread(async (target) => {
    fixtureThreadTarget = target;
    const {
      getProjectThreadManager,
      awaitThreadManagerReady,
    } = require('./thread/thread-manager-registry');
    const manager = getProjectThreadManager(target.projectRoot, target.workspaceId);
    await awaitThreadManagerReady(manager);
    if (!await manager.getThread(target.threadId)) {
      await manager.createThread(target.threadId, 'Agent provenance isolated fixture', {
        harnessId: 'opencode',
      });
    }
  });
  const agentToolFixtureRoute = createAgentToolFixtureRoute({
    db: getDb(),
    enabled: isolatedProvenance.enabled,
    nonce: process.env.FUSION_PROVENANCE_TEST_NONCE,
    threadId: fixtureThreadId,
    workspaceId: fixtureThreadTarget?.workspaceId,
    projectRoot: fixtureThreadTarget?.projectRoot,
  });
  installProtocolRoutes(Object.freeze({
    fileSaveRoute,
    resourceProvenanceRoute,
    agentActivityRoute,
    fileViewerReadRoute,
    agentToolFixtureRoute,
  }));

  // 2. Handlers — depend on DB being ready
  const fusionHandlers = createFusionHandlers({ getDb, sessions, getProjectRoot });

  // 3. Audit subscriber — listens to event bus, persists exchange metadata
  startAuditSubscriber({ enableAgentExchangeBinding: true });
  const {
    drainEventLedgerWrites,
    startEventLedgerSubscriber,
  } = require('./ledger/event-ledger-subscriber');
  startEventLedgerSubscriber();

  // 3.1. Transcription history subscriber — listens to transcription:* via bus,
  // persists raw/corrected text, and prunes to the latest 100 rows.
  const transcriptionHistory = require('./transcription/history-subscriber');
  transcriptionHistory.register();

  // 3.5. Wire broadcaster — must subscribe before listen() so chat events
  // from the first connection are delivered.
  const { createWireBroadcaster } = require('./wire/wire-broadcaster');
  const { getClientForThread } = require('./wire/process-manager');
  createWireBroadcaster({ getClientForThread });

  // 3.6. Thread lifecycle controller — observes chat:turn_* via bus,
  // emits thread:state_changed / thread:idle_expired. Must subscribe
  // before listen() so the first connection's turns are observed.
  startThreadLifecycle({ idleTimeoutMinutes: 45 });

  // 3.7. Workspace broadcaster — bus → WebSocket fan-out for workspace
  // and thread lifecycle events. Must subscribe before listen() so boot-time
  // workspace availability events are delivered.
  const {
    getAllClients,
    getClientByConnectionId,
    getSessionForClient,
  } = productSessionRegistry;
  const { createWorkspaceBroadcaster } = require('./ws/workspace-broadcaster');
  createWorkspaceBroadcaster({ getAllClients, getClientByConnectionId, getSessionForClient });

  // 3.7b. Harness-status broadcaster + initial revalidation pass.
  // Subscribe before any revalidate() emits so the first diff is
  // delivered. Kick off revalidateAll as a fire-and-forget so we
  // don't block listen(); the picker reads from cache with optimistic
  // defaults while the pass completes.
  isolatedProvenance.defineStartupEffect('harness-broadcaster', () => {
    const { createHarnessBroadcaster } = require('./ws/harness-broadcaster');
    createHarnessBroadcaster({ getAllClients });
  }).start();

  // 3.7c-alt. Calendar broadcaster — bus → WebSocket for calendar sync events
  isolatedProvenance.defineStartupEffect('calendar-broadcaster', () => {
    const { createCalendarBroadcaster } = require('./ws/calendar-broadcaster');
    createCalendarBroadcaster({ getAllClients });
  }).start();

  // 3.7c. Theme handlers — need getAllClients for broadcast, created here
  // alongside the other getAllClients consumers.
  const themeHandlers = createThemeHandlers({ getAllClients, getProjectRoot });

  // 3.7d. Secrets handlers — also depend on getAllClients for broadcast.
  // Required via explicit /index path: bare `./secrets` would resolve to
  // lib/secrets.js (the keychain wrapper), not the WS handler aggregator.
  const secretsHandlers = createSecretsHandlers({ getAllClients });

  // 3.7e. Clipboard handlers — keychain-backed; depends on getAllClients for
  // broadcast on append/use/touch/delete/clear.
  const clipboardHandlers = createClipboardHandlers({ getAllClients });
  const bookmarksHandlers = createBookmarksHandlers({ getAllClients });
  const emojiRecentsHandlers = createEmojiRecentsHandlers();
  const screenshotHandlers = createScreenshotHandlers({ getAllClients });

  // 3.7f. Calendar adapters — start after DB init so migrations have run
  isolatedProvenance.defineStartupEffect('calendar-adapters', () => {
    const calendar = require('./calendar');
    calendar.start();
  }).start();

  isolatedProvenance.defineStartupEffect('harness-status-revalidation', () => {
    const harnessStatusService = require('./harness/harness-status-service');
    harnessStatusService.revalidateAll().catch((err) => {
      console.error('[Startup] harness revalidateAll failed:', err.message);
    });
  }).start();

  // 3.8. Workspace controller — workspace CRUD, launch validator, switch
  // logic. Must run before listen() so the registry is validated and the
  // active workspace is set before the first client connects.
  const workspaceController = require('./workspace/workspace-controller');
  await workspaceController.start();

  // 3.8a. Start watching the macOS screenshot folder for hotkey captures.
  // Started after workspaceController so the active workspace repo_path is known.
  isolatedProvenance.defineStartupEffect('hotkey-screenshot-watcher', () => {
    const hotkeyScreenshotWatcher = require('./screenshot/hotkey-screenshot-watcher');
    hotkeyScreenshotWatcher.start().catch((err) => {
      console.error('[Startup] Failed to start hotkey screenshot watcher:', err.message);
    });
  }).start();

  // 3.8b. Themes CSS — re-derive themes.css from the active slug in themes.json
  // on every boot so the CSS is never stale after a hand-edit (THEME_PICKER_SPEC §5c).
  const projectRootForThemes = getProjectRoot();
  isolatedProvenance.defineStartupEffect('theme-css-bootstrap', () => {
    if (!projectRootForThemes) return;
    themesService.list(projectRootForThemes).then(themes => {
      const active = themes.find(t => t.active);
      if (active) {
        return themesService.generateCss(projectRootForThemes, active.id);
      }
    }).catch(err => {
      console.warn('[themes] boot CSS generation failed:', err.message);
    });
  }).start();

  // 3.8c. CLI-config workspace file — ensure ai/<machine>/System/config/cli.json
  // exists so discovery is trivial (CLI_CONFIG_SPEC §7e). Runs after
  // workspaceController.start() so getProjectRoot() resolves to the active
  // workspace root; otherwise bootstrap silently no-ops.
  const projectRootForCli = getProjectRoot();
  isolatedProvenance.defineStartupEffect('cli-config-bootstrap', () => {
    if (!projectRootForCli) return;
    const { ensureWorkspaceFile } = require('./cli-config');
    ensureWorkspaceFile(projectRootForCli).catch((err) => {
      console.warn('[cli-config] ensureWorkspaceFile failed:', err.message);
    });
  }).start();

  // 4. listen() — must come before watcher/hooks start, they broadcast to clients
  await new Promise((resolve, reject) => {
    server.listen(PORT, SERVER_HOST, async () => {
      const boundPort = server.address().port;
      console.log(`[Server] Running on IPv4 loopback port=${boundPort}`);
      console.log(`[Server] Default CLI: ${process.env.KIMI_PATH || 'kimi'}`);

      try {
        await isolatedProvenance.defineStartupEffect('workspace-watcher-trigger-pipeline', () => (
          startWorkspacePipelineWhenReady({
            sessions,
            getProjectRoot,
            getWorkspaceId: workspaceController.getActiveWorkspaceId,
            startPipeline: _startPipeline,
          })
        )).start();
      } catch (err) {
        // Don't crash the server if pipeline init fails — log and continue
        console.error('[Server] Pipeline init error:', err);
      }

      resolve();
    });
    server.on('error', reject);
  });
  announcedActivityReconciler.enableContinuations();
  agentExchangeBinder.enableContinuations();
  agentFactAdmissionOwner.enableContinuations();
  agentLedgerOwner.enableContinuations();
  observationOwner.enableContinuations();
  rendererProjectionOwner.enableContinuations();
  await isolatedProvenance.finalizeStartupAudit(getDb());

  // 5. Signal handlers — register after successful startup
  const requestShutdown = createShutdownHandler({
    server,
    sessions,
    terminateTransports: transportConnectionRegistry.terminateAll,
    beginQuiesce: () => subscriptionController.quiesce(),
    phaseAOwners: [createAgentPhaseAOwner({
      shutdownActiveTurns: shutdownActiveTurnLifecycles,
      drainAuditSaves,
      drainEventLedgerWrites,
      shutdownActivityOwners: shutdownSharedAgentActivityOwners,
      binderOwner: agentExchangeBinder,
      announcedOwner: announcedActivityReconciler,
      admissionOwner: agentFactAdmissionOwner,
      ledgerOwner: agentLedgerOwner,
      observationOwner,
      rendererProjectionOwner,
      shutdownThreadManagers: require('./thread/thread-manager-registry').shutdownThreadManagers,
      closeReconciliationDatabase: () => agentReconciliationDb.destroy(),
    })],
    closeWatchers: () => {
      const { abandonAll } = require('./watch/core');
      abandonAll();
    },
    stopSubscriptions: () => subscriptionController.stop(),
    closeDatabase: closeDb,
  });
  process.on('SIGTERM', () => { void requestShutdown('SIGTERM'); });
  process.on('SIGINT', () => { void requestShutdown('SIGINT'); });

  // 6. Material Symbols — served from Fusion Home (runtime asset, not
  // bundled). Looked up from DB so the path stays correct even if Fusion
  // Home moves. Fire-and-forget after listen(); /material-symbols is
  // excluded from the SPA fallback so late mounting is safe.
  getDb()('workspaces').where('id', 'fusion-home').first()
    .then((workspace) => {
      if (workspace && workspace.repo_path) {
        const symbolsPath = path.join(workspace.repo_path, 'material-symbols');
        if (fs.existsSync(symbolsPath)) {
          app.use('/material-symbols', express.static(symbolsPath));
          console.log(`[Server] Serving material symbols from ${symbolsPath}`);
        } else {
          console.warn('[Server] Fusion Home material-symbols not found at', symbolsPath);
        }
      } else {
        console.warn('[Server] Fusion Home workspace not found — material symbols unavailable');
      }
    })
    .catch((err) => {
      console.error('[Server] Failed to resolve Fusion Home path:', err.message);
    });

  return { fusionHandlers, clipboardHandlers, themeHandlers, secretsHandlers, screenshotHandlers, bookmarksHandlers, emojiRecentsHandlers };
}

/**
 * The post-listen pipeline: watcher, hold registry, action handlers,
 * filters, triggers, cron scheduler, heartbeat monitor.
 *
 * Split out of `start()` only for readability — the split has no
 * semantic effect. Everything here runs synchronously from inside the
 * `server.listen()` callback.
 *
 * @private
 */
function _startPipeline({ sessions, projectRoot, workspaceId }) {
  if (!projectRoot) {
    console.log('[Server] No active workspace — pipeline skipped');
    return;
  }
  // Start project-wide file watcher
  const { createWatcher } = require('./watch/workspace-watcher');
  const { loadFilters } = require('./watcher/filter-loader');
  const { createActionHandlers } = require('./watcher/actions');

  // Issues/tickets — optional, not every workspace has an issues-viewer
  const issuesViewRoot = views.resolveViewRoot(projectRoot, 'issues-viewer', { includeHidden: true });
  const issuesDir = views.resolveOperationalViewRoot(projectRoot, 'issues-viewer');
  const createTicketCandidates = [
    issuesViewRoot && path.join(issuesViewRoot, 'scripts', 'create-ticket.js'),
    path.join(issuesDir, 'scripts', 'create-ticket.js'),
  ].filter(Boolean);
  let createTicket = () => { console.warn('[Server] createTicket unavailable — issues-viewer not in this workspace'); return null; };
  const createTicketPath = createTicketCandidates.find((candidate) => fs.existsSync(candidate));
  if (createTicketPath) {
    const loadedCreateTicket = require(createTicketPath);
    createTicket = typeof loadedCreateTicket === 'function'
      ? loadedCreateTicket
      : loadedCreateTicket.createTicket;
    if (typeof createTicket !== 'function') {
      createTicket = () => { console.warn('[Server] createTicket export is invalid'); return null; };
    }
  } else {
    console.log('[Server] issues-viewer/scripts/create-ticket not found — ticket creation disabled');
  }

  // Create hold registry for auto-block timers
  const { createHoldRegistry } = require('./triggers/hold-registry');
  const holdRegistry = global.__holdRegistry = createHoldRegistry(issuesDir);

  // Wrap createTicket to hook trigger-created tickets into the hold registry
  const wrappedCreateTicket = function(ticketData) {
    const result = createTicket(ticketData);
    if (ticketData.autoHold && ticketData.triggerName && result?.id) {
      holdRegistry.hold(ticketData.assignee, ticketData.triggerName, result.id);
    }
    return result;
  };

  const projectWatcher = createWatcher(projectRoot, { workspaceId });

  // Load declarative filters (.md) from filters/
  const filterDir = path.join(__dirname, 'watcher', 'filters');
  // Load modal component definitions from ai/components/
  const componentsDir = path.join(projectRoot, 'ai', 'components');
  loadComponents(componentsDir);

  const actionHandlers = createActionHandlers({
    createTicket: wrappedCreateTicket,
    projectRoot,
    getModalDefinition,
    db: getDb(),
    sendChatMessage(target, message, role) {
      for (const [ws, sess] of sessions) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'system_message',
            content: message,
            role: role || 'system',
            target,
          }));
        }
      }
    },
    broadcastModal(config) {
      for (const [ws, sess] of sessions) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'modal:show', ...config }));
        }
      }
    },
    broadcastFileChange(payload) {
      for (const [ws, sess] of sessions) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify(payload));
        }
      }
    },
  });
  const declFilters = loadFilters(filterDir, actionHandlers);
  for (const f of declFilters) projectWatcher.addFilter(f);

  // Load agent TRIGGERS.md files
  const { loadTriggers } = require('./triggers/trigger-loader');
  const { createCronScheduler } = require('./triggers/cron-scheduler');
  const { evaluateCondition } = require('./watcher/filter-loader');

  const agentsBasePath = views.resolveOperationalViewRoot(projectRoot, 'agents-viewer');
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(agentsBasePath, 'registry.json'), 'utf8'));
    const { filters: triggerFilters, cronTriggers } = loadTriggers(
      projectRoot, agentsBasePath, registry, actionHandlers
    );

    for (const f of triggerFilters) projectWatcher.addFilter(f);

    if (cronTriggers.length > 0) {
      const cronScheduler = createCronScheduler(wrappedCreateTicket, { evaluateCondition });
      for (const { trigger, assignee } of cronTriggers) {
        cronScheduler.register(trigger, assignee);
      }
      cronScheduler.start();
    }
  } catch (err) {
    console.error(`[Server] Failed to load agent triggers: ${err.message}`);
  }

  // Start runner heartbeat monitor
  const { checkHeartbeats } = require('./runner');
  checkHeartbeats(projectRoot);
}

module.exports = {
  createAgentPhaseAOwner,
  createAgentWorkspaceRootResolver,
  initializeRuntimeMachineIdentity,
  start,
};
