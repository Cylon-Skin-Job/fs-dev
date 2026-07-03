// Panel Types — PanelId is now a string alias (panels are discovered dynamically)
export type PanelId = string;

// Todo types for the bottom drawer
export type TodoItemStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoItem {
  id: string;
  content: string;
  status: TodoItemStatus;
  priority?: 'low' | 'medium' | 'high';
}

export interface TodoDrawerState {
  items: TodoItem[];
  updatedAt: number;
  open: boolean;
}

export interface UniversalDiffDisplay {
  type: 'diff';
  path: string;
  oldText: string;
  newText: string;
  oldStart: number;
  newStart: number;
  removedLines: number;
  addedLines: number;
  isSummary?: boolean;
}

export type UniversalToolDisplay = UniversalDiffDisplay | {
  type?: string;
  [key: string]: unknown;
};

// All segment types that can appear in the ordered stream
export type SegmentType =
  | 'think' | 'text'
  | 'shell' | 'read' | 'write' | 'edit'
  | 'glob' | 'grep' | 'web_search' | 'fetch'
  | 'subagent' | 'todo';

// Stream segment — one contiguous block in arrival order
export interface StreamSegment {
  type: SegmentType;
  content: string;
  icon?: string;
  label?: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
  toolDisplay?: UniversalToolDisplay[];
  toolStatus?: string;
  returnedDiff?: boolean;
  isError?: boolean;
  /** Number of tool calls collapsed into this live grouped segment. */
  groupCount?: number;
  /** True when the closing tag has arrived — content is final */
  complete?: boolean;
}

// Message Types
export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Ordered segments (think + text inline) for assistant messages */
  segments?: StreamSegment[];
  /** Queue position when added to history; used for consistent render */
  releasedSegmentCount?: number;
  exchangeId?: number;
  exchangeSeq?: number;
  metadata?: Record<string, unknown>;
}

export interface MessageExchangeSavedPayload {
  exchangeId?: number;
  seq?: number;
  ts?: number;
  metadata?: Record<string, unknown>;
}

export type ChatTurnBookmarkType = 'flag' | 'star' | 'heart';

export interface ChatTurnMetadataPatch {
  bookmark?: { type: ChatTurnBookmarkType } | null;
  note?: { body: string } | null;
}

export interface AssistantTurn {
  id: string;
  content: string;
  status: 'streaming' | 'complete';
  hasThinking: boolean;
  thinkingContent: string;
}

// Panel State
export interface PanelState {
  // Messages
  messages: Message[];
  currentTurn: AssistantTurn | null;

  pendingTurnEnd: boolean;
  /** Message to add when typing completes; set at turn_end, cleared by finalizeTurn */
  pendingMessage: Message | null;

  // Ordered stream of segments (think and text inline, in arrival order)
  segments: StreamSegment[];

  /** Captured at finalize; used when adding to messages at turn_begin */
  lastReleasedSegmentCount: number;

  /** Per-thread todo drawer state (TODO_DRAWER_SPEC) */
  todoDrawer?: TodoDrawerState;

  /** Saved-exchange acks that arrived before live reveal finalization. */
  pendingSavedExchanges?: Record<string, MessageExchangeSavedPayload>;

  /** Current turn waiting for SQLite saved-exchange acknowledgement. */
  pendingExchangeSaveTurnId?: string | null;

}

