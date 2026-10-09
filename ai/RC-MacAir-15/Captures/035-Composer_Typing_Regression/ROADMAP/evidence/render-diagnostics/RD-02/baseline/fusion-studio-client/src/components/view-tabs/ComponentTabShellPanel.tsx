import { useMemo } from 'react';
import {
  ComponentTabPanel,
  type ComponentTabPanelProps,
} from './ComponentTabPanel';
import {
  TabLocationRail,
  type TabLocationNavigation,
} from './TabLocationRail';
import type {
  ComponentTabShellMode,
} from './componentTabPresentationDomain';
import { validateComponentTabShellProjection } from './componentTabPresentationValidation';
import type { ViewTabDescriptor } from './ViewTabStrip';
import './componentTabShell.css';

type PresentedShellMode = Exclude<ComponentTabShellMode, 'legacy'>;

export interface ComponentTabShellPanelProps extends ComponentTabPanelProps {
  mode: PresentedShellMode;
  descriptor: ViewTabDescriptor;
  shell: unknown;
  navigation?: TabLocationNavigation;
}

function readShellLifecycle(
  value: unknown,
): { tabId: string; kind: 'empty' | 'component' } | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const record = Object.getOwnPropertyDescriptors(value);
    if (Object.keys(record).length !== 2
      || Object.getOwnPropertySymbols(value).length > 0
      || !record.tabId?.enumerable
      || !('value' in record.tabId)
      || typeof record.tabId.value !== 'string'
      || !record.content?.enumerable
      || !('value' in record.content)) {
      return null;
    }
    const contentValue = record.content.value;
    if (typeof contentValue !== 'object' || contentValue === null || Array.isArray(contentValue)) {
      return null;
    }
    const contentPrototype = Object.getPrototypeOf(contentValue);
    if (contentPrototype !== Object.prototype && contentPrototype !== null) return null;
    const content = Object.getOwnPropertyDescriptors(contentValue);
    if (!content.kind?.enumerable
      || !('value' in content.kind)
      || !content.revision?.enumerable
      || !('value' in content.revision)) {
      return null;
    }
    const kind = content.kind.value;
    const requiredKeys = kind === 'empty'
      ? ['kind', 'revision']
      : kind === 'component'
        ? ['kind', 'revision', 'component']
        : [];
    if (requiredKeys.length === 0
      || Object.keys(content).length !== requiredKeys.length
      || Object.getOwnPropertySymbols(contentValue).length > 0
      || requiredKeys.some((key) => !Object.hasOwn(content, key))) {
      return null;
    }
    const revision = content.revision.value;
    if (!Number.isSafeInteger(revision) || revision < 0) return null;
    // Presence of the component slot is sufficient for shell composition. The body panel owns
    // full descriptor validation and rejects accessor/non-enumerable slots without reading them.
    return { tabId: record.tabId.value, kind };
  } catch {
    return null;
  }
}

/** Composes universal tab chrome around one stable generic component-panel body. */
export function ComponentTabShellPanel({
  mode,
  descriptor,
  shell,
  navigation,
  active,
  expectedActiveTabId,
  ...componentPanelProps
}: ComponentTabShellPanelProps) {
  const activeLifecycle = useMemo(() => readShellLifecycle(active), [active]);
  const shellResult = useMemo(() => validateComponentTabShellProjection(shell), [shell]);
  const canonicalShell = shellResult.ok ? shellResult.value : null;
  const activeMatches = activeLifecycle !== null
    && activeLifecycle.tabId === descriptor.id
    && (expectedActiveTabId === undefined || activeLifecycle.tabId === expectedActiveTabId);
  const stackValid = (mode === 'single' || mode === 'tabbed')
    && activeMatches
    && canonicalShell !== null
    && canonicalShell.tabId === activeLifecycle.tabId
    && (
      (activeLifecycle.kind === 'empty' && canonicalShell.presenterId === null)
      || (activeLifecycle.kind === 'component' && canonicalShell.presenterId !== null)
    );
  const effectiveMode: PresentedShellMode = stackValid ? mode : 'invalid';

  if (!stackValid && mode !== 'invalid' && import.meta.env.MODE !== 'production') {
    console.assert(false, 'ComponentTabShellPanel received an invalid shell projection.');
  }

  return (
    <div className={`rv-component-tab-shell rv-component-tab-shell--${effectiveMode}`}>
      {stackValid && canonicalShell ? (
        <TabLocationRail
          tabId={canonicalShell.tabId}
          projection={canonicalShell.location}
          navigation={navigation}
        />
      ) : null}
      <div className="rv-component-tab-shell-body">
        <ComponentTabPanel
          {...componentPanelProps}
          active={stackValid ? active : null}
          expectedActiveTabId={expectedActiveTabId ?? descriptor.id}
        />
      </div>
    </div>
  );
}
