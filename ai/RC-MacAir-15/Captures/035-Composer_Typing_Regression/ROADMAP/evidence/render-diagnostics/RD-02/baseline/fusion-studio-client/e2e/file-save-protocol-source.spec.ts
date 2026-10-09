import { expect, test } from '@playwright/test';
import {
  createFileSaveRequestV1,
  isFileSaveResponseV1,
  responseMatchesPendingFileSave,
  type PendingFileSaveV1,
} from '../src/lib/ws/file-save-protocol';
import { useFileDataStore } from '../src/state/fileDataStore';
import { usePanelStore } from '../src/state/panelStore';
import { useWorkspaceStore } from '../src/state/workspaceStore';
import { bootstrapWorkspaceAfterBind } from '../src/lib/ws/workspace-handlers';
import { OfficePaletteClientController } from '../src/lib/ws/office-palette-handlers';
import { useOfficePaletteStore } from '../src/state/officePaletteStore';
import {
  saveAcknowledgedMilestone,
  saveBeforeDocumentNavigation,
} from '../src/components/documentSaveAcknowledgement';
import type { FileSaveResponseV1, FileSaveSucceededResponseV1 } from '../src/types/file-explorer';

const EPOCH_A1 = '123e4567-e89b-42d3-a456-426614174000';
const EPOCH_B = '123e4567-e89b-42d3-a456-426614174001';
const EPOCH_A2 = '123e4567-e89b-42d3-a456-426614174002';

function success(request: {
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel: string;
  path: string;
}): FileSaveSucceededResponseV1 {
  return {
    type: 'file_save_response', version: 1, success: true, outcome: 'succeeded',
    requestId: request.requestId,
    workspaceId: request.workspaceId,
    workspaceEpoch: request.workspaceEpoch,
    panel: request.panel,
    path: request.path,
    operationId: '123e4567-e89b-42d3-a456-426614174010',
    commandId: '123e4567-e89b-42d3-a456-426614174011',
    commandAcceptedEventId: '123e4567-e89b-42d3-a456-426614174012',
    resourceEventId: '123e4567-e89b-42d3-a456-426614174013',
    resourceId: '123e4567-e89b-42d3-a456-426614174014',
    fileVersionId: '123e4567-e89b-42d3-a456-426614174015',
    canonicalPath: request.path,
    commandFactState: 'admitted', resourceFactState: 'admitted', ledgerState: 'stored',
    provenanceState: 'complete', checkpointState: 'not_requested',
  };
}

function resetStores(messages: Array<Record<string, unknown>>) {
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    value: { OPEN: 1 },
  });
  usePanelStore.setState({
    ws: {
      readyState: 1,
      send(value: string) { messages.push(JSON.parse(value) as Record<string, unknown>); },
    } as unknown as WebSocket,
  });
  useWorkspaceStore.setState({
    activeWorkspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1, fileSaveProtocolVersion: 1,
  });
  useFileDataStore.setState({ workspaceId: null });
  useFileDataStore.getState().clearAll();
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A');
}

test('exact request builder emits closed own keys and omits absent optionals', () => {
  const basic = createFileSaveRequestV1({
    workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
    panel: 'file-viewer', path: 'note.md', content: 'body',
  });
  expect(Object.keys(basic).sort()).toEqual([
    'content', 'panel', 'path', 'requestId', 'type', 'version', 'workspaceEpoch', 'workspaceId',
  ]);
  expect(basic).toMatchObject({
    type: 'file_save', version: 1, workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
    panel: 'file-viewer', path: 'note.md', content: 'body',
  });
  expect(basic.requestId).toMatch(/^[0-9a-f-]{36}$/);

  const milestone = createFileSaveRequestV1({
    workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1, panel: 'office-viewer',
    path: 'release.md', content: 'body', reason: 'milestone', milestone: 'Release 1',
    clientActionId: 'action-1', reportedUiContext: { viewId: 'office-viewer' },
  });
  expect(milestone).toMatchObject({
    reason: 'milestone', milestone: 'Release 1', clientActionId: 'action-1',
    reportedUiContext: { viewId: 'office-viewer' },
  });
  expect(() => createFileSaveRequestV1({
    workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1, panel: 'file-viewer',
    path: 'note.md', content: 'body', reason: 'milestone',
  })).toThrow('milestone reason requires milestone');
});