// WebSocket Message Types
export type WebSocketMessageType =
  | 'connected'
  | 'turn_begin'
  | 'content'
  | 'thinking'
  | 'turn_end'
  | 'step_begin'
  | 'status_update'
  | 'exchange_metadata'
  | 'chat-turn:saved'
  | 'chat-turn:metadata:update'
  | 'chat-turn:metadata:updated'
  | 'chat-turn:metadata:error'
  | 'request'
  | 'response'
  | 'error'
  | 'tool_call'
  | 'tool_call_args'
  | 'tool_result'
  | 'subagent_event'
  // Thread messages
  | 'thread:list'
  | 'thread:created'
  | 'thread:forked'
  | 'thread:opened'
  | 'thread:renamed'
  | 'thread:deleted'
  | 'message:sent'
  | 'auth_error'
  // Modal messages
  | 'modal:show'
  | 'file:moved'
  | 'file:move_error'
  | 'file:renamed'
  | 'file:rename_error'
  | 'file:deleted'
  | 'file:delete_error'
  | 'panel_config'
  | 'panel_changed'
  | 'file_changed'
  | 'file_tree_response'
  | 'file_content_response'
  | 'file_save'
  | 'file_save_response'
  | 'fusion:tabs'
  | 'fusion:items'
  | 'fusion:wiki'
  // Clipboard messages
  | 'clipboard:list'
  | 'clipboard:append'
  | 'clipboard:touch'
  | 'clipboard:use'
  | 'clipboard:delete'
  | 'clipboard:clear'
  | 'clipboard:state'
  | 'clipboard:error'
  // Emoji recents messages
  | 'emoji_recents:list'
  | 'emoji_recents:record'
  | 'emoji_recents:error'
  // Recent docs messages
  | 'recent_docs:list'
  | 'recent_docs:record'
  | 'recent_docs:clear'
  | 'recent_docs:updated'
  | 'recent_docs:cleared'
  | 'recent_docs:error'
  | 'wire_ready'
  | 'wire_disconnected'
  | 'parse_error'
  | 'thread:create:confirm'
  // View UI state (SPEC-26c-2)
  | 'state:result'
  | 'state:error'
  // Workspace messages (WORKSPACE_CLIENT_UI_SPEC)
  | 'workspace:init'
  | 'workspace:registry_changed'
  | 'workspace:switched'
  | 'workspace:added'
  | 'workspace:removed'
  | 'workspace:ribbon_removed'
  | 'workspace:add_rejected_duplicate'
  | 'workspace:add_rejected_missing_ai'
  | 'workspace:create_manifest'
  | 'workspace:create_rejected'
  | 'workspace:ribbon_reorder_rejected'
  | 'workspace:created'
  | 'workspace:view_options_requested'
  | 'workspace:view_options'
  | 'workspace:view_update_requested'
  | 'workspace:view_restore_requested'
  | 'workspace:view_add_requested'
  | 'workspace:view_registry_updated'
  | 'workspace:view_update_rejected'
  | 'workspace:culled_at_launch'
  | 'thread:state_changed'
  // Harness install-status cache (HARNESS_STATUS_CACHE_SPEC)
  | 'harness:status_changed'
  // Theme picker (THEME_PICKER_SPEC)
  | 'theme:list'
  | 'theme:state'
  | 'theme:activate'
  | 'theme:save'
  | 'theme:delete'
  | 'theme:error'
  // Secrets manager (SECRETS_MANAGER_SPEC §8a)
  | 'secrets:api-keys:state'
  | 'secrets:api-keys:error'
  // Screenshot manager
  | 'screenshot:data'
  | 'screenshot:list'
  | 'screenshot:updated'
  | 'screenshot:missing'
  | 'screenshot:error'
  | 'screenshot:file-capture'
  | 'screenshot:file-captured'
  | 'screenshot:refresh-source'
  | 'screenshot:source-refreshed'
  // Calendar messages
  | 'calendar:sync_complete'
  // Bookmarks messages
  | 'bookmarks:list'
  | 'bookmarks:updated'
  | 'bookmarks:error';

