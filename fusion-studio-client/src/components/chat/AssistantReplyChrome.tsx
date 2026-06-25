import { useEffect, useRef, useState } from 'react';
import type { AssistantReplySourceRef, AssistantReplyTextPayload } from '../../lib/chat/reply-text';
import './AssistantReplyChrome.css';

interface AssistantReplyChromeProps {
  source: AssistantReplySourceRef;
  payload: AssistantReplyTextPayload;
  metadata?: Record<string, unknown>;
  disabled?: boolean;
  onCopyReply: () => void | Promise<unknown>;
  onOpenBookmark?: () => void | Promise<unknown>;
  onCopyChatId?: () => void | Promise<unknown>;
  onOpenNotes?: () => void | Promise<unknown>;
}

type BookmarkType = 'flag' | 'star' | 'heart';

const MENU_ITEMS = [
  { icon: 'compress', label: 'Compress' },
  { icon: 'fork_right', label: 'Fork' },
];

function getBookmarkState(metadata: Record<string, unknown> | undefined): {
  icon: string;
  label: string;
  filled: boolean;
} {
  const bookmark = metadata?.bookmark;
  const type = typeof bookmark === 'object' && bookmark !== null && 'type' in bookmark
    ? (bookmark as { type?: unknown }).type
    : null;

  if (type === 'flag' || type === 'star' || type === 'heart') {
    const labels: Record<BookmarkType, string> = {
      flag: 'Flagged',
      star: 'Starred',
      heart: 'Liked',
    };
    return {
      icon: `bookmark_${type}`,
      label: labels[type],
      filled: true,
    };
  }

  return {
    icon: 'bookmark',
    label: 'Add bookmark',
    filled: false,
  };
}

function hasNote(metadata: Record<string, unknown> | undefined): boolean {
  const note = metadata?.note;
  if (typeof note === 'string') return note.trim().length > 0;
  if (typeof note === 'object' && note !== null && 'body' in note) {
    const body = (note as { body?: unknown }).body;
    return typeof body === 'string' && body.trim().length > 0;
  }
  return false;
}

export function AssistantReplyChrome({
  source,
  payload,
  metadata,
  disabled = false,
  onCopyReply,
  onOpenBookmark,
  onCopyChatId,
  onOpenNotes,
}: AssistantReplyChromeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const bookmark = getBookmarkState(metadata);
  const notePresent = hasNote(metadata);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const toggleMenu = () => {
    if (disabled) return;
    setMenuOpen(open => !open);
  };

  return (
    <div
      ref={rootRef}
      className={`rv-assistant-reply-chrome${disabled ? ' rv-assistant-reply-chrome--disabled' : ''}`}
      data-disabled={disabled ? 'true' : 'false'}
      data-has-text={payload.hasText ? 'true' : 'false'}
      data-message-id={source.messageId}
      data-exchange-id={source.exchangeId ?? undefined}
    >
      <button
        type="button"
        className="rv-assistant-reply-action"
        onClick={disabled ? undefined : onCopyReply}
        disabled={disabled}
        aria-label="Copy reply"
        title="Copy reply"
      >
        <span className="material-symbols-outlined" aria-hidden="true">content_copy</span>
      </button>

      <button
        type="button"
        className="rv-assistant-reply-action"
        disabled
        aria-label="Text to speech"
        title="Text to speech"
      >
        <span className="material-symbols-outlined" aria-hidden="true">text_to_speech</span>
      </button>

      <button
        type="button"
        className={`rv-assistant-reply-action${bookmark.filled ? ' rv-assistant-reply-action--filled' : ''}`}
        onClick={disabled ? undefined : onOpenBookmark}
        disabled={disabled || !onOpenBookmark}
        aria-label={bookmark.label}
        title={bookmark.label}
      >
        <span className="material-symbols-outlined" aria-hidden="true">{bookmark.icon}</span>
      </button>

      <div className="rv-assistant-reply-more">
        <button
          type="button"
          className="rv-assistant-reply-action"
          onClick={toggleMenu}
          disabled={disabled}
          aria-label="More"
          aria-expanded={menuOpen}
          title="More"
        >
          <span className="material-symbols-outlined" aria-hidden="true">more_horiz</span>
        </button>

        <div className="rv-assistant-reply-menu" data-open={menuOpen ? 'true' : 'false'} role="menu">
          {MENU_ITEMS.map(item => (
            <button
              key={item.label}
              type="button"
              className="rv-assistant-reply-menu-item"
              disabled
              aria-label={item.label}
              title={item.label}
              role="menuitem"
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="rv-assistant-reply-menu-item"
            onClick={disabled ? undefined : () => {
              onCopyChatId?.();
              setMenuOpen(false);
            }}
            disabled={disabled || !onCopyChatId}
            aria-label="Chat ID"
            title="Chat ID"
            role="menuitem"
          >
            <span className="material-symbols-outlined" aria-hidden="true">link_2</span>
            <span>Chat ID</span>
          </button>
          <button
            type="button"
            className="rv-assistant-reply-menu-item"
            onClick={disabled ? undefined : () => {
              onOpenNotes?.();
              setMenuOpen(false);
            }}
            disabled={disabled || !onOpenNotes}
            aria-label={notePresent ? 'View Note' : 'Add Note'}
            title={notePresent ? 'View Note' : 'Add Note'}
            role="menuitem"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {notePresent ? 'sticky_note_2' : 'add_notes'}
            </span>
            <span>{notePresent ? 'View Note' : 'Add Note'}</span>
          </button>
          <button
            type="button"
            className="rv-assistant-reply-menu-item"
            disabled
            aria-label="Create Ticket"
            title="Create Ticket"
            role="menuitem"
          >
            <span className="material-symbols-outlined" aria-hidden="true">local_activity</span>
            <span>Create Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
}
