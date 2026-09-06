import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { getViewTabAdapter } from '../src/components/view-tabs/viewTabAdapters';
import { resolveViewTabBarModel } from '../src/components/view-tabs/resolveViewTabBarModel';
import { resolveFileViewerSymlink } from '../src/components/file-explorer/fileViewerMetadata';
import {
  hydrateFileViewerActivity,
  loadExpandedFolders,
  loadFileContent,
  loadFolderChildren,
  loadRootTree,
} from '../src/lib/file-tree';
import { handleFileMessage } from '../src/lib/ws/file-handlers';
import { useFileDataStore } from '../src/state/fileDataStore';
import { useFileStore } from '../src/state/fileStore';
import { usePanelStore } from '../src/state/panelStore';
import { useWorkspaceStore } from '../src/state/workspaceStore';
import type {
  FileContentResponseV1,
  ResourceChangedMessageV1,
  ResourceRefreshRequiredV1,
} from '../src/types/file-explorer';
import type { ViewActivityState } from '../src/types';

const EPOCH_A1 = '123e4567-e89b-42d3-a456-426614174000';
const EPOCH_A2 = '123e4567-e89b-42d3-a456-426614174002';
const EPOCH_B1 = '123e4567-e89b-42d3-a456-426614174003';

function reset(messages: Array<Record<string, unknown>> = []) {
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: { OPEN: 1 } });
  useFileStore.getState().reset();
  useFileDataStore.getState().clearAll();
  useFileDataStore.setState({ generation: 0, workspaceId: null, workspaceEpoch: null });
  usePanelStore.setState({
    currentPanel: 'file-viewer',
    ws: {
      readyState: 1,
      send(value: string) { messages.push(JSON.parse(value) as Record<string, unknown>); },
      close() {},
    } as unknown as WebSocket,
  });
  useWorkspaceStore.setState({
    activeWorkspaceId: 'workspace-A',
    workspaceEpoch: EPOCH_A1,
    fileViewerReadProtocolVersion: 1,
  });
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A', EPOCH_A1);
}

function contentSuccess(
  request: Record<string, unknown>,
  content: string,
  lastModified = 10,
): FileContentResponseV1 {
  return {
    type: 'file_content_response',
    version: 1,
    success: true,
    requestId: request.requestId as string,
    workspaceId: request.workspaceId as string,
    workspaceEpoch: request.workspaceEpoch as string,
    panel: 'file-viewer',
    path: request.path as string,
    content,
    size: new TextEncoder().encode(content).length,
    lastModified,
  };
}

function changed(path: string): ResourceChangedMessageV1 {
  return {
    type: 'resource:changed',
    version: 1,
    eventId: '123e4567-e89b-42d3-a456-426614174010',
    operationId: '123e4567-e89b-42d3-a456-426614174011',
    workspaceId: 'workspace-A',
    resourceId: '123e4567-e89b-42d3-a456-426614174012',
    resourceKind: 'file',
    operation: 'modify',
    panel: 'file-viewer',
    path,
    occurredAt: 20,
    workspaceEpoch: EPOCH_A1,
  };
}

function recovery(path: string): ResourceRefreshRequiredV1 {
  return {
    type: 'resource:refresh_required',
    version: 1,
    workspaceId: 'workspace-A',
    panel: 'file-viewer',
    path,
    operationId: '123e4567-e89b-42d3-a456-426614174011',
    workspaceEpoch: EPOCH_A1,
    reason: 'projection_failed',
  };
}

test.beforeEach(() => reset());

