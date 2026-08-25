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
}

type BookmarkType = 'flag' | 'star' | 'heart';

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

export function AssistantReplyChrome({
  source,
  payload,
  metadata,
  disabled = false,
  onCopyReply,
  onOpenBookmark,
  onCopyChatId,
}: AssistantReplyChromeProps) {
  const bookmark = getBookmarkState(metadata);

  return (
    <div
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

      <button
        type="button"
        className="rv-assistant-reply-action"
        onClick={disabled ? undefined : onCopyChatId}
        disabled={disabled || !onCopyChatId}
        aria-label="Chat ID"
        title="Chat ID"
      >
        <span className="material-symbols-outlined" aria-hidden="true">link_2</span>
      </button>

    </div>
  );
}
