import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Workspace } from '../types';
import { openMenuTree } from './menu';
import type { MenuDescriptor, MenuHandle } from './menu';

interface WorkspaceRibbonAddMenuProps {
  hiddenWorkspaces: readonly Workspace[];
  ribbonOpen: boolean;
  closeRibbon: () => void;
  openAddModal: () => void;
  openCreateModal: () => void;
  requestAddToRibbon: (workspaceId: string) => void;
}

export function WorkspaceRibbonAddMenu({
  hiddenWorkspaces,
  ribbonOpen,
  closeRibbon,
  openAddModal,
  openCreateModal,
  requestAddToRibbon,
}: WorkspaceRibbonAddMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<MenuHandle | null>(null);
  const mountedRef = useRef(true);
  const [expanded, setExpanded] = useState(false);

  const items = useMemo<MenuDescriptor[]>(() => [
    {
      kind: 'heading',
      id: 'workspace-ribbon-add-heading',
      label: 'Add to ribbon',
    },
    ...(hiddenWorkspaces.length > 0
      ? hiddenWorkspaces.map<MenuDescriptor>((workspace) => ({
        kind: 'action',
        id: `workspace-ribbon-add-${workspace.id}`,
        label: workspace.label,
        icon: workspace.icon || 'folder',
        onSelect: () => {
          requestAddToRibbon(workspace.id);
          return { kind: 'close-all' };
        },
      }))
      : [{
        kind: 'status' as const,
        id: 'workspace-ribbon-add-empty',
        label: 'No hidden workspaces',
      }]),
    {
      kind: 'separator',
      id: 'workspace-ribbon-add-actions-separator',
    },
    {
      kind: 'action',
      id: 'workspace-ribbon-add-project',
      label: 'Add Project',
      icon: 'drive_folder_upload',
      onSelect: () => {
        closeRibbon();
        openAddModal();
        return { kind: 'close-all' };
      },
    },
    {
      kind: 'action',
      id: 'workspace-ribbon-create-project',
      label: 'Create New',
      icon: 'create_new_folder',
      onSelect: () => {
        closeRibbon();
        openCreateModal();
        return { kind: 'close-all' };
      },
    },
  ], [
    closeRibbon,
    hiddenWorkspaces,
    openAddModal,
    openCreateModal,
    requestAddToRibbon,
  ]);

  const setTrigger = useCallback((node: HTMLButtonElement | null) => {
    const previous = triggerRef.current;
    if (previous && previous !== node) {
      menuRef.current?.close('replaced');
      menuRef.current = null;
    }
    triggerRef.current = node;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      menuRef.current?.close('programmatic');
      menuRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ribbonOpen) return;
    menuRef.current?.close('programmatic');
  }, [ribbonOpen]);

  useEffect(() => {
    menuRef.current?.update(items);
  }, [items]);

  const toggleMenu = useCallback(() => {
    const currentMenu = menuRef.current;
    if (currentMenu?.isOpen()) {
      currentMenu.close('cancel');
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger || !ribbonOpen) return;

    currentMenu?.close('replaced');
    const handle: MenuHandle = openMenuTree({
      anchor: { kind: 'element', element: trigger, placement: 'below-start' },
      invocationElement: trigger,
      items,
      ariaLabel: 'Add workspace to ribbon',
      minWidth: 300,
      zIndex: 'calc(var(--z-overlay, 1000) + 3)',
      restoreInvocationFocus: () => {
        if (menuRef.current === handle && triggerRef.current === trigger && trigger.isConnected) {
          trigger.focus({ preventScroll: true });
        }
      },
      focusAfterAction: () => {
        if (menuRef.current === handle && triggerRef.current === trigger && trigger.isConnected) {
          trigger.focus({ preventScroll: true });
        }
      },
      onClose: () => {
        if (menuRef.current !== handle) return;
        menuRef.current = null;
        if (mountedRef.current) setExpanded(false);
      },
    });
    menuRef.current = handle;
    setExpanded(true);
  }, [items, ribbonOpen]);

  return (
    <div className="rv-workspace-ribbon-add-wrap">
      <button
        ref={setTrigger}
        className="rv-workspace-ribbon-add"
        onClick={toggleMenu}
        type="button"
        title="Add to ribbon"
        aria-haspopup="menu"
        aria-expanded={expanded}
      >
        <span className="material-symbols-outlined rv-workspace-ribbon-add-icon">
          add
        </span>
        <span className="rv-workspace-ribbon-add-label">Add</span>
      </button>
    </div>
  );
}
