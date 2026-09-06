import { type ReactNode, useLayoutEffect, useMemo, useRef } from 'react';
import type { EmptyTabReservation } from './componentTabTypes';
import { isBoundedOpaqueId, validateTabContentRecord } from './componentTabValidation';
import {
  type ComponentResolution,
  type ComponentUnavailableCode,
  type ResolveTabComponent,
  normalizeComponentResolution,
} from './componentTabResolver';
import { EmptyTabPanel, type EmptyTabLauncherItem } from './EmptyTabPanel';
import { PresenterErrorBoundary } from './PresenterErrorBoundary';
import './componentTabPanel.css';

export interface ComponentTabPanelProps {
  active: unknown;
  expectedActiveTabId?: string;
  launchers: readonly EmptyTabLauncherItem[];
  reservation: EmptyTabReservation | null;
  resolve: ResolveTabComponent;
  onSelectLauncher: (tabId: string, launcherId: string) => void;
  onRetryLauncher: (tabId: string) => void;
  onCancelLauncher: (tabId: string) => void;
}

const INVALID_RESOLUTION: ComponentResolution = {
  status: 'unavailable',
  code: 'invalid',
  label: 'Component unavailable',
};

function invalidResolution(
  errorCode: string,
): Extract<ComponentResolution, { status: 'unavailable' }> {
  return {
    status: 'unavailable',
    code: errorCode === 'unsupported_schema_version' ? 'version_unsupported' : 'invalid',
    label: 'Component unavailable',
  };
}

function resolveSafely(
  resolve: ResolveTabComponent,
  descriptor: unknown,
): ComponentResolution {
  try {
    const resolution = normalizeComponentResolution(resolve(descriptor));
    if (resolution) return resolution;
  } catch {
    // The same fail-closed assertion below covers thrown connected resolvers.
  }
  if (import.meta.env.MODE !== 'production') {
    console.assert(false, 'ComponentTabPanel resolver returned an invalid projection.');
  }
  return INVALID_RESOLUTION;
}

function renderSafely(render: () => ReactNode): { ok: true; value: ReactNode } | { ok: false } {
  try {
    return { ok: true, value: render() };
  } catch {
    if (import.meta.env.MODE !== 'production') {
      console.assert(false, 'ComponentTabPanel resolver render function threw.');
    }
    return { ok: false };
  }
}

function safeTabId(record: unknown): string | undefined {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) return undefined;
  try {
    const tabId = Object.getOwnPropertyDescriptor(record, 'tabId');
    return tabId?.enumerable && 'value' in tabId && isBoundedOpaqueId(tabId.value)
      ? tabId.value
      : undefined;
  } catch {
    return undefined;
  }
}

function presenterResetKey(
  tabId: string,
  revision: number,
  componentTypeId: string,
  componentInstanceId: string,
  targetKey: string | undefined,
  resolutionKey: string,
): string {
  return JSON.stringify([
    tabId,
    revision,
    componentTypeId,
    componentInstanceId,
    targetKey ?? null,
    resolutionKey,
  ]);
}