test('File Viewer presentation survives modify, recovery, and reconnect while content stays central', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages);
  useFileStore.getState().activateWorkspace('workspace-A');
  loadFileContent({ name: 'a.md', path: 'docs/a.md', type: 'file', extension: 'md' });
  loadFileContent({ name: 'b.md', path: 'docs/b.md', type: 'file', extension: 'md' });
  const initialRequests = messages.filter((message) => message.type === 'file_content_request');
  expect(handleFileMessage(contentSuccess(initialRequests[0]!, 'alpha', 11))).toBe(true);
  expect(handleFileMessage(contentSuccess(initialRequests[1]!, 'bravo', 12))).toBe(true);

  useFileStore.getState().expandFolder('docs');
  useFileStore.getState().toggleHiddenFolders();
  const presentationBefore = useFileStore.getState();
  const tabIds = presentationBefore.tabs.map((tab) => tab.id);
  const activeTabId = presentationBefore.activeTabId;
  expect(presentationBefore.tabs.every((tab) => (
    tab.kind === 'empty'
    || (!Object.hasOwn(tab, 'content') && !Object.hasOwn(tab, 'size') && !Object.hasOwn(tab, 'loading'))
  ))).toBe(true);
  expect(useFileDataStore.getState().contentMetadata['file-viewer:docs/b.md']).toEqual({
    size: 5,
    lastModified: 12,
  });

  messages.length = 0;
  expect(handleFileMessage(changed('docs/b.md'))).toBe(true);
  expect(messages.map((message) => [message.type, message.path])).toEqual([
    ['file_tree_request', 'docs'],
    ['file_content_request', 'docs/b.md'],
  ]);
  expect(useFileStore.getState().tabs.map((tab) => tab.id)).toEqual(tabIds);
  expect(useFileStore.getState().activeTabId).toBe(activeTabId);
  expect(useFileStore.getState().expandedFolders.has('docs')).toBe(true);
  expect(useFileStore.getState().showHiddenFolders).toBe(true);
  expect(useFileDataStore.getState().contents['file-viewer:docs/a.md']).toBe('alpha');

  const modifiedRequest = messages.find((message) => message.type === 'file_content_request')!;
  expect(handleFileMessage(contentSuccess(modifiedRequest, 'updated', 13))).toBe(true);
  expect(useFileDataStore.getState().contents['file-viewer:docs/b.md']).toBe('updated');

  messages.length = 0;
  expect(handleFileMessage(recovery('docs/b.md'))).toBe(true);
  expect(messages.map((message) => message.type)).toEqual([
    'file_tree_request',
    'file_content_request',
  ]);
  expect(useFileStore.getState().tabs.map((tab) => tab.id)).toEqual(tabIds);

  messages.length = 0;
  useWorkspaceStore.setState({ workspaceEpoch: EPOCH_A2 });
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A', EPOCH_A2);
  useFileStore.getState().activateWorkspace('workspace-A');
  expect(messages.some((message) => (
    message.type === 'file_content_request'
    && message.path === 'docs/a.md'
    && message.workspaceEpoch === EPOCH_A2
  ))).toBe(true);
  expect(useFileStore.getState().tabs.map((tab) => tab.id)).toEqual(tabIds);
  expect(useFileStore.getState().activeTabId).toBe(activeTabId);
  expect(useFileStore.getState().expandedFolders.has('docs')).toBe(true);
  expect(useFileStore.getState().showHiddenFolders).toBe(true);
  expect(useFileDataStore.getState().fileViewerDefaultTreeRepresentation).toEqual({
    includeHiddenFolders: true,
  });
});

test('tab strip observes central pending completion and close prevents delayed cache recreation', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages);
  loadFileContent({ name: 'a.md', path: 'docs/a.md', type: 'file', extension: 'md' });
  const tab = useFileStore.getState().tabs[0]!;
  const request = messages.at(-1)!;

  const adapter = getViewTabAdapter('file-viewer')!;
  expect(resolveViewTabBarModel(adapter, adapter.getSnapshot())?.tabs[0]?.closeDisabled).toBe(true);
  let notifications = 0;
  const unsubscribe = adapter.subscribe(() => { notifications += 1; });
  expect(handleFileMessage(contentSuccess(request, 'loaded'))).toBe(true);
  unsubscribe();
  expect(notifications).toBeGreaterThan(0);
  expect(resolveViewTabBarModel(adapter, adapter.getSnapshot())?.tabs[0]?.closeDisabled).toBe(false);
  useFileStore.getState().closeTab(tab.id);
  expect(useFileDataStore.getState().fileViewerContentInterests.has('file-viewer:docs/a.md')).toBe(false);

  loadFileContent({ name: 'late.md', path: 'docs/late.md', type: 'file', extension: 'md' });
  const lateTab = useFileStore.getState().tabs[0]!;
  const lateRequest = messages.at(-1)!;
  useFileStore.getState().closeTab(lateTab.id);
  expect(useFileDataStore.getState().fileViewerContentInterests.has('file-viewer:docs/late.md')).toBe(false);
  expect(useFileDataStore.getState().pendingContents.has('file-viewer:docs/a.md')).toBe(false);
  expect(handleFileMessage(contentSuccess(lateRequest, 'late'))).toBe(true);
  expect(useFileDataStore.getState().contents['file-viewer:docs/late.md']).toBeUndefined();

  loadFileContent({ name: 'dirty.md', path: 'docs/dirty.md', type: 'file', extension: 'md' });
  const dirtyRequest = messages.at(-1)!;
  expect(handleFileMessage(contentSuccess(dirtyRequest, 'draft'))).toBe(true);
  useFileDataStore.getState().setDirty('file-viewer', 'docs/dirty.md', true);
  const dirtyTab = useFileStore.getState().tabs[0]!;
  useFileStore.getState().closeTab(dirtyTab.id);
  expect(useFileDataStore.getState().fileViewerContentInterests.has('file-viewer:docs/dirty.md')).toBe(true);
  expect(useFileDataStore.getState().contents['file-viewer:docs/dirty.md']).toBe('draft');
});

