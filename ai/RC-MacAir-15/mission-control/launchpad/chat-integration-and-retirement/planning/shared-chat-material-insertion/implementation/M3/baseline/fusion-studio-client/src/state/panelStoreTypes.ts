import type { MountedChatState } from './slices/mountedChatState';
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
import type { TabPolicyProjection } from '../lib/tab-policy-projection';
import type {
  ChatPopulationAddress,
  HarnessSelectionAck,
  PendingHarnessSelection,
  PendingThreadOpenRequest,
  ThreadHarnessSelection,
  ThreadOpenResponseMatch,
} from './slices/chatSurfaceSlice';
import type {
  PendingWorksurfaceCapture,
  RemoteWorksurfaceRevision,
  ThreadMemberProjection,
  WorksurfaceBinding,
  WorksurfaceConflict,
} from './slices/worksurfaceSlice';
import type { ThreadWorksurfaceEntry } from '../lib/worksurface/types';

/** Portable `{model, variant}` snapshot supplied by an exact-session surface. */
export interface SendHarnessConfig {
  model: string;
  variant?: string | null;
}

export interface SendMessageOptions {
  requestId?: string;
  /**
   * Exact-session acknowledged selection. Present (possibly with `undefined`
   * harnessConfig) when a SPEC-02 surface drives Send; absent for the legacy
   * panel-global path.
   */
  harnessConfig?: SendHarnessConfig;
}

export type SendEnqueueResult = import('../lib/ws/product-send').ProductSendResult
  | { status: 'not_enqueued'; reason: 'no_target' | 'invalid_request' };

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

// Per-workspace runtime state. currentPanel is persisted as workspace shell
// state; viewStates are loaded through the view-state resolver. panelConfigs
// and panelRoots are discovered from System/Views/. tabPolicies is the strict
// wire projection from panel_config (SPEC-02 §4): null = legacy/unavailable.
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
  tabPolicies: TabPolicyProjection | null;
  viewStates: Record<string, ViewUIState>;
}

// Full application state — the type contract for usePanelStore and all slices.
export interface AppState extends MountedChatState {
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
  sendMessage: (
    text: string,
    threadId?: string | null,
    attachments?: ChatLinkAttachment[],
    options?: SendMessageOptions,
  ) => SendEnqueueResult;
  warmThread: (threadId?: string | null) => void;

  // ── Project root ──
  projectRoot: string | null;
  setProjectRoot: (root: string | null) => void;

  panelRoots: Record<string, string>;
  setPanelRoots: (roots: Record<string, string>) => void;

  // ── Tab policy projection (SPEC-02 §4, VIEW-02 Slice 1) ──
  // Strict wire projection of panel_config.tabPolicies; null = legacy.
  tabPolicies: TabPolicyProjection | null;
  setTabPolicies: (policies: TabPolicyProjection | null) => void;

  // ── Context usage (legacy workspace-global compatibility mirror) ──
  contextUsage: number;
  setContextUsage: (usage: number) => void;
  tokenUsage: TokenUsage | null;
  setTokenUsage: (usage: TokenUsage | null) => void;

  // ── Chat surface session facts keyed by exact threadId (SPEC-02 §6.2) ──
  contextUsageByThread: Record<string, number>;
  setThreadContextUsage: (threadId: string, usage: number) => void;
  tokenUsageByThread: Record<string, TokenUsage | null>;
  setThreadTokenUsage: (threadId: string, usage: TokenUsage | null) => void;
  clearThreadUsage: (threadId: string) => void;
  wireReadyByThread: Record<string, boolean>;
  setThreadWireReady: (threadId: string, ready: boolean) => void;
  clearThreadWireReady: (threadId: string) => void;
  /** Acknowledged + optimistic harness selection keyed by exact threadId. */
  harnessSelectionByThread: Record<string, ThreadHarnessSelection>;
  hydrateHarnessSelection: (
    threadId: string,
    harnessConfig: Record<string, unknown> | null | undefined,
    harnessId?: string | null,
  ) => void;
  beginHarnessSelection: (threadId: string, pending: PendingHarnessSelection) => void;
  ackHarnessSelection: (
    threadId: string,
    requestId: string | null | undefined,
    ack: HarnessSelectionAck,
  ) => void;
  rejectHarnessSelection: (threadId: string, requestId: string | null | undefined) => void;
  clearThreadHarnessSelection: (threadId: string) => void;
  // ── Group populations and selection keyed by {workspaceId, viewId} (§6.1) ──
  // Legacy is the explicit `viewId: null` population; view populations are
  // keyed by their real view id. A view id alone never addresses a population.
  threadGroupsByWorkspaceAndView: Record<string, Record<string, Thread[]>>;
  currentThreadGroupIdByWorkspaceAndView: Record<string, Record<string, string | null>>;
  legacyThreadGroupsByWorkspaceId: Record<string, Thread[]>;
  currentLegacyThreadGroupIdByWorkspaceId: Record<string, string | null>;
  setThreadGroupPopulation: (
    workspaceId: string,
    viewId: string | null,
    rows: Thread[],
  ) => void;
  setCurrentThreadGroupId: (
    workspaceId: string,
    viewId: string | null,
    threadGroupId: string | null,
  ) => void;
  /** SPEC-04 §5: apply one accepted Move to the exact population row. */
  applyThreadGroupMove: (input: {
    workspaceId: string;
    viewId: string | null;
    threadGroupId: string;
    newThreadId: string;
    currentPrimarySequence?: number;
    memberCount?: number;
  }) => void;

