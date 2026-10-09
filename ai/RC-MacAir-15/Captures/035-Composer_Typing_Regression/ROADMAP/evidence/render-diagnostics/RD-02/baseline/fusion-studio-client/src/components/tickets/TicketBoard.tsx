/**
 * @module TicketBoard
 * @role Compact three-column Kanban board for the issues workspace
 * @reads ticketStore: tickets, loaded, activeTicket
 *
 * Columns determined by assignee + state (per TICKETING-SPEC):
 *   TO DO       — assigned to human (no matching bot)
 *   IN PROGRESS — assigned to bot
 *   DONE        — state: closed
 */

import { useCallback, useEffect, useState } from 'react';
import { usePanelData } from '../../hooks/usePanelData';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { useTicketStore, type Ticket } from '../../state/ticketStore';
import { FloatingPathActions } from '../FloatingPathActions';
import { SegmentedViewNav } from '../SegmentedViewNav';
import { CaptureDocumentMenuButton } from '../capture/CaptureDocumentMenuButton';
import { useTileFileActions } from '../../hooks/useTileFileActions';


// Bot names we recognize — matches registry.json
const BOT_NAMES = new Set(['kimi-wiki', 'kimi-code', 'kimi-review', 'kimi-bot']);

const NOTIFICATION_ICONS = [
  { icon: 'dangerous', label: 'Dangerous' },
  { icon: 'feedback', label: 'Feedback' },
  { icon: 'directory_sync', label: 'Directory sync' },
  { icon: 'inventory', label: 'Inventory' },
] as const;

const ISSUE_NAV_ITEMS = [
  { value: 'inbox', label: 'Alerts', controls: 'issues-inbox-panel' },
  { value: 'tickets', label: 'Tickets', controls: 'issues-ticket-panel' },
  { value: 'scheduled', label: 'Scheduled', controls: 'issues-scheduled-panel' },
  { value: 'triggers', label: 'Triggers', controls: 'issues-triggers-panel' },
] as const;

type NotificationIcon = (typeof NOTIFICATION_ICONS)[number]['icon'];

const NOTIFICATION_DEMO_ROWS: Array<{
  date: string;
  time: string;
  prefix?: string;
  icon: NotificationIcon;
  title: string;
}> = [
  { date: 'Aug 03, 2026', time: '9:14 AM', prefix: 'Stopped:', icon: 'dangerous', title: 'Pre-Deployment: Handle Full Disk Access for Packaged Calendar Module' },
  { date: 'Aug 05, 2026', time: '11:42 AM', prefix: 'Reply Needed:', icon: 'feedback', title: 'Create onboarding tickets to download with app' },
  { date: 'Aug 08, 2026', time: '2:06 PM', prefix: 'In Progress:', icon: 'directory_sync', title: 'First-run detection mechanism' },
  { date: 'Aug 11, 2026', time: '8:31 AM', icon: 'inventory', title: 'Ticket Registry: AI-Guided Onboarding via Chat' },
  { date: 'Aug 14, 2026', time: '4:18 PM', prefix: 'In Progress:', icon: 'directory_sync', title: 'Remove Electron Workspaces menu; make ribbon close a renderer-cache boundary' },
  { date: 'Aug 17, 2026', time: '10:27 AM', icon: 'inventory', title: 'Chunk E — Theme token bridge' },
  { date: 'Aug 19, 2026', time: '1:53 PM', prefix: 'In Progress:', icon: 'directory_sync', title: 'Continue view architecture build — Chunk D next' },
  { date: 'Aug 22, 2026', time: '3:35 PM', icon: 'feedback', title: 'Chunk A — File Watcher Core (lib/watch/core.js)' },
  { date: 'Aug 25, 2026', time: '9:48 AM', icon: 'dangerous', title: 'Chunk A2 — UEB File Events (file:changed via event-bus)' },
  { date: 'Aug 28, 2026', time: '5:12 PM', prefix: 'Review:', icon: 'inventory', title: 'Chunk K — Managed Server Spawn + Port Negotiation' },
];

