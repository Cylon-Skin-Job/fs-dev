import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loadFileContent, loadRootTree } from '../src/lib/file-tree';
import {
  createFileContentRequestV1,
  createFileTreeRequestV1,
  isFileContentResponseV1,
  isFileTreeResponseV1,
} from '../src/lib/ws/file-viewer-read-protocol';
import {
  isResourceChangedMessageV1,
  isResourceRefreshRequiredV1,
} from '../src/lib/ws/resource-projection-protocol';
import { handleFileMessage } from '../src/lib/ws/file-handlers';
import { useFileDataStore } from '../src/state/fileDataStore';
import { useFileStore } from '../src/state/fileStore';
import { usePanelStore } from '../src/state/panelStore';
import { useWorkspaceStore } from '../src/state/workspaceStore';
import type {
  FileContentResponseV1,
  FileTreeResponseV1,
  ResourceChangedMessageV1,
  ResourceRefreshRequiredV1,
} from '../src/types/file-explorer';

const EPOCH_A1 = '123e4567-e89b-42d3-a456-426614174000';
const EPOCH_B = '123e4567-e89b-42d3-a456-426614174001';
const EPOCH_A2 = '123e4567-e89b-42d3-a456-426614174002';

function reset(messages: Array<Record<string, unknown>>, closes: Array<[number, string]>) {
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: { OPEN: 1 } });
  usePanelStore.setState({
    ws: {
      readyState: 1,
      send(value: string) { messages.push(JSON.parse(value) as Record<string, unknown>); },
      close(code: number, reason: string) { closes.push([code, reason]); },
    } as unknown as WebSocket,
  });
  useWorkspaceStore.setState({
    activeWorkspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
    fileViewerReadProtocolVersion: 1,
  });
  useFileDataStore.getState().clearAll();
  useFileDataStore.setState({ generation: 0, workspaceId: null, workspaceEpoch: null });
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A', EPOCH_A1);
}

function contentSuccess(request: Record<string, unknown>, content = 'body'): FileContentResponseV1 {
  return {
    type: 'file_content_response', version: 1, success: true,
    requestId: request.requestId as string, workspaceId: request.workspaceId as string,
    workspaceEpoch: request.workspaceEpoch as string, panel: 'file-viewer',
    path: request.path as string, content, size: new TextEncoder().encode(content).length,
    lastModified: 10,
  };
}

function treeSuccess(request: Record<string, unknown>): FileTreeResponseV1 {
  return {
    type: 'file_tree_response', version: 1, success: true,
    requestId: request.requestId as string, workspaceId: request.workspaceId as string,
    workspaceEpoch: request.workspaceEpoch as string, panel: 'file-viewer',
    path: request.path as string, nodes: [],
  };
}

function changed(overrides: Partial<ResourceChangedMessageV1> = {}): ResourceChangedMessageV1 {
  return {
    type: 'resource:changed', version: 1,
    eventId: '123e4567-e89b-42d3-a456-426614174010',
    operationId: '123e4567-e89b-42d3-a456-426614174011',
    workspaceId: 'workspace-A', resourceId: '123e4567-e89b-42d3-a456-426614174012',
    resourceKind: 'file', operation: 'modify', panel: 'file-viewer', path: 'docs/a.md',
    occurredAt: 20, workspaceEpoch: EPOCH_A1, ...overrides,
  };
}

function recovery(overrides: Partial<ResourceRefreshRequiredV1> = {}): ResourceRefreshRequiredV1 {
  return {
    type: 'resource:refresh_required', version: 1, workspaceId: 'workspace-A',
    panel: 'file-viewer', path: 'docs/a.md',
    operationId: '123e4567-e89b-42d3-a456-426614174011', workspaceEpoch: EPOCH_A1,
    reason: 'projection_failed', ...overrides,
  };
}

test('read builders emit exact v1 wire shapes without local generation', () => {
  const tree = createFileTreeRequestV1({
    requestId: 'tree-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
    path: '', includeHiddenFolders: false,
  });
  const content = createFileContentRequestV1({
    requestId: 'content-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
    path: 'docs/a.md',
  });
  expect(Object.keys(tree).sort()).toEqual([
    'includeHiddenFolders', 'panel', 'path', 'requestId', 'type', 'version', 'workspaceEpoch', 'workspaceId',
  ]);
  expect(Object.keys(content).sort()).toEqual([
    'panel', 'path', 'requestId', 'type', 'version', 'workspaceEpoch', 'workspaceId',
  ]);
  expect(tree).not.toHaveProperty('generation');
  expect(content).not.toHaveProperty('generation');
});

