/**
 * @module panels
 * @role Shared panel discovery and config loading
 * @reads ai/views/index.json, ai/views/{id}/index.json, ai/views/{id}/content.json,
 *        ai/views/{id}/settings/layout.json
 * Workspace CSS: fetchPanelWorkspaceFile / fetchViewsRootFile (__panels__ → ai/views/…).
 * Chat/thread styles: settings/views.css (see VIEWS_SETTINGS_STYLES_VIEWS).
 *
 * Loads panel definitions from the repo filesystem via WebSocket.
 * Knows nothing about any specific panel type — content.json declares
 * the display type, chat config, and layout.
 */

import { usePanelStore } from '../state/panelStore';

// --- Types ---

// SPEC-26c: PanelLayout type removed. Layout is now a binary derived from
// hasChat in App.tsx — chat-enabled views render the 5-column dual-chat
// layout, everything else is content-only.

export interface ChatConfig {
  type: 'threaded' | 'rolling-daily';
  position: 'left' | 'right' | 'popup';
}

export interface ContentConfig {
  display: string;
  chat: ChatConfig | null;
}

export interface LayoutConfig {
  chatPosition: 'left' | 'right' | 'popup' | null;
  chatWidth: number | null;
  chatHeight: number | null;
  threadListWidth: number | null;
  threadListVisible: boolean;
  popup: {
    x: number | null;
    y: number | null;
    width: number;
    height: number;
  } | null;
}

export interface PanelConfig {
  id: string;
  name: string;
  description?: string;
  type: string;
  icon: string;
  hasChat: boolean;
  chatConfig: ChatConfig | null;
  layoutConfig: LayoutConfig | null;
  contentConfig: ContentConfig | null;
  rank?: number;
  /** Derived from which directory the panel was discovered in */
  category: 'app' | 'tool';
  /** True if panel has a ui/ folder with module.js (runtime-loaded plugin) */
  hasUiFolder?: boolean;
}

// --- Helpers ---

/**
 * Request a file from a panel via WebSocket.
 * Returns a promise that resolves with the file content or rejects on error.
 */
/** Legacy paths under ai/views/settings/ — kept for backward compatibility. */
export const VIEWS_SETTINGS_STYLES_THEMES     = 'settings/themes.css' as const;
export const VIEWS_SETTINGS_STYLES_COMPONENTS = 'settings/components.css' as const;
/** Chat + thread list + composer. */
export const VIEWS_SETTINGS_STYLES_VIEWS      = 'settings/views.css' as const;

// --- ai/settings/ constants (via __settings__ pseudo-panel) ---
export const SETTINGS_STYLES_THEMES      = 'themes.css' as const;
export const SETTINGS_STYLES_COMPONENTS  = 'components.css' as const;
export const SETTINGS_STYLES_VIEWS       = 'views.css' as const;
export const SETTINGS_STYLES_FILE_VIEWER = 'file-viewer.css' as const;
export const SETTINGS_STYLES_DOC_VIEWER  = 'doc-viewer.css' as const;
export const SETTINGS_STYLES_TINTS       = 'tints.css' as const;
export const SETTINGS_STYLES_VARIABLES   = 'variables.css' as const;

/** Fetch a file under ai/views/ (same mechanism as panel discovery). */
export function fetchViewsRootFile(ws: WebSocket, pathUnderViews: string): Promise<string> {
  return fetchPanelFile(ws, '__panels__', pathUnderViews);
}

/** Fetch a file under ai/settings/ via the __settings__ pseudo-panel. */
export function fetchSettingsFile(ws: WebSocket, pathUnderSettings: string): Promise<string> {
  return fetchPanelFile(ws, '__settings__', pathUnderSettings);
}

/**
 * Build the HTTP URL for an image (or any binary asset) served from a
 * panel's content tree. Use this for every <img src=...> or background-image
 * URL that points at panel content — keeps the format in one place.
 *
 * The path is relative to the panel's content root (the same root the
 * file_tree_request WebSocket handler uses), e.g. for the doc-viewer
 * (tiled-rows) the content root resolves server-side to
 * `ai/views/doc-viewer/content/`. Pass `screenshots/foo.png`, NOT
 * `content/screenshots/foo.png`.
 */
export function getPanelFileUrl(panel: string, pathUnderContent: string): string {
  const segments = pathUnderContent
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s));
  return `/api/panel-file/${encodeURIComponent(panel)}/${segments.join('/')}`;
}

/**
 * Read a file from under ai/views/{panelId}/ regardless of display type.
 * Use this for index.json, settings/themes.css, etc. (Not for browsing project files on file-viewer.)
 */
export function fetchPanelWorkspaceFile(
  ws: WebSocket,
  panelId: string,
  pathUnderView: string
): Promise<string> {
  return fetchPanelFile(ws, '__panels__', `${panelId}/${pathUnderView}`);
}