test('response correlation requires request id and both current workspace-pair values', () => {
  const pending: PendingFileSaveV1 = {
    mode: 'v1', requestId: 'request-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
    panel: 'file-viewer', path: 'note.md',
  };
  const response = success(pending);
  expect(responseMatchesPendingFileSave(pending, response, {
    workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
  })).toBe(true);
  expect(responseMatchesPendingFileSave(pending, { ...response, requestId: 'request-2' }, {
    workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
  })).toBe(false);
  expect(responseMatchesPendingFileSave(pending, { ...response, workspaceEpoch: EPOCH_A2 }, {
    workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A2,
  })).toBe(false);
  expect(responseMatchesPendingFileSave(pending, response, {
    workspaceId: 'workspace-B', workspaceEpoch: EPOCH_B,
  })).toBe(false);
});

test('runtime response guard rejects closed-union drift, missing reserved ids, and warning disorder', () => {
  const valid = success({
    requestId: 'request-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
    panel: 'file-viewer', path: 'note.md',
  });
  expect(isFileSaveResponseV1(valid)).toBe(true);
  expect(isFileSaveResponseV1({ ...valid, unknown: true })).toBe(false);
  const missing = { ...valid } as Partial<FileSaveSucceededResponseV1>;
  delete missing.resourceEventId;
  expect(isFileSaveResponseV1(missing)).toBe(false);
  expect(isFileSaveResponseV1({
    ...valid,
    commandFactState: 'pending', resourceFactState: 'pending', ledgerState: 'pending',
    provenanceState: 'pending_reconciliation', checkpointState: 'failed',
    warningCodes: ['provenance_pending', 'checkpoint_failed'],
  })).toBe(false);
  expect(isFileSaveResponseV1({
    ...valid,
    commandFactState: 'pending', resourceFactState: 'pending', ledgerState: 'pending',
    provenanceState: 'pending_reconciliation', checkpointState: 'failed',
    warningCodes: ['checkpoint_failed', 'provenance_pending'],
  })).toBe(true);
});

test('all first-party save reasons use the advertised v1 sender and wait for correlated success', async () => {
  const messages: Array<Record<string, unknown>> = [];
  resetStores(messages);
  const reasons = ['autosave', 'manual', 'session_end', 'checkpoint', 'milestone'] as const;

  for (const [index, reason] of reasons.entries()) {
    const path = `note-${index}.md`;
    useFileDataStore.getState().setDirty('file-viewer', path, true);
    const completion = useFileDataStore.getState().saveFile(
      'file-viewer', path, `body-${index}`, reason, reason === 'milestone' ? 'Release 1' : undefined,
    );
    const request = messages.at(-1)! as unknown as {
      type: 'file_save'; version: 1; requestId: string; workspaceId: string; workspaceEpoch: string;
      panel: string; path: string; reason: string; milestone?: string;
    };
    expect(request).toMatchObject({
      type: 'file_save', version: 1, workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
      panel: 'file-viewer', path, reason,
    });
    if (reason === 'milestone') expect(request.milestone).toBe('Release 1');
    else expect(request).not.toHaveProperty('milestone');
    expect(useFileDataStore.getState().dirtyFlags[`file-viewer:${path}`]).toBe(true);
    expect(useFileDataStore.getState().pendingSaves.has(request.requestId)).toBe(true);
    expect(useFileDataStore.getState().handleSaveResponseV1(success(request))).toBe(true);
    await expect(completion).resolves.toBeUndefined();
    expect(useFileDataStore.getState().dirtyFlags[`file-viewer:${path}`]).toBeUndefined();
  }
});

test('wrong-id and stale-pair replies cannot settle a pending save', async () => {
  const messages: Array<Record<string, unknown>> = [];
  resetStores(messages);
  useFileDataStore.getState().setDirty('file-viewer', 'note.md', true);
  const completion = useFileDataStore.getState().saveFile('file-viewer', 'note.md', 'body', 'manual');
  const request = messages[0] as unknown as PendingFileSaveV1;
  const wrongId = { ...success(request), requestId: 'wrong-id' };
  expect(useFileDataStore.getState().handleSaveResponseV1(wrongId)).toBe(false);
  const stale = { ...success(request), workspaceEpoch: EPOCH_A2 };
  expect(useFileDataStore.getState().handleSaveResponseV1(stale)).toBe(false);
  expect(useFileDataStore.getState().pendingSaves.has(request.requestId)).toBe(true);
  expect(useFileDataStore.getState().dirtyFlags['file-viewer:note.md']).toBe(true);
  expect(useFileDataStore.getState().handleSaveResponseV1(success(request))).toBe(true);
  await expect(completion).resolves.toBeUndefined();
});