const TRIGGER_DEMO_COLLECTIONS = [
  {
    title: 'Email',
    cards: [
      { title: 'Flagged Email Follow-Up', icons: ['mail', 'feedback'], enabled: true },
      { title: 'Attachment Intake', icons: ['attach_file', 'folder'], enabled: true },
      { title: 'Daily Inbox Digest', icons: ['inbox', 'schedule'], enabled: false },
    ],
  },
  {
    title: 'Code Review',
    cards: [
      { title: 'Pull Request Review', icons: ['code', 'rate_review'], enabled: true },
      { title: 'Failed Check Follow-Up', icons: ['error', 'notification_important'], enabled: false },
    ],
  },
  {
    title: 'System Events',
    cards: [
      { title: 'Workspace Connected', icons: ['folder_open', 'hub'], enabled: true },
      { title: 'Server Restarted', icons: ['restart_alt', 'terminal'], enabled: true },
      { title: 'Disk Space Warning', icons: ['hard_drive', 'dangerous'], enabled: false },
      { title: 'File Watcher Change', icons: ['sync', 'description'], enabled: true },
      { title: 'Build Completed', icons: ['build', 'check_circle'], enabled: false },
    ],
  },
] as const;

function isBot(assignee: string): boolean {
  return BOT_NAMES.has(assignee);
}

