import type { ReactNode } from 'react';
import { COMPONENT_TAB_LIMITS, type ComponentDescriptor } from './componentTabTypes';
import { isBoundedOpaqueId, validateComponentDescriptor } from './componentTabValidation';

export type ComponentUnavailableCode =
  | 'unknown'
  | 'invalid'
  | 'disabled'
  | 'version_unsupported';

export type ComponentResolution =
  | {
      status: 'ready';
      key: string;
      render: () => ReactNode;
    }
  | {
      status: 'unavailable';
      code: ComponentUnavailableCode;
      label: string;
    };

export type ResolveTabComponent = (descriptor: unknown) => ComponentResolution;

export type ComponentTabInjectedAction = (...args: never[]) => unknown;
export type ComponentTabInjectedActions = Readonly<
  Record<string, ComponentTabInjectedAction>
>;

export interface FirstPartyComponentRenderContext {
  descriptor: ComponentDescriptor;
  input: ComponentDescriptor['input'];
  actions: ComponentTabInjectedActions;
}

export interface FirstPartyComponentRegistration {
  componentTypeId: string;
  label: string;
  disabled?: boolean;
  render: (context: FirstPartyComponentRenderContext) => ReactNode;
}

const GENERIC_UNAVAILABLE_LABEL = 'Component unavailable';
const RESOLUTION_KEY_MAX_BYTES = (COMPONENT_TAB_LIMITS.maxIdBytes * 2) + 1;
const UNAVAILABLE_CODES = new Set<ComponentUnavailableCode>([
  'unknown',
  'invalid',
  'disabled',
  'version_unsupported',
]);

function exactProjectionProperties(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if ((prototype !== Object.prototype && prototype !== null)
      || Object.getOwnPropertySymbols(value).length > 0) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors);
    if (keys.length !== allowed.length || keys.some((key) => !allowed.includes(key))) return null;
    const projection: Record<string, unknown> = {};
    for (const key of allowed) {
      const descriptor = descriptors[key];
      if (!descriptor?.enumerable || !('value' in descriptor)) return null;
      projection[key] = descriptor.value;
    }
    return projection;
  } catch {
    return null;
  }
}

function boundedProjectionText(value: unknown, maxBytes: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.trim() === value
    && new TextEncoder().encode(value).byteLength <= maxBytes
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    });
}

/** Validates the transient resolver projection before any registered render function executes. */
export function normalizeComponentResolution(value: unknown): ComponentResolution | null {
  const status = (() => {
    try {
      const descriptor = typeof value === 'object' && value !== null
        ? Object.getOwnPropertyDescriptor(value, 'status')
        : undefined;
      return descriptor?.enumerable && 'value' in descriptor ? descriptor.value : null;
    } catch {
      return null;
    }
  })();
  if (status === 'ready') {
    const ready = exactProjectionProperties(value, ['status', 'key', 'render']);
    if (!ready
      || ready.status !== 'ready'
      || !boundedProjectionText(ready.key, RESOLUTION_KEY_MAX_BYTES)
      || typeof ready.render !== 'function') {
      return null;
    }
    return { status: 'ready', key: ready.key, render: ready.render as () => ReactNode };
  }
  if (status === 'unavailable') {
    const missing = exactProjectionProperties(value, ['status', 'code', 'label']);
    if (!missing
      || missing.status !== 'unavailable'
      || typeof missing.code !== 'string'
      || !UNAVAILABLE_CODES.has(missing.code as ComponentUnavailableCode)
      || !boundedProjectionText(missing.label, COMPONENT_TAB_LIMITS.maxErrorMessageBytes)) {
      return null;
    }
    return {
      status: 'unavailable',
      code: missing.code as ComponentUnavailableCode,
      label: missing.label,
    };
  }
  return null;
}

function unavailable(
  code: ComponentUnavailableCode,
  label = GENERIC_UNAVAILABLE_LABEL,
): ComponentResolution {
  return { status: 'unavailable', code, label };
}

function hasUnsupportedSchemaVersion(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'schemaVersion');
    return Boolean(descriptor?.enumerable && 'value' in descriptor && descriptor.value !== 1);
  } catch {
    return false;
  }
}

/** Creates a closed, code-owned resolver. It never scans or imports at resolution time. */
export function createFirstPartyComponentResolver(
  registrations: readonly FirstPartyComponentRegistration[],
  actions: ComponentTabInjectedActions = Object.freeze({}),
): ResolveTabComponent {
  const registry = new Map<string, FirstPartyComponentRegistration>();
  for (const registration of registrations) {
    if (!isBoundedOpaqueId(registration.componentTypeId)) {
      throw new Error('First-party component registrations require a valid component type ID.');
    }
    if (registry.has(registration.componentTypeId)) {
      throw new Error('First-party component type IDs must be unique.');
    }
    registry.set(registration.componentTypeId, registration);
  }

  return (candidate: unknown): ComponentResolution => {
    const validated = validateComponentDescriptor(candidate);
    if (!validated.ok) {
      return unavailable(
        hasUnsupportedSchemaVersion(candidate) ? 'version_unsupported' : 'invalid',
      );
    }

    const registration = registry.get(validated.value.componentTypeId);
    if (!registration) return unavailable('unknown');
    if (registration.disabled) return unavailable('disabled', registration.label);

    return {
      status: 'ready',
      key: `${validated.value.componentTypeId}:${validated.value.componentInstanceId}`,
      render: () => registration.render({
        descriptor: validated.value,
        input: validated.value.input,
        actions,
      }),
    };
  };
}
