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
  Scope,
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
} from '../types';
import type { PanelConfig } from '../lib/panels';

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

// Lightweight, safe-to-cache per-workspace state shape.
export interface WorkspacePanelState {
  projectRoot: string | null;
  currentPanel: string;
  panels: Record<string, PanelState>;
  projectChats: Record<string, PanelState>;
  threads: { project: Thread[]; view: Thread[] };
  currentThreadIds: { project: string | null; view: string | null };
  currentScope: Scope | null;
  wireReady: boolean;
  contextUsage: number;
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
  resetWorkspaceFocusState: (workspaceId: string) => void;

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

  // ── Chat state (SPEC-26c) ──
  panels: Record<string, PanelState>;
  projectChats: Record<string, PanelState>;

  addMessage: (scope: Scope, threadId: string | null, message: Message) => void;
  setCurrentTurn: (scope: Scope, threadId: string | null, turn: AssistantTurn | null) => void;
  updateTurnContent: (scope: Scope, threadId: string | null, content: string) => void;
  appendSegment: (scope: Scope, threadId: string | null, segType: StreamSegment['type'], text: string) => void;
  pushSegment: (scope: Scope, threadId: string | null, segment: StreamSegment) => void;
  updateLastSegment: (scope: Scope, threadId: string | null, updates: Partial<StreamSegment>) => void;
  updateSegmentByIndex: (scope: Scope, threadId: string | null, index: number, updates: Partial<StreamSegment>) => void;
  updateSegmentByToolCallId: (scope: Scope, threadId: string | null, toolCallId: string, updates: Partial<StreamSegment>) => void;
  appendSegmentContentByIndex: (scope: Scope, threadId: string | null, index: number, text: string) => void;
  resetSegments: (scope: Scope, threadId: string | null) => void;
  setPendingTurnEnd: (scope: Scope, threadId: string | null, pending: boolean) => void;
  setPendingMessage: (scope: Scope, threadId: string | null, message: Message | null) => void;
  setTodoDrawer: (scope: Scope, threadId: string | null, drawer: PanelState['todoDrawer']) => void;
  finalizeTurn: (scope: Scope, threadId: string | null) => void;
  clearChat: (scope: Scope, threadId: string | null) => void;

  // ── WebSocket ──
  ws: WebSocket | null;
  setWs: (ws: WebSocket | null) => void;
  sendMessage: (text: string, scope: Scope, threadId?: string | null) => void;
  warmThread: (scope: Scope, threadId?: string | null) => void;

  // ── Project root ──
  projectRoot: string | null;
  setProjectRoot: (root: string | null) => void;

  panelRoots: Record<string, string>;
  setPanelRoots: (roots: Record<string, string>) => void;

  // ── Context usage ──
  contextUsage: number;
  setContextUsage: (usage: number) => void;

  // ── Thread management (SPEC-26c: dual-scope) ──
  threads: { project: Thread[]; view: Thread[] };
  currentThreadIds: { project: string | null; view: string | null };
  currentScope: Scope | null;
  wireReady: boolean;

  setThreads: (scope: Scope, threads: Thread[]) => void;
  setCurrentThreadId: (scope: Scope, threadId: string | null) => void;
  setCurrentScope: (scope: Scope | null) => void;
  setWireReady: (ready: boolean) => void;
  addThread: (scope: Scope, thread: Thread) => void;
  updateThread: (scope: Scope, threadId: string, updates: Partial<Thread['entry']>) => void;
  removeThread: (scope: Scope, threadId: string) => void;

  // ── Per-view UI state (SPEC-26c-2) ──
  viewStates: Record<string, ViewUIState>;
  loadViewState: (view: string) => void;
  setViewState: (view: string, state: ViewUIState) => void;
  _persistViewPatch: (view: string, patch: Partial<ViewUIState>) => void;
  toggleCollapsed: (view: string, pane: CollapsablePane) => void;
  setPaneWidth: (view: string, pane: Pane, width: number) => void;
  commitPaneWidths: (view: string) => void;
  setTint: (view: string, path: TintPath, value: boolean) => void;

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
  selectHarness: (harnessId: string, scope: Scope) => void;
  createDefaultAssistantThread: (scope: Scope) => void;

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
