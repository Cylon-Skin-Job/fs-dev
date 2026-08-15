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
import { showToast } from '../lib/toast';

// --- Types ---

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
  isSymlink?: boolean;
  symlinkTarget?: string;
}

export interface FileWithContent extends FileNode {
  content: string;
}

export interface FileResourceMetadata {
  isSymlink?: boolean;
  symlinkTarget?: string;
}

export type SaveReason = 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';

// --- Store ---

interface FileDataState {
  /** Active workspace data generation. Advanced on every settled workspace change. */
  generation: number;
  workspaceId: string | null;
  /** Cached file tree listings: key = "panel:folder" */
  trees: Record<string, FileNode[]>;
  /** Cached file content: key = "panel:path" */
  contents: Record<string, string>;
  /** Metadata for fetched tree roots and file content: key = "panel:path" */
  treeMetadata: Record<string, FileResourceMetadata>;
  contentMetadata: Record<string, FileResourceMetadata>;
  /** In-flight tree requests (prevents duplicate sends) */
  pendingTrees: Map<string, FileRequestCorrelation>;
  /** In-flight content requests (prevents duplicate sends) */
  pendingContents: Map<string, FileRequestCorrelation>;
  /** Matching request failures, cleared by a later request/generation. */
  treeErrors: Record<string, string>;
  contentErrors: Record<string, string>;
  /** Dirty flags: key = "panel:path" -> true if unsaved */
  dirtyFlags: Record<string, boolean>;
  /** In-flight save requests (prevents duplicate sends) */
  pendingSaves: Set<string>;

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
  handleSaveResponse: (panel: string, path: string, success: boolean, error?: string) => void;

  // --- Actions called by components ---
  requestTree: (panel: string, folder: string) => void;
  requestContent: (panel: string, path: string) => void;
  setDirty: (panel: string, path: string, dirty: boolean) => void;
  saveFile: (panel: string, path: string, content: string, reason?: SaveReason, milestone?: string) => void;

  // --- Invalidation (called by file_changed handler) ---
  invalidate: (panel: string, filePath: string) => void;
  invalidateTree: (panel: string, folder: string) => void;

  // --- Workspace generation lifecycle ---
  beginWorkspaceGeneration: (workspaceId: string | null) => void;

  // --- Full reset (e.g. on reconnect) ---
  clearAll: () => void;
}

export interface FileRequestCorrelation {
  requestId: string;
  workspaceId: string | null;
  generation: number;
}

export interface FileResponseCorrelation extends FileRequestCorrelation {
  success: boolean;
  error?: string;
}

function cacheKey(panel: string, path: string): string {
  return `${panel}:${path}`;
}

function parentFolder(filePath: string): string {
  return filePath.split('/').filter(Boolean).slice(0, -1).join('/');
}

let nextFileRequestId = 0;

function createRequestCorrelation(state: FileDataState): FileRequestCorrelation {
  nextFileRequestId += 1;
  return {
    requestId: `file-${state.generation}-${nextFileRequestId}`,
    workspaceId: state.workspaceId,
    generation: state.generation,
  };
}

function correlationsMatch(
  pending: FileRequestCorrelation | undefined,
  response: FileResponseCorrelation,
  state: FileDataState,
): boolean {
  return Boolean(
    pending
    && pending.requestId === response.requestId
    && pending.workspaceId === response.workspaceId
    && pending.generation === response.generation
    && response.workspaceId === state.workspaceId
    && response.generation === state.generation
  );
}

