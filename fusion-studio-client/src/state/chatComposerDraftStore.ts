import { create } from 'zustand';

interface ChatComposerDraftState {
  draftsByOwner: Record<string, string>;
  setDraft: (workspaceId: string, threadId: string, text: string) => void;
  clearDraft: (workspaceId: string, threadId: string) => void;
  clearWorkspaceDrafts: (workspaceId: string) => void;
}

export function chatComposerDraftOwnerKey(workspaceId: string, threadId: string): string {
  return JSON.stringify([workspaceId, threadId]);
}

export const useChatComposerDraftStore = create<ChatComposerDraftState>((set) => ({
  draftsByOwner: {},
  setDraft: (workspaceId, threadId, text) => set((state) => ({
    draftsByOwner: {
      ...state.draftsByOwner,
      [chatComposerDraftOwnerKey(workspaceId, threadId)]: text,
    },
  })),
  clearDraft: (workspaceId, threadId) => set((state) => {
    const key = chatComposerDraftOwnerKey(workspaceId, threadId);
    if (!(key in state.draftsByOwner)) return state;
    const draftsByOwner = { ...state.draftsByOwner };
    delete draftsByOwner[key];
    return { draftsByOwner };
  }),
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
  })),
}));
