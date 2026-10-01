/** Sole owner of runtime-only diagnostic placement. Existing view tabs remain with their adapters. */
import { create } from 'zustand';
import { usePanelStore } from '../../state/panelStore';
import { closeDiagnosticStream, openDiagnosticStream } from './stream';
import type { DiagnosticTarget } from './types';
export interface DiagnosticTab { id: string; target: DiagnosticTarget }
interface DiagnosticTabs { tabs: DiagnosticTab[]; active: Record<string, string | null> }
export const useDiagnosticTabs = create<DiagnosticTabs>(() => ({ tabs: [], active: {} }));
export const diagnosticViewKey = (workspaceId: string, viewId: string) => JSON.stringify([workspaceId, viewId]);
export function openDiagnostics(target: DiagnosticTarget) {
  if (!target.workspaceId || !target.threadId || !target.viewId) return;
  const state = useDiagnosticTabs.getState();
  const existing = state.tabs.find(t => t.target.workspaceId === target.workspaceId
    && t.target.viewId === target.viewId && t.target.threadId === target.threadId);
  const tab = existing ?? { id: `diagnostics-${crypto.randomUUID()}`, target };
  openDiagnosticStream(tab.id, target);
  useDiagnosticTabs.setState({ tabs: existing ? state.tabs : [...state.tabs, tab],
    active: { ...state.active, [diagnosticViewKey(target.workspaceId, target.viewId)]: tab.id } });
  const panel = usePanelStore.getState();
  if (panel.viewStates[target.viewId]?.collapsed.contentArea) panel.toggleCollapsed(target.viewId, 'contentArea');
}
export function focusDiagnostics(workspaceId: string, viewId: string, id: string | null) {
  useDiagnosticTabs.setState(s => ({ active: { ...s.active, [diagnosticViewKey(workspaceId, viewId)]: id } }));
}
export function closeDiagnostics(id: string) {
  closeDiagnosticStream(id);
  useDiagnosticTabs.setState(s => ({ tabs: s.tabs.filter(t => t.id !== id),
    active: Object.fromEntries(Object.entries(s.active).map(([key, value]) => [key, value === id ? null : value])) }));
}
// Discard ephemeral placements and subscriptions on workspace replacement.
usePanelStore.subscribe((state, previous) => {
  if (state.activeWorkspaceId === previous.activeWorkspaceId) return;
  for (const tab of useDiagnosticTabs.getState().tabs) closeDiagnosticStream(tab.id);
  useDiagnosticTabs.setState({ tabs: [], active: {} });
});
