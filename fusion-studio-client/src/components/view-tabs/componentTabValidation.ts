import {
  COMPONENT_TAB_LIMITS,
  type ComponentDescriptor,
  type ComponentTabValidationErrorCode,
  type ComponentTabValidationResult,
  type JsonValue,
  type TabContentDescriptor,
  type TabContentRecord,
} from './componentTabTypes';

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

interface JsonInspection {
  nodes: number;
  ancestors: WeakSet<object>;
}

function failure<T>(
  code: ComponentTabValidationErrorCode,
  message: string,
): ComponentTabValidationResult<T> {
  return { ok: false, error: { code, message } };
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownDataEntries(
  value: Record<string, unknown>,
): ComponentTabValidationResult<Array<[string, unknown]>> {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return failure('invalid_json_value', 'The descriptor contains a non-JSON property.');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries: Array<[string, unknown]> = [];
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable || !('value' in descriptor)) {
      return failure('invalid_json_value', 'The descriptor contains a non-JSON property.');
    }
    entries.push([key, descriptor.value]);
  }
  return { ok: true, value: entries };
}

function requireFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
): ComponentTabValidationResult<Record<string, unknown>> {
  const entries = ownDataEntries(value);
  if (!entries.ok) return entries;
  const allowedSet = new Set(allowed);
  if (entries.value.some(([key]) => !allowedSet.has(key))) {
    return failure('unknown_field', 'The descriptor contains an unsupported field.');
  }
  if (required.some((key) => !Object.hasOwn(value, key))) {
    return failure('invalid_shape', 'The descriptor is missing a required field.');
  }
  return { ok: true, value };
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

export function isBoundedOpaqueId(
  value: unknown,
  maxBytes: number = COMPONENT_TAB_LIMITS.maxIdBytes,
): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.trim() === value
    && !containsControlCharacter(value)
    && utf8Bytes(value) <= maxBytes;
}

function inspectJsonValue(
  value: unknown,
  depth: number,
  inspection: JsonInspection,
): ComponentTabValidationResult<JsonValue> {
  inspection.nodes += 1;
  if (inspection.nodes > COMPONENT_TAB_LIMITS.maxJsonNodes) {
    return failure('excessive_size', 'The component input exceeds the supported size.');
  }
  if (depth > COMPONENT_TAB_LIMITS.maxJsonDepth) {
    return failure('excessive_depth', 'The component input is nested too deeply.');
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return { ok: true, value };
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { ok: true, value }
      : failure('invalid_json_value', 'The component input contains a non-JSON number.');
  }
  if (typeof value !== 'object') {
    return failure('invalid_json_value', 'The component input contains a non-JSON value.');
  }
  if (inspection.ancestors.has(value)) {
    return failure('invalid_json_value', 'The component input must not be cyclic.');
  }
  inspection.ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > COMPONENT_TAB_LIMITS.maxContainerEntries) {
        return failure('excessive_size', 'The component input exceeds the supported size.');
      }
      const ownKeys = Reflect.ownKeys(value);
      const allowedKeys = new Set(['length', ...Array.from({ length: value.length }, (_, index) => String(index))]);
      if (ownKeys.some((key) => typeof key !== 'string' || !allowedKeys.has(key))
        || Object.keys(value).length !== value.length) {
        return failure('invalid_json_value', 'The component input contains a non-JSON array.');
      }
      const inspected: JsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor?.enumerable || !('value' in descriptor)) {
          return failure('invalid_json_value', 'The component input contains a non-JSON array.');
        }
        const item = inspectJsonValue(descriptor.value, depth + 1, inspection);
        if (!item.ok) return item;
        inspected.push(item.value);
      }
      return { ok: true, value: inspected };
    }
    if (!isPlainRecord(value)) {
      return failure('invalid_json_value', 'The component input contains an unsupported object.');
    }
    const entries = ownDataEntries(value);
    if (!entries.ok) return entries;
    if (entries.value.length > COMPONENT_TAB_LIMITS.maxContainerEntries) {
      return failure('excessive_size', 'The component input exceeds the supported size.');
    }
    const inspected: { [key: string]: JsonValue } = Object.create(null) as { [key: string]: JsonValue };
    for (const [key, child] of entries.value) {
      if (UNSAFE_OBJECT_KEYS.has(key)) {
        return failure('unsafe_key', 'The component input contains an unsafe object key.');
      }
      if (utf8Bytes(key) > COMPONENT_TAB_LIMITS.maxObjectKeyBytes) {
        return failure('excessive_size', 'The component input exceeds the supported size.');
      }
      const item = inspectJsonValue(child, depth + 1, inspection);
      if (!item.ok) return item;
      inspected[key] = item.value;
    }
    return { ok: true, value: inspected };
  } finally {
    inspection.ancestors.delete(value);
  }
}

