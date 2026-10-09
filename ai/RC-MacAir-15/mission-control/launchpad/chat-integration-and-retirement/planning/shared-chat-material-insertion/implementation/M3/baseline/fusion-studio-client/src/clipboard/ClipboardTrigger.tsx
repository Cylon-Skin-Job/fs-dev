/**
 * @module ClipboardTrigger
 * @role Icon button that triggers the clipboard popover.
 *
 * Click on a row → capture its composer → fetch via clipboard:use → commit
 * prepared text through the shared material owner. Secret-typed rows render their stored
 * fingerprint as the preview. Per-row trash-can deletes via clipboard:delete.
 */

import type { BeginChatMaterialSource, ChatMaterialSource } from '../lib/chat-material-source';
import { useEffect, useState, useRef } from 'react';
import {
  useHoverIconModal,
  useListNavigation,
  HoverIconTrigger,
  HoverIconModalContainer,
  HoverIconModalRow,
  HoverIconModalList,
  HoverIconModalContent,
  HoverIconModalLoading,
  HoverIconModalEmpty,
} from '../components/hover-icon-modal';
import { useClipboardStore } from './clipboard-store';
import { listPage, fetchEntryValue, deleteEntry } from './clipboard-api';
import type { ClipboardEntry } from './types';
import './Clipboard.css';

interface ClipboardTriggerProps {
  beginMaterial?: BeginChatMaterialSource;
  triggerVariant?: 'icon' | 'submenu';
}

export function ClipboardTrigger({ beginMaterial, triggerVariant = 'icon' }: ClipboardTriggerProps) {
  const [popoverPos, setPopoverPos] = useState<{ left: number; bottom: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const items = useClipboardStore((s) => s.items);
  const isLoading = useClipboardStore((s) => s.isLoading);
  const error = useClipboardStore((s) => s.error);

  const handleOpen = () => {
    if (items.length === 0) {
      loadItems();
    }
  };

  const loadItems = async () => {
    try {
      useClipboardStore.getState().setLoading(true);
      const { items: newItems, total } = await listPage(0, 50);
      useClipboardStore.getState().setItems(newItems, total);
    } catch (err) {
      console.error('[Clipboard] Failed to load items:', err);
      useClipboardStore.getState().setError('Failed to load clipboard history');
    } finally {
      useClipboardStore.getState().setLoading(false);
    }
  };

  const {
    isOpen,
    state,
    triggerRef,
    popoverRef,
    triggerProps,
    popoverProps,
    close,
  } = useHoverIconModal({
    onOpen: handleOpen,
  });

  // Reverse items so newest is at bottom.
  const displayItems = [...items].reverse();

  const prepareEntry = async (entry: ClipboardEntry, source: ChatMaterialSource) => {
    try {
      const value = await fetchEntryValue(entry.id);
      await source.text(value);
    } catch {
      await source.fail();
    }
  };
  const handleSelect = (entry: ClipboardEntry) => {
    const begin = beginMaterial?.();
    if (begin?.status === 'ready') void prepareEntry(entry, begin.source);
  };
  const handleInsertTopRanked = async () => {
    const begin = beginMaterial?.();
    if (begin?.status !== 'ready') return;
    try {
      const { items: rankedItems } = await listPage(0, 1);
      if (rankedItems[0] && !begin.source.signal.aborted) await prepareEntry(rankedItems[0], begin.source);
      else await begin.source.fail();
    } catch {
      await begin.source.fail();
    }
  };

  const {
    selectedIndex,
    handleItemClick,
    handleItemHover,
  } = useListNavigation<ClipboardEntry>({
    items: displayItems,
    isOpen,
    onSelect: handleSelect,
    onClose: close,
    selectFromBottom: true,
  });

  const handleDelete = async (e: React.MouseEvent, entry: ClipboardEntry) => {
    e.stopPropagation();
    try {
      await deleteEntry(entry.id);
      // The server broadcasts clipboard:state on success and the store
      // syncs from there; the optimistic local removal here keeps the row
      // from briefly persisting if the broadcast lag is perceptible.
      const { items: cur, total } = useClipboardStore.getState();
      useClipboardStore.getState().setItems(
        cur.filter((i) => i.id !== entry.id),
        Math.max(0, total - 1),
      );
    } catch (err) {
      console.error('[Clipboard] deleteEntry failed:', err);
    }
  };

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (triggerVariant === 'submenu') {
        const modalWidth = 600;
        setPopoverPos({
          left: Math.min(rect.right + 12, window.innerWidth - modalWidth - 12),
          bottom: Math.max(12, window.innerHeight - rect.bottom),
        });
      } else {
        setPopoverPos({
          left: rect.left,
          bottom: window.innerHeight - rect.top + 12,
        });
      }
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [isOpen, triggerRef, triggerVariant]);

  return (
    <>
      {triggerVariant === 'submenu' ? (
        <div className="rv-chat-composer-menu-row" role="none">
          <button
            type="button"
            className="rv-chat-composer-menu-icon-action"
            onClick={() => void handleInsertTopRanked()}
            title="Insert top clipboard item"
            aria-label="Insert top clipboard item"
            role="menuitem"
          >
            <span className="material-symbols-outlined" aria-hidden="true">content_paste</span>
          </button>
          <button
            ref={triggerRef}
            type="button"
            className={`rv-chat-composer-menu-submenu${isOpen ? ' open' : ''}`}
            title="Browse clipboard history"
            aria-label="Browse clipboard history"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            role="menuitem"
            {...triggerProps}
          >
            <span>Clipboard</span>
            <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      ) : (
        <HoverIconTrigger
          icon="content_paste"
          title="Clipboard history (click to open)"
          isOpen={isOpen}
          triggerRef={triggerRef}
          triggerProps={triggerProps}
        />
      )}

      <HoverIconModalContainer
        isOpen={isOpen}
        state={state}
        position={popoverPos ?? { left: 0, bottom: 0 }}
        popoverRef={popoverRef}
        popoverProps={popoverProps}
      >
        {isLoading && items.length === 0 ? (
          <HoverIconModalLoading />
        ) : error ? (
          <HoverIconModalEmpty icon="error" message={error} />
        ) : items.length === 0 ? (
          <HoverIconModalEmpty message="No clipboard history" />
        ) : (
          <HoverIconModalList listRef={listRef}>
            {displayItems.map((entry, index) => (
              <HoverIconModalRow
                key={entry.id}
                onClick={() => handleItemClick(entry)}
                onMouseEnter={() => handleItemHover(index)}
                isSelected={index === selectedIndex}
              >
                {entry.type === 'secret' && (
                  <span
                    className="material-symbols-outlined rv-clipboard-row-icon"
                    aria-label="secret"
                  >
                    lock
                  </span>
                )}
                <HoverIconModalContent
                  primary={entry.preview}
                  secondary={formatDate(entry.last_used_at)}
                />
                <button
                  type="button"
                  className="rv-clipboard-row-delete"
                  title="Remove this entry"
                  aria-label="Remove this clipboard entry"
                  onClick={(e) => handleDelete(e, entry)}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </HoverIconModalRow>
            ))}
          </HoverIconModalList>
        )}
      </HoverIconModalContainer>
    </>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60 * 1000) return 'Just now';
  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / (60 * 1000));
    return `${mins}m ago`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}h ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
