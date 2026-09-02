/**
 * @module officeColorPopover
 * @role Render and refresh the specialized Office color palette inside a shared menu tree.
 */

import { showToast } from '../../lib/toast';
import {
  addOfficePaletteColor,
  removeOfficePaletteColor,
  setOfficePaletteSync,
} from '../../lib/ws/office-palette-handlers';
import { useOfficePaletteStore } from '../../state/officePaletteStore';
import type {
  MenuDescriptor,
  MenuExternalChildContext,
  MenuExternalRegistration,
} from '../menu';
import { createOfficeCustomColorEditor } from './officeCustomColorEditor';
import { OFFICE_GOOGLE_PALETTE } from './officeGooglePalette';

export type ColorPopoverOpenOptions = {
  anchorElement: HTMLButtonElement;
  external: MenuExternalChildContext;
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
  let registration: MenuExternalRegistration | null = null;
  let unsubscribePalette: (() => void) | null = null;
  let session = 0;
  let pendingAddColor: string | null = null;

  const showMutationError = (error: unknown) => {
    showToast(error instanceof Error ? error.message : 'The workspace palette could not be updated.');
  };

  const destroySurface = (unregister: boolean) => {
    unsubscribePalette?.();
    unsubscribePalette = null;
    if (unregister) registration?.unregister();
    registration = null;
    popover?.remove();
    popover = null;
  };

  const close = () => {
    session += 1;
    pendingAddColor = null;
    destroySurface(true);
  };

  const position = (anchorElement: HTMLElement) => {
    if (!popover) return;
    const anchor = anchorElement.getBoundingClientRect();
    const rect = popover.getBoundingClientRect();
    const preferredLeft = anchor.right + 4;
    const left = preferredLeft + rect.width <= window.innerWidth - 8
      ? preferredLeft
      : anchor.left - rect.width - 4;
    const top = Math.min(anchor.top + 12, window.innerHeight - rect.height - 8);
    popover.style.left = `${Math.max(8, left)}px`;
    popover.style.top = `${Math.max(8, top)}px`;
  };

  const render = (options: ColorPopoverOpenOptions, activeSession: number) => {
    if (session !== activeSession || !options.external.menu.isOpen()) return;
    destroySurface(true);
    const normalizedCurrent = typeof options.current === 'string'
      ? options.current.toLowerCase()
      : options.current;
    const paletteStore = useOfficePaletteStore.getState();
    const openedWorkspaceId = paletteStore.activeWorkspaceId;
    const paletteState = openedWorkspaceId ? paletteStore.byWorkspace[openedWorkspaceId] : undefined;
    const customColors = paletteState?.customColors ?? [];
    const canMutate = Boolean(
      paletteState
      && paletteState.availability === 'ready'
      && paletteState.syncStatus === 'ok'
      && !paletteState.isLoading
    );

    const host = document.createElement('div');
    host.className = 'rv-office-color-popover';
    host.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    popover = host;

    const pick = (color: string | null) => {
      if (session !== activeSession || popover !== host) return;
      options.onPick(color);
      registration?.closeTree('action');
    };

    const openRemoveMenu = (hex: string, invoker: HTMLButtonElement) => {
      const descriptors: readonly MenuDescriptor[] = [{
        kind: 'action',
        id: `office-custom-color-remove-${hex}`,
        label: 'Remove',
        icon: 'delete',
        tone: 'destructive',
        disabled: !canMutate,
        onSelect: async () => {
          try {
            await removeOfficePaletteColor(hex);
          } catch (error) {
            showMutationError(error);
            throw error;
          }
          if (session === activeSession) close();
          return { kind: 'close-current' };
        },
      }];
      registration?.openChildMenu({
        anchorElement: invoker,
        items: descriptors,
        ariaLabel: 'Custom color actions',
        minWidth: 112,
      });
    };

    const swatch = (hex: string, custom = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rv-office-color-swatch';
      button.style.setProperty('--swatch', hex);
      button.title = hex;
      if (normalizedCurrent === hex) button.dataset.active = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        pick(hex);
      });
      if (custom) {
        button.dataset.paletteSource = 'custom';
        button.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openRemoveMenu(hex, button);
        });
        button.addEventListener('keydown', (event) => {
          if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
          event.preventDefault();
          event.stopPropagation();
          openRemoveMenu(hex, button);
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
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'rv-office-color-none';
    none.innerHTML = '<span class="material-symbols-outlined">format_color_reset</span><span>None</span>';
    none.setAttribute('aria-pressed', String(normalizedCurrent === null));
    if (normalizedCurrent === null) none.dataset.active = 'true';
    none.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      pick(null);
    });
    defaultSection.appendChild(none);
    const grid = document.createElement('div');
    grid.className = 'rv-office-color-grid';
    OFFICE_GOOGLE_PALETTE.forEach((row) => row.forEach((hex) => grid.appendChild(swatch(hex))));
    defaultSection.appendChild(grid);
    host.appendChild(defaultSection);

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
      void setOfficePaletteSync(!(paletteState?.syncEnabled ?? true)).catch((error) => {
        if (session === activeSession) showMutationError(error);
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
        if (pendingAddColor) return;
        pendingAddColor = hex;
        commit.disabled = true;
        void addOfficePaletteColor(hex).then(() => {
          if (session !== activeSession || !registration?.isActive()) return;
          const confirmed = useOfficePaletteStore.getState();
          const state = openedWorkspaceId ? confirmed.byWorkspace[openedWorkspaceId] : undefined;
          if (pendingAddColor === hex && state?.customColors.includes(hex)) {
            render(options, activeSession);
          }
        }, (error) => {
          if (session !== activeSession || popover !== host) return;
          pendingAddColor = null;
          commit.disabled = !canMutate;
          showMutationError(error);
        });
      },
      onOpen: (hexInput) => {
        window.requestAnimationFrame(() => {
          if (session !== activeSession || popover !== host) return;
          position(options.anchorElement);
          hexInput.focus();
          hexInput.select();
        });
      },
    });
    if (customColors.length < 20) customRow.appendChild(customEditor.add);
    host.append(customRow, customEditor.editor);

    document.body.appendChild(host);
    position(options.anchorElement);
    registration = options.external.registerSurface(host, {
      teardown: () => {
        if (session !== activeSession) return;
        session += 1;
        pendingAddColor = null;
        destroySurface(false);
      },
      reposition: () => position(options.anchorElement),
    });
    if (!registration) {
      if (session === activeSession) session += 1;
      pendingAddColor = null;
      destroySurface(false);
      return;
    }

    const focusConfirmedColor = pendingAddColor;
    if (focusConfirmedColor && customColors.includes(focusConfirmedColor)) {
      pendingAddColor = null;
      window.requestAnimationFrame(() => {
        if (session !== activeSession || popover !== host) return;
        host.querySelector<HTMLButtonElement>(
          `.rv-office-color-custom .rv-office-color-swatch[title="${CSS.escape(focusConfirmedColor)}"]`,
        )?.focus({ preventScroll: true });
      });
    }

    unsubscribePalette = useOfficePaletteStore.subscribe((next) => {
      if (session !== activeSession || popover !== host) return;
      if (next.activeWorkspaceId !== openedWorkspaceId) {
        close();
        return;
      }
      const nextState = openedWorkspaceId ? next.byWorkspace[openedWorkspaceId] : undefined;
      if (pendingAddColor) {
        if (nextState?.isLoading || nextState?.error?.operation === 'add') return;
        if (nextState?.customColors.includes(pendingAddColor)) {
          render(options, activeSession);
          return;
        }
      }
      const renderedProjectionChanged = Boolean(
        nextState && (
          nextState.syncEnabled !== paletteState?.syncEnabled
          || nextState.availability !== paletteState?.availability
          || nextState.syncStatus !== paletteState?.syncStatus
          || nextState.isLoading !== paletteState?.isLoading
          || nextState.customColors.length !== customColors.length
          || nextState.customColors.some((hex, index) => hex !== customColors[index])
        )
      );
      if (renderedProjectionChanged) render(options, activeSession);
    });
  };

  const open = (options: ColorPopoverOpenOptions) => {
    close();
    const activeSession = session;
    render(options, activeSession);
  };

  return { open, close, cleanup: close };
}
