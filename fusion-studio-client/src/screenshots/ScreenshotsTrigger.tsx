/**
 * @module ScreenshotsTrigger
 * @role Icon button showing screenshots from System_Manager/Screenshots/
 */

import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import type { ChatLinkAttachment } from '../lib/chat-file-links/file-link-types';
import { createSendToChatAttachment } from '../lib/chat-file-links/send-to-chat-reference-label';
import {
  useHoverIconModal,
  useListNavigation,
  HoverIconTrigger,
  HoverIconModalContainer,
  HoverIconModalList,
  HoverIconModalThumb,
  HoverIconModalContent,
  HoverIconModalLoading,
  HoverIconModalEmpty,
  HoverIconModalPreview,
} from '../components/hover-icon-modal';

interface ScreenshotItem {
  name: string;
  path: string;
  url: string;
  timestamp: number;
  displayName: string;
}

interface ScreenshotsTriggerProps {
  onAttach?: (attachment: ChatLinkAttachment) => void;
  triggerVariant?: 'icon' | 'submenu';
}

export function ScreenshotsTrigger({ onAttach, triggerVariant = 'icon' }: ScreenshotsTriggerProps) {
  const [screenshots, setScreenshots] = useState<Array<{ name: string; path: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ left: number; bottom: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<ScreenshotItem | null>(null);
  const [previewPos, setPreviewPos] = useState<{ left: number; top: number } | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const loadScreenshots = useCallback(() => {
    setLoading(true);
    const listScreenshots = window.electronAPI?.listScreenshots;
    if (!listScreenshots) {
      setLoading(false);
      return;
    }
    listScreenshots()
      .then((files) => {
        setScreenshots(files);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    screenshots.forEach(({ name, path }) => {
      if (imageUrls[path]) return;
      window.electronAPI?.readScreenshot(name)
        .then(({ base64, mimeType }) => {
          if (cancelled) return;
          setImageUrls((prev) => ({ ...prev, [path]: `data:${mimeType};base64,${base64}` }));
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [screenshots, imageUrls]);

  const handleOpen = useCallback(() => {
    if (screenshots.length === 0) {
      loadScreenshots();
    }
  }, [screenshots.length, loadScreenshots]);

  const parseScreenshotName = (filename: string): { displayName: string; timestamp: number } => {
    const baseName = filename.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
    const match = baseName.match(/^Screenshot (\d{4})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2}) (AM|PM)$/i);

    if (match) {
      const [, year, month, day, hour, minute, second, meridian] = match;
      let hours = parseInt(hour, 10);
      if (meridian.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (meridian.toUpperCase() === 'AM' && hours === 12) hours = 0;

      const date = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        hours,
        parseInt(minute, 10),
        parseInt(second, 10)
      );

      return {
        displayName: baseName,
        timestamp: date.getTime(),
      };
    }

    return {
      displayName: baseName,
      timestamp: 0,
    };
  };

  const screenshotItems: ScreenshotItem[] = useMemo(() => {
    const items = screenshots.map(({ name, path }) => {
      const parsed = parseScreenshotName(name);
      return {
        name,
        path,
        url: imageUrls[path] || '',
        timestamp: parsed.timestamp,
        displayName: parsed.displayName,
      };
    });
    items.sort((a, b) => a.timestamp - b.timestamp);
    return items;
  }, [screenshots, imageUrls]);

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
    id: 'screenshots',
  });

  const visibleItems = useMemo(() => screenshotItems.slice(-20), [screenshotItems]);

  const handleSelect = useCallback((item: ScreenshotItem) => {
    onAttach?.(createSendToChatAttachment({
      panel: 'screenshots',
      relativePath: `Data/Screenshots/${item.name}`,
      absolutePath: item.path,
    }));
  }, [onAttach]);

  const {
    selectedIndex,
    handleItemClick,
    handleItemHover,
  } = useListNavigation<ScreenshotItem>({
    items: visibleItems,
    isOpen,
    onSelect: handleSelect,
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
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [isOpen, triggerRef, triggerVariant]);

  const handleMouseEnter = useCallback(
    (item: ScreenshotItem, index: number, e: React.MouseEvent) => {
      handleItemHover(index);
      setHoveredItem(item);
      const rect = e.currentTarget.getBoundingClientRect();
      setPreviewPos({
        left: rect.right + 12,
        top: rect.top,
      });
    },
    [handleItemHover]
  );

  return (
    <>
      {triggerVariant === 'submenu' ? (
        <button
          ref={triggerRef}
          type="button"
          className={`rv-chat-composer-menu-submenu${isOpen ? ' open' : ''}`}
          title="Browse screenshots"
          aria-label="Browse screenshots"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          role="menuitem"
          {...triggerProps}
        >
          <span>Screenshots</span>
          <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </button>
      ) : (
        <HoverIconTrigger
          icon="photo_size_select_large"
          title="Screenshots gallery (click to lock)"
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
        {loading && screenshots.length === 0 ? (
          <HoverIconModalLoading />
        ) : screenshots.length === 0 ? (
          <HoverIconModalEmpty
            icon="image_not_supported"
            message="No screenshots found"
            hint="ai/<machine>/Data/Screenshots"
          />
        ) : (
          <>
            <HoverIconModalList listRef={listRef}>
              {visibleItems.map((item, index) => (
                <div
                  key={item.name}
                  className={`rv-hover-icon-modal-row ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={(e) => handleMouseEnter(item, index, e)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <HoverIconModalThumb src={item.url} alt={item.displayName} />
                  <HoverIconModalContent primary={item.displayName} />
                </div>
              ))}
            </HoverIconModalList>

            {hoveredItem && previewPos && (
              <HoverIconModalPreview
                src={hoveredItem.url}
                label={hoveredItem.displayName}
                position={previewPos}
              />
            )}
          </>
        )}
      </HoverIconModalContainer>
    </>
  );
}
