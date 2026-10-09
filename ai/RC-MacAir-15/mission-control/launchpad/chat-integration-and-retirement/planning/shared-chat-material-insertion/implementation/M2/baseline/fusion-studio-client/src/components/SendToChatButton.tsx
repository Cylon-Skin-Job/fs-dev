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
import { beginChatMaterial, commitChatMaterial } from '../lib/chat-action';
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
  const handleClick = async () => {
    const begun = beginChatMaterial();
    if (begun.status !== 'ready') { showToast('Chat target unavailable'); return; }
    const attachment = createResourceChatAttachment(panel, relativePath);
    if (attachment) {
      const result = await commitChatMaterial(begun.operation, { attachment });
      showToast(result.status === 'applied' || result.status === 'noop' ? 'Link attached to chat' : 'Chat target unavailable');
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
