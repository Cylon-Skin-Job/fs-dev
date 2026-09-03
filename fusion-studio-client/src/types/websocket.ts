/**
 * @module types/websocket
 * @role Legacy wire surface — the full message-type union and the broad
 * inbound/outbound message bag consumed by the generic socket ingress.
 *
 * Split out of the former monolithic types module (SPEC-04 Slice A); the
 * typed REQUIRED-shape routed chat contracts live in ./chat-wire.
 * Transport truth: declarations only, no runtime logic.
 */

import type {
  ChatTurnBookmarkType,
  ExchangeData,
  LiveTurnSnapshot,
  TokenUsage,
  TurnTerminalError,
  UniversalToolDisplay,
} from './chat';
import type {
  CliEntryOverride,
  ResolvedCliEntry,
  Thread,
  ThreadEntry,
  ThreadForkMetadata,
  Workspace,
  WorkspaceCreateManifest,
  WorkspaceHiddenView,
  WorkspaceViewTemplate,
} from './workspace';

export type WebSocketMessageType =
  // Turn stream / chat metadata
  | 'connected' | 'turn_begin' | 'content' | 'thinking' | 'turn_end'
  | 'step_begin' | 'status_update' | 'exchange_metadata'
  | 'chat-turn:saved' | 'chat-turn:metadata:update' | 'chat-turn:metadata:updated'
  | 'chat-turn:metadata:error'
  // RCC-0108 SPEC-03 frozen retrieval route (client ⇄ server)
  | 'chat-turn:diagnostic:get' | 'chat-turn:diagnostic:report'
  | 'chat-turn:diagnostic:unavailable'
  // Requests / errors / tools
  | 'request' | 'response' | 'error'
  | 'tool_call' | 'tool_call_args' | 'tool_result' | 'subagent_event'
  // Thread messages
  | 'thread:list' | 'thread:created' | 'thread:forked' | 'thread:opened'
  | 'thread:renamed' | 'thread:deleted' | 'message:sent' | 'auth_error'
  | 'thread:create:confirm' | 'thread:state_changed'
  // Modal messages
  | 'modal:show' | 'file:moved' | 'file:move_error' | 'file:renamed'
  | 'file:rename_error' | 'file:deleted' | 'file:delete_error'
  | 'office:thumbnail_saved' | 'office:thumbnail_error'
  | 'panel_config' | 'panel_changed' | 'file_changed' | 'file_tree_response'
  | 'file_content_response' | 'file_save' | 'file_save_response'
  | 'folder_create_response' | 'document_create_response'
  | 'fusion:tabs' | 'fusion:items' | 'fusion:wiki'
  // Clipboard messages
  | 'clipboard:list' | 'clipboard:append' | 'clipboard:touch' | 'clipboard:use'
  | 'clipboard:delete' | 'clipboard:clear' | 'clipboard:state' | 'clipboard:error'
  // Emoji recents messages
  | 'emoji_recents:list' | 'emoji_recents:record' | 'emoji_recents:error'
  | 'wire_ready' | 'wire_disconnected' | 'parse_error'
  // View UI state (SPEC-26c-2)
  | 'state:result' | 'state:error'
  // Workspace messages (WORKSPACE_CLIENT_UI_SPEC)
  | 'workspace:init' | 'workspace:registry_changed' | 'workspace:switched'
  | 'workspace:added' | 'workspace:removed' | 'workspace:ribbon_removed'
  | 'workspace:add_rejected_duplicate' | 'workspace:add_rejected_missing_ai'
  | 'workspace:create_manifest' | 'workspace:create_rejected'
  | 'workspace:ribbon_reorder_rejected' | 'workspace:created'
  | 'workspace:view_options_requested' | 'workspace:view_options'
  | 'workspace:view_update_requested' | 'workspace:view_restore_requested'
  | 'workspace:view_add_requested' | 'workspace:view_registry_updated'
  | 'workspace:view_update_rejected' | 'workspace:unavailable_at_launch'
  // Harness install-status cache (HARNESS_STATUS_CACHE_SPEC)
  | 'harness:status_changed'
  // Theme picker (THEME_PICKER_SPEC)
  | 'theme:list' | 'theme:state' | 'theme:activate' | 'theme:save'
  | 'theme:delete' | 'theme:error'
  // Secrets manager (SECRETS_MANAGER_SPEC §8a)
  | 'secrets:api-keys:state' | 'secrets:api-keys:error'
  // Screenshot manager
  | 'screenshot:data' | 'screenshot:list' | 'screenshot:updated'
  | 'screenshot:missing' | 'screenshot:error' | 'screenshot:file-capture'
  | 'screenshot:file-captured' | 'screenshot:refresh-source'
  | 'screenshot:source-refreshed'
  // Calendar / bookmarks
  | 'calendar:sync_complete'
  | 'bookmarks:list' | 'bookmarks:updated' | 'bookmarks:error'
  // Workspace palette projection and mutation protocol
  | 'office:palette_state' | 'office:palette_error';

/**
 * Broad inbound/outbound message bag preserved for the generic socket ingress
 * and every non-routed consumer. The legacy per-step ordering field has been
 * removed entirely (SPEC-04 §3.A.4); canonical sequencing requirements live
 * in the REQUIRED-shape interfaces in ./chat-wire.
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  turnId?: string;
  /** Positive-integer whole-turn sequence REQUIRED on the routed in-flight family (REQUIRED shape lives in ./chat-wire). */
  streamSeq?: number;
  /** Opaque retrieval identifier carried by diagnostic request/report/unavailable frames. */
  diagnosticId?: string;
  ts?: number;
  text?: string;
  userInput?: string;
  fullText?: string;
  partial?: boolean;
  contextUsage?: number;
  tokenUsage?: TokenUsage | null;
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
  /**
   * Fixed availability marker attached ONLY by diagnostic log redaction
   * (RCC-0108 roadmap §5.5) on reduced `chat-turn:diagnostic:unavailable`
   * log frames. Never echoed from any inbound payload.
   */
  availability?: 'unavailable';
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
  sourceMachineName?: string;
  workspaceId?: string | null;
  from?: string | null;
  to?: string | null;
  repoPath?: string | null;
  homePath?: string;
  existingWorkspace?: Workspace;
  manifest?: WorkspaceCreateManifest;
  reason?: string;
  /**
   * RCC-0108 parent §4.13 (accepted SPEC-03 §7): closed safe terminal-error
   * envelope on an error `turn_end`. Absent-key semantics — PRESENT only on
   * reason 'error', OMITTED otherwise, never null. The REQUIRED-shape
   * contract lives in ./chat-wire (WsTurnEndMessage); this broad-bag field
   * only lets the generic ingress reach the typed value for validation.
   */
  terminalError?: TurnTerminalError;
  // Harness status-change fields (HARNESS_STATUS_CACHE_SPEC)
  installed?: boolean;
  version?: string | null;
  binary_path?: string | null;
  // CLI config (CLI_CONFIG_SPEC §7c, §7d)
  cliConfig?: Record<string, ResolvedCliEntry>;
  cliConfigDelta?: Record<string, CliEntryOverride>;
}