test('hidden-folder toggle requests root and every expanded folder with the exact representation', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages);
  useFileStore.getState().expandFolder('docs');

  useFileStore.getState().toggleHiddenFolders();
  loadRootTree(true);
  loadExpandedFolders(true);
  expect(messages.filter((message) => message.type === 'file_tree_request').map((message) => ({
    path: message.path,
    includeHiddenFolders: message.includeHiddenFolders,
  }))).toEqual([
    { path: '', includeHiddenFolders: true },
    { path: 'docs', includeHiddenFolders: true },
  ]);

  messages.length = 0;
  useFileStore.getState().toggleHiddenFolders();
  loadRootTree(true);
  loadExpandedFolders(true);
  expect(messages.filter((message) => message.type === 'file_tree_request').map((message) => ({
    path: message.path,
    includeHiddenFolders: message.includeHiddenFolders,
  }))).toEqual([
    { path: '', includeHiddenFolders: false },
    { path: 'docs', includeHiddenFolders: false },
  ]);
});

test('hidden representation changes retire opposite cached trees before transport succeeds', () => {
  reset();
  useFileStore.getState().expandFolder('docs');
  useFileStore.getState().toggleHiddenFolders();
  useFileDataStore.setState({
    trees: {
      'file-viewer:': [{ name: '.hidden', path: '.hidden', type: 'folder', hasChildren: false }],
      'file-viewer:docs': [{ name: '.secret', path: 'docs/.secret', type: 'folder', hasChildren: false }],
    },
    fileViewerTreeRepresentations: new Map([
      ['file-viewer:', { includeHiddenFolders: true }],
      ['file-viewer:docs', { includeHiddenFolders: true }],
    ]),
  });
  usePanelStore.setState({
    ws: {
      readyState: 1,
      send() { throw new Error('send failed'); },
      close() {},
    } as unknown as WebSocket,
  });

  useFileStore.getState().toggleHiddenFolders();
  loadRootTree(true);
  loadExpandedFolders(true);
  let fileData = useFileDataStore.getState();
  expect(fileData.trees['file-viewer:']).toBeUndefined();
  expect(fileData.trees['file-viewer:docs']).toBeUndefined();
  expect(fileData.pendingTrees.size).toBe(0);
  expect(fileData.fileViewerTreeRepresentations.get('file-viewer:')).toEqual({
    includeHiddenFolders: false,
  });
  expect(fileData.fileViewerTreeRepresentations.get('file-viewer:docs')).toEqual({
    includeHiddenFolders: false,
  });

  useFileDataStore.setState({
    trees: {
      'file-viewer:': [{ name: 'visible', path: 'visible', type: 'folder', hasChildren: false }],
      'file-viewer:docs': [{ name: 'public', path: 'docs/public', type: 'folder', hasChildren: false }],
    },
  });
  useWorkspaceStore.setState({ fileViewerReadProtocolVersion: null });
  useFileStore.getState().toggleHiddenFolders();
  loadRootTree(true);
  loadExpandedFolders(true);
  fileData = useFileDataStore.getState();
  expect(fileData.trees['file-viewer:']).toBeUndefined();
  expect(fileData.trees['file-viewer:docs']).toBeUndefined();
  expect(fileData.fileViewerTreeRepresentations.get('file-viewer:')).toEqual({
    includeHiddenFolders: true,
  });
  expect(fileData.fileViewerTreeRepresentations.get('file-viewer:docs')).toEqual({
    includeHiddenFolders: true,
  });
});

