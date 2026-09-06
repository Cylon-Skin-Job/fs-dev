/**
 * @module fileDataStore
 * @role Central cache for file trees and file content across all workspaces
 *
 * Single source of truth for file data fetched via WebSocket.
 * Components read from this store instead of managing their own WS listeners.
 *
 * Cache keys: "${panel}:${path}" for both trees and content.
 * Invalidation: file_changed events clear the affected entries and re-fetch.
 */

import { create } from 'zustand';
import { usePanelStore } from './panelStore';
import { useWorkspaceStore } from './workspaceStore';
import {
  createFileSaveRequestV1,
  isFileSaveResponseV1,
  responseMatchesPendingFileSave,
  type PendingFileSaveV1,
} from '../lib/ws/file-save-protocol';
import {
  createFileContentRequestV1,
  createFileTreeRequestV1,
} from '../lib/ws/file-viewer-read-protocol';
import type {
  FileContentResponseV1,
  FileSaveResponseV1,
  FileTreeResponseV1,
  ResourceChangedMessage,
  ResourceRefreshRequiredV1,
} from '../types/file-explorer';
import {
  cacheKey,
  correlationsMatch,
  createRequestCorrelation,
  findPendingByRequestId,
  parentFolder,
  resourceProjectionFingerprint,
  responsePair,
  trimDedupe,
  type FileRequestCorrelation,
  type FileResponseCorrelation,
  type FileTreeRequestCorrelation,
  type FileTreeRequestRepresentation,
  type ProjectionResult,
} from './file-data-read-model';

export type {
  FileRequestCorrelation,
  FileResponseCorrelation,
  FileTreeRequestCorrelation,
  FileTreeRequestRepresentation,
  ProjectionResult,
} from './file-data-read-model';

// --- Types ---

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
  hasChildren?: boolean;
  isSymlink?: boolean;
  symlinkTarget?: string;
}

export interface FileWithContent extends FileNode {
  content: string;
}

export interface FileResourceMetadata {
  isSymlink?: boolean;
  symlinkTarget?: string;
  size?: number;
  lastModified?: number;
}

export type SaveReason = 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';

// --- Store ---

interface FileDataState {
  /** Active workspace data generation. Advanced on every settled workspace change. */
  generation: number;
  workspaceId: string | null;
  workspaceEpoch: string | null;
  /** Cached file tree listings: key = "panel:folder" */
  trees: Record<string, FileNode[]>;
  /** Cached file content: key = "panel:path" */
  contents: Record<string, string>;
  /** Metadata for fetched tree roots and file content: key = "panel:path" */
  treeMetadata: Record<string, FileResourceMetadata>;
  contentMetadata: Record<string, FileResourceMetadata>;
  /** Per-tree File Viewer read representation retained across invalidation/rebind. */
  fileViewerTreeRepresentations: Map<string, FileTreeRequestRepresentation>;
  /** Representation inherited by a File Viewer tree key on its first request. */
  fileViewerDefaultTreeRepresentation: FileTreeRequestRepresentation;
  /** File Viewer content paths that must remain refreshable across failed sends/rebind. */
  fileViewerContentInterests: Set<string>;
  /** In-flight tree requests (prevents duplicate sends) */
  pendingTrees: Map<string, FileTreeRequestCorrelation>;
  /** In-flight content requests (prevents duplicate sends) */
  pendingContents: Map<string, FileRequestCorrelation>;
  /** Matching request failures, cleared by a later request/generation. */
  treeErrors: Record<string, string>;
  contentErrors: Record<string, string>;
  /** Dirty flags: key = "panel:path" -> true if unsaved */
  dirtyFlags: Record<string, boolean>;
  /** Monotonic local-edit revision for each document cache key. */
  dirtyRevisions: Record<string, number>;
  /** In-flight save requests (prevents duplicate sends) */
  pendingSaves: Map<string, PendingFileSave>;
  /** Legacy keys retired during a workspace switch until the socket is replaced. */
  retiredLegacySaveKeys: Set<string>;
  /** Bounded exact/conflict memory for canonical resource event + operation identities. */
  resourceProjectionDedupe: Map<string, string>;