test('a save acknowledgement only clears the dirty revision it captured', async () => {
  const messages: Array<Record<string, unknown>> = [];
  resetStores(messages);
  const key = 'file-viewer:note.md';
  useFileDataStore.getState().setDirty('file-viewer', 'note.md', true);
  const firstCompletion = useFileDataStore.getState().saveFile(
    'file-viewer', 'note.md', 'revision one', 'autosave',
  );
  const first = messages[0] as unknown as PendingFileSaveV1;

  useFileDataStore.getState().setDirty('file-viewer', 'note.md', true);
  expect(useFileDataStore.getState().handleSaveResponseV1(success(first))).toBe(true);
  await firstCompletion;
  expect(useFileDataStore.getState().dirtyFlags[key]).toBe(true);

  const secondCompletion = useFileDataStore.getState().saveFile(
    'file-viewer', 'note.md', 'revision two', 'autosave',
  );
  const second = messages[1] as unknown as PendingFileSaveV1;
  expect(useFileDataStore.getState().handleSaveResponseV1(success(second))).toBe(true);
  await secondCompletion;
  expect(useFileDataStore.getState().dirtyFlags[key]).toBeUndefined();
});

for (const panel of ['office-viewer', 'email-viewer']) {
  test(`${panel} navigation drains an in-flight save and every later dirty revision`, async () => {
    const messages: Array<Record<string, unknown>> = [];
    resetStores(messages);
    useFileDataStore.getState().setDirty(panel, 'report.md', true);
    const firstCompletion = useFileDataStore.getState().saveFile(
      panel, 'report.md', 'revision one', 'autosave',
    );
    const first = messages[0] as unknown as PendingFileSaveV1;
    useFileDataStore.getState().setDirty(panel, 'report.md', true);

    let saveCalls = 0;
    const navigationReady = saveBeforeDocumentNavigation({
      panel,
      path: 'report.md',
      saveCurrent: () => {
        saveCalls += 1;
        return useFileDataStore.getState().saveFile(
          panel, 'report.md', 'revision two', 'autosave',
        );
      },
    });
    expect(saveCalls).toBe(1);
    expect(messages).toHaveLength(1);

    expect(useFileDataStore.getState().handleSaveResponseV1(success(first))).toBe(true);
    await firstCompletion;
    await Promise.resolve();
    expect(saveCalls).toBe(2);
    expect(messages).toHaveLength(2);
    const second = messages[1] as unknown as PendingFileSaveV1;
    expect(useFileDataStore.getState().handleSaveResponseV1(success(second))).toBe(true);
    await expect(navigationReady).resolves.toBeUndefined();
  });

  test(`${panel} navigation aborts when its pending save loses acknowledgement`, async () => {
    const messages: Array<Record<string, unknown>> = [];
    resetStores(messages);
    useFileDataStore.getState().setDirty(panel, 'report.md', true);
    const pending = useFileDataStore.getState().saveFile(panel, 'report.md', 'unsaved', 'autosave');
    const observedFailure = pending.catch((error: unknown) => error);
    const navigationReady = saveBeforeDocumentNavigation({
      panel,
      path: 'report.md',
      saveCurrent: () => useFileDataStore.getState().saveFile(
        panel, 'report.md', 'unsaved', 'autosave',
      ),
    });

    useFileDataStore.getState().retirePendingSaves();
    await expect(navigationReady).rejects.toThrow('closed before acknowledgment');
    await expect(observedFailure).resolves.toBeInstanceOf(Error);
    expect(useFileDataStore.getState().dirtyFlags[`${panel}:report.md`]).toBe(true);
  });
}

test('A -> B -> A clears old correlation so a delayed first-A reply is discarded', async () => {
  const messages: Array<Record<string, unknown>> = [];
  resetStores(messages);
  const completion = useFileDataStore.getState().saveFile('file-viewer', 'note.md', 'body', 'manual');
  const observedFailure = completion.catch((error: unknown) => error);
  const firstA = messages[0] as unknown as PendingFileSaveV1;

  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-B', EPOCH_B, 1);
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-B');
  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-A', EPOCH_A2, 1);
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A');

  expect(useFileDataStore.getState().handleSaveResponseV1(success(firstA))).toBe(false);
  expect(useFileDataStore.getState().pendingSaves.size).toBe(0);
  await expect(observedFailure).resolves.toBeInstanceOf(Error);
});

