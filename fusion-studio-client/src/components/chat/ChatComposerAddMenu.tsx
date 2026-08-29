/**
 * @module ChatComposerAddMenu
 * @role Composer add menu for capture actions and saved screenshot browsing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScreenshotsTrigger } from '../../screenshots';
import { captureAndAttachScreenshot } from '../../screenshots/chatScreenshotCapture';
import type { ScreenshotAttachmentOwner } from '../../screenshots/chatScreenshotCapture';
import { ClipboardTrigger } from '../../clipboard';
import { RecentFilesTrigger } from '../../recent-files';
import type { ChatLinkAttachment } from '../../lib/chat-file-links/file-link-types';

interface ChatComposerAddMenuProps {
  onAttach: (attachment: ChatLinkAttachment) => void;
  onInsert: (text: string) => void;
  screenshotOwner: ScreenshotAttachmentOwner | null;
}

export function ChatComposerAddMenu({ onAttach, onInsert, screenshotOwner }: ChatComposerAddMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [open]);

  const handleCapture = useCallback(() => {
    setOpen(false);
    if (screenshotOwner) void captureAndAttachScreenshot(screenshotOwner);
  }, [screenshotOwner]);

  const handleAttach = useCallback((attachment: ChatLinkAttachment) => {
    setOpen(false);
    onAttach(attachment);
  }, [onAttach]);

  const handleInsert = useCallback((text: string) => {
    setOpen(false);
    onInsert(text);
  }, [onInsert]);

  return (
    <div className="rv-chat-composer-add" ref={rootRef}>
      <button
        type="button"
        className={`rv-hover-icon-trigger rv-chat-composer-add-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        title="Add"
        aria-label="Add"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined" aria-hidden="true">add</span>
      </button>

      {open && (
        <div className="rv-dropdown rv-chat-composer-add-menu" data-open="true" role="menu">
          <div className="rv-chat-composer-menu-row rv-chat-composer-menu-row--first" role="none">
            <button
              type="button"
              className="rv-chat-composer-menu-icon-action"
              onClick={handleCapture}
              title="Take screenshot"
              aria-label="Take screenshot"
              role="menuitem"
            >
              <span className="material-symbols-outlined" aria-hidden="true">control_camera</span>
            </button>
            <ScreenshotsTrigger
              onAttach={handleAttach}
              triggerVariant="submenu"
            />
          </div>
          <ClipboardTrigger onInsert={handleInsert} triggerVariant="submenu" />
          <RecentFilesTrigger onInsert={handleInsert} triggerVariant="submenu" />
        </div>
      )}
    </div>
  );
}
