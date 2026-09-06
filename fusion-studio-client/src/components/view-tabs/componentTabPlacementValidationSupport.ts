import {
  COMPONENT_TAB_LIMITS,
  type ComponentTabValidationErrorCode,
  type ComponentTabValidationResult,
} from './componentTabTypes';
import { isBoundedOpaqueId } from './componentTabValidation';
import { COMPONENT_TAB_PRESENTATION_LIMITS } from './componentTabPresentationDomain';
import type { TabPlacementTabDescriptor } from './componentTabPlacementTypes';

export function placementEnvelopeFailure<T>(
  code: ComponentTabValidationErrorCode,
  message: string,
): ComponentTabValidationResult<T> {
  return { ok: false, error: { code, message } };
}

export function isPlainPlacementRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

export function exactPlacementDataRecord(
  value: unknown,
  allowed: readonly string[],
  required: readonly string[],
): ComponentTabValidationResult<Record<string, unknown>> {
  try {
    if (!isPlainPlacementRecord(value)) {
      return placementEnvelopeFailure('invalid_shape', 'The placement envelope is invalid.');
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some((key) => typeof key !== 'string')) {
      return placementEnvelopeFailure(
        'unknown_field',
        'The placement envelope contains an unsupported field.',
      );
    }
    const keys = ownKeys as string[];
    const allowedSet = new Set(allowed);
    if (keys.some((key) => !allowedSet.has(key))) {
      return placementEnvelopeFailure(
        'unknown_field',
        'The placement envelope contains an unsupported field.',
      );
    }
    if (required.some((key) => !Object.hasOwn(descriptors, key))) {
      return placementEnvelopeFailure(
        'invalid_shape',
        'The placement envelope is missing a required field.',
      );
    }
    const record: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        return placementEnvelopeFailure(
          'invalid_shape',
          'The placement envelope must contain plain data.',
        );
      }
      record[key] = descriptor.value;
    }
    return { ok: true, value: record };
  } catch {
    return placementEnvelopeFailure('invalid_shape', 'The placement envelope is invalid.');
  }
}

export function exactPlacementArray(value: unknown): ComponentTabValidationResult<unknown[]> {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return placementEnvelopeFailure('invalid_shape', 'The placement collection is invalid.');
    }
    const lengthProperty = Object.getOwnPropertyDescriptor(value, 'length');
    if (!lengthProperty
      || !('value' in lengthProperty)
      || !Number.isSafeInteger(lengthProperty.value)
      || lengthProperty.value < 0) {
      return placementEnvelopeFailure('invalid_shape', 'The placement collection is invalid.');
    }
    const length = lengthProperty.value as number;
    if (length > COMPONENT_TAB_LIMITS.maxContainerEntries) {
      return placementEnvelopeFailure('excessive_size', 'The placement collection is too large.');
    }
    const keys = Reflect.ownKeys(value);
    const allowed = new Set<PropertyKey>([
      'length',
      ...Array.from({ length }, (_, index) => String(index)),
    ]);
    if (keys.some((key) => !allowed.has(key)) || keys.length !== length + 1) {
      return placementEnvelopeFailure(
        'invalid_shape',
        'The placement collection must be a dense plain array.',
      );
    }
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        return placementEnvelopeFailure(
          'invalid_shape',
          'The placement collection must contain plain data.',
        );
      }
      result.push(descriptor.value);
    }
    return { ok: true, value: result };
  } catch {
    return placementEnvelopeFailure('invalid_shape', 'The placement collection is invalid.');
  }
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

export function isBoundedPlacementText(value: unknown, maxBytes: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.trim() === value
    && isWellFormedUnicode(value)
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
    })
    && utf8Bytes(value) <= maxBytes;
}

export function validateTabPlacementDisplay(
  value: unknown,
  includeId: boolean,
): ComponentTabValidationResult<TabPlacementTabDescriptor & { id?: string }> {
  const optional = ['iconClassName', 'closable', 'closeDisabled'];
  const fields = includeId
    ? ['id', 'label', 'icon', 'closeLabel', ...optional]
    : ['label', 'icon', 'closeLabel', ...optional];
  const required = includeId
    ? ['id', 'label', 'icon', 'closeLabel']
    : ['label', 'icon', 'closeLabel'];
  const tab = exactPlacementDataRecord(value, fields, required);
  if (!tab.ok) return tab;
  if (includeId && !isBoundedOpaqueId(tab.value.id)) {
    return placementEnvelopeFailure('invalid_id', 'The tab descriptor contains an invalid identifier.');
  }
  if (!isBoundedPlacementText(
    tab.value.label,
    COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes,
  ) || !isBoundedPlacementText(
    tab.value.closeLabel,
    COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes,
  ) || !isBoundedPlacementText(tab.value.icon, COMPONENT_TAB_LIMITS.maxIdBytes)) {
    return placementEnvelopeFailure(
      'excessive_size',
      'The tab descriptor contains invalid display text.',
    );
  }
  if (Object.hasOwn(tab.value, 'iconClassName')
    && !isBoundedPlacementText(tab.value.iconClassName, COMPONENT_TAB_LIMITS.maxIdBytes)) {
    return placementEnvelopeFailure(
      'excessive_size',
      'The tab descriptor contains invalid display text.',
    );
  }
  if ((Object.hasOwn(tab.value, 'closable') && typeof tab.value.closable !== 'boolean')
    || (Object.hasOwn(tab.value, 'closeDisabled') && typeof tab.value.closeDisabled !== 'boolean')) {
    return placementEnvelopeFailure('invalid_shape', 'The tab descriptor contains an invalid option.');
  }
  return {
    ok: true,
    value: {
      ...(includeId ? { id: tab.value.id as string } : {}),
      label: tab.value.label as string,
      icon: tab.value.icon as string,
      closeLabel: tab.value.closeLabel as string,
      ...(typeof tab.value.iconClassName === 'string'
        ? { iconClassName: tab.value.iconClassName } : {}),
      ...(typeof tab.value.closable === 'boolean' ? { closable: tab.value.closable } : {}),
      ...(typeof tab.value.closeDisabled === 'boolean'
        ? { closeDisabled: tab.value.closeDisabled } : {}),
    },
  };
}