  // --- Actions called by ws-client ---
  handleTreeResponse: (
    panel: string,
    path: string,
    nodes: FileNode[],
    metadata?: FileResourceMetadata,
    response?: FileResponseCorrelation,
  ) => boolean;
  handleContentResponse: (
    panel: string,
    path: string,
    content: string,
    metadata?: FileResourceMetadata,
    response?: FileResponseCorrelation,
  ) => boolean;
  handleLegacySaveResponse: (panel: string, path: string, success: boolean, error?: string) => void;
  handleSaveResponseV1: (response: FileSaveResponseV1) => boolean;
  handleTreeResponseV1: (response: FileTreeResponseV1) => boolean;
  handleContentResponseV1: (response: FileContentResponseV1) => boolean;
  handleResourceChanged: (message: ResourceChangedMessage) => ProjectionResult;
  handleResourceRefreshRequired: (message: ResourceRefreshRequiredV1) => boolean;
  applyTargetedProjection: (path: string) => void;

  // --- Actions called by components ---
  requestTree: (
    panel: string,
    folder: string,
    options?: { includeHiddenFolders?: boolean; force?: boolean },
  ) => string | null;
  requestContent: (panel: string, path: string, options?: { force?: boolean }) => string | null;
  /** Adopt one hidden-folder representation for every known File Viewer tree interest. */
  setFileViewerTreeRepresentation: (includeHiddenFolders: boolean) => void;
  /** Clear File Viewer display errors without introducing presentation-owned copies. */
  clearFileViewerErrors: () => void;
  /** 04c calls this when the last File Viewer consumer closes an exact clean path. */
  releaseFileViewerContent: (path: string) => boolean;
  setDirty: (panel: string, path: string, dirty: boolean) => void;
  saveFile: (
    panel: string,
    path: string,
    content: string,
    reason?: SaveReason,
    milestone?: string,
    capturedDirtyRevision?: number,
  ) => Promise<void>;

  // --- Invalidation (called by file_changed handler) ---
  invalidate: (panel: string, filePath: string) => void;
  invalidateTree: (panel: string, folder: string) => void;

  // --- Workspace generation lifecycle ---
  beginWorkspaceGeneration: (workspaceId: string | null, workspaceEpoch?: string | null) => void;
  retirePendingSaves: () => void;

  // --- Full reset (e.g. on reconnect) ---
  clearAll: () => void;
}

export interface PendingLegacyFileSave {
  mode: 'legacy';
  requestId: string;
  panel: string;
  path: string;
}