// Slider-only theme model — accent + 4 sliders.
export interface ThemeEntry {
  id:             string;
  label:          string;
  accent:         string;   // hex #RRGGBB
  luminance:      number;   // 0-100
  panelContrast?: number;   // 0-100 (50 = baseline panel deltas; 0 = monotone; 100 = 2× exaggerated)
  bgTint?:        number;   // 0-30 percent accent blended into background surfaces
  contentLuminance?: number; // 0-100 luminance for content/code surfaces only
  contentContrast?: number;  // 0-100 contrast for content/code surfaces (stub)
  contentTint?:   number;   // 0-30 percent accent blended into content/code surfaces
  borders?:       number;   // 0-100 percent accent blended into borders (legacy — replaced by borderLuminance + borderTint)
  borderLuminance?: number; // 0-100 black-to-white base for borders
  borderTint?:    number;   // 0-100 percent accent blended into border base
  chromeLuminance?: number; // 0-100 black-to-white base for chrome accents
  chromeTint?:    number;   // 0-100 percent accent blended into chrome base
  accentLuminance?: number; // 0-100 black-to-white base for muted accent surfaces
  accentTint?:    number;   // 0-100 percent accent blended into muted accent base
  chatBubbleChrome?: boolean; // When true, user chat bubble bg uses --chrome-accent (dim structural chrome color)
  themeCode?:        boolean; // When true, syntax palette hues derive from accent instead of fixed rainbow
  tints?: {
    borders?: { chat?: boolean };
  };
  builtin:        boolean;
  active:         boolean;
  // Schema 2.0 vestigial fields (preserved but unused in slider-only mode)
  mode?:         'light' | 'dark' | 'unknown';
  bgPrimary?:    string | null;
  bgSurface?:    string | null;
  bgDark?:       string | null;
  textPrimary?:  string | null;
  textDim?:      string | null;
  link?:         string | null;
  border?:       string | null;
  focus?:        string | null;
}

export interface Workspace {
  id: string;
  label: string;
  icon: string;
  description: string | null;
  repoPath: string;
  sortOrder: number;
  type?: 'code' | 'app';
  ribbonVisible?: boolean;
  ribbonSortOrder?: number | null;
}

export interface WorkspaceViewTemplate {
  id: string;
  label: string;
  group: 'default' | 'optional';
  status: 'ready' | 'active-development' | 'stub';
  icon?: string;
  templatePath: string;
}

export interface WorkspaceTemplateProfile {
  schemaVersion: number;
  id: string;
  label: string;
  category: 'new' | 'startup' | string;
  description?: string;
  selectedViewIds: string[];
  profilePath?: string | null;
}

export interface WorkspaceCreateManifest {
  version: number;
  views: WorkspaceViewTemplate[];
  workspaceTemplates?: WorkspaceTemplateProfile[];
}

export interface WorkspaceHiddenView {
  id: string;
  baseViewId: string;
  label: string;
  icon: string;
}

// CLI_CONFIG_SPEC §6: resolved CLI catalog entry (factory + workspace + view).
export interface ResolvedCliEntry {
  id: string;
  name: string;
  description: string;
  materialIcon: string;
  accentColor?: string;
  details: {
    provider: string;
    model: string;
    features: string[];
  };
  runtime?: {
    model?: string | null;
    thinking?: boolean;
    pure?: boolean;
  };
  enabled: boolean;
  comingSoon?: boolean;
  recommended?: boolean;
  order: number;
}

export type CliEntryOverride = Partial<Pick<ResolvedCliEntry, 'enabled' | 'name' | 'materialIcon' | 'accentColor' | 'order'>> & {
  details?: Partial<ResolvedCliEntry['details']>;
  runtime?: ResolvedCliEntry['runtime'];
};

