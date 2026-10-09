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
import type { BeginChatMaterialSource } from '../../lib/chat-material-source';

interface ChatComposerAddMenuProps {
  beginMaterial: BeginChatMaterialSource;
  screenshotOwner: ScreenshotAttachmentOwner | null;
}

export function ChatComposerAddMenu({ beginMaterial, screenshotOwner }: ChatComposerAddMenuProps) {
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

  const handleBegin = useCallback<BeginChatMaterialSource>((options) => {
    const result = beginMaterial(options);
    if (result.status === 'ready') setOpen(false);
    return result;
  }, [beginMaterial]);

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
              beginMaterial={handleBegin}
              triggerVariant="submenu"
            />
          </div>
          <ClipboardTrigger beginMaterial={handleBegin} triggerVariant="submenu" />
          <RecentFilesTrigger beginMaterial={handleBegin} triggerVariant="submenu" />
        </div>
      )}
    </div>
  );
}
