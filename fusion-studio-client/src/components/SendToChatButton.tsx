/**
 * @module SendToChatButton
 * @role Reusable "send path to chat" action button
 *
 * Delegates panel-relative path resolution to resource-path so view content
 * roots stay server/config-driven for every consumer.
 *
 * Used by: FilePageView, OfficeDocumentTopbar, Wiki page nav, TicketBoard, etc.
 */

import { createResourceChatAttachment } from '../lib/resource-path';
import { dispatchChatAction } from '../lib/chat-action';
import { showToast } from '../lib/toast';

interface SendToChatButtonProps {
  panel: string;
  relativePath: string;
  className?: string;
  title?: string;
}

export function SendToChatButton({
  panel,
  relativePath,
  className = 'rv-file-page-action',
  title = 'Send path to chat',
}: SendToChatButtonProps) {
  const handleClick = () => {
    const attachment = createResourceChatAttachment(panel, relativePath);
    if (attachment) {
      dispatchChatAction({
        attachment,
        target: 'current',
        delivery: 'insert',
      });
      showToast('Link attached to chat');
    } else {
      showToast('Path not available');
    }
  };

  return (
    <button className={className} onClick={handleClick} title={title}>
      <span className="material-symbols-outlined">chat_paste_go</span>
    </button>
  );
}