export interface WebSocketMessage {
  type: WebSocketMessageType;
  turnId?: string;
  ts?: number;
  text?: string;
  userInput?: string;
  fullText?: string;
  partial?: boolean;
  stepNumber?: number;
  contextUsage?: number;
  tokenUsage?: number;
  requestType?: string;
  payload?: unknown;
  requestId?: string;
  id?: string;
  result?: unknown;
  error?: string;
  sessionId?: string;
  toolName?: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
  argsChunk?: string;
  toolOutput?: unknown;
  toolDisplay?: UniversalToolDisplay[];
  toolStatus?: string;
  returnedDiff?: boolean;
  isError?: boolean;
  parentToolCallId?: string;
  agentId?: string;
  subagentType?: string;
  subagentEventType?: string;
  subagentPayload?: unknown;
  // Thread fields
  panel?: string;
  threadId?: string;
  thread?: ThreadEntry;
  threads?: Thread[];
  history?: { role: 'user' | 'assistant'; content: string; hasToolCalls?: boolean }[];
  exchanges?: ExchangeData[];  // Rich format with tool calls
  liveTurn?: LiveTurnSnapshot | null;
  name?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  fork?: ThreadForkMetadata | null;
  exchangeId?: number;
  seq?: number;
  message?: string;
  // RCC-0095: server still stamps scope: 'project' on thread/stream
  // messages for wire compatibility; the client routes by threadId only.
  scope?: string;
  viewId?: string | null;
  templateId?: string;
  patch?: {
    label?: string;
    icon?: string;
    enabled?: boolean;
    bookmark?: { type: ChatTurnBookmarkType } | null;
    note?: { body: string } | null;
  };
  move?: 'up' | 'down';
  registry?: unknown;
  hiddenViews?: WorkspaceHiddenView[];
  availableTemplates?: WorkspaceViewTemplate[];
  // Workspace fields (WORKSPACE_CLIENT_UI_SPEC)
  workspaces?: Workspace[];
  workspace?: Workspace;
  activeWorkspaceId?: string | null;
  workspaceId?: string;
  from?: string | null;
  to?: string | null;
  repoPath?: string | null;
  homePath?: string;
  existingWorkspace?: Workspace;
  manifest?: WorkspaceCreateManifest;
  reason?: string;
  // Harness status-change fields (HARNESS_STATUS_CACHE_SPEC)
  installed?: boolean;
  version?: string | null;
  binary_path?: string | null;
  // CLI config (CLI_CONFIG_SPEC §7c, §7d)
  cliConfig?: Record<string, ResolvedCliEntry>;
  cliConfigDelta?: Record<string, CliEntryOverride>;
}

// SPEC-26c-2: per-view UI state (collapse + pane widths)
// SECONDARY_CHAT_SPEC: `rightSecondary` added for the sticky-right column.
// `rightCol` is the view's right column (e.g. file-viewer file tree) — kept
// separate from rightSecondary so the file tree retains its own width when
// the sticky chat undocks.
export type Pane = 'leftSidebar' | 'leftChat' | 'rightSecondary' | 'rightCol';
// Only the left panes have collapse state — the secondary has its own
// show/hide via traffic-light modes, not a collapse toggle.
export type CollapsablePane = 'leftSidebar' | 'leftChat';

export interface ViewUIState {
  collapsed: {
    leftSidebar: boolean;
    leftChat: boolean;
  };
  widths: {
    leftSidebar: number;
    leftChat: number;
    rightSecondary?: number;  // sticky secondary chat width (when docked)
    rightCol?: number;        // view's right column (e.g. file-viewer file tree)
  };
  // STATE_OVERRIDE_SPEC §5: persisted popup geometry.
  popup: {
    open: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    threadId: string | null;
  };
  currentThreadId: string | null;
  secondaryThreadId: string | null;
  // TINTS_SPEC §4: per-surface tint toggles. All default false (neutral).
  tints: ViewStateTints;
  // Doc viewer persisted UI state.
  docViewerMode?: 'active' | 'archive';
  docViewerActiveSelectedPath?: string | null;
  docViewerArchiveSelectedPath?: string | null;
  docViewerActiveGridScroll?: number;
  docViewerArchiveGridScroll?: number;
  docViewerActiveDocScroll?: number;
  docViewerArchiveDocScroll?: number;
}

export interface ViewStateTints {
  leftPanel:     boolean;
  rightPanel:    boolean;
  cards:         boolean;
  borders: {
    threads: boolean;
    chat:    boolean;
  };
}

