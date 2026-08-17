import { useChatFileLinkStore } from '../../state/chatFileLinkStore';
import type { SyntheticEvent } from 'react';

export function ChatLinkAttachments() {
  const attachments = useChatFileLinkStore((state) => state.pendingAttachments);
  const removePendingAttachment = useChatFileLinkStore((state) => state.removePendingAttachment);

  const handleRemove = (event: SyntheticEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    removePendingAttachment(id);
  };

  return (
    <>
      {attachments.map((attachment) => (
        <span
          key={attachment.id}
          className="rv-chat-attachment-pill"
          title={attachment.path}
          data-kind={attachment.kind}
        >
          <span className="material-symbols-outlined" aria-hidden="true">link_2</span>
          <span className="rv-chat-attachment-pill-label">{attachment.label}</span>
          <button
            type="button"
            className="rv-chat-attachment-pill-remove"
            aria-label={`Remove ${attachment.label}`}
            onPointerDown={(event) => handleRemove(event, attachment.id)}
            onClick={(event) => handleRemove(event, attachment.id)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </span>
      ))}
    </>
  );
}
