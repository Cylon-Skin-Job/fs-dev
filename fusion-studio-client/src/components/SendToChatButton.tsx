/**
 * @module SendToChatButton
 * @role Reusable "send path to chat" action button
 *
 * Resolves a panel-relative path to an attachment pill payload and dispatches
 * it into the active chat composer via the chat action bridge.
 *
 * Used by: FilePageView, OfficeDocumentTopbar, Wiki page nav, TicketBoard, etc.
 */

import { resolveAbsolutePath } from '../lib/resource-path';
import { dispatchChatAction } from '../lib/chat-action';
import { createSendToChatAttachment } from '../lib/chat-file-links/send-to-chat-reference-label';
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
    const absPath = resolveAbsolutePath(panel, relativePath);
    if (absPath) {
      dispatchChatAction({
        attachment: createSendToChatAttachment({ panel, relativePath, absolutePath: absPath }),
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
