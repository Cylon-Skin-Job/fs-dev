import type { ResolveTabComponent } from './componentTabResolver';
import type { ComponentTabShellProjection } from './componentTabPresentationDomain';
import { validateComponentTabShellProjection } from './componentTabPresentationValidation';
import type { TabLocationNavigation } from './TabLocationRail';
import type { EmptyTabLauncherItem } from './EmptyTabPanel';
import { getProductSafeReservationError } from './componentTabLifecycle';
import {
  COMPONENT_TAB_LIMITS,
  type EmptyTabReservation,
  type TabContentRecord,
} from './componentTabTypes';
import {
  isBoundedOpaqueId,
  validateTabContentRecord,
} from './componentTabValidation';

export interface ViewTabContentAdapter {
  active: TabContentRecord;
  shell?: ComponentTabShellProjection;
  navigation?: ViewTabNavigationAdapter;
  launchers: readonly EmptyTabLauncherItem[];
  reservation: EmptyTabReservation | null;
  resolve: ResolveTabComponent;
  selectLauncher: (tabId: string, launcherId: string) => void;
  retryLauncher: (tabId: string) => void;
  cancelLauncher: (tabId: string) => void;
}

export type ViewTabNavigationAdapter = TabLocationNavigation;

export interface ViewTabContentLifecycle {
  tabId: string;
  kind: 'empty' | 'component';
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? value as Record<string, unknown>
    : null;
}

function exactDataProperties(
  value: unknown,
  allowed: readonly string[],
  required: readonly string[],
): Record<string, unknown> | null {
  const record = plainRecord(value);
  if (!record || Object.getOwnPropertySymbols(record).length > 0) return null;
  const descriptors = Object.getOwnPropertyDescriptors(record);
  const keys = Object.keys(descriptors);
  const allowedSet = new Set(allowed);
  if (keys.some((key) => !allowedSet.has(key))
    || required.some((key) => !Object.hasOwn(descriptors, key))) {
    return null;
  }
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) return null;
    result[key] = descriptor.value;
  }
  return result;
}

/** Reads only the shell-relevant lifecycle envelope, leaving body validation to the panel. */
export function readViewTabContentLifecycle(value: unknown): ViewTabContentLifecycle | null {
  try {
    const active = exactDataProperties(value, ['tabId', 'content'], ['tabId', 'content']);
    if (!active || !isBoundedOpaqueId(active.tabId)) return null;
    const contentRecord = plainRecord(active.content);
    if (!contentRecord || Object.getOwnPropertySymbols(contentRecord).length > 0) return null;
    const descriptors = Object.getOwnPropertyDescriptors(contentRecord);
    const kindDescriptor = descriptors.kind;
    const revisionDescriptor = descriptors.revision;
    if (!kindDescriptor?.enumerable
      || !('value' in kindDescriptor)
      || !revisionDescriptor?.enumerable
      || !('value' in revisionDescriptor)) {
      return null;
    }
    const kind = kindDescriptor.value;
    const expectedKeys = kind === 'empty'
      ? ['kind', 'revision']
      : kind === 'component'
        ? ['kind', 'revision', 'component']
        : null;
    if (!expectedKeys
      || Object.keys(descriptors).length !== expectedKeys.length
      || expectedKeys.some((key) => !Object.hasOwn(descriptors, key))
      || typeof revisionDescriptor.value !== 'number'
      || !Number.isSafeInteger(revisionDescriptor.value)
      || revisionDescriptor.value < 0) {
      return null;
    }
    // The component slot must exist, but its descriptor/value remains opaque here. Full body
    // validation rejects accessors and non-enumerable data without this shell seam reading them.
    return { tabId: active.tabId, kind };
  } catch {
    return null;
  }
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function boundedText(value: unknown, maxBytes: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.trim() === value
    && utf8Bytes(value) <= maxBytes
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    });
}

function normalizeLaunchers(value: unknown): EmptyTabLauncherItem[] | null {
  if (!Array.isArray(value)
    || value.length > COMPONENT_TAB_LIMITS.maxContainerEntries
    || Object.keys(value).length !== value.length) {
    return null;
  }
  const ownKeys = Reflect.ownKeys(value);
  const allowedKeys = new Set([
    'length',
    ...Array.from({ length: value.length }, (_, index) => String(index)),
  ]);
  if (ownKeys.some((key) => typeof key !== 'string' || !allowedKeys.has(key))) return null;
  const launchers: EmptyTabLauncherItem[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) return null;
    const item = exactDataProperties(
      descriptor.value,
      ['id', 'label', 'icon', 'description', 'disabled'],
      ['id', 'label', 'icon'],
    );
    if (!item
      || !isBoundedOpaqueId(item.id)
      || !boundedText(item.label, COMPONENT_TAB_LIMITS.maxTargetKeyBytes)
      || !boundedText(item.icon, COMPONENT_TAB_LIMITS.maxIdBytes)
      || (Object.hasOwn(item, 'description')
        && !boundedText(item.description, COMPONENT_TAB_LIMITS.maxErrorMessageBytes))
      || (Object.hasOwn(item, 'disabled') && typeof item.disabled !== 'boolean')
      || ids.has(item.id)) {
      return null;
    }
    ids.add(item.id);
    launchers.push({
      id: item.id,
      label: item.label,
      icon: item.icon,
      ...(typeof item.description === 'string' ? { description: item.description } : {}),
      ...(typeof item.disabled === 'boolean' ? { disabled: item.disabled } : {}),
    });
  }
  return launchers;
}

