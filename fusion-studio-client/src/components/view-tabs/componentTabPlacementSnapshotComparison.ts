import { COMPONENT_TAB_LIMITS, type ComponentTabValidationResult } from './componentTabTypes';
import {
  inspectTabPlacementSnapshot,
  type TabPlacementRecordInspection,
} from './componentTabPlacementSnapshotValidation';
import type { TabPlacementSnapshot } from './componentTabPlacementTypes';

interface CapturedReference {
  reference: object;
  prototype: object | null;
  extensible: boolean;
  descriptors: readonly CapturedDescriptor[];
}

type CapturedValue =
  | { kind: 'scalar'; value: unknown }
  | { kind: 'reference'; index: number };

type CapturedDescriptor =
  | {
      key: PropertyKey;
      enumerable: boolean;
      configurable: boolean;
      kind: 'data';
      writable: boolean;
      value: CapturedValue;
    }
  | {
      key: PropertyKey;
      enumerable: boolean;
      configurable: boolean;
      kind: 'accessor';
      get: (() => unknown) | undefined;
      set: ((value: unknown) => void) | undefined;
    };

interface ProtectedValueCapture {
  root: CapturedValue;
  references: readonly CapturedReference[];
}

interface CapturedRecord {
  inspection: TabPlacementRecordInspection;
  content: ProtectedValueCapture | null;
  tab: ProtectedValueCapture | null;
  shell: ProtectedValueCapture | null;
}

export interface CapturedTabPlacementSnapshot {
  snapshot: TabPlacementSnapshot;
  records: readonly CapturedRecord[];
}

interface CaptureBudget {
  references: CapturedReference[];
  seen: WeakMap<object, number>;
}

function capturedPropertyDescriptor(
  descriptors: PropertyDescriptorMap,
  key: PropertyKey,
): PropertyDescriptor | null {
  const holder = Object.getOwnPropertyDescriptor(descriptors, key);
  return holder && 'value' in holder ? holder.value as PropertyDescriptor : null;
}

function captureValue(
  value: unknown,
  depth: number,
  budget: CaptureBudget,
): CapturedValue | null {
  if (typeof value === 'function') return null;
  if (typeof value !== 'object' || value === null) {
    return { kind: 'scalar', value };
  }
  if (depth > COMPONENT_TAB_LIMITS.maxJsonDepth) return null;
  const reference = value as object;
  const existing = budget.seen.get(reference);
  if (existing !== undefined) return { kind: 'reference', index: existing };
  if (budget.references.length >= COMPONENT_TAB_LIMITS.maxJsonNodes) return null;
  try {
    const isArray = Array.isArray(reference);
    const prototype = Object.getPrototypeOf(reference);
    if ((isArray && prototype !== Array.prototype)
      || (!isArray && prototype !== Object.prototype && prototype !== null)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(reference);
    const keys = Reflect.ownKeys(descriptors);
    const keyLimit = COMPONENT_TAB_LIMITS.maxContainerEntries
      + (Array.isArray(reference) ? 1 : 0);
    if (keys.length > keyLimit) return null;
    const index = budget.references.length;
    const captured: CapturedReference = {
      reference,
      prototype,
      extensible: Object.isExtensible(reference),
      descriptors: [],
    };
    budget.seen.set(reference, index);
    budget.references.push(captured);
    const capturedDescriptors: CapturedDescriptor[] = [];
    for (const key of keys) {
      const descriptor = capturedPropertyDescriptor(descriptors, key);
      if (!descriptor) return null;
      if ('value' in descriptor) {
        const capturedValue = captureValue(descriptor.value, depth + 1, budget);
        if (!capturedValue) return null;
        capturedDescriptors.push({
          key,
          enumerable: descriptor.enumerable ?? false,
          configurable: descriptor.configurable ?? false,
          kind: 'data',
          writable: descriptor.writable ?? false,
          value: capturedValue,
        });
      } else {
        capturedDescriptors.push({
          key,
          enumerable: descriptor.enumerable ?? false,
          configurable: descriptor.configurable ?? false,
          kind: 'accessor',
          get: descriptor.get,
          set: descriptor.set,
        });
      }
    }
    budget.references[index] = { ...captured, descriptors: capturedDescriptors };
    return { kind: 'reference', index };
  } catch {
    return null;
  }
}

function captureProtectedValue(
  value: unknown,
  budget: CaptureBudget,
): ProtectedValueCapture | null {
  const root = captureValue(value, 0, budget);
  return root ? { root, references: budget.references } : null;
}

function sameCapturedValue(
  expected: CapturedValue,
  actual: unknown,
  references: readonly CapturedReference[],
): boolean {
  return expected.kind === 'scalar'
    ? Object.is(expected.value, actual)
    : references[expected.index]?.reference === actual;
}

function protectedValueIsExact(expected: ProtectedValueCapture, actual: unknown): boolean {
  if (!sameCapturedValue(expected.root, actual, expected.references)) return false;
  try {
    return expected.references.every((captured) => {
      if (Object.getPrototypeOf(captured.reference) !== captured.prototype
        || Object.isExtensible(captured.reference) !== captured.extensible) return false;
      const descriptors = Object.getOwnPropertyDescriptors(captured.reference);
      const keys = Reflect.ownKeys(descriptors);
      if (keys.length !== captured.descriptors.length) return false;
      return captured.descriptors.every((expectedDescriptor, index) => {
        if (!Object.is(keys[index], expectedDescriptor.key)) return false;
        const actualDescriptor = capturedPropertyDescriptor(descriptors, keys[index]!);
        if (!actualDescriptor
          || (actualDescriptor.enumerable ?? false) !== expectedDescriptor.enumerable
          || (actualDescriptor.configurable ?? false) !== expectedDescriptor.configurable
          || ('value' in actualDescriptor) !== (expectedDescriptor.kind === 'data')) return false;
        if (expectedDescriptor.kind === 'data' && 'value' in actualDescriptor) {
          return (actualDescriptor.writable ?? false) === expectedDescriptor.writable
            && sameCapturedValue(
              expectedDescriptor.value,
              actualDescriptor.value,
              expected.references,
            );
        }
        return expectedDescriptor.kind === 'accessor'
          && !('value' in actualDescriptor)
          && actualDescriptor.get === expectedDescriptor.get
          && actualDescriptor.set === expectedDescriptor.set;
      });
    });
  } catch {
    return false;
  }
}

function descriptorSafeEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== 'object' || left === null
    || typeof right !== 'object' || right === null) return false;
  try {
    if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false;
    const leftDescriptors = Object.getOwnPropertyDescriptors(left);
    const rightDescriptors = Object.getOwnPropertyDescriptors(right);
    const leftKeys = Reflect.ownKeys(leftDescriptors);
    const rightKeys = Reflect.ownKeys(rightDescriptors);
    if (leftKeys.length !== rightKeys.length
      || leftKeys.some((key, index) => key !== rightKeys[index])) return false;
    return leftKeys.every((key) => {
      const leftDescriptor = capturedPropertyDescriptor(leftDescriptors, key);
      const rightDescriptor = capturedPropertyDescriptor(rightDescriptors, key);
      if (!leftDescriptor || !rightDescriptor
        || leftDescriptor.enumerable !== rightDescriptor.enumerable
        || leftDescriptor.configurable !== rightDescriptor.configurable
        || ('value' in leftDescriptor) !== ('value' in rightDescriptor)) return false;
      if ('value' in leftDescriptor && 'value' in rightDescriptor) {
        return leftDescriptor.writable === rightDescriptor.writable
          && descriptorSafeEqual(leftDescriptor.value, rightDescriptor.value);
      }
      return leftDescriptor.get === rightDescriptor.get
        && leftDescriptor.set === rightDescriptor.set;
    });
  } catch {
    return false;
  }
}

