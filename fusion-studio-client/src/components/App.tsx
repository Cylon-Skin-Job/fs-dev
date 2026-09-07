import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { clampPaneWidth, usePanelStore } from '../state/panelStore';
import { useWorkspaceStore } from '../state/workspaceStore';

import { useWebSocket } from '../hooks/useWebSocket';
import { useWorkspaceKeyboard } from '../hooks/useWorkspaceKeyboard';
import { useScreenshotCapture } from '../hooks/useScreenshotCapture';
import { useSharedWorkspaceStyles } from '../hooks/useSharedWorkspaceStyles';
import { useThemeTokenBridge } from '../hooks/useThemeTokenBridge';
import { useElectronMenu } from '../hooks/useElectronMenu';
import { ToolsPanel } from './ToolsPanel';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { ContentArea } from './ContentArea';
import { AppHeaderLayoutControls } from './ViewLayoutControls';
import { LeftSidebarResize, LeftChatResize } from './ResizeHandle';
import { Toast } from './Toast';
import { ModalOverlay } from './Modal/ModalOverlay';
import { FusionOverlay } from './Fusion/FusionOverlay';
import { SecondaryChat, SecondaryChatSticky } from './SecondaryChat';
import { SecondaryDockButton } from './SecondaryDockButton';
import { EmptyStateView } from './EmptyStateView';
import { WorkspaceRibbon } from './WorkspaceRibbon';
import { WorkspaceCarousel } from './WorkspaceCarousel';

import { WorkspaceTitle } from './WorkspaceTitle';
import { AiSourceSelector } from './AiSourceSelector';
import { WorkspaceAddModal } from './WorkspaceAddModal';
import { WorkspaceCreateModal } from './WorkspaceCreateModal';
import { ThemePickerModal } from './ThemePickerModal';
import { SecretsManagerModal } from './secrets/SecretsManagerModal';
import { HeaderActionsMenu } from './HeaderActionsMenu';
import {
  captureAndAttachScreenshot,
  SCREENSHOT_FLASH_EVENT,
  ScreenshotFlashOverlay,
} from '../screenshots';
import './App.css';

// SPEC-26c-2: defaults for the 3-column layout
const DEFAULT_WIDTHS = { leftSidebar: 220, leftChat: 360 };
const DEFAULT_COLLAPSED = { leftSidebar: false, leftChat: false, rightCol: false, contentArea: false };
// TINTS_SPEC §8c: all-off fallback when viewState hasn't loaded yet.
const DEFAULT_TINTS = {
  leftPanel:     false,
  rightPanel:    false,
  cards:         false,
  borders: { threads: false, chat: false },
};

/**
 * Memoized panel content — only re-renders when its own panel prop changes,
 * NOT when currentPanel changes in the parent. This prevents all 7 panels
 * from re-rendering on every panel switch.
 *
 * RCC-0095: the single workspace chat renders unconditionally as part of
 * the workspace shell. A missing or malformed view folder may degrade
 * ContentArea, but never removes the chat column/sidebar.
 */
interface PanelContentProps {
  panel: string;
  collapsedSidebar: boolean;
  collapsedChat: boolean;
  collapsedContent: boolean;
  secondarySticky: boolean;
}
const PanelContent = memo(function PanelContent({ panel, collapsedSidebar, collapsedChat, collapsedContent, secondarySticky }: PanelContentProps) {
  // SPEC-26c-2: [workspace sidebar][handle][workspace chat][handle][content]
  // SECONDARY_CHAT_SPEC §7c: when secondary is sticky-right, it overlays
  // the view's right column via absolute positioning + z-index. Grid stays
  // at 5 tracks; sticky chat sits on top of the existing content.
  return (
    <>
      <Sidebar panel={panel} collapsed={collapsedSidebar} />
      <LeftSidebarResize panel={panel} />
      <ChatArea
        panel={panel}
        collapsed={collapsedChat}
        sidebarCollapsed={collapsedSidebar}
        contentCollapsed={collapsedContent}
        hideCollapsedRail
      />
      <LeftChatResize panel={panel} />
      <ContentArea panel={panel} />
      {secondarySticky && <SecondaryChatSticky />}
    </>
  );
});

