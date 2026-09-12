import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import {
  normalizeViewTabContentAdapter,
  readViewTabContentLifecycle,
} from '../src/components/view-tabs/viewTabContentAdapter';

function directConnectedAdapter(active: unknown, shellTabId = 'tab-direct') {
  return {
    active,
    shell: {
      schemaVersion: 2,
      tabId: shellTabId,
      presenterId: 'fixture.presenter',
      location: {
        schemaVersion: 1,
        segments: [{ label: 'Fixture' }, { label: 'Direct' }],
      },
    },
    reservation: null,
    resolve: () => ({ status: 'unavailable', code: 'unknown', label: 'Unavailable' }),
    retryLauncher: () => undefined,
    cancelLauncher: () => undefined,
  };
}

test('connected normalization reads only exact outer lifecycle facts around an opaque component slot', () => {
  let componentGetterCalls = 0;
  const accessorContent: Record<string, unknown> = {
    kind: 'component',
    revision: 1,
  };
  Object.defineProperty(accessorContent, 'component', {
    enumerable: true,
    get: () => {
      componentGetterCalls += 1;
      throw new Error('PRIVATE /Users/owner/direct-component.ts');
    },
  });
  const accessorActive = { tabId: 'tab-direct', content: accessorContent };
  expect(readViewTabContentLifecycle(accessorActive)).toEqual({
    tabId: 'tab-direct',
    kind: 'component',
  });
  expect(normalizeViewTabContentAdapter(directConnectedAdapter(accessorActive))).not.toBeNull();
  expect(componentGetterCalls).toBe(0);

  let componentFunctionCalls = 0;
  const nonEnumerableContent: Record<string, unknown> = {
    kind: 'component',
    revision: 2,
  };
  Object.defineProperty(nonEnumerableContent, 'component', {
    enumerable: false,
    value: () => { componentFunctionCalls += 1; },
  });
  const nonEnumerableActive = { tabId: 'tab-direct', content: nonEnumerableContent };
  expect(readViewTabContentLifecycle(nonEnumerableActive)).toEqual({
    tabId: 'tab-direct',
    kind: 'component',
  });
  expect(normalizeViewTabContentAdapter(directConnectedAdapter(nonEnumerableActive))).not.toBeNull();
  expect(componentFunctionCalls).toBe(0);

  let outerGetterCalls = 0;
  const kindAccessor: Record<string, unknown> = { revision: 1, component: null };
  Object.defineProperty(kindAccessor, 'kind', {
    enumerable: true,
    get: () => {
      outerGetterCalls += 1;
      return 'component';
    },
  });
  const revisionAccessor: Record<string, unknown> = { kind: 'component', component: null };
  Object.defineProperty(revisionAccessor, 'revision', {
    enumerable: true,
    get: () => {
      outerGetterCalls += 1;
      return 1;
    },
  });
  const unknownKey = { kind: 'component', revision: 1, component: null, extra: true };
  const symbolKey: Record<PropertyKey, unknown> = {
    kind: 'component',
    revision: 1,
    component: null,
  };
  symbolKey[Symbol('private')] = true;
  const invalidOuterContent = [
    { kind: 'component', revision: 1 },
    kindAccessor,
    revisionAccessor,
    unknownKey,
    symbolKey,
    Object.assign(Object.create({ inherited: true }), {
      kind: 'component',
      revision: 1,
      component: null,
    }),
    { kind: 'unknown', revision: 1, component: null },
    { kind: 'component', revision: -1, component: null },
    { kind: 'empty', revision: 0, component: null },
  ];
  for (const content of invalidOuterContent) {
    const active = { tabId: 'tab-direct', content };
    expect(readViewTabContentLifecycle(active)).toBeNull();
    expect(normalizeViewTabContentAdapter(directConnectedAdapter(active))).toBeNull();
  }
  expect(normalizeViewTabContentAdapter(directConnectedAdapter(accessorActive, 'wrong-tab')))
    .toBeNull();
  expect(componentGetterCalls).toBe(0);
  expect(outerGetterCalls).toBe(0);
});

const bundles = new Map<string, Promise<string>>();

