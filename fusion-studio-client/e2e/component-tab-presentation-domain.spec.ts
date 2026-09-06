import { expect, test } from '@playwright/test';
import {
  COMPONENT_TAB_LIMITS,
  COMPONENT_TAB_PRESENTATION_LIMITS,
  deriveComponentTabShellMode,
  validateComponentTabShellProjection,
  validateTabContentDescriptor,
  validateTabLocationProjection,
  type ComponentDescriptor,
  type ComponentTabShellModeInput,
  type ComponentTabShellProjection,
  type ComponentTabValidationResult,
  type TabContentRecord,
} from '../src/components/view-tabs/componentTabDomain';

const emptyRecord: TabContentRecord = {
  tabId: 'tab-empty',
  content: { kind: 'empty', revision: 0 },
};

const component: ComponentDescriptor = {
  schemaVersion: 1,
  componentTypeId: 'fixture.card',
  componentInstanceId: 'component-card',
  input: { title: 'Fixture', nested: { count: 1 } },
  targetKey: 'target:canonical:one',
};

const componentRecord: TabContentRecord = {
  tabId: 'tab-component',
  content: { kind: 'component', revision: 7, component },
};

function shellCandidate(
  tabId: string,
  presenterId: string | null,
  labels: readonly string[] = ['Workspace', 'Collection', 'Name'],
): ComponentTabShellProjection {
  if (labels.length === 0) throw new Error('The fixture requires a location label.');
  return {
    schemaVersion: 2,
    tabId,
    presenterId,
    location: {
      schemaVersion: 1,
      segments: labels.map((label) => ({ label })) as [{ label: string }, ...Array<{ label: string }>],
    },
  };
}

function validatedShell(
  candidate: unknown,
): ComponentTabValidationResult<ComponentTabShellProjection> {
  return validateComponentTabShellProjection(candidate);
}

function mode(
  active: TabContentRecord,
  tabs: ComponentTabShellModeInput['tabs'],
  shell: ComponentTabShellModeInput['shell'],
  activeId = active.tabId,
) {
  return deriveComponentTabShellMode({ tabs, activeId, active, shell });
}

test('validates and canonically clones exact v2 component and Empty shell projections', () => {
  const segments = [{ label: 'Workspace' }, { label: 'Collection' }, { label: 'Name' }];
  const location = { schemaVersion: 1, segments };
  const shell = {
    schemaVersion: 2,
    tabId: 'tab-component',
    presenterId: 'presenter.fixture',
    location,
  };
  const empty = shellCandidate('tab-empty', null, ['New Tab']);

  const validatedLocation = validateTabLocationProjection(location);
  const validated = validateComponentTabShellProjection(shell);
  const validatedEmpty = validateComponentTabShellProjection(empty);

  expect(validatedLocation).toEqual({ ok: true, value: location });
  expect(validated).toEqual({ ok: true, value: shell });
  expect(validatedEmpty).toEqual({ ok: true, value: empty });
  if (!validatedLocation.ok || !validated.ok || !validatedEmpty.ok) return;
  expect(validatedLocation.value).not.toBe(location);
  expect(validatedLocation.value.segments).not.toBe(segments);
  expect(validatedLocation.value.segments[0]).not.toBe(segments[0]);
  expect(validated.value).not.toBe(shell);
  expect(validated.value.location).not.toBe(location);
  expect(validated.value.location.segments).not.toBe(segments);

  segments[0].label = 'mutated-private-label';
  shell.tabId = 'mutated-tab';
  shell.presenterId = 'mutated-presenter';
  expect(validated.value).toEqual(shellCandidate(
    'tab-component',
    'presenter.fixture',
    ['Workspace', 'Collection', 'Name'],
  ));
  expect(validatedEmpty.value.presenterId).toBeNull();
});

