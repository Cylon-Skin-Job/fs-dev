import { useCallback, useEffect, useRef, useState } from 'react';
import { usePanelStore } from '../state/panelStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import {
  flushBoundView,
  flushBoundWorkspaceViews,
} from '../lib/worksurface/worksurfaceController';

import { useWebSocket } from '../hooks/useWebSocket';
import { useWorkspaceKeyboard } from '../hooks/useWorkspaceKeyboard';
import { useScreenshotCapture } from '../hooks/useScreenshotCapture';
import { useSharedWorkspaceStyles } from '../hooks/useSharedWorkspaceStyles';
import { useThemeTokenBridge } from '../hooks/useThemeTokenBridge';
import { useElectronMenu } from '../hooks/useElectronMenu';
import { installChatActionConsumer } from '../lib/chat-action-controller';
import { ToolsPanel } from './ToolsPanel';
import { WorkspacePanel } from './WorkspacePanel';
import { AppHeaderLayoutControls } from './ViewLayoutControls';
import { Toast } from './Toast';
import { ModalOverlay } from './Modal/ModalOverlay';
import { FusionOverlay } from './Fusion/FusionOverlay';
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

// TINTS_SPEC §8c: all-off fallback when viewState hasn't loaded yet.
const DEFAULT_TINTS = {
  leftPanel:     false,
  rightPanel:    false,
  cards:         false,
  borders: { threads: false, chat: false },
};

function App() {
  useEffect(() => { installChatActionConsumer(); }, []);
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

  // CHAT-03 / SPEC-03 §6.1: before changing views, flush the outgoing bound key
  // through the same acknowledgement gate. No platform view-switch veto exists;
  // an unacknowledged capture is retained and surfaced as a warned conflict on
  // the owning view rather than being described as saved.
  const flushOutgoingView = useCallback((nextPanel: string) => {
    const state = usePanelStore.getState();
    if (nextPanel === state.currentPanel) return;
    flushBoundView(state.activeWorkspaceId, state.currentPanel, 'view-change');
  }, []);

  const handlePanelSwitch = useCallback((panelId: string) => {
    flushOutgoingView(panelId);
    setCurrentPanel(panelId);
  }, [flushOutgoingView, setCurrentPanel]);

  // Orderly renderer teardown: best-effort flush of every bound view. There is
  // no bounded close-veto in this build, so the in-app warned-discard conflict
  // remains the discard path (recorded as a 03B deviation).
  useEffect(() => {
    const flushAllBound = () => {
      const state = usePanelStore.getState();
      flushBoundWorkspaceViews(state.activeWorkspaceId, 'teardown');
    };
    window.addEventListener('pagehide', flushAllBound);
    return () => window.removeEventListener('pagehide', flushAllBound);
  }, []);

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
  // ai/<machine>/System/Views/<view>/styles/themes.css. No JS setProperty.

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
    flushOutgoingView(next);
    setCurrentPanel(next);
  }, [configs, currentPanel, flushOutgoingView, setCurrentPanel]);

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
          <WorkspacePanel
            key={config.id}
            panelId={config.id}
            isActive={currentPanel === config.id}
          />
        ))}
      </div>
      <Toast />
      <ModalOverlay />
      <FusionOverlay open={fusionOpen} onClose={() => setFusionOpen(false)} />
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