/** Renders one active record projection without adding tab or tabpanel semantics. */
export function ComponentTabPanel({
  active,
  expectedActiveTabId,
  launchers,
  reservation,
  resolve,
  onSelectLauncher,
  onRetryLauncher,
  onCancelLauncher,
}: ComponentTabPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const focusWithinRef = useRef(false);
  const previousKindRef = useRef<'empty' | 'component' | 'unavailable' | null>(null);
  const previousTabIdRef = useRef<string | null>(null);
  const preservedTabId = safeTabId(active);
  const validated = useMemo(() => validateTabContentRecord(active), [active]);
  const activeMatches = validated.ok
    && (expectedActiveTabId === undefined || validated.value.tabId === expectedActiveTabId);
  const projection = useMemo(() => {
    if (!activeMatches || !validated.ok || validated.value.content.kind !== 'component') return null;
    return resolveSafely(resolve, validated.value.content.component);
  }, [activeMatches, resolve, validated]);
  const currentKind = !validated.ok || !activeMatches || projection?.status === 'unavailable'
    ? 'unavailable'
    : validated.value.content.kind;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const document = root.ownerDocument;
    const clearForOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !root.contains(target)) {
        focusWithinRef.current = false;
      }
    };
    const clearForWindowBlur = () => {
      focusWithinRef.current = false;
    };
    document.addEventListener('pointerdown', clearForOutsidePointer, true);
    document.defaultView?.addEventListener('blur', clearForWindowBlur);
    return () => {
      document.removeEventListener('pointerdown', clearForOutsidePointer, true);
      document.defaultView?.removeEventListener('blur', clearForWindowBlur);
    };
  }, []);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const currentTabId = validated.ok ? validated.value.tabId : (expectedActiveTabId ?? null);
    const activeElement = root?.ownerDocument.activeElement;
    const focusStillBelongsToPanel = Boolean(
      root
      && activeElement
      && (activeElement === root.ownerDocument.body || root.contains(activeElement)),
    );
    if (previousKindRef.current === 'empty'
      && previousTabIdRef.current === currentTabId
      && currentKind !== 'empty'
      && focusWithinRef.current
      && focusStillBelongsToPanel) {
      root?.focus();
    }
    previousKindRef.current = currentKind;
    previousTabIdRef.current = currentTabId;
  }, [currentKind, expectedActiveTabId, validated]);

  let content;
  if (!validated.ok || !activeMatches) {
    const invalid = invalidResolution(validated.ok ? 'invalid_shape' : validated.error.code);
    content = <UnavailableComponent code={invalid.code} label={invalid.label} />;
  } else if (validated.value.content.kind === 'empty') {
    content = (
      <EmptyTabPanel
        tabId={validated.value.tabId}
        items={launchers}
        reservation={reservation?.tabId === validated.value.tabId ? reservation : null}
        onSelect={onSelectLauncher}
        onRetry={onRetryLauncher}
        onCancel={onCancelLauncher}
      />
    );
  } else if (projection?.status === 'ready') {
    const rendered = renderSafely(projection.render);
    if (rendered.ok) {
      const descriptor = validated.value.content.component;
      const resetKey = presenterResetKey(
        validated.value.tabId,
        validated.value.content.revision,
        descriptor.componentTypeId,
        descriptor.componentInstanceId,
        descriptor.targetKey,
        projection.key,
      );
      content = (
        <PresenterErrorBoundary
          resetKey={resetKey}
          fallback={<UnavailableComponent code="invalid" label="Component unavailable" />}
        >
          <div className="rv-component-tab-resolved" key={projection.key}>{rendered.value}</div>
        </PresenterErrorBoundary>
      );
    } else {
      content = <UnavailableComponent code="invalid" label="Component unavailable" />;
    }
  } else {
    content = (
      <UnavailableComponent
        code={projection?.code ?? 'invalid'}
        label={projection?.label ?? 'Component unavailable'}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className="rv-component-tab-panel"
      tabIndex={-1}
      data-tab-id={expectedActiveTabId ?? (validated.ok ? validated.value.tabId : preservedTabId)}
      data-content-state={currentKind}
      onFocusCapture={() => {
        focusWithinRef.current = true;
      }}
      onBlurCapture={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          focusWithinRef.current = false;
        } else if (!event.relatedTarget) {
          const target = event.target;
          const displacedByPanelUpdate = !target.isConnected
            || (target instanceof HTMLButtonElement && target.disabled);
          if (!displacedByPanelUpdate) focusWithinRef.current = false;
        }
      }}
    >
      {content}
    </div>
  );
}

function UnavailableComponent({
  code,
  label,
}: {
  code: ComponentUnavailableCode;
  label: string;
}) {
  return (
    <section className="rv-component-tab-unavailable" data-unavailable-code={code}>
      <span className="material-symbols-outlined rv-component-tab-unavailable-icon" aria-hidden="true">
        extension_off
      </span>
      <h2 className="rv-component-tab-unavailable-heading">{label}</h2>
      <p className="rv-component-tab-unavailable-copy">
        This content is not available right now.
      </p>
    </section>
  );
}
