import { createElement } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { closeDiagnostics, diagnosticViewKey, focusDiagnostics, useDiagnosticTabs } from '../../lib/diagnostics/tabs';
import { createFirstPartyComponentResolver } from '../view-tabs/componentTabResolver';
import type { ViewTabAdapterModel } from '../view-tabs/viewTabAdapters';
import { viewRootTabId } from '../chat/sideChatBridge';
import { ConnectedDiagnostics } from './ConnectedDiagnostics';
const TYPE = 'fusion.stream-diagnostics';
const resolve = createFirstPartyComponentResolver([{ componentTypeId: TYPE, label: 'Diagnostics',
  render: ({ input }) => createElement(ConnectedDiagnostics, { tabId: String(input.tabId) }) }]);

/** Appended after native/Side Chat composition; no existing placement owner is replaced. */
export function useDiagnosticTabAdapter(viewId: string, base: ViewTabAdapterModel | null): ViewTabAdapterModel | null {
  const workspaceId = usePanelStore(s => s.activeWorkspaceId);
  const label = usePanelStore(s => s.panelConfigs.find(p => p.id === viewId)?.name ?? viewId);
  const icon = usePanelStore(s => s.panelConfigs.find(p => p.id === viewId)?.icon ?? 'tab');
  const state = useDiagnosticTabs();
  const tabs = state.tabs.filter(t => t.target.workspaceId === workspaceId && t.target.viewId === viewId);
  if (!workspaceId || tabs.length === 0) return base;
  const selected = tabs.find(t => t.id === state.active[diagnosticViewKey(workspaceId, viewId)]);
  const rootId = viewRootTabId(viewId);
  const baseTabs = base?.tabs.length ? base.tabs : [{ id: rootId, label, icon, closable: false, closeLabel: `Close ${label}` }];
  return {
    panelId: base?.panelId ?? viewId, label: base?.label ?? label, tabPanelTabIndex: base?.tabPanelTabIndex ?? -1,
    tabs: [...baseTabs, ...tabs.map(t => ({ id: t.id, label: 'Diagnostics', icon: 'terminal', closable: true, closeLabel: 'Close Diagnostics' }))],
    activeId: selected?.id ?? base?.activeId ?? rootId,
    onActivate(id) {
      if (tabs.some(t => t.id === id)) focusDiagnostics(workspaceId, viewId, id);
      else { focusDiagnostics(workspaceId, viewId, null); base?.onActivate(id); }
    },
    onClose(id) { if (tabs.some(t => t.id === id)) closeDiagnostics(id); else base?.onClose(id); },
    ...(base?.add ? { add: base.add } : {}),
    ...(selected ? { content: {
      active: { tabId: selected.id, content: { kind: 'component' as const, revision: 1,
        component: { schemaVersion: 1 as const, componentTypeId: TYPE, componentInstanceId: selected.id, input: { tabId: selected.id } } } },
      shell: { schemaVersion: 2 as const, tabId: selected.id, presenterId: TYPE,
        location: { schemaVersion: 1 as const, segments: [{ label: 'Diagnostics' }] } },
      reservation: null, resolve, retryLauncher: () => {}, cancelLauncher: () => {},
    } } : base?.content ? { content: base.content } : {}),
  };
}