test('rejects unknown, non-enumerable, accessor, symbol, inherited, and custom-prototype data without getter execution', () => {
  let accessorReads = 0;
  const accessorShell = {
    schemaVersion: 2,
    tabId: 'tab-component',
    presenterId: 'presenter.fixture',
    get location() {
      accessorReads += 1;
      return { schemaVersion: 1, segments: [{ label: 'Private' }] };
    },
  };
  const accessorLocation = {
    schemaVersion: 1,
    get segments() {
      accessorReads += 1;
      return [{ label: 'Private' }];
    },
  };
  const accessorSegment = {
    get label() {
      accessorReads += 1;
      return 'Private';
    },
  };
  const accessorArray: unknown[] = [];
  Object.defineProperty(accessorArray, '0', {
    get() {
      accessorReads += 1;
      return { label: 'Private' };
    },
    enumerable: true,
  });
  accessorArray.length = 1;

  const symbolShell = shellCandidate('tab-component', 'presenter.fixture') as Record<PropertyKey, unknown>;
  symbolShell[Symbol('private')] = 'private-value';
  const symbolLocation = { schemaVersion: 1, segments: [{ label: 'Workspace' }] } as Record<PropertyKey, unknown>;
  symbolLocation[Symbol('private')] = 'private-value';
  const symbolSegment = { label: 'Workspace' } as Record<PropertyKey, unknown>;
  symbolSegment[Symbol('private')] = 'private-value';
  const symbolArray = [{ label: 'Workspace' }] as Array<{ label: string }> & Record<PropertyKey, unknown>;
  symbolArray[Symbol('private')] = 'private-value';

  const nonEnumerableShell = shellCandidate('tab-component', 'presenter.fixture');
  Object.defineProperty(nonEnumerableShell, 'private', { value: 'hidden', enumerable: false });
  const nonEnumerableSegment = { label: 'Workspace' };
  Object.defineProperty(nonEnumerableSegment, 'private', { value: 'hidden', enumerable: false });
  const nonEnumerableLabel = {};
  Object.defineProperty(nonEnumerableLabel, 'label', { value: 'Workspace', enumerable: false });
  const nonEnumerableArray = [{ label: 'Workspace' }];
  Object.defineProperty(nonEnumerableArray, 'private', { value: 'hidden', enumerable: false });

  const shellCases: unknown[] = [
    { ...shellCandidate('tab-component', 'presenter.fixture'), future: true },
    symbolShell,
    nonEnumerableShell,
    accessorShell,
    Object.create(shellCandidate('tab-component', 'presenter.fixture')),
  ];
  const locationCases: unknown[] = [
    { schemaVersion: 1, segments: [{ label: 'Workspace' }], future: true },
    symbolLocation,
    accessorLocation,
    Object.create({ schemaVersion: 1, segments: [{ label: 'Workspace' }] }),
    { schemaVersion: 1, segments: [{ label: 'Workspace', future: true }] },
    { schemaVersion: 1, segments: [symbolSegment] },
    { schemaVersion: 1, segments: [nonEnumerableSegment] },
    { schemaVersion: 1, segments: [nonEnumerableLabel] },
    { schemaVersion: 1, segments: [accessorSegment] },
    { schemaVersion: 1, segments: [Object.create({ label: 'Workspace' })] },
    { schemaVersion: 1, segments: symbolArray },
    { schemaVersion: 1, segments: nonEnumerableArray },
    { schemaVersion: 1, segments: accessorArray },
    { schemaVersion: 1, segments: Object.setPrototypeOf([{ label: 'Workspace' }], null) },
  ];

  for (const candidate of shellCases) expect(validateComponentTabShellProjection(candidate).ok).toBe(false);
  for (const candidate of locationCases) expect(validateTabLocationProjection(candidate).ok).toBe(false);
  expect(accessorReads).toBe(0);
});

