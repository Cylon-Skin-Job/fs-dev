import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { getFileIcon } from '../../lib/file-utils';
import { usePanelStore } from '../../state/panelStore';
import { useFileStore } from '../../state/fileStore';
import type { DocViewerTab } from '../../types';
import type { ViewTabContentAdapter } from './viewTabContentAdapter';
import { normalizeCaptureTabs } from './captureTabDomain';
import {
  activateCaptureTab,
  CAPTURE_PANEL,
  CAPTURE_TAB_LABEL,
  closeCaptureTab,
  getCaptureHandoffStatus,
  normalizeHydratedCaptureTabs,
  plusPressed,
  subscribeCaptureHandoff,
} from './captureTabsController';
import type { ViewTabAddAction, ViewTabDescriptor } from './ViewTabStrip';

export type { ViewTabContentAdapter } from './viewTabContentAdapter';

export interface ViewTabAdapterModel {
  panelId: string;
  label: string;
  tabs: ViewTabDescriptor[];
  activeId: string;
  tabPanelTabIndex: 0 | -1;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  add?: ViewTabAddAction;
  content?: ViewTabContentAdapter;
}

function useCaptureAdapter(enabled: boolean): ViewTabAdapterModel | null {
  const rawTabs = usePanelStore((state) => state.viewStates[CAPTURE_PANEL]?.docViewerTabs);
  const rawActiveId = usePanelStore((state) => state.viewStates[CAPTURE_PANEL]?.docViewerActiveTabId);
  const captureIcon = usePanelStore((state) => (
    state.panelConfigs.find((config) => config.id === CAPTURE_PANEL)?.icon ?? 'note_stack'
  ));
  const hasHydratedTabs = rawTabs !== undefined;
  const hydrationFingerprint = JSON.stringify([rawTabs, rawActiveId]);
  const handoffStatus = useSyncExternalStore(
    subscribeCaptureHandoff,
    getCaptureHandoffStatus,
    getCaptureHandoffStatus,
  );

  useEffect(() => {
    if (enabled && hasHydratedTabs) normalizeHydratedCaptureTabs();
  }, [enabled, hasHydratedTabs, hydrationFingerprint]);

  return useMemo(() => {
    if (!enabled) return null;
    const normalized = normalizeCaptureTabs(rawTabs, rawActiveId);
    const recoveryVisible = normalized.tabs.length === 1
      && normalized.tabs[0]?.kind === 'capture'
      && handoffStatus === 'failed';
    if ((normalized.tabs.length < 2 && !recoveryVisible) || !normalized.activeId) return null;
    const descriptors = normalized.tabs.map((tab: DocViewerTab): ViewTabDescriptor => {
      const isCapture = tab.kind === 'capture';
      return {
        id: tab.id,
        label: isCapture ? CAPTURE_TAB_LABEL : tab.name,
        icon: isCapture ? captureIcon : getFileIcon(tab.extension, tab.name),
        iconClassName: isCapture ? 'rv-view-tab-icon--view' : `file-icon-${tab.extension}`,
        closeLabel: isCapture ? 'Close capture view' : `Close ${tab.name}`,
        closable: true,
      };
    });
    return {
      panelId: CAPTURE_PANEL,
      label: 'Open captures',
      tabs: descriptors,
      activeId: normalized.activeId,
      tabPanelTabIndex: -1,
      onActivate: (id) => { activateCaptureTab(id); },
      onClose: closeCaptureTab,
      add: recoveryVisible ? undefined : { label: 'New capture view', onAdd: plusPressed },
    };
  }, [captureIcon, enabled, handoffStatus, rawActiveId, rawTabs]);
}

function useFileAdapter(enabled: boolean): ViewTabAdapterModel | null {
  const tabs = useFileStore((state) => state.tabs);
  const activeId = useFileStore((state) => state.activeTabPath);
  const shortLabel = usePanelStore((state) => (
    state.panelConfigs.find((config) => config.id === 'file-viewer')?.name?.toUpperCase() ?? 'FILES'
  ));
  const viewIcon = usePanelStore((state) => (
    state.panelConfigs.find((config) => config.id === 'file-viewer')?.icon ?? 'folder'
  ));

  return useMemo(() => {
    if (!enabled || tabs.length === 0 || !activeId) return null;
    const activeTab = tabs.find((tab) => (tab.kind === 'home' ? tab.id : tab.file.path) === activeId);
    return {
      panelId: 'file-viewer',
      label: 'Open files',
      tabs: tabs.map((tab): ViewTabDescriptor => tab.kind === 'home' ? {
        id: tab.id,
        label: shortLabel,
        icon: viewIcon,
        iconClassName: 'rv-view-tab-icon--view',
        closeLabel: 'Close Files view',
        closable: true,
      } : {
        id: tab.file.path,
        label: tab.file.name,
        icon: getFileIcon(tab.file.extension, tab.file.name),
        iconClassName: `file-icon-${tab.file.extension ?? ''}`,
        closeLabel: `Close ${tab.file.name}`,
        closable: true,
        closeDisabled: tab.loading,
      }),
      activeId,
      tabPanelTabIndex: activeTab?.kind === 'home' ? 0 : -1,
      onActivate: (id) => useFileStore.getState().setActiveTab(id),
      onClose: (id) => useFileStore.getState().closeTab(id),
      add: {
        label: 'New file tab',
        onAdd: () => {
          const id = useFileStore.getState().openViewHomeTab();
          if (id) {
            const panelState = usePanelStore.getState();
            if (panelState.viewStates['file-viewer']?.collapsed?.rightCol) {
              panelState.toggleCollapsed('file-viewer', 'rightCol');
            }
          }
          return id;
        },
      },
    };
  }, [activeId, enabled, shortLabel, tabs, viewIcon]);
}

/** Store-owning registry boundary. The shell host itself never imports view stores. */
export function useViewTabAdapter(panelId: string): ViewTabAdapterModel | null {
  const capture = useCaptureAdapter(panelId === CAPTURE_PANEL);
  const files = useFileAdapter(panelId === 'file-viewer');
  if (panelId === CAPTURE_PANEL) return capture;
  if (panelId === 'file-viewer') return files;
  return null;
}
