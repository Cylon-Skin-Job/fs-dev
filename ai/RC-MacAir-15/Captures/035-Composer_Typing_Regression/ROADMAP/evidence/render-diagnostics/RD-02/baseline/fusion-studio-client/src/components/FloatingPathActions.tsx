import { CopyPathButton } from './CopyPathButton';
import { SendToChatButton } from './SendToChatButton';
import './FloatingPathActions.css';

interface FloatingPathActionsProps {
  panel: string;
  relativePath: string;
  className?: string;
  copyTitle?: string;
  sendTitle?: string;
  ariaLabel?: string;
}

export function FloatingPathActions({
  panel,
  relativePath,
  className = '',
  copyTitle = 'Copy path',
  sendTitle = 'Send path to chat',
  ariaLabel = 'Document actions',
}: FloatingPathActionsProps) {
  return (
    <div
      className={`rv-floating-path-actions${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      <CopyPathButton
        panel={panel}
        relativePath={relativePath}
        className="rv-file-page-action"
        title={copyTitle}
      />
      <SendToChatButton
        panel={panel}
        relativePath={relativePath}
        className="rv-file-page-action"
        title={sendTitle}
      />
    </div>
  );
}