async function buildHarness(mode: 'test' | 'production') {
  const existing = bundles.get(mode);
  if (existing) return existing;
  const bundle = (async () => {
    const virtualEntry = 'virtual:component-tab-host-harness';
    const resolvedEntry = `\0${virtualEntry}`;
    const virtualAdapters = '\0virtual:component-tab-host-adapters';
    const viewTabBarPath = path.resolve('src/components/view-tabs/ViewTabBar.tsx');
    const domainPath = path.resolve('src/components/view-tabs/componentTabDomain.ts');
    const resolverPath = path.resolve('src/components/view-tabs/componentTabResolver.ts');
    const rootErrorPolicyPath = path.resolve('src/reactRootErrorPolicy.ts');
    const source = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ViewTabBar } from ${JSON.stringify(viewTabBarPath)};
      import {
        cancelEmptyTabReservation,
        closeComponentTab,
        commitEmptyTabFill,
        createEmptyTab,
        failEmptyTabReservation,
        reserveEmptyTab,
        retryEmptyTabReservation,
      } from ${JSON.stringify(domainPath)};
      import { createFirstPartyComponentResolver } from ${JSON.stringify(resolverPath)};
      import { reactRootErrorOptions } from ${JSON.stringify(rootErrorPolicyPath)};

      const listeners = new Set();
      const evidence = {
        actions: [],
        operations: [],
        outcomes: [],
        renders: [],
        resolverCalls: 0,
        adds: 0,
        closes: [],
        shellGetterCalls: 0,
        shellFunctionCalls: 0,
        navigationGetterCalls: 0,
        navigationFunctionCalls: 0,
        componentGetterCalls: 0,
        componentFunctionCalls: 0,
        backs: [],
        forwards: [],
        ownerCommits: [],
        presenterMounts: 0,
        presenterUnmounts: 0,
      };
      const freshId = () => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
      };
      const launcherItems = [
        { id: 'sync', label: 'Synchronous fixture', icon: 'bolt', description: 'Opens immediately.' },
        { id: 'async', label: 'Asynchronous fixture', icon: 'hourglass_top', description: 'Waits for completion.' },
        { id: 'failure', label: 'Failure fixture', icon: 'error', description: 'Can fail and retry.' },
        { id: 'disabled-component', label: 'Disabled component', icon: 'extension_off' },
        { id: 'disabled-launcher', label: 'Disabled launcher', icon: 'block', disabled: true },
        { id: 'unknown', label: 'Unknown component', icon: 'question_mark' },
      ];
      // VIEW-02 §6: the grid is retired; the catalog label survives only as
      // bounded pending/retry copy on the reservation surface.
      const reservationLabelFor = (launcherId) => (
        launcherItems.find((item) => item.id === launcherId)?.label ?? null
      );
      let sequence = 0;
      let unknownEnabled = false;
      let activeOverride = null;
      let hasActiveOverride = false;
      let malformedContent = false;
      let contentAccessor = false;
      let malformedNested = null;
      let malformedResolution = null;
      let resolutionOverride = null;
      let presenterFailure = null;
      let shellFault = null;
      let navigationFault = null;
      const locationOverrides = new Map();
      let closeOutcome = null;
      let focusOutsideOnClose = false;
      let addReturnsNull = false;
      const initialTabId = freshId();
      const initialInstanceId = freshId();
      let state = {
        tabs: [{
          tabId: initialTabId,
          content: {
            kind: 'component',
            revision: 1,
            component: {
              schemaVersion: 1,
              componentTypeId: 'fixture.sync',
              componentInstanceId: initialInstanceId,
              input: { title: 'Initial', source: 'test-adapter' },
              targetKey: 'fixture:initial',
            },
          },
        }],
        activeTabId: initialTabId,
        reservations: [],
      };
      let rail = [{
        id: initialTabId,
        label: 'Initial fixture',
        icon: 'home',
        closeLabel: 'Close Initial fixture',
        closable: true,
      }];
      const pending = new Map();

      function StatefulPresenter({ label, targetKey }) {
        const [count, setCount] = React.useState(0);
        React.useEffect(() => {
          evidence.presenterMounts += 1;
          return () => { evidence.presenterUnmounts += 1; };
        }, []);
        return React.createElement('button', {
          type: 'button',
          'data-target-key': targetKey,
          onClick: () => setCount((value) => value + 1),
        }, label + ' state ' + count);
      }
      function ThrowingPresenter() {
        throw new Error('PRIVATE /Users/owner/connected-presenter.tsx stack');
      }
      class ThrowingLifecyclePresenter extends React.Component {
        componentDidMount() {
          throw new Error('PRIVATE /Users/owner/connected-lifecycle.tsx stack');
        }

        render() {
          return React.createElement('div', null, 'Transient connected lifecycle presenter');
        }
      }
      const renderRegistration = (componentTypeId, label, disabled = false) => ({
        componentTypeId,
        label,
        disabled,
        render: ({ descriptor, input, actions }) => {
          evidence.renders.push({
            componentTypeId,
            instanceId: descriptor.componentInstanceId,
            targetKey: descriptor.targetKey,
            input,
          });
          if (document.body.dataset.shell === 'true'
            && descriptor.componentInstanceId === initialInstanceId) {
            return React.createElement(StatefulPresenter, {
              label: 'Initial presenter',
              targetKey: descriptor.targetKey,
            });
          }
          return React.createElement('button', {
            type: 'button',
            'data-instance-id': descriptor.componentInstanceId,
            'data-target-key': descriptor.targetKey,
            onClick: () => actions.activate(descriptor.componentInstanceId, input.title),
          }, 'Resolved ' + input.title);
        },
      });
      const baseResolver = createFirstPartyComponentResolver([
        renderRegistration('fixture.sync', 'Synchronous fixture'),
        renderRegistration('fixture.async', 'Asynchronous fixture'),
        renderRegistration('fixture.failure', 'Failure fixture'),
        renderRegistration('fixture.disabled', 'Disabled fixture', true),
      ], {
        activate: (instanceId, title) => evidence.actions.push([instanceId, title]),
      });
      const unknownResolver = createFirstPartyComponentResolver([
        renderRegistration('fixture.unknown', 'Recovered fixture'),
      ], {
        activate: (instanceId, title) => evidence.actions.push([instanceId, title]),
      });
      const throwingResolver = createFirstPartyComponentResolver([{
        componentTypeId: 'fixture.sync',
        label: 'Throwing fixture',
        render: () => React.createElement(ThrowingPresenter),
      }], {});
      const lifecycleThrowingResolver = createFirstPartyComponentResolver([{
        componentTypeId: 'fixture.sync',
        label: 'Lifecycle-throwing fixture',
        render: () => React.createElement(ThrowingLifecyclePresenter),
      }], {});
      const resolve = (descriptor) => {
        evidence.resolverCalls += 1;
        return resolutionOverride
          ? { status: 'unavailable', code: resolutionOverride, label: 'Temporarily unavailable' }
          : malformedResolution === 'ready'
          ? { status: 'ready', key: 'malformed:ready', render: 7 }
          : malformedResolution === 'render-throws'
            ? { status: 'ready', key: 'malformed:throws', render: () => { throw new Error('Private provider failure'); } }
          : malformedResolution === 'unavailable'
              ? { status: 'unavailable', code: 'unknown', label: 'Malformed', extra: true }
              : presenterFailure === 'render'
                ? throwingResolver(descriptor)
                : presenterFailure === 'lifecycle'
                  ? lifecycleThrowingResolver(descriptor)
              : unknownEnabled && descriptor?.componentTypeId === 'fixture.unknown'
                ? unknownResolver(descriptor)
                : baseResolver(descriptor);
      };

      const identity = (reservation) => ({
        tabId: reservation.tabId,
        operationId: reservation.operationId,
        expectedRevision: reservation.expectedRevision,
      });
      const descriptorFor = (launcherId, title = launcherId) => ({
        schemaVersion: 1,
        componentTypeId: launcherId === 'disabled-component'
          ? 'fixture.disabled'
          : launcherId === 'unknown'
            ? 'fixture.unknown'
            : 'fixture.' + launcherId,
        componentInstanceId: freshId(),
        input: { title, launcherId, source: 'test-adapter' },
        targetKey: 'fixture:' + launcherId,
      });

      let snapshot;
      const activeRecord = () => state.tabs.find((tab) => tab.tabId === state.activeTabId);
      const currentReservation = (tabId) => (
        state.reservations.find((reservation) => reservation.tabId === tabId) ?? null
      );
      const publish = () => {
        snapshot = makeSnapshot();
        const active = activeRecord();
        if (active?.content.kind === 'component') {
          const fallbackLocation = [
            { label: 'Fixture' },
            { label: active.content.component.input.title },
          ];
          evidence.ownerCommits.push({
            tabId: active.tabId,
            targetKey: active.content.component.targetKey ?? null,
            location: (locationOverrides.get(active.tabId) ?? fallbackLocation)
              .map((segment) => segment.label),
          });
        }
        listeners.forEach((listener) => listener());
      };
      const apply = (nextState) => {
        state = nextState;
        publish();
      };
      const rememberOperation = (reservation, descriptor) => {
        const operation = { ...identity(reservation), launcherId: reservation.launcherId };
        pending.set(reservation.operationId, { operation, descriptor });
        evidence.operations.push(operation);
      };
      const recordOutcome = (operationId, result) => {
        evidence.outcomes.push([operationId, result.ok ? 'ok' : result.code]);
        if (result.state !== state) apply(result.state);
        return result;
      };

      const complete = (operationId) => {
        const entry = pending.get(operationId);
        if (!entry) return null;
        return recordOutcome(
          operationId,
          commitEmptyTabFill(state, entry.operation, entry.descriptor),
        );
      };
      const fail = (operationId, code = 'launch_failed') => {
        const entry = pending.get(operationId);
        if (!entry) return null;
        return recordOutcome(
          operationId,
          failEmptyTabReservation(state, entry.operation, { code }),
        );
      };
      const selectLauncher = (tabId, launcherId) => {
        const reserved = reserveEmptyTab(state, tabId, launcherId, freshId);
        if (!reserved.ok) {
          evidence.outcomes.push(['reserve:' + tabId + ':' + launcherId, reserved.code]);
          return;
        }
        const component = descriptorFor(launcherId, rail.find((tab) => tab.id === tabId)?.label ?? launcherId);
        rememberOperation(reserved.reservation, component);
        apply(reserved.state);
        if (launcherId === 'sync' || launcherId === 'disabled-component' || launcherId === 'unknown') {
          complete(reserved.reservation.operationId);
        }
      };
      const retryLauncher = (tabId) => {
        const previous = currentReservation(tabId);
        const retried = retryEmptyTabReservation(state, tabId, freshId);
        if (!retried.ok || !previous) {
          evidence.outcomes.push(['retry:' + tabId, retried.ok ? 'missing_previous' : retried.code]);
          return;
        }
        const prior = pending.get(previous.operationId);
        rememberOperation(
          retried.reservation,
          prior?.descriptor ?? descriptorFor(retried.reservation.launcherId),
        );
        apply(retried.state);
      };
      const cancelLauncher = (tabId) => {
        const reservation = currentReservation(tabId);
        if (!reservation) return;
        recordOutcome(
          reservation.operationId,
          cancelEmptyTabReservation(state, identity(reservation)),
        );
      };
      const closeTab = (tabId) => {
        evidence.closes.push(tabId);
        if (focusOutsideOnClose) document.getElementById('outside')?.focus();
        if (closeOutcome === 'remove-adapter' && state.tabs.length === 1 && state.tabs[0]?.tabId === tabId) {
          snapshot = null;
          listeners.forEach((listener) => listener());
          return;
        }
        if (closeOutcome === 'replacement' && state.tabs.length === 1 && state.tabs[0]?.tabId === tabId) {
          const replacementTabId = freshId();
          const replacementInstanceId = freshId();
          state = {
            tabs: [{
              tabId: replacementTabId,
              content: {
                kind: 'component',
                revision: 0,
                component: {
                  schemaVersion: 1,
                  componentTypeId: 'fixture.sync',
                  componentInstanceId: replacementInstanceId,
                  input: { title: 'Replacement', source: 'test-adapter' },
                },
              },
            }],
            activeTabId: replacementTabId,
            reservations: [],
          };
          rail = [{
            id: replacementTabId,
            label: 'Replacement',
            icon: 'home',
            closeLabel: 'Close Replacement',
            closable: true,
          }];
          publish();
          return;
        }
        const closed = closeComponentTab(state, tabId);
        if (!closed.ok) return;
        rail = rail.filter((tab) => tab.id !== tabId);
        apply(closed.state);
      };
      const addTab = () => {
        evidence.adds += 1;
        if (addReturnsNull) return null;
        const created = createEmptyTab(state, freshId);
        if (!created.ok) return null;
        sequence += 1;
        rail = [...rail, {
          id: created.tabId,
          label: 'Container ' + sequence,
          icon: 'tab',
          closeLabel: 'Close Container ' + sequence,
          closable: true,
        }];
        apply(created.state);
        return created.tabId;
      };
      const addBackgroundTab = () => {
        const activeTabId = state.activeTabId;
        const createdId = addTab();
        if (!createdId) return null;
        state = { ...state, activeTabId };
        publish();
        return createdId;
      };
      const activate = (tabId) => {
        if (!state.tabs.some((tab) => tab.tabId === tabId)) return;
        apply({ ...state, activeTabId: tabId });
      };
      const navigate = (tabId, direction) => {
        const active = activeRecord();
        if (!active || active.tabId !== tabId) return;
        evidence[direction === 'back' ? 'backs' : 'forwards'].push(tabId);
        if (active.content.kind !== 'component') return;
        const targetLabel = direction === 'back' ? 'Previous Target' : 'Next Target';
        const targetKey = direction === 'back' ? 'fixture:previous-target' : 'fixture:next-target';
        locationOverrides.set(tabId, [{ label: 'Fixture' }, { label: targetLabel }]);
        state = {
          ...state,
          tabs: state.tabs.map((candidate) => candidate.tabId === tabId ? {
            ...candidate,
            content: {
              ...candidate.content,
              revision: candidate.content.revision + 1,
              component: { ...candidate.content.component, targetKey },
            },
          } : candidate),
        };
        publish();
      };

      function makeSnapshot() {
        const active = activeRecord();
        const common = {
          panelId: 'component-host-fixture',
          label: 'Fixture component tabs',
          tabs: rail,
          activeId: state.activeTabId,
          tabPanelTabIndex: -1,
          onActivate: activate,
          onClose: closeTab,
          add: { label: 'New component tab', icon: 'add', onAdd: addTab },
        };
        if (document.body.dataset.mode === 'legacy') return common;
        const validContent = {
          active: hasActiveOverride ? activeOverride : { ...active, content: { ...active.content } },
          reservation: currentReservation(active.tabId),
          resolve,
          retryLauncher,
          cancelLauncher,
        };
        const activeReservationLabel = reservationLabelFor(
          currentReservation(active.tabId)?.launcherId ?? null,
        );
        if (activeReservationLabel) validContent.reservationLabel = activeReservationLabel;
        if (document.body.dataset.shell === 'true') {
          const title = active.content.kind === 'empty'
            ? (rail.find((tab) => tab.id === active.tabId)?.label ?? 'New Tab')
            : active.content.component.input.title;
          const validShell = {
            schemaVersion: 2,
            tabId: active.tabId,
            presenterId: active.content.kind === 'empty' ? null : 'fixture.presenter',
            location: {
              schemaVersion: 1,
              segments: active.content.kind === 'empty'
                ? [{ label: 'New Tab' }]
                : locationOverrides.get(active.tabId) ?? [{ label: 'Fixture' }, { label: title }],
            },
          };
          if (shellFault === 'absent') {
            // Navigation without its correlated shell is an invalid opt-in.
          } else if (shellFault === 'undefined') validContent.shell = undefined;
          else if (shellFault === 'null') validContent.shell = null;
          else if (shellFault === 'version') validContent.shell = { ...validShell, schemaVersion: 1 };
          else if (shellFault === 'mismatch') validContent.shell = { ...validShell, tabId: freshId() };
          else if (shellFault === 'component-null') validContent.shell = {
            ...validShell,
            presenterId: null,
          };
          else if (shellFault === 'empty-presenter') validContent.shell = {
            ...validShell,
            presenterId: 'fixture.invalid-empty-presenter',
          };
          else if (shellFault === 'malformed') validContent.shell = 'PRIVATE PROVIDER /Users/private';
          else if (shellFault === 'unknown') validContent.shell = {
            ...validShell,
            privatePath: '/Users/private/secret.txt',
          };
          else if (shellFault === 'symbol') {
            validContent.shell = { ...validShell };
            validContent.shell[Symbol('private-provider')] = '/Users/private/secret.txt';
          } else if (shellFault === 'function') validContent.shell = {
            ...validShell,
            callback: () => { evidence.shellFunctionCalls += 1; },
          };
          else if (shellFault === 'inherited') {
            validContent.shell = Object.assign(
              Object.create({ privatePath: '/Users/private/secret.txt' }),
              validShell,
            );
          } else if (shellFault === 'accessor') {
            Object.defineProperty(validContent, 'shell', {
              enumerable: true,
              get: () => {
                evidence.shellGetterCalls += 1;
                throw new Error('PRIVATE PROVIDER /Users/private/secret.txt');
              },
            });
          } else validContent.shell = validShell;
          const validNavigation = {
            tabId: active.tabId,
            canGoBack: active.tabId === initialTabId,
            canGoForward: active.tabId !== initialTabId,
            goBack: (tabId) => { navigate(tabId, 'back'); },
            goForward: (tabId) => { navigate(tabId, 'forward'); },
          };
          if (navigationFault === 'absent') {
            // Absence is the valid no-navigation case.
          } else if (navigationFault === 'undefined') {
            validContent.navigation = undefined;
          } else if (navigationFault === 'null') {
            validContent.navigation = null;
          } else if (navigationFault === 'wrong-tab') {
            validContent.navigation = { ...validNavigation, tabId: freshId() };
          } else if (navigationFault === 'partial') {
            validContent.navigation = { ...validNavigation };
            delete validContent.navigation.goForward;
          } else if (navigationFault === 'malformed') {
            validContent.navigation = '/Users/private/navigation';
          } else if (navigationFault === 'symbol') {
            validContent.navigation = { ...validNavigation };
            validContent.navigation[Symbol('private-navigation')] = true;
          } else if (navigationFault === 'inherited') {
            validContent.navigation = Object.assign(Object.create({ private: true }), validNavigation);
          } else if (navigationFault === 'accessor') {
            Object.defineProperty(validContent, 'navigation', {
              enumerable: true,
              get: () => {
                evidence.navigationGetterCalls += 1;
                throw new Error('PRIVATE NAVIGATION');
              },
            });
          } else if (navigationFault === 'function') {
            validContent.navigation = { ...validNavigation, privateCallback: () => {
              evidence.navigationFunctionCalls += 1;
            } };
          } else validContent.navigation = validNavigation;
        }
        const next = {
          ...common,
          content: malformedContent
            ? null
            : malformedNested === 'empty-body'
              ? { ...validContent, renderEmptyBody: 'PRIVATE PROVIDER /Users/private/empty-body' }
              : malformedNested === 'reservation'
                ? { ...validContent, reservation: {} }
                : malformedNested === 'active'
                  ? {
                    ...validContent,
                    active: {
                      ...validContent.active,
                      content: { ...validContent.active.content, extra: true },
                    },
                  }
                  : malformedNested === 'diagnostic'
                    ? {
                      ...validContent,
                      reservation: {
                        tabId: active.tabId,
                        operationId: freshId(),
                        expectedRevision: active.content.revision,
                        launcherId: 'failure',
                        status: 'failed',
                        error: {
                          code: 'provider_failure',
                          message: '/Users/alice/SecretProject/credential.json',
                        },
                      },
                    }
                    : malformedNested === 'pending-error'
                      ? {
                        ...validContent,
                        reservation: {
                          tabId: active.tabId,
                          operationId: freshId(),
                          expectedRevision: active.content.revision,
                          launcherId: 'failure',
                          status: 'pending',
                          error: {
                            code: 'launch_failed',
                            message: 'The component could not be opened. Try again.',
                          },
                        },
                      }
                      : malformedNested === 'failed-without-error'
                        ? {
                          ...validContent,
                          reservation: {
                            tabId: active.tabId,
                            operationId: freshId(),
                            expectedRevision: active.content.revision,
                            launcherId: 'failure',
                            status: 'failed',
                          },
                        }
                : validContent,
        };
        if (contentAccessor) {
          Object.defineProperty(next, 'content', {
            enumerable: true,
            get: () => { throw new Error('Content accessors are not supported.'); },
          });
        }
        return next;
      }

      const serializableState = () => JSON.parse(JSON.stringify({ state, rail }));
      const controller = {
        subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
        getSnapshot: () => snapshot,
        state: serializableState,
        evidence: () => JSON.parse(JSON.stringify(evidence)),
        ownerCommits: () => JSON.parse(JSON.stringify(evidence.ownerCommits)),
        clearOwnerCommits: () => { evidence.ownerCommits = []; },
        shell: () => {
          const value = snapshot?.content?.shell;
          return value === undefined ? null : JSON.parse(JSON.stringify(value));
        },
        currentOperation: (tabId) => currentReservation(tabId)?.operationId ?? null,
        operations: () => JSON.parse(JSON.stringify(evidence.operations)),
        complete,
        fail,
        selectLauncher,
        malformedResolution: (kind) => { malformedResolution = kind; publish(); },
        malformedComponentSlot: (kind) => {
          const tab = activeRecord();
          const content = {
            kind: 'component',
            revision: tab.content.revision + 1,
          };
          if (kind === 'accessor') {
            Object.defineProperty(content, 'component', {
              enumerable: true,
              get: () => {
                evidence.componentGetterCalls += 1;
                throw new Error('PRIVATE /Users/owner/connected-component.ts');
              },
            });
          } else {
            Object.defineProperty(content, 'component', {
              enumerable: false,
              value: () => { evidence.componentFunctionCalls += 1; },
            });
          }
          activeOverride = { tabId: tab.tabId, content };
          hasActiveOverride = true;
          publish();
        },
        setPresenterFailure: (kind) => {
          presenterFailure = kind;
          const tab = activeRecord();
          if (!tab || tab.content.kind !== 'component') return;
          const title = kind === 'render'
            ? 'Render failure'
            : kind === 'lifecycle'
              ? 'Lifecycle failure'
              : 'Recovered presenter';
          locationOverrides.set(tab.tabId, [{ label: 'Fixture' }, { label: title }]);
          state = {
            ...state,
            tabs: state.tabs.map((candidate) => candidate.tabId === tab.tabId ? {
              ...candidate,
              content: {
                ...candidate.content,
                revision: candidate.content.revision + 1,
                component: {
                  ...candidate.content.component,
                  componentInstanceId: freshId(),
                  input: { ...candidate.content.component.input, title },
                  targetKey: 'fixture:' + title.toLowerCase().replaceAll(' ', '-'),
                },
              },
            } : candidate),
          };
          publish();
        },
        enableUnknown: () => { unknownEnabled = true; publish(); },
        injectUnavailable: (kind) => {
          const tab = activeRecord();
          const component = descriptorFor('sync', kind);
          if (kind === 'unsupported') component.schemaVersion = 2;
          if (kind === 'invalid') component.extra = true;
          state = {
            ...state,
            tabs: state.tabs.map((candidate) => candidate.tabId === tab.tabId ? {
              tabId: tab.tabId,
              content: { kind: 'component', revision: tab.content.revision + 1, component },
            } : candidate),
            reservations: state.reservations.filter((reservation) => reservation.tabId !== tab.tabId),
          };
          publish();
        },
        mismatch: () => {
          activeOverride = {
            tabId: freshId(),
            content: {
              kind: 'component',
              revision: 1,
              component: descriptorFor('sync', 'Mismatched content'),
            },
          };
          hasActiveOverride = true;
          publish();
        },
        malformed: () => {
          activeOverride = null;
          hasActiveOverride = true;
          publish();
        },
        malformedContent: () => {
          malformedContent = true;
          contentAccessor = false;
          malformedNested = null;
          publish();
        },
        malformedContentAccessor: () => {
          malformedContent = false;
          contentAccessor = true;
          malformedNested = null;
          publish();
        },
        malformedNested: (kind) => {
          malformedContent = false;
          contentAccessor = false;
          malformedNested = kind;
          activeOverride = null;
          hasActiveOverride = false;
          publish();
        },
        shellFault: (kind) => { shellFault = kind; publish(); },
        navigationFault: (kind) => { navigationFault = kind; publish(); },
        setDisplayProjection: (label, segments) => {
          rail = rail.map((tab) => tab.id === state.activeTabId ? { ...tab, label } : tab);
          locationOverrides.set(state.activeTabId, segments.map((segment) => ({ label: segment })));
          publish();
        },
        resolutionOverride: (kind) => { resolutionOverride = kind; publish(); },
        addBackgroundTab,
        setCloseDescriptor: (next) => {
          rail = rail.map((tab) => tab.id === state.activeTabId ? { ...tab, ...next } : tab);
          publish();
        },
        setCloseOutcome: (outcome, focusOutside = false) => {
          closeOutcome = outcome;
          focusOutsideOnClose = focusOutside;
        },
        setAddReturnsNull: (value) => { addReturnsNull = value; },
        dropActiveDescriptor: () => { rail = []; publish(); },
      };
      window.__componentTabHostController = controller;
      publish();

      const legacyChild = React.createElement('button', {
        type: 'button',
        id: 'legacy-child',
        onClick: () => evidence.actions.push(['legacy-child']),
      }, 'Exact legacy child');
      createRoot(document.querySelector('#consumer-root'), reactRootErrorOptions).render(
        React.createElement(ViewTabBar, { panel: 'component-host-fixture' }, legacyChild),
      );
    `;
    const adapterSource = `
      import { useSyncExternalStore } from 'react';
      export function useViewTabAdapter(panelId) {
        const controller = window.__componentTabHostController;
        const snapshot = useSyncExternalStore(
          controller.subscribe,
          controller.getSnapshot,
          controller.getSnapshot,
        );
        return panelId === 'component-host-fixture' ? snapshot : null;
      }
    `;
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      mode,
      plugins: [{
        name: 'component-tab-host-harness',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === virtualEntry) return resolvedEntry;
          if (id.includes('viewTabAdapters') && importer?.split('?')[0] === viewTabBarPath) {
            return virtualAdapters;
          }
          return null;
        },
        load(id) {
          if (id === resolvedEntry) return source;
          if (id === virtualAdapters) return adapterSource;
          return null;
        },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: virtualEntry,
          output: { format: 'iife', name: 'ComponentTabHostHarness' },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Component tab host harness did not build.');
    return chunk.code;
  })();
  bundles.set(mode, bundle);
  return bundle;
}

async function mount(page: Page, options: {
  mode?: 'test' | 'production';
  legacy?: boolean;
  shell?: boolean;
} = {}) {
  const mode = options.mode ?? 'test';
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  await page.setContent(
    `<body data-mode="${options.legacy ? 'legacy' : 'generic'}" data-shell="${options.shell ? 'true' : 'false'}"><button id="outside">Outside control</button><div id="outside-surface">Outside surface</div><section class="rv-panel active" data-panel="component-host-fixture"><div class="rv-content-area" tabindex="-1"><main id="consumer-root"></main></div></section></body>`,
  );
  await page.addScriptTag({ content: await buildHarness(mode) });
  try {
    await expect(page.getByRole('tablist', { name: 'Fixture component tabs' })).toBeVisible();
    if (options.shell) {
      await expect(page.getByRole('navigation', { name: /Location:/ })).toBeVisible();
    }
  } catch (error) {
    if (pageErrors.length > 0) throw new Error(pageErrors.join('\n'));
    throw error;
  }
}

function controllerState(page: Page) {
  return page.evaluate(() => window.__componentTabHostController.state());
}

function currentOperation(page: Page, tabId: string) {
  return page.evaluate((id) => window.__componentTabHostController.currentOperation(id), tabId);
}

test('real shell route creates unique empties and fills controller-driven launchers in place', async ({ page }) => {
  await mount(page);
  const tablist = page.getByRole('tablist', { name: 'Fixture component tabs' });
  const panel = page.getByRole('tabpanel');
  await expect(panel).toHaveCount(1);
  await expect(panel.getByRole('tabpanel')).toHaveCount(0);
  await expect(page.getByRole('tablist')).toHaveCount(1);

  const add = page.getByRole('button', { name: 'New component tab' });
  await add.click();
  await add.click();
  await expect(tablist.getByRole('tab')).toHaveCount(3);
  await expect(tablist.getByRole('tab')).toHaveText([
    /Initial fixture/,
    /Container 1/,
    /Container 2/,
  ]);
  const stateAfterAdds = await controllerState(page);
  const ids = stateAfterAdds.state.tabs.map((tab: { tabId: string }) => tab.tabId);
  expect(new Set(ids).size).toBe(3);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  const newestId = ids[2];
  const firstEmptyId = ids[1];
  const newestTab = tablist.locator(`[data-tab-id="${newestId}"]`);
  await expect(newestTab).toHaveAttribute('aria-selected', 'true');
  await expect(newestTab).toBeFocused();

  // VIEW-02 §6: the Empty surface presents no launcher menu — the neutral
  // container only (no grid, no launch buttons).
  await expect(panel.locator('.rv-empty-tab-launcher')).toHaveCount(0);
  await expect(panel.locator('.rv-empty-tab-neutral')).toBeVisible();

  const panelId = await panel.getAttribute('id');
  const newestTabId = await newestTab.getAttribute('id');
  await expect(newestTab).toHaveAttribute('aria-controls', panelId ?? 'missing');
  await expect(panel).toHaveAttribute('aria-labelledby', newestTabId ?? 'missing');
  // The launcher lifecycle is owner/controller-driven (no menu UI): the
  // synchronous fixture fills THIS empty tab in place. Focus starts inside
  // the panel (as an in-panel interaction would leave it), so the empty →
  // component replacement preserves focus onto the new body.
  await panel.locator('.rv-component-tab-panel').focus();
  await page.evaluate((id) => (
    window.__componentTabHostController.selectLauncher(id, 'sync')
  ), newestId);
  await expect(panel.getByRole('button', { name: 'Resolved Container 2' })).toBeVisible();
  await expect(panel.locator('.rv-component-tab-panel')).toBeFocused();
  const syncFilled = await controllerState(page);
  expect(syncFilled.state.tabs.map((tab: { tabId: string }) => tab.tabId)).toEqual(ids);
  expect(syncFilled.state.activeTabId).toBe(newestId);
  expect(syncFilled.state.tabs[2].content).toMatchObject({ kind: 'component', revision: 1 });
  await expect(newestTab).toHaveAttribute('aria-selected', 'true');
  await expect(panel).toHaveAttribute('aria-labelledby', newestTabId ?? 'missing');
  await panel.getByRole('button', { name: 'Resolved Container 2' }).click();
  const evidence = await page.evaluate(() => window.__componentTabHostController.evidence());
  const resolvedRender = evidence.renders.find((render) => (
    (render.input as { title?: string }).title === 'Container 2'
  ));
  expect(resolvedRender).toMatchObject({
    componentTypeId: 'fixture.sync',
    input: {
      title: 'Container 2',
      launcherId: 'sync',
      source: 'test-adapter',
    },
  });
  expect(resolvedRender?.instanceId).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  expect(resolvedRender?.instanceId).not.toBe(newestId);
  expect(evidence.actions.at(-1)?.[1]).toBe('Container 2');

  const finalEmptyClose = tablist.getByRole('button', { name: 'Close Container 2' });
  await finalEmptyClose.focus();
  await page.keyboard.press('Enter');
  await expect(tablist.locator(`[data-tab-id="${newestId}"]`)).toHaveCount(0);
  const firstEmptyTab = tablist.locator(`[data-tab-id="${firstEmptyId}"]`);
  await expect(firstEmptyTab).toHaveAttribute('aria-selected', 'true');
  await expect(firstEmptyTab).toBeFocused();
  await page.evaluate((id) => (
    window.__componentTabHostController.selectLauncher(id, 'async')
  ), firstEmptyId);
  const operationId = await currentOperation(page, firstEmptyId);
  expect(operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  await expect(panel.getByRole('status')).toContainText('Opening Asynchronous fixture');
  await panel.getByRole('button', { name: 'Cancel' }).focus();
  const beforeAsync = await controllerState(page);
  await page.evaluate((id) => window.__componentTabHostController.complete(id!), operationId);
  await expect(panel.getByRole('button', { name: 'Resolved Container 1' })).toBeVisible();
  await expect(panel.locator('.rv-component-tab-panel')).toBeFocused();
  const afterAsync = await controllerState(page);
  expect(afterAsync.state.tabs.map((tab: { tabId: string }) => tab.tabId)).toEqual(
    beforeAsync.state.tabs.map((tab: { tabId: string }) => tab.tabId),
  );
  expect(afterAsync.state.activeTabId).toBe(firstEmptyId);
  await expect(firstEmptyTab).toHaveAttribute('aria-controls', panelId ?? 'missing');
  await tablist.getByRole('button', { name: 'Close Container 1' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
});

test('rendered owner rejects close, cancel, re-reserve, retry, prior-fill, and filled-tab races', async ({ page }) => {
  await mount(page);
  const panel = page.getByRole('tabpanel');
  const add = page.getByRole('button', { name: 'New component tab' });
  const tablist = page.getByRole('tablist', { name: 'Fixture component tabs' });

  await add.click();
  let tabId = (await controllerState(page)).state.activeTabId;
  await page.evaluate((id) => window.__componentTabHostController.selectLauncher(id, 'async'), tabId);
  let oldOperation = await currentOperation(page, tabId);
  await tablist.getByRole('button', { name: 'Close Container 1' }).click();
  const afterClose = await controllerState(page);
  await page.evaluate((id) => window.__componentTabHostController.complete(id!), oldOperation);
  expect(await controllerState(page)).toEqual(afterClose);

  await add.click();
  tabId = (await controllerState(page)).state.activeTabId;
  await page.evaluate((id) => window.__componentTabHostController.selectLauncher(id, 'async'), tabId);
  oldOperation = await currentOperation(page, tabId);
  await panel.getByRole('button', { name: 'Cancel' }).click();
  const afterCancel = await controllerState(page);
  await page.evaluate((id) => window.__componentTabHostController.complete(id!), oldOperation);
  expect(await controllerState(page)).toEqual(afterCancel);

  await add.click();
  tabId = (await controllerState(page)).state.activeTabId;
  await page.evaluate((id) => window.__componentTabHostController.selectLauncher(id, 'async'), tabId);
  oldOperation = await currentOperation(page, tabId);
  await page.evaluate((id) => window.__componentTabHostController.selectLauncher(id, 'failure'), tabId);
  const replacementOperation = await currentOperation(page, tabId);
  expect(replacementOperation).not.toBe(oldOperation);
  const afterRereserve = await controllerState(page);
  await page.evaluate((id) => window.__componentTabHostController.complete(id!), oldOperation);
  expect(await controllerState(page)).toEqual(afterRereserve);
  await page.evaluate((id) => window.__componentTabHostController.complete(id!), replacementOperation);
  await expect(panel.getByRole('button', { name: 'Resolved Container 3' })).toBeVisible();

  await add.click();
  tabId = (await controllerState(page)).state.activeTabId;
  await page.evaluate((id) => window.__componentTabHostController.selectLauncher(id, 'failure'), tabId);
  oldOperation = await currentOperation(page, tabId);
  await page.evaluate((id) => window.__componentTabHostController.fail(id!), oldOperation);
  await expect(panel.getByRole('alert')).toHaveText('The component could not be opened. Try again.');
  await expect(panel.getByRole('button', { name: 'Retry Failure fixture' })).toBeVisible();
  const failedState = await controllerState(page);
  expect(failedState.state.tabs.find((tab: { tabId: string }) => tab.tabId === tabId).content.kind).toBe('empty');
  expect(failedState.state.reservations[0]).toMatchObject({
    tabId,
    operationId: oldOperation,
    launcherId: 'failure',
    status: 'failed',
  });
  await panel.getByRole('button', { name: 'Retry Failure fixture' }).click();
  const retryOperation = await currentOperation(page, tabId);
  expect(retryOperation).not.toBe(oldOperation);
  const afterRetry = await controllerState(page);
  await page.evaluate((id) => window.__componentTabHostController.complete(id!), oldOperation);
  expect(await controllerState(page)).toEqual(afterRetry);
  await page.evaluate((id) => window.__componentTabHostController.complete(id!), retryOperation);
  await expect(panel.getByRole('button', { name: 'Resolved Container 4' })).toBeVisible();

  await add.click();
  tabId = (await controllerState(page)).state.activeTabId;
  await page.evaluate((id) => window.__componentTabHostController.selectLauncher(id, 'async'), tabId);
  oldOperation = await currentOperation(page, tabId);
  await page.locator('#outside-surface').click();
  await expect(page.locator('body')).toBeFocused();
  await page.evaluate((id) => window.__componentTabHostController.complete(id!), oldOperation);
  await expect(page.locator('body')).toBeFocused();
  const afterFill = await controllerState(page);
  await page.evaluate((id) => window.__componentTabHostController.complete(id!), oldOperation);
  expect(await controllerState(page)).toEqual(afterFill);
  await page.evaluate((id) => window.__componentTabHostController.selectLauncher(id, 'sync'), tabId);
  expect(await controllerState(page)).toEqual(afterFill);
  const outcomes = await page.evaluate(() => window.__componentTabHostController.evidence().outcomes);
  expect(outcomes).toContainEqual([oldOperation, 'stale_completion']);
  expect(outcomes).toContainEqual([`reserve:${tabId}:sync`, 'tab_not_empty']);
});

test('unknown, invalid, disabled, and unsupported content stay inert, closable, and recoverable', async ({ page }) => {
  await mount(page);
  const panel = page.getByRole('tabpanel');
  const tablist = page.getByRole('tablist', { name: 'Fixture component tabs' });
  const add = page.getByRole('button', { name: 'New component tab' });

  await add.click();
  let tabId = (await controllerState(page)).state.activeTabId;
  await page.evaluate((id) => window.__componentTabHostController.selectLauncher(id, 'unknown'), tabId);
  await expect(panel.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'unknown');
  await expect(panel.getByRole('button', { name: /Resolved/ })).toHaveCount(0);
  const unknownState = await controllerState(page);
  expect(unknownState.state.tabs.at(-1).content).toMatchObject({
    kind: 'component',
    component: { componentTypeId: 'fixture.unknown' },
  });
  await page.evaluate(() => window.__componentTabHostController.enableUnknown());
  await expect(panel.getByRole('button', { name: 'Resolved Container 1' })).toBeVisible();
  expect((await controllerState(page)).state.activeTabId).toBe(tabId);
  await tablist.getByRole('button', { name: 'Close Container 1' }).click();

  await add.click();
  tabId = (await controllerState(page)).state.activeTabId;
  await page.evaluate((id) => window.__componentTabHostController.selectLauncher(id, 'disabled-component'), tabId);
  await expect(panel.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'disabled');
  await expect(tablist.getByRole('button', { name: 'Close Container 2' })).toBeEnabled();
  await tablist.getByRole('button', { name: 'Close Container 2' }).click();

  for (const [sequence, kind, code] of [
    [3, 'unsupported', 'version_unsupported'],
    [4, 'invalid', 'invalid'],
  ] as const) {
    await add.click();
    tabId = (await controllerState(page)).state.activeTabId;
    await page.evaluate((value) => window.__componentTabHostController.injectUnavailable(value), kind);
    await expect(panel.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', code);
    await expect(panel.getByRole('button', { name: /Resolved/ })).toHaveCount(0);
    await expect(tablist.getByRole('button', { name: `Close Container ${sequence}` })).toBeEnabled();
    expect((await controllerState(page)).state.activeTabId).toBe(tabId);
    await tablist.getByRole('button', { name: `Close Container ${sequence}` }).click();
  }
});

for (const [kind, code] of [
  ['unsupported', 'version_unsupported'],
  ['invalid', 'invalid'],
] as const) {
  test(`valid shell chrome and management survive a ${kind} component body`, async ({ page }) => {
    await mount(page, { shell: true });
    const initialTabId = (await controllerState(page)).state.activeTabId;
    const rendersBefore = await page.evaluate(
      () => window.__componentTabHostController.evidence().renders.length,
    );
    await page.evaluate((value) => window.__componentTabHostController.injectUnavailable(value), kind);

    await expect(page.getByRole('tablist')).toHaveCount(1);
    await expect(page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('Initial fixture');
    await expect(page.getByRole('navigation', { name: `Location: Fixture > ${kind}` })).toBeVisible();
    await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute(
      'data-unavailable-code',
      code,
    );
    await expect(page.getByRole('button', { name: 'Close Initial fixture' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'New component tab' })).toBeEnabled();
    expect(await page.evaluate(
      () => window.__componentTabHostController.evidence().renders.length,
    )).toBe(rendersBefore);

    await page.getByRole('button', { name: 'New component tab' }).click();
    const tablist = page.getByRole('tablist', { name: 'Fixture component tabs' });
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    await tablist.locator(`[data-tab-id="${initialTabId}"]`).click();
    await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute(
      'data-unavailable-code',
      code,
    );
    await expect(page.getByRole('navigation', { name: `Location: Fixture > ${kind}` })).toBeVisible();
    await tablist.getByRole('button', { name: 'Close Initial fixture' }).click();
    expect((await page.evaluate(() => window.__componentTabHostController.evidence())).closes)
      .toContain(initialTabId);
    await expect(page.getByText(/PRIVATE|provider|Users\//i)).toHaveCount(0);
  });
}

for (const slotKind of ['accessor', 'non-enumerable'] as const) {
  test(`valid shell chrome survives an opaque ${slotKind} component slot`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleMessages: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'assert') {
        consoleMessages.push(message.text());
      }
    });
    await mount(page, { shell: true });
    const initialTabId = (await controllerState(page)).state.activeTabId;
    const evidenceBefore = await page.evaluate(
      () => window.__componentTabHostController.evidence(),
    );

    await page.evaluate(
      (kind) => window.__componentTabHostController.malformedComponentSlot(kind),
      slotKind,
    );

    await expect(page.getByRole('tablist')).toHaveCount(1);
    await expect(page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('Initial fixture');
    await expect(page.getByRole('navigation', { name: 'Location: Fixture > Initial' })).toBeVisible();
    await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute(
      'data-unavailable-code',
      'invalid',
    );
    await expect(page.locator('.rv-component-tab-unavailable').getByRole('heading'))
      .toHaveText('Component unavailable');
    await expect(page.locator('.rv-component-tab-resolved')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New component tab' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Close Initial fixture' })).toBeEnabled();

    const evidenceAfter = await page.evaluate(
      () => window.__componentTabHostController.evidence(),
    );
    expect(evidenceAfter.resolverCalls).toBe(evidenceBefore.resolverCalls);
    expect(evidenceAfter.renders).toEqual(evidenceBefore.renders);
    expect(evidenceAfter).toMatchObject({
      componentGetterCalls: 0,
      componentFunctionCalls: 0,
    });
    expect(pageErrors).toEqual([]);
    expect(consoleMessages.join('\n')).not.toMatch(/PRIVATE|\/Users\/owner|component\.tsx|stack/i);
    await expect(page.getByText(/PRIVATE|\/Users\/owner|connected-component|stack/i)).toHaveCount(0);

    await page.evaluate(() => {
      window.__componentTabHostController.setCloseOutcome('remove-adapter');
    });
    await page.getByRole('button', { name: 'Close Initial fixture' }).click();
    await expect(page.getByRole('button', { name: 'Exact legacy child' })).toBeVisible();
    expect((await page.evaluate(() => window.__componentTabHostController.evidence())).closes)
      .toContain(initialTabId);
    expect(await page.evaluate(() => window.__componentTabHostController.evidence()))
      .toMatchObject({ componentGetterCalls: 0, componentFunctionCalls: 0 });
  });
}

test('legacy fallback preserves the supplied child and exactly one shell tabpanel', async ({ page }) => {
  await mount(page, { legacy: true });
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.getByRole('tabpanel').getByRole('tabpanel')).toHaveCount(0);
  const child = page.getByRole('button', { name: 'Exact legacy child' });
  await expect(child).toHaveCount(1);
  await child.click();
  expect(await page.evaluate(() => window.__componentTabHostController.evidence().actions)).toContainEqual([
    'legacy-child',
  ]);
  await expect(page.locator('.rv-component-tab-panel')).toHaveCount(0);
});

test('active-content mismatch asserts in test and never renders component or legacy content', async ({ page }) => {
  const assertions: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'assert' || message.type() === 'error') assertions.push(message.text());
  });
  await mount(page, { mode: 'test' });
  for (const kind of ['ready', 'unavailable', 'render-throws']) {
    const assertionCountBeforeResolution = assertions.length;
    const rendersBefore = await page.evaluate(
      () => window.__componentTabHostController.evidence().renders.length,
    );
    await page.evaluate((value) => window.__componentTabHostController.malformedResolution(value), kind);
    await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
    await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Resolved/ })).toHaveCount(0);
    expect(await page.evaluate(
      () => window.__componentTabHostController.evidence().renders.length,
    )).toBe(rendersBefore);
    await expect.poll(() => assertions.length).toBeGreaterThan(assertionCountBeforeResolution);
    await page.evaluate(() => window.__componentTabHostController.malformedResolution(null));
    await expect(page.getByRole('button', { name: 'Resolved Initial' })).toBeVisible();
  }
  const activeId = (await controllerState(page)).state.activeTabId;
  await page.evaluate(() => window.__componentTabHostController.mismatch());
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('button', { name: 'Resolved Mismatched content' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
  await expect(page.locator('.rv-component-tab-panel')).toHaveAttribute('data-tab-id', activeId);
  expect(assertions.join('\n')).toContain('content lifecycle must be valid and match');
  const assertionCount = assertions.length;
  await page.evaluate(() => window.__componentTabHostController.malformedContent());
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
  await expect.poll(() => assertions.length).toBeGreaterThan(assertionCount);
  let previousAssertionCount = assertions.length;
  await page.evaluate(() => window.__componentTabHostController.malformedContentAccessor());
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
  await expect.poll(() => assertions.length).toBeGreaterThan(previousAssertionCount);
  previousAssertionCount = assertions.length;
  await page.getByRole('button', { name: 'New component tab' }).click();
  for (const kind of [
    'empty-body',
    'reservation',
    'active',
    'diagnostic',
    'pending-error',
    'failed-without-error',
  ]) {
    const actionsBefore = await page.evaluate(
      () => window.__componentTabHostController.evidence().actions.length,
    );
    await page.evaluate((value) => window.__componentTabHostController.malformedNested(value), kind);
    await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
    await expect(page.locator('.rv-empty-tab-launcher')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('/Users/alice/SecretProject/credential.json')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
    expect(await page.evaluate(
      () => window.__componentTabHostController.evidence().actions.length,
    )).toBe(actionsBefore);
    await expect.poll(() => assertions.length).toBeGreaterThan(previousAssertionCount);
    previousAssertionCount = assertions.length;
  }
  expect(pageErrors).toEqual([]);
});

test('production mismatch is an inert unavailable state', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mount(page, { mode: 'production' });
  for (const kind of ['ready', 'unavailable', 'render-throws']) {
    const rendersBefore = await page.evaluate(
      () => window.__componentTabHostController.evidence().renders.length,
    );
    await page.evaluate((value) => window.__componentTabHostController.malformedResolution(value), kind);
    await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
    await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Resolved/ })).toHaveCount(0);
    expect(await page.evaluate(
      () => window.__componentTabHostController.evidence().renders.length,
    )).toBe(rendersBefore);
    await page.evaluate(() => window.__componentTabHostController.malformedResolution(null));
    await expect(page.getByRole('button', { name: 'Resolved Initial' })).toBeVisible();
  }
  await page.evaluate(() => window.__componentTabHostController.mismatch());
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('button', { name: /Resolved Mismatched/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
  await page.evaluate(() => window.__componentTabHostController.malformed());
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
  await page.evaluate(() => window.__componentTabHostController.malformedContent());
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
  await page.evaluate(() => window.__componentTabHostController.malformedContentAccessor());
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
  await page.getByRole('button', { name: 'New component tab' }).click();
  for (const kind of [
    'empty-body',
    'reservation',
    'active',
    'diagnostic',
    'pending-error',
    'failed-without-error',
  ]) {
    await page.evaluate((value) => window.__componentTabHostController.malformedNested(value), kind);
    await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
    await expect(page.locator('.rv-empty-tab-launcher')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('/Users/alice/SecretProject/credential.json')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
  }
  expect(pageErrors).toEqual([]);
});

test('connected shell derives single-strip to tabbed Empty to tabbed component to single-strip without identity or mount churn', async ({ page }) => {
  await mount(page, { shell: true });
  const panel = page.getByRole('tabpanel');
  const tablist = page.getByRole('tablist', { name: 'Fixture component tabs' });
  const selectedLabel = page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label');
  const selectedTab = page.locator('.rv-view-tab-item.is-selected .rv-view-tab');
  await expect(tablist).toBeVisible();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(panel.getByRole('tabpanel')).toHaveCount(0);
  await expect(panel).toHaveAttribute('aria-labelledby', await selectedTab.getAttribute('id') ?? '');
  await expect(panel).toHaveAccessibleName('Initial fixture');
  await expect(page.getByRole('button', { name: 'New component tab' })).toHaveCount(1);
  await expect(page.locator('.rv-view-tab-add')).toHaveCount(1);

  const singleAdd = page.locator('.rv-view-tab-add');
  await page.evaluate(() => window.__componentTabHostController.setAddReturnsNull(true));
  await singleAdd.click();
  await expect(singleAdd).toBeFocused();
  expect((await page.evaluate(() => window.__componentTabHostController.evidence())).adds).toBe(1);
  await page.evaluate(() => window.__componentTabHostController.setAddReturnsNull(false));

  const initial = await controllerState(page);
  const initialTabSnapshot = structuredClone(initial.state.tabs[0]);
  const initialRail = structuredClone(initial.rail[0]);
  const initialShell = await page.evaluate(() => window.__componentTabHostController.shell());
  await panel.getByRole('button', { name: 'Initial presenter state 0' }).click();
  await expect(panel.getByRole('button', { name: 'Initial presenter state 1' })).toBeVisible();

  const backgroundId = await page.evaluate(() => window.__componentTabHostController.addBackgroundTab());
  await expect(tablist).toBeVisible();
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(tablist.getByRole('tab', { name: /Initial fixture/ })).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByRole('button', { name: 'Initial presenter state 1' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Location: Fixture > Initial' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New component tab' })).toHaveCount(1);
  await expect(page.locator('.rv-view-tab-add')).toHaveCount(1);
  expect(await page.evaluate(() => window.__componentTabHostController.evidence())).toMatchObject({
    presenterMounts: 1,
    presenterUnmounts: 0,
  });

  const backgroundClose = tablist.getByRole('button', { name: 'Close Container 1' });
  await backgroundClose.focus();
  await backgroundClose.click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(selectedTab).toBeFocused();
  await expect(panel.getByRole('button', { name: 'Initial presenter state 1' })).toBeVisible();
  expect(await page.evaluate(() => window.__componentTabHostController.evidence())).toMatchObject({
    presenterMounts: 1,
    presenterUnmounts: 0,
  });

  await singleAdd.click();
  const afterAdd = await controllerState(page);
  const emptyId = afterAdd.state.activeTabId;
  expect(emptyId).not.toBe(backgroundId);
  expect(afterAdd.state.tabs[0]).toEqual(initialTabSnapshot);
  expect(afterAdd.rail[0]).toEqual(initialRail);
  expect(afterAdd.state.tabs.map((tab: { tabId: string }) => tab.tabId)).toEqual([
    initialTabSnapshot.tabId,
    emptyId,
  ]);
  await expect(tablist.locator(`[data-tab-id="${emptyId}"]`)).toBeFocused();
  await expect(tablist.locator(`[data-tab-id="${emptyId}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.rv-empty-tab-panel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New component tab' })).toHaveCount(1);

  await tablist.getByRole('tab', { name: /Initial fixture/ }).click();
  await expect(panel.getByRole('button', { name: 'Initial presenter state 0' })).toBeVisible();
  expect(await page.evaluate(() => window.__componentTabHostController.evidence())).toMatchObject({
    presenterMounts: 2,
    presenterUnmounts: 1,
  });
  await expect(page.getByRole('navigation', { name: 'Location: Fixture > Initial' })).toBeVisible();
  const activeTabId = await tablist.getByRole('tab', { name: /Initial fixture/ }).getAttribute('id');
  await expect(panel).toHaveAttribute('aria-labelledby', activeTabId ?? '');
  const finalEmptyClose = tablist.getByRole('button', { name: 'Close Container 2' });
  await finalEmptyClose.focus();
  await page.keyboard.press('Enter');
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(selectedTab).toBeFocused();
  await expect(selectedLabel).toHaveText('Initial fixture');
  const finalState = await controllerState(page);
  expect(finalState.state.tabs).toEqual([initialTabSnapshot]);
  expect(finalState.rail).toEqual([initialRail]);
  expect(await page.evaluate(() => window.__componentTabHostController.shell())).toEqual(initialShell);
});