test('current File Viewer UI adapter emits only correlated v1 requests while other panels stay legacy', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages, []);
  useFileStore.getState().reset();

  loadRootTree();
  loadFileContent({ name: 'a.md', path: 'docs/a.md', type: 'file', extension: 'md' });
  useFileDataStore.getState().requestTree('office-viewer', 'docs');
  const fileMessages = messages.filter((message) => (
    message.type === 'file_tree_request' || message.type === 'file_content_request'
  ));

  expect(fileMessages).toHaveLength(3);
  expect(fileMessages[0]).toMatchObject({
    type: 'file_tree_request', version: 1, panel: 'file-viewer', path: '',
    workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1, includeHiddenFolders: false,
  });
  expect(fileMessages[1]).toMatchObject({
    type: 'file_content_request', version: 1, panel: 'file-viewer', path: 'docs/a.md',
    workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
  });
  expect(fileMessages.slice(0, 2).every((message) => (
    typeof message.requestId === 'string' && !Object.hasOwn(message, 'generation')
  ))).toBe(true);
  expect(fileMessages[2]).toMatchObject({ type: 'file_tree_request', panel: 'office-viewer', path: 'docs' });
  expect(fileMessages[2]).not.toHaveProperty('version');

  const directEmitterSources = [
    '../src/components/file-explorer/FolderNode.tsx',
    '../src/components/file-explorer/FileExplorer.tsx',
    '../src/components/sidebar/useSidebar.ts',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  expect(directEmitterSources).not.toMatch(/type:\s*['"]file_(?:tree|content)_request['"]/u);
});

test('tree hidden-folder representation survives forced changes, projection, recovery, and same-workspace rebind', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages, []);
  const store = useFileDataStore.getState();

  store.requestTree('file-viewer', '', { force: true, includeHiddenFolders: false });
  store.requestTree('file-viewer', '', { force: true, includeHiddenFolders: true });
  store.requestTree('file-viewer', 'docs', { force: true, includeHiddenFolders: false });
  expect(messages.slice(-2).map((message) => [message.path, message.includeHiddenFolders])).toEqual([
    ['', true],
    ['docs', false],
  ]);
  expect(useFileDataStore.getState().pendingTrees.get('file-viewer:')?.includeHiddenFolders).toBe(true);
  expect(useFileDataStore.getState().pendingTrees.get('file-viewer:docs')?.includeHiddenFolders).toBe(false);
  expect(useFileDataStore.getState().fileViewerTreeRepresentations.get('file-viewer:')).toEqual({
    includeHiddenFolders: true,
  });

  messages.length = 0;
  expect(store.handleResourceChanged(changed({ path: 'root.md' }))).toBe('applied');
  expect(store.handleResourceRefreshRequired(recovery({ path: 'docs/a.md' }))).toBe(true);
  expect(messages.map((message) => [message.path, message.includeHiddenFolders])).toEqual([
    ['', true],
    ['docs', false],
  ]);

  messages.length = 0;
  useWorkspaceStore.setState({ workspaceEpoch: EPOCH_A2 });
  store.beginWorkspaceGeneration('workspace-A', EPOCH_A2);
  expect(messages.map((message) => [message.path, message.workspaceEpoch, message.includeHiddenFolders])).toEqual([
    ['', EPOCH_A2, true],
    ['docs', EPOCH_A2, false],
  ]);

  messages.length = 0;
  store.requestTree('office-viewer', 'docs', { force: true, includeHiddenFolders: true });
  expect(messages[0]).toMatchObject({ panel: 'office-viewer', path: 'docs' });
  expect(messages[0]).not.toHaveProperty('includeHiddenFolders');
  expect(useFileDataStore.getState().fileViewerTreeRepresentations.has('office-viewer:docs')).toBe(false);
});