function sendWs(msg: Record<string, unknown>): boolean {
  const ws = usePanelStore.getState().ws;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

export const useFileDataStore = create<FileDataState>((set, get) => ({
  generation: 0,
  workspaceId: null,
  trees: {},
  contents: {},
  treeMetadata: {},
  contentMetadata: {},
  pendingTrees: new Map(),
  pendingContents: new Map(),
  treeErrors: {},
  contentErrors: {},
  dirtyFlags: {},
  pendingSaves: new Set(),

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
      } else if (metadata?.isSymlink === true) {
        delete treeErrors[key];
        treeMetadata[key] = {
          isSymlink: true,
          symlinkTarget: metadata.symlinkTarget,
        };
      } else {
        delete treeErrors[key];
        delete treeMetadata[key];
      }
      return {
        trees: { ...s.trees, [key]: nodes },
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
      } else if (metadata?.isSymlink === true) {
        contents[key] = content;
        delete contentErrors[key];
        contentMetadata[key] = {
          isSymlink: true,
          symlinkTarget: metadata.symlinkTarget,
        };
      } else {
        contents[key] = content;
        delete contentErrors[key];
        delete contentMetadata[key];
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

  handleSaveResponse: (panel, path, success, error) => {
    const key = cacheKey(panel, path);
    set((s) => {
      const pending = new Set(s.pendingSaves);
      pending.delete(key);
      const dirtyFlags = { ...s.dirtyFlags };
      if (success) delete dirtyFlags[key];
      return { pendingSaves: pending, dirtyFlags };
    });
    if (!success) {
      console.error(`[fileDataStore] Save failed for ${key}:`, error);
      showToast(`Save failed: ${error || 'Unknown error'}`);
    }
  },

  setDirty: (panel, path, dirty) => {
    const key = cacheKey(panel, path);
    set((s) => ({
      dirtyFlags: dirty
        ? { ...s.dirtyFlags, [key]: true }
        : Object.fromEntries(Object.entries(s.dirtyFlags).filter(([k]) => k !== key)),
    }));
  },

  saveFile: (panel, path, content, reason, milestone) => {
    const key = cacheKey(panel, path);
    if (get().pendingSaves.has(key)) return; // Skip if already in-flight
    set((s) => {
      const pending = new Set(s.pendingSaves);
      pending.add(key);
      return { pendingSaves: pending };
    });
    const payload: Record<string, unknown> = { type: 'file_save', panel, path, content };
    if (reason) payload.reason = reason;
    if (milestone) payload.milestone = milestone;
    sendWs(payload);
  },

  requestTree: (panel, folder) => {
    const key = cacheKey(panel, folder);
    const state = get();
    // Already cached or in-flight — skip
    if (state.trees[key] || state.pendingTrees.has(key)) return;
    const correlation = createRequestCorrelation(state);
    set((s) => {
      const pending = new Map(s.pendingTrees);
      const treeErrors = { ...s.treeErrors };
      pending.set(key, correlation);
      delete treeErrors[key];
      return { pendingTrees: pending, treeErrors };
    });
    if (!sendWs({ type: 'file_tree_request', panel, path: folder, ...correlation })) {
      set((s) => {
        if (s.pendingTrees.get(key)?.requestId !== correlation.requestId) return {};
        const pending = new Map(s.pendingTrees);
        pending.delete(key);
        return { pendingTrees: pending };
      });
    }
  },

  requestContent: (panel, path) => {
    const key = cacheKey(panel, path);
    const state = get();
    if (state.contents[key] !== undefined || state.pendingContents.has(key)) return;
    const correlation = createRequestCorrelation(state);
    set((s) => {
      const pending = new Map(s.pendingContents);
      const contentErrors = { ...s.contentErrors };
      pending.set(key, correlation);
      delete contentErrors[key];
      return { pendingContents: pending, contentErrors };
    });
    if (!sendWs({ type: 'file_content_request', panel, path, ...correlation })) {
      set((s) => {
        if (s.pendingContents.get(key)?.requestId !== correlation.requestId) return {};
        const pending = new Map(s.pendingContents);
        pending.delete(key);
        return { pendingContents: pending };
      });
    }
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

  beginWorkspaceGeneration: (workspaceId) => set((s) => ({
    generation: s.generation + 1,
    workspaceId,
    trees: {},
    contents: {},
    treeMetadata: {},
    contentMetadata: {},
    pendingTrees: new Map(),
    pendingContents: new Map(),
    treeErrors: {},
    contentErrors: {},
    dirtyFlags: {},
    pendingSaves: new Set(),
  })),

  clearAll: () => set({
    trees: {},
    contents: {},
    treeMetadata: {},
    contentMetadata: {},
    pendingTrees: new Map(),
    pendingContents: new Map(),
    treeErrors: {},
    contentErrors: {},
    dirtyFlags: {},
    pendingSaves: new Set(),
  }),
}));