test('connected component and Empty stacks retain shell chrome through unavailable-to-ready recovery', async ({ page }) => {
  await mount(page, { shell: true });
  await page.getByRole('button', { name: 'New component tab' }).click();
  const panel = page.getByRole('tabpanel');
  const tablist = page.getByRole('tablist', { name: 'Fixture component tabs' });
  await expect(page.locator('.rv-view-tab-rail')).toBeVisible();
  await expect(page.locator('.rv-empty-tab-panel')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Location: New Tab' })).toBeVisible();
  await expect(page.locator('.rv-view-tab-rail')).toHaveCount(1);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);

  const emptyTabId = (await controllerState(page)).state.activeTabId;
  await page.evaluate((id) => window.__componentTabHostController.selectLauncher(id, 'sync'), emptyTabId);
  const locationRail = page.getByRole('navigation', { name: 'Location: Fixture > Container 1' });
  const resolved = panel.getByRole('button', { name: 'Resolved Container 1' });
  await expect(locationRail).toContainText('Fixture');
  await expect(locationRail).toContainText('Container 1');
  await expect(resolved).toBeVisible();
  expect((await controllerState(page)).state.activeTabId).toBe(emptyTabId);
  expect(await page.evaluate(() => {
    const rail = document.querySelector('.rv-view-tab-rail');
    const location = document.querySelector('.rv-component-tab-location-rail');
    const body = document.querySelector('.rv-component-tab-shell-body');
    return Boolean(
      rail && location && body
      && (rail.compareDocumentPosition(location) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (location.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
  })).toBe(true);

  for (const status of ['unknown', 'disabled', 'version_unsupported']) {
    await page.evaluate((value) => window.__componentTabHostController.resolutionOverride(value), status);
    await expect(locationRail).toBeVisible();
    await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', status);
    await expect(tablist.getByRole('button', { name: 'Close Container 1' })).toBeEnabled();
  }
  await page.evaluate(() => window.__componentTabHostController.resolutionOverride(null));
  await expect(resolved).toBeVisible();

  const initialClose = tablist.getByRole('button', { name: 'Close Initial fixture' });
  await initialClose.focus();
  await page.keyboard.press('Enter');
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('Container 1');
  await expect(locationRail).toBeVisible();
  await expect(panel.getByRole('tabpanel')).toHaveCount(0);
});

test('connected descendant render failures stay body-scoped, private, stable, and recover by body identity', async ({ page }) => {
  const caughtReport = '[Fusion Studio] A component error was contained.';
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await mount(page, { shell: true });

  const panel = page.getByRole('tabpanel');
  const initialState = await controllerState(page);
  const initialTabId = initialState.state.activeTabId;
  const initialBody = structuredClone(initialState.state.tabs[0]);
  await expect(page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('Initial fixture');
  await expect(page.getByRole('navigation', { name: 'Location: Fixture > Initial' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Initial presenter state 0' })).toBeVisible();

  await page.evaluate(() => {
    window.__componentTabHostController.setDisplayProjection(
      'Initial fixture',
      ['Fixture', 'Healthy shell update'],
    );
    window.__componentTabHostController.navigationFault('absent');
  });
  const healthyBackgroundId = await page.evaluate(
    () => window.__componentTabHostController.addBackgroundTab(),
  );
  const tablist = page.getByRole('tablist', { name: 'Fixture component tabs' });
  await expect(tablist.locator(`[data-tab-id="${initialTabId}"]`)).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('navigation', {
    name: 'Location: Fixture > Healthy shell update',
  })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Initial presenter state 0' })).toBeVisible();
  expect(healthyBackgroundId).not.toBeNull();
  await tablist.getByRole('button', { name: 'Close Container 1' })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('Initial fixture');
  expect(await page.evaluate(() => window.__componentTabHostController.evidence())).toMatchObject({
    presenterMounts: 1,
    presenterUnmounts: 0,
  });
  expect((await controllerState(page)).state.tabs[0]).toEqual(initialBody);

  await page.evaluate(() => {
    window.__componentTabHostController.navigationFault(null);
    window.__componentTabHostController.setDisplayProjection(
      'Initial fixture',
      ['Fixture', 'Initial'],
    );
  });
  const resolverCallsBeforeFailure = await page.evaluate(
    () => window.__componentTabHostController.evidence().resolverCalls,
  );
  await page.evaluate(() => window.__componentTabHostController.setPresenterFailure('render'));
  const unavailable = panel.locator('.rv-component-tab-unavailable');
  await expect(unavailable).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(unavailable.getByRole('heading')).toHaveText('Component unavailable');
  await expect(unavailable.getByText('This content is not available right now.')).toBeVisible();
  await expect(panel.locator('.rv-component-tab-resolved')).toHaveCount(0);
  await expect(page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('Initial fixture');
  await expect(page.getByRole('navigation', { name: 'Location: Fixture > Render failure' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New component tab' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Close Initial fixture' })).toBeEnabled();
  await expect.poll(() => consoleErrors).toEqual([caughtReport]);
  expect(pageErrors).toEqual([]);
  const resolverCallsAfterFailure = await page.evaluate(
    () => window.__componentTabHostController.evidence().resolverCalls,
  );
  // React retries a caught render once before the boundary commits its fallback.
  expect(resolverCallsAfterFailure).toBe(resolverCallsBeforeFailure + 2);
  await expect.poll(() => page.evaluate(
    () => window.__componentTabHostController.evidence().resolverCalls,
  )).toBe(resolverCallsAfterFailure);
  const failedBody = structuredClone((await controllerState(page)).state.tabs[0]);

  await page.evaluate(() => {
    window.__componentTabHostController.setDisplayProjection(
      'Failure-safe fixture',
      ['Fixture', 'Failure-safe location'],
    );
    window.__componentTabHostController.navigationFault('absent');
  });
  const failureBackgroundId = await page.evaluate(
    () => window.__componentTabHostController.addBackgroundTab(),
  );
  await expect(tablist.locator(`[data-tab-id="${initialTabId}"]`)).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('navigation', {
    name: 'Location: Fixture > Failure-safe location',
  })).toBeVisible();
  await expect(unavailable).toBeVisible();
  await expect(page.getByRole('button', { name: 'New component tab' })).toBeEnabled();
  await expect(tablist.getByRole('button', { name: /Close/ })).toHaveCount(2);
  expect(failureBackgroundId).not.toBeNull();
  await tablist.getByRole('button', { name: 'Close Container 2' })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('Failure-safe fixture');
  await expect(unavailable).toBeVisible();
  expect((await controllerState(page)).state.tabs[0]).toEqual(failedBody);
  expect(consoleErrors).toEqual([caughtReport]);
  expect(pageErrors).toEqual([]);

  await page.evaluate(() => window.__componentTabHostController.setPresenterFailure(null));
  await expect(panel.getByRole('button', { name: 'Resolved Recovered presenter' })).toBeVisible();
  await expect(unavailable).toHaveCount(0);
  const recoveredBody = (await controllerState(page)).state.tabs[0] as {
    content: {
      revision: number;
      component: { componentInstanceId: string; targetKey: string };
    };
  };
  expect(recoveredBody.content.revision).toBe(
    (failedBody.content as { revision: number }).revision + 1,
  );
  expect(recoveredBody.content.component.componentInstanceId).not.toBe(
    (failedBody.content as { component: { componentInstanceId: string } })
      .component.componentInstanceId,
  );
  expect(recoveredBody.content.component.targetKey).toBe('fixture:recovered-presenter');

  const resolverCallsBeforeLifecycleFailure = await page.evaluate(
    () => window.__componentTabHostController.evidence().resolverCalls,
  );
  await page.evaluate(() => window.__componentTabHostController.setPresenterFailure('lifecycle'));
  await expect(panel.locator('.rv-component-tab-unavailable')).toHaveAttribute(
    'data-unavailable-code',
    'invalid',
  );
  await expect(page.getByText('Transient connected lifecycle presenter')).toHaveCount(0);
  await expect.poll(() => consoleErrors).toEqual([caughtReport, caughtReport]);
  expect(await page.evaluate(
    () => window.__componentTabHostController.evidence().resolverCalls,
  )).toBe(resolverCallsBeforeLifecycleFailure + 1);

  await page.evaluate(() => window.__componentTabHostController.setPresenterFailure(null));
  await expect(panel.getByRole('button', { name: 'Resolved Recovered presenter' })).toBeVisible();
  await expect(panel.locator('.rv-component-tab-unavailable')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([caughtReport, caughtReport]);
  expect(consoleErrors.join('\n')).not.toMatch(/PRIVATE|\/Users\/owner|connected-|stack/i);
  await expect(page.getByText(/PRIVATE|\/Users\/owner|connected-presenter|connected-lifecycle|stack/i))
    .toHaveCount(0);
});

test('active switching updates selected identity, location, navigation, and body atomically', async ({ page }) => {
  await mount(page, { shell: true });
  const initial = await controllerState(page);
  const initialTabId = initial.state.activeTabId;
  const panel = page.getByRole('tabpanel');
  const back = page.getByRole('button', { name: 'Back' });
  const forward = page.getByRole('button', { name: 'Forward' });
  await expect(back).toBeEnabled();
  await expect(forward).toBeDisabled();
  await forward.evaluate((button: HTMLButtonElement) => button.click());

  await page.getByRole('button', { name: 'New component tab' }).click();
  const emptyTabId = (await controllerState(page)).state.activeTabId;
  const tablist = page.getByRole('tablist', { name: 'Fixture component tabs' });
  await expect(tablist.locator(`[data-tab-id="${emptyTabId}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('navigation', { name: 'Location: New Tab' })).toBeVisible();
  await expect(panel.locator('.rv-empty-tab-panel')).toBeVisible();
  await expect(back).toBeDisabled();
  await expect(forward).toBeEnabled();
  await back.evaluate((button: HTMLButtonElement) => button.click());
  await forward.click();

  await tablist.locator(`[data-tab-id="${initialTabId}"]`).click();
  await expect(tablist.locator(`[data-tab-id="${initialTabId}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('navigation', { name: 'Location: Fixture > Initial' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Initial presenter state 0' })).toBeVisible();
  await expect(back).toBeEnabled();
  await expect(forward).toBeDisabled();

  expect(await page.evaluate(() => window.__componentTabHostController.evidence())).toMatchObject({
    backs: [],
    forwards: [emptyTabId],
  });
});

test('target-changing navigation commits targetKey and location in one owner snapshot and DOM render', async ({ page }) => {
  await mount(page, { shell: true });
  const before = await controllerState(page);
  const activeBefore = before.state.tabs[0] as {
    tabId: string;
    content: { component: { targetKey: string }; revision: number };
  };
  expect(activeBefore.content.component.targetKey).toBe('fixture:initial');
  await expect(page.getByRole('navigation', { name: 'Location: Fixture > Initial' })).toBeVisible();
  await expect(page.locator('[data-target-key="fixture:initial"]')).toBeVisible();

  await page.evaluate(() => {
    window.__componentTabHostController.clearOwnerCommits();
    window.__atomicTargetLocationSamples = [];
    window.__atomicTargetLocationObserver = new MutationObserver(() => {
      const location = document.querySelector('.rv-component-tab-breadcrumb')
        ?.getAttribute('aria-label');
      const targetKey = document.querySelector<HTMLElement>('[data-target-key]')
        ?.dataset.targetKey;
      if (location && targetKey) {
        window.__atomicTargetLocationSamples?.push({ location, targetKey });
      }
    });
    window.__atomicTargetLocationObserver.observe(
      document.querySelector('[role="tabpanel"]')!,
      { attributes: true, childList: true, subtree: true },
    );
  });
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('navigation', {
    name: 'Location: Fixture > Previous Target',
  })).toBeVisible();
  await expect(page.locator('[data-target-key="fixture:previous-target"]')).toBeVisible();

  const after = await controllerState(page);
  const activeAfter = after.state.tabs[0] as typeof activeBefore;
  expect(activeAfter.tabId).toBe(activeBefore.tabId);
  expect(activeAfter.content.revision).toBe(activeBefore.content.revision + 1);
  expect(activeAfter.content.component.targetKey).toBe('fixture:previous-target');
  expect(await page.evaluate(() => window.__componentTabHostController.shell())).toMatchObject({
    tabId: activeBefore.tabId,
    location: {
      segments: [{ label: 'Fixture' }, { label: 'Previous Target' }],
    },
  });
  expect(await page.evaluate(() => window.__componentTabHostController.ownerCommits())).toEqual([{
    tabId: activeBefore.tabId,
    targetKey: 'fixture:previous-target',
    location: ['Fixture', 'Previous Target'],
  }]);
  const samples = await page.evaluate(() => {
    window.__atomicTargetLocationObserver?.disconnect();
    return window.__atomicTargetLocationSamples ?? [];
  });
  expect(samples.length).toBeGreaterThan(0);
  expect(samples).toEqual(samples.map(() => ({
    location: 'Location: Fixture > Previous Target',
    targetKey: 'fixture:previous-target',
  })));
});

test('display identity and index-document omission do not replace machine or runtime identity', async ({ page }) => {
  await mount(page, { shell: true });
  const before = await controllerState(page);
  const activeBefore = structuredClone(before.state.tabs[0]);
  await page.getByRole('button', { name: 'Initial presenter state 0' }).click();
  await page.evaluate(() => {
    window.__componentTabHostController.setDisplayProjection(
      'WIKI',
      ['Wiki', 'Chat System'],
    );
  });
  await expect(page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('WIKI');
  await expect(page.getByRole('navigation', { name: 'Location: Wiki > Chat System' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Initial presenter state 1' })).toBeVisible();
  expect((await controllerState(page)).state.tabs[0]).toEqual(activeBefore);
  expect(await page.evaluate(() => window.__componentTabHostController.evidence())).toMatchObject({
    presenterMounts: 1,
    presenterUnmounts: 0,
  });

  for (const relativePath of [
    'src/components/view-tabs/ViewTabBar.tsx',
    'src/components/view-tabs/ComponentTabShellPanel.tsx',
    'src/components/view-tabs/TabLocationRail.tsx',
  ]) {
    expect(fs.readFileSync(path.resolve(relativePath), 'utf8')).not.toContain('PAGE.md');
  }
});

test('navigation absence hides controls and every malformed present capability fails closed inertly', async ({ page }) => {
  const assertions: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'assert' || message.type() === 'error') assertions.push(message.text());
  });
  await mount(page, { shell: true });
  await page.evaluate(() => window.__componentTabHostController.navigationFault('absent'));
  await expect(page.getByRole('navigation', { name: 'Location: Fixture > Initial' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Forward' })).toHaveCount(0);

  await page.evaluate(() => {
    window.__componentTabHostController.navigationFault(null);
    window.__componentTabHostController.shellFault('absent');
  });
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('navigation', { name: /Location:/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close Initial fixture' }).click();
  await page.evaluate(() => window.__componentTabHostController.shellFault(null));

  for (const kind of [
    'undefined',
    'null',
    'wrong-tab',
    'partial',
    'malformed',
    'accessor',
    'symbol',
    'inherited',
    'function',
  ]) {
    const before = assertions.length;
    await page.evaluate((value) => window.__componentTabHostController.navigationFault(value), kind);
    await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
    await expect(page.getByRole('navigation', { name: /Location:/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New component tab' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close Initial fixture' }).click();
    await expect.poll(() => assertions.length).toBeGreaterThan(before);
    await page.evaluate(() => window.__componentTabHostController.navigationFault(null));
    await expect(page.getByRole('navigation', { name: 'Location: Fixture > Initial' })).toBeVisible();
  }
  expect(await page.evaluate(() => window.__componentTabHostController.evidence())).toMatchObject({
    closes: [],
    navigationGetterCalls: 0,
    navigationFunctionCalls: 0,
    backs: [],
    forwards: [],
  });
});

test('a sole Empty uses the universal single layout with one add control and location', async ({ page }) => {
  await mount(page, { shell: true });
  await page.getByRole('button', { name: 'New component tab' }).click();
  const tablist = page.getByRole('tablist', { name: 'Fixture component tabs' });
  const initialClose = tablist.getByRole('button', { name: 'Close Initial fixture' });
  await initialClose.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tablist')).toHaveCount(1);
  await expect(page.locator('.rv-empty-tab-panel')).toBeVisible();
  await expect(page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('Container 1');
  await expect(page.getByRole('navigation', { name: 'Location: New Tab' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New component tab' })).toHaveCount(1);
  await expect(page.locator('.rv-view-tab-add')).toHaveCount(1);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
});

test('single close honors descriptor metadata, unavailable bodies, owner results, and outside focus', async ({ page }) => {
  await mount(page, { shell: true });
  await page.evaluate(() => window.__componentTabHostController.resolutionOverride('disabled'));
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'disabled');
  await expect(page.getByRole('tablist')).toHaveCount(1);
  const close = page.getByRole('button', { name: 'Close Initial fixture' });
  await expect(close).toBeEnabled();

  await page.evaluate(() => window.__componentTabHostController.setCloseDescriptor({ closeDisabled: true }));
  await expect(close).toBeDisabled();
  await close.click({ force: true });
  expect((await page.evaluate(() => window.__componentTabHostController.evidence())).closes).toEqual([]);
  await page.evaluate(() => window.__componentTabHostController.setCloseDescriptor({
    closable: false,
    closeDisabled: false,
  }));
  await expect(page.getByRole('button', { name: 'Close Initial fixture' })).toHaveCount(0);

  await page.evaluate(() => {
    window.__componentTabHostController.resolutionOverride(null);
    window.__componentTabHostController.setCloseDescriptor({ closable: true });
    window.__componentTabHostController.setCloseOutcome('replacement');
  });
  await page.getByRole('button', { name: 'Close Initial fixture' }).click();
  const replacementLabel = page.locator('.rv-view-tab-item.is-selected .rv-view-tab-label');
  await expect(replacementLabel).toHaveText('Replacement');
  await expect(page.locator('.rv-content-area')).toBeFocused();
  expect((await page.evaluate(() => window.__componentTabHostController.evidence())).closes).toHaveLength(1);

  await page.evaluate(() => window.__componentTabHostController.setCloseOutcome('replacement', true));
  await page.getByRole('button', { name: 'Close Replacement' }).click();
  await expect(page.locator('#outside')).toBeFocused();
  expect((await page.evaluate(() => window.__componentTabHostController.evidence())).closes).toHaveLength(2);

  await page.evaluate(() => window.__componentTabHostController.setCloseOutcome('remove-adapter'));
  await page.getByRole('button', { name: 'Close Replacement' }).click();
  await expect(page.locator('.rv-content-area')).toBeFocused();
  expect((await page.evaluate(() => window.__componentTabHostController.evidence())).closes).toHaveLength(3);
});

test('every malformed present shell fails closed without accessors, callbacks, legacy fallback, or private text', async ({ page }) => {
  const assertions: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'assert' || message.type() === 'error') assertions.push(message.text());
  });
  await mount(page, { shell: true });
  for (const kind of [
    'undefined',
    'null',
    'version',
    'mismatch',
    'component-null',
    'accessor',
    'malformed',
    'unknown',
    'symbol',
    'inherited',
    'function',
  ]) {
    const before = assertions.length;
    await page.evaluate((value) => window.__componentTabHostController.shellFault(value), kind);
    await expect(page.getByRole('tablist', { name: 'Fixture component tabs' })).toBeVisible();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
    await expect(page.getByRole('button', { name: 'Exact legacy child' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New component tab' })).toHaveCount(0);
    await expect(page.getByText('/Users/private/secret.txt')).toHaveCount(0);
    await expect(page.getByText(/PRIVATE PROVIDER/)).toHaveCount(0);
    await expect.poll(() => assertions.length).toBeGreaterThan(before);
    expect(assertions.slice(before).join('\n')).not.toMatch(/private|provider|users/i);
    await page.evaluate(() => window.__componentTabHostController.shellFault(null));
    await expect(page.getByRole('tablist')).toHaveCount(1);
  }
  expect(await page.evaluate(() => window.__componentTabHostController.evidence())).toMatchObject({
    shellGetterCalls: 0,
    shellFunctionCalls: 0,
    closes: [],
  });

  await page.getByRole('button', { name: 'New component tab' }).click();
  await page.evaluate(() => window.__componentTabHostController.shellFault('empty-presenter'));
  await expect(page.getByRole('tablist')).toBeVisible();
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.locator('.rv-empty-tab-panel')).toHaveCount(0);
});

test('production malformed shell remains product-safe and preserves the valid rail', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mount(page, { shell: true, mode: 'production' });
  await page.evaluate(() => window.__componentTabHostController.shellFault('unknown'));
  await expect(page.getByRole('tablist', { name: 'Fixture component tabs' })).toBeVisible();
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('button', { name: 'New component tab' })).toHaveCount(0);
  await expect(page.getByText('/Users/private/secret.txt')).toHaveCount(0);
  await expect(page.getByText(/PRIVATE PROVIDER/)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('an opted-in shell with no active rail descriptor stays labeled, inert, and unresolved', async ({ page }) => {
  await mount(page, { shell: true });
  const rendersBefore = await page.evaluate(
    () => window.__componentTabHostController.evidence().renders.length,
  );
  await page.evaluate(() => window.__componentTabHostController.dropActiveDescriptor());
  const panel = page.getByRole('tabpanel');
  await expect(panel).toHaveAccessibleName('Content unavailable');
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('button', { name: /Initial presenter/ })).toHaveCount(0);
  expect(await page.evaluate(
    () => window.__componentTabHostController.evidence().renders.length,
  )).toBe(rendersBefore);
});

test('production adapters do not opt into the component content contract', () => {
  const source = fs.readFileSync(
    path.resolve('src/components/view-tabs/viewTabAdapters.ts'),
    'utf8',
  );
  expect(source).toContain('content?: ViewTabContentAdapter');
  expect(source).not.toMatch(/return\s*\{[\s\S]{0,800}\bcontent\s*:/);
  expect(source).not.toMatch(/return\s*\{[\s\S]{0,800}\bshell\s*:/);
  const contentAdapter = fs.readFileSync(
    path.resolve('src/components/view-tabs/viewTabContentAdapter.ts'),
    'utf8',
  );
  expect(contentAdapter).toContain('shell?: ComponentTabShellProjection');
});

declare global {
  interface Window {
    __componentTabHostController: {
      state: () => {
        state: {
          tabs: Array<{ tabId: string; content: Record<string, unknown> }>;
          activeTabId: string;
          reservations: Array<Record<string, unknown>>;
        };
        rail: Array<Record<string, unknown>>;
      };
      evidence: () => {
        actions: string[][];
        operations: Array<Record<string, unknown>>;
        outcomes: string[][];
        renders: Array<Record<string, unknown>>;
        resolverCalls: number;
        presenterMounts: number;
        presenterUnmounts: number;
        componentGetterCalls: number;
        componentFunctionCalls: number;
      };
      ownerCommits: () => Array<{
        tabId: string;
        targetKey: string | null;
        location: string[];
      }>;
      clearOwnerCommits: () => void;
      currentOperation: (tabId: string) => string | null;
      complete: (operationId: string) => unknown;
      fail: (operationId: string) => unknown;
      selectLauncher: (tabId: string, launcherId: string) => void;
      malformedResolution: (kind: string | null) => void;
      malformedComponentSlot: (kind: 'accessor' | 'non-enumerable') => void;
      setPresenterFailure: (kind: 'render' | 'lifecycle' | null) => void;
      enableUnknown: () => void;
      injectUnavailable: (kind: string) => void;
      mismatch: () => void;
      malformed: () => void;
      malformedContent: () => void;
      malformedContentAccessor: () => void;
      malformedNested: (kind: string) => void;
      shell: () => Record<string, unknown> | null;
      shellFault: (kind: string | null) => void;
      navigationFault: (kind: string | null) => void;
      setDisplayProjection: (label: string, segments: string[]) => void;
      resolutionOverride: (kind: string | null) => void;
      addBackgroundTab: () => string | null;
      setCloseDescriptor: (next: Record<string, unknown>) => void;
      setCloseOutcome: (outcome: string, focusOutside?: boolean) => void;
      setAddReturnsNull: (value: boolean) => void;
      dropActiveDescriptor: () => void;
    };
    __atomicTargetLocationSamples?: Array<{ location: string; targetKey: string }>;
    __atomicTargetLocationObserver?: MutationObserver;
  }
}