function ticketFolder(ticket: Ticket): string {
  if (ticket.state === 'closed') return 'closed';
  return isBot(ticket.assignee) ? 'open' : 'inbox';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

function ticketSummary(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function assigneeInitial(assignee: string): string {
  return assignee.trim().charAt(0).toUpperCase() || '?';
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const activeTicket = useTicketStore((s) => s.activeTicket);
  const setActive = useTicketStore((s) => s.setActiveTicket);
  const bot = isBot(ticket.assignee);
  const completed = ticket.state === 'closed';
  const summary = ticketSummary(ticket.body);

  const toggleActive = () => {
    setActive(activeTicket === ticket.id ? null : ticket.id);
  };

  return (
    <div
      className={`rv-ticket-card ${activeTicket === ticket.id ? 'active' : ''} ${completed ? 'completed' : ''}`}
      onClick={toggleActive}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleActive();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={activeTicket === ticket.id}
    >
      <div className="rv-ticket-card-id-row">
        <div className="rv-ticket-card-tags">
          <span className="rv-ticket-card-tag rv-ticket-card-tag-id">
            <span className="rv-ticket-card-tag-dot" />
            {ticket.id}
          </span>
          {ticket.priority && (
            <span className={`rv-ticket-card-tag rv-ticket-card-priority rv-ticket-card-priority-${ticket.priority.toLowerCase()}`}>
              <span className="rv-ticket-card-tag-dot" />
              {ticket.priority}
            </span>
          )}
        </div>
        <div className="rv-ticket-card-trailing">
          {completed && (
            <span className="rv-ticket-card-complete" aria-label="Completed">
              <span className="material-symbols-outlined">check</span>
            </span>
          )}
        </div>
      </div>
      <div className="rv-ticket-card-title">{ticket.title}</div>
      {summary && <div className="rv-ticket-card-summary">{summary}</div>}
      <div className="rv-ticket-card-meta">
        <span className={`rv-ticket-card-assignee ${bot ? 'rv-ticket-card-bot' : ''}`}>
          <span className="rv-ticket-card-avatar">
            {bot ? <span className="material-symbols-outlined">smart_toy</span> : assigneeInitial(ticket.assignee)}
          </span>
          {ticket.assignee}
        </span>
        <span className="rv-ticket-card-time">{formatTime(ticket.created)}</span>
      </div>
    </div>
  );
}

interface TicketDetailProps {
  ticket: Ticket;
  onClose: () => void;
  onExpand: () => void;
}

function TicketDetail({ ticket, onClose, onExpand }: TicketDetailProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="rv-ticket-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="rv-ticket-detail"
        role="dialog"
        aria-modal="true"
        aria-label={`Ticket ${ticket.id}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="rv-ticket-detail-chrome">
          <span className="material-symbols-outlined rv-ticket-detail-chrome-icon" aria-hidden="true">
            confirmation_number
          </span>
          <span className="rv-ticket-detail-chrome-title">{ticket.id}</span>
          <div className="rv-ticket-detail-chrome-actions">
            <button
              type="button"
              className="rv-ticket-detail-chrome-action"
              onClick={onExpand}
              aria-label={`Expand ${ticket.id}`}
              title="Expand content"
            >
              <span className="material-symbols-outlined" aria-hidden="true">expand_content</span>
            </button>
            <button
              type="button"
              className="rv-ticket-detail-chrome-action"
              onClick={onClose}
              aria-label="Close ticket details"
              title="Close preview"
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        </header>
        <div className="rv-ticket-detail-summary">
          <div className="rv-ticket-detail-id">{ticket.id}</div>
          <div className="rv-ticket-detail-title">{ticket.title}</div>
          <div className="rv-ticket-detail-fields">
            <span className="rv-ticket-detail-label">Assignee</span>
            <span className="rv-ticket-detail-value">{ticket.assignee}</span>
            <span className="rv-ticket-detail-label">State</span>
            <span className="rv-ticket-detail-value">{ticket.state}</span>
            <span className="rv-ticket-detail-label">Author</span>
            <span className="rv-ticket-detail-value">{ticket.author}</span>
            <span className="rv-ticket-detail-label">Created</span>
            <span className="rv-ticket-detail-value">{ticket.created}</span>
            {ticket.gitlab_iid && (
              <>
                <span className="rv-ticket-detail-label">GitLab</span>
                <span className="rv-ticket-detail-value">#{ticket.gitlab_iid}</span>
              </>
            )}
          </div>
        </div>
        <div className="rv-ticket-detail-body">
          {ticket.body || '(no description)'}
        </div>
      </section>
    </div>
  );
}

function TicketFullPage({ ticket, onBack }: { ticket: Ticket; onBack: () => void }) {
  const folder = ticketFolder(ticket);
  const relativePath = `${folder}/${ticket.id}.md`;
  const file = {
    name: `${ticket.id}.md`,
    path: relativePath,
    type: 'file' as const,
    extension: 'md',
  };
  const { renameFile, deleteFile } = useTileFileActions({ panel: 'issues-viewer', folder });

  return (
    <div className="rv-ticket-full-page">
      <header className="rv-ticket-full-page-topbar">
        <h1>Ticket - {ticket.id}</h1>
      </header>
      <div className="rv-ticket-full-page-subheader">
        <button
          type="button"
          className="rv-ticket-full-page-back"
          onClick={onBack}
          aria-label="Back to tickets"
          title="Back to tickets"
        >
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
        </button>
        <span className="rv-ticket-full-page-title">{ticket.title}</span>
        <div className="rv-ticket-full-page-actions">
          <CaptureDocumentMenuButton
            fileName={file.name}
            className="rv-ticket-full-page-action"
            onRename={() => renameFile(file, folder)}
            onDelete={() => deleteFile(file, folder)}
          />
        </div>
      </div>
      <div className="rv-ticket-full-page-content">
        <div className="rv-ticket-detail-summary">
          <div className="rv-ticket-detail-id">{ticket.id}</div>
          <div className="rv-ticket-detail-title">{ticket.title}</div>
          <div className="rv-ticket-detail-fields">
            <span className="rv-ticket-detail-label">Assignee</span>
            <span className="rv-ticket-detail-value">{ticket.assignee}</span>
            <span className="rv-ticket-detail-label">State</span>
            <span className="rv-ticket-detail-value">{ticket.state}</span>
            <span className="rv-ticket-detail-label">Author</span>
            <span className="rv-ticket-detail-value">{ticket.author}</span>
            <span className="rv-ticket-detail-label">Created</span>
            <span className="rv-ticket-detail-value">{ticket.created}</span>
            {ticket.gitlab_iid && (
              <>
                <span className="rv-ticket-detail-label">GitLab</span>
                <span className="rv-ticket-detail-value">#{ticket.gitlab_iid}</span>
              </>
            )}
          </div>
        </div>
        <div className="rv-ticket-detail-body">{ticket.body || '(no description)'}</div>
      </div>
      <FloatingPathActions
        panel="issues-viewer"
        relativePath={relativePath}
        copyTitle="Copy ticket path"
        sendTitle="Send ticket to chat"
        ariaLabel="Ticket actions"
      />
    </div>
  );
}

type ColumnTone = 'todo' | 'progress' | 'done';
type IssuesSection = 'inbox' | 'tickets' | 'scheduled' | 'triggers';

const SCHEDULED_CALENDAR_DAYS = Array.from({ length: 42 }, (_, index) => {
  const date = new Date(2026, 7, index - 5);
  return {
    day: date.getDate(),
    inMonth: date.getMonth() === 7,
    isToday: date.getFullYear() === 2026 && date.getMonth() === 7 && date.getDate() === 21,
    isSaturday: date.getDay() === 6,
    isWednesday: date.getDay() === 3,
  };
});

function ScheduledCalendar() {
  return (
    <section
      id="issues-scheduled-panel"
      className="rv-scheduled-calendar"
      role="tabpanel"
      aria-label="Scheduled automation calendar"
    >
      <header className="rv-scheduled-calendar-header">
        <div>
          <div className="rv-scheduled-calendar-title">August 2026</div>
          <div className="rv-scheduled-calendar-subtitle">Automation schedule preview</div>
        </div>
        <span className="rv-scheduled-calendar-stub">Stub schedule</span>
      </header>
      <div className="rv-scheduled-calendar-weekdays" aria-hidden="true">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="rv-scheduled-calendar-grid" role="grid" aria-label="August 2026">
        {SCHEDULED_CALENDAR_DAYS.map((date, index) => (
          <div
            className={`rv-scheduled-calendar-day${date.inMonth ? '' : ' rv-scheduled-calendar-day-outside'}${date.isToday ? ' rv-scheduled-calendar-day-today' : ''}`}
            key={`${date.inMonth ? 'aug' : 'outside'}-${date.day}-${index}`}
            role="gridcell"
          >
            <span className="rv-scheduled-calendar-day-number">{date.day}</span>
            {date.inMonth && (
              <div className="rv-scheduled-calendar-events">
                <div className="rv-scheduled-calendar-event rv-scheduled-calendar-event-daily">
                  <time>3:00 AM</time>
                  <span>Wiki-Check</span>
                </div>
                {date.isSaturday && (
                  <div className="rv-scheduled-calendar-event rv-scheduled-calendar-event-review">
                    <time>4:00 AM</time>
                    <span>Review</span>
                  </div>
                )}
                {date.isWednesday && (
                  <div className="rv-scheduled-calendar-event rv-scheduled-calendar-event-cleanup">
                    <time>3:00 PM</time>
                    <span>Merge Clean Up</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function TriggerCollections() {
  return (
    <section
      id="issues-triggers-panel"
      className="rv-trigger-collections"
      role="tabpanel"
      aria-label="Trigger collections"
    >
      {TRIGGER_DEMO_COLLECTIONS.map((collection) => (
        <section className="rv-trigger-collection" key={collection.title} aria-labelledby={`trigger-collection-${collection.title.toLowerCase().replaceAll(' ', '-')}`}>
          <h2
            className="rv-trigger-collection-title"
            id={`trigger-collection-${collection.title.toLowerCase().replaceAll(' ', '-')}`}
          >
            {collection.title}
          </h2>
          <div className="rv-trigger-collection-grid">
            {collection.cards.map((card) => (
              <article className="rv-trigger-card" key={card.title}>
                <h3 className="rv-trigger-card-title">{card.title}</h3>
                <footer className="rv-trigger-card-footer">
                  <div className="rv-trigger-card-connections" aria-label="Connected trigger types">
                    {card.icons.map((icon) => (
                      <span className="material-symbols-outlined" key={icon} aria-hidden="true">{icon}</span>
                    ))}
                  </div>
                  <span
                    className={`rv-trigger-card-switch${card.enabled ? ' rv-trigger-card-switch-on' : ''}`}
                    role="switch"
                    aria-checked={card.enabled}
                    aria-disabled="true"
                    aria-label={`${card.title} ${card.enabled ? 'enabled' : 'disabled'} preview`}
                  >
                    <span />
                  </span>
                </footer>
              </article>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function Column({ title, tickets, tone }: { title: string; tickets: Ticket[]; tone: ColumnTone }) {
  return (
    <section className={`rv-ticket-column rv-ticket-column-${tone}`} aria-label={`${title} tickets`}>
      <div className="rv-ticket-column-header">
        <span className="rv-ticket-column-title">{title}</span>
        <span className="rv-ticket-column-count">{tickets.length}</span>
      </div>
      <div className="rv-ticket-column-items">
        {tickets.length === 0 ? (
          <div className="rv-ticket-column-empty">No cards yet</div>
        ) : (
          tickets.map((t) => <TicketCard key={t.id} ticket={t} />)
        )}
      </div>
      <div className="rv-ticket-column-footer" aria-hidden="true">
        <span className="material-symbols-outlined">add</span>
        Add a card
      </div>
    </section>
  );
}

export function TicketBoard() {
  useViewLayoutStyles('issues-viewer');
  const [section, setSection] = useState<IssuesSection>('tickets');
  const [fullPageTicketId, setFullPageTicketId] = useState<string | null>(null);

  const onIndex = useCallback((content: string) => {
    try {
      const index = JSON.parse(content);
      useTicketStore.getState().setTicketsFromIndex(index.tickets || {});
    } catch {
      useTicketStore.getState().setError('Failed to parse tickets.json');
    }
  }, []);

  const onError = useCallback((error: string) => {
    useTicketStore.getState().setError(error);
  }, []);

  usePanelData({
    panel: 'issues-viewer',
    indexPath: 'content/tickets.json',
    onIndex,
    onError,
  });

  const tickets = useTicketStore((s) => s.tickets);
  const loaded = useTicketStore((s) => s.loaded);
  const error = useTicketStore((s) => s.error);
  const activeTicketId = useTicketStore((s) => s.activeTicket);

  const inbox = tickets.filter((t) => t.state === 'open' && !isBot(t.assignee));
  const open = tickets.filter((t) => t.state === 'open' && isBot(t.assignee));
  const completed = tickets.filter((t) => t.state === 'closed');

  const activeTicket = activeTicketId
    ? tickets.find((t) => t.id === activeTicketId) || null
    : null;

  const closeTicket = useCallback(() => {
    setFullPageTicketId(null);
    useTicketStore.getState().setActiveTicket(null);
  }, []);

  if (activeTicket && fullPageTicketId === activeTicket.id) {
    return <TicketFullPage ticket={activeTicket} onBack={closeTicket} />;
  }

  return (
    <div className="rv-ticket-view">
      <header className="rv-ticket-view-header">
        <h1 className="rv-ticket-view-title">Issues Tracker</h1>
      </header>
      <SegmentedViewNav
        ariaLabel="Issues sections"
        items={ISSUE_NAV_ITEMS}
        activeValue={section}
        onChange={(value) => setSection(value as IssuesSection)}
      />
      {section === 'inbox' ? (
        <section
          id="issues-inbox-panel"
          className="rv-notification-inbox"
          role="tabpanel"
          aria-label="Notification inbox"
        >
          <header className="rv-notification-inbox-header">
            <button type="button" className="rv-notification-inbox-date" aria-label="Sort notifications by newest">
              <span>Newest</span>
              <span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_down</span>
            </button>
            <div className="rv-notification-inbox-actions" aria-label="Notification filters">
              {NOTIFICATION_ICONS.map(({ icon, label }) => (
                <button key={icon} type="button" className="rv-notification-inbox-action" aria-label={`${label} notifications`} title={label}>
                  <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
                </button>
              ))}
            </div>
          </header>
          <div className="rv-notification-inbox-rows">
            {NOTIFICATION_DEMO_ROWS.map((row, index) => (
              <div className="rv-notification-inbox-row" key={`${row.date}-${row.time}-${index}`}>
                <time className="rv-notification-inbox-row-date">
                  <span>{row.date}</span>
                  <span>{row.time}</span>
                </time>
                <div className="rv-notification-inbox-row-title" title={`${row.prefix ? `${row.prefix} ` : ''}${row.title}`}>
                  {row.prefix && <strong>{row.prefix}</strong>}
                  <span>{row.title}</span>
                </div>
                {NOTIFICATION_ICONS.map(({ icon }) => (
                  <span
                    className={`rv-notification-inbox-row-status${row.icon === icon ? ' rv-notification-inbox-row-status-selected' : ''}`}
                    key={icon}
                    aria-label={`${icon} status ${row.icon === icon ? 'selected' : 'not selected'}`}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {row.icon === icon ? 'select_check_box' : 'check_box_outline_blank'}
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : section === 'scheduled' ? (
        <ScheduledCalendar />
      ) : section === 'triggers' ? (
        <TriggerCollections />
      ) : !loaded ? (
        <div id="issues-ticket-panel" className="rv-ticket-board-loading" role="tabpanel">
          <span className="rv-dim-label">Loading tickets...</span>
        </div>
      ) : error ? (
        <div id="issues-ticket-panel" className="rv-ticket-board-loading" role="tabpanel">
          <span className="rv-dim-label">{error}</span>
        </div>
      ) : (
        <div id="issues-ticket-panel" className="rv-ticket-board" role="tabpanel">
          <Column title="To Do" tickets={inbox} tone="todo" />
          <Column title="In Progress" tickets={open} tone="progress" />
          <Column title="Done" tickets={completed} tone="done" />
          {activeTicket && (
            <TicketDetail
              ticket={activeTicket}
              onClose={closeTicket}
              onExpand={() => setFullPageTicketId(activeTicket.id)}
            />
          )}
        </div>
      )}
    </div>
  );
}