test('failed targeted sends retain exact tree/content hydration interest for the replacement epoch', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages, []);
  const store = useFileDataStore.getState();

  store.requestTree('file-viewer', 'docs', { force: true, includeHiddenFolders: true });
  const treeRequest = messages.at(-1)!;
  expect(store.handleTreeResponseV1(treeSuccess(treeRequest))).toBe(true);
  store.requestContent('file-viewer', 'docs/a.md');
  const contentRequest = messages.at(-1)!;
  expect(store.handleContentResponseV1(contentSuccess(contentRequest, 'cached'))).toBe(true);
  expect(useFileDataStore.getState().fileViewerContentInterests.has('file-viewer:docs/a.md')).toBe(true);

  usePanelStore.setState({
    ws: {
      readyState: 1,
      send() { throw new Error('simulated send failure'); },
      close() {},
    } as unknown as WebSocket,
  });
  expect(store.handleResourceChanged(changed())).toBe('applied');
  expect(useFileDataStore.getState().pendingTrees.size).toBe(0);
  expect(useFileDataStore.getState().pendingContents.size).toBe(0);
  expect(useFileDataStore.getState().trees['file-viewer:docs']).toBeUndefined();
  expect(useFileDataStore.getState().contents['file-viewer:docs/a.md']).toBeUndefined();
  expect(useFileDataStore.getState().fileViewerTreeRepresentations.get('file-viewer:docs')).toEqual({
    includeHiddenFolders: true,
  });
  expect(useFileDataStore.getState().fileViewerContentInterests.has('file-viewer:docs/a.md')).toBe(true);

  const hydrated: Array<Record<string, unknown>> = [];
  usePanelStore.setState({
    ws: {
      readyState: 1,
      send(value: string) { hydrated.push(JSON.parse(value) as Record<string, unknown>); },
      close() {},
    } as unknown as WebSocket,
  });
  useWorkspaceStore.setState({ workspaceEpoch: EPOCH_A2 });
  store.beginWorkspaceGeneration('workspace-A', EPOCH_A2);
  expect(hydrated.map((message) => [
    message.type, message.path, message.workspaceEpoch, message.includeHiddenFolders,
  ])).toEqual([
    ['file_tree_request', 'docs', EPOCH_A2, true],
    ['file_content_request', 'docs/a.md', EPOCH_A2, undefined],
  ]);

  expect(store.releaseFileViewerContent('docs/a.md')).toBe(true);
  expect(useFileDataStore.getState().fileViewerContentInterests.has('file-viewer:docs/a.md')).toBe(false);
  useWorkspaceStore.setState({ activeWorkspaceId: 'workspace-B', workspaceEpoch: EPOCH_B });
  store.beginWorkspaceGeneration('workspace-B', EPOCH_B);
  expect(useFileDataStore.getState().fileViewerTreeRepresentations.size).toBe(0);
  expect(useFileDataStore.getState().fileViewerContentInterests.size).toBe(0);
});

