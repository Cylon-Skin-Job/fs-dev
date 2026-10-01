/** Shared-menu adapter for one visible group row. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openMenuTree, type MenuDescriptor, type MenuHandle } from '../menu';
import type { Thread } from '../../types';
import type { ThreadMemberProjection } from '../../types/threadGroupMember';

export interface ThreadRailRowMenuProps {
  row: Thread;
  members: ThreadMemberProjection[];
  onRequestMembers?: (row: Thread) => void;
  onOpenMember?: (row: Thread, member: ThreadMemberProjection) => void;
  onCopyLinkMember?: (row: Thread, member: ThreadMemberProjection) => void;
  onStartRename: (row: Thread) => void;
  onCopyLink: (row: Thread) => void;
  onViewMarkdown: (row: Thread) => void;
  onDelete: (row: Thread) => void;
}

export function ThreadRailRowMenu({
  row, members, onRequestMembers, onOpenMember, onCopyLinkMember,
  onStartRename, onCopyLink, onViewMarkdown, onDelete,
}: ThreadRailRowMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<MenuHandle | null>(null);
  const [expanded, setExpanded] = useState(false);
  const items = useMemo<MenuDescriptor[]>(() => [
    ...(onOpenMember && members.some((member) => !member.isPrimary)
      ? [{ kind: 'heading' as const, id: 'side-chats', label: 'Side chats' },
        ...members.filter((member) => !member.isPrimary).flatMap<MenuDescriptor>((member) => [
          { kind: 'action', id: `open-${member.threadId}`,
            label: `${member.label || member.threadId}${member.placementDisposition === 'closed' ? ' (closed)' : ''}`,
            icon: 'subdirectory_arrow_right',
            onSelect: () => { onOpenMember(row, member); return { kind: 'close-all' }; } },
          ...(onCopyLinkMember ? [{ kind: 'action' as const, id: `copy-${member.threadId}`,
            label: `Copy link to ${member.label || member.threadId}`, icon: 'link_2',
            onSelect: () => { onCopyLinkMember(row, member); return { kind: 'close-all' as const }; } }] : []),
        ])]
      : []),
    { kind: 'action', id: 'rename', label: 'Rename', icon: 'edit',
      onSelect: () => { onStartRename(row); return { kind: 'close-all' }; } },
    { kind: 'action', id: 'copy-link', label: 'Copy Link', icon: 'link_2',
      onSelect: () => { onCopyLink(row); return { kind: 'close-all' }; } },
    { kind: 'action', id: 'view-markdown', label: 'View Markdown', icon: 'docs',
      onSelect: () => { onViewMarkdown(row); return { kind: 'close-all' }; } },
    { kind: 'action', id: 'delete', label: 'Delete', icon: 'delete', tone: 'destructive',
      onSelect: () => {
        if (window.confirm('Delete this conversation?')) onDelete(row);
        return { kind: 'close-all' };
      } },
  ], [row, members, onOpenMember, onCopyLinkMember, onStartRename, onCopyLink,
    onViewMarkdown, onDelete]);

  useEffect(() => { menuRef.current?.update(items); }, [items]);
  useEffect(() => () => { menuRef.current?.close('programmatic'); menuRef.current = null; }, []);

  const toggle = useCallback(() => {
    if (menuRef.current?.isOpen()) { menuRef.current.close('cancel'); return; }
    const trigger = triggerRef.current;
    if (!trigger) return;
    onRequestMembers?.(row);
    let handle: MenuHandle;
    handle = openMenuTree({
      anchor: { kind: 'element', element: trigger, placement: 'below-start' },
      invocationElement: trigger,
      items,
      ariaLabel: 'Thread options',
      restoreInvocationFocus: () => { if (trigger.isConnected) trigger.focus({ preventScroll: true }); },
      focusAfterAction: () => { if (trigger.isConnected) trigger.focus({ preventScroll: true }); },
      onClose: () => { if (menuRef.current === handle) menuRef.current = null; setExpanded(false); },
    });
    menuRef.current = handle;
    setExpanded(true);
  }, [items, onRequestMembers, row]);

  return <button
    ref={triggerRef}
    type="button"
    className="rv-thread-menu-btn"
    onClick={(event) => { event.stopPropagation(); toggle(); }}
    aria-label="More options"
    aria-haspopup="menu"
    aria-expanded={expanded}
    title="More options"
  ><span className="material-symbols-outlined">more_vert</span></button>;
}
