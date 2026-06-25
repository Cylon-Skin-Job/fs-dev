import { create } from 'zustand';
import { basename, isAutocompleteFilePath } from '../lib/chat-file-links/file-link-filter';
import type { ChatFileAutocompleteCandidate, ChatLinkAttachment } from '../lib/chat-file-links/file-link-types';
import type { ExchangeData } from '../types';

interface ChatFileLinkState {
  pendingAttachments: ChatLinkAttachment[];
  autocompleteCandidates: ChatFileAutocompleteCandidate[];
  addPendingAttachment: (attachment: ChatLinkAttachment) => void;
  removePendingAttachment: (id: string) => void;
  clearPendingAttachments: () => void;
  upsertAutocompleteCandidate: (candidate: ChatFileAutocompleteCandidate) => void;
  hydrateOpenTabCandidates: (paths: string[]) => void;
  hydrateThreadAutocompleteCandidates: (exchanges: ExchangeData[], openTabPaths: string[]) => void;
  mergeExchangeAutocompleteCandidates: (exchange: ExchangeData, openTabPaths: string[]) => void;
}

function candidateFromPath(
  path: string,
  source: ChatFileAutocompleteCandidate['source'],
  ts?: number,
): ChatFileAutocompleteCandidate | null {
  if (!isAutocompleteFilePath(path)) return null;
  const name = basename(path);
  return {
    id: `${source}:${path}`,
    label: name,
    path,
    basename: name,
    source,
    mentionedAt: ts,
  };
}

function metadataArray(metadata: Record<string, unknown> | undefined, key: string): Array<Record<string, unknown>> {
  const value = metadata?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}

function candidatesFromExchangeMetadata(exchange: ExchangeData): ChatFileAutocompleteCandidate[] {
  const metadata = exchange.metadata;
  const candidates: ChatFileAutocompleteCandidate[] = [];

  for (const mention of metadataArray(metadata, 'mentions')) {
    if (typeof mention.path !== 'string') continue;
    const candidate = candidateFromPath(mention.path, 'thread-metadata', exchange.ts);
    if (candidate) candidates.push(candidate);
  }

  for (const attachment of metadataArray(metadata, 'attachments')) {
    if (attachment.kind !== 'file' || typeof attachment.path !== 'string') continue;
    const candidate = candidateFromPath(attachment.path, 'thread-metadata', exchange.ts);
    if (candidate) candidates.push(candidate);
  }

  for (const mutation of metadataArray(metadata, 'fileMutations')) {
    if (typeof mutation.path !== 'string') continue;
    const candidate = candidateFromPath(mutation.path, 'file-mutation', Number(mutation.ts) || exchange.ts);
    if (candidate) candidates.push(candidate);
  }

  return candidates;
}

export const useChatFileLinkStore = create<ChatFileLinkState>((set) => ({
  pendingAttachments: [],
  autocompleteCandidates: [],
  addPendingAttachment: (attachment) => set((state) => {
    const exists = state.pendingAttachments.some((item) => item.id === attachment.id);
    if (exists) return state;
    return { pendingAttachments: [...state.pendingAttachments, attachment] };
  }),
  removePendingAttachment: (id) => set((state) => ({
    pendingAttachments: state.pendingAttachments.filter((attachment) => attachment.id !== id),
  })),
  clearPendingAttachments: () => set({ pendingAttachments: [] }),
  upsertAutocompleteCandidate: (candidate) => set((state) => {
    if (!isAutocompleteFilePath(candidate.path)) return state;
    const next = state.autocompleteCandidates.filter((item) => item.id !== candidate.id);
    return { autocompleteCandidates: [...next, candidate] };
  }),
  hydrateOpenTabCandidates: (paths) => set((state) => {
    const now = Date.now();
    const openTabCandidates = paths
      .filter(isAutocompleteFilePath)
      .map((path, index) => {
        const name = basename(path);
        return {
          id: `open-tab:${path}`,
          label: name,
          path,
          basename: name,
          source: 'open-tab' as const,
          openedAt: now - index,
        };
      });
    const nonOpenTabCandidates = state.autocompleteCandidates
      .filter((candidate) => candidate.source !== 'open-tab');

    return { autocompleteCandidates: [...nonOpenTabCandidates, ...openTabCandidates] };
  }),
  hydrateThreadAutocompleteCandidates: (exchanges, openTabPaths) => set(() => {
    const now = Date.now();
    const byId = new Map<string, ChatFileAutocompleteCandidate>();

    for (const exchange of exchanges) {
      for (const candidate of candidatesFromExchangeMetadata(exchange)) {
        byId.set(candidate.id, candidate);
      }
    }

    openTabPaths
      .filter(isAutocompleteFilePath)
      .forEach((path, index) => {
        const name = basename(path);
        byId.set(`open-tab:${path}`, {
          id: `open-tab:${path}`,
          label: name,
          path,
          basename: name,
          source: 'open-tab',
          openedAt: now - index,
        });
      });

    return { autocompleteCandidates: Array.from(byId.values()) };
  }),
  mergeExchangeAutocompleteCandidates: (exchange, openTabPaths) => set((state) => {
    const byId = new Map<string, ChatFileAutocompleteCandidate>();
    for (const candidate of state.autocompleteCandidates) {
      byId.set(candidate.id, candidate);
    }
    for (const candidate of candidatesFromExchangeMetadata(exchange)) {
      byId.set(candidate.id, candidate);
    }

    const now = Date.now();
    openTabPaths
      .filter(isAutocompleteFilePath)
      .forEach((path, index) => {
        const name = basename(path);
        byId.set(`open-tab:${path}`, {
          id: `open-tab:${path}`,
          label: name,
          path,
          basename: name,
          source: 'open-tab',
          openedAt: now - index,
        });
      });

    return { autocompleteCandidates: Array.from(byId.values()) };
  }),
}));