test('enforces versions, bounded opaque identities, and exact label cardinality and Unicode bounds', () => {
  expect(validateComponentTabShellProjection({
    ...shellCandidate('tab-component', 'presenter.fixture'),
    schemaVersion: 1,
  }).ok).toBe(false);
  expect(validateTabLocationProjection({
    schemaVersion: 2,
    segments: [{ label: 'Workspace' }],
  }).ok).toBe(false);
  expect(validateComponentTabShellProjection({
    schemaVersion: 1,
    tabId: 'tab-component',
    presentation: {
      role: 'content',
      presenterId: 'presenter.fixture',
      location: { schemaVersion: 1, location: 'Workspace', path: 'Collection/Name' },
    },
  }).ok).toBe(false);

  for (const tabId of ['', ' tab-component', 'tab-component\n', `x${'y'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes)}`]) {
    expect(validateComponentTabShellProjection(shellCandidate(tabId, null)).ok).toBe(false);
  }
  for (const presenterId of ['', ' presenter.fixture', 'presenter.fixture\u0000', `x${'y'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes)}`]) {
    expect(validateComponentTabShellProjection(shellCandidate('tab-component', presenterId)).ok).toBe(false);
  }
  expect(validateComponentTabShellProjection(shellCandidate(
    'x'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes),
    'p'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes),
  )).ok).toBe(true);

  const exactAscii = 'a'.repeat(COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes);
  const exactUtf8 = 'é'.repeat(COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes / 2);
  const exactSupplementary = '😀'.repeat(COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes / 4);
  for (const label of [exactAscii, exactUtf8, exactSupplementary]) {
    expect(validateTabLocationProjection({ schemaVersion: 1, segments: [{ label }] }).ok).toBe(true);
  }
  for (const label of [
    '',
    ' leading',
    'trailing ',
    'line\nbreak',
    'delete\u007fcharacter',
    'c1\u0085control',
    '\ud800',
    '\udc00',
    'a'.repeat(COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes + 1),
    'é'.repeat((COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes / 2) + 1),
  ]) {
    expect(validateTabLocationProjection({ schemaVersion: 1, segments: [{ label }] }).ok).toBe(false);
  }

  expect(validateTabLocationProjection({ schemaVersion: 1, segments: [] }).ok).toBe(false);
  for (const unsupported of [null, undefined, true, 7, 'Workspace', () => 'Workspace', new Date(0), new Map()]) {
    expect(validateTabLocationProjection(unsupported).ok).toBe(false);
  }
  for (const unsupportedSegments of [null, {}, 'Workspace', () => [{ label: 'Workspace' }]]) {
    expect(validateTabLocationProjection({ schemaVersion: 1, segments: unsupportedSegments }).ok).toBe(false);
  }
  for (const unsupportedSegment of [null, [], 'Workspace', 1, { label: () => 'Workspace' }]) {
    expect(validateTabLocationProjection({ schemaVersion: 1, segments: [unsupportedSegment] }).ok).toBe(false);
  }
  const sparse = Array.from({ length: 2 }) as Array<{ label: string }>;
  sparse[0] = { label: 'Workspace' };
  expect(validateTabLocationProjection({ schemaVersion: 1, segments: sparse }).ok).toBe(false);
  const exactCount = Array.from(
    { length: COMPONENT_TAB_PRESENTATION_LIMITS.maxLocationSegments },
    (_, index) => ({ label: `Segment ${index}` }),
  );
  expect(validateTabLocationProjection({ schemaVersion: 1, segments: exactCount }).ok).toBe(true);
  expect(validateTabLocationProjection({
    schemaVersion: 1,
    segments: [...exactCount, { label: 'Excessive' }],
  }).ok).toBe(false);
});

test('derives only legacy, single, tabbed, and invalid from cardinality and exact active correlation', () => {
  const emptyShell = validatedShell(shellCandidate('tab-empty', null, ['New Tab']));
  const componentShell = validatedShell(shellCandidate(
    'tab-component',
    'presenter.fixture',
    ['Workspace', 'Collection', 'Name'],
  ));
  const emptyWithPresenter = validatedShell(shellCandidate('tab-empty', 'presenter.fixture', ['New Tab']));
  const componentWithoutPresenter = validatedShell(shellCandidate('tab-component', null, ['Workspace']));

  expect(mode(componentRecord, [{ id: 'tab-component' }], undefined)).toBe('legacy');
  expect(mode(emptyRecord, [{ id: 'tab-empty' }, { id: 'another' }], undefined)).toBe('legacy');
  expect(mode(emptyRecord, [{ id: 'tab-empty' }], emptyShell)).toBe('single');
  expect(mode(emptyRecord, [{ id: 'tab-empty' }, { id: 'another' }], emptyShell)).toBe('tabbed');
  expect(mode(componentRecord, [{ id: 'tab-component' }], componentShell)).toBe('single');
  expect(mode(componentRecord, [{ id: 'tab-component' }, { id: 'another' }], componentShell)).toBe('tabbed');
  expect(mode(emptyRecord, [{ id: 'tab-empty' }], emptyWithPresenter)).toBe('invalid');
  expect(mode(componentRecord, [{ id: 'tab-component' }], componentWithoutPresenter)).toBe('invalid');

  expect(validateTabContentDescriptor({ kind: 'empty', revision: 0 }).ok).toBe(true);
  expect(validateTabContentDescriptor({ kind: 'component', revision: 0, component }).ok).toBe(true);
  expect(validateTabContentDescriptor({ kind: 'home', revision: 0 }).ok).toBe(false);
  expect(validateTabContentDescriptor({ kind: 'content', revision: 0 }).ok).toBe(false);
  expect(validateTabContentDescriptor({ kind: 'centered', revision: 0 }).ok).toBe(false);
});

