import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePanelStore } from '../state/panelStore';
import { ConnectorsDropdown } from './ConnectorsDropdown';
import { openMenuTree } from './menu';
import type { MenuDescriptor, MenuHandle } from './menu';
import './HeaderActionsMenu.css';

interface HeaderActionsMenuProps {
  onOpenFusion: () => void;
}

type DestinationFocusId = 'connectors' | 'fusion' | 'theme';

interface DestinationFocusRequest {
  id: DestinationFocusId;
  generation: number;
  ready: boolean;
}

const DESTINATION_FOCUS_TARGETS: Record<DestinationFocusId, {
  root: string;
  target: string;
}> = {
  connectors: {
    root: '.rv-connectors-dropdown[data-open="true"]',
    target: '.rv-connectors-toggle',
  },
  fusion: {
    root: '.rv-fusion-overlay',
    target: '.rv-fusion-exit-btn',
  },
  theme: {
    root: '.rv-theme-picker-modal',
    target: '.rv-tp-mode-btn',
  },
};

function isVisibleFocusTarget(root: HTMLElement, target: HTMLElement) {
  if (!root.isConnected || !target.isConnected || !root.contains(target)) return false;
  if (root.matches('[aria-hidden="true"], [hidden], [inert]')) return false;
  if (target.tabIndex < 0 || target.matches(':disabled, [aria-disabled="true"], [hidden], [inert]')) {
    return false;
  }
  const rootStyle = getComputedStyle(root);
  const targetStyle = getComputedStyle(target);
  if (rootStyle.display === 'none' || rootStyle.visibility === 'hidden') return false;
  if (targetStyle.display === 'none' || targetStyle.visibility === 'hidden') return false;
  const rect = target.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function HeaderActionsMenu({ onOpenFusion }: HeaderActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<MenuHandle | null>(null);
  const destinationFocusRef = useRef<DestinationFocusRequest | null>(null);
  const destinationGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const [expanded, setExpanded] = useState(false);
  const [destinationFocusRevision, setDestinationFocusRevision] = useState(0);
  const themePickerOpen = usePanelStore((state) => state.isThemePickerOpen);
  const setThemePickerOpen = usePanelStore((state) => state.setThemePickerOpen);
  const setConnectorsDropdownOpen = usePanelStore(
    (state) => state.setConnectorsDropdownOpen,
  );

  const invalidateDestinationFocus = useCallback(() => {
    destinationGenerationRef.current += 1;
    destinationFocusRef.current = null;
  }, []);

  const requestDestinationFocus = useCallback((id: DestinationFocusId) => {
    const generation = destinationGenerationRef.current + 1;
    destinationGenerationRef.current = generation;
    destinationFocusRef.current = { id, generation, ready: false };
  }, []);

  const setTrigger = useCallback((node: HTMLButtonElement | null) => {
    const previous = triggerRef.current;
    if (previous && previous !== node) {
      invalidateDestinationFocus();
      menuRef.current?.close('replaced');
      menuRef.current = null;
    }
    triggerRef.current = node;
  }, [invalidateDestinationFocus]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      invalidateDestinationFocus();
      menuRef.current?.close('programmatic');
      menuRef.current = null;
    };
  }, [invalidateDestinationFocus]);

  useLayoutEffect(() => {
    const request = destinationFocusRef.current;
    if (!request?.ready || request.generation !== destinationGenerationRef.current) return;
    destinationFocusRef.current = null;
    if (!mountedRef.current || document.activeElement !== document.body) return;

    const selectors = DESTINATION_FOCUS_TARGETS[request.id];
    const root = document.querySelector<HTMLElement>(selectors.root);
    const target = root?.querySelector<HTMLElement>(selectors.target);
    if (!root || !target || !isVisibleFocusTarget(root, target)) return;
    target.focus({ preventScroll: true });
  }, [destinationFocusRevision]);

  const items = useMemo<MenuDescriptor[]>(() => [
    {
      kind: 'action',
      id: 'workspace-controls-connectors',
      label: 'macOS Connectors',
      icon: 'hub',
      onSelect: () => {
        requestDestinationFocus('connectors');
        setConnectorsDropdownOpen(true);
        return { kind: 'close-all' };
      },
    },
    {
      kind: 'action',
      id: 'workspace-controls-fusion',
      label: 'Fusion',
      icon: 'raven',
      onSelect: () => {
        requestDestinationFocus('fusion');
        onOpenFusion();
        return { kind: 'close-all' };
      },
    },
    {
      kind: 'action',
      id: 'workspace-controls-theme',
      label: 'Workspace theme',
      icon: 'palette',
      onSelect: () => {
        if (themePickerOpen) invalidateDestinationFocus();
        else requestDestinationFocus('theme');
        setThemePickerOpen(!themePickerOpen);
        return { kind: 'close-all' };
      },
    },
  ], [
    invalidateDestinationFocus,
    onOpenFusion,
    requestDestinationFocus,
    setConnectorsDropdownOpen,
    setThemePickerOpen,
    themePickerOpen,
  ]);

  useEffect(() => {
    menuRef.current?.update(items);
  }, [items]);

  const toggleMenu = useCallback(() => {
    if (expanded) {
      menuRef.current?.close('cancel');
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;

    invalidateDestinationFocus();
    setConnectorsDropdownOpen(false);
    menuRef.current?.close('replaced');
    let handle: MenuHandle;
    handle = openMenuTree({
      anchor: { kind: 'element', element: trigger, placement: 'below-start' },
      invocationElement: trigger,
      items,
      ariaLabel: 'Workspace controls',
      minWidth: 220,
      restoreInvocationFocus: () => {
        if (menuRef.current === handle && triggerRef.current === trigger && trigger.isConnected) {
          trigger.focus({ preventScroll: true });
        }
      },
      focusAfterAction: () => {
        if (menuRef.current !== handle) return;
        const request = destinationFocusRef.current;
        if (!request || request.generation !== destinationGenerationRef.current) return;
        request.ready = true;
        setDestinationFocusRevision((revision) => revision + 1);
      },
      onClose: (reason) => {
        if (menuRef.current !== handle) return;
        if (reason !== 'action') invalidateDestinationFocus();
        menuRef.current = null;
        if (mountedRef.current) setExpanded(false);
      },
    });
    menuRef.current = handle;
    setExpanded(true);
  }, [expanded, invalidateDestinationFocus, items, setConnectorsDropdownOpen]);

  return (
    <div className="rv-header-actions-menu-wrap">
      <button
        ref={setTrigger}
        type="button"
        className="rv-fusion-icon-btn"
        title="Workspace controls"
        aria-label="Open workspace controls"
        aria-haspopup="menu"
        aria-expanded={expanded}
        onClick={toggleMenu}
      >
        <span className="material-symbols-outlined">discover_tune</span>
      </button>

      <ConnectorsDropdown />
    </div>
  );
}
