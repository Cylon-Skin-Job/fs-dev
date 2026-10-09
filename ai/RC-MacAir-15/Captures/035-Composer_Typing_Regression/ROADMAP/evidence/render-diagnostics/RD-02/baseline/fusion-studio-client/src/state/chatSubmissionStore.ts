import { create } from 'zustand';

/** One deliberate Send belongs to a workspace-qualified chat session. */
export interface ChatSubmissionAttempt {
  readonly workspaceId: string;
  readonly threadId: string;
  readonly requestId: string;
  readonly text: string;
  readonly draftRevision: number;
  readonly attachmentIds: readonly string[];
  readonly attachmentGenerations: Readonly<Record<string, number>>;
  readonly phase: 'pending' | 'unknown' | 'accepted' | 'rejected';
  readonly turnId?: string;
}

interface ChatSubmissionState {
  attemptsByOwner: Record<string, ChatSubmissionAttempt>;
  feedbackByOwner: Record<string, string>;
  begin: (attempt: ChatSubmissionAttempt) => boolean;
  accept: (workspaceId: string, threadId: string, requestId: string, turnId: string) => ChatSubmissionAttempt | null;
  reject: (workspaceId: string, threadId: string, requestId: string, message: string) => boolean;
  unknown: (workspaceId: string, threadId: string, requestId: string) => void;
  feedback: (workspaceId: string, threadId: string, message: string | null) => void;
  clearSession: (workspaceId: string, threadId: string) => void;
  clearWorkspace: (workspaceId: string) => void;
}

export const chatSubmissionOwnerKey = (workspaceId: string, threadId: string): string =>
  JSON.stringify([workspaceId, threadId]);

export const mintChatSubmissionRequestId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');

export const useChatSubmissionStore = create<ChatSubmissionState>((set, get) => ({
  attemptsByOwner: {},
  feedbackByOwner: {},
  begin: (attempt) => {
    const key = chatSubmissionOwnerKey(attempt.workspaceId, attempt.threadId);
    const current = get().attemptsByOwner[key];
    if (current?.phase === 'pending' || current?.phase === 'unknown') return false;
    set((state) => ({
      attemptsByOwner: { ...state.attemptsByOwner, [key]: Object.freeze({
        ...attempt,
        attachmentIds: Object.freeze([...attempt.attachmentIds]),
        attachmentGenerations: Object.freeze({ ...attempt.attachmentGenerations }),
      }) },
      feedbackByOwner: { ...state.feedbackByOwner, [key]: '' },
    }));
    return true;
  },
  accept: (workspaceId, threadId, requestId, turnId) => {
    const key = chatSubmissionOwnerKey(workspaceId, threadId);
    const current = get().attemptsByOwner[key];
    if (!current || current.requestId !== requestId || current.phase === 'rejected') return null;
    // An ACK replay confirms the same outcome but must not repeat cleanup or
    // lifecycle events. Reattached files may reuse their original stable IDs.
    if (current.phase === 'accepted') return null;
    set((state) => ({
      attemptsByOwner: { ...state.attemptsByOwner, [key]: Object.freeze({ ...current, phase: 'accepted', turnId }) },
      feedbackByOwner: { ...state.feedbackByOwner, [key]: '' },
    }));
    return current;
  },
  reject: (workspaceId, threadId, requestId, message) => {
    const key = chatSubmissionOwnerKey(workspaceId, threadId);
    const current = get().attemptsByOwner[key];
    if (!current || current.requestId !== requestId || current.phase === 'accepted') return false;
    set((state) => ({
      attemptsByOwner: { ...state.attemptsByOwner, [key]: Object.freeze({ ...current, phase: 'rejected' }) },
      feedbackByOwner: { ...state.feedbackByOwner, [key]: message },
    }));
    return true;
  },
  unknown: (workspaceId, threadId, requestId) => {
    const key = chatSubmissionOwnerKey(workspaceId, threadId);
    const current = get().attemptsByOwner[key];
    if (!current || current.requestId !== requestId || current.phase !== 'pending') return;
    set((state) => ({
      attemptsByOwner: { ...state.attemptsByOwner, [key]: Object.freeze({ ...current, phase: 'unknown' }) },
      feedbackByOwner: { ...state.feedbackByOwner, [key]: 'Delivery status unknown. Check status before sending again.' },
    }));
  },
  feedback: (workspaceId, threadId, message) => {
    const key = chatSubmissionOwnerKey(workspaceId, threadId);
    set((state) => ({ feedbackByOwner: { ...state.feedbackByOwner, [key]: message ?? '' } }));
  },
  clearSession: (workspaceId, threadId) => set((state) => {
    const key = chatSubmissionOwnerKey(workspaceId, threadId);
    const attemptsByOwner = { ...state.attemptsByOwner };
    const feedbackByOwner = { ...state.feedbackByOwner };
    delete attemptsByOwner[key];
    delete feedbackByOwner[key];
    return { attemptsByOwner, feedbackByOwner };
  }),
  clearWorkspace: (workspaceId) => set((state) => ({
    attemptsByOwner: Object.fromEntries(Object.entries(state.attemptsByOwner).filter(([key]) => JSON.parse(key)[0] !== workspaceId)),
    feedbackByOwner: Object.fromEntries(Object.entries(state.feedbackByOwner).filter(([key]) => JSON.parse(key)[0] !== workspaceId)),
  })),
}));