test('reconnect retires the epoch and pending correlation without erasing dirty/content state', async () => {
  const messages: Array<Record<string, unknown>> = [];
  resetStores(messages);
  useFileDataStore.setState({ contents: { 'file-viewer:note.md': 'body' } });
  useFileDataStore.getState().setDirty('file-viewer', 'note.md', true);
  const completion = useFileDataStore.getState().saveFile('file-viewer', 'note.md', 'body', 'manual');
  const observedFailure = completion.catch((error: unknown) => error);
  expect(useFileDataStore.getState().pendingSaves.size).toBe(1);

  useWorkspaceStore.getState().beginInit();
  useFileDataStore.getState().retirePendingSaves();
  expect(useWorkspaceStore.getState()).toMatchObject({
    activeWorkspaceId: 'workspace-A', workspaceEpoch: null, fileSaveProtocolVersion: 1,
  });
  expect(useFileDataStore.getState().pendingSaves.size).toBe(0);
  expect(useFileDataStore.getState().contents['file-viewer:note.md']).toBe('body');
  expect(useFileDataStore.getState().dirtyFlags['file-viewer:note.md']).toBe(true);

  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-A', EPOCH_A2, 1);
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A');
  expect(useFileDataStore.getState().contents['file-viewer:note.md']).toBe('body');
  expect(useFileDataStore.getState().dirtyFlags['file-viewer:note.md']).toBe(true);
  expect(useFileDataStore.getState().pendingSaves.size).toBe(0);
  await expect(observedFailure).resolves.toBeInstanceOf(Error);
});

test('workspace bootstrap traffic starts only after the bind helper runs', async () => {
  const messages: Array<Record<string, unknown>> = [];
  const ws = {
    send(value: string) { messages.push(JSON.parse(value) as Record<string, unknown>); },
  } as unknown as WebSocket;
  let discoveryStarted = false;
  await bootstrapWorkspaceAfterBind(ws, 'file-viewer', async (boundWs, options) => {
    discoveryStarted = true;
    expect(boundWs).toBe(ws);
    expect(options).toEqual({ preserveCurrent: true });
  });
  expect(messages).toEqual([{ type: 'set_panel', panel: 'file-viewer' }]);
  expect(discoveryStarted).toBe(true);
});

test('other workspace-bound bootstrap stays deferred until the bound workspace is applied', () => {
  const messages: Array<Record<string, unknown>> = [];
  const ws = {
    readyState: 1,
    send(value: string) { messages.push(JSON.parse(value) as Record<string, unknown>); },
  };
  const controller = new OfficePaletteClientController({
    getActiveWorkspaceId: () => 'workspace-A',
    getPaletteStore: () => useOfficePaletteStore.getState(),
    createRequestId: () => 'palette-after-bind',
  });
  controller.onSocketOpen(ws, false);
  expect(messages).toEqual([]);
  controller.onWorkspaceChanged('workspace-A');
  expect(messages).toEqual([{
    type: 'office:palette_get', requestId: 'palette-after-bind', workspaceId: 'workspace-A',
  }]);
});

test('pair-less fixed rejection correlates by request id; legacy remains active until advertised', async () => {
  const messages: Array<Record<string, unknown>> = [];
  resetStores(messages);
  useFileDataStore.getState().setDirty('file-viewer', 'note.md', true);
  const completion = useFileDataStore.getState().saveFile('file-viewer', 'note.md', 'body', 'manual');
  const current = messages[0] as unknown as PendingFileSaveV1;
  const rejected: FileSaveResponseV1 = {
    type: 'file_save_response', version: 1, success: false, outcome: 'rejected',
    errorCode: 'workspace_unavailable', requestId: current.requestId,
    error: 'The workspace is not available.', retrySafe: true,
  };
  expect(useFileDataStore.getState().handleSaveResponseV1(rejected)).toBe(true);
  expect(useFileDataStore.getState().dirtyFlags['file-viewer:note.md']).toBe(true);
  expect(useFileDataStore.getState().pendingSaves.size).toBe(0);
  await expect(completion).rejects.toThrow('The workspace is not available.');

  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-A', EPOCH_A2, null);
  const legacyCompletion = useFileDataStore.getState().saveFile(
    'file-viewer', 'legacy.md', 'legacy body', 'checkpoint',
  );
  expect(messages.at(-1)).toEqual({
    type: 'file_save', panel: 'file-viewer', path: 'legacy.md', content: 'legacy body', reason: 'checkpoint',
  });
  useFileDataStore.getState().handleLegacySaveResponse('file-viewer', 'legacy.md', true);
  await expect(legacyCompletion).resolves.toBeUndefined();
});

