/**
 * @module panelStoreTypes
 * @role Shared TypeScript interfaces for the panel store and its slices.
 *       No runtime values — import type only where possible.
 */
import type {
  PanelState,
  Message,
  AssistantTurn,
  StreamSegment,
  Thread,
  ViewUIState,
  Pane,
  CollapsablePane,
  SecondaryState,
  HarnessStatus,
  ResolvedCliEntry,
  CliEntryOverride,
  ThemeEntry,
  WorkspaceHiddenView,
  WorkspaceViewTemplate,
  MessageExchangeSavedPayload,
  TokenUsage,
  TurnActivity,
  TurnTerminalError,
} from '../types';
import type { PanelConfig } from '../lib/panels';
import type { ChatLinkAttachment } from '../lib/chat-file-links/file-link-types';

// TINTS_SPEC §8b: leaf paths the setTint action accepts.
export type TintPath = 'leftPanel' | 'rightPanel' | 'cards' | 'borders.threads' | 'borders.chat';

// ── Connector state (Chunk F — macOS Connectors Panel) ──
export type ConnectorId = 'mail' | 'calendar' | 'notes' | 'reminders';
export type ConnectorStatusColor = 'gray' | 'yellow' | 'green' | 'red';

export interface ConnectorState {
  enabled: boolean;
  status: ConnectorStatusColor;
  lastSync: string | null;
}

// Composer provider/model/effort selection, per panel. Effort is the opencode
// `--variant` string for the chosen model (e.g. 'high'); it defaults to 'high'
// whenever the provider or model changes.
export interface ComposerModelSelection {
  providerId: string | null;
  modelId: string | null;
  effort: string | null;
}

// Per-workspace runtime state. currentPanel is persisted as workspace shell
// state; viewStates are loaded through the view-state resolver. panelConfigs
// and panelRoots are discovered from Views/.
export interface WorkspacePanelState {
  projectRoot: string | null;
  currentPanel: string;
  projectChats: Record<string, PanelState>;
  threads: Thread[];
  currentThreadId: string | null;
  chatActive: boolean;
  wireReady: boolean;
  contextUsage: number;
  tokenUsage: TokenUsage | null;
  panelConfigs: PanelConfig[];
  panelRoots: Record<string, string>;
  viewStates: Record<string, ViewUIState>;
}

// Full application state — the type contract for usePanelStore and all slices.
export interface AppState {
  // ── Workspace isolation (WORKSPACE_ISOLATION_SPEC) ──
  activeWorkspaceId: string | null;
  workspaceState: Record<string, WorkspacePanelState>;
  activateWorkspace: (workspaceId: string | null) => void;
  seedWorkspaceState: (workspaceId: string, state: Partial<WorkspacePanelState>) => void;
  evictWorkspaceRuntimeState: (workspaceId: string) => void;

  _prefetchAbort: AbortController | null;
  setPrefetchAbort: (controller: AbortController | null) => void;

  panelConfigs: PanelConfig[];
  setPanelConfigs: (configs: PanelConfig[]) => void;
  getPanelConfig: (id: string) => PanelConfig | undefined;
  viewRegistryUpdateError: string | null;
  hiddenViews: WorkspaceHiddenView[];
  availableViewTemplates: WorkspaceViewTemplate[];
  setViewOptions: (hiddenViews: WorkspaceHiddenView[], availableTemplates: WorkspaceViewTemplate[]) => void;
  requestViewOptions: () => void;
  restoreView: (viewId: string) => void;
  addView: (templateId: string) => void;
  setViewRegistryUpdateError: (message: string | null) => void;
  requestViewUpdate: (
    viewId: string,
    patch?: { label?: string; icon?: string; enabled?: boolean },
    move?: 'up' | 'down'
  ) => void;

  sharedStylesGeneration: number;
  bumpSharedStylesGeneration: () => void;

