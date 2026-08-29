import {
  chatAttachmentOwnerKey,
  useChatFileLinkStore,
} from '../../state/chatFileLinkStore';
import type { SyntheticEvent } from 'react';
import type { ChatLinkAttachment } from '../../lib/chat-file-links/file-link-types';

function pathLeaf(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).pop() || value;
}

function extension(value: string): string {
  const leaf = pathLeaf(value);
  const dot = leaf.lastIndexOf('.');
  return dot > 0 ? leaf.slice(dot + 1).toLowerCase() : '';
}

function displayName(attachment: ChatLinkAttachment): string {
  if (attachment.kind === 'folder' || attachment.kind === 'wiki' || attachment.kind === 'ticket') {
    return attachment.sourceName || pathLeaf(attachment.relativePath || attachment.path);
  }
  return pathLeaf(attachment.relativePath || attachment.path) || attachment.sourceName;
}

function typeLabel(attachment: ChatLinkAttachment): string {
  if (attachment.kind === 'folder') return 'Folder';
  if (attachment.kind === 'wiki') return 'Wiki page';
  if (attachment.kind === 'ticket') return 'Ticket';

  const ext = extension(attachment.relativePath || attachment.path);
  if (attachment.kind === 'doc' || ext === 'md' || ext === 'mdx') return 'Markdown document';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) {
    return `${ext.toUpperCase()} image`;
  }
  if (ext === 'pdf') return 'PDF document';
  return ext ? `${ext.toUpperCase()} file` : 'File';
}

function attachmentIcon(attachment: ChatLinkAttachment): string {
  if (attachment.kind === 'folder') return 'folder';
  if (attachment.kind === 'wiki') return 'full_coverage';
  if (attachment.kind === 'ticket') return 'business_messages';
  if (attachment.kind === 'doc') return 'description';

  const ext = extension(attachment.relativePath || attachment.path);
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'picture_as_pdf';
  return 'draft';
}

const EMPTY_ATTACHMENTS: ChatLinkAttachment[] = [];

interface ChatLinkAttachmentsProps {
  workspaceId: string | null;
  threadId: string | null;
}

export function ChatLinkAttachments({ workspaceId, threadId }: ChatLinkAttachmentsProps) {
  const attachments = useChatFileLinkStore((state) => {
    if (!workspaceId || !threadId) return EMPTY_ATTACHMENTS;
    const key = chatAttachmentOwnerKey(workspaceId, threadId);
    return state.pendingAttachmentsByOwner[key]?.attachments ?? EMPTY_ATTACHMENTS;
  });
  const removePendingAttachment = useChatFileLinkStore((state) => state.removePendingAttachment);

  const handleRemove = (event: SyntheticEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (workspaceId && threadId) removePendingAttachment(workspaceId, threadId, id);
  };

  const holdRemoveClick = (event: SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  if (attachments.length === 0) return null;

  return (
    <div className="rv-chat-attachments-strip" aria-label="Chat attachments">
      {attachments.map((attachment) => (
        <article
          key={attachment.id}
          className="rv-chat-attachment-pill"
          title={attachment.path}
          data-kind={attachment.kind}
        >
          <span className="rv-chat-attachment-icon" aria-hidden="true">
            <span className="material-symbols-outlined">{attachmentIcon(attachment)}</span>
          </span>
          <span className="rv-chat-attachment-details">
            <span className="rv-chat-attachment-pill-label">{displayName(attachment)}</span>
            <span className="rv-chat-attachment-type">{typeLabel(attachment)}</span>
          </span>
          <button
            type="button"
            className="rv-chat-attachment-pill-remove"
            aria-label={`Remove ${attachment.label}`}
            onPointerDown={holdRemoveClick}
            onClick={(event) => handleRemove(event, attachment.id)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </article>
      ))}
    </div>
  );
}