export function fetchPanelFile(ws: WebSocket, panel: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file_content_response' && msg.panel === panel && msg.path === filePath) {
          ws.removeEventListener('message', handleMessage);
          if (msg.success) {
            resolve(msg.content);
          } else {
            reject(new Error(msg.error || `Failed to load ${panel}/${filePath}`));
          }
        }
      } catch { /* ignore */ }
    };

    ws.addEventListener('message', handleMessage);
    ws.send(JSON.stringify({
      type: 'file_content_request',
      panel,
      path: filePath,
    }));

    setTimeout(() => {
      ws.removeEventListener('message', handleMessage);
      reject(new Error(`Timeout loading ${panel}/${filePath}`));
    }, 5000);
  });
}

/**
 * Load a JSON file from a panel, returning null on failure.
 */
async function fetchPanelJson(ws: WebSocket, panelId: string, filePath: string, panelAlias = '__panels__'): Promise<any | null> {
  try {
    const raw = await fetchPanelFile(ws, panelAlias, `${panelId}/${filePath}`);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Load a single panel's config from its index.json + content.json + layout JSON.
 */
export async function loadPanelConfig(
  ws: WebSocket,
  panelId: string,
  category: 'app' | 'tool' = 'tool'
): Promise<PanelConfig | null> {
  try {
    const panelAlias = category === 'app' ? '__apps__' : '__panels__';
    const json = await fetchPanelJson(ws, panelId, 'index.json', panelAlias);
    if (!json) return null;

    // Load content.json — declares display type and chat config
    const contentConfig: ContentConfig | null = await fetchPanelJson(ws, panelId, 'content.json', panelAlias);

    const layoutConfig: LayoutConfig | null = await fetchPanelJson(ws, panelId, 'settings/layout.json', panelAlias);

    // Chat is determined by content.json, not by probing the filesystem
    const chatConfig = contentConfig?.chat || null;
    const hasChat = chatConfig !== null;

    // Check if panel has a ui/ folder with module.js
    const hasUiFolder = await fetchPanelFile(ws, panelAlias, `${panelId}/ui/module.js`)
      .then(() => true)
      .catch(() => false);

    return {
      id: json.id || panelId,
      name: json.label || panelId,
      description: json.description,
      type: contentConfig?.display || json.type || 'placeholder',
      icon: json.icon || 'folder',
      hasChat,
      chatConfig,
      layoutConfig,
      contentConfig,
      rank: json.rank,
      category,
      hasUiFolder,
    };
  } catch {
    return null;
  }
}

/**
 * Discover panels or apps by requesting a folder listing.
 * Returns panel IDs (folder names).
 */
export function discoverPanels(ws: WebSocket, panelAlias: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file_tree_response' && msg.panel === panelAlias) {
          ws.removeEventListener('message', handleMessage);
          if (msg.success) {
            const folders = (msg.nodes || [])
              .filter((n: { type: string }) => n.type === 'directory' || n.type === 'folder')
              .map((n: { name: string }) => n.name);
            resolve(folders);
          } else {
            reject(new Error(msg.error || 'Failed to discover panels'));
          }
        }
      } catch { /* ignore */ }
    };

    ws.addEventListener('message', handleMessage);
    ws.send(JSON.stringify({
      type: 'file_tree_request',
      panel: panelAlias,
      path: '',
    }));

    setTimeout(() => {
      ws.removeEventListener('message', handleMessage);
      reject(new Error('Timeout discovering panels'));
    }, 5000);
  });
}

/**
 * Load all panel configs from both ai/views/ (tools) and ai/apps/ (apps).
 * Returns sorted by rank within each category.
 */
export async function loadAllPanels(ws: WebSocket): Promise<PanelConfig[]> {
  const [toolIds, appIds] = await Promise.all([
    discoverPanels(ws, '__panels__').catch(() => [] as string[]),
    discoverPanels(ws, '__apps__').catch(() => [] as string[]),
  ]);

  const toolConfigs = await Promise.all(
    toolIds.map((id) => loadPanelConfig(ws, id, 'tool'))
  );
  const appConfigs = await Promise.all(
    appIds.map((id) => loadPanelConfig(ws, id, 'app'))
  );

  const all = [
    ...appConfigs.filter((c): c is PanelConfig => c !== null),
    ...toolConfigs.filter((c): c is PanelConfig => c !== null),
  ];

  // Sort within each category by rank, but keep apps first
  const apps = all.filter((c) => c.category === 'app').sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const tools = all.filter((c) => c.category === 'tool').sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  return [...apps, ...tools];
}

/**
 * Re-run panel discovery after a workspace switch. Clears the existing
 * panelConfigs briefly (so the UI shows its loading branch), discovers
 * the new workspace's panels, and sends a set_panel for the first one.
 *
 * Used by workspace-handlers on `workspace:switched`. Fire-and-forget:
 * callers should `.catch(console.error)`.
 */
export async function rediscoverPanels(ws: WebSocket): Promise<void> {
  usePanelStore.getState().setPanelConfigs([]);
  const configs = await loadAllPanels(ws);
  usePanelStore.getState().setPanelConfigs(configs);
  if (configs.length > 0) {
    const first = configs[0];
    usePanelStore.getState().setCurrentPanel(first.id);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'set_panel', panel: first.id }));
    }
  }
}

