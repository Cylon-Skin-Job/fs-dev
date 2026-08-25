import { useEffect, useRef } from 'react';
import { showContextMenu } from '../../lib/contextMenu';

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
  const closeMenuRef = useRef<(() => void) | null>(null);

  useEffect(() => () => closeMenuRef.current?.(), []);

  return (
    <button
      type="button"
      className={className}
      aria-label={`More actions for ${fileName}`}
      title="More actions"
      onClick={(event) => {
        event.stopPropagation();
        closeMenuRef.current?.();
        const rect = event.currentTarget.getBoundingClientRect();
        closeMenuRef.current = showContextMenu({
          x: rect.left,
          y: rect.bottom + 4,
          items: [
            { label: 'Rename', icon: 'drive_file_rename', action: () => onRename?.() },
            { label: 'Make a Copy', icon: 'note_stack_add', action: () => {} },
            { label: 'Archive', icon: 'archive', action: () => onArchive?.() },
            { label: 'Delete', icon: 'delete', danger: true, action: () => onDelete?.() },
          ],
        });
      }}
    >
      <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
    </button>
  );
}
