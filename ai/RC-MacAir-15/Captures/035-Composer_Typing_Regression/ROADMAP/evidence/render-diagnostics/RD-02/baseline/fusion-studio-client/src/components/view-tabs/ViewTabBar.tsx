import type { ReactNode } from 'react';
import { ComponentTabPanel } from './ComponentTabPanel';
import { ComponentTabShellPanel } from './ComponentTabShellPanel';
import {
  deriveComponentTabShellMode,
  type ComponentTabShellMode,
} from './componentTabPresentationDomain';
import { type ViewTabAdapterModel, useViewTabAdapter } from './viewTabAdapters';
import {
  normalizeViewTabContentAdapter,
  readViewTabContentLifecycle,
  type ViewTabContentAdapter,
} from './viewTabContentAdapter';
import { ViewTabStrip } from './ViewTabStrip';
import {
  viewTabDomId,
  viewTabPanelDomId,
} from './viewTabDomIds';
import './ViewTabBar.css';

interface ViewTabBarProps {
  panel: string;
  children: ReactNode;
}

function optionalContentValue(adapter: ViewTabAdapterModel): {
  present: boolean;
  value: unknown;
} {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(adapter, 'content');
    if (!descriptor) return { present: false, value: undefined };
    if (!descriptor.enumerable || !('value' in descriptor)) {
      return { present: true, value: undefined };
    }
    return { present: true, value: descriptor.value };
  } catch {
    return { present: true, value: undefined };
  }
}

function hasOwnProperty(value: unknown, key: string): boolean {
  try {
    return typeof value === 'object' && value !== null && Object.hasOwn(value, key);
  } catch {
    return false;
  }
}

const unavailableResolution: ViewTabContentAdapter['resolve'] = () => ({
  status: 'unavailable',
  code: 'invalid',
  label: 'Component unavailable',
});
const ignoreTabIntent = () => undefined;

/** Shell-owned host: resolves one connected adapter and supplies the tabpanel relationship. */
export function ViewTabBar({ panel, children }: ViewTabBarProps) {
  const adapter = useViewTabAdapter(panel);
  if (!adapter) return <>{children}</>;
  const suppliedContent = optionalContentValue(adapter);
  const hasContent = suppliedContent.present;
  const shellOptedIn = hasContent && (
    hasOwnProperty(suppliedContent.value, 'shell')
    || hasOwnProperty(suppliedContent.value, 'navigation')
  );
  const content = hasContent ? normalizeViewTabContentAdapter(suppliedContent.value) : null;
  const contentLifecycle = content ? readViewTabContentLifecycle(content.active) : null;
  const contentCorrelated = !hasContent || Boolean(
    content
    && contentLifecycle
    && contentLifecycle.tabId === adapter.activeId,
  );
  if (!contentCorrelated && import.meta.env.MODE !== 'production') {
    console.assert(
      false,
      'ViewTabBar content lifecycle must be valid and match the active rail tab ID.',
    );
  }
  const mode: ComponentTabShellMode = !hasContent
    ? 'legacy'
    : contentCorrelated && content
      ? deriveComponentTabShellMode({
        tabs: adapter.tabs,
        activeId: adapter.activeId,
        active: content.active,
        shell: Object.hasOwn(content, 'shell')
          ? { ok: true, value: content.shell! }
          : undefined,
      })
      : 'invalid';
  if (mode === 'invalid' && contentCorrelated && import.meta.env.MODE !== 'production') {
    console.assert(false, 'ViewTabBar shell projection must match the active connected tab.');
  }
  const activeDescriptor = adapter.tabs.find((tab) => tab.id === adapter.activeId);
  const panelLabelId = viewTabDomId(adapter.panelId, adapter.activeId);
  const connectedActive = shellOptedIn && mode === 'invalid'
    ? null
    : content?.active ?? null;
  const invalidShellOptIn = shellOptedIn && mode === 'invalid';

  const componentPanelProps = {
    reservation: content?.reservation ?? null,
    reservationLabel: content?.reservationLabel,
    renderEmptyBody: content?.renderEmptyBody,
    resolve: content?.resolve ?? unavailableResolution,
    onRetryLauncher: content?.retryLauncher ?? ignoreTabIntent,
    onCancelLauncher: content?.cancelLauncher ?? ignoreTabIntent,
  };

  return (
    <>
      <ViewTabStrip
        key="view-tab-strip"
        panelId={adapter.panelId}
        label={adapter.label}
        tabs={adapter.tabs}
        activeId={adapter.activeId}
        onActivate={invalidShellOptIn ? ignoreTabIntent : adapter.onActivate}
        onClose={invalidShellOptIn ? ignoreTabIntent : adapter.onClose}
        add={invalidShellOptIn ? undefined : adapter.add}
      />
      <div
        key="view-tab-panel"
        id={viewTabPanelDomId(adapter.panelId)}
        className="rv-view-tab-panel"
        role="tabpanel"
        aria-labelledby={activeDescriptor ? panelLabelId : undefined}
        aria-label={activeDescriptor ? undefined : 'Content unavailable'}
        tabIndex={adapter.tabPanelTabIndex}
      >
        {hasContent && shellOptedIn && activeDescriptor ? (
          <ComponentTabShellPanel
            mode={mode === 'legacy' ? 'invalid' : mode}
            descriptor={activeDescriptor}
            shell={content?.shell ?? null}
            navigation={content?.navigation}
            active={connectedActive}
            expectedActiveTabId={adapter.activeId}
            {...componentPanelProps}
          />
        ) : hasContent ? (
          <ComponentTabPanel
            active={connectedActive}
            expectedActiveTabId={adapter.activeId}
            {...componentPanelProps}
          />
        ) : children}
      </div>
    </>
  );
}