/**
 * SPEC-26c-2: PanelWrapper reads viewStates from the store to compute
 * inline CSS variables for the grid and pass collapsed props to children.
 * Extracted so each panel reads only its own slice.
 */
function PanelWrapper({ panelId, isActive }: {
  panelId: string;
  isActive: boolean;
}) {
  const viewState = usePanelStore((s) => s.viewStates[panelId]);
  const secondaryMode = usePanelStore((s) => s.secondary?.mode ?? null);

  // Fallback to defaults if viewState is not yet loaded or is partial.
  // We merge to ensure that missing keys (like leftSidebar) don't result in "undefinedpx".
  const widths = { ...DEFAULT_WIDTHS, ...(viewState?.widths ?? {}) };
  const collapsed = { ...DEFAULT_COLLAPSED, ...(viewState?.collapsed ?? {}) };
  const leftSidebarWidth = clampPaneWidth('leftSidebar', widths.leftSidebar);
  const collapsedContent = collapsed.contentArea;

  // Only the active panel renders the sticky secondary (one grid track
  // at a time; the popup persists state across panel switches but the
  // column is painted in whichever panel is currently active).
  const secondarySticky = isActive && secondaryMode === 'sticky-right';
  // When sticky chat is docked, the shared --right-col-w follows the chat
  // width so the file tree visually matches. When undocked, it reverts to
  // the view's own right-column width (widths.rightCol), so the file tree
  // is never stuck at the chat's docked width after the user hits green.
  const rightColWidth = secondarySticky
    ? (widths.rightSecondary ?? 300)
    : (widths.rightCol ?? 220);

  const gridStyle: CSSProperties = {
    '--left-sidebar-w':   collapsed.leftSidebar ? '0px' : `min(${leftSidebarWidth}px, 25vw)`,
    '--left-sidebar-expanded-w': `min(${leftSidebarWidth}px, 25vw)`,
    '--left-chat-w':      `${collapsed.leftChat ? 0 : Math.max(360, widths.leftChat)}px`,
    '--right-col-w':      `${rightColWidth}px`,
    '--file-tree-w':      `${collapsed.rightCol ? 0 : rightColWidth}px`,
  } as CSSProperties;

  const panelClasses = [
    'rv-panel',
    'rv-layout-dual-chat',
    isActive ? 'active' : '',
    collapsed.leftSidebar ? 'rv-panel--sidebar-collapsed' : '',
    collapsedContent ? 'rv-panel--content-collapsed' : '',
    secondarySticky ? 'rv-panel--secondary-sticky' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      data-panel={panelId}
      data-secondary-sticky={secondarySticky ? 'true' : undefined}
      className={panelClasses}
      style={gridStyle}
    >
      <PanelContent
        panel={panelId}
        collapsedSidebar={collapsed.leftSidebar}
        collapsedChat={collapsed.leftChat}
        collapsedContent={collapsedContent}
        secondarySticky={secondarySticky}
      />
    </div>
  );
}

