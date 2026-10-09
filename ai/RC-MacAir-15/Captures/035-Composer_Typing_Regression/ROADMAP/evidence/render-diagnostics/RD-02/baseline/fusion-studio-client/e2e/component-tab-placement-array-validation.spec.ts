import { expect, test } from '@playwright/test';
import {
  planTabPlacement,
  validateResolvedTabPlacementTarget,
  type ResolvedTabPlacementTarget,
  type TabPlacementRequest,
  type TabPlacementSnapshot,
} from '../src/components/view-tabs/componentTabDomain';

function observeArrayLength<T>(
  values: T[],
  onDescriptorRead: () => void,
  onOrdinaryRead: () => void,
): T[] {
  return new Proxy(values, {
    get(target, property, receiver) {
      if (property === 'length') {
        onOrdinaryRead();
      }
      return Reflect.get(target, property, receiver) as unknown;
    },
    getOwnPropertyDescriptor(target, property) {
      if (property === 'length') onDescriptorRead();
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
}

function request(): TabPlacementRequest {
  return {
    schemaVersion: 1,
    requestId: 'request-1',
    disposition: 'current',
    target: { presenterId: 'presenter.files', targetKey: 'file:alpha' },
  };
}

function resolved(): ResolvedTabPlacementTarget {
  return {
    schemaVersion: 1,
    presenterId: 'presenter.files',
    targetKey: 'file:alpha',
    componentTypeId: 'fixture.file',
    input: {},
    tab: { label: 'Alpha', icon: 'file', closeLabel: 'Close Alpha' },
    location: { schemaVersion: 1, segments: [{ label: 'Alpha' }] },
  };
}

function emptySnapshot(): TabPlacementSnapshot {
  return {
    schemaVersion: 1,
    tabs: [{
      tabId: 'tab-empty',
      content: { kind: 'empty', revision: 2 },
      tab: { id: 'tab-empty', label: 'New Tab', icon: 'plus', closeLabel: 'Close New Tab' },
      shell: {
        schemaVersion: 2,
        tabId: 'tab-empty',
        presenterId: null,
        location: { schemaVersion: 1, segments: [{ label: 'New Tab' }] },
      },
    }],
    activeTabId: 'tab-empty',
    reservations: [],
  };
}

test('uses one own array length across tabs, reservations, resolved location, and nested input', () => {
  let descriptorReads = 0;
  let ordinaryReads = 0;
  const observe = <T>(values: T[]) => observeArrayLength(
    values,
    () => { descriptorReads += 1; },
    () => { ordinaryReads += 1; },
  );
  const state = emptySnapshot();
  const unstableTabs = observe([...state.tabs]);
  expect(planTabPlacement(
    request(),
    { ...state, tabs: unstableTabs },
    resolved(),
    { tabId: 'tab-new', componentInstanceId: 'component-new' },
  )).toMatchObject({ ok: true, plan: { outcome: 'filled_current' } });

  const reservation = {
    tabId: 'tab-empty', operationId: 'operation-1', expectedRevision: 2,
    launcherId: 'launcher-1', status: 'pending' as const,
  };
  const unstableReservations = observe([reservation]);
  expect(planTabPlacement(
    request(),
    { ...state, reservations: unstableReservations },
    resolved(),
    { tabId: 'tab-new', componentInstanceId: 'component-new' },
  )).toMatchObject({ ok: true, plan: { outcome: 'appended_new' } });

  const target = validateResolvedTabPlacementTarget({
    ...resolved(),
    input: { values: observe([1]) },
    location: {
      schemaVersion: 1,
      segments: observe([{ label: 'Alpha' }]),
    },
  });
  expect(target).toMatchObject({
    ok: true,
    value: {
      input: { values: [1] },
      location: { segments: [{ label: 'Alpha' }] },
    },
  });
  expect(descriptorReads).toBe(4);
  expect(ordinaryReads).toBe(0);
});