function sameNestedSlot<T>(
  expected: ComponentTabValidationResult<T>,
  actual: ComponentTabValidationResult<T>,
  protectedCapture: ProtectedValueCapture | null,
  actualRaw: unknown,
): boolean {
  if (!expected.ok) {
    return !actual.ok
      && protectedCapture !== null
      && protectedValueIsExact(protectedCapture, actualRaw);
  }
  return actual.ok && descriptorSafeEqual(expected.value, actual.value);
}

function sameRecord(
  expected: CapturedRecord,
  actual: TabPlacementRecordInspection,
): boolean {
  return expected.inspection.record.tabId === actual.record.tabId
    && sameNestedSlot(expected.inspection.content, actual.content, expected.content, actual.record.content)
    && sameNestedSlot(expected.inspection.tab, actual.tab, expected.tab, actual.record.tab)
    && sameNestedSlot(expected.inspection.shell, actual.shell, expected.shell, actual.record.shell);
}

/** Compares current state with an immutable, descriptor-safe pre-callback capture. */
export function isExactTabPlacementSnapshot(
  expected: CapturedTabPlacementSnapshot,
  actualValue: unknown,
): boolean {
  const actual = inspectTabPlacementSnapshot(actualValue);
  if (!actual.ok
    || expected.snapshot.activeTabId !== actual.value.activeTabId
    || expected.records.length !== actual.inspections.length
    || expected.snapshot.reservations.length !== actual.value.reservations.length) return false;
  return expected.records.every((record, index) => (
    sameRecord(record, actual.inspections[index]!)
  )) && descriptorSafeEqual(expected.snapshot.reservations, actual.value.reservations);
}

/** Captures expected state before an owner callback can mutate shared protected values. */
export function captureTabPlacementSnapshot(
  value: TabPlacementSnapshot,
): CapturedTabPlacementSnapshot | null {
  const inspected = inspectTabPlacementSnapshot(value);
  if (!inspected.ok) return null;
  const budget: CaptureBudget = { references: [], seen: new WeakMap() };
  const records: CapturedRecord[] = [];
  for (const inspection of inspected.inspections) {
    const content = inspection.content.ok
      ? null : captureProtectedValue(inspection.record.content, budget);
    const tab = inspection.tab.ok ? null : captureProtectedValue(inspection.record.tab, budget);
    const shell = inspection.shell.ok ? null : captureProtectedValue(inspection.record.shell, budget);
    if ((!inspection.content.ok && !content)
      || (!inspection.tab.ok && !tab)
      || (!inspection.shell.ok && !shell)) return null;
    records.push({ inspection, content, tab, shell });
  }
  return { snapshot: inspected.value, records };
}
