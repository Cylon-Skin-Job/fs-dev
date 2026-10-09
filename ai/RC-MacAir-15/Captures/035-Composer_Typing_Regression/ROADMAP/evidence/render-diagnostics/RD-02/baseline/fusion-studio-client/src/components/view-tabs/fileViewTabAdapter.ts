/**
 * @module fileViewTabAdapter
 * @role File Explorer view tab adapters (VIEW-02 Slice 2).
 *
 * - `useFileAdapter` and the provenance snapshot adapter are the legacy
 *   adapters, moved here byte-for-byte from `viewTabAdapters.ts`; production
 *   keeps this behavior until Slice 4 flips File Explorer over.
 * - The connected binding below binds the closed `file.open` catalog entry to
 *   the picker launcher: a shell-owned reveal effect plus the accepted pending
 *   Empty reservation (VRT-011A). The real file-tree drawer reveal is wired in
 *   Slice 4; the reveal effect is injected so the singleton picker-context
 *   semantics are real and provable now.
 */

import { useMemo } from 'react';
import { getFileIcon } from '../../lib/file-utils';
import { usePanelStore } from '../../state/panelStore';
import { useFileStore } from '../../state/fileStore';
import { useFileDataStore } from '../../state/fileDataStore';
import { isFileEditorTab, type EditorTab } from '../../types/file-explorer';
import type { ConnectedTabLauncherBinding } from './componentTabConnectedOwner';
import type { ViewTabAdapterModel } from './viewTabAdapters';
import type { ViewTabDescriptor } from './ViewTabStrip';

/** Legacy File Explorer rail adapter (behavior preserved byte-for-byte until Slice 4). */
export function useFileAdapter(enabled: boolean): ReturnType<typeof useLegacyFileAdapter> {
  return useLegacyFileAdapter(enabled);
}

function useLegacyFileAdapter(enabled: boolean) {
  const tabs = useFileStore((state) => state.tabs);
  const activeId = useFileStore((state) => state.activeTabPath);
  const pendingContents = useFileDataStore((state) => state.pendingContents);
  const shortLabel = usePanelStore((state) => (
    state.panelConfigs.find((config) => config.id === 'file-viewer')?.name?.toUpperCase() ?? 'FILES'
  ));
  const viewIcon = usePanelStore((state) => (
    state.panelConfigs.find((config) => config.id === 'file-viewer')?.icon ?? 'folder'
  ));

  return useMemo<ViewTabAdapterModel | null>(() => {
    if (!enabled || tabs.length === 0 || !activeId) return null;
    const activeTab = tabs.find((tab) => (
      isFileEditorTab(tab) ? tab.file.path === activeId : tab.id === activeId
    ));
    return {
      panelId: 'file-viewer',
      label: 'Open files',
      tabs: tabs.map((tab): ViewTabDescriptor => {
        if (tab.kind === 'home') {
          return {
            id: tab.id,
            label: shortLabel,
            icon: viewIcon,
            iconClassName: 'rv-view-tab-icon--view',
            closeLabel: 'Close Files view',
            closable: true,
          };
        }
        if (tab.kind === 'empty') {
          return {
            id: tab.id,
            label: 'Select File',
            icon: 'description',
            closeLabel: 'Close file picker',
            closable: true,
          };
        }
        return {
          id: tab.file.path,
          label: tab.file.name,
          icon: getFileIcon(tab.file.extension, tab.file.name),
          iconClassName: `file-icon-${tab.file.extension ?? ''}`,
          closeLabel: `Close ${tab.file.name}`,
          closable: true,
          closeDisabled: pendingContents.has(`file-viewer:${tab.file.path}`),
        };
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
  }, [activeId, enabled, pendingContents, shortLabel, tabs, viewIcon]);
}

/**
 * `file.open` picker binding (VRT-011A): runs the injected shell-owned reveal
 * effect and keeps the reservation pending — the tab stays the destination for
 * the eventual file choice. A thrown reveal is a bounded product-safe failure.
 */
export function createFileOpenPickerBinding(options: {
  reveal: () => void;
}): ConnectedTabLauncherBinding {
  return {
    kind: 'picker',
    icon: 'file_open',
    launcher: () => {
      options.reveal();
      return { kind: 'pending' };
    },
  };
}

/**
 * Compatibility shape for the accepted provenance source-contract harness.
 * Runtime rendering remains on the hook adapter above.
 */
interface SnapshotViewTabAdapter {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => unknown;
  getTabs: (snapshot: unknown) => readonly unknown[];
  getActiveId: (snapshot: unknown) => string | null;
  getId: (tab: unknown) => string;
  getLabel: (tab: unknown) => string;
  getIcon: (tab: unknown) => string;
  getIconClassName?: (tab: unknown) => string | undefined;
  isCloseDisabled?: (tab: unknown) => boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  visibility: { mode: 'always' };
  plus: { label: string; availability: 'always'; onPlus: () => void };
}

type FileSnapshot = ReturnType<typeof useFileStore.getState>;
type FileDataSnapshot = ReturnType<typeof useFileDataStore.getState>;
interface CombinedFileSnapshot { presentation: FileSnapshot; data: FileDataSnapshot }
let priorPresentation = useFileStore.getState();
let priorData = useFileDataStore.getState();
let combinedSnapshot: CombinedFileSnapshot = { presentation: priorPresentation, data: priorData };

function getCombinedFileSnapshot(): CombinedFileSnapshot {
  const presentation = useFileStore.getState();
  const data = useFileDataStore.getState();
  if (presentation !== priorPresentation || data !== priorData) {
    priorPresentation = presentation;
    priorData = data;
    combinedSnapshot = { presentation, data };
  }
  return combinedSnapshot;
}

const fileSnapshotAdapter: SnapshotViewTabAdapter = {
  subscribe: (listener) => {
    const unsubscribePresentation = useFileStore.subscribe(listener);
    const unsubscribeData = useFileDataStore.subscribe(listener);
    return () => { unsubscribePresentation(); unsubscribeData(); };
  },
  getSnapshot: getCombinedFileSnapshot,
  getTabs: (snapshot) => (snapshot as CombinedFileSnapshot).presentation.tabs,
  getActiveId: (snapshot) => (snapshot as CombinedFileSnapshot).presentation.activeTabId,
  getId: (tab) => (tab as EditorTab).id,
  getLabel: (tab) => isFileEditorTab(tab as EditorTab) ? (tab as Extract<EditorTab, { kind: 'file' }>).file.name : 'Select File',
  getIcon: (tab) => {
    const item = tab as EditorTab;
    return isFileEditorTab(item) ? getFileIcon(item.file.extension, item.file.name) : 'description';
  },
  getIconClassName: (tab) => {
    const item = tab as EditorTab;
    return isFileEditorTab(item) && item.file.extension ? `file-icon-${item.file.extension}` : undefined;
  },
  isCloseDisabled: (tab) => {
    const item = tab as EditorTab;
    return isFileEditorTab(item)
      && useFileDataStore.getState().pendingContents.has(`file-viewer:${item.file.path}`);
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
      if (panelState.viewStates['file-viewer']?.collapsed?.rightCol) {
        panelState.toggleCollapsed('file-viewer', 'rightCol');
      }
    },
  },
};

export function getViewTabAdapter(panel: string): SnapshotViewTabAdapter | null {
  return panel === 'file-viewer' ? fileSnapshotAdapter : null;
}
