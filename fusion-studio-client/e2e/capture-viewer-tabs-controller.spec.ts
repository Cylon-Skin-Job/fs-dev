import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  activateTab,
  backOutOfDocTabs,
  clearActiveDocumentAfterArchive,
  closeTab,
  docOpenedInTabs,
  normalizeCaptureTabRecords,
  normalizeCaptureTabsAfterHydration,
  normalizeCaptureTabsAfterStateResult,
  persistCaptureViewPatch,
  plusPressed,
  setClassicDocFullPage,
} from '../src/components/view-tabs/captureTabsController';
import { getViewTabAdapter } from '../src/components/view-tabs/viewTabAdapters';
import { resolveViewTabBarModel } from '../src/components/view-tabs/resolveViewTabBarModel';
import { handleFileMessage } from '../src/lib/ws/file-handlers';
import { usePanelStore } from '../src/state/panelStore';
import { DEFAULT_VIEW_UI_STATE } from '../src/state/slices/viewSlice';
import type { DocViewerTab, ViewUIState } from '../src/types';

const PANEL = 'capture-viewer';

interface SentStateMessage {
  type: string;
  view: string;
  state: Record<string, unknown>;
  clientMutationId?: number;
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function doc(id: string, filePath: string, mode: 'active' | 'archive' = 'active'): DocViewerTab {
  const name = filePath.slice(filePath.lastIndexOf('/') + 1);
  return {
    id,
    kind: 'doc',
    path: filePath,
    name,
    extension: name.split('.').pop()?.toLowerCase() ?? '',
    ui: { mode, gridScroll: 0, docScroll: 0 },
  };
}

function capture(id: string, mode: 'active' | 'recent' = 'active'): DocViewerTab {
  return {
    id,
    kind: 'capture',
    ui: { mode, gridScroll: 0, docScroll: 0 },
  };
}

function seedCaptureState(patch: Partial<ViewUIState> = {}) {
  const messages: SentStateMessage[] = [];
  const socket = {
    readyState: 1,
    send(payload: string) {
      messages.push(JSON.parse(payload) as SentStateMessage);
    },
  } as unknown as WebSocket;
  usePanelStore.setState({
    ws: socket,
    panelConfigs: [{ id: PANEL, icon: 'inventory_2' }] as never,
    viewStates: {
      [PANEL]: {
        ...DEFAULT_VIEW_UI_STATE,
        ...patch,
      },
    },
  });
  return messages;
}

function state() {
  return usePanelStore.getState().viewStates[PANEL]!;
}

function persistedStates(messages: SentStateMessage[]) {
  return messages.filter((message) => message.type === 'state:set').map((message) => message.state);
}

test('B1-B4: capture plus is hidden on the grid, then seeds doc + CAPTURE and moves into the shell strip', () => {
  const adapter = getViewTabAdapter(PANEL)!;
  seedCaptureState();
  expect(resolveViewTabBarModel(adapter, adapter.getSnapshot())).toBeNull();
  expect(adapter.plus?.isAvailable?.(adapter.getSnapshot())).toBe(false);

  const messages = seedCaptureState({
    docViewerFullPage: true,
    docViewerActiveSelectedPath: '002-Captures/ideas.md',
    docViewerActiveGridScroll: 18,
    docViewerActiveDocScroll: 240,
  });
  expect(resolveViewTabBarModel(adapter, adapter.getSnapshot())).toBeNull();
  expect(adapter.plus?.isAvailable?.(adapter.getSnapshot())).toBe(true);

  plusPressed();

  expect(state().docViewerTabs).toHaveLength(2);
  expect(state().docViewerTabs?.map((tab) => tab.kind)).toEqual(['doc', 'capture']);
  expect(state().docViewerTabs?.[0].ui).toEqual({
    mode: 'active', gridScroll: 18, docScroll: 240,
  });
  expect(state().docViewerActiveTabId).toBe(state().docViewerTabs?.[1].id);
  expect(state().docViewerFullPage).toBe(false);

  const model = resolveViewTabBarModel(adapter, adapter.getSnapshot());
  expect(model?.tabs.map(({ label, icon }) => ({ label, icon }))).toEqual([
    { label: 'ideas.md', icon: 'description' },
    { label: 'CAPTURE', icon: 'inventory_2' },
  ]);
  expect(model?.plus?.label).toBe('New capture view');
  expect(persistedStates(messages)).toHaveLength(1);
  expect(Object.keys(persistedStates(messages)[0]).sort()).toEqual([
    'docViewerActiveTabId', 'docViewerTabs',
  ]);
});

test('B5/B9: doc opening replaces CAPTURE, appends from docs, and dedupes paths', () => {
  const first = doc('doc-a', '002-Captures/a.md');
  const home = capture('capture');
  const messages = seedCaptureState({
    docViewerTabs: [first, home],
    docViewerActiveTabId: home.id,
    docViewerMode: 'recent',
    docViewerActiveGridScroll: 44,
  });

  expect(docOpenedInTabs({ folder: '002-Captures', name: 'b.md' })).toBe(true);
  expect(state().docViewerTabs?.map((tab) => [tab.id, tab.kind])).toEqual([
    ['doc-a', 'doc'], ['capture', 'doc'],
  ]);
  expect(state().docViewerTabs?.[1]).toMatchObject({
    id: 'capture', kind: 'doc', path: '002-Captures/b.md', ui: { mode: 'recent' },
  });

  expect(docOpenedInTabs({ folder: '002-Captures', name: 'c.md' })).toBe(true);
  expect(state().docViewerTabs).toHaveLength(3);
  const bId = state().docViewerTabs?.[1].id;
  expect(docOpenedInTabs({ folder: '002-Captures', name: 'b.md' })).toBe(true);
  expect(state().docViewerTabs).toHaveLength(3);
  expect(state().docViewerActiveTabId).toBe(bId);

  plusPressed();
  const captureTab = state().docViewerTabs?.find((tab) => tab.kind === 'capture');
  expect(captureTab).toBeDefined();
  plusPressed();
  expect(state().docViewerTabs?.filter((tab) => tab.kind === 'capture')).toHaveLength(1);
  expect(state().docViewerActiveTabId).toBe(captureTab?.id);
  for (const patch of persistedStates(messages)) {
    expect(Object.keys(patch).sort()).toEqual(['docViewerActiveTabId', 'docViewerTabs']);
  }
});

test('B6-B7: back morphs in place, enforces singleton CAPTURE, and one survivor unwinds', () => {
  const first = doc('doc-a', '002-Captures/a.md');
  const second = doc('doc-b', '002-Captures/b.md');
  seedCaptureState({
    docViewerTabs: [first, capture('capture'), second],
    docViewerActiveTabId: second.id,
  });

  backOutOfDocTabs();
  expect(state().docViewerTabs?.map((tab) => [tab.id, tab.kind])).toEqual([
    ['doc-a', 'doc'], ['doc-b', 'capture'],
  ]);
  expect(state().docViewerFullPage).toBe(false);

  closeTab('doc-a');
  expect(state().docViewerTabs).toEqual([]);
  expect(state().docViewerActiveTabId).toBeNull();
  expect(state().docViewerFullPage).toBe(false);
  expect(state().docViewerActiveSelectedPath).toBeNull();
});

test('B7: closing the final durable tab degrades to the plain classic grid', () => {
  seedCaptureState({
    docViewerTabs: [doc('doc-a', '002-Captures/a.md')],
    docViewerActiveTabId: 'doc-a',
    docViewerFullPage: true,
    docViewerActiveSelectedPath: '002-Captures/a.md',
  });
  closeTab('doc-a');
  expect(state()).toMatchObject({
    docViewerTabs: [],
    docViewerActiveTabId: null,
    docViewerFullPage: false,
    docViewerActiveSelectedPath: null,
  });
});

test('B8: every activation snapshots current globals and restores the target atomically', () => {
  const first = doc('doc-a', '002-Captures/a.md');
  const home = capture('capture', 'recent');
  const messages = seedCaptureState({
    docViewerTabs: [first, home],
    docViewerActiveTabId: first.id,
    docViewerMode: 'archive',
    docViewerArchiveSelectedPath: first.path,
    docViewerArchiveGridScroll: 91,
    docViewerArchiveDocScroll: 812,
    docViewerFullPage: true,
  });

  activateTab(home.id);

  expect(state().docViewerTabs?.[0].ui).toEqual({
    mode: 'archive', gridScroll: 91, docScroll: 812,
  });
  expect(state()).toMatchObject({
    docViewerMode: 'recent',
    docViewerActiveSelectedPath: null,
    docViewerArchiveSelectedPath: null,
    docViewerActiveGridScroll: 0,
    docViewerFullPage: false,
  });
  expect(persistedStates(messages).at(-1)).toEqual({
    docViewerTabs: state().docViewerTabs,
    docViewerActiveTabId: home.id,
  });
});

test('restart hydration rebuilds globals and derives full-page from the active doc kind', () => {
  const first = doc('doc-a', '002-Captures/a.md');
  const second = {
    ...doc('doc-b', 'Archive/b.md', 'archive'),
    ui: { mode: 'archive' as const, gridScroll: 31, docScroll: 455 },
  };
  const messages = seedCaptureState({
    docViewerTabs: [first, second],
    docViewerActiveTabId: second.id,
    docViewerMode: 'active',
    docViewerFullPage: false,
  });

  normalizeCaptureTabsAfterHydration();

  expect(state()).toMatchObject({
    docViewerMode: 'archive',
    docViewerArchiveSelectedPath: second.path,
    docViewerActiveSelectedPath: null,
    docViewerArchiveGridScroll: 31,
    docViewerArchiveDocScroll: 455,
    docViewerFullPage: true,
  });
  expect(messages).toEqual([]);
});

test('live active-tab UI survives restart and mutation echoes do not reapply stale UI', () => {
  const first = doc('doc-a', '002-Captures/a.md');
  const home = capture('capture');
  const messages = seedCaptureState({
    docViewerTabs: [first, home],
    docViewerActiveTabId: home.id,
    docViewerMode: 'active',
  });

  persistCaptureViewPatch({
    docViewerMode: 'archive',
    docViewerArchiveGridScroll: 73,
    docViewerArchiveDocScroll: 419,
  });
  expect(state().docViewerTabs?.[1].ui).toEqual({
    mode: 'archive', gridScroll: 73, docScroll: 419,
  });
  expect(persistedStates(messages).at(-1)).toEqual({
    docViewerTabs: state().docViewerTabs,
    docViewerActiveTabId: home.id,
  });

  usePanelStore.getState().setViewState(PANEL, {
    docViewerMode: 'recent',
    docViewerActiveGridScroll: 999,
  });
  normalizeCaptureTabsAfterStateResult(2);
  expect(state()).toMatchObject({
    docViewerMode: 'recent',
    docViewerActiveGridScroll: 999,
  });

  normalizeCaptureTabsAfterStateResult(null);
  expect(state()).toMatchObject({
    docViewerMode: 'archive',
    docViewerArchiveGridScroll: 73,
    docViewerArchiveDocScroll: 419,
    docViewerFullPage: false,
  });
});

test('file rename/move acknowledgements rewrite durable doc identity and restart globals', () => {
  const first = doc('doc-a', '002-Captures/a.md');
  const home = capture('capture');
  const messages = seedCaptureState({
    docViewerTabs: [first, home],
    docViewerActiveTabId: first.id,
    docViewerActiveSelectedPath: first.path,
    docViewerFullPage: true,
  });

  expect(handleFileMessage({
    type: 'file:renamed',
    sourcePanel: PANEL,
    sourcePath: first.path,
    targetPanel: PANEL,
    targetPath: '002-Captures/renamed.txt',
    newName: 'renamed.txt',
  })).toBe(true);
  expect(state().docViewerTabs?.[0]).toMatchObject({
    id: first.id,
    kind: 'doc',
    path: '002-Captures/renamed.txt',
    name: 'renamed.txt',
    extension: 'txt',
  });
  expect(state()).toMatchObject({
    docViewerActiveSelectedPath: '002-Captures/renamed.txt',
    docViewerFullPage: true,
  });
  expect(persistedStates(messages).at(-1)).toEqual({
    docViewerTabs: state().docViewerTabs,
    docViewerActiveTabId: first.id,
  });

  usePanelStore.getState().setViewState(PANEL, {
    docViewerActiveSelectedPath: null,
    docViewerFullPage: false,
  });
  normalizeCaptureTabsAfterHydration();
  expect(state()).toMatchObject({
    docViewerActiveSelectedPath: '002-Captures/renamed.txt',
    docViewerFullPage: true,
  });
});

test('rename within Archive retains the durable doc tab and its restart identity', () => {
  const archived = doc('doc-archive', '999-Archive/old.md', 'archive');
  seedCaptureState({
    docViewerTabs: [archived, capture('capture')],
    docViewerActiveTabId: archived.id,
    docViewerMode: 'archive',
    docViewerArchiveSelectedPath: archived.path,
    docViewerFullPage: true,
  });

  expect(handleFileMessage({
    type: 'file:renamed',
    sourcePanel: PANEL,
    sourcePath: archived.path,
    targetPanel: PANEL,
    targetPath: '999-Archive/new.md',
    newName: 'new.md',
  })).toBe(true);
  expect(state().docViewerTabs?.[0]).toMatchObject({
    id: archived.id,
    kind: 'doc',
    path: '999-Archive/new.md',
    name: 'new.md',
    extension: 'md',
  });
  expect(state()).toMatchObject({
    docViewerActiveTabId: archived.id,
    docViewerArchiveSelectedPath: '999-Archive/new.md',
    docViewerFullPage: true,
  });

  usePanelStore.getState().setViewState(PANEL, {
    docViewerArchiveSelectedPath: null,
    docViewerFullPage: false,
  });
  normalizeCaptureTabsAfterHydration();
  expect(state()).toMatchObject({
    docViewerArchiveSelectedPath: '999-Archive/new.md',
    docViewerFullPage: true,
  });
});

test('tabbed archive/delete acknowledgements remove dangling docs and normalize the active slot', () => {
  const first = doc('doc-a', '002-Captures/a.md');
  const second = doc('doc-b', '002-Captures/b.md');
  seedCaptureState({
    docViewerTabs: [first, second, capture('capture')],
    docViewerActiveTabId: second.id,
    docViewerActiveSelectedPath: second.path,
    docViewerFullPage: true,
  });

  expect(handleFileMessage({
    type: 'file:deleted',
    sourcePanel: PANEL,
    sourcePath: second.path,
  })).toBe(true);
  expect(state().docViewerTabs?.map((tab) => [tab.id, tab.kind])).toEqual([
    [first.id, 'doc'], [second.id, 'capture'],
  ]);
  expect(state()).toMatchObject({
    docViewerActiveTabId: second.id,
    docViewerActiveSelectedPath: null,
    docViewerFullPage: false,
  });
  expect(state().docViewerTabs?.some(
    (tab) => tab.kind === 'doc' && tab.path === second.path,
  )).toBe(false);
  usePanelStore.getState().setViewState(PANEL, {
    docViewerActiveSelectedPath: second.path,
    docViewerFullPage: true,
  });
  normalizeCaptureTabsAfterHydration();
  expect(state()).toMatchObject({
    docViewerActiveSelectedPath: null,
    docViewerFullPage: false,
  });

  expect(handleFileMessage({
    type: 'file:moved',
    sourcePanel: PANEL,
    sourcePath: first.path,
    targetPanel: PANEL,
    targetPath: '999-Archive/a.md',
  })).toBe(true);
  expect(state()).toMatchObject({
    docViewerTabs: [],
    docViewerActiveTabId: null,
    docViewerFullPage: false,
  });
  expect(state().docViewerActiveSelectedPath).toBeNull();
});

test('malformed hydration drops invalid/pathless/duplicate records and repairs active + singleton state', () => {
  const malformed = [
    null,
    { id: '', kind: 'capture' },
    { id: 'bad-kind', kind: 'view', panelId: 'wiki-viewer' },
    { id: 'pathless', kind: 'doc' },
    { id: 'capture-a', kind: 'capture', ui: { mode: 'recent', gridScroll: 'bad' } },
    { id: 'capture-b', kind: 'capture' },
    { id: 'doc-a', kind: 'doc', path: '002-Captures/a.md', ui: { docScroll: 9 } },
    { id: 'doc-a', kind: 'doc', path: '002-Captures/duplicate.md' },
  ];
  const messages = seedCaptureState({
    docViewerTabs: malformed as never,
    docViewerActiveTabId: 'dangling',
  });

  normalizeCaptureTabsAfterHydration();

  expect(state().docViewerTabs).toEqual([
    capture('capture-a', 'recent'),
    {
      ...doc('doc-a', '002-Captures/a.md'),
      ui: { mode: 'active', gridScroll: 0, docScroll: 9 },
    },
  ]);
  expect(state().docViewerActiveTabId).toBe('capture-a');
  expect(state().docViewerFullPage).toBe(false);
  expect(persistedStates(messages).at(-1)).toEqual({
    docViewerTabs: state().docViewerTabs,
    docViewerActiveTabId: 'capture-a',
  });
  expect(normalizeCaptureTabRecords({ nope: true })).toEqual([]);
});

test('one hydrated record unwinds to classic while non-array state safely clears durable truth', () => {
  const messages = seedCaptureState({
    docViewerTabs: [{
      ...doc('doc-a', '002-Captures/a.md'),
      ui: { mode: 'active', gridScroll: 7, docScroll: 88 },
    }],
    docViewerActiveTabId: 'doc-a',
  });
  normalizeCaptureTabsAfterHydration();
  expect(state()).toMatchObject({
    docViewerTabs: [],
    docViewerActiveTabId: null,
    docViewerActiveSelectedPath: '002-Captures/a.md',
    docViewerActiveGridScroll: 7,
    docViewerActiveDocScroll: 88,
    docViewerFullPage: true,
  });
  expect(persistedStates(messages).at(-1)).toEqual({
    docViewerTabs: [], docViewerActiveTabId: null,
  });

  const corruptMessages = seedCaptureState({
    docViewerTabs: 'corrupt' as never,
    docViewerActiveTabId: 'dangling',
  });
  normalizeCaptureTabsAfterHydration();
  expect(state().docViewerTabs).toEqual([]);
  expect(state().docViewerActiveTabId).toBeNull();
  expect(persistedStates(corruptMessages).at(-1)).toEqual({
    docViewerTabs: [], docViewerActiveTabId: null,
  });
});

test('classic full-page transitions are RAM-only and source has exactly one capture plus slot', () => {
  const messages = seedCaptureState({
    docViewerFullPage: true,
    docViewerActiveSelectedPath: '002-Captures/archive-me.md',
  });
  clearActiveDocumentAfterArchive();
  expect(state()).toMatchObject({
    docViewerActiveSelectedPath: null,
    docViewerFullPage: false,
  });
  const adapter = getViewTabAdapter(PANEL)!;
  expect(adapter.plus?.isAvailable?.(adapter.getSnapshot())).toBe(false);
  expect(persistedStates(messages)).toEqual([{ docViewerActiveSelectedPath: null }]);

  messages.length = 0;
  setClassicDocFullPage(true);
  setClassicDocFullPage(false);
  expect(messages).toEqual([]);

  const layoutSource = read('src/components/ViewLayoutControls.tsx');
  const adapterSource = read('src/components/view-tabs/viewTabAdapters.ts');
  const captureSource = read('src/components/capture/CaptureTiles.tsx');
  const headerSource = read('src/components/capture/DocViewerHeader.tsx');
  const hookSource = read('src/hooks/useDocViewerState.ts');

  expect(layoutSource).toContain('Boolean(vs?.docViewerFullPage) && !isCaptureTabsActive(vs)');
  expect(adapterSource).toContain("availability: 'expanded'");
  expect(adapterSource).toMatch(/Boolean\(state\?\.docViewerFullPage\)[\s\S]*normalizedCaptureTabsFromState\(state\)\.length > 0/);
  expect(captureSource).not.toContain('CaptureTabStrip');
  expect(headerSource).not.toContain('tabStrip');
  expect(hookSource).toContain('clearActiveDocumentAfterArchive();');
  expect(fs.existsSync(path.resolve(process.cwd(), 'src/components/capture/CaptureTabStrip.tsx'))).toBe(false);
  expect(fs.existsSync(path.resolve(process.cwd(), 'src/components/capture/CaptureTabStrip.css'))).toBe(false);
});

test('pane mutations are tracked echoes and cannot masquerade as capture hydration', () => {
  const first = doc('doc-a', '002-Captures/a.md');
  const home = capture('capture');
  const messages = seedCaptureState({
    docViewerTabs: [first, home],
    docViewerActiveTabId: home.id,
    docViewerActiveSelectedPath: '002-Captures/preview.md',
  });

  usePanelStore.getState().toggleCollapsed(PANEL, 'leftSidebar');
  usePanelStore.getState().commitPaneWidths(PANEL, 'leftSidebar');
  const mutations = messages.filter((message) => message.type === 'state:set');
  expect(mutations).toHaveLength(2);
  expect(mutations.every((message) => typeof message.clientMutationId === 'number')).toBe(true);

  normalizeCaptureTabsAfterStateResult(mutations.at(-1)?.clientMutationId ?? null);
  expect(state().docViewerActiveSelectedPath).toBe('002-Captures/preview.md');

  const viewSliceSource = read('src/state/slices/viewSlice.ts');
  expect(viewSliceSource.match(/type: 'state:set'/g)).toHaveLength(1);
});