test('collapsed cached folders adopt both hidden representations and refetch on next use', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages);
  useFileDataStore.setState({
    trees: {
      'file-viewer:docs': [{ name: 'public', path: 'docs/public', type: 'folder', hasChildren: false }],
    },
    fileViewerTreeRepresentations: new Map([
      ['file-viewer:docs', { includeHiddenFolders: false }],
    ]),
  });
  expect(useFileStore.getState().expandedFolders.has('docs')).toBe(false);

  useFileStore.getState().toggleHiddenFolders();
  expect(useFileDataStore.getState().trees['file-viewer:docs']).toBeUndefined();
  expect(useFileDataStore.getState().fileViewerTreeRepresentations.get('file-viewer:docs')).toEqual({
    includeHiddenFolders: true,
  });
  loadFolderChildren('docs');
  expect(messages.find((message) => message.type === 'file_tree_request')).toMatchObject({
    path: 'docs',
    includeHiddenFolders: true,
  });

  reset(messages);
  useFileStore.getState().toggleHiddenFolders();
  useFileDataStore.setState({
    trees: {
      'file-viewer:docs': [{ name: '.secret', path: 'docs/.secret', type: 'folder', hasChildren: false }],
    },
    fileViewerTreeRepresentations: new Map([
      ['file-viewer:docs', { includeHiddenFolders: true }],
    ]),
  });
  messages.length = 0;
  useFileStore.getState().toggleHiddenFolders();
  expect(useFileDataStore.getState().trees['file-viewer:docs']).toBeUndefined();
  expect(useFileDataStore.getState().fileViewerTreeRepresentations.get('file-viewer:docs')).toEqual({
    includeHiddenFolders: false,
  });
  loadFolderChildren('docs');
  expect(messages.find((message) => message.type === 'file_tree_request')).toMatchObject({
    path: 'docs',
    includeHiddenFolders: false,
  });
});

test('projection-created unseen folders inherit active hidden representation through failed-send rebind', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages);
  useFileStore.getState().toggleHiddenFolders();
  expect(useFileDataStore.getState().fileViewerDefaultTreeRepresentation).toEqual({
    includeHiddenFolders: true,
  });

  expect(handleFileMessage(changed('docs/a.md'))).toBe(true);
  expect(messages.find((message) => message.type === 'file_tree_request')).toMatchObject({
    path: 'docs',
    includeHiddenFolders: true,
  });

  reset();
  useFileStore.getState().toggleHiddenFolders();
  usePanelStore.setState({
    ws: {
      readyState: 1,
      send() { throw new Error('send failed'); },
      close() {},
    } as unknown as WebSocket,
  });
  expect(handleFileMessage(changed('docs/a.md'))).toBe(true);
  expect(useFileDataStore.getState().pendingTrees.size).toBe(0);
  expect(useFileDataStore.getState().fileViewerTreeRepresentations.get('file-viewer:docs')).toEqual({
    includeHiddenFolders: true,
  });

  const reboundMessages: Array<Record<string, unknown>> = [];
  usePanelStore.setState({
    ws: {
      readyState: 1,
      send(value: string) { reboundMessages.push(JSON.parse(value) as Record<string, unknown>); },
      close() {},
    } as unknown as WebSocket,
  });
  useWorkspaceStore.setState({ workspaceEpoch: EPOCH_A2 });
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A', EPOCH_A2);
  expect(reboundMessages.find((message) => message.type === 'file_tree_request')).toMatchObject({
    path: 'docs',
    includeHiddenFolders: true,
    workspaceEpoch: EPOCH_A2,
  });
});