function normalizeReservationError(value: unknown): EmptyTabReservation['error'] | null {
  const error = exactDataProperties(value, ['code', 'message'], ['code', 'message']);
  if (!error || typeof error.code !== 'string' || typeof error.message !== 'string') {
    return null;
  }
  const safeError = getProductSafeReservationError(error.code);
  if (!safeError || error.message !== safeError.message) return null;
  return { ...safeError };
}

function normalizeReservation(
  value: unknown,
  active: TabContentRecord,
  launcherIds: ReadonlySet<string>,
): EmptyTabReservation | null | undefined {
  if (value === null) return null;
  const reservation = exactDataProperties(
    value,
    ['tabId', 'operationId', 'expectedRevision', 'launcherId', 'status', 'error'],
    ['tabId', 'operationId', 'expectedRevision', 'launcherId', 'status'],
  );
  if (!reservation
    || active.content.kind !== 'empty'
    || !isBoundedOpaqueId(reservation.tabId)
    || !isBoundedOpaqueId(reservation.operationId)
    || !isBoundedOpaqueId(reservation.launcherId)
    || !Number.isSafeInteger(reservation.expectedRevision)
    || typeof reservation.expectedRevision !== 'number'
    || reservation.expectedRevision < 0
    || (reservation.status !== 'pending' && reservation.status !== 'failed')
    || reservation.tabId !== active.tabId
    || reservation.expectedRevision !== active.content.revision
    || !launcherIds.has(reservation.launcherId)) {
    return undefined;
  }
  const hasError = Object.hasOwn(reservation, 'error');
  const error = hasError ? normalizeReservationError(reservation.error) : null;
  if ((reservation.status === 'pending' && hasError)
    || (reservation.status === 'failed' && !hasError)
    || (hasError && !error)) {
    return undefined;
  }
  return {
    tabId: reservation.tabId,
    operationId: reservation.operationId,
    expectedRevision: reservation.expectedRevision,
    launcherId: reservation.launcherId,
    status: reservation.status,
    ...(error ? { error } : {}),
  };
}

function normalizeNavigation(
  value: unknown,
  expectedTabId: string,
): ViewTabNavigationAdapter | null {
  const navigation = exactDataProperties(
    value,
    ['tabId', 'canGoBack', 'canGoForward', 'goBack', 'goForward'],
    ['tabId', 'canGoBack', 'canGoForward', 'goBack', 'goForward'],
  );
  if (!navigation
    || navigation.tabId !== expectedTabId
    || typeof navigation.canGoBack !== 'boolean'
    || typeof navigation.canGoForward !== 'boolean'
    || typeof navigation.goBack !== 'function'
    || typeof navigation.goForward !== 'function') {
    return null;
  }
  return {
    tabId: navigation.tabId,
    canGoBack: navigation.canGoBack,
    canGoForward: navigation.canGoForward,
    goBack: navigation.goBack as ViewTabNavigationAdapter['goBack'],
    goForward: navigation.goForward as ViewTabNavigationAdapter['goForward'],
  };
}

/** Fail-closed normalization for the transient connected adapter projection. */
export function normalizeViewTabContentAdapter(candidate: unknown): ViewTabContentAdapter | null {
  try {
    const content = exactDataProperties(
      candidate,
      [
        'active',
        'shell',
        'navigation',
        'launchers',
        'reservation',
        'resolve',
        'selectLauncher',
        'retryLauncher',
        'cancelLauncher',
      ],
      [
        'active',
        'launchers',
        'reservation',
        'resolve',
        'selectLauncher',
        'retryLauncher',
        'cancelLauncher',
      ],
    );
    if (!content
      || typeof content.resolve !== 'function'
      || typeof content.selectLauncher !== 'function'
      || typeof content.retryLauncher !== 'function'
      || typeof content.cancelLauncher !== 'function') {
      return null;
    }
    const activeLifecycle = readViewTabContentLifecycle(content.active);
    if (!activeLifecycle) return null;
    const active = validateTabContentRecord(content.active);
    const hasShell = Object.hasOwn(content, 'shell');
    const shell = hasShell ? validateComponentTabShellProjection(content.shell) : null;
    if (shell && !shell.ok) return null;
    if (shell?.ok && (
      shell.value.tabId !== activeLifecycle.tabId
      || (activeLifecycle.kind === 'empty' && shell.value.presenterId !== null)
      || (activeLifecycle.kind === 'component' && shell.value.presenterId === null)
    )) {
      return null;
    }
    const hasNavigation = Object.hasOwn(content, 'navigation');
    const navigation = hasNavigation && activeLifecycle
      ? normalizeNavigation(content.navigation, activeLifecycle.tabId)
      : null;
    if (hasNavigation && (!navigation || !shell?.ok || navigation.tabId !== shell.value.tabId)) {
      return null;
    }
    const launchers = normalizeLaunchers(content.launchers);
    if (!launchers) return null;
    const reservation = content.reservation === null
      ? null
      : active.ok
        ? normalizeReservation(
          content.reservation,
          active.value,
          new Set(launchers.map((launcher) => launcher.id)),
        )
        : undefined;
    if (reservation === undefined) return null;
    return {
      active: (active.ok ? active.value : content.active) as TabContentRecord,
      ...(shell?.ok ? { shell: shell.value } : {}),
      ...(navigation ? { navigation } : {}),
      launchers,
      reservation,
      resolve: content.resolve as ResolveTabComponent,
      selectLauncher: content.selectLauncher as ViewTabContentAdapter['selectLauncher'],
      retryLauncher: content.retryLauncher as ViewTabContentAdapter['retryLauncher'],
      cancelLauncher: content.cancelLauncher as ViewTabContentAdapter['cancelLauncher'],
    };
  } catch {
    return null;
  }
}