test('legacy A -> B -> A retires ambiguous path correlation until socket replacement', async () => {
  const messages: Array<Record<string, unknown>> = [];
  const closes: Array<[number, string]> = [];
  resetStores(messages);
  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-A', EPOCH_A1, null);
  usePanelStore.setState({
    ws: {
      readyState: 1,
      send(value: string) { messages.push(JSON.parse(value) as Record<string, unknown>); },
      close(code: number, reason: string) { closes.push([code, reason]); },
    } as unknown as WebSocket,
  });
  useFileDataStore.getState().setDirty('file-viewer', 'note.md', true);
  const firstCompletion = useFileDataStore.getState().saveFile(
    'file-viewer', 'note.md', 'first A', 'manual',
  );
  const observedFailure = firstCompletion.catch((error: unknown) => error);

  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-B', EPOCH_B, null);
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-B');
  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-A', EPOCH_A2, null);
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A');
  useFileDataStore.getState().handleLegacySaveResponse('file-viewer', 'note.md', true);

  await expect(observedFailure).resolves.toBeInstanceOf(Error);
  await expect(useFileDataStore.getState().saveFile(
    'file-viewer', 'note.md', 'second A', 'manual',
  )).rejects.toThrow('must reconnect');
  expect(messages).toHaveLength(1);
  expect(closes).toEqual([
    [1011, 'legacy save correlation retired'],
    [1011, 'legacy save correlation retired'],
  ]);

  useFileDataStore.getState().retirePendingSaves();
  const replacement = useFileDataStore.getState().saveFile(
    'file-viewer', 'note.md', 'second A', 'manual',
  );
  expect(messages).toHaveLength(2);
  useFileDataStore.getState().handleLegacySaveResponse('file-viewer', 'note.md', true);
  await expect(replacement).resolves.toBeUndefined();
});

test('an in-flight autosave serializes rather than suppresses a required milestone', async () => {
  const messages: Array<Record<string, unknown>> = [];
  resetStores(messages);
  const autosave = useFileDataStore.getState().saveFile(
    'office-viewer', 'report.md', 'latest', 'autosave',
  );
  const milestone = useFileDataStore.getState().saveFile(
    'office-viewer', 'report.md', 'latest', 'milestone', 'export_pdf',
  );
  expect(messages).toHaveLength(1);
  const first = messages[0] as unknown as PendingFileSaveV1;
  expect(first).toMatchObject({ reason: 'autosave' });
  expect(useFileDataStore.getState().handleSaveResponseV1(success(first))).toBe(true);
  await autosave;
  await Promise.resolve();
  expect(messages).toHaveLength(2);
  const second = messages[1] as unknown as PendingFileSaveV1 & { reason: string; milestone: string };
  expect(second).toMatchObject({ reason: 'milestone', milestone: 'export_pdf' });
  expect(useFileDataStore.getState().handleSaveResponseV1(success(second))).toBe(true);
  await milestone;
});

test('outcome-unknown and transport send failure preserve dirty state and reject completion', async () => {
  const messages: Array<Record<string, unknown>> = [];
  resetStores(messages);
  useFileDataStore.getState().setDirty('file-viewer', 'unknown.md', true);
  const uncertain = useFileDataStore.getState().saveFile(
    'file-viewer', 'unknown.md', 'latest', 'manual',
  );
  const request = messages[0] as unknown as PendingFileSaveV1;
  const succeeded = success(request);
  const outcomeUnknown: FileSaveResponseV1 = {
    ...succeeded,
    success: false,
    outcome: 'outcome_unknown',
    errorCode: 'mutation_outcome_unknown',
    error: 'The save outcome is uncertain and requires reconciliation.',
    retrySafe: false,
    resourceFactState: 'not_emitted',
    ledgerState: 'not_applicable',
  };
  delete (outcomeUnknown as Partial<FileSaveSucceededResponseV1>).provenanceState;
  delete (outcomeUnknown as Partial<FileSaveSucceededResponseV1>).checkpointState;
  expect(useFileDataStore.getState().handleSaveResponseV1(outcomeUnknown)).toBe(true);
  await expect(uncertain).rejects.toThrow('uncertain');
  expect(useFileDataStore.getState().dirtyFlags['file-viewer:unknown.md']).toBe(true);

  usePanelStore.setState({ ws: { readyState: 0 } as WebSocket });
  useFileDataStore.getState().setDirty('file-viewer', 'offline.md', true);
  await expect(useFileDataStore.getState().saveFile(
    'file-viewer', 'offline.md', 'latest', 'manual',
  )).rejects.toThrow('connection is unavailable');
  expect(useFileDataStore.getState().dirtyFlags['file-viewer:offline.md']).toBe(true);
  expect(useFileDataStore.getState().pendingSaves.size).toBe(0);
});