test('activity hydration and reset release only removed clean paths without churning retained paths', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages);
  loadFileContent({ name: 'a.md', path: 'docs/a.md', type: 'file', extension: 'md' });
  loadFileContent({ name: 'b.md', path: 'docs/b.md', type: 'file', extension: 'md' });
  const requests = messages.filter((message) => message.type === 'file_content_request');
  expect(handleFileMessage(contentSuccess(requests[0]!, 'alpha'))).toBe(true);
  expect(handleFileMessage(contentSuccess(requests[1]!, 'bravo'))).toBe(true);

  const retainedActivity: ViewActivityState = {
    recents: [],
    navigation: { stack: [], index: -1 },
    tabs: [{
      id: 'file-viewer:docs/b.md',
      panel: 'file-viewer',
      path: 'docs/b.md',
      title: 'b.md',
      kind: 'file',
      openedAt: Date.now(),
      extension: 'md',
    }],
    activeTabId: 'file-viewer:docs/b.md',
  };
  useFileStore.getState().hydrateTabsFromActivity(retainedActivity);
  expect(useFileDataStore.getState().contents['file-viewer:docs/a.md']).toBeUndefined();
  expect(useFileDataStore.getState().fileViewerContentInterests.has('file-viewer:docs/a.md')).toBe(false);
  expect(useFileDataStore.getState().contents['file-viewer:docs/b.md']).toBe('bravo');
  expect(useFileDataStore.getState().fileViewerContentInterests.has('file-viewer:docs/b.md')).toBe(true);

  useFileStore.getState().reset();
  expect(useFileDataStore.getState().contents['file-viewer:docs/b.md']).toBeUndefined();
  expect(useFileDataStore.getState().fileViewerContentInterests.has('file-viewer:docs/b.md')).toBe(false);
});

test('A to B activity hydration registers only authoritative post-hydration tab interests', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages);
  useFileStore.getState().activateWorkspace('workspace-A');
  loadFileContent({ name: 'old.md', path: 'old/old.md', type: 'file', extension: 'md' });

  useWorkspaceStore.setState({
    activeWorkspaceId: 'workspace-B',
    workspaceEpoch: EPOCH_B1,
    fileViewerReadProtocolVersion: 1,
  });
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-B', EPOCH_B1);
  useFileStore.getState().activateWorkspace('workspace-B');
  messages.length = 0;
  hydrateFileViewerActivity({
    recents: [],
    navigation: { stack: [], index: -1 },
    tabs: [{
      id: 'file-viewer:new/new.md',
      panel: 'file-viewer',
      path: 'new/new.md',
      title: 'new.md',
      kind: 'file',
      openedAt: Date.now(),
      extension: 'md',
    }],
    activeTabId: 'file-viewer:new/new.md',
  });

  expect(messages.filter((message) => message.type === 'file_content_request').map((message) => ({
    workspaceId: message.workspaceId,
    path: message.path,
  }))).toEqual([{ workspaceId: 'workspace-B', path: 'new/new.md' }]);
  expect(Array.from(useFileDataStore.getState().fileViewerContentInterests)).toEqual([
    'file-viewer:new/new.md',
  ]);
  expect(useFileStore.getState().tabs).toHaveLength(1);
  expect(useFileStore.getState().tabs[0]?.kind === 'file'
    ? useFileStore.getState().tabs[0]?.file.path
    : null).toBe('new/new.md');
});

test('content-discovered symlink metadata remains canonical and refreshes persisted tab activity', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages);
  loadFileContent({ name: 'linked.md', path: 'docs/linked.md', type: 'file', extension: 'md' });
  const request = messages.find((message) => message.type === 'file_content_request')!;
  expect(handleFileMessage({
    ...contentSuccess(request, 'linked'),
    isSymlink: true,
    symlinkTarget: '/outside/source.md',
  })).toBe(true);

  expect(useFileDataStore.getState().contentMetadata['file-viewer:docs/linked.md']).toEqual({
    isSymlink: true,
    symlinkTarget: '/outside/source.md',
    size: 6,
    lastModified: 10,
  });
  const tab = useFileStore.getState().tabs[0]!;
  expect(tab.kind === 'file' ? tab.file.isSymlink : undefined).toBeUndefined();
  expect(
    usePanelStore.getState().viewStates['file-viewer']?.activity.tabs[0]?.metadata,
  ).toEqual({ isSymlink: true, symlinkTarget: '/outside/source.md' });
});

