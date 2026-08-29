/**
 * @module types/view-state
 * @role Per-view UI state types — panes/layout, view activity and
 * collections, secondary chat state, theme entries, panel identity, and UI
 * timing constants.
 *
 * Split out of the former monolithic types module (SPEC-04 Slice A).
 * Pure type surface plus the TIMING constants; no other runtime logic.
 */

// Panel Types — PanelId is now a string alias (panels are discovered dynamically)
export type PanelId = string;

/**
 * Slider-only theme model — accent + 4 sliders.
 */
export interface ThemeEntry {
  id:             string;
  label:          string;
  accent:         string;   // hex #RRGGBB
  themeColor?:    string;   // secondary theme color used as the zero endpoint for two-color sliders
  borderColor?:   string;   // direct global structural-border color
  bordersEnabled?: boolean; // false hides global structural borders and softens panel corners
  luminance:      number;   // 0-100
  panelContrast?: number;   // 0-100 (50 = baseline panel deltas; 0 = monotone; 100 = 2× exaggerated)
  workspaceForeground?: number; // 0 = Secondary Color, 100 = Background Color
  workspaceBorders?: number; // 0 = Background, 100 = Theme Color
  workspaceAccent?: number; // Workspace Foreground range plus fixed 10% white (dark) or black (light); selected primary-nav icon
  threadContrast?: number;  // Legacy; thread background is fixed at the former zero setting
  threadBackground?: number; // 0 = Background, 100 = Background + 10% white (dark) or black (light)
  threadForegroundContrast?: number; // 0 = Secondary Color + 10% white/black by mode, 100 = Background Color
  threadHeadings?: number;   // 0 = Secondary Color, 100 = Background Color
  threadForeground?: number; // 0 = Secondary Color, 100 = Background Color; thread-panel dock icon
  threadAccent?: number;    // 0 = Secondary Color, 100 = Background Color
  sidePanelBackground?: number; // Same range as Thread Background; file drawer + Wiki navigation surfaces
  sidePanelForegroundContrast?: number; // Same range as Thread Text
  sidePanelHeadings?: number; // Same range as Thread Headings
  sidePanelForeground?: number; // Same range as Thread Foreground; passive navigation icons
  sidePanelAccent?: number; // Same range as Thread Accent; selected/hovered navigation items
  chatBackground?: number;  // 0 = Background, 100 = Background + 10% white (dark) or black (light)
  chatContrast?: number;    // 0 = emphasized theme color, 100 = exact Background color; composer/input surface
  chatBubble?: number;      // 0 = emphasized theme color, 100 = exact Background color; user bubble surface
  chatForeground?: number;  // 0 = Secondary Color, 100 = Background Color; Chat has no Accent slider
  chatAccent?: number;      // 0 = Theme Color + 10% mode pole, 100 = Background Color
  chatTools?: number;       // Same range as Chat Headings; tool-call chrome
  chatText?: number;        // 0 = white/black mode pole, 100 = 50/50 pole and theme color
  contentBackground?: number; // Legacy content background control
  contentCanvasBackground?: number; // Wiki/code page: 0 = Background, 100 = Background + 10% mode pole
  contentAccent?: number; // 0 = Secondary Color, 100 = Background Color; active file tab
  contentForeground?: number; // 0 = Secondary Color, 100 = Background Color; inactive file-tab titles
  contentSurfaceContrast?: number; // Legacy removed Content Contrast control
  contentHeadings?: number; // Same Theme Color + 10% mode pole → Background range as Chat Headings
  contentText?: number;     // 0 = brighter/high contrast, 50 = semantic colors unchanged, 100 = muted toward content background
  bgTint?:        number;   // 0-30 percent accent blended into background surfaces
  contentLuminance?: number; // Legacy content background control
  contentContrast?: number;  // Legacy content contrast control
  contentTint?:   number;   // Legacy content tint control
  borders?:       number;   // 0-100 percent accent blended into borders (legacy — replaced by borderLuminance + borderTint)
  borderLuminance?: number; // 0-100 black-to-white base for borders
  borderTint?:    number;   // 0-100 percent accent blended into border base
  chromeLuminance?: number; // 0-100 black-to-white base for chrome accents
  chromeTint?:    number;   // 0-100 percent accent blended into chrome base
  accentLuminance?: number; // 0-100 black-to-white base for muted accent surfaces
  accentTint?:    number;   // 0-100 percent accent blended into muted accent base
  chatBubbleChrome?: boolean; // Legacy bubble toggle; superseded by chatBubble
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

// SPEC-26c-2: per-view UI state (collapse + pane widths)
// SECONDARY_CHAT_SPEC: `rightSecondary` added for the sticky-right column.
// `rightCol` is the view's right column (e.g. file-viewer file tree) — kept
// separate from rightSecondary so the file tree retains its own width when
// the sticky chat undocks. Content navigation widths are separate again so
// resizing Wiki navigation never changes the workspace Threads width.
export type Pane =
  | 'leftSidebar'
  | 'leftChat'
  | 'rightSecondary'
  | 'rightCol'
  | 'contentNavLeft'
  | 'contentNavRight';
// The secondary pane has its own show/hide modes; the other layout panes can
// be collapsed directly (rightCol is the File Explorer tree).
export type CollapsablePane = 'leftSidebar' | 'leftChat' | 'rightCol' | 'contentArea';

export type ViewActivityKind = 'file' | 'folder' | 'document' | 'page' | 'view';

export interface ViewActivityItem {
  id: string;
  panel: string;
  path: string;
  title: string;
  kind: ViewActivityKind;
  openedAt: number;
  folder?: string;
  extension?: string;
  tabIndex?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ViewNavigationState {
  stack: ViewActivityItem[];
  index: number;
}

export interface ViewActivityState {
  recents: ViewActivityItem[];
  navigation: ViewNavigationState;
  tabs: ViewActivityItem[];
  activeTabId: string | null;
}

export interface ViewCollectionItem {
  id: string;
  panel: string;
  path: string;
  title: string;
  kind: ViewActivityKind;
  savedAt: number;
  folder?: string;
  extension?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ViewCollectionsState {
  starred: ViewCollectionItem[];
  pinnedFolders: ViewCollectionItem[];
}

export interface ViewUIState {
  collapsed: {
    leftSidebar: boolean;
    leftChat: boolean;
    rightCol: boolean;
    contentArea: boolean;
  };
  widths: {
    leftSidebar: number;
    leftChat: number;
    rightSecondary?: number;  // sticky secondary chat width (when docked)
    rightCol?: number;        // view's right column (e.g. file-viewer file tree)
    contentNavLeft?: number;  // content-owned left navigation (e.g. Wiki topics)
    contentNavRight?: number; // content-owned right navigation (e.g. Wiki page tree)
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
  docViewerMode?: 'active' | 'recent' | 'starred' | 'archive';
  docViewerActiveSelectedPath?: string | null;
  docViewerArchiveSelectedPath?: string | null;
  docViewerLastOpenedPath?: string | null;
  docViewerActiveGridScroll?: number;
  docViewerArchiveGridScroll?: number;
  docViewerActiveDocScroll?: number;
  docViewerArchiveDocScroll?: number;
  officeViewerMode?: 'home' | 'recent' | 'starred' | 'archive';
  officeViewerCurrentFolder?: string | null;
  officeViewerSelectedPath?: string | null;
  officeDocumentSidePanel?: 'none' | 'files';
  officePaperBrightness?: number;
  emailViewerMode?: 'home' | 'recent' | 'starred' | 'archive'
    | 'inbox' | 'snoozed' | 'sent' | 'scheduled' | 'drafts' | 'spam' | 'trash';
  emailViewerCurrentFolder?: string | null;
  emailViewerSelectedPath?: string | null;
  emailDocumentSidePanel?: 'none' | 'files';
  emailPaperBrightness?: number;
  activity: ViewActivityState;
  collections: ViewCollectionsState;
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
