/**
 * @module ChatAreaHeader
 * @role Primary chat header — identity, CLI/thread dropdowns, more menu.
 *
 * Portable presentation: receives explicit state and callbacks from the mount
 * host (SPEC-02 §5.1). All DOM ids are scoped by the transient `surfaceId`
 * (§6.3) so two mounts never share header/menu identity.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { openMenuTree, type MenuDescriptor, type MenuHandle } from '../menu';
import { CliPickerDropdown } from '../CliPickerDropdown';
import { chatSurfaceDomId } from './chatSurfaceContract';
import type { HarnessStatus } from '../../types';

export interface ChatAreaHeaderProps {
  mountId: string;
  panel: string;
  headerRef: RefObject<HTMLDivElement | null>;
  hasThread: boolean;
  threadName: string;
  sidebarCollapsed?: boolean;
  contentCollapsed?: boolean;
  cliPickerOpen: boolean;
  harnessStatuses: Record<string, HarnessStatus>;
  showCliPicker: boolean;
  onHarnessSelect: (harnessId: string, modelId?: string) => void;
  onCreateThread: () => void;
  handleToggleThreads: () => void;
  onToggleContent?: () => void;
  onRename: (name: string) => void;
  onCopyLink: () => void;
  onViewMarkdown: () => void;
  canMoveToSideChat: boolean;
  onMoveToSideChat: () => void;
  onCloseCliPicker: () => void;
}

export function ChatAreaHeader({
  mountId,
  panel,
  headerRef,
  hasThread,
  threadName,
  sidebarCollapsed,
  contentCollapsed,
  cliPickerOpen,
  harnessStatuses,
  showCliPicker,
  onHarnessSelect,
  onCreateThread,
  handleToggleThreads,
  onRename,
  onCopyLink,
  onViewMarkdown,
  canMoveToSideChat,
  onMoveToSideChat,
  onCloseCliPicker,
  onToggleContent,
}: ChatAreaHeaderProps) {
  const domId = chatSurfaceDomId(mountId);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<MenuHandle | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = useMemo<MenuDescriptor[]>(() => [
    { kind: 'action', id: `${domId}-threads`, label: sidebarCollapsed ? 'Show threads' : 'Hide threads',
      icon: sidebarCollapsed ? 'left_panel_open' : 'left_panel_close',
      onSelect: () => { handleToggleThreads(); return { kind: 'close-all' }; } },
    { kind: 'action', id: `${domId}-rename`, label: 'Rename', icon: 'edit', disabled: !hasThread,
      onSelect: () => {
        const name = window.prompt('Rename thread:', threadName)?.trim();
        if (name && name !== threadName) onRename(name);
        return { kind: 'close-all' };
      } },
    { kind: 'action', id: `${domId}-copy`, label: 'Copy Link', icon: 'link_2', disabled: !hasThread,
      onSelect: () => { onCopyLink(); return { kind: 'close-all' }; } },
    { kind: 'action', id: `${domId}-markdown`, label: 'View Markdown', icon: 'docs', disabled: !hasThread,
      onSelect: () => { onViewMarkdown(); return { kind: 'close-all' }; } },
    { kind: 'action', id: `${domId}-move`, label: 'Move Chat to Side Chat', icon: 'open_in_new',
      disabled: !canMoveToSideChat,
      onSelect: () => { onMoveToSideChat(); return { kind: 'close-all' }; } },
  ], [domId, sidebarCollapsed, handleToggleThreads, hasThread, threadName, onRename, onCopyLink,
    onViewMarkdown, canMoveToSideChat, onMoveToSideChat]);
  useEffect(() => { menuRef.current?.update(items); }, [items]);
  useEffect(() => () => { menuRef.current?.close('programmatic'); menuRef.current = null; }, []);
  const toggleMenu = useCallback(() => {
    if (menuRef.current?.isOpen()) { menuRef.current.close('cancel'); return; }
    const trigger = menuTriggerRef.current;
    if (!trigger) return;
    let handle: MenuHandle;
    handle = openMenuTree({
      anchor: { kind: 'element', element: trigger, placement: 'below-start' },
      invocationElement: trigger,
      items,
      ariaLabel: 'Chat options',
      restoreInvocationFocus: () => { if (trigger.isConnected) trigger.focus({ preventScroll: true }); },
      focusAfterAction: () => { if (trigger.isConnected) trigger.focus({ preventScroll: true }); },
      onClose: () => { if (menuRef.current === handle) menuRef.current = null; setMenuOpen(false); },
    });
    menuRef.current = handle;
    setMenuOpen(true);
  }, [items]);
  return (
    <div className="rv-chat-header" ref={headerRef} data-chat-mount-id={mountId}>
      {sidebarCollapsed && (
        <div className="rv-chat-header-left-controls">
          <button
            className="rv-chat-header-btn rv-chat-thread-dock"
            onClick={handleToggleThreads}
            aria-label="Show threads"
            title="Show threads"
          >
            <span className="material-symbols-outlined">dock_to_right</span>
          </button>
          <button
            className="rv-chat-header-btn rv-chat-new-thread"
            onClick={onCreateThread}
            aria-haspopup={showCliPicker ? 'menu' : undefined}
            aria-expanded={showCliPicker ? cliPickerOpen : undefined}
            aria-controls={showCliPicker ? `cli-picker-${domId}` : undefined}
            aria-label="New chat"
            title="New chat"
          >
            <span className="material-symbols-outlined">edit_square</span>
          </button>
        </div>
      )}
      <div className="rv-chat-header-right">
        <button
          className="rv-chat-header-btn"
          ref={menuTriggerRef}
          id={`chat-more-${domId}`}
          onClick={toggleMenu}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More options"
          title="More options"
        >
          <span className="material-symbols-outlined">event_list</span>
        </button>
        {contentCollapsed && onToggleContent && (
          <button
            className="rv-chat-header-btn"
            onClick={onToggleContent}
            aria-label="Show content"
            title="Show content"
          >
            <span className="material-symbols-outlined">dock_to_right</span>
          </button>
        )}
      </div>
      {sidebarCollapsed && (
        <>
          {showCliPicker && (
            <CliPickerDropdown
              panel={panel}
              instanceKey={domId}
              open={cliPickerOpen}
              onRequestClose={onCloseCliPicker}
              statuses={harnessStatuses}
              onSelect={onHarnessSelect}
            />
          )}
        </>
      )}
    </div>
  );
}
