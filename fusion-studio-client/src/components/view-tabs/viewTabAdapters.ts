import { getFileIcon } from '../../lib/file-utils';
import { useFileStore } from '../../state/fileStore';
import { usePanelStore } from '../../state/panelStore';
import { isFileEditorTab, type EditorTab } from '../../types/file-explorer';
import type { AppState } from '../../state/panelStoreTypes';
import type { DocViewerTab } from '../../types';
import {
  activateTab as activateCaptureTab,
  CAPTURE_TAB_LABEL,
  CAPTURE_VIEWER_PANEL,
  closeTab as closeCaptureTab,
  normalizedCaptureTabsFromState,
  plusPressed as capturePlusPressed,
} from './captureTabsController';
import type { ViewTabAdapter } from './viewTabTypes';

type FileStoreSnapshot = ReturnType<typeof useFileStore.getState>;

function fileState(snapshot: unknown): FileStoreSnapshot {
  return snapshot as FileStoreSnapshot;
}

function editorTab(tab: unknown): EditorTab {
  return tab as EditorTab;
}

const fileViewerAdapter: ViewTabAdapter = {
  subscribe: useFileStore.subscribe,
  getSnapshot: useFileStore.getState,
  getTabs: (snapshot) => fileState(snapshot).tabs,
  getActiveId: (snapshot) => fileState(snapshot).activeTabId,
  getId: (tab) => editorTab(tab).id,
  getLabel: (tab) => {
    const item = editorTab(tab);
    return isFileEditorTab(item) ? item.file.name : 'Select File';
  },
  getIcon: (tab) => {
    const item = editorTab(tab);
    return isFileEditorTab(item)
      ? getFileIcon(item.file.extension, item.file.name)
      : 'description';
  },
  getIconClassName: (tab) => {
    const item = editorTab(tab);
    return isFileEditorTab(item) && item.file.extension
      ? `file-icon-${item.file.extension}`
      : undefined;
  },
  isCloseDisabled: (tab) => {
    const item = editorTab(tab);
    return isFileEditorTab(item) && item.loading;
  },
  onSelect: (id) => useFileStore.getState().setActiveTab(id),
  onClose: (id) => useFileStore.getState().closeTab(id),
  visibility: { mode: 'always' },
  plus: {
    label: 'New file tab',
    availability: 'always',
    onPlus: () => {
      useFileStore.getState().openEmptyTab();
      const panelState = usePanelStore.getState();
      if (panelState.viewStates['file-viewer']?.collapsed?.rightCol ?? false) {
        panelState.toggleCollapsed('file-viewer', 'rightCol');
      }
    },
  },
};

function panelState(snapshot: unknown): AppState {
  return snapshot as AppState;
}

function captureTab(tab: unknown): DocViewerTab {
  return tab as DocViewerTab;
}

const captureViewerAdapter: ViewTabAdapter = {
  subscribe: usePanelStore.subscribe,
  getSnapshot: usePanelStore.getState,
  getTabs: (snapshot) => normalizedCaptureTabsFromState(
    panelState(snapshot).viewStates[CAPTURE_VIEWER_PANEL],
  ),
  getActiveId: (snapshot) => (
    panelState(snapshot).viewStates[CAPTURE_VIEWER_PANEL]?.docViewerActiveTabId ?? null
  ),
  getId: (tab) => captureTab(tab).id,
  getLabel: (tab) => {
    const item = captureTab(tab);
    return item.kind === 'capture' ? CAPTURE_TAB_LABEL : item.name;
  },
  getIcon: (tab) => {
    const item = captureTab(tab);
    if (item.kind === 'doc') return getFileIcon(item.extension, item.name);
    return usePanelStore.getState().panelConfigs.find(
      (config) => config.id === CAPTURE_VIEWER_PANEL,
    )?.icon ?? 'note_stack';
  },
  getIconClassName: (tab) => {
    const item = captureTab(tab);
    return item.kind === 'doc' && item.extension
      ? `file-icon-${item.extension}`
      : undefined;
  },
  onSelect: activateCaptureTab,
  onClose: closeCaptureTab,
  visibility: {
    mode: 'state',
    isVisible: (snapshot) => normalizedCaptureTabsFromState(
      panelState(snapshot).viewStates[CAPTURE_VIEWER_PANEL],
    ).length > 0,
  },
  plus: {
    label: 'New capture view',
    availability: 'expanded',
    isAvailable: (snapshot) => {
      const state = panelState(snapshot).viewStates[CAPTURE_VIEWER_PANEL];
      return Boolean(state?.docViewerFullPage)
        || normalizedCaptureTabsFromState(state).length > 0;
    },
    onPlus: capturePlusPressed,
  },
};

const viewTabAdapters: Readonly<Record<string, ViewTabAdapter>> = {
  'file-viewer': fileViewerAdapter,
  [CAPTURE_VIEWER_PANEL]: captureViewerAdapter,
};

export function getViewTabAdapter(panel: string): ViewTabAdapter | null {
  return viewTabAdapters[panel] ?? null;
}
