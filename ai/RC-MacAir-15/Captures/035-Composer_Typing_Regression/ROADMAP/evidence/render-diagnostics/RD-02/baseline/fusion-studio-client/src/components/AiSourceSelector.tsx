import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { openMenuTree } from './menu';
import type { MenuDescriptor, MenuHandle } from './menu';
import './AiSourceSelector.css';

/** App-header selector for the ai/<machine>/ source currently owned by the server. */
export function AiSourceSelector() {
  const sourceMachineName = useWorkspaceStore((state) => state.sourceMachineName);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<MenuHandle | null>(null);
  const mountedRef = useRef(true);
  const [expanded, setExpanded] = useState(false);

  const items = useMemo<MenuDescriptor[]>(() => [
    {
      kind: 'radio',
      id: 'ai-source-local',
      label: `Local: ${sourceMachineName}`,
      checked: true,
      onSelect: () => ({ kind: 'close-all' }),
    },
    {
      kind: 'radio',
      id: 'ai-source-remote',
      label: 'Remote: Not configured',
      checked: false,
      disabled: true,
      disabledReason: 'Not configured',
      onSelect: () => ({ kind: 'stay' }),
    },
  ], [sourceMachineName]);

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
    menuRef.current?.update(items);
  }, [items]);

  const toggleMenu = useCallback(() => {
    if (expanded) {
      menuRef.current?.close('cancel');
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;

    menuRef.current?.close('replaced');
    let handle: MenuHandle;
    handle = openMenuTree({
      anchor: { kind: 'element', element: trigger, placement: 'below-start' },
      invocationElement: trigger,
      items,
      ariaLabel: 'AI source',
      initialFocusId: 'ai-source-local',
      minWidth: Math.max(218, trigger.getBoundingClientRect().width),
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
  }, [expanded, items]);

  return (
    <div className="rv-ai-source-selector">
      <span className="rv-ai-source-selector__label">AI source</span>
      <button
        ref={setTrigger}
        type="button"
        className="rv-ai-source-selector__trigger"
        aria-label="AI source"
        aria-haspopup="menu"
        aria-expanded={expanded}
        title={`Local AI source: ai/${sourceMachineName}`}
        onClick={toggleMenu}
      >
        <span className="rv-ai-source-selector__value">Local: {sourceMachineName}</span>
        <span className="material-symbols-outlined rv-ai-source-selector__arrow" aria-hidden="true">
          arrow_drop_down
        </span>
      </button>
    </div>
  );
}
