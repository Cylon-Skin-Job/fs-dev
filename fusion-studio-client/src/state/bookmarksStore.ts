/**
 * @module bookmarksStore
 * @role Track browser bookmarks per workspace
 */

import { create } from 'zustand';
import { sendFusionMessage } from '../lib/ws-client';

export interface Bookmark {
  id: number;
  workspaceId: string;
  url: string;
  title: string;
  folder: string;
  createdAt: number;
}

interface BookmarksState {
  bookmarks: Bookmark[];
  setBookmarks: (items: Bookmark[]) => void;
  loadBookmarks: (workspaceId: string) => void;
  addBookmark: (workspaceId: string, url: string, title: string, folder?: string) => void;
  removeBookmark: (workspaceId: string, id: number) => void;
  updateBookmark: (workspaceId: string, id: number, updates: { title?: string; folder?: string }) => void;
}

export const useBookmarksStore = create<BookmarksState>((set) => ({
  bookmarks: [],

  setBookmarks: (items) => set({ bookmarks: items }),

  loadBookmarks: (workspaceId) => {
    sendFusionMessage({ type: 'bookmarks:list', workspaceId });
  },

  addBookmark: (workspaceId, url, title, folder = '') => {
    sendFusionMessage({ type: 'bookmarks:add', workspaceId, url, title, folder });
  },

  removeBookmark: (workspaceId, id) => {
    sendFusionMessage({ type: 'bookmarks:remove', workspaceId, id });
  },

  updateBookmark: (workspaceId, id, updates) => {
    sendFusionMessage({ type: 'bookmarks:update', workspaceId, id, ...updates });
  },
}));