  // ── Panel navigation ──
  currentPanel: string;
  setCurrentPanel: (id: string) => void;

  // ── Chat state (RCC-0095: single workspace chat, keyed by threadId) ──
  projectChats: Record<string, PanelState>;

  addMessage: (threadId: string | null, message: Message) => void;
  setCurrentTurn: (threadId: string | null, turn: AssistantTurn | null) => void;
  updateTurnContent: (threadId: string | null, content: string) => void;
  appendSegment: (threadId: string | null, segType: StreamSegment['type'], text: string) => void;
  pushSegment: (threadId: string | null, segment: StreamSegment) => void;
  updateLastSegment: (threadId: string | null, updates: Partial<StreamSegment>) => void;
  updateSegmentByIndex: (threadId: string | null, index: number, updates: Partial<StreamSegment>) => void;
  updateSegmentByToolCallId: (threadId: string | null, toolCallId: string, updates: Partial<StreamSegment>) => void;
  appendSegmentContentByIndex: (threadId: string | null, index: number, text: string) => void;
  resetSegments: (threadId: string | null) => void;
  setPendingTurnEnd: (threadId: string | null, pending: boolean) => void;
  setPendingPromptAcceptance: (
    threadId: string,
    pending: PanelState['pendingPromptAcceptance'],
  ) => void;
  setPromptRetryDraft: (
    threadId: string,
    draft: PanelState['retryPromptDraft'],
  ) => void;
  setPendingExchangeSave: (threadId: string | null, turnId: string | null) => void;
  setPendingMessage: (threadId: string | null, message: Message | null) => void;
  setTodoDrawer: (threadId: string | null, drawer: PanelState['todoDrawer']) => void;
  setMessageExchangeSaved: (
    threadId: string,
    turnId: string,
    payload: MessageExchangeSavedPayload
  ) => void;
  updateMessageMetadata: (
    threadId: string,
    exchangeId: number,
    metadata: Record<string, unknown>
  ) => void;
  finalizeTurn: (threadId: string | null, terminalError?: TurnTerminalError) => void;
  clearChat: (threadId: string | null) => void;

  // ── RCC-0108 SPEC-05 Slice A: observable transient Working activity ──
  // Transition rules + gate ownership live in slices/chatActivityState.ts.
  setTurnActivity: (threadId: string, activity: TurnActivity) => void;
  /** Unconditional clear: turn_end (any reason) / terminalization / new-turn reset. */
  clearTurnActivity: (threadId: string) => void;
  /** Strictly-greater gated clear for the first renderable output event. */
  clearTurnActivityIfNewer: (threadId: string, activityRevision: number) => void;

  // ── WebSocket ──
  ws: WebSocket | null;
  setWs: (ws: WebSocket | null) => void;
  sendMessage: (text: string, threadId?: string | null, attachments?: ChatLinkAttachment[]) => void;
  warmThread: (threadId?: string | null) => void;

  // ── Project root ──
  projectRoot: string | null;
  setProjectRoot: (root: string | null) => void;

  panelRoots: Record<string, string>;
  setPanelRoots: (roots: Record<string, string>) => void;

  // ── Context usage ──
  contextUsage: number;
  setContextUsage: (usage: number) => void;
  tokenUsage: TokenUsage | null;
  setTokenUsage: (usage: TokenUsage | null) => void;

  // ── Thread management (RCC-0095: single workspace chat) ──
  threads: Thread[];
  currentThreadId: string | null;
  // True once a thread's wire is ready/opened for this workspace; gates the
  // active styling + input placeholder (was currentScope === 'project').
  chatActive: boolean;
  wireReady: boolean;

  setThreads: (threads: Thread[]) => void;
  setCurrentThreadId: (threadId: string | null) => void;
  setChatActive: (active: boolean) => void;
  setWireReady: (ready: boolean) => void;
  addThread: (thread: Thread) => void;
  updateThread: (threadId: string, updates: Partial<Thread['entry']>) => void;
  removeThread: (threadId: string) => void;

