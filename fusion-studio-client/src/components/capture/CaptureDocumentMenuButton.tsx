import { useCallback, useEffect, useRef, useState } from 'react';
import { openMenuTree } from '../menu';
import type { MenuDescriptor, MenuHandle } from '../menu';

interface CaptureDocumentMenuButtonProps {
  fileName: string;
  className: string;
  onRename?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export function CaptureDocumentMenuButton({
  fileName,
  className,
  onRename,
  onArchive,
  onDelete,
}: CaptureDocumentMenuButtonProps) {
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
    const items: MenuDescriptor[] = [
      {
        kind: 'action',
        id: 'capture-document-rename',
        label: 'Rename',
        icon: 'drive_file_rename',
        onSelect: () => {
          onRename?.();
          return { kind: 'close-all' };
        },
      },
      {
        kind: 'action',
        id: 'capture-document-copy',
        label: 'Make a Copy',
        icon: 'note_stack_add',
        onSelect: () => ({ kind: 'close-all' }),
      },
      ...(onArchive ? [{
        kind: 'action' as const,
        id: 'capture-document-archive',
        label: 'Archive',
        icon: 'archive',
        onSelect: () => {
          onArchive();
          return { kind: 'close-all' as const };
        },
      }] : []),
      {
        kind: 'action',
        id: 'capture-document-delete',
        label: 'Delete',
        icon: 'delete',
        tone: 'destructive',
        onSelect: () => {
          onDelete?.();
          return { kind: 'close-all' };
        },
      },
    ];

    menuRef.current?.close('replaced');
    let handle: MenuHandle;
    handle = openMenuTree({
      anchor: { kind: 'element', element: trigger, placement: 'below-start' },
      items,
      ariaLabel: `Actions for ${fileName}`,
      minWidth: 160,
      restoreInvocationFocus: () => triggerRef.current?.focus({ preventScroll: true }),
      focusAfterAction: () => triggerRef.current?.focus({ preventScroll: true }),
      onClose: () => {
        if (menuRef.current === handle) menuRef.current = null;
        setExpanded(false);
      },
    });
    menuRef.current = handle;
    setExpanded(true);
  }, [fileName, onArchive, onDelete, onRename]);

  return (
    <button
      ref={triggerRef}
      type="button"
      className={className}
      aria-label={`More actions for ${fileName}`}
      aria-haspopup="menu"
      aria-expanded={expanded}
      title="More actions"
      onClick={(event) => {
        event.stopPropagation();
        openMenu();
      }}
    >
      <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
    </button>
  );
}