interface PendingFileSaveCompletion {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

export type PendingFileSave = (PendingLegacyFileSave | PendingFileSaveV1) & PendingFileSaveCompletion & {
  dirtyRevision: number;
};

function createSaveCompletion(): PendingFileSaveCompletion {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function saveFailure(message?: string): Error {
  return new Error(message || 'The file could not be saved.');
}

let nextLegacySaveId = 0;

const MAX_RESOURCE_DEDUPE_KEYS = 8192;

function sendWs(msg: Record<string, unknown>): boolean {
  const ws = usePanelStore.getState().ws;
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export const useFileDataStore = create<FileDataState>((set, get) => ({
  generation: 0,
  workspaceId: null,
  workspaceEpoch: null,
  trees: {},
  contents: {},
  treeMetadata: {},
  contentMetadata: {},
  fileViewerTreeRepresentations: new Map(),
  fileViewerDefaultTreeRepresentation: { includeHiddenFolders: false },
  fileViewerContentInterests: new Set(),
  pendingTrees: new Map(),
  pendingContents: new Map(),
  treeErrors: {},
  contentErrors: {},
  dirtyFlags: {},
  dirtyRevisions: {},
  pendingSaves: new Map(),
  retiredLegacySaveKeys: new Set(),
  resourceProjectionDedupe: new Map(),

  handleTreeResponse: (panel, path, nodes, metadata, response) => {
    const key = cacheKey(panel, path);
    if (response) {
      const state = get();
      if (!correlationsMatch(state.pendingTrees.get(key), response, state)) return false;
    }
    set((s) => {
      const pending = new Map(s.pendingTrees);
      pending.delete(key);
      const treeErrors = { ...s.treeErrors };
      const treeMetadata = { ...s.treeMetadata };
      if (response && !response.success) {
        treeErrors[key] = response.error || 'Unable to load folder';
        delete treeMetadata[key];
      } else {
        delete treeErrors[key];
        if (metadata) treeMetadata[key] = metadata;
        else delete treeMetadata[key];
      }
      const trees = { ...s.trees };
      if (response && !response.success) delete trees[key];
      else trees[key] = nodes;
      return {
        trees,
        treeMetadata,
        pendingTrees: pending,
        treeErrors,
      };
    });
    return true;
  },

  handleContentResponse: (panel, path, content, metadata, response) => {
    const key = cacheKey(panel, path);
    if (response) {
      const state = get();
      if (!correlationsMatch(state.pendingContents.get(key), response, state)) return false;
    }
    set((s) => {
      const pending = new Map(s.pendingContents);
      pending.delete(key);
      const contents = { ...s.contents };
      const contentErrors = { ...s.contentErrors };
      const contentMetadata = { ...s.contentMetadata };
      if (response && !response.success) {
        delete contents[key];
        contentErrors[key] = response.error || 'Unable to load file';
        delete contentMetadata[key];
      } else {
        contents[key] = content;
        delete contentErrors[key];
        if (metadata) contentMetadata[key] = metadata;
        else delete contentMetadata[key];
      }
      return {
        contents,
        contentMetadata,
        pendingContents: pending,
        contentErrors,
      };
    });
    return true;
  },

  handleTreeResponseV1: (response) => {
    const matched = findPendingByRequestId(get().pendingTrees, response.requestId ?? '');
    const pair = responsePair(response);
    if (!matched || !pair) return false;
    const [key, pending] = matched;
    const state = get();
    if (
      pending.requestId !== response.requestId
      || pending.localGeneration !== state.generation
      || pending.workspaceId !== pair.workspaceId
      || pending.workspaceEpoch !== pair.workspaceEpoch
      || state.workspaceId !== pair.workspaceId
      || state.workspaceEpoch !== pair.workspaceEpoch
    ) return false;
    const panel = 'file-viewer';
    const requestPath = key.slice(panel.length + 1);
    if ('panel' in response && (response.panel !== panel || response.path !== requestPath)) return false;
    return get().handleTreeResponse(
      panel,
      requestPath,
      response.success ? response.nodes : [],
      response.success && response.isSymlink === true
        ? { isSymlink: true, symlinkTarget: response.symlinkTarget }
        : undefined,
      {
        ...pending,
        success: response.success,
        error: response.success ? undefined : response.error,
      },
    );
  },

  handleContentResponseV1: (response) => {
    const matched = findPendingByRequestId(get().pendingContents, response.requestId ?? '');
    const pair = responsePair(response);
    if (!matched || !pair) return false;
    const [key, pending] = matched;
    const state = get();
    if (
      pending.requestId !== response.requestId
      || pending.localGeneration !== state.generation
      || pending.workspaceId !== pair.workspaceId
      || pending.workspaceEpoch !== pair.workspaceEpoch
      || state.workspaceId !== pair.workspaceId
      || state.workspaceEpoch !== pair.workspaceEpoch
    ) return false;
    const panel = 'file-viewer';
    const requestPath = key.slice(panel.length + 1);
    if ('panel' in response && (response.panel !== panel || response.path !== requestPath)) return false;
    return get().handleContentResponse(
      panel,
      requestPath,
      response.success ? response.content : '',
      response.success && response.isSymlink === true
        ? {
            isSymlink: true,
            symlinkTarget: response.symlinkTarget,
            size: response.size,
            lastModified: response.lastModified,
          }
        : response.success
          ? { size: response.size, lastModified: response.lastModified }
          : undefined,
      {
        ...pending,
        success: response.success,
        error: response.success ? undefined : response.error,
      },
    );
  },

  handleResourceChanged: (message) => {
    const state = get();
    if (message.workspaceId !== state.workspaceId || message.workspaceEpoch !== state.workspaceEpoch) {
      return 'stale';
    }
    const fingerprint = resourceProjectionFingerprint(message);
    const keys = message.version === 2
      ? [`projection:${message.projectionId}`]
      : [`event:${message.eventId}`, `operation:${message.operationId}`];
    for (const key of keys) {
      const prior = state.resourceProjectionDedupe.get(key);
      if (prior !== undefined && prior !== fingerprint) return 'conflict';
    }
    if (keys.every((key) => state.resourceProjectionDedupe.get(key) === fingerprint)) {
      return 'duplicate';
    }
    set((current) => {
      const resourceProjectionDedupe = new Map(current.resourceProjectionDedupe);
      for (const key of keys) resourceProjectionDedupe.set(key, fingerprint);
      trimDedupe(resourceProjectionDedupe, MAX_RESOURCE_DEDUPE_KEYS);
      return { resourceProjectionDedupe };
    });
    get().applyTargetedProjection(message.path);
    return 'applied';
  },

  handleResourceRefreshRequired: (message) => {
    const state = get();
    if (message.workspaceId !== state.workspaceId || message.workspaceEpoch !== state.workspaceEpoch) {
      return false;
    }
    get().applyTargetedProjection(message.path);
    return true;
  },

  applyTargetedProjection: (path) => {
    const panel = 'file-viewer';
    const contentKey = cacheKey(panel, path);
    const folder = parentFolder(path);
    const treeKey = cacheKey(panel, folder);
    const before = get();
    const contentWasRequested = before.contents[contentKey] !== undefined
      || before.pendingContents.has(contentKey)
      || before.fileViewerContentInterests.has(contentKey);

    set((s) => {
      const trees = { ...s.trees };
      const contents = { ...s.contents };
      const treeMetadata = { ...s.treeMetadata };
      const contentMetadata = { ...s.contentMetadata };
      const treeErrors = { ...s.treeErrors };
      const contentErrors = { ...s.contentErrors };
      const pendingTrees = new Map(s.pendingTrees);
      const pendingContents = new Map(s.pendingContents);
      delete trees[treeKey];
      delete contents[contentKey];
      delete treeMetadata[treeKey];
      delete contentMetadata[contentKey];
      delete treeErrors[treeKey];
      delete contentErrors[contentKey];
      pendingTrees.delete(treeKey);
      pendingContents.delete(contentKey);
      return {
        trees,
        contents,
        treeMetadata,
        contentMetadata,
        treeErrors,
        contentErrors,
        pendingTrees,
        pendingContents,
      };
    });

    get().requestTree(panel, folder);
    if (contentWasRequested) {
      get().requestContent(panel, path);
    }
  },

  handleLegacySaveResponse: (panel, path, success, error) => {
    const key = cacheKey(panel, path);
    const match = Array.from(get().pendingSaves.values()).find(
      (pending) => pending.mode === 'legacy' && pending.panel === panel && pending.path === path,
    );
    if (!match) return;
    set((s) => {
      const pending = new Map(s.pendingSaves);
      pending.delete(match.requestId);
      const dirtyFlags = { ...s.dirtyFlags };
      if (success && s.dirtyRevisions[key] === match.dirtyRevision) delete dirtyFlags[key];
      return { pendingSaves: pending, dirtyFlags };
    });
    if (success) match.resolve();
    else match.reject(saveFailure(error));
  },

  handleSaveResponseV1: (response) => {
    if (!isFileSaveResponseV1(response)) return false;
    const pending = response.requestId ? get().pendingSaves.get(response.requestId) : undefined;
    if (!pending || pending.mode !== 'v1') return false;
    const workspace = useWorkspaceStore.getState();
    const current = workspace.activeWorkspaceId && workspace.workspaceEpoch
      ? { workspaceId: workspace.activeWorkspaceId, workspaceEpoch: workspace.workspaceEpoch }
      : null;
    if (!responseMatchesPendingFileSave(pending, response, current)) return false;

    const key = cacheKey(pending.panel, pending.path);
    set((s) => {
      const pendingSaves = new Map(s.pendingSaves);
      pendingSaves.delete(pending.requestId);
      const dirtyFlags = { ...s.dirtyFlags };
      if (response.success && s.dirtyRevisions[key] === pending.dirtyRevision) delete dirtyFlags[key];
      return { pendingSaves, dirtyFlags };
    });
    if (response.success) pending.resolve();
    else pending.reject(saveFailure(response.error));
    return true;
  },

  setDirty: (panel, path, dirty) => {
    const key = cacheKey(panel, path);
    set((s) => {
      const dirtyFlags = { ...s.dirtyFlags };
      const dirtyRevisions = { ...s.dirtyRevisions };
      if (dirty) {
        dirtyFlags[key] = true;
        dirtyRevisions[key] = (dirtyRevisions[key] ?? 0) + 1;
      } else {
        delete dirtyFlags[key];
      }
      return { dirtyFlags, dirtyRevisions };
    });
  },

  saveFile: (panel, path, content, reason, milestone, capturedDirtyRevision) => {
    const key = cacheKey(panel, path);
    const dirtyRevision = capturedDirtyRevision ?? get().dirtyRevisions[key] ?? 0;
    const existing = Array.from(get().pendingSaves.values()).find(
      (pending) => pending.panel === panel && pending.path === path,
    );
    if (existing) {
      // Milestones are durable workflow boundaries and may not be silently
      // swallowed by an in-flight autosave. Serialize them after that save.
      if (reason === 'milestone') {
        return existing.promise.then(() => (
          get().saveFile(panel, path, content, reason, milestone, dirtyRevision)
        ));
      }
      return existing.promise;
    }

    const workspace = useWorkspaceStore.getState();
    if (workspace.fileSaveProtocolVersion === 1) {
      if (!workspace.activeWorkspaceId || !workspace.workspaceEpoch) {
        return Promise.reject(saveFailure('The workspace is not available.'));
      }
      const payload = createFileSaveRequestV1({
        workspaceId: workspace.activeWorkspaceId,
        workspaceEpoch: workspace.workspaceEpoch,
        panel,
        path,
        content,
        reason,
        milestone,
      });
      const completion = createSaveCompletion();
      const pendingSave: PendingFileSave = {
        mode: 'v1',
        requestId: payload.requestId,
        workspaceId: payload.workspaceId,
        workspaceEpoch: payload.workspaceEpoch,
        panel,
        path,
        dirtyRevision,
        ...completion,
      };
      set((s) => ({ pendingSaves: new Map(s.pendingSaves).set(payload.requestId, pendingSave) }));
      if (!sendWs(payload as unknown as Record<string, unknown>)) {
        set((s) => {
          const pendingSaves = new Map(s.pendingSaves);
          pendingSaves.delete(payload.requestId);
          return { pendingSaves };
        });
        completion.reject(saveFailure('The save connection is unavailable.'));
      }
      return completion.promise;
    }

    if (get().retiredLegacySaveKeys.has(key)) {
      const ws = usePanelStore.getState().ws;
      try { ws?.close(1011, 'legacy save correlation retired'); } catch { /* best effort */ }
      return Promise.reject(saveFailure('The save connection must reconnect before saving.'));
    }

    nextLegacySaveId += 1;
    const requestId = `legacy-file-save-${nextLegacySaveId}`;
    const completion = createSaveCompletion();
    const pendingSave: PendingFileSave = {
      mode: 'legacy', requestId, panel, path, dirtyRevision, ...completion,
    };
    set((s) => ({ pendingSaves: new Map(s.pendingSaves).set(requestId, pendingSave) }));
    const payload: Record<string, unknown> = { type: 'file_save', panel, path, content };
    if (reason) payload.reason = reason;
    if (milestone) payload.milestone = milestone;
    if (!sendWs(payload)) {
      set((s) => {
        const pendingSaves = new Map(s.pendingSaves);
        pendingSaves.delete(requestId);
        return { pendingSaves };
      });
      completion.reject(saveFailure('The save connection is unavailable.'));
    }
    return completion.promise;
  },

  requestTree: (panel, folder, options) => {
    const key = cacheKey(panel, folder);
    const initialState = get();
    const priorRepresentation = initialState.fileViewerTreeRepresentations.get(key);
    const representation: FileTreeRequestRepresentation | undefined = panel === 'file-viewer'
      ? (typeof options?.includeHiddenFolders === 'boolean'
        ? { includeHiddenFolders: options.includeHiddenFolders }
        : priorRepresentation ?? initialState.fileViewerDefaultTreeRepresentation)
      : undefined;
    const representationChanged = panel === 'file-viewer'
      && typeof options?.includeHiddenFolders === 'boolean'
      && priorRepresentation?.includeHiddenFolders !== options.includeHiddenFolders;

    // A File Viewer representation change is a local canonical invalidation.
    // Retain the new representation even if transport/binding is unavailable,
    // and never keep rendering a tree fetched under the opposite preference.
    if (representationChanged && representation) {
      set((s) => {
        const trees = { ...s.trees };
        const treeMetadata = { ...s.treeMetadata };
        const treeErrors = { ...s.treeErrors };
        const pendingTrees = new Map(s.pendingTrees);
        const fileViewerTreeRepresentations = new Map(s.fileViewerTreeRepresentations);
        delete trees[key];
        delete treeMetadata[key];
        delete treeErrors[key];
        pendingTrees.delete(key);
        fileViewerTreeRepresentations.set(key, representation);
        return {
          trees,
          treeMetadata,
          treeErrors,
          pendingTrees,
          fileViewerTreeRepresentations,
        };
      });
    }

    const state = get();
    // Already cached or in-flight under the same representation — skip.
    if (!options?.force && !representationChanged && (state.trees[key] || state.pendingTrees.has(key))) {
      return null;
    }
    if (panel === 'file-viewer') {
      const workspace = useWorkspaceStore.getState();
      if (
        workspace.fileViewerReadProtocolVersion !== 1
        || !workspace.activeWorkspaceId
        || !workspace.workspaceEpoch
        || state.workspaceId !== workspace.activeWorkspaceId
        || state.workspaceEpoch !== workspace.workspaceEpoch
      ) return null;
    }
    const correlation: FileTreeRequestCorrelation = {
      ...createRequestCorrelation(state),
      ...representation,
    };
    set((s) => {
      const pending = new Map(s.pendingTrees);
      const treeErrors = { ...s.treeErrors };
      const fileViewerTreeRepresentations = new Map(s.fileViewerTreeRepresentations);
      pending.set(key, correlation);
      if (representation) fileViewerTreeRepresentations.set(key, representation);
      delete treeErrors[key];
      return { pendingTrees: pending, treeErrors, fileViewerTreeRepresentations };
    });
    const payload = panel === 'file-viewer'
      ? createFileTreeRequestV1({
        requestId: correlation.requestId,
        workspaceId: correlation.workspaceId as string,
        workspaceEpoch: correlation.workspaceEpoch as string,
        path: folder,
        includeHiddenFolders: correlation.includeHiddenFolders,
      })
      : {
        type: 'file_tree_request' as const,
        panel,
        path: folder,
        requestId: correlation.requestId,
        workspaceId: correlation.workspaceId,
        generation: correlation.localGeneration,
      };
    if (!sendWs(payload as unknown as Record<string, unknown>)) {
      set((s) => {
        if (s.pendingTrees.get(key)?.requestId !== correlation.requestId) return {};
        const pending = new Map(s.pendingTrees);
        pending.delete(key);
        return { pendingTrees: pending };
      });
      return null;
    }
    return correlation.requestId;
  },

  requestContent: (panel, path, options) => {
    const key = cacheKey(panel, path);
    const state = get();
    if (!options?.force && (state.contents[key] !== undefined || state.pendingContents.has(key))) return null;
    if (panel === 'file-viewer') {
      const workspace = useWorkspaceStore.getState();
      if (
        workspace.fileViewerReadProtocolVersion !== 1
        || !workspace.activeWorkspaceId
        || !workspace.workspaceEpoch
        || state.workspaceId !== workspace.activeWorkspaceId
        || state.workspaceEpoch !== workspace.workspaceEpoch
      ) return null;
    }
    const correlation = createRequestCorrelation(state);
    set((s) => {
      const pending = new Map(s.pendingContents);
      const contentErrors = { ...s.contentErrors };
      const fileViewerContentInterests = new Set(s.fileViewerContentInterests);
      pending.set(key, correlation);
      if (panel === 'file-viewer') fileViewerContentInterests.add(key);
      delete contentErrors[key];
      return { pendingContents: pending, contentErrors, fileViewerContentInterests };
    });
    const payload = panel === 'file-viewer'
      ? createFileContentRequestV1({
        requestId: correlation.requestId,
        workspaceId: correlation.workspaceId as string,
        workspaceEpoch: correlation.workspaceEpoch as string,
        path,
      })
      : {
        type: 'file_content_request' as const,
        panel,
        path,
        requestId: correlation.requestId,
        workspaceId: correlation.workspaceId,
        generation: correlation.localGeneration,
      };
    if (!sendWs(payload as unknown as Record<string, unknown>)) {
      set((s) => {
        if (s.pendingContents.get(key)?.requestId !== correlation.requestId) return {};
        const pending = new Map(s.pendingContents);
        pending.delete(key);
        return { pendingContents: pending };
      });
      return null;
    }
    return correlation.requestId;
  },

  setFileViewerTreeRepresentation: (includeHiddenFolders) => set((s) => {
    const trees = { ...s.trees };
    const treeMetadata = { ...s.treeMetadata };
    const treeErrors = { ...s.treeErrors };
    const pendingTrees = new Map(s.pendingTrees);
    const fileViewerTreeRepresentations = new Map(s.fileViewerTreeRepresentations);
    const knownKeys = new Set([
      ...Object.keys(trees).filter((key) => key.startsWith('file-viewer:')),
      ...Array.from(pendingTrees.keys()).filter((key) => key.startsWith('file-viewer:')),
      ...Array.from(fileViewerTreeRepresentations.keys()).filter((key) => key.startsWith('file-viewer:')),
    ]);
    for (const key of knownKeys) {
      if (fileViewerTreeRepresentations.get(key)?.includeHiddenFolders === includeHiddenFolders) {
        continue;
      }
      delete trees[key];
      delete treeMetadata[key];
      delete treeErrors[key];
      pendingTrees.delete(key);
      fileViewerTreeRepresentations.set(key, { includeHiddenFolders });
    }
    return {
      trees,
      treeMetadata,
      treeErrors,
      pendingTrees,
      fileViewerTreeRepresentations,
      fileViewerDefaultTreeRepresentation: { includeHiddenFolders },
    };
  }),

  clearFileViewerErrors: () => set((s) => {
    const treeErrors = { ...s.treeErrors };
    const contentErrors = { ...s.contentErrors };
    for (const key of Object.keys(treeErrors)) {
      if (key.startsWith('file-viewer:')) delete treeErrors[key];
    }
    for (const key of Object.keys(contentErrors)) {
      if (key.startsWith('file-viewer:')) delete contentErrors[key];
    }
    return { treeErrors, contentErrors };
  }),

  releaseFileViewerContent: (path) => {
    const key = cacheKey('file-viewer', path);
    if (get().dirtyFlags[key]) return false;
    set((s) => {
      const fileViewerContentInterests = new Set(s.fileViewerContentInterests);
      const pendingContents = new Map(s.pendingContents);
      const contents = { ...s.contents };
      const contentMetadata = { ...s.contentMetadata };
      fileViewerContentInterests.delete(key);
      pendingContents.delete(key);
      delete contents[key];
      delete contentMetadata[key];
      return {
        fileViewerContentInterests,
        pendingContents,
        contents,
        contentMetadata,
      };
    });
    return true;
  },

  invalidate: (panel, filePath) => {
    const state = get();
    const contentKey = cacheKey(panel, filePath);
    const parent = parentFolder(filePath);
    const treesToInvalidate: string[] = [];

    // Find cached folders that contain this path, are the path itself, or are
    // descendants of a mutated folder.
    for (const key of Object.keys(state.trees)) {
      if (!key.startsWith(`${panel}:`)) continue;
      const folder = key.slice(panel.length + 1);
      if (
        folder === parent ||
        filePath === folder ||
        (folder !== '' && filePath.startsWith(`${folder}/`)) ||
        (filePath !== '' && folder.startsWith(`${filePath}/`))
      ) {
        treesToInvalidate.push(key);
      }
    }

    set((s) => {
      const trees = { ...s.trees };
      const contents = { ...s.contents };
      const treeMetadata = { ...s.treeMetadata };
      const contentMetadata = { ...s.contentMetadata };
      const treeErrors = { ...s.treeErrors };
      const contentErrors = { ...s.contentErrors };
      for (const key of treesToInvalidate) {
        delete trees[key];
        delete treeMetadata[key];
        delete treeErrors[key];
      }
      delete contents[contentKey];
      delete contentMetadata[contentKey];
      delete contentErrors[contentKey];
      return { trees, contents, treeMetadata, contentMetadata, treeErrors, contentErrors };
    });

    // Re-fetch invalidated trees
    for (const key of treesToInvalidate) {
      const folder = key.slice(panel.length + 1);
      get().requestTree(panel, folder);
    }

    // Re-fetch content if it was cached
    if (state.contents[contentKey] !== undefined) {
      get().requestContent(panel, filePath);
    }
  },

  invalidateTree: (panel, folder) => {
    const key = cacheKey(panel, folder);
    set((s) => {
      const trees = { ...s.trees };
      const treeMetadata = { ...s.treeMetadata };
      const treeErrors = { ...s.treeErrors };
      delete trees[key];
      delete treeMetadata[key];
      delete treeErrors[key];
      return { trees, treeMetadata, treeErrors };
    });
    get().requestTree(panel, folder);
  },

  beginWorkspaceGeneration: (workspaceId, workspaceEpoch) => {
    const current = get();
    const nextEpoch = workspaceEpoch ?? useWorkspaceStore.getState().workspaceEpoch;
    const sameWorkspace = workspaceId !== null && workspaceId === current.workspaceId;
    const fileViewerTrees = sameWorkspace
      ? new Set([
        ...current.fileViewerTreeRepresentations.keys(),
        ...Object.keys(current.trees),
        ...current.pendingTrees.keys(),
      ].filter((key) => key.startsWith('file-viewer:')))
      : new Set<string>();
    const fileViewerContents = sameWorkspace
      ? new Set([
        ...current.fileViewerContentInterests,
        ...Object.keys(current.contents),
        ...current.pendingContents.keys(),
      ].filter((key) => key.startsWith('file-viewer:') && !current.dirtyFlags[key]))
      : new Set<string>();
    const retiredLegacySaveKeys = new Set(current.retiredLegacySaveKeys);
    let retiredLegacy = false;
    for (const pending of current.pendingSaves.values()) {
      if (pending.mode === 'legacy') {
        retiredLegacySaveKeys.add(cacheKey(pending.panel, pending.path));
        retiredLegacy = true;
      }
      pending.reject(saveFailure('The workspace changed before the save completed.'));
    }
    if (retiredLegacy) {
      const ws = usePanelStore.getState().ws;
      try { ws?.close(1011, 'legacy save correlation retired'); } catch { /* best effort */ }
    }
    set((s) => {
      const correlationReset = {
        generation: s.generation + 1,
        workspaceId,
        workspaceEpoch: nextEpoch,
        pendingTrees: new Map<string, FileTreeRequestCorrelation>(),
        pendingContents: new Map<string, FileRequestCorrelation>(),
        treeErrors: {},
        contentErrors: {},
        pendingSaves: new Map<string, PendingFileSave>(),
        retiredLegacySaveKeys,
        resourceProjectionDedupe: new Map<string, string>(),
      };
      // A replacement socket gets a fresh epoch even when it rebinds the same
      // workspace. Retire transport correlation, but preserve the user's local
      // dirty buffer and the cached content/navigation it belongs to.
      if (workspaceId !== null && workspaceId === s.workspaceId) {
        const trees = { ...s.trees };
        const contents = { ...s.contents };
        const treeMetadata = { ...s.treeMetadata };
        const contentMetadata = { ...s.contentMetadata };
        for (const key of Object.keys(trees)) {
          if (key.startsWith('file-viewer:')) delete trees[key];
        }
        for (const key of Object.keys(contents)) {
          if (key.startsWith('file-viewer:') && !s.dirtyFlags[key]) delete contents[key];
        }
        for (const key of Object.keys(treeMetadata)) {
          if (key.startsWith('file-viewer:')) delete treeMetadata[key];
        }
        for (const key of Object.keys(contentMetadata)) {
          if (key.startsWith('file-viewer:') && !s.dirtyFlags[key]) delete contentMetadata[key];
        }
        return { ...correlationReset, trees, contents, treeMetadata, contentMetadata };
      }
      return {
        ...correlationReset,
        trees: {},
        contents: {},
        treeMetadata: {},
        contentMetadata: {},
        fileViewerTreeRepresentations: new Map<string, FileTreeRequestRepresentation>(),
        fileViewerDefaultTreeRepresentation: { includeHiddenFolders: false },
        fileViewerContentInterests: new Set<string>(),
        dirtyFlags: {},
        dirtyRevisions: {},
      };
    });
    for (const key of fileViewerTrees) {
      get().requestTree('file-viewer', key.slice('file-viewer:'.length));
    }
    for (const key of fileViewerContents) {
      get().requestContent('file-viewer', key.slice('file-viewer:'.length));
    }
  },

  // A disconnected socket cannot complete an authoritative correlation.
  // Keep dirty/content/navigation state but retire every in-flight save.
  retirePendingSaves: () => {
    for (const pending of get().pendingSaves.values()) {
      pending.reject(saveFailure('The save connection closed before acknowledgment.'));
    }
    set({ pendingSaves: new Map(), retiredLegacySaveKeys: new Set() });
  },

  clearAll: () => set({
    trees: {},
    contents: {},
    treeMetadata: {},
    contentMetadata: {},
    fileViewerTreeRepresentations: new Map(),
    fileViewerDefaultTreeRepresentation: { includeHiddenFolders: false },
    fileViewerContentInterests: new Set(),
    pendingTrees: new Map(),
    pendingContents: new Map(),
    treeErrors: {},
    contentErrors: {},
    dirtyFlags: {},
    dirtyRevisions: {},
    pendingSaves: new Map(),
    retiredLegacySaveKeys: new Set(),
    resourceProjectionDedupe: new Map(),
  }),
}));