test('throwing WebSocket sends reject and remove pending v1 and legacy saves', async () => {
  const messages: Array<Record<string, unknown>> = [];
  resetStores(messages);
  usePanelStore.setState({
    ws: {
      readyState: 1,
      send() { throw new Error('transport exploded'); },
    } as unknown as WebSocket,
  });
  await expect(useFileDataStore.getState().saveFile(
    'file-viewer', 'v1.md', 'body', 'manual',
  )).rejects.toThrow('connection is unavailable');
  expect(useFileDataStore.getState().pendingSaves.size).toBe(0);

  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-A', EPOCH_A1, null);
  await expect(useFileDataStore.getState().saveFile(
    'file-viewer', 'legacy.md', 'body', 'manual',
  )).rejects.toThrow('connection is unavailable');
  expect(useFileDataStore.getState().pendingSaves.size).toBe(0);
});

test('document milestone callers clear dirty state only after correlated acknowledgement', async () => {
  let rejectSave!: (error: Error) => void;
  const messages: Array<Record<string, unknown>> = [];
  const localDirtyTransitions: boolean[] = [];
  resetStores(messages);
  useFileDataStore.getState().setDirty('email-viewer', 'draft.md', true);
  const saving = saveAcknowledgedMilestone({
    panel: 'email-viewer', path: 'draft.md', content: 'latest', milestone: 'send_pdf',
    saveFile: useFileDataStore.getState().saveFile,
    setLocalDirty: (dirty) => { localDirtyTransitions.push(dirty); },
  });
  const outbound = messages[0] as unknown as PendingFileSaveV1 & { reason: string; milestone: string };
  expect(outbound).toMatchObject({
    type: 'file_save', version: 1, panel: 'email-viewer', path: 'draft.md', content: 'latest',
    reason: 'milestone', milestone: 'send_pdf',
  });
  expect(localDirtyTransitions).toEqual([]);
  expect(useFileDataStore.getState().dirtyFlags['email-viewer:draft.md']).toBe(true);
  expect(useFileDataStore.getState().handleSaveResponseV1(success(outbound))).toBe(true);
  await saving;
  expect(localDirtyTransitions).toEqual([false]);
  expect(useFileDataStore.getState().dirtyFlags['email-viewer:draft.md']).toBeUndefined();

  localDirtyTransitions.length = 0;
  const failed = saveAcknowledgedMilestone({
    panel: 'office-viewer', path: 'report.md', content: 'latest', milestone: 'print',
    saveFile: () => new Promise<void>((_resolve, reject) => { rejectSave = reject; }),
    setLocalDirty: (dirty) => { localDirtyTransitions.push(dirty); },
  });
  rejectSave(new Error('rejected'));
  await expect(failed).rejects.toThrow('rejected');
  expect(localDirtyTransitions).toEqual([]);
});

test('document milestone acknowledgement does not clear a newer editor revision', async () => {
  const messages: Array<Record<string, unknown>> = [];
  const localDirtyTransitions: boolean[] = [];
  resetStores(messages);
  useFileDataStore.getState().setDirty('email-viewer', 'draft.md', true);
  const saving = saveAcknowledgedMilestone({
    panel: 'email-viewer', path: 'draft.md', content: 'revision one', milestone: 'print',
    saveFile: useFileDataStore.getState().saveFile,
    setLocalDirty: (dirty) => { localDirtyTransitions.push(dirty); },
  });
  const outbound = messages[0] as unknown as PendingFileSaveV1;
  useFileDataStore.getState().setDirty('email-viewer', 'draft.md', true);
  expect(useFileDataStore.getState().handleSaveResponseV1(success(outbound))).toBe(true);
  await saving;
  expect(localDirtyTransitions).toEqual([]);
  expect(useFileDataStore.getState().dirtyFlags['email-viewer:draft.md']).toBe(true);
});
