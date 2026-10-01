import { create } from 'zustand';

interface ChatComposerDraftState {
  draftsByOwner: Record<string, string>;
  revisionsByOwner: Record<string, number>;
  setDraft: (workspaceId: string, threadId: string, text: string) => void;
  clearSession: (workspaceId: string, threadId: string) => void;
  clearDraft: (workspaceId: string, threadId: string) => void;
  clearDraftIfRevision: (workspaceId: string, threadId: string, revision: number) => boolean;
  clearWorkspaceDrafts: (workspaceId: string) => void;
}

export function chatComposerDraftOwnerKey(workspaceId: string, threadId: string): string {
  return JSON.stringify([workspaceId, threadId]);
}

export const useChatComposerDraftStore = create<ChatComposerDraftState>((set) => ({
  draftsByOwner: {},
  revisionsByOwner: {},
  setDraft: (workspaceId, threadId, text) => set((state) => ({
    draftsByOwner: {
      ...state.draftsByOwner,
      [chatComposerDraftOwnerKey(workspaceId, threadId)]: text,
    },
    revisionsByOwner: {
      ...state.revisionsByOwner,
      [chatComposerDraftOwnerKey(workspaceId, threadId)]:
        (state.revisionsByOwner[chatComposerDraftOwnerKey(workspaceId, threadId)] ?? 0) + 1,
    },
  })),
  clearDraft: (workspaceId, threadId) => set((state) => {
    const key = chatComposerDraftOwnerKey(workspaceId, threadId);
    if (!(key in state.draftsByOwner)) return state;
    const draftsByOwner = { ...state.draftsByOwner };
    delete draftsByOwner[key];
    return { draftsByOwner, revisionsByOwner: {
      ...state.revisionsByOwner,
      [key]: (state.revisionsByOwner[key] ?? 0) + 1,
    } };
  }),
  clearSession: (workspaceId, threadId) => set((state) => {
    const key = chatComposerDraftOwnerKey(workspaceId, threadId);
    const draftsByOwner = { ...state.draftsByOwner };
    const revisionsByOwner = { ...state.revisionsByOwner };
    delete draftsByOwner[key];
    delete revisionsByOwner[key];
    return { draftsByOwner, revisionsByOwner };
  }),
  clearDraftIfRevision: (workspaceId, threadId, revision) => {
    const key = chatComposerDraftOwnerKey(workspaceId, threadId);
    if (useChatComposerDraftStore.getState().revisionsByOwner[key] !== revision) return false;
    useChatComposerDraftStore.getState().clearDraft(workspaceId, threadId);
    return true;
  },
  clearWorkspaceDrafts: (workspaceId) => set((state) => ({
    draftsByOwner: Object.fromEntries(
      Object.entries(state.draftsByOwner).filter(([key]) => {
        try {
          const owner = JSON.parse(key) as unknown;
          return !Array.isArray(owner) || owner[0] !== workspaceId;
        } catch {
          return true;
        }
      }),
    ),
    revisionsByOwner: Object.fromEntries(
      Object.entries(state.revisionsByOwner).filter(([key]) => {
        try {
          const owner = JSON.parse(key) as unknown;
          return !Array.isArray(owner) || owner[0] !== workspaceId;
        } catch {
          return true;
        }
      }),
    ),
  })),
}));
