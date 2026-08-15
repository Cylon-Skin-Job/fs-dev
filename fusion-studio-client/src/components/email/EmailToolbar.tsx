/**
 * @module EmailToolbar
 * @role Thin Gmail-style action toolbar above the message list. All actions
 *       are stubs until the mail engine lands (Email_Workspace_SPEC).
 */

import './EmailToolbar.css';

interface ToolbarAction {
  icon: string;
  label: string;
}

interface EmailToolbarProps {
  showSelect?: boolean;
  ariaLabel?: string;
}

const TOOLBAR_GROUPS: ToolbarAction[][] = [
  [
    { icon: 'archive', label: 'Archive' },
    { icon: 'report', label: 'Report spam' },
    { icon: 'delete', label: 'Delete' },
  ],
  [
    { icon: 'mark_email_unread', label: 'Mark as unread' },
    { icon: 'schedule', label: 'Snooze' },
    { icon: 'folder_check', label: 'Labels and folders' },
  ],
  [
    { icon: 'add_task', label: 'Add task' },
    { icon: 'calendar_add_on', label: 'Add to calendar' },
  ],
];

export function EmailToolbar({
  showSelect = true,
  ariaLabel = 'Message actions',
}: EmailToolbarProps) {
  return (
    <div className="rv-email-toolbar" role="toolbar" aria-label={ariaLabel}>
      {showSelect ? (
        <div className="rv-email-toolbar-select">
          <button
            type="button"
            className="rv-email-toolbar-btn"
            title="Select"
            aria-label="Select"
          >
            <span className="material-symbols-outlined" aria-hidden="true">check_box_outline_blank</span>
          </button>
          <button
            type="button"
            className="rv-email-toolbar-btn rv-email-toolbar-btn--arrow"
            title="Select options"
            aria-label="Select options"
          >
            <span className="material-symbols-outlined" aria-hidden="true">arrow_drop_down</span>
          </button>
        </div>
      ) : null}
      {TOOLBAR_GROUPS.map((group, groupIndex) => (
        <div className="rv-email-toolbar-group" key={groupIndex}>
          {groupIndex > 0 ? (
            <div className="rv-email-toolbar-separator" role="separator" />
          ) : null}
          {group.map((action) => (
            <button
              key={action.icon}
              type="button"
              className="rv-email-toolbar-btn"
              title={action.label}
              aria-label={action.label}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{action.icon}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
