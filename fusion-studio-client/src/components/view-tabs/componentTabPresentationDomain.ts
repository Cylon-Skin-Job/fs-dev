import {
  COMPONENT_TAB_LIMITS,
  type ComponentTabValidationResult,
  type TabContentRecord,
} from './componentTabTypes';

export interface TabBreadcrumbSegment {
  label: string;
}

export interface TabLocationProjection {
  schemaVersion: 1;
  segments: readonly [TabBreadcrumbSegment, ...TabBreadcrumbSegment[]];
}

export interface ComponentTabShellProjection {
  schemaVersion: 2;
  tabId: string;
  presenterId: string | null;
  location: TabLocationProjection;
}

export type ComponentTabShellMode = 'legacy' | 'single' | 'tabbed' | 'invalid';

export const COMPONENT_TAB_PRESENTATION_LIMITS = Object.freeze({
  maxDisplayTextBytes: 1024,
  maxLocationSegments: COMPONENT_TAB_LIMITS.maxContainerEntries,
});

export interface ComponentTabShellTabIdentity {
  id: string;
}

export interface ComponentTabShellModeInput {
  tabs: readonly ComponentTabShellTabIdentity[];
  activeId: string;
  active: TabContentRecord;
  /** Undefined means absent; a present shell must supply its validation result. */
  shell: ComponentTabValidationResult<ComponentTabShellProjection> | undefined;
}

/** Derives shell layout without storing or rewriting any tab or component identity. */
export function deriveComponentTabShellMode({
  tabs,
  activeId,
  active,
  shell,
}: ComponentTabShellModeInput): ComponentTabShellMode {
  if (tabs.length === 0
    || !tabs.some((tab) => tab.id === activeId)
    || active.tabId !== activeId) {
    return 'invalid';
  }
  if (shell === undefined) return 'legacy';
  if (!shell.ok || shell.value.tabId !== activeId) return 'invalid';

  if (active.content.kind === 'empty') {
    if (shell.value.presenterId !== null) return 'invalid';
  } else if (active.content.kind === 'component') {
    if (shell.value.presenterId === null) return 'invalid';
  } else {
    return 'invalid';
  }

  return tabs.length === 1 ? 'single' : 'tabbed';
}
