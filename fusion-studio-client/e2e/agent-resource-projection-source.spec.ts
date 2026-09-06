import { expect, test } from '@playwright/test';
import {
  isResourceChangedMessageV2,
  isResourceRefreshRequiredV1,
} from '../src/lib/ws/resource-projection-protocol';
import { handleFileMessage } from '../src/lib/ws/file-handlers';
import { useFileDataStore } from '../src/state/fileDataStore';
import { usePanelStore } from '../src/state/panelStore';
import { useWorkspaceStore } from '../src/state/workspaceStore';
import type { ResourceChangedMessageV2 } from '../src/types/file-explorer';

const EPOCH = '123e4567-e89b-42d3-a456-426614174000';
const EDGE = '123e4567-e89b-42d3-a456-426614174010';
const ACTIVITY = '123e4567-e89b-42d3-a456-426614174011';
const SNAPSHOT = '123e4567-e89b-42d3-a456-426614174012';
const RESOURCE = '123e4567-e89b-42d3-a456-426614174013';
const CHECKPOINT_EVENT = '123e4567-e89b-42d3-a456-426614174014';
const CHECKPOINT_OBSERVATION = '123e4567-e89b-42d3-a456-426614174015';

function changed(overrides: Partial<ResourceChangedMessageV2> = {}): ResourceChangedMessageV2 {
  return {
    type: 'resource:changed', version: 2, projectionId: EDGE,
    sourceActivityId: ACTIVITY, sourceEdgeId: EDGE, workspaceId: 'workspace-A',
    resourceKind: 'file', changeKind: 'state_observed', relation: 'changed',
    panel: 'file-viewer', path: 'docs/a.md', occurredAt: 20, workspaceEpoch: EPOCH,
    checkpointEventId: CHECKPOINT_EVENT, checkpointObservationId: CHECKPOINT_OBSERVATION,
    snapshotId: SNAPSHOT, state: 'bytes', resourceId: RESOURCE,
    ...overrides,
  } as ResourceChangedMessageV2;
}

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
    activeWorkspaceId: 'workspace-A', workspaceEpoch: EPOCH,
    fileViewerReadProtocolVersion: 1,
  });
  useFileDataStore.getState().clearAll();
  useFileDataStore.setState({ generation: 0, workspaceId: null, workspaceEpoch: null });
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A', EPOCH);
}

test('v2 client validator mirrors the immutable server union exactly', () => {
  const firstBytes = changed({ relation: 'first_observation' });
  const unchangedBytes = changed({
    relation: 'unchanged',
    checkpointEventId: undefined,
    checkpointObservationId: undefined,
  } as Partial<ResourceChangedMessageV2>);
  delete (unchangedBytes as unknown as Record<string, unknown>).checkpointEventId;
  delete (unchangedBytes as unknown as Record<string, unknown>).checkpointObservationId;
  const absent = changed({ state: 'absent', resourceId: undefined } as Partial<ResourceChangedMessageV2>);
  delete (absent as unknown as Record<string, unknown>).resourceId;

  expect(isResourceChangedMessageV2(firstBytes)).toBe(true);
  expect(isResourceChangedMessageV2(unchangedBytes)).toBe(true);
  expect(isResourceChangedMessageV2(absent)).toBe(true);
  expect(isResourceChangedMessageV2({ ...firstBytes, projectionId: ACTIVITY })).toBe(false);
  expect(isResourceChangedMessageV2({ ...firstBytes, unknown: true })).toBe(false);
  expect(isResourceChangedMessageV2({ ...firstBytes, checkpointEventId: undefined })).toBe(false);
  expect(isResourceChangedMessageV2({ ...unchangedBytes, checkpointEventId: CHECKPOINT_EVENT })).toBe(false);
  expect(isResourceChangedMessageV2({ ...absent, resourceId: RESOURCE })).toBe(false);
  expect(isResourceChangedMessageV2({ ...firstBytes, path: 'docs/../a.md' })).toBe(false);
  expect(isResourceChangedMessageV2({ ...firstBytes, occurredAt: Number.MAX_SAFE_INTEGER + 1 })).toBe(false);
});