test('runtime response guards enforce closure, bounds, symlink coupling, and exact UTF-8 size', () => {
  const tree = treeSuccess({ requestId: 'tree-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1, path: '' });
  const content = contentSuccess({ requestId: 'content-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1, path: 'a.md' }, '🦊');
  expect(isFileTreeResponseV1(tree)).toBe(true);
  expect(isFileContentResponseV1(content)).toBe(true);
  expect(isFileTreeResponseV1({ ...tree, unknown: true })).toBe(false);
  expect(isFileTreeResponseV1({ ...tree, nodes: [{ name: 'a', path: 'a', type: 'file', symlinkTarget: '/tmp/a' }] })).toBe(false);
  expect(isFileContentResponseV1({ ...content, size: 2 })).toBe(false);
  expect(isFileContentResponseV1({ ...content, content: '\ud800', size: 3 })).toBe(false);
  expect(isFileContentResponseV1({ ...content, content: 'a\0b', size: 3 })).toBe(false);
  expect(isResourceChangedMessageV1(changed())).toBe(true);
  expect(isResourceChangedMessageV1({ ...changed(), path: 'docs/\ud800.md' })).toBe(false);
  expect(isResourceChangedMessageV1({ ...changed(), workspaceId: '🦊'.repeat(33) })).toBe(false);
  expect(isResourceRefreshRequiredV1(recovery())).toBe(true);
  expect(isResourceRefreshRequiredV1({ ...recovery(), path: 'docs/a.md\0' })).toBe(false);
});

test('literal File Viewer and any versioned read response cannot fall through legacy cache population', () => {
  const messages: Array<Record<string, unknown>> = [];
  const closes: Array<[number, string]> = [];
  reset(messages, closes);
  useFileDataStore.setState({ contents: {}, trees: {} });
  expect(handleFileMessage({
    type: 'file_content_response', panel: 'file-viewer', path: 'docs/a.md', content: 'legacy', success: true,
  })).toBe(true);
  expect(handleFileMessage({
    type: 'file_tree_response', version: 2, panel: 'office-viewer', path: 'docs', nodes: [], success: true,
  })).toBe(true);
  expect(useFileDataStore.getState().contents['file-viewer:docs/a.md']).toBeUndefined();
  expect(useFileDataStore.getState().trees['office-viewer:docs']).toBeUndefined();
  expect(closes).toHaveLength(2);
  expect(closes.every(([code]) => code === 1011)).toBe(true);
});

test('A-B-A delayed reads are ignored and only the current pair/request can populate cache', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages, []);
  useFileDataStore.getState().requestContent('file-viewer', 'docs/a.md');
  const oldA = messages.at(-1)!;

  useWorkspaceStore.setState({ activeWorkspaceId: 'workspace-B', workspaceEpoch: EPOCH_B });
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-B', EPOCH_B);
  useWorkspaceStore.setState({ activeWorkspaceId: 'workspace-A', workspaceEpoch: EPOCH_A2 });
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A', EPOCH_A2);
  expect(useFileDataStore.getState().handleContentResponseV1(contentSuccess(oldA, 'stale'))).toBe(false);
  const beforeStaleProjection = messages.length;
  expect(useFileDataStore.getState().handleResourceChanged(changed())).toBe('stale');
  expect(messages).toHaveLength(beforeStaleProjection);

  useFileDataStore.getState().requestContent('file-viewer', 'docs/a.md');
  const currentA = messages.at(-1)!;
  expect(currentA.workspaceEpoch).toBe(EPOCH_A2);
  expect(useFileDataStore.getState().handleContentResponseV1(contentSuccess(currentA, 'current'))).toBe(true);
  expect(useFileDataStore.getState().contents['file-viewer:docs/a.md']).toBe('current');
});

test('modify projection supersedes pending correlations and refetches only content plus parent tree', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages, []);
  useFileDataStore.setState({
    trees: { 'file-viewer:docs': [{ name: 'a.md', path: 'docs/a.md', type: 'file' }], 'file-viewer:other': [] },
    contents: { 'file-viewer:docs/a.md': 'old', 'file-viewer:other.md': 'keep', 'office-viewer:docs/a.md': 'dirty office' },
  });
  useFileDataStore.getState().requestContent('file-viewer', 'docs/pending.md');
  const pending = messages.at(-1)!;
  expect(useFileDataStore.getState().handleResourceChanged(changed({ path: 'docs/pending.md' }))).toBe('applied');
  const replacements = messages.slice(-2);
  expect(replacements.map((item) => item.type)).toEqual(['file_tree_request', 'file_content_request']);
  expect(replacements[1].requestId).not.toBe(pending.requestId);
  expect(useFileDataStore.getState().handleContentResponseV1(contentSuccess(pending, 'late'))).toBe(false);
  expect(useFileDataStore.getState().trees['file-viewer:other']).toEqual([]);
  expect(useFileDataStore.getState().contents['file-viewer:other.md']).toBe('keep');
  expect(useFileDataStore.getState().contents['office-viewer:docs/a.md']).toBe('dirty office');
});

