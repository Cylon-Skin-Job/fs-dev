/**
 * Screenshot store.
 *
 * One job: hold workspace screenshot data URLs in memory.
 * Read by views (ribbon, carousel). Written by WS handlers + capture triggers.
 */

import { create } from 'zustand';

interface ScreenshotState {
  screenshots: Record<string, string>;
  setScreenshot: (workspaceId: string, dataUrl: string) => void;
  removeScreenshot: (workspaceId: string) => void;
  clearScreenshots: () => void;
}

export const useScreenshotStore = create<ScreenshotState>((set) => ({
  screenshots: {},
  setScreenshot: (workspaceId, dataUrl) =>
    set((state) => ({
      screenshots: { ...state.screenshots, [workspaceId]: dataUrl },
    })),
  removeScreenshot: (workspaceId) =>
    set((state) => {
      const next = { ...state.screenshots };
      delete next[workspaceId];
      return { screenshots: next };
    }),
  clearScreenshots: () => set({ screenshots: {} }),
}));