  // ── Per-view UI state (SPEC-26c-2) ──
  viewStates: Record<string, ViewUIState>;
  loadViewState: (view: string) => void;
  setViewState: (view: string, state: Partial<ViewUIState>) => void;
  _persistViewPatch: (
    view: string,
    patch: Partial<ViewUIState>,
    clientMutationId?: number,
  ) => void;
  toggleCollapsed: (view: string, pane: CollapsablePane) => void;
  setPaneWidth: (view: string, pane: Pane, width: number) => void;
  commitPaneWidths: (view: string, pane?: Pane) => void;
  setTint: (view: string, path: TintPath, value: boolean) => void;

  // ── Chat-header dropdown UI state (transient) ──
  cliPickerOpen: Record<string, boolean>;
  threadDropdownOpen: Record<string, boolean>;
  toggleCliPicker: (panel: string) => void;
  closeCliPicker: (panel: string) => void;
  toggleThreadDropdown: (panel: string) => void;
  closeThreadDropdown: (panel: string) => void;
  closeAllChatHeaderDropdowns: (panel: string) => void;

  // ── Composer model selection (provider/model/effort) per panel ──
  composerModelConfig: Record<string, ComposerModelSelection>;
  setComposerModelConfig: (panel: string, patch: Partial<ComposerModelSelection>) => void;

  // ── Harness status cache (HARNESS_STATUS_CACHE_SPEC) ──
  harnessStatuses: Record<string, HarnessStatus>;
  setHarnessStatuses: (map: Record<string, HarnessStatus>) => void;
  setHarnessStatus: (id: string, status: HarnessStatus) => void;

  // ── Modal open state ──
  isThemePickerOpen: boolean;
  setThemePickerOpen: (open: boolean) => void;
  isSecretsManagerOpen: boolean;
  setSecretsManagerOpen: (open: boolean) => void;

  // ── Theme catalog (THEME_PICKER_SPEC §6a) ──
  themes: ThemeEntry[];
  activeThemeId: string | null;
  hydrateThemes: (themes: ThemeEntry[], activeId: string | null) => void;
  activateTheme: (id: string) => void;
  saveTheme: (entry: Partial<ThemeEntry> & { id: string }) => void;
  deleteTheme: (id: string) => void;

  // ── CLI config (CLI_CONFIG_SPEC §8a) ──
  cliConfig: Record<string, ResolvedCliEntry>;
  cliConfigViewDelta: Record<string, Record<string, CliEntryOverride>>;
  hydrateCliConfig: (cfg: Record<string, ResolvedCliEntry>) => void;
  setCliConfigViewDelta: (viewId: string, delta: Record<string, CliEntryOverride>) => void;

  // ── Connectors (Chunk F — macOS Connectors Panel) ──
  isConnectorsDropdownOpen: boolean;
  setConnectorsDropdownOpen: (open: boolean) => void;
  connectorStatuses: Record<ConnectorId, ConnectorState>;
  toggleConnector: (id: ConnectorId) => void;
  setConnectorStatus: (id: ConnectorId, patch: Partial<ConnectorState>) => void;

  // ── Harness connection state ──
  connectingHarnessId: string | null;
  setConnectingHarnessId: (id: string | null) => void;
  selectHarness: (harnessId: string, modelId?: string) => void;
  createDefaultAssistantThread: () => void;

  // ── Secondary chat (SECONDARY_CHAT_SPEC) ──
  secondary: SecondaryState | null;
  openSecondary: (threadId: string) => void;
  closeSecondary: () => void;
  minimizeSecondary: () => void;
  restoreSecondary: () => void;
  clearJustRestored: () => void;
  dockSecondary: () => void;
  undockSecondary: () => void;
  setSecondaryFloat: (x: number, y: number, width: number, height: number) => void;
  setSecondaryStickyWidth: (width: number) => void;
}