test('modify refetches content only when that exact File Viewer path was cached or requested', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages, []);

  expect(useFileDataStore.getState().handleResourceChanged(changed({ path: 'docs/unopened.md' }))).toBe('applied');
  expect(messages.map((item) => [item.type, item.path])).toEqual([
    ['file_tree_request', 'docs'],
  ]);
  expect(useFileDataStore.getState().pendingContents.size).toBe(0);
  expect(useFileDataStore.getState().contents['file-viewer:docs/unopened.md']).toBeUndefined();
  expect(useFileDataStore.getState().contentErrors['file-viewer:docs/unopened.md']).toBeUndefined();

  messages.length = 0;
  useFileDataStore.setState({
    contents: { 'file-viewer:docs/open.md': 'cached' },
    pendingTrees: new Map(),
  });
  expect(useFileDataStore.getState().handleResourceChanged(changed({
    eventId: '123e4567-e89b-42d3-a456-426614174030',
    operationId: '123e4567-e89b-42d3-a456-426614174031',
    resourceId: '123e4567-e89b-42d3-a456-426614174032',
    path: 'docs/open.md',
  }))).toBe('applied');
  expect(messages.map((item) => [item.type, item.path])).toEqual([
    ['file_tree_request', 'docs'],
    ['file_content_request', 'docs/open.md'],
  ]);
});

test('create refetches parent tree and content only when that exact path is open/requested', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages, []);
  expect(useFileDataStore.getState().handleResourceChanged(changed({ operation: 'create', path: 'docs/new.md' }))).toBe('applied');
  expect(messages.map((item) => item.type)).toEqual(['file_tree_request']);

  messages.length = 0;
  useFileDataStore.setState({ contents: { 'file-viewer:docs/open.md': 'old' }, pendingTrees: new Map() });
  expect(useFileDataStore.getState().handleResourceChanged(changed({
    eventId: '123e4567-e89b-42d3-a456-426614174020',
    operationId: '123e4567-e89b-42d3-a456-426614174021',
    resourceId: '123e4567-e89b-42d3-a456-426614174022',
    operation: 'create', path: 'docs/open.md',
  }))).toBe('applied');
  expect(messages.map((item) => item.type)).toEqual(['file_tree_request', 'file_content_request']);
});

test('canonical duplicates are order-independent, conflicts fail closed, and recovery does not invent dedupe', () => {
  const messages: Array<Record<string, unknown>> = [];
  const closes: Array<[number, string]> = [];
  reset(messages, closes);
  const projection = changed();
  expect(handleFileMessage(projection)).toBe(true);
  const afterFirst = messages.length;
  const reordered = Object.fromEntries(Object.entries(projection).reverse()) as ResourceChangedMessageV1;
  expect(handleFileMessage(reordered)).toBe(true);
  expect(messages).toHaveLength(afterFirst);
  expect(handleFileMessage({ ...projection, path: 'docs/conflict.md' })).toBe(true);
  expect(closes.at(-1)?.[0]).toBe(1011);

  messages.length = 0;
  expect(handleFileMessage(recovery())).toBe(true);
  expect(handleFileMessage(recovery())).toBe(true);
  expect(messages.map((item) => item.type)).toEqual([
    'file_tree_request', 'file_tree_request',
  ]);
  expect(useFileDataStore.getState().resourceProjectionDedupe.size).toBe(2);
});

test('same-workspace reconnect hydrates canonical clean entries while preserving dirty buffers and unrelated panels', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages, []);
  useFileDataStore.setState({
    trees: { 'file-viewer:docs': [], 'office-viewer:docs': [] },
    contents: {
      'file-viewer:docs/clean.md': 'old canonical',
      'file-viewer:docs/dirty.md': 'local dirty',
      'office-viewer:report.md': 'office dirty',
      'email-viewer:draft.md': 'email dirty',
    },
    dirtyFlags: {
      'file-viewer:docs/dirty.md': true,
      'office-viewer:report.md': true,
      'email-viewer:draft.md': true,
    },
  });
  useWorkspaceStore.setState({ workspaceEpoch: EPOCH_A2 });
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A', EPOCH_A2);
  expect(messages.map((item) => [item.type, item.path])).toEqual([
    ['file_tree_request', 'docs'], ['file_content_request', 'docs/clean.md'],
  ]);
  const state = useFileDataStore.getState();
  expect(state.contents['file-viewer:docs/clean.md']).toBeUndefined();
  expect(state.contents['file-viewer:docs/dirty.md']).toBe('local dirty');
  expect(state.contents['office-viewer:report.md']).toBe('office dirty');
  expect(state.contents['email-viewer:draft.md']).toBe('email dirty');
  expect(state.trees['office-viewer:docs']).toEqual([]);
});
