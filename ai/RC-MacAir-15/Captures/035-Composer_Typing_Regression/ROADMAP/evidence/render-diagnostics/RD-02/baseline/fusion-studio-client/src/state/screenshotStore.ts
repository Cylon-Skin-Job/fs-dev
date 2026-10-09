/**
 * Screenshot store.
 *
 * One job: hold workspace screenshot data URLs in memory.
 * Read by views (ribbon, carousel). Written by WS handlers + capture triggers.
 */

import { create } from 'zustand';

interface ScreenshotState {
  screenshots: Record<string, string>;
  activePanels: Record<string, string>;
  setScreenshot: (workspaceId: string, dataUrl: string) => void;
  setActivePanel: (workspaceId: string, panelId: string) => void;
  removeScreenshot: (workspaceId: string) => void;
  clearScreenshots: () => void;
}

export const useScreenshotStore = create<ScreenshotState>((set) => ({
  screenshots: {},
  activePanels: {},
  setScreenshot: (workspaceId, dataUrl) =>
    set((state) => ({
      screenshots: { ...state.screenshots, [workspaceId]: dataUrl },
    })),
  setActivePanel: (workspaceId, panelId) =>
    set((state) => ({
      activePanels: { ...state.activePanels, [workspaceId]: panelId },
    })),
  removeScreenshot: (workspaceId) =>
    set((state) => {
      const next = { ...state.screenshots };
      delete next[workspaceId];
      return { screenshots: next };
    }),
  clearScreenshots: () => set({ screenshots: {}, activePanels: {} }),
}));