test('an authoritative regular-file response overrides a restored stale symlink hint', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages);
  const activity: ViewActivityState = {
    recents: [],
    navigation: { stack: [], index: -1 },
    tabs: [{
      id: 'file-viewer:docs/linked.md',
      panel: 'file-viewer',
      path: 'docs/linked.md',
      title: 'linked.md',
      kind: 'file',
      openedAt: Date.now(),
      extension: 'md',
      metadata: { isSymlink: true, symlinkTarget: '/old/source.md' },
    }],
    activeTabId: 'file-viewer:docs/linked.md',
  };
  useFileStore.getState().hydrateTabsFromActivity(activity);
  const tab = useFileStore.getState().tabs[0]!;
  expect(tab.kind === 'file' ? tab.file.isSymlink : undefined).toBe(true);

  useFileDataStore.getState().requestContent('file-viewer', 'docs/linked.md');
  const request = messages.find((message) => message.type === 'file_content_request')!;
  expect(handleFileMessage(contentSuccess(request, 'regular'))).toBe(true);
  const canonical = useFileDataStore.getState().contentMetadata['file-viewer:docs/linked.md'];
  expect(canonical).toEqual({ size: 7, lastModified: 10 });
  expect(resolveFileViewerSymlink(canonical, tab.kind === 'file' ? tab.file : null)).toEqual({
    isSymlink: false,
  });
  expect(
    usePanelStore.getState().viewStates['file-viewer']?.activity.tabs[0]?.metadata,
  ).toBeUndefined();
});

test('accepted content errors remove the tab, retain central visible error, and retire correlation', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages);
  loadFileContent({ name: 'missing.md', path: 'docs/missing.md', type: 'file', extension: 'md' });
  const request = messages.at(-1)!;
  expect(handleFileMessage({
    type: 'file_content_response',
    version: 1,
    success: false,
    code: 'not_found',
    requestId: request.requestId,
    workspaceId: request.workspaceId,
    workspaceEpoch: request.workspaceEpoch,
    panel: 'file-viewer',
    path: request.path,
    error: 'The requested file was not found.',
  })).toBe(true);
  expect(useFileStore.getState().tabs).toEqual([]);
  expect(useFileStore.getState().viewMode).toBe('tree');
  expect(useFileDataStore.getState().contentErrors['file-viewer:docs/missing.md']).toBe(
    'The requested file was not found.',
  );
  expect(useFileDataStore.getState().fileViewerContentInterests.has('file-viewer:docs/missing.md')).toBe(false);
  expect(useFileDataStore.getState().pendingContents.has('file-viewer:docs/missing.md')).toBe(false);

  useFileStore.getState().openEmptyTab();
  expect(useFileDataStore.getState().contentErrors['file-viewer:docs/missing.md']).toBeUndefined();
});

test('source ownership has no private File Viewer response listener or duplicate canonical tab fields', () => {
  const hookPath = new URL('../src/hooks/useFileTree.ts', import.meta.url);
  expect(existsSync(hookPath)).toBe(false);
  const listenerFreeSources = [
    '../src/components/file-explorer/FileExplorer.tsx',
    '../src/components/file-explorer/FileViewer.tsx',
    '../src/components/file-explorer/FolderNode.tsx',
    '../src/components/file-explorer/FileNode.tsx',
    '../src/lib/file-tree.ts',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  expect(listenerFreeSources).not.toMatch(/addEventListener\(\s*['"]message['"]/u);
  expect(listenerFreeSources).not.toMatch(/file_(?:tree|content)_response/u);

  const presentationStore = readFileSync(
    new URL('../src/state/fileStore.ts', import.meta.url),
    'utf8',
  );
  const tabTypes = readFileSync(
    new URL('../src/types/file-explorer.ts', import.meta.url),
    'utf8',
  );
  expect(presentationStore).not.toMatch(/\b(?:rootNodes|folderChildren|applyFileContent|setRootNodes|setFolderChildren)\b/u);
  const fileEditorTabType = tabTypes.match(/interface FileEditorTab[^}]*\}/u)?.[0] ?? '';
  expect(fileEditorTabType).not.toMatch(/\b(?:content|size|loading):/u);
});
