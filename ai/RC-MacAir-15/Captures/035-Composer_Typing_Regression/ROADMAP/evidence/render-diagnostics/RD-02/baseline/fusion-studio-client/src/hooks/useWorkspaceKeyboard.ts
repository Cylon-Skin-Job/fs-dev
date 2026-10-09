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

export function useWorkspaceKeyboard() {
  const optionDown = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        optionDown.current = true;
        return;
      }

      if (!optionDown.current) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      e.preventDefault();
      const store = useWorkspaceStore.getState();
      store.beginWorkspacePreview();
      store.previewCycleWorkspace(e.key === 'ArrowRight' ? 'right' : 'left');
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && optionDown.current) {
        optionDown.current = false;
        const store = useWorkspaceStore.getState();
        if (!store.previewWorkspaceId) return;
        store.commitWorkspacePreview();
        window.setTimeout(() => {
          useWorkspaceStore.getState().closeRibbon();
        }, 360);
      }
    };

    const onBlur = () => {
      if (optionDown.current) {
        optionDown.current = false;
        useWorkspaceStore.getState().cancelWorkspacePreview();
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
