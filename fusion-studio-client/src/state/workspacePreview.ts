import type { Workspace } from '../types';

type Direction = 'left' | 'right';

export interface WorkspacePreviewState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isRibbonOpen: boolean;
  isWorkspacePreviewOpen: boolean;
  previewWorkspaceId: string | null;
  previewCommitWorkspaceId: string | null;
  previewOriginWorkspaceId: string | null;
  previewRenderedWorkspaceId: string | null;
}

export interface WorkspacePreviewActions {
  beginWorkspacePreview: (showRibbon?: boolean) => void;
  previewCycleWorkspace: (direction: Direction) => string | null;
  commitWorkspacePreview: () => string | null;
  completeWorkspacePreviewSwitch: (workspaceId: string | null) => void;
  cancelWorkspacePreview: () => void;
  cycleWorkspace: (direction: Direction) => void;
}

interface WorkspacePreviewDeps {
  get: () => WorkspacePreviewState & {
    requestSwitch: (workspaceId: string) => void;
  };
  set: (partial: Partial<WorkspacePreviewState>) => void;
  sendWorkspaceMessage: (message: Record<string, unknown>) => void;
  toRibbonWorkspaces: (workspaces: Workspace[]) => Workspace[];
}

const PREWARM_STEP_MS = 650;

let prewarmTimer: ReturnType<typeof setTimeout> | null = null;
let prewarmedWorkspaceIds = new Set<string>();

function stopPrewarmQueue(clearSeen = true): void {
  if (prewarmTimer) {
    clearTimeout(prewarmTimer);
    prewarmTimer = null;
  }
  if (clearSeen) {
    prewarmedWorkspaceIds = new Set<string>();
  }
}

function getPrewarmOrder(firstWorkspaceId: string, workspaceIds: string[]): string[] {
  const firstIndex = workspaceIds.indexOf(firstWorkspaceId);
  if (firstIndex < 0) return [];

  return [
    firstWorkspaceId,
    ...workspaceIds.slice(firstIndex + 1),
    ...workspaceIds.slice(0, firstIndex),
  ];
}

export function createWorkspacePreviewActions({
  get,
  set,
  sendWorkspaceMessage,
  toRibbonWorkspaces,
}: WorkspacePreviewDeps): WorkspacePreviewActions {
  function runPrewarmQueue(firstWorkspaceId: string, workspaceIds: string[]): void {
    stopPrewarmQueue(false);

    const queue = getPrewarmOrder(firstWorkspaceId, workspaceIds)
      .filter((workspaceId) => !prewarmedWorkspaceIds.has(workspaceId));
    if (queue.length === 0) return;

    const warmNext = () => {
      const current = get();
      if (!current.isWorkspacePreviewOpen || !current.previewWorkspaceId) {
        stopPrewarmQueue();
        return;
      }

      const workspaceId = queue.shift();
      if (!workspaceId) {
        prewarmTimer = null;
        return;
      }

      prewarmedWorkspaceIds.add(workspaceId);
      if (current.activeWorkspaceId !== workspaceId) {
        current.requestSwitch(workspaceId);
      }
      set({ previewRenderedWorkspaceId: workspaceId });

      if (queue.length > 0) {
        prewarmTimer = setTimeout(warmNext, PREWARM_STEP_MS);
      } else {
        prewarmTimer = null;
      }
    };

    warmNext();
  }

  const actions: WorkspacePreviewActions = {
    beginWorkspacePreview: (showRibbon = true) => {
      const { activeWorkspaceId, previewWorkspaceId, previewOriginWorkspaceId } = get();
      sendWorkspaceMessage({ type: 'screenshot:list' });
      set({
        isRibbonOpen: showRibbon ? true : get().isRibbonOpen,
        isWorkspacePreviewOpen: true,
        previewWorkspaceId: previewWorkspaceId || activeWorkspaceId,
        previewOriginWorkspaceId: previewOriginWorkspaceId || activeWorkspaceId,
      });
    },

    previewCycleWorkspace: (direction) => {
      const { workspaces, activeWorkspaceId, previewWorkspaceId } = get();
      const ribbonWorkspaces = toRibbonWorkspaces(workspaces);
      if (ribbonWorkspaces.length <= 1 || !activeWorkspaceId) return null;

      const ids = ribbonWorkspaces.map((w) => w.id);
      const currentPreviewId = previewWorkspaceId || activeWorkspaceId;
      const idx = ids.indexOf(currentPreviewId);
      if (idx < 0) return null;

      const nextIdx = direction === 'right'
        ? (idx + 1) % ids.length
        : (idx - 1 + ids.length) % ids.length;
      const nextWorkspaceId = ids[nextIdx];
      set({ isWorkspacePreviewOpen: true, previewWorkspaceId: nextWorkspaceId });
      runPrewarmQueue(nextWorkspaceId, ids);
      return nextWorkspaceId;
    },

    commitWorkspacePreview: () => {
      stopPrewarmQueue();
      const { activeWorkspaceId, previewWorkspaceId } = get();
      if (!previewWorkspaceId || previewWorkspaceId === activeWorkspaceId) {
        set({
          isWorkspacePreviewOpen: false,
          previewWorkspaceId: null,
          previewCommitWorkspaceId: null,
          previewOriginWorkspaceId: null,
          previewRenderedWorkspaceId: null,
        });
        return null;
      }
      get().requestSwitch(previewWorkspaceId);
      set({
        isWorkspacePreviewOpen: true,
        previewWorkspaceId,
        previewCommitWorkspaceId: previewWorkspaceId,
      });
      return previewWorkspaceId;
    },

    completeWorkspacePreviewSwitch: (workspaceId) => {
      const { previewCommitWorkspaceId } = get();
      if (previewCommitWorkspaceId && previewCommitWorkspaceId === workspaceId) {
        set({
          isRibbonOpen: false,
          isWorkspacePreviewOpen: false,
          previewWorkspaceId: null,
          previewCommitWorkspaceId: null,
          previewOriginWorkspaceId: null,
          previewRenderedWorkspaceId: null,
        });
      }
    },

    cancelWorkspacePreview: () => {
      stopPrewarmQueue();
      const { previewCommitWorkspaceId, previewOriginWorkspaceId, activeWorkspaceId } = get();
      if (previewCommitWorkspaceId) return;
      if (previewOriginWorkspaceId && activeWorkspaceId !== previewOriginWorkspaceId) {
        get().requestSwitch(previewOriginWorkspaceId);
      }
      set({
        isWorkspacePreviewOpen: false,
        previewWorkspaceId: null,
        previewOriginWorkspaceId: null,
        previewRenderedWorkspaceId: null,
      });
    },

    cycleWorkspace: (direction) => {
      const { workspaces, activeWorkspaceId } = get();
      const ribbonWorkspaces = toRibbonWorkspaces(workspaces);
      if (ribbonWorkspaces.length <= 1 || !activeWorkspaceId) return;

      const ids = ribbonWorkspaces.map((w) => w.id);
      const idx = ids.indexOf(activeWorkspaceId);
      if (idx < 0) return;

      const nextIdx = direction === 'right'
        ? (idx + 1) % ids.length
        : (idx - 1 + ids.length) % ids.length;
      const nextWorkspaceId = ids[nextIdx];
      if (!nextWorkspaceId) return;
      get().requestSwitch(nextWorkspaceId);
    },
  };

  return actions;
}
