/**
 * @module RecentFilesTrigger
 * @role Icon button showing recently edited files
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { usePanelStore } from '../state/panelStore';
import {
  useHoverIconModal,
  useListNavigation,
  HoverIconTrigger,
  HoverIconModalContainer,
  HoverIconModalList,
  HoverIconModalContent,
  HoverIconModalLoading,
  HoverIconModalEmpty,
} from '../components/hover-icon-modal';

interface RecentFile {
  name: string;
  path: string;
  mtime: number;
  size: number;
}

interface RecentFilesTriggerProps {
  onInsert?: (text: string) => void;
  triggerVariant?: 'icon' | 'submenu';
}

export function RecentFilesTrigger({ onInsert, triggerVariant = 'icon' }: RecentFilesTriggerProps) {
  const [files, setFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ left: number; bottom: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const ws = usePanelStore((state) => state.ws);
  const panel = usePanelStore((state) => state.currentPanel);

  const requestRecentFiles = useCallback((limit: number): Promise<RecentFile[]> => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Recent files are unavailable while disconnected'));
    }

    return new Promise((resolve, reject) => {
      let finished = false;
      const cleanup = () => {
        clearTimeout(timeout);
        ws.removeEventListener('message', handleMessage);
        ws.removeEventListener('close', handleClose);
      };
      const finish = (error: Error | null, result?: RecentFile[]) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (error) reject(error); else resolve(result ?? []);
      };
      const handleClose = () => finish(new Error('Connection retired while loading recent files'));
      const handleMessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type !== 'recent_files_response' || msg.panel !== panel) return;

          if (msg.success) {
            finish(null, msg.files || []);
          } else {
            finish(new Error(msg.error || 'Failed to load recent files'));
          }
        } catch {
          // Ignore unrelated non-JSON messages.
        }
      };
      const timeout = setTimeout(() => {
        finish(new Error('Timed out loading recent files'));
      }, 5000);

      ws.addEventListener('message', handleMessage);
      ws.addEventListener('close', handleClose, { once: true });
      try {
        ws.send(JSON.stringify({
          type: 'recent_files_request',
          panel,
          limit,
        }));
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Failed to load recent files'));
      }
    });
  }, [ws, panel]);

  const loadRecentFiles = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await requestRecentFiles(30));
    } catch (err) {
      console.error('[RecentFiles] Failed to load recent files:', err);
    } finally {
      setLoading(false);
    }
  }, [requestRecentFiles]);

  const handleInsertMostRecent = useCallback(async () => {
    try {
      const recentFiles = await requestRecentFiles(1);
      const mostRecent = [...recentFiles].sort((a, b) => b.mtime - a.mtime)[0];
      if (mostRecent) {
        onInsert?.(mostRecent.path);
      }
    } catch (err) {
      console.error('[RecentFiles] Failed to insert most recently edited file:', err);
    }
  }, [onInsert, requestRecentFiles]);

  const handleOpen = useCallback(() => {
    if (files.length === 0) {
      loadRecentFiles();
    }
  }, [files.length, loadRecentFiles]);

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
    id: 'recent-files',
  });

  const {
    selectedIndex,
    handleItemClick,
    handleItemHover,
  } = useListNavigation<RecentFile>({
    items: files,
    isOpen,
    onSelect: (file) => onInsert?.(file.path),
    onClose: close,
    selectFromBottom: true,
  });

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
      // Scroll to bottom to show newest
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [isOpen, triggerRef, triggerVariant]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const formatTime = (mtime: number): string => {
    const date = new Date(mtime);
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
  };

  return (
    <>
      {triggerVariant === 'submenu' ? (
        <div className="rv-chat-composer-menu-row rv-chat-composer-menu-row--last" role="none">
          <button
            type="button"
            className="rv-chat-composer-menu-icon-action"
            onClick={() => void handleInsertMostRecent()}
            title="Insert most recently edited file"
            aria-label="Insert most recently edited file"
            role="menuitem"
          >
            <span className="material-symbols-outlined" aria-hidden="true">save_clock</span>
          </button>
          <button
            ref={triggerRef}
            type="button"
            className={`rv-chat-composer-menu-submenu${isOpen ? ' open' : ''}`}
            title="Browse recent edits"
            aria-label="Browse recent edits"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            role="menuitem"
            {...triggerProps}
          >
            <span>Edits</span>
            <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      ) : (
        <HoverIconTrigger
          icon="save_clock"
          title="Recent files (click to open)"
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
        {loading && files.length === 0 ? (
          <HoverIconModalLoading />
        ) : files.length === 0 ? (
          <HoverIconModalEmpty message="No recent files" />
        ) : (
          <HoverIconModalList listRef={listRef}>
            {files.map((file, index) => (
              <div
                key={file.path}
                className={`rv-hover-icon-modal-row ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleItemClick(file)}
                onMouseEnter={() => handleItemHover(index)}
              >
                <HoverIconModalContent
                  primary={file.name}
                  secondary={`${formatSize(file.size)} • ${formatTime(file.mtime)}`}
                />
              </div>
            ))}
          </HoverIconModalList>
        )}
      </HoverIconModalContainer>
    </>
  );
}
