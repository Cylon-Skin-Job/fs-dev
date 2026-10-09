/**
 * @module EmailReadingPane
 * @role Right column of the mail surface: renders the selected message.
 *       Corner actions: link_2, send to chat, print, paper brightness,
 *       expand-to-full-view.
 *       Expanded mode fills the entire email shell and mirrors the inbox
 *       action header without the checkbox/select cluster.
 */

import { PaperBrightnessControl } from '../PaperBrightnessControl';
import { useEffect, useRef, useState } from 'react';
import type { FakeEmailMessage } from './emailFakeData';
import { EmailToolbar } from './EmailToolbar';

interface EmailReadingPaneProps {
  message: FakeEmailMessage | null;
  expanded: boolean;
  onToggleExpand: () => void;
  paperBrightness: number;
  onPaperBrightnessChange: (value: number) => void;
}

const MESSAGE_MENU_ITEMS = [
  { kind: 'item', icon: 'reply', label: 'Reply' },
  { kind: 'item', icon: 'forward', label: 'Forward' },
  { kind: 'separator' },
  { kind: 'item', icon: 'delete', label: 'Delete' },
  { kind: 'item', icon: 'mark_email_unread', label: 'Mark as unread' },
  { kind: 'separator' },
  { kind: 'item', icon: 'print', label: 'Print' },
  { kind: 'item', icon: 'download', label: 'Download Message' },
  { kind: 'item', icon: 'chat_paste_go', label: 'Send to Chat' },
] as const;

export function EmailReadingPane({
  message,
  expanded,
  onToggleExpand,
  paperBrightness,
  onPaperBrightnessChange,
}: EmailReadingPaneProps) {
  const [messageMenuOpen, setMessageMenuOpen] = useState(false);
  const messageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessageMenuOpen(false);
  }, [message?.id]);

  useEffect(() => {
    if (!messageMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && messageMenuRef.current?.contains(target)) return;
      setMessageMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMessageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [messageMenuOpen]);

  if (!message) {
    return (
      <div className="rv-email-reading-pane rv-email-reading-pane--empty">
        <span className="material-symbols-outlined" aria-hidden="true">mail</span>
        <span>Select a message to read</span>
      </div>
    );
  }

  return (
    <article className={`rv-email-reading-pane${expanded ? ' rv-email-reading-pane--expanded' : ''}`}>
      {expanded ? (
        <div className="rv-email-toolbar-row rv-email-reading-expanded-toolbar">
          <EmailToolbar showSelect={false} ariaLabel="Expanded message actions" />
        </div>
      ) : null}
      <header className="rv-email-reading-header">
        <h2 className="rv-email-reading-subject">{message.subject}</h2>
        {message.folder ? (
          <span className="rv-email-message-chip">{message.folder}</span>
        ) : null}
        <div className="rv-email-page-actions">
          <button
            type="button"
            className="rv-email-page-action-btn"
            title="Copy link"
            aria-label="Copy link"
          >
            <span className="material-symbols-outlined" aria-hidden="true">link_2</span>
          </button>
          <button
            type="button"
            className="rv-email-page-action-btn"
            title="Send to Chat"
            aria-label="Send to Chat"
          >
            <span className="material-symbols-outlined" aria-hidden="true">chat_paste_go</span>
          </button>
          <button
            type="button"
            className="rv-email-page-action-btn"
            title="Print"
            aria-label="Print"
          >
            <span className="material-symbols-outlined" aria-hidden="true">print</span>
          </button>
          <PaperBrightnessControl
            value={paperBrightness}
            onChange={onPaperBrightnessChange}
            ariaLabel="Page brightness"
            buttonClassName="rv-email-page-action-btn"
            buttonActiveClassName="rv-email-page-action-btn--active"
          />
          <button
            type="button"
            className="rv-email-page-action-btn"
            title={expanded ? 'Collapse' : 'Expand'}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={onToggleExpand}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {expanded ? 'collapse_content' : 'expand_content'}
            </span>
          </button>
        </div>
      </header>
      <div className="rv-email-reading-meta">
        <div className="rv-email-reading-avatar" aria-hidden="true">
          {message.from.charAt(0).toUpperCase()}
        </div>
        <div className="rv-email-reading-sender">
          <span className="rv-email-reading-from">{message.from}</span>
          {message.fromAddress ? (
            <span className="rv-email-reading-address">&lt;{message.fromAddress}&gt;</span>
          ) : null}
        </div>
        <span className="rv-email-reading-time">{message.time}</span>
        <div className="rv-email-message-actions" ref={messageMenuRef}>
          <button
            type="button"
            className="rv-email-message-action-btn"
            title="Star"
            aria-label="Star"
          >
            <span className="material-symbols-outlined" aria-hidden="true">star</span>
          </button>
          <button
            type="button"
            className="rv-email-message-action-btn"
            title="Reply"
            aria-label="Reply"
          >
            <span className="material-symbols-outlined" aria-hidden="true">reply</span>
          </button>
          <button
            type="button"
            className="rv-email-message-action-btn"
            title="More"
            aria-label="More message actions"
            aria-haspopup="menu"
            aria-expanded={messageMenuOpen}
            aria-controls="email-message-action-menu"
            onClick={() => setMessageMenuOpen((open) => !open)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
          </button>
          <div
            className="rv-dropdown rv-email-message-actions-menu"
            id="email-message-action-menu"
            role="menu"
            data-open={messageMenuOpen}
          >
            {MESSAGE_MENU_ITEMS.map((item, index) => (
              item.kind === 'separator' ? (
                <div
                  key={`separator-${index}`}
                  className="rv-email-message-actions-separator"
                  role="separator"
                />
              ) : (
                <button
                  key={item.label}
                  type="button"
                  className="rv-dropdown-item rv-email-message-actions-item"
                  role="menuitem"
                  onClick={() => setMessageMenuOpen(false)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            ))}
          </div>
        </div>
      </div>
      <div className="rv-email-reading-body">
        {message.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      <footer className="rv-email-reading-actions">
        <button type="button" className="rv-email-reading-action-btn">
          <span className="material-symbols-outlined" aria-hidden="true">reply</span>
          <span>Reply</span>
        </button>
        <button type="button" className="rv-email-reading-action-btn">
          <span className="material-symbols-outlined" aria-hidden="true">forward</span>
          <span>Forward</span>
        </button>
      </footer>
    </article>
  );
}
