/**
 * @module EmailGrid
 * @role Content component for the email-viewer panel
 *
 * Three-level navigation:
 * - Root: grid of folder cards
 * - Folder: grid of EmailDocumentTile cards for files in the selected folder
 * - File: full-page FilePageView with back button + sibling ribbon
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { useFileDataStore } from '../../state/fileDataStore';
import { usePanelStore } from '../../state/panelStore';
import { useFolderFiles } from '../../hooks/useFolderFiles';
import { useFileTileMenu } from '../../hooks/useFileTileMenu';
import type { FileWithContent } from '../tile-row/TileRow';
import { EmailDocumentTile } from './EmailDocumentTile';
import { EmailDocumentPage } from './EmailDocumentPage';
import { EmailViewerHeader } from './EmailViewerHeader';
import { EmailToolbar } from './EmailToolbar';
import { EmailSurface } from './EmailSurface';
import { EmailComposeLayer } from './EmailComposeLayer';
import { useEmailComposeStore } from './composeStore';
import { normalizeOfficePaperBrightness, officePaperMuteAlpha } from '../../lib/officePaperBrightness';
import { EmailBreadcrumb } from './EmailBreadcrumb';
import { useEmailViewerSearch } from './useEmailViewerSearch';
import { FilePageView } from '../capture/FilePageView';
import { Icon } from '../Icon';
import { FloatingPathActions } from '../FloatingPathActions';
import { onFusionMessage, sendFusionMessage } from '../../lib/ws-client';
import { EMAIL_VIEWER_ARCHIVE_FOLDER, isViewerArchivePath } from '../../lib/viewFolders';
import type { ViewUIState } from '../../types';
import {
  normalizeViewCollections,
} from '../../lib/viewCollections';
import {
  activityId,
  groupActivityByDate,
  normalizeViewActivity,
  recordViewRecent,
} from '../../lib/viewActivity';
import '../../styles/dropdown.css';
import './EmailGrid.css';

const PANEL = 'email-viewer';
const ROOT_PATH = '';

function persistEmailViewPatch(patch: Partial<ViewUIState>) {
  const store = usePanelStore.getState();
  store.setViewState(PANEL, patch);
  store._persistViewPatch(PANEL, patch);
}

function folderPathForFile(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash === -1 ? ROOT_PATH : filePath.slice(0, lastSlash);
}

function fileNameForPath(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

function extensionForName(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

function storedFolderPath(folderPath: string): string | null {
  return folderPath || null;
}

const EMAIL_SIDEBAR_ITEMS = [
  { kind: 'item', icon: 'inbox', label: 'Inbox', action: 'inbox' },
  { kind: 'item', icon: 'kid_star', label: 'Starred', action: 'starred' },
  { kind: 'item', icon: 'chronic', label: 'Snoozed', action: 'snoozed' },
  { kind: 'item', icon: 'send', label: 'Sent', action: 'sent' },
  { kind: 'item', icon: 'schedule_send', label: 'Scheduled', action: 'scheduled' },
  { kind: 'item', icon: 'edit_document', label: 'Drafts', action: 'drafts' },
  { kind: 'item', icon: 'report', label: 'Spam', action: 'spam' },
  { kind: 'item', icon: 'delete', label: 'Trash', action: 'trash' },
] as const;

// Stub label-folders; these move to SQLite when the mail schema lands (Email_Workspace_SPEC).
const EMAIL_STUB_FOLDERS = ['Banking', 'Client Email'] as const;

// Sidebar modes that render the mail surface instead of the document grid.
const MAIL_MODES = new Set<string>(EMAIL_SIDEBAR_ITEMS.map((item) => item.action));

const EMAIL_RULE_SECTIONS = [
  { icon: 'bolt', label: 'Triggers' },
  { icon: 'schedule', label: 'Scheduled' },
  { icon: 'move_to_inbox', label: 'Incoming' },
  { icon: 'contract_edit', label: 'Templates' },
] as const;

const EMAIL_RULE_FILES = [
  {
    section: 'Triggers',
    name: 'parse-bank-transaction-emails.trigger.md',
    title: 'Parse Bank Transaction Emails',
    description: 'Monitors inbox for emails from Wells Fargo, copies personal expenses to Spending tracker and business expenses to Solobooks, then archives the email.',
    type: 'trigger',
    status: 'Active',
    apps: ['Gmail', 'Spending', 'Solobooks'],
    location: 'System / triggers',
    tags: ['email', 'money', 'extract', 'writes-data'],
    updated: 'Today',
  },
  {
    section: 'Triggers',
    name: 'receipt-triage.trigger.md',
    title: 'Receipt Triage',
    description: 'Classifies receipt emails, creates review tickets for ambiguous purchases, and marks clean receipts as processed.',
    type: 'trigger',
    status: 'Draft',
    apps: ['Gmail', 'Tickets'],
    location: 'System / triggers',
    tags: ['email', 'money', 'classify'],
    updated: 'Draft',
  },
  {
    section: 'Triggers',
    name: 'parse-bank-transaction.js',
    title: 'Parse Bank Transaction',
    description: 'Extracts merchant, date, card, amount, and expense category data from bank transaction email text.',
    type: 'script',
    status: 'Draft',
    apps: ['Email', 'Spending'],
    location: 'System / triggers / scripts',
    tags: ['email', 'money', 'extract'],
    updated: 'Today',
  },
  {
    section: 'Scheduled',
    name: 'money-routing-agent.workflow.md',
    title: 'Daily Money Routing Review',
    description: 'Runs a scheduled review of routed money emails and flags unusual expenses for manual approval.',
    type: 'workflow',
    status: 'Paused',
    apps: ['Email', 'Solobooks'],
    location: 'System / agents',
    tags: ['agent', 'money', 'review'],
    updated: 'Jul 6',
  },
  {
    section: 'Incoming',
    name: 'review-bank-transaction.ticket.md',
    title: 'Review Bank Transaction Email',
    description: 'Creates a ticket template for bank emails that need user review before expense routing continues.',
    type: 'ticket',
    status: 'Template',
    apps: ['Tickets'],
    location: 'System / triggers / templates',
    tags: ['ticket', 'email', 'review'],
    updated: 'Jul 6',
  },
  {
    section: 'Templates',
    name: 'bank-transaction.trigger.template.md',
    title: 'Bank Transaction Trigger',
    description: 'Template for creating a new bank transaction email trigger with guardrails and accounting destinations.',
    type: 'template',
    status: 'Template',
    apps: ['Email', 'Spending'],
    location: 'System / triggers / templates',
    tags: ['email', 'money', 'template'],
    updated: 'Jul 6',
  },
  {
    section: 'Templates',
    name: 'automation-tags.readme.md',
    title: 'Automation Tags',
    description: 'Reference file that defines the managed automation tags available to System trigger files.',
    type: 'readme',
    status: 'Reference',
    apps: ['System'],
    location: 'System / triggers',
    tags: ['system', 'review'],
    updated: 'Jul 6',
  },
] as const;

const EMAIL_TRIGGER_EVENTS = [
  { value: '', label: 'Choose an Event' },
  { value: 'email.received', label: 'New email' },
  { value: 'email.sent', label: 'Email sent' },
  { value: 'email.read', label: 'Email read/opened' },
] as const;

const EMAIL_TRIGGER_FOLDERS = [
  { value: '', label: 'Any folder or tag' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'starred', label: 'Starred' },
  { value: 'snoozed', label: 'Snoozed' },
  { value: 'sent', label: 'Sent' },
  { value: 'drafts', label: 'Drafts' },
  { value: 'trash', label: 'Trash' },
  { value: 'banking', label: 'Banking' },
  { value: 'client-email', label: 'Client Email' },
] as const;

type EmailSidebarItem = Extract<typeof EMAIL_SIDEBAR_ITEMS[number], { kind: 'item' }>;
type EmailSidebarAction = EmailSidebarItem['action'];
type EmailCreateModalKind = 'folder' | 'document';

interface FolderInfo {
  name: string;
  path: string;
}

interface EmailSectionedResultsProps {
  folderItems: ReactNode[];
  fileItems: ReactNode[];
}

interface DocumentCreateResponseMessage {
  type: 'document_create_response';
  panel?: string;
  parentPath?: string;
  path?: string;
  name?: string;
  extension?: string;
  content?: string;
  success?: boolean;
}

function isMarkdownDocument(file: FileWithContent): boolean {
  const fileName = file.name.toLowerCase();
  return file.extension === 'md' ||
    file.extension === 'markdown' ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.markdown');
}

function EmailSectionedResults({
  folderItems,
  fileItems,
}: EmailSectionedResultsProps) {
  return (
    <div className="rv-email-search-results">
      {folderItems.length > 0 ? (
        <div className="rv-email-search-section">
          <div className="rv-email-search-section-title">Folders</div>
          <div className="rv-email-folder-grid rv-email-search-folder-grid">
            {folderItems}
          </div>
        </div>
      ) : null}
      {fileItems.length > 0 ? (
        <div className="rv-email-search-section rv-email-search-section--files">
          <div className="rv-email-search-section-title">Files</div>
          <div className="rv-email-file-grid rv-email-search-grid">
            {fileItems}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmailRecentResults({
  groups,
  contents,
  onOpenFile,
  onFileContextMenu,
  onFileMoreClick,
  isFileStarred,
}: {
  groups: ReturnType<typeof groupActivityByDate>;
  contents: Record<string, string>;
  onOpenFile: (path: string, folder: string) => void;
  onFileContextMenu: (file: FileWithContent, folder: string) => (event: ReactMouseEvent) => void;
  onFileMoreClick: (file: FileWithContent, folder: string) => (event: ReactMouseEvent) => void;
  isFileStarred: (panel: string, path: string) => boolean;
}) {
  return (
    <div className="rv-email-search-results rv-email-recent-results">
      {groups.map((group) => (
        <div className="rv-email-search-section" key={group.label}>
          <div className="rv-email-search-section-title">{group.label}</div>
          <div className="rv-email-file-grid rv-email-search-grid">
            {group.items.map((item) => {
              const folder = item.folder ?? '';
              const file: FileWithContent = {
                name: item.title,
                path: item.path,
                type: 'file',
                extension: item.extension,
                content: contents[`${item.panel}:${item.path}`] || '',
              };
              return (
                <EmailDocumentTile
                  key={item.id}
                  name={file.name}
                  content={file.content}
                  extension={file.extension}
                  panel={item.panel}
                  folderPath={folder}
                  starred={isFileStarred(item.panel, item.path)}
                  onClick={() => onOpenFile(item.path, folder)}
                  onContextMenu={onFileContextMenu(file, folder)}
                  onMoreClick={onFileMoreClick(file, folder)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmailFolderCard({
  folder,
  onClick,
  onContextMenu,
  onMoreClick,
  title,
}: {
  folder: FolderInfo;
  onClick: () => void;
  onContextMenu?: (event: ReactMouseEvent) => void;
  onMoreClick?: (event: ReactMouseEvent) => void;
  title?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="rv-email-folder-card"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      title={title ?? folder.name}
    >
      <Icon
        name="folder"
        className="rv-email-folder-icon"
        filled={true}
      />
      <span className="rv-email-folder-name">{folder.name}</span>
      <button
        type="button"
        className="rv-email-folder-more"
        aria-label={`More actions for ${folder.name}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onMoreClick?.(event);
        }}
      >
        <span className="material-symbols-outlined">more_vert</span>
      </button>
    </div>
  );
}

function emailModeForFolder(folderPath: string): 'home' | 'archive' {
  return isViewerArchivePath(folderPath, EMAIL_VIEWER_ARCHIVE_FOLDER) ? 'archive' : 'home';
}

function EmailSidebar({
  activeAction,
  onAction,
  onCompose,
}: {
  activeAction: string;
  onAction: (action: EmailSidebarAction) => void;
  onCompose: () => void;
}) {
  const [activeStubFolder, setActiveStubFolder] = useState<string | null>(null);

  return (
    <aside className="rv-email-sidebar" aria-label="Email navigation">
      <h2 className="rv-email-sidebar-title">Email</h2>
      <button
        type="button"
        className="rv-email-new-btn rv-email-sidebar-new-btn"
        onClick={onCompose}
      >
        New
      </button>
      <nav className="rv-email-sidebar-nav">
        {EMAIL_SIDEBAR_ITEMS.map((item) => {
          const isActive = !activeStubFolder && item.action === activeAction;
          const className = [
            'rv-email-sidebar-item',
            isActive ? 'active' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={item.action}
              type="button"
              className={className}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              onClick={() => {
                setActiveStubFolder(null);
                onAction(item.action);
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
        <div className="rv-email-sidebar-separator" role="separator" />
        <div className="rv-email-sidebar-folders-label">Folders</div>
        {EMAIL_STUB_FOLDERS.map((name) => {
          const isActive = activeStubFolder === name;
          return (
            <button
              key={name}
              type="button"
              className={`rv-email-sidebar-item${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              title={name}
              onClick={() => setActiveStubFolder(name)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">folder</span>
              <span>{name}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function EmailCreateModal({
  kind,
  name,
  onNameChange,
  onCancel,
  onSave,
}: {
  kind: EmailCreateModalKind;
  name: string;
  onNameChange: (name: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = kind === 'folder' ? 'Folder name' : 'Document name';
  const inputId = `rv-email-${kind}-name`;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSave();
  };

  return (
    <div className="rv-email-create-modal-overlay" role="presentation" onMouseDown={onCancel}>
      <form
        className="rv-email-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rv-email-create-modal-label"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label id="rv-email-create-modal-label" className="rv-email-create-modal-label" htmlFor={inputId}>
          {label}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          className="rv-email-create-modal-input"
          value={name}
          onChange={(event) => onNameChange(event.currentTarget.value)}
        />
        <div className="rv-email-create-modal-actions">
          <button type="button" className="rv-email-create-modal-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="rv-email-create-modal-btn rv-email-create-modal-btn--primary" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function EmailRulesPopover({ onClose }: { onClose: () => void }) {
  const [activeNavLabel, setActiveNavLabel] = useState('Triggers');
  const [activeFileName, setActiveFileName] = useState<string>(EMAIL_RULE_FILES[0].name);
  const [editorOpen, setEditorOpen] = useState(false);
  const [rulesSearchOpen, setRulesSearchOpen] = useState(false);
  const [selectedTriggerCard, setSelectedTriggerCard] = useState<string | null>(null);
  const activeRows = EMAIL_RULE_FILES.filter((file) => file.section === activeNavLabel);
  const activeFile = EMAIL_RULE_FILES.find((file) => file.name === activeFileName) ?? EMAIL_RULE_FILES[0];
  const activeRowsCount = activeRows.length;
  const activeFileSummary =
    activeFile.description.length > 70 ? `${activeFile.description.slice(0, 70).trimEnd()}...` : activeFile.description;
  const selectedTriggerCardTitle =
    selectedTriggerCard === 'summary' ? activeFile.title :
    selectedTriggerCard === 'trigger' ? 'Trigger' :
    selectedTriggerCard === 'script' ? 'Script' :
    selectedTriggerCard === 'permissions' ? 'Permissions' :
    '';
  const selectedTriggerCardDescription =
    selectedTriggerCard === 'summary' ? activeFile.description :
    selectedTriggerCard === 'trigger' ? 'Select the event that starts this automation.' :
    selectedTriggerCard === 'script' ? 'Describe or attach the script that handles this automation.' :
    selectedTriggerCard === 'permissions' ? 'Approve what this automation is allowed to read, write, send, or delete.' :
    '';
  const selectedTriggerCardMetadata =
    selectedTriggerCard === 'summary' ? `type: ${activeFile.type}\ntags: ${activeFile.tags.join(', ')}` :
    selectedTriggerCard === 'trigger' ? 'event: inbox.message.received\nsource: email' :
    selectedTriggerCard === 'script' ? 'script: inline\nruntime: sandboxed' :
    selectedTriggerCard === 'permissions' ? 'read_email: false\nwrite_labels: false\nsend_email: false\ndelete_email: false' :
    '';

  return (
    <section
      className="rv-email-rules-popover"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rv-email-rules-title"
    >
      <div className={`rv-email-rules-popover-header${editorOpen ? ' rv-email-rules-popover-header--file' : ''}`}>
        {editorOpen ? (
          <div className="rv-email-rules-file-summary">
            <h2 id="rv-email-rules-title" className="rv-email-rules-file-summary-title">
              {activeFile.title}
            </h2>
            <span aria-hidden="true">-</span>
            <p>{activeFileSummary}</p>
            <button
              type="button"
              className="rv-email-rules-close"
              aria-label="Close Rules and Automations"
              title="Close"
              onClick={onClose}
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        ) : (
          <>
            <div className="rv-email-rules-topbar">
              <button
                type="button"
                className="rv-email-rules-search-toggle"
                aria-label="Search Rules and Automations"
                title="Search"
                onClick={() => setRulesSearchOpen(true)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">search</span>
              </button>
              <div className="rv-email-rules-section-bar" role="tablist" aria-label="Automation sections">
                {EMAIL_RULE_SECTIONS.map((section) => (
                  <button
                    key={section.label}
                    type="button"
                    role="tab"
                    aria-selected={section.label === activeNavLabel}
                    className={`rv-email-rules-section-btn${section.label === activeNavLabel ? ' rv-email-rules-section-btn--active' : ''}`}
                    onClick={() => {
                      setActiveNavLabel(section.label);
                      setEditorOpen(false);
                      setSelectedTriggerCard(null);
                      const firstRow = EMAIL_RULE_FILES.find((file) => file.section === section.label);
                      if (firstRow) setActiveFileName(firstRow.name);
                    }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">{section.icon}</span>
                    <span>{section.label}</span>
                  </button>
                ))}
              </div>
              {rulesSearchOpen ? (
                <label className="rv-email-rules-search-overlay">
                  <span className="material-symbols-outlined" aria-hidden="true">search</span>
                  <input
                    type="search"
                    aria-label="Search Rules and Automations"
                    placeholder="Search Rules and Automations"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="rv-email-rules-search-close"
                    aria-label="Close search"
                    title="Close search"
                    onClick={() => setRulesSearchOpen(false)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                  </button>
                </label>
              ) : null}
              <button
                type="button"
                className="rv-email-rules-close"
                aria-label="Close Rules and Automations"
                title="Close"
                onClick={onClose}
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <div className="rv-email-rules-title-row">
              <h2 id="rv-email-rules-title" className="rv-email-rules-popover-title">
                Rules and Automations
              </h2>
            </div>
          </>
        )}
      </div>
      <div className="rv-email-rules-popover-body">
        <div className={`rv-email-rules-detail${editorOpen ? ' rv-email-rules-detail--editor' : ''}`}>
          {!editorOpen ? (
            <div className="rv-email-rules-assets">
              <div className="rv-email-rules-assets-header">
                <div className="rv-email-rules-assets-title">
                  <h3 className="rv-email-rules-detail-title">{activeNavLabel}</h3>
                  <span>{activeRowsCount} {activeRowsCount === 1 ? 'item' : 'items'}</span>
                </div>
                <div className="rv-email-rules-assets-actions">
                  <button type="button" className="rv-email-rules-action-btn">
                    <span className="material-symbols-outlined" aria-hidden="true">filter_alt</span>
                    Filters
                  </button>
                  <button type="button" className="rv-email-rules-action-btn rv-email-rules-action-btn--primary">
                    <span className="material-symbols-outlined" aria-hidden="true">add</span>
                    Create
                  </button>
                </div>
              </div>
              <label className="rv-email-rules-list-search">
                <span className="material-symbols-outlined" aria-hidden="true">search</span>
                <input type="search" placeholder={`Search ${activeNavLabel.toLowerCase()}`} aria-label={`Search ${activeNavLabel}`} />
              </label>
              <div className="rv-email-rules-table" role="table" aria-label={`${activeNavLabel} automation rows`}>
                <div className="rv-email-rules-table-head" role="row">
                  <span role="columnheader">Name</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Apps</span>
                  <span role="columnheader">Location</span>
                  <span role="columnheader">Updated</span>
                  <span role="columnheader" aria-label="Actions" />
                </div>
                <div className="rv-email-rules-table-body">
                  {activeRows.map((file) => (
                    <button
                      key={file.name}
                      type="button"
                      className="rv-email-rules-table-row"
                      role="row"
                      onClick={() => {
                        setActiveFileName(file.name);
                        setEditorOpen(true);
                        setSelectedTriggerCard(null);
                      }}
                    >
                      <span className="rv-email-rules-row-name" role="cell">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {file.type === 'trigger' ? 'bolt' : 'description'}
                        </span>
                        <span>
                          <strong>{file.title}</strong>
                          <em>{file.name}</em>
                        </span>
                      </span>
                      <span className="rv-email-rules-status" role="cell">{file.status}</span>
                      <span className="rv-email-rules-apps" role="cell">
                        {file.apps.map((app) => (
                          <span key={app}>{app.slice(0, 2)}</span>
                        ))}
                      </span>
                      <span className="rv-email-rules-location" role="cell">{file.location}</span>
                      <span className="rv-email-rules-updated" role="cell">{file.updated}</span>
                      <span className="rv-email-rules-row-actions" role="cell">
                        <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
          <div className="rv-email-rules-editor-shell">
            <div className="rv-email-rules-editor-toolbar">
              <div className="rv-email-rules-editor-left">
                <button
                  type="button"
                  className="rv-email-rules-icon-btn"
                  aria-label={`Back to ${activeNavLabel}`}
                  title="Back"
                  onClick={() => setEditorOpen(false)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                </button>
                <div className="rv-email-rules-editor-heading">
                  <span className="rv-email-rules-file-path">{activeFile.name}</span>
                </div>
              </div>
              <div className="rv-email-rules-editor-actions">
                <button type="button" className="rv-email-rules-action-btn">
                  <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                  Test run
                </button>
                <button type="button" className="rv-email-rules-action-btn">
                  <span className="material-symbols-outlined" aria-hidden="true">check</span>
                  Save
                </button>
                <button type="button" className="rv-email-rules-icon-btn" aria-label="More file actions" title="More">
                  <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
                </button>
              </div>
            </div>
            <div className="rv-email-rules-workspace" aria-label="Trigger GUI editor">
              <div className="rv-email-rules-card-canvas">
                <div className="rv-email-trigger-flow">
                  <button
                    type="button"
                    className={`rv-email-trigger-card rv-email-trigger-card--summary${selectedTriggerCard === 'summary' ? ' rv-email-trigger-card--selected' : ''}`}
                    aria-label="Trigger summary card"
                    aria-pressed={selectedTriggerCard === 'summary'}
                    onClick={() => setSelectedTriggerCard('summary')}
                  >
                    <div className="rv-email-trigger-card-content">
                      <span className="rv-email-trigger-step-pill">
                        <span className="material-symbols-outlined" aria-hidden="true">edit_note</span>
                        Name &amp; Description
                      </span>
                      <h3>{activeFile.title}</h3>
                      <p>{activeFile.description}</p>
                    </div>
                  </button>
                  <div className="rv-email-trigger-connector" aria-hidden="true" />
                  <button
                    type="button"
                    className={`rv-email-trigger-step-card${selectedTriggerCard === 'trigger' ? ' rv-email-trigger-card--selected' : ''}`}
                    aria-label="Trigger step"
                    aria-pressed={selectedTriggerCard === 'trigger'}
                    onClick={() => setSelectedTriggerCard('trigger')}
                  >
                    <span className="rv-email-trigger-step-pill">
                      <span className="material-symbols-outlined" aria-hidden="true">bolt</span>
                      Trigger
                    </span>
                    <h3>1. Select the event that starts this automation</h3>
                  </button>
                  <div className="rv-email-trigger-connector" aria-hidden="true" />
                  <button
                    type="button"
                    className={`rv-email-trigger-step-card${selectedTriggerCard === 'script' ? ' rv-email-trigger-card--selected' : ''}`}
                    aria-label="Script step"
                    aria-pressed={selectedTriggerCard === 'script'}
                    onClick={() => setSelectedTriggerCard('script')}
                  >
                    <span className="rv-email-trigger-step-pill">
                      <span className="material-symbols-outlined" aria-hidden="true">code</span>
                      Script
                    </span>
                    <h3>2. Describe or attach the automation script</h3>
                  </button>
                  <div className="rv-email-trigger-connector" aria-hidden="true" />
                  <button
                    type="button"
                    className={`rv-email-trigger-step-card${selectedTriggerCard === 'permissions' ? ' rv-email-trigger-card--selected' : ''}`}
                    aria-label="Permissions step"
                    aria-pressed={selectedTriggerCard === 'permissions'}
                    onClick={() => setSelectedTriggerCard('permissions')}
                  >
                    <span className="rv-email-trigger-step-pill">
                      <span className="material-symbols-outlined" aria-hidden="true">shield_lock</span>
                      Permissions
                    </span>
                    <h3>3. Approve what this automation can do</h3>
                  </button>
                </div>
              </div>
              <aside className="rv-email-rules-detail-pane" aria-label="Card details">
                {selectedTriggerCard ? (
                  <section className="rv-email-trigger-detail-card">
                    {selectedTriggerCard === 'trigger' ? (
                      <label className="rv-email-trigger-detail-field">
                        <span>Trigger:</span>
                        <select defaultValue="">
                          {EMAIL_TRIGGER_EVENTS.map((event) => (
                            <option key={event.value || 'placeholder'} value={event.value}>
                              {event.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {selectedTriggerCard === 'trigger' ? (
                      <label className="rv-email-trigger-detail-field">
                        <span>Folder / Tag:</span>
                        <select defaultValue="">
                          {EMAIL_TRIGGER_FOLDERS.map((folder) => (
                            <option key={folder.value || 'any'} value={folder.value}>
                              {folder.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {selectedTriggerCard === 'script' ? (
                      <label className="rv-email-trigger-detail-field">
                        <span>Script:</span>
                        <select defaultValue="ai-generated">
                          <option value="ai-generated">AI generated script</option>
                          <option value="existing">Use existing script</option>
                          <option value="inline">Inline script</option>
                        </select>
                      </label>
                    ) : null}
                    {selectedTriggerCard === 'permissions' ? (
                      <div className="rv-email-trigger-permissions" aria-label="Automation permissions">
                        <label>
                          <input type="checkbox" />
                          <span>Read matching emails</span>
                        </label>
                        <label>
                          <input type="checkbox" />
                          <span>Apply or remove folders/tags</span>
                        </label>
                        <label>
                          <input type="checkbox" />
                          <span>Create tickets or records</span>
                        </label>
                        <label>
                          <input type="checkbox" />
                          <span>Send email</span>
                        </label>
                        <label>
                          <input type="checkbox" />
                          <span>Delete email</span>
                        </label>
                      </div>
                    ) : null}
                    <label className="rv-email-trigger-detail-field">
                      <span>Name:</span>
                      <input type="text" defaultValue={selectedTriggerCardTitle} />
                    </label>
                    <label className="rv-email-trigger-detail-field">
                      <span>Description:</span>
                      <textarea defaultValue={selectedTriggerCardDescription} rows={5} />
                    </label>
                    <label className="rv-email-trigger-detail-field rv-email-trigger-detail-field--metadata">
                      <span>Meta-Data:</span>
                      <textarea defaultValue={selectedTriggerCardMetadata} rows={8} />
                    </label>
                  </section>
                ) : null}
              </aside>
            </div>
          </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function EmailGrid() {
  useViewLayoutStyles(PANEL);

  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const [isSearchSubmitted, setIsSearchSubmitted] = useState(false);
  const [createModalKind, setCreateModalKind] = useState<EmailCreateModalKind | null>(null);
  const [createName, setCreateName] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);

  const trees = useFileDataStore((s) => s.trees);
  const contents = useFileDataStore((s) => s.contents);
  const contentErrors = useFileDataStore((s) => s.contentErrors);
  const fileDataGeneration = useFileDataStore((s) => s.generation);
  const emailMode = usePanelStore((s) => s.viewStates[PANEL]?.emailViewerMode ?? 'inbox');
  const openCompose = useEmailComposeStore((s) => s.openCompose);
  const emailPaperBrightness = normalizeOfficePaperBrightness(
    usePanelStore((s) => s.viewStates[PANEL]?.emailPaperBrightness)
  );
  const handlePaperBrightnessChange = useCallback((value: number) => {
    persistEmailViewPatch({ emailPaperBrightness: normalizeOfficePaperBrightness(value) });
  }, []);
  const currentFolder = usePanelStore((s) => s.viewStates[PANEL]?.emailViewerCurrentFolder ?? null);
  const selectedPath = usePanelStore((s) => s.viewStates[PANEL]?.emailViewerSelectedPath ?? null);
  const rawEmailActivity = usePanelStore((s) => s.viewStates[PANEL]?.activity);
  const rawEmailCollections = usePanelStore((s) => s.viewStates[PANEL]?.collections);
  const emailActivity = useMemo(
    () => normalizeViewActivity(rawEmailActivity),
    [rawEmailActivity]
  );
  const emailCollections = useMemo(
    () => normalizeViewCollections(rawEmailCollections),
    [rawEmailCollections]
  );
  const emailStarredItems = useMemo(
    () => emailCollections.starred.filter((item) => item.panel === PANEL),
    [emailCollections.starred]
  );
  const emailStarredIds = useMemo(
    () => new Set(emailCollections.starred.map((item) => item.id)),
    [emailCollections.starred]
  );
  const isEmailFileStarred = useCallback(
    (panel: string, path: string) => emailStarredIds.has(activityId(panel, path)),
    [emailStarredIds]
  );
  const recentGroups = useMemo(
    () => groupActivityByDate(emailActivity.recents),
    [emailActivity.recents]
  );
  // --- Directory listing (Home or folder view) ---
  const activeFolderPath = currentFolder ?? ROOT_PATH;
  const activeTreeKey = `${PANEL}:${activeFolderPath}`;
  const activeNodes = trees[activeTreeKey];
  const { files, loading: filesLoading } = useFolderFiles(
    PANEL,
    activeFolderPath
  );
  const {
    getFileContextMenuHandler,
    getFileMoreClickHandler,
    getFolderContextMenuHandler,
    getFolderMoreClickHandler,
  } = useFileTileMenu({
    panel: PANEL,
    folder: activeFolderPath,
  });

  const selectedFolderPath = selectedPath ? folderPathForFile(selectedPath) : activeFolderPath;
  const selectedContentError = selectedPath ? contentErrors[`${PANEL}:${selectedPath}`] : undefined;
  const selectedFile = useMemo<FileWithContent | null>(() => {
    if (!selectedPath) return null;
    const content = contents[`${PANEL}:${selectedPath}`];
    if (content === undefined) return null;
    const name = fileNameForPath(selectedPath);
    return {
      name,
      path: selectedPath,
      type: 'file',
      extension: extensionForName(name),
      content,
    };
  }, [contents, selectedPath]);

  useEffect(() => {
    if (!selectedPath) return;
    const fileData = useFileDataStore.getState();
    fileData.requestTree(PANEL, selectedFolderPath);
    fileData.requestContent(PANEL, selectedPath);
  }, [fileDataGeneration, selectedFolderPath, selectedPath]);

  useEffect(() => {
    if (!selectedPath || !selectedContentError) return;
    persistEmailViewPatch({
      emailViewerMode: 'home',
      emailViewerCurrentFolder: null,
      emailViewerSelectedPath: null,
    });
  }, [selectedContentError, selectedPath]);

  const directoryFolders: FolderInfo[] = useMemo(() => {
    if (!activeNodes) return [];
    return activeNodes
      .filter((n) => n.type === 'folder' && !n.name.startsWith('.'))
      .map((n) => ({ name: n.name, path: n.path }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeNodes]);

  const directoryHasFileNodes = useMemo(
    () => activeNodes?.some((n) => n.type === 'file' && !n.name.startsWith('.')) ?? false,
    [activeNodes]
  );

  const directoryTreeLoading = activeNodes === undefined;

  const {
    fileItems: searchItems,
    folderResults: searchFolderItems,
    rankedFileItems: rankedSearchItems,
    rankedFolderResults: rankedSearchFolderItems,
    loading: searchLoading,
  } = useEmailViewerSearch(
    {
      enabled: isSearchSubmitted,
      query: submittedSearchQuery,
    }
  );

  const handleSearchSubmit = useCallback(() => {
    setSubmittedSearchQuery(searchQuery);
    setIsSearchSubmitted(true);
  }, [searchQuery]);

  const handleSearchDismiss = useCallback(() => {
    setSearchQuery('');
    setSubmittedSearchQuery('');
    setIsSearchSubmitted(false);
  }, []);

  const leaveSearchMode = useCallback(() => {
    setSubmittedSearchQuery('');
    setIsSearchSubmitted(false);
  }, []);

  const handleFolderClick = useCallback((folderPath: string) => {
    persistEmailViewPatch({
      emailViewerMode: emailModeForFolder(folderPath),
      emailViewerCurrentFolder: folderPath,
      emailViewerSelectedPath: null,
    });
  }, []);

  const handleBackToFolders = useCallback(() => {
    persistEmailViewPatch({
      emailViewerMode: 'home',
      emailViewerCurrentFolder: null,
      emailViewerSelectedPath: null,
    });
    leaveSearchMode();
  }, [leaveSearchMode]);

  const handleNavigateToFolder = useCallback((folderPath: string) => {
    persistEmailViewPatch({
      emailViewerMode: emailModeForFolder(folderPath),
      emailViewerCurrentFolder: folderPath,
      emailViewerSelectedPath: null,
    });
    leaveSearchMode();
  }, [leaveSearchMode]);

  const hasSearchItems = searchItems.length > 0 || searchFolderItems.length > 0;
  const hasSearchMatches = rankedSearchItems.length > 0 || rankedSearchFolderItems.length > 0;

  const handleBackToFolder = useCallback(() => {
    persistEmailViewPatch({ emailViewerSelectedPath: null });
  }, []);

  const handleFileClick = useCallback((file: FileWithContent, folderOverride?: string) => {
    const folder = folderOverride ?? activeFolderPath;
    persistEmailViewPatch({
      emailViewerMode: emailModeForFolder(folder),
      emailViewerCurrentFolder: storedFolderPath(folder),
      emailViewerSelectedPath: file.path,
    });
    recordViewRecent(PANEL, {
      panel: PANEL,
      path: file.path,
      title: file.name,
      kind: 'document',
      folder,
      extension: file.extension ?? file.name.split('.').pop()?.toLowerCase(),
    });
  }, [activeFolderPath]);

  const handleSearchFileClick = useCallback((file: FileWithContent, folder: string) => {
    leaveSearchMode();
    handleFileClick(file, folder);
  }, [handleFileClick, leaveSearchMode]);

  const handleOpenFile = useCallback((path: string, folder: string) => {
    const fileData = useFileDataStore.getState();
    const cacheKey = `${PANEL}:${path}`;
    const cachedContent = fileData.contents[cacheKey] || '';

    if (!cachedContent) {
      fileData.requestContent(PANEL, path);
    }

    const name = fileNameForPath(path);
    const ext = extensionForName(name);

    persistEmailViewPatch({
      emailViewerMode: emailModeForFolder(folder),
      emailViewerCurrentFolder: storedFolderPath(folder),
      emailViewerSelectedPath: path,
    });
    recordViewRecent(PANEL, {
      panel: PANEL,
      path,
      title: name,
      kind: 'document',
      folder,
      extension: ext,
    });
  }, []);

  const emailHeaderTitle = isSearchSubmitted ? 'Search results' : currentFolder ? (
    <EmailBreadcrumb
      folderPath={currentFolder}
      onHomeClick={handleBackToFolders}
      onFolderClick={handleNavigateToFolder}
    />
  ) : 'Home';
  const headerRightControls = currentFolder && !isSearchSubmitted ? (
    <FloatingPathActions
      panel={PANEL}
      relativePath={currentFolder}
      copyTitle="Copy folder path"
      sendTitle="Send folder path to chat"
      ariaLabel="Folder actions"
    />
  ) : null;
  const handleSidebarAction = useCallback((action: EmailSidebarAction) => {
    persistEmailViewPatch({
      emailViewerMode: action,
      emailViewerCurrentFolder: null,
      emailViewerSelectedPath: null,
    });
    setSearchQuery('');
    setSubmittedSearchQuery('');
    setIsSearchSubmitted(false);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setCreateModalKind(null);
    setCreateName('');
  }, []);

  const handleSaveCreateItem = useCallback(() => {
    const name = createName.trim();
    if (!name || !createModalKind) return;

    sendFusionMessage({
      type: createModalKind === 'folder' ? 'folder_create' : 'document_create',
      panel: PANEL,
      parentPath: activeFolderPath,
      name,
    });
    handleCloseCreateModal();
  }, [activeFolderPath, createModalKind, createName, handleCloseCreateModal]);

  useEffect(() => onFusionMessage<DocumentCreateResponseMessage>('document_create_response', (msg) => {
    if (msg.panel !== PANEL || !msg.success || !msg.path || !msg.name) return;
    const parentPath = msg.parentPath ?? ROOT_PATH;
    persistEmailViewPatch({
      emailViewerMode: emailModeForFolder(parentPath),
      emailViewerCurrentFolder: storedFolderPath(parentPath),
      emailViewerSelectedPath: msg.path,
    });
    useFileDataStore.getState().handleContentResponse(PANEL, msg.path, msg.content ?? '');
    recordViewRecent(PANEL, {
      panel: PANEL,
      path: msg.path,
      title: msg.name,
      kind: 'document',
      folder: parentPath,
      extension: msg.extension ?? 'md',
    });
    setSubmittedSearchQuery('');
    setIsSearchSubmitted(false);
  }), []);

  useEffect(() => {
    const fileData = useFileDataStore.getState();
    for (const item of [...emailActivity.recents, ...emailStarredItems]) {
      const key = `${item.panel}:${item.path}`;
      if (!(key in fileData.contents)) {
        fileData.requestContent(item.panel, item.path);
      }
    }
  }, [emailActivity.recents, emailStarredItems, fileDataGeneration]);

  useEffect(() => {
    if (!rulesOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRulesOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rulesOpen]);

  const emailPaperStyle = {
    '--rv-email-paper-mute-alpha': officePaperMuteAlpha(emailPaperBrightness),
  } as React.CSSProperties;

  const renderEmailShell = (content: ReactNode, mainClassName = 'rv-email-grid', showSidebar = true) => (
    <div
      className={`rv-email-shell rv-email-view-transition${showSidebar ? '' : ' rv-email-shell--no-sidebar'}`}
      style={emailPaperStyle}
    >
      {showSidebar ? (
        <EmailSidebar
          activeAction={emailMode}
          onAction={handleSidebarAction}
          onCompose={openCompose}
        />
      ) : null}
      <main className={mainClassName}>
        {content}
      </main>
      <EmailComposeLayer />
      {rulesOpen ? (
        <EmailRulesPopover onClose={() => setRulesOpen(false)} />
      ) : null}
      {createModalKind ? (
        <EmailCreateModal
          kind={createModalKind}
          name={createName}
          onNameChange={setCreateName}
          onCancel={handleCloseCreateModal}
          onSave={handleSaveCreateItem}
        />
      ) : null}
    </div>
  );

  // --- File detail view ---
  if (selectedPath && !selectedFile) {
    return renderEmailShell(
      <div className="rv-email-loading">
        <span>Loading document...</span>
      </div>,
      'rv-email-detail-main',
      false
    );
  }

  if (selectedFile) {
    const documentFolderPath = folderPathForFile(selectedFile.path);
    const selectedFolderName = documentFolderPath ? documentFolderPath.split('/').pop() || documentFolderPath : 'Home';
    const isMarkdown = isMarkdownDocument(selectedFile);

    if (isMarkdown) {
      return renderEmailShell(
        <EmailDocumentPage
          key={selectedFile.path}
          file={selectedFile}
          folder={documentFolderPath}
          folderName={selectedFolderName}
          onBack={handleBackToFolder}
          onOpenFile={handleOpenFile}
        />,
        'rv-email-detail-main',
        false
      );
    }

    // Non-markdown files still use FilePageView
    return renderEmailShell(
      <FilePageView
        file={selectedFile}
        panel={PANEL}
        folder={documentFolderPath}
        folderName={selectedFolderName}
        onBack={handleBackToFolder}
      />,
      'rv-email-detail-main',
      false
    );
  }

  let emailContent: ReactNode;
  if (isSearchSubmitted) {
    if (searchLoading) {
      emailContent = (
        <div className="rv-email-loading">
          <span>Searching...</span>
        </div>
      );
    } else if (!hasSearchItems) {
      emailContent = (
        <div className="rv-email-empty">
          <Icon name="description" className="rv-email-empty-icon" />
          <span>No documents yet</span>
        </div>
      );
    } else if (!hasSearchMatches) {
      emailContent = (
        <div className="rv-email-empty">
          <Icon name="search_off" className="rv-email-empty-icon" />
          <span>No matches</span>
        </div>
      );
    } else {
      emailContent = (
        <EmailSectionedResults
          folderItems={rankedSearchFolderItems.map((folder) => (
            <EmailFolderCard
              key={folder.path}
              folder={folder}
              onClick={() => handleNavigateToFolder(folder.path)}
              onContextMenu={getFolderContextMenuHandler(folder)}
              onMoreClick={getFolderMoreClickHandler(folder)}
              title={folder.path}
            />
          ))}
          fileItems={rankedSearchItems.map(({ folder, file }) => (
            <EmailDocumentTile
              key={`${folder}/${file.path}`}
              name={file.name}
              content={file.content}
              extension={file.extension}
              panel={PANEL}
              folderPath={folder}
              starred={isEmailFileStarred(PANEL, file.path)}
              onClick={() => handleSearchFileClick(file, folder)}
              onContextMenu={getFileContextMenuHandler(file, folder)}
              onMoreClick={getFileMoreClickHandler(file, folder)}
            />
          ))}
        />
      );
    }
  } else if (MAIL_MODES.has(emailMode)) {
    emailContent = (
      <EmailSurface
        mode={emailMode}
        paperBrightness={emailPaperBrightness}
        onPaperBrightnessChange={handlePaperBrightnessChange}
      />
    );
  } else if (emailMode === 'recent') {
    emailContent = recentGroups.length === 0 ? (
      <div className="rv-email-empty">
        <Icon name="history" className="rv-email-empty-icon" />
        <span>No recent documents</span>
      </div>
    ) : (
      <EmailRecentResults
        groups={recentGroups}
        contents={contents}
        onOpenFile={handleOpenFile}
        onFileContextMenu={getFileContextMenuHandler}
        onFileMoreClick={getFileMoreClickHandler}
        isFileStarred={isEmailFileStarred}
      />
    );
  } else if (emailMode === 'starred') {
    emailContent = emailStarredItems.length === 0 ? (
      <div className="rv-email-empty">
        <Icon name="kid_star" className="rv-email-empty-icon" />
        <span>No starred documents</span>
      </div>
    ) : (
      <EmailSectionedResults
        folderItems={[]}
        fileItems={emailStarredItems.map((item) => {
          const folder = item.folder ?? item.path.split('/').slice(0, -1).join('/');
          const file: FileWithContent = {
            name: item.title,
            path: item.path,
            type: 'file',
            extension: item.extension ?? item.title.split('.').pop()?.toLowerCase(),
            content: contents[`${item.panel}:${item.path}`] || '',
          };
          return (
            <EmailDocumentTile
              key={item.id}
              name={file.name}
              content={file.content}
              extension={file.extension}
              panel={item.panel}
              folderPath={folder}
              starred={true}
              onClick={() => handleOpenFile(item.path, folder)}
              onContextMenu={getFileContextMenuHandler(file, folder)}
              onMoreClick={getFileMoreClickHandler(file, folder)}
            />
          );
        })}
      />
    );
  } else if (directoryTreeLoading) {
    emailContent = (
      <div className="rv-email-loading">
        <span>Loading files...</span>
      </div>
    );
  } else if (directoryFolders.length === 0 && !directoryHasFileNodes) {
    emailContent = (
      <div className="rv-email-empty">
        <Icon name="folder_open" className="rv-email-empty-icon" />
        <span>This folder is empty</span>
      </div>
    );
  } else {
    emailContent = (
      <EmailSectionedResults
        folderItems={directoryFolders.map((folder) => (
          <EmailFolderCard
            key={folder.path}
            folder={folder}
            onClick={() => handleFolderClick(folder.path)}
            onContextMenu={getFolderContextMenuHandler(folder)}
            onMoreClick={getFolderMoreClickHandler(folder)}
          />
        ))}
        fileItems={filesLoading && directoryHasFileNodes ? [
          <div key="loading-files" className="rv-email-loading rv-email-loading--inline">
            <span>Loading files...</span>
          </div>,
        ] : files.map((file) => (
          <EmailDocumentTile
            key={file.path}
            name={file.name}
            content={file.content}
            extension={file.extension}
            panel={PANEL}
            folderPath={activeFolderPath}
            starred={isEmailFileStarred(PANEL, file.path)}
            onClick={() => handleFileClick(file)}
            onContextMenu={getFileContextMenuHandler(file, activeFolderPath)}
            onMoreClick={getFileMoreClickHandler(file, activeFolderPath)}
          />
        ))}
      />
    );
  }

  const emailHeader = (
    <EmailViewerHeader
      title={
        emailMode === 'recent' ? 'Recent'
          : emailMode === 'archive' ? 'Archive'
          : EMAIL_SIDEBAR_ITEMS.find((item) => item.action === emailMode)?.label
            ?? emailHeaderTitle
      }
      toolbar={
        !isSearchSubmitted && MAIL_MODES.has(emailMode)
          ? <EmailToolbar />
          : undefined
      }
      rulesOpen={rulesOpen}
      searchQuery={searchQuery}
      isSearchSubmitted={isSearchSubmitted}
      rightControls={headerRightControls}
      showFolderFilters={Boolean(currentFolder)}
      onOpenRules={() => setRulesOpen(true)}
      onSearchQueryChange={setSearchQuery}
      onSearchSubmit={handleSearchSubmit}
      onSearchDismiss={handleSearchDismiss}
    >
      {emailContent}
    </EmailViewerHeader>
  );

  // --- Root, folder, and search list views ---
  return renderEmailShell(
    emailHeader
  );
}