  /**
   * Correlated `thread:open` requests: a late `thread:opened` response may only
   * change the visible selection of its own `{workspaceId, viewId}` population
   * when it matches a recorded request or the already selected group (§6.1
   * late-response discipline).
   */
  pendingThreadOpens: PendingThreadOpenRequest[];
  requestThreadOpen: (target: PendingThreadOpenRequest) => void;
  consumeThreadOpen: (
    address: ChatPopulationAddress,
    match: ThreadOpenResponseMatch,
  ) => void;

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
  /**
   * Remove one exact session. Optional `threadGroupId`/`viewId` come from the
   * accepted delete ack so the qualified population selection is cleared even
   * when the row is absent from the read model.
   */
  removeThread: (
    threadId: string,
    threadGroupId?: string | null,
    viewId?: string | null,
  ) => void;

  // ── Per-view UI state (SPEC-26c-2) ──
  viewStates: Record<string, ViewUIState>;
  /**
   * VIEW-02 §9 hydration reconciliation: views with an outstanding
   * `state:get` (persisted state in flight). The connected adapters gate the
   * initial-policy blank on this so a session blank is never created (or
   * persisted) before the persisted view state lands.
   */
  viewStateLoadPending: Record<string, boolean>;
  loadViewState: (view: string) => void;
  settleViewStateLoad: (view: string) => void;
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

  // ── Group-keyed content worksurface (CHAT-03 / SPEC-03 §6) ──
  worksurfaceBindings: Record<string, WorksurfaceBinding>;
  worksurfacePendingCaptures: Record<string, PendingWorksurfaceCapture>;
  worksurfaceEntries: Record<string, ThreadWorksurfaceEntry | null>;
  worksurfaceRemoteRevisions: Record<string, RemoteWorksurfaceRevision>;
  worksurfaceConflicts: Record<string, WorksurfaceConflict>;
  worksurfaceWarnings: string[];
  setWorksurfaceBinding: (binding: WorksurfaceBinding) => void;
  updateWorksurfaceBinding: (
    workspaceId: string,
    viewId: string,
    patch: Partial<WorksurfaceBinding>,
  ) => void;
  clearWorksurfaceBinding: (workspaceId: string, viewId: string) => void;
  setWorksurfacePendingCapture: (
    workspaceId: string,
    viewId: string,
    capture: PendingWorksurfaceCapture,
  ) => void;
  clearWorksurfacePendingCapture: (workspaceId: string, viewId: string) => void;
  setWorksurfaceConflict: (
    workspaceId: string,
    viewId: string,
    conflict: WorksurfaceConflict,
  ) => void;
  clearWorksurfaceConflict: (workspaceId: string, viewId: string) => void;
  setWorksurfaceEntry: (
    workspaceId: string,
    viewId: string,
    threadGroupId: string,
    entry: ThreadWorksurfaceEntry | null,
  ) => void;
  setWorksurfaceRemoteRevision: (
    workspaceId: string,
    viewId: string,
    threadGroupId: string,
    revision: RemoteWorksurfaceRevision,
  ) => void;
  removeWorksurfaceEntry: (
    workspaceId: string,
    viewId: string,
    threadGroupId: string,
  ) => void;
  pushWorksurfaceWarning: (warning: string) => void;
  clearWorksurfaceWarnings: () => void;
  /** SPEC-04 §6/§7: focused Side Chat placement per `{workspaceId, viewId}`. */
  sideChatActivePlacementByView: Record<string, string | null>;
  setActiveSideChatPlacement: (
    workspaceId: string,
    viewId: string,
    placementId: string | null,
  ) => void;
  /** SPEC-04 §3: outer owning view's ThreadRail dock state. */
  worksurfaceDockOpenByView: Record<string, boolean>;
  setWorksurfaceDockOpen: (workspaceId: string, viewId: string, open: boolean) => void;
  /** SPEC-04 §8: ordered `thread:members` projections by `{workspaceId, groupId}`. */
  threadMembersByGroup: Record<string, ThreadMemberProjection[]>;
  setThreadMembers: (
    workspaceId: string,
    threadGroupId: string,
    members: ThreadMemberProjection[],
  ) => void;

  // ── Chat-header dropdown UI state (transient) ──
  cliPickerOpen: Record<string, boolean>;
  threadDropdownOpen: Record<string, boolean>;
  toggleCliPicker: (panel: string) => void;
  closeCliPicker: (panel: string) => void;
  toggleThreadDropdown: (panel: string) => void;
  closeThreadDropdown: (panel: string) => void;
  closeAllChatHeaderDropdowns: (panel: string) => void;

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
  /**
   * SPEC-02 §6.2 / 02A-D2 (resolved in 02C): the pending new-thread
   * `connecting` state has no `threadId` yet. `connectingHarnessId` remains
   * the workspace-global mirror for the single production Legacy host, while
   * `connectingHarnessBySurface` is the surface-owned truth for explicit
   * mounts (keyed by the transient `surfaceId`). Two mounted surfaces can
   * never display each other's connecting state.
   */
  connectingHarnessBySurface: Record<string, string>;
  setConnectingHarnessForSurface: (surfaceId: string, harnessId: string) => void;
  clearConnectingHarnessForSurface: (surfaceId: string) => void;
}
