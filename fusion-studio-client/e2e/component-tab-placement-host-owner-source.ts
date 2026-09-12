const sourceNames = ['Sidebar', 'Preview', 'Landing', 'Empty selector'] as const;

/** Emits the browser-side connected placement owner used only by the virtual test bundle. */
export function placementHostOwnerSource(
  viewTabBarPath: string,
  domainPath: string,
  resolverPath: string,
  rootErrorPolicyPath: string,
): string {
  return `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ViewTabBar } from ${JSON.stringify(viewTabBarPath)};
      import { createConnectedTabPlacementController } from ${JSON.stringify(domainPath)};
      import { createFirstPartyComponentResolver } from ${JSON.stringify(resolverPath)};
      import { reactRootErrorOptions } from ${JSON.stringify(rootErrorPolicyPath)};

      const sourceNames = ${JSON.stringify(sourceNames)};
      const listeners = new Set();
      const sourceRequests = new Map();
      let snapshot;
      let state;
      let result = null;
      let creationMode = 'normal';
      let revealMode = 'normal';
      let tabSequence = 0;
      let instanceSequence = 0;
      let unavailableRenderTargets = new Set();
      let activeInvocation = null;
      let evidence;

      const location = (...labels) => ({
        schemaVersion: 1,
        segments: labels.map((label) => ({ label })),
      });
      const tab = (id, label) => ({
        id,
        label,
        icon: 'description',
        closeLabel: 'Close ' + label,
        closable: true,
      });
      const emptyRecord = (id = 'tab-empty', revision = 0) => ({
        tabId: id,
        content: { kind: 'empty', revision },
        tab: tab(id, 'NEW TAB'),
        shell: {
          schemaVersion: 2,
          tabId: id,
          presenterId: null,
          location: location('New Tab'),
        },
      });
      const componentRecord = ({
        tabId,
        presenterId,
        targetKey,
        instanceId,
        label,
        breadcrumb = ['Documents', label],
        invalidComponent = false,
      }) => {
        const component = {
          schemaVersion: 1,
          componentTypeId: 'fixture.document',
          componentInstanceId: instanceId,
          input: { title: label, presenterId, targetKey },
          targetKey,
        };
        if (invalidComponent) component.privateDescriptor = '/Users/private/descriptor.ts';
        return {
          tabId,
          content: { kind: 'component', revision: 1, component },
          tab: tab(tabId, label),
          shell: {
            schemaVersion: 2,
            tabId,
            presenterId,
            location: location(...breadcrumb),
          },
        };
      };
      const targetCatalog = (presenterId, targetKey) => {
        const collision = targetKey === 'collision:a' || targetKey === 'collision:b';
        const shared = targetKey === 'shared:resource';
        const terminal = targetKey.split(':').at(-1) || 'target';
        const label = collision
          ? 'IDENTICAL LABEL'
          : shared
            ? 'SHARED RESOURCE'
            : terminal.toUpperCase();
        const breadcrumb = collision
          ? ['Identical', 'Location']
          : shared
            ? ['Shared', 'Resource']
            : ['Documents', terminal.toUpperCase()];
        return {
          schemaVersion: 1,
          presenterId,
          targetKey,
          componentTypeId: 'fixture.document',
          input: { title: label, presenterId, targetKey },
          tab: {
            label,
            icon: 'description',
            closeLabel: 'Close ' + label,
            closable: true,
          },
          location: location(...breadcrumb),
        };
      };
      const regularRecord = (
        id,
        presenterId,
        targetKey,
        instanceId,
      ) => {
        const resolved = targetCatalog(presenterId, targetKey);
        return componentRecord({
          tabId: id,
          presenterId,
          targetKey,
          instanceId,
          label: resolved.tab.label,
          breadcrumb: resolved.location.segments.map((segment) => segment.label),
        });
      };

      const seeds = {
        'single-empty': () => ({
          schemaVersion: 1,
          tabs: [emptyRecord('tab-empty', 4)],
          activeTabId: 'tab-empty',
          reservations: [],
        }),
        'single-populated': () => ({
          schemaVersion: 1,
          tabs: [regularRecord('tab-alpha', 'presenter.files', 'file:alpha', 'instance-alpha')],
          activeTabId: 'tab-alpha',
          reservations: [],
        }),
        'protected-active': () => ({
          schemaVersion: 1,
          tabs: [componentRecord({
            tabId: 'tab-protected',
            presenterId: 'presenter.protected',
            targetKey: 'protected:target',
            instanceId: 'instance-protected',
            label: 'PROTECTED',
            breadcrumb: ['Protected', 'Target'],
            invalidComponent: true,
          })],
          activeTabId: 'tab-protected',
          reservations: [],
        }),
        multi: () => ({
          schemaVersion: 1,
          tabs: [
            regularRecord('tab-alpha', 'presenter.files', 'file:alpha', 'instance-alpha'),
            regularRecord('tab-beta', 'presenter.files', 'file:beta', 'instance-beta'),
          ],
          activeTabId: 'tab-alpha',
          reservations: [],
        }),
        'exact-inactive': () => ({
          schemaVersion: 1,
          tabs: [
            regularRecord('tab-alpha', 'presenter.files', 'file:alpha', 'instance-alpha'),
            regularRecord('tab-beta', 'presenter.files', 'file:beta', 'instance-beta'),
          ],
          activeTabId: 'tab-beta',
          reservations: [],
        }),
        'display-collision': () => ({
          schemaVersion: 1,
          tabs: [regularRecord(
            'tab-collision-a',
            'presenter.files',
            'collision:a',
            'instance-collision-a',
          )],
          activeTabId: 'tab-collision-a',
          reservations: [],
        }),
        'presenter-collision': () => ({
          schemaVersion: 1,
          tabs: [regularRecord(
            'tab-presenter-one',
            'presenter.one',
            'shared:resource',
            'instance-presenter-one',
          )],
          activeTabId: 'tab-presenter-one',
          reservations: [],
        }),
        'reserved-empty': () => ({
          schemaVersion: 1,
          tabs: [emptyRecord('tab-reserved', 7)],
          activeTabId: 'tab-reserved',
          reservations: [{
            tabId: 'tab-reserved',
            operationId: 'operation-reserved',
            expectedRevision: 7,
            launcherId: 'fixture-launcher',
            status: 'pending',
          }],
        }),
        duplicates: () => ({
          schemaVersion: 1,
          tabs: [
            regularRecord('tab-duplicate-a', 'presenter.files', 'file:alpha', 'instance-duplicate-a'),
            regularRecord('tab-duplicate-b', 'presenter.files', 'file:alpha', 'instance-duplicate-b'),
          ],
          activeTabId: 'tab-duplicate-a',
          reservations: [],
        }),
      };

      const renderResolver = createFirstPartyComponentResolver([{
        componentTypeId: 'fixture.document',
        label: 'Fixture document',
        render: ({ descriptor, input }) => React.createElement(
          'article',
          {
            'data-testid': 'presenter-body',
            'data-instance-id': descriptor.componentInstanceId,
            'data-presenter-id': input.presenterId,
            'data-target-key': descriptor.targetKey,
          },
          React.createElement('h2', null, input.title),
          React.createElement('p', null, 'Rendered target ' + descriptor.targetKey),
        ),
      }]);
      const resolveForRender = (descriptor) => {
        if (unavailableRenderTargets.has(descriptor?.targetKey)) {
          return { status: 'unavailable', code: 'unknown', label: 'Component unavailable' };
        }
        return renderResolver(descriptor);
      };

      const activeRecord = () => state.tabs.find((record) => record.tabId === state.activeTabId);
      const serializeState = () => JSON.parse(JSON.stringify(state));
      const publicEvidence = () => JSON.parse(JSON.stringify(evidence));
      const summarize = () => ({
        activeTabId: state.activeTabId,
        order: state.tabs.map((record) => record.tabId),
        reservations: state.reservations,
        records: state.tabs.map((record) => ({
          tabId: record.tabId,
          label: record.tab?.label ?? null,
          kind: record.content?.kind ?? null,
          revision: record.content?.revision ?? null,
          componentTypeId: record.content?.component?.componentTypeId ?? null,
          componentInstanceId: record.content?.component?.componentInstanceId ?? null,
          input: record.content?.component?.input ?? null,
          tab: record.tab,
          presenterId: record.shell?.presenterId ?? null,
          targetKey: record.content?.component?.targetKey ?? null,
          location: record.shell?.location?.segments?.map((segment) => segment.label) ?? null,
        })),
      });
      const publish = () => {
        const active = activeRecord();
        snapshot = {
          panelId: 'placement-host-fixture',
          label: 'Placement fixture tabs',
          tabs: state.tabs.map((record) => record.tab),
          activeId: state.activeTabId,
          tabPanelTabIndex: -1,
          onActivate: (tabId) => {
            if (state.tabs.some((record) => record.tabId === tabId)) {
              state = { ...state, activeTabId: tabId };
              publish();
            }
          },
          onClose: () => undefined,
          add: { label: 'Add fixture tab', onAdd: () => null },
          content: {
            active: { tabId: active.tabId, content: active.content },
            shell: active.shell,
            reservation: state.reservations.find((item) => item.tabId === active.tabId) ?? null,
            resolve: resolveForRender,
            retryLauncher: () => undefined,
            cancelLauncher: () => undefined,
          },
        };
        listeners.forEach((listener) => listener());
      };

      const resolveTarget = (target) => {
        evidence.resolverCalls += 1;
        if (creationMode === 'unavailable') return null;
        if (creationMode === 'throw') {
          throw new Error('PRIVATE /Users/private/placement-resolver.ts stack');
        }
        if (creationMode === 'hostile') {
          const hostile = {};
          Object.defineProperty(hostile, 'schemaVersion', {
            enumerable: true,
            get: () => {
              evidence.hostileGetterCalls += 1;
              throw new Error('PRIVATE /Users/private/hostile-resolver.ts');
            },
          });
          return hostile;
        }
        return targetCatalog(target.presenterId, target.targetKey);
      };
      const controller = createConnectedTabPlacementController({
        readSnapshot: () => state,
        resolveTarget,
        mintTabId: () => {
          evidence.tabMints += 1;
          tabSequence += 1;
          return 'placed-tab-' + tabSequence;
        },
        mintComponentInstanceId: () => {
          evidence.instanceMints += 1;
          instanceSequence += 1;
          return 'placed-instance-' + instanceSequence;
        },
        commit: (request) => {
          evidence.commits.push({
            requestId: activeInvocation?.requestId ?? null,
            priorActiveTabId: request.priorSnapshot.activeTabId,
            nextActiveTabId: request.nextSnapshot.activeTabId,
            nextOrder: request.nextSnapshot.tabs.map((record) => record.tabId),
          });
          state = request.nextSnapshot;
          publish();
          return { schemaVersion: 1, status: 'committed', snapshot: state };
        },
        reveal: (request) => {
          evidence.reveals.push(request);
          if (revealMode === 'throw') {
            throw new Error('PRIVATE /Users/private/presenter-reveal.ts stack');
          }
        },
      });

      const invokeSource = async (sourceName) => {
        const configured = sourceRequests.get(sourceName);
        if (!configured) return;
        evidence.routeCalls.push({ source: sourceName, route: 'connected-placement-controller' });
        activeInvocation = { source: sourceName, requestId: configured.requestId };
        result = await controller.place({
          schemaVersion: 1,
          requestId: configured.requestId,
          disposition: configured.disposition,
          target: {
            presenterId: configured.presenterId,
            targetKey: configured.targetKey,
          },
        });
        activeInvocation = null;
        evidence.results.push(result);
        publish();
      };

      const reset = (seed = 'single-empty', options = {}) => {
        state = seeds[seed]();
        result = null;
        creationMode = options.creationMode ?? 'normal';
        revealMode = options.revealMode ?? 'normal';
        unavailableRenderTargets = new Set(options.unavailableRenderTargets ?? []);
        tabSequence = 0;
        instanceSequence = 0;
        sourceRequests.clear();
        evidence = {
          commits: [],
          reveals: [],
          resolverCalls: 0,
          tabMints: 0,
          instanceMints: 0,
          hostileGetterCalls: 0,
          routeCalls: [],
          results: [],
        };
        publish();
      };

      const testApi = {
        subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
        getSnapshot: () => snapshot,
        reset,
        configureSource: (sourceName, request) => { sourceRequests.set(sourceName, request); },
        state: serializeState,
        summary: () => JSON.parse(JSON.stringify(summarize())),
        evidence: publicEvidence,
        setCreationMode: (mode) => { creationMode = mode; },
        setRevealMode: (mode) => { revealMode = mode; },
        invokeSource,
      };
      window.__placementHost = testApi;
      reset();

`;
}