test('fails closed for malformed present shells and every active identity mismatch', () => {
  const malformed = validatedShell({
    schemaVersion: 2,
    tabId: 'tab-component',
    presenterId: 'presenter.fixture',
    location: { schemaVersion: 1, segments: [] },
  });
  const presentUndefined = validatedShell(undefined);
  const presentNull = validatedShell(null);
  const componentShell = validatedShell(shellCandidate('tab-component', 'presenter.fixture'));

  expect(mode(componentRecord, [{ id: 'tab-component' }], malformed)).toBe('invalid');
  expect(mode(componentRecord, [{ id: 'tab-component' }], presentUndefined)).toBe('invalid');
  expect(mode(componentRecord, [{ id: 'tab-component' }], presentNull)).toBe('invalid');
  expect(mode(componentRecord, [], componentShell)).toBe('invalid');
  expect(mode(componentRecord, [{ id: 'another' }], componentShell)).toBe('invalid');
  expect(mode(componentRecord, [{ id: 'tab-component' }], componentShell, 'another')).toBe('invalid');
  expect(mode(
    { ...componentRecord, tabId: 'different-content-tab' },
    [{ id: 'tab-component' }],
    componentShell,
    'tab-component',
  )).toBe('invalid');
  expect(mode(
    componentRecord,
    [{ id: 'tab-component' }],
    validatedShell(shellCandidate('different-shell-tab', 'presenter.fixture')),
  )).toBe('invalid');
});

test('keeps display projections separate from presenter, target, component, and tab identities', () => {
  const activeIdentity = Object.freeze({ id: 'tab-component' });
  const otherIdentity = Object.freeze({ id: 'tab-empty' });
  const oneTab = Object.freeze([activeIdentity]);
  const twoTabs = Object.freeze([activeIdentity, otherIdentity]);
  const active = structuredClone(componentRecord);
  const shell = validatedShell(shellCandidate(
    'tab-component',
    'presenter.fixture',
    ['Wiki', 'Chat System'],
  ));
  const relabeledShell = validatedShell(shellCandidate(
    'tab-component',
    'presenter.fixture',
    ['Knowledge', 'Conversation Architecture'],
  ));
  if (!shell.ok || !relabeledShell.ok || active.content.kind !== 'component') throw new Error('Invalid fixture');
  const activeComponent = active.content.component;
  const activeInput = activeComponent.input;
  const snapshot = structuredClone({ active, shell: shell.value, order: twoTabs.map((tab) => tab.id) });

  expect(mode(active, oneTab, shell)).toBe('single');
  expect(mode(active, twoTabs, shell)).toBe('tabbed');
  expect(mode(active, oneTab, shell)).toBe('single');
  expect(shell.value.location.segments.map((segment) => segment.label)).toEqual(['Wiki', 'Chat System']);
  expect(mode(active, oneTab, relabeledShell)).toBe('single');
  expect(relabeledShell.value.presenterId).toBe(shell.value.presenterId);
  expect(active.content.component.targetKey).toBe('target:canonical:one');

  expect(active.content.component).toBe(activeComponent);
  expect(active.content.component.input).toBe(activeInput);
  expect(oneTab[0]).toBe(activeIdentity);
  expect(twoTabs[0]).toBe(activeIdentity);
  expect(twoTabs[1]).toBe(otherIdentity);
  expect({ active, shell: shell.value, order: twoTabs.map((tab) => tab.id) }).toEqual(snapshot);

  const sameLabelsDifferentTarget: TabContentRecord = {
    ...structuredClone(active),
    content: {
      ...structuredClone(active.content),
      component: { ...structuredClone(active.content.component), targetKey: 'target:canonical:two' },
    },
  };
  expect(sameLabelsDifferentTarget.content).not.toEqual(active.content);
  expect(shell.value.location.segments.map((segment) => segment.label)).toEqual(['Wiki', 'Chat System']);
});