function App() {
  // WebSocket connection — must run BEFORE the loading gate
  // so discovery can complete and populate configs
  const runtimeStatus = useWebSocket();
  useWorkspaceKeyboard();
  useScreenshotCapture();
  useElectronMenu();
  // Load themes + components + views CSS from the active workspace at runtime
  useSharedWorkspaceStyles();
  useThemeTokenBridge();

  const currentPanel = usePanelStore((state) => state.currentPanel);
  const setCurrentPanel = usePanelStore((state) => state.setCurrentPanel);
  const ws = usePanelStore((state) => state.ws);
  const configs = usePanelStore((state) => state.panelConfigs);
  const isThemePickerOpen = usePanelStore((state) => state.isThemePickerOpen);
  const isConnected = ws?.readyState === WebSocket.OPEN;
  const containerRef = useRef<HTMLDivElement>(null);

  const [fusionOpen, setFusionOpen] = useState(false);
  const [screenshotFlashImage, setScreenshotFlashImage] = useState<string | null>(null);

  const hasReceivedWorkspaceInit = useWorkspaceStore((s) => s.hasReceivedInit);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const handleControlCamera = useCallback(() => {
    void captureAndAttachScreenshot();
  }, []);

  const handlePanelSwitch = useCallback((panelId: string) => {
    setCurrentPanel(panelId);
  }, [setCurrentPanel]);

  useEffect(() => {
    const handleScreenshotFlash = (event: Event) => {
      const dataUrl = (event as CustomEvent<string>).detail;
      if (typeof dataUrl === 'string') setScreenshotFlashImage(dataUrl);
    };
    window.addEventListener(SCREENSHOT_FLASH_EVENT, handleScreenshotFlash);
    return () => window.removeEventListener(SCREENSHOT_FLASH_EVENT, handleScreenshotFlash);
  }, []);

  const loading = configs.length === 0;

  // Per-panel runtime theming was retired: theme tokens now live in
  // ai/<machine>/System/styles/themes.css (workspace) with optional overrides at
  // ai/<machine>/Views/<view>/styles/themes.css. No JS setProperty.

  // Once discovery completes, set currentPanel to first available if current isn't valid
  useEffect(() => {
    if (configs.length > 0 && !configs.find((c) => c.id === currentPanel)) {
      setCurrentPanel(configs[0].id);
    }
  }, [configs, currentPanel, setCurrentPanel]);

  // Keyboard: Escape defocuses content, Option+Up/Down cycles panels
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      (document.activeElement as HTMLElement)?.blur();
      return;
    }

    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;

    // Skip when typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

    e.preventDefault();
    const ids = configs.map((c) => c.id);
    const idx = ids.indexOf(currentPanel);
    if (idx < 0) return;

    const next = e.key === 'ArrowDown'
      ? ids[(idx + 1) % ids.length]
      : ids[(idx - 1 + ids.length) % ids.length];
    setCurrentPanel(next);
  }, [configs, currentPanel, setCurrentPanel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Sync tint toggles to <body> so global tints.css rules match.
  // TINTS_SPEC §8: tint attributes are workspace-wide, applied once on body.
  // Theme-scoped toggles (borders.chat) come from the active theme; the
  // others remain on view state until they are migrated.
  const currentTints = usePanelStore((s) => s.viewStates[currentPanel]?.tints ?? DEFAULT_TINTS);
  const activeTheme = usePanelStore((s) =>
    s.themes.find((t) => t.id === s.activeThemeId) ?? s.themes.find((t) => t.active),
  );
  const themeChatBorder = activeTheme?.tints?.borders?.chat ?? false;
  useEffect(() => {
    const body = document.body;
    if (currentTints.leftPanel) body.dataset.tintLeft = 'true'; else delete body.dataset.tintLeft;
    if (currentTints.rightPanel) body.dataset.tintRight = 'true'; else delete body.dataset.tintRight;
    if (currentTints.cards) body.dataset.tintCards = 'true'; else delete body.dataset.tintCards;
    if (currentTints.borders.threads) body.dataset.tintBorderThreads = 'true'; else delete body.dataset.tintBorderThreads;
    if (themeChatBorder) body.dataset.tintBorderChat = 'true'; else delete body.dataset.tintBorderChat;
  }, [currentTints, themeChatBorder]);

  if (runtimeStatus === 'disconnected') {
    return (
      <div ref={containerRef} className="rv-app-container">
        <header className="rv-header rv-interaction-context">
          <div className="rv-header-left">
            <div className="rv-connection-status">Disconnected</div>
          </div>
          <WorkspaceTitle />
          <div className="rv-header-right" />
        </header>
        <div className="rv-panel-container rv-panel-container--loading">
          Fusion server disconnected.
        </div>
      </div>
    );
  }

  // Waiting for workspace:init from server. Brief flash on first connect.
  if (isConnected && !hasReceivedWorkspaceInit) {
    return null;
  }

  // No active workspace — render the empty-state tile, but keep the
  // ribbon and add/create modals mounted so the user can restore or add one.
  if (hasReceivedWorkspaceInit && activeWorkspaceId === null) {
    return (
      <div ref={containerRef} className="rv-app-container">
        <header className="rv-header rv-interaction-context">
          <div className="rv-header-left">
            <AiSourceSelector />
            <div className={`rv-connection-status ${isConnected ? 'connected' : ''}`}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </div>
          </div>
          <WorkspaceTitle />
          <div className="rv-header-right">
            <button
              className="rv-fusion-icon-btn"
              title="Take screenshot"
              aria-label="Take screenshot"
              onClick={handleControlCamera}
            >
              <span className="material-symbols-outlined">control_camera</span>
            </button>
            <button className="rv-fusion-icon-btn" onClick={() => setFusionOpen(true)}>
              <span className="material-symbols-outlined">raven</span>
            </button>
          </div>
        </header>
        <EmptyStateView />
        <WorkspaceRibbon />
        <WorkspaceAddModal />
        <WorkspaceCreateModal />
        <ModalOverlay />
      </div>
    );
  }

  if (loading) {
    return (
      <div ref={containerRef} className="rv-app-container">
        <header className="rv-header rv-interaction-context">
          <div className="rv-header-left">
            <AiSourceSelector />
            <div className={`rv-connection-status ${isConnected ? 'connected' : ''}`}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </div>
          </div>
          <WorkspaceTitle />
          <div className="rv-header-right">
            <button
              className="rv-fusion-icon-btn"
              title="Take screenshot"
              aria-label="Take screenshot"
              onClick={handleControlCamera}
            >
              <span className="material-symbols-outlined">control_camera</span>
            </button>
            <button className="rv-fusion-icon-btn" onClick={() => setFusionOpen(true)}>
              <span className="material-symbols-outlined">raven</span>
            </button>
          </div>
        </header>
        <div className="rv-panel-container rv-panel-container--loading">
          Discovering panels...
        </div>
        <WorkspaceRibbon />
        <WorkspaceAddModal />
        <WorkspaceCreateModal />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`rv-app-container${isThemePickerOpen ? ' rv-app-container--theme-picker-open' : ''}`}
    >
      {/* Header */}
      <header className="rv-header rv-interaction-context">
        <div className="rv-header-left">
          <AiSourceSelector />
          <div className={`rv-connection-status ${isConnected ? 'connected' : ''}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <WorkspaceTitle />

        <div className="rv-header-right">
          <button
            className="rv-fusion-icon-btn"
            title="Take screenshot"
            aria-label="Take screenshot"
            onClick={handleControlCamera}
          >
            <span className="material-symbols-outlined">control_camera</span>
          </button>
          <AppHeaderLayoutControls panel={currentPanel} />
          <HeaderActionsMenu onOpenFusion={() => setFusionOpen(true)} />
        </div>
      </header>

      {/* Tools Panel */}
      <ToolsPanel
        currentPanel={currentPanel}
        onSwitch={handlePanelSwitch}
      />

      {/* Panel Container */}
      <div className="rv-panel-container">
        {configs.map((config) => (
          <PanelWrapper
            key={config.id}
            panelId={config.id}
            isActive={currentPanel === config.id}
          />
        ))}
      </div>
      <Toast />
      <ModalOverlay />
      <FusionOverlay open={fusionOpen} onClose={() => setFusionOpen(false)} />
      <SecondaryChat />
      <SecondaryDockButton />
      <WorkspaceRibbon />
      <WorkspaceCarousel />

      <WorkspaceAddModal />
      <WorkspaceCreateModal />
      <ThemePickerModal />
      <SecretsManagerModal />
      <ScreenshotFlashOverlay
        imageDataUrl={screenshotFlashImage}
        onComplete={() => setScreenshotFlashImage(null)}
      />
    </div>
  );
}

export default App;
