import type { ComponentTabValidationResult } from './componentTabTypes';
import { isBoundedOpaqueId } from './componentTabValidation';
import {
  COMPONENT_TAB_PRESENTATION_LIMITS,
  type ComponentTabShellProjection,
  type TabBreadcrumbSegment,
  type TabLocationProjection,
} from './componentTabPresentationDomain';

type PresentationValidationResult<T> = ComponentTabValidationResult<T>;

function failure<T>(
  code: 'invalid_shape' | 'unknown_field' | 'unsupported_schema_version' | 'invalid_id' | 'excessive_size',
  message: string,
): PresentationValidationResult<T> {
  return { ok: false, error: { code, message } };
}

function exactDataProperties(
  value: unknown,
  allowed: readonly string[],
  required: readonly string[],
): PresentationValidationResult<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failure('invalid_shape', 'The tab shell projection is invalid.');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return failure('invalid_shape', 'The tab shell projection is invalid.');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some((key) => typeof key !== 'string')) {
    return failure('unknown_field', 'The tab shell projection contains an unsupported field.');
  }
  const keys = ownKeys as string[];
  const allowedSet = new Set(allowed);
  if (keys.some((key) => !allowedSet.has(key))) {
    return failure('unknown_field', 'The tab shell projection contains an unsupported field.');
  }
  if (required.some((key) => !Object.hasOwn(descriptors, key))) {
    return failure('invalid_shape', 'The tab shell projection is missing a required field.');
  }

  const record: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      return failure('invalid_shape', 'The tab shell projection must contain plain data.');
    }
    record[key] = descriptor.value;
  }
  return { ok: true, value: record };
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function containsC0OrC1Control(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
}

function isBoundedDisplayLabel(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes
    && value.trim() === value
    && isWellFormedUnicode(value)
    && !containsC0OrC1Control(value)
    && utf8Bytes(value) <= COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes;
}

function validateBreadcrumbSegment(
  value: unknown,
): PresentationValidationResult<TabBreadcrumbSegment> {
  const segment = exactDataProperties(value, ['label'], ['label']);
  if (!segment.ok) return segment;
  if (!isBoundedDisplayLabel(segment.value.label)) {
    return failure('excessive_size', 'The tab location contains an invalid display label.');
  }
  return { ok: true, value: { label: segment.value.label } };
}

function validateBreadcrumbSegments(
  value: unknown,
): PresentationValidationResult<readonly [TabBreadcrumbSegment, ...TabBreadcrumbSegment[]]> {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return failure('invalid_shape', 'The tab location segments are invalid.');
  }
  const lengthProperty = Object.getOwnPropertyDescriptor(value, 'length');
  if (!lengthProperty
    || !('value' in lengthProperty)
    || !Number.isSafeInteger(lengthProperty.value)
    || lengthProperty.value < 0) {
    return failure('invalid_shape', 'The tab location segments are invalid.');
  }
  const length = lengthProperty.value as number;
  if (length === 0) {
    return failure('invalid_shape', 'The tab location requires at least one segment.');
  }
  if (length > COMPONENT_TAB_PRESENTATION_LIMITS.maxLocationSegments) {
    return failure('excessive_size', 'The tab location contains too many segments.');
  }

  const keys = Reflect.ownKeys(value);
  const allowedKeys = new Set<PropertyKey>([
    'length',
    ...Array.from({ length }, (_, index) => String(index)),
  ]);
  if (keys.some((key) => !allowedKeys.has(key))) {
    return failure('unknown_field', 'The tab location segments contain an unsupported field.');
  }
  if (keys.length !== length + 1) {
    return failure('invalid_shape', 'The tab location segments must be a dense array.');
  }

  const segments: TabBreadcrumbSegment[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      return failure('invalid_shape', 'The tab location segments must contain plain data.');
    }
    const segment = validateBreadcrumbSegment(descriptor.value);
    if (!segment.ok) return segment;
    segments.push(segment.value);
  }

  return {
    ok: true,
    value: segments as [TabBreadcrumbSegment, ...TabBreadcrumbSegment[]],
  };
}

export function validateTabLocationProjection(
  value: unknown,
): PresentationValidationResult<TabLocationProjection> {
  try {
    const location = exactDataProperties(
      value,
      ['schemaVersion', 'segments'],
      ['schemaVersion', 'segments'],
    );
    if (!location.ok) return location;
    if (location.value.schemaVersion !== 1) {
      return failure('unsupported_schema_version', 'The tab location version is unsupported.');
    }
    const segments = validateBreadcrumbSegments(location.value.segments);
    if (!segments.ok) return segments;
    return {
      ok: true,
      value: { schemaVersion: 1, segments: segments.value },
    };
  } catch {
    return failure('invalid_shape', 'The tab location projection is invalid.');
  }
}

export function validateComponentTabShellProjection(
  value: unknown,
): PresentationValidationResult<ComponentTabShellProjection> {
  try {
    const shell = exactDataProperties(
      value,
      ['schemaVersion', 'tabId', 'presenterId', 'location'],
      ['schemaVersion', 'tabId', 'presenterId', 'location'],
    );
    if (!shell.ok) return shell;
    if (shell.value.schemaVersion !== 2) {
      return failure('unsupported_schema_version', 'The tab shell projection version is unsupported.');
    }
    if (!isBoundedOpaqueId(shell.value.tabId)) {
      return failure('invalid_id', 'The tab shell projection contains an invalid tab identifier.');
    }
    if (shell.value.presenterId !== null && !isBoundedOpaqueId(shell.value.presenterId)) {
      return failure('invalid_id', 'The tab shell projection contains an invalid presenter identifier.');
    }
    const location = validateTabLocationProjection(shell.value.location);
    if (!location.ok) return location;
    return {
      ok: true,
      value: {
        schemaVersion: 2,
        tabId: shell.value.tabId,
        presenterId: shell.value.presenterId,
        location: location.value,
      },
    };
  } catch {
    return failure('invalid_shape', 'The tab shell projection is invalid.');
  }
}
