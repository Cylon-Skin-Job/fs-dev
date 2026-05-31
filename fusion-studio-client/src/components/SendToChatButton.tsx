/**
 * @module SendToChatButton
 * @role Reusable "send path to chat" action button
 *
 * Resolves a panel-relative path to an absolute path and dispatches it into
 * the active chat composer via the `fusion:chat-insert` window event.
 *
 * Used by: FilePageView, OfficeDocumentTopbar, Wiki page nav, TicketBoard, etc.
 */

import { resolveAbsolutePath } from '../lib/resource-path';
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
      window.dispatchEvent(new CustomEvent('fusion:chat-insert', { detail: absPath }));
      showToast('Path sent to chat');
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
