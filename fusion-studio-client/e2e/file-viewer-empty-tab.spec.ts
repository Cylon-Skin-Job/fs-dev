import { expect, test } from '@playwright/test';
import { resolveViewTabBarModel } from '../src/components/view-tabs/resolveViewTabBarModel';
import { getViewTabAdapter } from '../src/components/view-tabs/viewTabAdapters';
import { useFileStore } from '../src/state/fileStore';
import { usePanelStore } from '../src/state/panelStore';
import { DEFAULT_VIEW_UI_STATE } from '../src/state/slices/viewSlice';
import type { FileInfo, FileEditorTab } from '../src/types/file-explorer';
import type { ViewActivityItem, ViewActivityState } from '../src/types';

const firstFile: FileInfo = {
  name: 'first.md',
  path: 'docs/first.md',
  type: 'file',
  extension: 'md',
};

const secondFile: FileInfo = {
  name: 'second.ts',
  path: 'src/second.ts',
  type: 'file',
  extension: 'ts',
};

function resetStores() {
  useFileStore.getState().reset();
  usePanelStore.setState({ viewStates: {} });
}

function activityItem(path: string, title: string): ViewActivityItem {
  return {
    id: `file-viewer:${path}`,
    panel: 'file-viewer',
    path,
    title,
    kind: 'file',
    openedAt: Date.now(),
  };
}

test.beforeEach(resetStores);

test('file host resolves and routes its always-available plus with zero tabs', () => {
  const adapter = getViewTabAdapter('file-viewer')!;
  const model = resolveViewTabBarModel(adapter, adapter.getSnapshot());

  expect(model).not.toBeNull();
  expect(model?.tabs).toEqual([]);
  expect(model?.plus?.label).toBe('New file tab');
  model?.plus?.onPlus();
  expect(useFileStore.getState().tabs[0]?.kind).toBe('empty');
});

test('empty file tab is create-or-focus, session-only, and filled in place', () => {
  useFileStore.getState().openFileTab(firstFile);
  useFileStore.getState().openEmptyTab();
  const emptyId = useFileStore.getState().activeTabId;

  useFileStore.getState().openEmptyTab();
  expect(useFileStore.getState().tabs).toHaveLength(2);
  expect(useFileStore.getState().tabs.filter((tab) => tab.kind === 'empty')).toHaveLength(1);
  expect(useFileStore.getState().activeTabId).toBe(emptyId);

  const persistedWhileEmpty = usePanelStore.getState().viewStates['file-viewer']?.activity;
  expect(persistedWhileEmpty?.tabs.map((item) => item.path)).toEqual([firstFile.path]);
  expect(persistedWhileEmpty?.activeTabId).toBeNull();
  useFileStore.getState().hydrateTabsFromActivity(persistedWhileEmpty!);
  expect(useFileStore.getState().tabs.find((tab) => tab.id === emptyId)?.kind).toBe('empty');

  expect(useFileStore.getState().openFileTab(secondFile)).toBeUndefined();
  const filled = useFileStore.getState().tabs.find((tab) => tab.id === emptyId);
  expect(filled?.kind).toBe('file');
  expect((filled as FileEditorTab).file.path).toBe(secondFile.path);
  expect(useFileStore.getState().tabs).toHaveLength(2);

  const persistedAfterFill = usePanelStore.getState().viewStates['file-viewer']?.activity;
  expect(persistedAfterFill?.tabs.map((item) => item.path)).toEqual([firstFile.path, secondFile.path]);
  expect(persistedAfterFill?.activeTabId).toBe(`file-viewer:${secondFile.path}`);
});

test('file adapter plus expands the drawer and focuses the single empty tab', () => {
  usePanelStore.setState({
    viewStates: {
      'file-viewer': {
        ...DEFAULT_VIEW_UI_STATE,
        collapsed: { ...DEFAULT_VIEW_UI_STATE.collapsed, rightCol: true },
      },
    },
  });

  const adapter = getViewTabAdapter('file-viewer');
  adapter?.plus?.onPlus();
  adapter?.plus?.onPlus();

  expect(usePanelStore.getState().viewStates['file-viewer']?.collapsed.rightCol).toBe(false);
  expect(useFileStore.getState().tabs).toHaveLength(1);
  expect(useFileStore.getState().tabs[0]?.kind).toBe('empty');
  expect(useFileStore.getState().activeTabId).toBe(useFileStore.getState().tabs[0]?.id);
});

test('hydration defensively drops pathless activity tabs', () => {
  const valid = activityItem(firstFile.path, firstFile.name);
  const pathless = activityItem('', 'ghost');
  const activity: ViewActivityState = {
    recents: [],
    navigation: { stack: [], index: -1 },
    tabs: [pathless, valid],
    activeTabId: pathless.id,
  };

  useFileStore.getState().hydrateTabsFromActivity(activity);

  const tabs = useFileStore.getState().tabs;
  expect(tabs).toHaveLength(1);
  expect(tabs[0]?.kind).toBe('file');
  expect((tabs[0] as FileEditorTab).file.path).toBe(firstFile.path);
  expect(useFileStore.getState().activeTabId).toBe(tabs[0]?.id);
});