test('v2 stable dominant-edge identity dedupes exact replay and rejects conflict', () => {
  const messages: Array<Record<string, unknown>> = [];
  const closes: Array<[number, string]> = [];
  reset(messages, closes);
  useFileDataStore.setState({
    trees: { 'file-viewer:docs': [] },
    contents: { 'file-viewer:docs/a.md': 'old' },
  });
  const projection = changed();

  expect(handleFileMessage(projection)).toBe(true);
  expect(messages.map((message) => [message.type, message.path])).toEqual([
    ['file_tree_request', 'docs'], ['file_content_request', 'docs/a.md'],
  ]);
  const firstCount = messages.length;
  expect(handleFileMessage(Object.fromEntries(Object.entries(projection).reverse()))).toBe(true);
  expect(messages).toHaveLength(firstCount);
  expect(useFileDataStore.getState().resourceProjectionDedupe.size).toBe(1);

  expect(handleFileMessage({ ...projection, relation: 'first_observation' })).toBe(true);
  expect(closes.at(-1)?.[0]).toBe(1011);
});

test('first, changed, unchanged, absent, and agent recovery all use targeted refetch', () => {
  const messages: Array<Record<string, unknown>> = [];
  reset(messages, []);
  useFileDataStore.setState({ contents: { 'file-viewer:docs/a.md': 'cached' } });

  const variants: ResourceChangedMessageV2[] = [
    changed({ relation: 'first_observation' }),
    changed({ projectionId: '123e4567-e89b-42d3-a456-426614174020', sourceEdgeId: '123e4567-e89b-42d3-a456-426614174020' }),
  ];
  const unchanged = changed({
    projectionId: '123e4567-e89b-42d3-a456-426614174021',
    sourceEdgeId: '123e4567-e89b-42d3-a456-426614174021',
    relation: 'unchanged',
  } as Partial<ResourceChangedMessageV2>);
  delete (unchanged as unknown as Record<string, unknown>).checkpointEventId;
  delete (unchanged as unknown as Record<string, unknown>).checkpointObservationId;
  variants.push(unchanged);
  const absent = changed({
    projectionId: '123e4567-e89b-42d3-a456-426614174022',
    sourceEdgeId: '123e4567-e89b-42d3-a456-426614174022',
    state: 'absent',
  } as Partial<ResourceChangedMessageV2>);
  delete (absent as unknown as Record<string, unknown>).resourceId;
  variants.push(absent);

  for (const projection of variants) {
    useFileDataStore.setState({
      contents: { 'file-viewer:docs/a.md': 'cached' },
      pendingTrees: new Map(), pendingContents: new Map(),
    });
    expect(useFileDataStore.getState().handleResourceChanged(projection)).toBe('applied');
  }
  expect(messages.filter((message) => message.type === 'file_content_request')).toHaveLength(4);

  const recovery = {
    type: 'resource:refresh_required', version: 1, workspaceId: 'workspace-A',
    panel: 'file-viewer', path: 'docs/a.md', operationId: ACTIVITY,
    workspaceEpoch: EPOCH, reason: 'fact_publish_failed',
  } as const;
  expect(isResourceRefreshRequiredV1(recovery)).toBe(true);
  expect(handleFileMessage(recovery)).toBe(true);
  expect(messages.at(-1)).toMatchObject({ type: 'file_content_request', path: 'docs/a.md' });
});

test('stale v2 is ignored and malformed v2 closes instead of falling into v1', () => {
  const messages: Array<Record<string, unknown>> = [];
  const closes: Array<[number, string]> = [];
  reset(messages, closes);
  expect(useFileDataStore.getState().handleResourceChanged(changed({
    workspaceEpoch: '123e4567-e89b-42d3-a456-426614174099',
  }))).toBe('stale');
  expect(messages).toHaveLength(0);
  expect(handleFileMessage({ ...changed(), snapshotId: null })).toBe(true);
  expect(closes).toEqual([[1011, 'invalid resource changed message']]);
});
