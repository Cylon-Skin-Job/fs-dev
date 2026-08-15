/**
 * @module composeStore
 * @role Session-only state for email compose windows: keyed collection with
 *       geometry, mode (open/minimized/expanded), and z-order. Draft content
 *       is mockup-only here — it moves to SQLite with the mail schema
 *       (Email_Workspace_SPEC). Window geometry is deliberately NOT persisted.
 */

import { create } from 'zustand';
import type { FloatGeometry } from '../../hooks/useFloatingWindow';

export type ComposeMode = 'open' | 'minimized' | 'expanded';
export type ComposeField = 'to' | 'subject' | 'body';

export interface ComposeWindowState {
  id: string;
  to: string;
  subject: string;
  body: string;
  mode: ComposeMode;
  /** Mode to return to when a minimized window is restored. */
  prevMode: 'open' | 'expanded';
  /** x/y are -1 until EmailComposeLayer places the window in its container. */
  geometry: FloatGeometry;
  z: number;
}

interface EmailComposeStore {
  windows: ComposeWindowState[];
  nextZ: number;
  openCompose: () => void;
  closeCompose: (id: string) => void;
  minimizeCompose: (id: string) => void;
  restoreCompose: (id: string) => void;
  toggleExpand: (id: string) => void;
  setGeometry: (id: string, geometry: FloatGeometry) => void;
  focusCompose: (id: string) => void;
  setField: (id: string, field: ComposeField, value: string) => void;
}

const DEFAULT_COMPOSE_SIZE = { width: 480, height: 440 };

let nextComposeId = 1;

export const useEmailComposeStore = create<EmailComposeStore>((set) => ({
  windows: [],
  nextZ: 1,

  openCompose: () => set((s) => ({
    windows: [
      ...s.windows,
      {
        id: `compose-${nextComposeId++}`,
        to: '',
        subject: '',
        body: '',
        mode: 'open',
        prevMode: 'open',
        geometry: { x: -1, y: -1, ...DEFAULT_COMPOSE_SIZE },
        z: s.nextZ,
      },
    ],
    nextZ: s.nextZ + 1,
  })),

  closeCompose: (id) => set((s) => ({
    windows: s.windows.filter((w) => w.id !== id),
  })),

  minimizeCompose: (id) => set((s) => ({
    windows: s.windows.map((w) => w.id === id
      ? { ...w, prevMode: w.mode === 'expanded' ? 'expanded' : 'open', mode: 'minimized' }
      : w),
  })),

  restoreCompose: (id) => set((s) => ({
    windows: s.windows.map((w) => w.id === id
      ? { ...w, mode: w.prevMode, z: s.nextZ }
      : w),
    nextZ: s.nextZ + 1,
  })),

  toggleExpand: (id) => set((s) => ({
    windows: s.windows.map((w) => w.id === id
      ? { ...w, mode: w.mode === 'expanded' ? 'open' : 'expanded' }
      : w),
  })),

  setGeometry: (id, geometry) => set((s) => ({
    windows: s.windows.map((w) => (w.id === id ? { ...w, geometry } : w)),
  })),

  focusCompose: (id) => set((s) => ({
    windows: s.windows.map((w) => (w.id === id ? { ...w, z: s.nextZ } : w)),
    nextZ: s.nextZ + 1,
  })),

  setField: (id, field, value) => set((s) => ({
    windows: s.windows.map((w) => (w.id === id ? { ...w, [field]: value } : w)),
  })),
}));