function validateInput(value: unknown): ComponentTabValidationResult<ComponentDescriptor['input']> {
  if (!isPlainRecord(value)) {
    return failure('invalid_shape', 'Component input must be a JSON object.');
  }
  const inspected = inspectJsonValue(value, 0, { nodes: 0, ancestors: new WeakSet() });
  if (!inspected.ok) return inspected;
  if (Array.isArray(inspected.value) || inspected.value === null || typeof inspected.value !== 'object') {
    return failure('invalid_shape', 'Component input must be a JSON object.');
  }
  const serialized = JSON.stringify(inspected.value);
  if (utf8Bytes(serialized) > COMPONENT_TAB_LIMITS.maxInputBytes) {
    return failure('excessive_size', 'The component input exceeds the supported size.');
  }
  return { ok: true, value: JSON.parse(serialized) as ComponentDescriptor['input'] };
}

export function validateComponentDescriptor(
  value: unknown,
): ComponentTabValidationResult<ComponentDescriptor> {
  try {
    if (!isPlainRecord(value)) return failure('invalid_shape', 'The component descriptor is invalid.');
    const shape = requireFields(
      value,
      ['schemaVersion', 'componentTypeId', 'componentInstanceId', 'input', 'targetKey'],
      ['schemaVersion', 'componentTypeId', 'componentInstanceId', 'input'],
    );
    if (!shape.ok) return shape;
    if (value.schemaVersion !== 1) {
      return failure('unsupported_schema_version', 'The component descriptor version is unsupported.');
    }
    if (!isBoundedOpaqueId(value.componentTypeId) || !isBoundedOpaqueId(value.componentInstanceId)) {
      return failure('invalid_id', 'The component descriptor contains an invalid identifier.');
    }
    if (Object.hasOwn(value, 'targetKey')
      && !isBoundedOpaqueId(value.targetKey, COMPONENT_TAB_LIMITS.maxTargetKeyBytes)) {
      return failure('invalid_id', 'The component descriptor contains an invalid target key.');
    }
    const input = validateInput(value.input);
    if (!input.ok) return input;
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        componentTypeId: value.componentTypeId,
        componentInstanceId: value.componentInstanceId,
        input: input.value,
        ...(typeof value.targetKey === 'string' ? { targetKey: value.targetKey } : {}),
      },
    };
  } catch {
    return failure('invalid_shape', 'The component descriptor is invalid.');
  }
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0;
}

export function validateTabContentDescriptor(
  value: unknown,
): ComponentTabValidationResult<TabContentDescriptor> {
  try {
    if (!isPlainRecord(value)) return failure('invalid_shape', 'The tab content descriptor is invalid.');
    if (value.kind === 'empty') {
      const shape = requireFields(value, ['kind', 'revision'], ['kind', 'revision']);
      if (!shape.ok) return shape;
      if (!isRevision(value.revision)) return failure('invalid_revision', 'The tab revision is invalid.');
      return { ok: true, value: { kind: 'empty', revision: value.revision } };
    }
    if (value.kind === 'component') {
      const shape = requireFields(value, ['kind', 'revision', 'component'], ['kind', 'revision', 'component']);
      if (!shape.ok) return shape;
      if (!isRevision(value.revision)) return failure('invalid_revision', 'The tab revision is invalid.');
      const component = validateComponentDescriptor(value.component);
      if (!component.ok) return component;
      return { ok: true, value: { kind: 'component', revision: value.revision, component: component.value } };
    }
    return failure('invalid_shape', 'The tab content kind is invalid.');
  } catch {
    return failure('invalid_shape', 'The tab content descriptor is invalid.');
  }
}

export function validateTabContentRecord(value: unknown): ComponentTabValidationResult<TabContentRecord> {
  try {
    if (!isPlainRecord(value)) return failure('invalid_shape', 'The tab content record is invalid.');
    const shape = requireFields(value, ['tabId', 'content'], ['tabId', 'content']);
    if (!shape.ok) return shape;
    if (!isBoundedOpaqueId(value.tabId)) return failure('invalid_id', 'The tab record contains an invalid identifier.');
    const content = validateTabContentDescriptor(value.content);
    if (!content.ok) return content;
    return { ok: true, value: { tabId: value.tabId, content: content.value } };
  } catch {
    return failure('invalid_shape', 'The tab content record is invalid.');
  }
}
