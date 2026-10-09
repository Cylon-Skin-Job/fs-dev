/**
 * @module EmailMessageList
 * @role Left column of the mail surface: selectable list of messages.
 */

import type { FakeEmailMessage } from './emailFakeData';

interface EmailMessageListProps {
  messages: FakeEmailMessage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const MESSAGE_ROW_ACTIONS = [
  { icon: 'archive', label: 'Archive' },
  { icon: 'delete', label: 'Trash' },
  { icon: 'mark_email_unread', label: 'Mark unread' },
  { icon: 'schedule', label: 'Snooze' },
] as const;

export function EmailMessageList({ messages, selectedId, onSelect }: EmailMessageListProps) {
  return (
    <ul className="rv-email-message-list" aria-label="Messages">
      {messages.map((message) => {
        const isSelected = message.id === selectedId;
        const className = [
          'rv-email-message-item',
          message.unread ? 'unread' : '',
          isSelected ? 'selected' : '',
        ].filter(Boolean).join(' ');

        return (
          <li key={message.id} className={className}>
            <button
              type="button"
              className="rv-email-message-checkbox"
              title={`Select ${message.subject}`}
              aria-label={`Select ${message.subject}`}
            >
              <span className="material-symbols-outlined" aria-hidden="true">check_box_outline_blank</span>
            </button>
            <button
              type="button"
              className="rv-email-message-content"
              aria-current={isSelected ? 'true' : undefined}
              onClick={() => onSelect(message.id)}
            >
              <div className="rv-email-message-item-top">
                <span className="rv-email-message-from">{message.from}</span>
                <span className="rv-email-message-time">{message.time}</span>
              </div>
              <div className="rv-email-message-subject">{message.subject}</div>
              <div className="rv-email-message-item-bottom">
                <span className="rv-email-message-snippet">{message.snippet}</span>
                {message.folder ? (
                  <span className="rv-email-message-chip">{message.folder}</span>
                ) : null}
              </div>
            </button>
            <div className="rv-email-message-hover-actions" aria-label="Message row actions">
              {MESSAGE_ROW_ACTIONS.map((action) => (
                <button
                  key={action.icon}
                  type="button"
                  className="rv-email-message-hover-action"
                  title={action.label}
                  aria-label={action.label}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{action.icon}</span>
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
