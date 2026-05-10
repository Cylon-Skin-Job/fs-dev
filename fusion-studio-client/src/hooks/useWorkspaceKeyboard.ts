/**
 * @module useWorkspaceKeyboard
 * @role Keyboard-driven workspace cycling with ribbon preview.
 *
 * Hold Option (Alt) and press Left/Right to cycle workspaces.
 * The ribbon opens on the first arrow press and stays visible
 * until Option is released.
 */

import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';

function isTypingContext(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function useWorkspaceKeyboard() {
  const optionDown = useRef(false);

  useEffect(() => {
    const cycle = (direction: 'left' | 'right') => {
      const s = useWorkspaceStore.getState();
      const { workspaces, activeWorkspaceId } = s;
      if (workspaces.length <= 1 || !activeWorkspaceId) return;

      const sorted = [...workspaces].sort((a, b) => a.sortOrder - b.sortOrder);
      const ids = sorted.map((w) => w.id);
      const idx = ids.indexOf(activeWorkspaceId);
      if (idx < 0) return;

      const nextIdx =
        direction === 'right'
          ? (idx + 1) % ids.length
          : (idx - 1 + ids.length) % ids.length;

      s.openRibbon();
      s.requestSwitch(ids[nextIdx]);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        optionDown.current = true;
        return;
      }

      if (!optionDown.current) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (isTypingContext()) return;

      e.preventDefault();
      cycle(e.key === 'ArrowRight' ? 'right' : 'left');
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && optionDown.current) {
        optionDown.current = false;
        useWorkspaceStore.getState().closeRibbon();
      }
    };

    const onBlur = () => {
      if (optionDown.current) {
        optionDown.current = false;
        useWorkspaceStore.getState().closeRibbon();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