// SECONDARY_CHAT_SPEC: singleton secondary-chat state (replaces SPEC-26d popup).
// Top-level, not per-panel — at most one secondary exists per workspace.
export type SecondaryMode = 'floating' | 'minimized' | 'sticky-right';

export interface SecondaryState {
  threadId: string;
  mode: SecondaryMode;
  previousMode: 'floating' | 'sticky-right';  // where minimize came from
  float: { x: number; y: number; width: number; height: number };
  // Set true by restoreSecondary; read by SecondaryChat/SecondaryChatSticky
  // on mount to play the reverse genie animation. Cleared by the component
  // after the animation finishes.
  justRestored?: boolean;
}

// RCC-0095: single workspace chat. All threads are workspace-scoped and
// follow the user across panel switches. (The legacy per-view scope has
// been removed; the server still emits scope: 'project' on the wire.)

// Thread Types
export interface ThreadEntry {
  // null when the thread has no display name yet. SPEC-24e: UI falls back
  // to the thread ID with milliseconds stripped (e.g. 2026-04-09T14-30-22).
  name: string | null;
  createdAt: string;
  resumedAt?: string;
  messageCount: number;
  status: 'active' | 'suspended';
  // RCC-0095: server returns scope: 'project' on every thread entry (wire compat)
  scope?: string;
  viewId?: string | null;
  // CLI_IDENTITY_SPEC: which harness owns this thread
  harnessId?: string;
  harnessConfig?: ThreadHarnessConfig | null;
}

export interface ThreadForkMetadata {
  type?: string;
  status?: string;
  sourceThreadId?: string;
  sourceThreadName?: string;
  sourceExchangeId?: number | null;
  sourceExchangeSeq?: number | null;
  sourceOpenCodeSessionId?: string;
  createdOpenCodeSessionId?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ThreadHarnessConfig {
  opencodeSessionId?: string;
  pendingFork?: ThreadForkMetadata | null;
  forkProvenance?: ThreadForkMetadata | null;
  [key: string]: unknown;
}

// Moved from ChatHarnessPicker — harness installation status
export interface HarnessStatus {
  id: string;
  installed: boolean;
  builtIn: boolean;
  version: string | null;
  action: string | null;
  installCommand: string | null;
}

export interface Thread {
  threadId: string;
  entry: ThreadEntry;
}

// Rich History Format (from history.json)
export interface ToolCallPart {
  type: 'tool_call';
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  result: {
    output?: string;
    statusMessage?: string;
    display?: UniversalToolDisplay[];
    returnedDiff?: boolean;
    isError?: boolean;
    error?: string;
    files?: string[];
  };
  duration_ms?: number;
}

export interface TextPart {
  type: 'text';
  content: string;
}

export interface ThinkPart {
  type: 'think';
  content: string;
}

export type AssistantPart = TextPart | ThinkPart | ToolCallPart;

export interface LiveTurnSnapshot {
  workspaceId: string;
  scope: string;
  threadId: string;
  turnId: string;
  userInput: string;
  status: 'in_flight' | 'complete' | 'interrupted' | 'error';
  fullText: string;
  parts: AssistantPart[];
  streamSeq: number;
  updatedAt: number;
}

export interface ExchangeData {
  exchangeId?: number;
  seq: number;
  ts: number;
  user: string;
  assistant: {
    parts: AssistantPart[];
  };
  metadata?: Record<string, unknown>;
}

// Timing Constants
export const TIMING = {
  RIBBON_ENTER: 150,
  RIBBON_EXIT: 200,
  PRE_THINKING_PAUSE: 200,
  THINKING_MIN_DURATION: 800,
  TEXT_TYPEWRITER: 5,
  CODE_TYPEWRITER: 2,
  PULSE_SINGLE: 800,
  CODE_TRANSITION_DELAY: 400,
  CODE_RESUME_DELAY: 300,
} as const;

// PANEL_CONFIGS removed — panels are now discovered dynamically.
// Use usePanelStore().panelConfigs instead.
// See lib/panels.ts for PanelConfig type.
