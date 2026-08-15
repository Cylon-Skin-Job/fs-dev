/**
 * @module officeColorPopover
 * @role Reusable click-to-pick color popover for Office table backgrounds.
 *
 *       Sections, top to bottom: None → Google → file-backed Custom.
 *
 *       Every palette/swatch/None click resolves and closes in one click.
 *       Add applies only after the server acknowledges the captured workspace;
 *       Remove changes config only and never changes existing document fills.
 */

import { showToast } from '../../lib/toast';
import {
  addOfficePaletteColor,
  removeOfficePaletteColor,
  setOfficePaletteSync,
} from '../../lib/ws/office-palette-handlers';
import { useOfficePaletteStore } from '../../state/officePaletteStore';
import { createOfficeCustomColorEditor } from './officeCustomColorEditor';
import { OFFICE_GOOGLE_PALETTE } from './officeGooglePalette';

export type ColorPopoverOpenOptions = {
  clientX: number;
  clientY: number;
  /** `undefined` is an unselected/default state; `null` is explicit None. */
  current?: string | null;
  onPick: (color: string | null) => void;
};

export type ColorPopoverController = {
  open: (options: ColorPopoverOpenOptions) => void;
  close: () => void;
  cleanup: () => void;
};

export function installOfficeColorPopover(): ColorPopoverController {
  let popover: HTMLDivElement | null = null;
  let removeMenu: HTMLDivElement | null = null;
  let removeInvoker: HTMLButtonElement | null = null;
  let unsubscribePalette: (() => void) | null = null;

  const close = () => {
    unsubscribePalette?.();
    unsubscribePalette = null;
    removeMenu?.remove();
    removeMenu = null;
    removeInvoker = null;
    popover?.remove();
    popover = null;
  };

  const position = (clientX: number, clientY: number) => {
    if (!popover) return;
    const rect = popover.getBoundingClientRect();
    const left = Math.min(clientX, window.innerWidth - rect.width - 8);
    const top = Math.min(clientY, window.innerHeight - rect.height - 8);
    popover.style.left = `${Math.max(8, left)}px`;
    popover.style.top = `${Math.max(8, top)}px`;
  };

  const open = ({ clientX, clientY, current, onPick }: ColorPopoverOpenOptions) => {
    close();
    const normalizedCurrent = typeof current === 'string' ? current.toLowerCase() : current;
    popover = document.createElement('div');
    popover.className = 'rv-office-color-popover';
    popover.addEventListener('contextmenu', (event) => { event.preventDefault(); event.stopPropagation(); });

    const host = popover;
    const pick = (color: string | null) => { close(); onPick(color); };
    const paletteStore = useOfficePaletteStore.getState();
    const paletteState = paletteStore.activeWorkspaceId
      ? paletteStore.byWorkspace[paletteStore.activeWorkspaceId]
      : undefined;
    const customColors = paletteState?.customColors ?? [];
    const canMutate = Boolean(
      paletteState
      && paletteState.availability === 'ready'
      && paletteState.syncStatus === 'ok'
      && !paletteState.isLoading
    );

    const showMutationError = (error: unknown) => {
      showToast(error instanceof Error ? error.message : 'The workspace palette could not be updated.');
    };

    const openRemoveMenu = (
      hex: string,
      anchorX: number,
      anchorY: number,
      invoker: HTMLButtonElement,
    ) => {
      removeMenu?.remove();
      removeInvoker = invoker;
      removeMenu = document.createElement('div');
      removeMenu.className = 'rv-office-color-remove-menu';
      removeMenu.setAttribute('role', 'menu');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('role', 'menuitem');
      remove.disabled = !canMutate;
      remove.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (remove.disabled) return;
        remove.disabled = true;
        void removeOfficePaletteColor(hex).then(() => close(), (error) => {
          close();
          showMutationError(error);
        });
      });
      removeMenu.appendChild(remove);
      document.body.appendChild(removeMenu);
      const rect = removeMenu.getBoundingClientRect();
      removeMenu.style.left = `${Math.max(8, Math.min(anchorX, window.innerWidth - rect.width - 8))}px`;
      removeMenu.style.top = `${Math.max(8, Math.min(anchorY, window.innerHeight - rect.height - 8))}px`;
      remove.focus();
    };

    const swatch = (hex: string, custom = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rv-office-color-swatch';
      button.style.setProperty('--swatch', hex);
      button.title = hex;
      if (normalizedCurrent === hex) button.dataset.active = 'true';
      button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); pick(hex); });
      if (custom) {
        button.dataset.paletteSource = 'custom';
        button.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openRemoveMenu(hex, event.clientX, event.clientY, button);
        });
        button.addEventListener('keydown', (event) => {
          if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
          event.preventDefault();
          event.stopPropagation();
          const rect = button.getBoundingClientRect();
          openRemoveMenu(hex, rect.left + rect.width / 2, rect.bottom + 4, button);
        });
      }
      return button;
    };

    const divider = () => {
      const line = document.createElement('div');
      line.className = 'rv-office-color-divider';
      return line;
    };

    const defaultSection = document.createElement('div');
    defaultSection.className = 'rv-office-color-default-section';
    host.appendChild(defaultSection);

    // None / No fill — full-width, borderless, hover-revealed.
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'rv-office-color-none';
    none.innerHTML = '<span class="material-symbols-outlined">format_color_reset</span><span>None</span>';
    none.setAttribute('aria-pressed', String(normalizedCurrent === null));
    if (normalizedCurrent === null) none.dataset.active = 'true';
    none.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); pick(null); });
    defaultSection.appendChild(none);

    // Defaults — the Google palette grid.
    const grid = document.createElement('div');
    grid.className = 'rv-office-color-grid';
    OFFICE_GOOGLE_PALETTE.forEach((row) => row.forEach((hex) => grid.appendChild(swatch(hex))));
    defaultSection.appendChild(grid);

    // Custom — the confirmed workspace-file projection and mutation controls.
    host.appendChild(divider());
    const sync = document.createElement('button');
    sync.type = 'button';
    sync.className = 'rv-office-color-sync';
    sync.disabled = !canMutate;
    sync.setAttribute('aria-label', paletteState?.syncEnabled === false ? 'Sync Disabled' : 'Sync Enabled');
    sync.innerHTML = paletteState?.syncEnabled === false
      ? '<span class="material-symbols-outlined">sync_disabled</span><span>Sync Disabled</span>'
      : '<span class="material-symbols-outlined">sync</span><span>Sync Enabled</span>';
    sync.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (sync.disabled) return;
      sync.disabled = true;
      void setOfficePaletteSync(!(paletteState?.syncEnabled ?? true)).then(() => undefined, (error) => {
        close();
        showMutationError(error);
      });
    });
    host.appendChild(sync);

    const customRow = document.createElement('div');
    customRow.className = 'rv-office-color-row rv-office-color-custom';
    customColors.forEach((hex) => customRow.appendChild(swatch(hex, true)));

    const customEditor = createOfficeCustomColorEditor({
      initialColor: normalizedCurrent ?? null,
      enabled: canMutate,
      onCommit: (hex, commit) => {
        commit.disabled = true;
        void addOfficePaletteColor(hex).then(() => pick(hex), (error) => {
          showMutationError(error);
          if (popover === host) {
            // The correlated error may carry a newer server-confirmed projection
            // (for example, a raced 20th color). Rebuild the still-open picker
            // from the store while retaining the captured document target.
            open({ clientX, clientY, current, onPick });
          }
        });
      },
      onOpen: (hexInput) => {
        window.requestAnimationFrame(() => {
          position(clientX, clientY);
          hexInput.focus();
          hexInput.select();
        });
      },
    });
    if (customColors.length < 20) customRow.appendChild(customEditor.add);
    host.appendChild(customRow);
    host.appendChild(customEditor.editor);

    document.body.appendChild(host);
    position(clientX, clientY);
    const openedWorkspaceId = paletteStore.activeWorkspaceId;
    unsubscribePalette = useOfficePaletteStore.subscribe((next) => {
      if (popover !== host) return;
      if (next.activeWorkspaceId !== openedWorkspaceId) {
        close();
        return;
      }
      const nextPaletteState = openedWorkspaceId ? next.byWorkspace[openedWorkspaceId] : undefined;
      const renderedProjectionChanged = Boolean(
        nextPaletteState && (
          nextPaletteState.syncEnabled !== paletteState?.syncEnabled ||
          nextPaletteState.availability !== paletteState?.availability ||
          nextPaletteState.syncStatus !== paletteState?.syncStatus ||
          nextPaletteState.isLoading !== paletteState?.isLoading ||
          nextPaletteState.customColors.length !== customColors.length ||
          nextPaletteState.customColors.some((hex, index) => hex !== customColors[index])
        )
      );
      if (renderedProjectionChanged) {
        // The popover is imperative DOM, so rebuild it from every authoritative
        // rendered projection change while keeping the document target captured by open().
        open({ clientX, clientY, current, onPick });
      }
    });
  };

  const onWindowPointerDown = (event: PointerEvent) => {
    if (removeMenu) {
      if (removeMenu.contains(event.target as Node)) return;
      removeMenu.remove();
      removeMenu = null;
      removeInvoker = null;
    }
    if (popover && !popover.contains(event.target as Node)) close();
  };
  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (removeMenu) {
      event.preventDefault();
      event.stopPropagation();
      removeMenu.remove();
      removeMenu = null;
      removeInvoker?.focus();
      removeInvoker = null;
      return;
    }
    if (popover) {
      event.preventDefault();
      event.stopPropagation();
    }
    close();
  };
  window.addEventListener('pointerdown', onWindowPointerDown, true);
  window.addEventListener('keydown', onWindowKeyDown, true);

  return {
    open,
    close,
    cleanup: () => {
      window.removeEventListener('pointerdown', onWindowPointerDown, true);
      window.removeEventListener('keydown', onWindowKeyDown, true);
      close();
    },
  };
}
