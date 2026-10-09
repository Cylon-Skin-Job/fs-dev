import { useCallback, useEffect, useRef, useState } from 'react';
import { openMenuTree } from '../menu';
import type { MenuDescriptor, MenuHandle } from '../menu';

const OFFICE_NEW_MENU_ITEMS = [
  { icon: 'create_new_folder', label: 'New folder', action: 'new-folder' },
  'separator',
  { icon: 'upload_file', label: 'Import file', action: 'import-file' },
  { icon: 'drive_folder_upload', label: 'Import Folder', action: 'import-folder' },
  'separator',
  { icon: 'description', label: 'New Document', action: 'new-document' },
] as const;

interface OfficeNewMenuButtonProps {
  onNewFolder: () => void;
  onNewDocument: () => void;
}

export function OfficeNewMenuButton({
  onNewFolder,
  onNewDocument,
}: OfficeNewMenuButtonProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<MenuHandle | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => () => {
    menuRef.current?.close('programmatic');
    menuRef.current = null;
  }, []);

  const openMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    menuRef.current?.close('replaced');
    const items: MenuDescriptor[] = OFFICE_NEW_MENU_ITEMS.map((item, index) => {
      if (item === 'separator') {
        return { kind: 'separator', id: `office-new-separator-${index}` };
      }
      return {
        kind: 'action',
        id: `office-${item.action}`,
        label: item.label,
        icon: item.icon,
        onSelect: () => {
          if (item.action === 'new-folder') onNewFolder();
          else if (item.action === 'new-document') onNewDocument();
          return { kind: 'close-all' };
        },
      };
    });

    let handle: MenuHandle;
    handle = openMenuTree({
      anchor: { kind: 'element', element: trigger, placement: 'below-start' },
      items,
      ariaLabel: 'Create or import',
      minWidth: 172,
      restoreInvocationFocus: () => triggerRef.current?.focus({ preventScroll: true }),
      focusAfterAction: () => triggerRef.current?.focus({ preventScroll: true }),
      onClose: () => {
        if (menuRef.current === handle) menuRef.current = null;
        setExpanded(false);
      },
    });
    menuRef.current = handle;
    setExpanded(true);
  }, [onNewDocument, onNewFolder]);

  return (
    <div className="rv-office-new-menu">
      <button
        ref={triggerRef}
        type="button"
        className="rv-office-new-btn rv-office-sidebar-new-btn"
        aria-haspopup="menu"
        aria-expanded={expanded}
        onClick={openMenu}
      >
        New
      </button>
    </div>
  );
}
