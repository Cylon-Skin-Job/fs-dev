/**
 * @module panels
 * @role Shared panel discovery and config loading
 * @reads generated V2 view metadata from ai/<machine>/System/Views/{prefix}-{id}/
 * Workspace CSS: fetchPanelWorkspaceFile (__panels__ → ai/<machine>/System/Views/…).
 *
 * Loads panel definitions from the repo filesystem via WebSocket.
 * Knows nothing about any specific panel type — content.json declares
 * the display type, chat config, and layout.
 */

import { usePanelStore } from '../state/panelStore';
import { getServerResourceUrl } from './runtime-transport';

// --- Types ---

// SPEC-26c: PanelLayout type removed.
// RCC-0095: the workspace chat renders unconditionally in App.tsx — the
// hasChat flag below is declarative view metadata and no longer gates the
// chat column/sidebar.

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
  /** True if a non-built-in panel ships an app/index.html iframe entry point */
  hasAppHtml?: boolean;
  /** Raw index.json settings for view-specific configuration */
  settings?: Record<string, unknown>;
}

interface PanelIndexConfig extends Record<string, unknown> {
  id?: string;
  label?: string;
  description?: string;
  type?: string;
  icon?: string;
  rank?: number;
}

interface WorkspaceViewRegistryEntry {
  id: string;
  label?: string;
  icon?: string;
  rank?: number;
  enabled?: boolean;
}

interface RediscoverPanelsOptions {
  preserveCurrent?: boolean;
  chooseNearestIfMissing?: boolean;
  /** Revalidate an async caller before discovered panel state becomes visible. */
  shouldCommit?: () => boolean;
}

// --- Helpers ---

function parseIconNameMarkdown(raw: string): string | null {
  const match = raw.match(/^\s*icon-name:\s*(.+?)\s*$/m);
  if (!match) return null;
  const icon = match[1].trim().replace(/^['"]|['"]$/g, '');
  return icon || null;
}

function displayLabelFromId(id: string): string {
  return id
    .replace(/-viewer$/, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'View';
}

/**
 * Request a file from a panel via WebSocket.
 * Returns a promise that resolves with the file content or rejects on error.
 */
// --- ai/<machine>/System/styles/ constants (via __settings__ pseudo-panel) ---
export const SETTINGS_STYLES_THEMES      = 'themes.css' as const;
export const SETTINGS_STYLES_COMPONENTS  = 'components.css' as const;
export const SETTINGS_STYLES_VIEWS       = 'views.css' as const;
export const SETTINGS_STYLES_FILE_VIEWER = 'file-viewer.css' as const;
export const SETTINGS_STYLES_DOC_VIEWER  = 'capture-viewer.css' as const;
export const SETTINGS_STYLES_TINTS       = 'tints.css' as const;
export const SETTINGS_STYLES_VARIABLES   = 'variables.css' as const;

/** Fetch a file under ai/<machine>/System/styles/ via the __settings__ pseudo-panel. */
export function fetchSettingsFile(ws: WebSocket, pathUnderSettings: string): Promise<string> {
  return fetchPanelFile(ws, '__settings__', pathUnderSettings);
}

/**
 * Build the HTTP URL for an image (or any binary asset) served from a
 * panel's content tree. Use this for every <img src=...> or background-image
 * URL that points at panel content — keeps the format in one place.
 *
 * The path is relative to the panel's content root (the same root the
 * file_tree_request WebSocket handler uses), e.g. for the capture-viewer
 * (tiled-rows) the content root resolves server-side to
   * `ai/<machine>/Captures/`. Pass `006-Screenshots/foo.png`, NOT
   * `content/006-Screenshots/foo.png`.
 */
export function getPanelFileUrl(panel: string, pathUnderContent: string): string {
  const segments = pathUnderContent
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s));
  return getServerResourceUrl(`/api/panel-file/${encodeURIComponent(panel)}/${segments.join('/')}`);
}

/**
 * Read a file from under ai/<machine>/System/Views/{prefix}-{panelId}/ regardless of display type.
 * Use this for generated view metadata, styles/themes.css, etc. (Not for browsing project files on file-viewer.)
 */
export function fetchPanelWorkspaceFile(
  ws: WebSocket,
  panelId: string,
  pathUnderView: string
): Promise<string> {
  return fetchPanelFile(ws, '__panels__', `${panelId}/${pathUnderView}`);
}

let nextPanelFileRequestId = 0;

export function fetchPanelFile(ws: WebSocket, panel: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    nextPanelFileRequestId += 1;
    const requestId = `panel-file-${nextPanelFileRequestId}`;
    const cleanup = () => {
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('close', handleClose);
      if (timeout) clearTimeout(timeout);
    };
    const finish = (error: Error | null, content?: string) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (error) reject(error); else resolve(content ?? '');
    };
    const handleClose = () => finish(new Error(`Connection retired while loading ${panel}/${filePath}`));
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (
          msg.type === 'file_content_response'
          && msg.panel === panel
          && msg.path === filePath
          && msg.requestId === requestId
        ) {
          if (msg.success) {
            finish(null, msg.content);
          } else {
            finish(new Error(msg.error || `Failed to load ${panel}/${filePath}`));
          }
        }
      } catch { /* ignore */ }
    };

    ws.addEventListener('message', handleMessage);
    ws.addEventListener('close', handleClose, { once: true });
    try {
      ws.send(JSON.stringify({
        type: 'file_content_request',
        panel,
        path: filePath,
        requestId,
      }));
      timeout = setTimeout(() => finish(new Error(`Timeout loading ${panel}/${filePath}`)), 5000);
    } catch (error) {
      finish(error instanceof Error ? error : new Error(`Failed to load ${panel}/${filePath}`));
    }
  });
}

async function fetchWorkspaceViewRegistry(ws: WebSocket): Promise<WorkspaceViewRegistryEntry[] | null> {
  try {
    const raw = await fetchPanelFile(ws, '__workspace__', 'views.json');
    const json = JSON.parse(raw);
    if ((json?.version !== 1 && json?.version !== 2) || !Array.isArray(json.views)) return null;
    return json.views.filter((view: WorkspaceViewRegistryEntry) => view?.id && view.enabled !== false);
  } catch {
    return null;
  }
}

/**
 * Load a JSON file from a panel, returning null on failure.
 */
async function fetchPanelJson<T = unknown>(ws: WebSocket, panelId: string, filePath: string, panelAlias = '__panels__'): Promise<T | null> {
  try {
    const raw = await fetchPanelFile(ws, panelAlias, `${panelId}/${filePath}`);
    return JSON.parse(raw) as T;
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
  category: 'app' | 'tool' = 'tool',
  registryEntry: WorkspaceViewRegistryEntry | null = null
): Promise<PanelConfig | null> {
  try {
    const panelAlias = category === 'app' ? '__apps__' : '__panels__';
    const registryFallback: PanelIndexConfig | null = registryEntry
      ? {
          id: registryEntry.id,
          label: registryEntry.label,
          icon: registryEntry.icon,
          rank: registryEntry.rank,
        }
      : null;
    const json = await fetchPanelJson<PanelIndexConfig>(ws, panelId, 'index.json', panelAlias) || registryFallback;

    // Load content.json — declares display type and chat config
    const contentConfig: ContentConfig | null = await fetchPanelJson<ContentConfig>(ws, panelId, 'content.json', panelAlias);

    const layoutConfig: LayoutConfig | null = await fetchPanelJson<LayoutConfig>(ws, panelId, 'styles/layout.json', panelAlias);

    const iconName = await fetchPanelFile(ws, panelAlias, `${panelId}/styles/icon.md`)
      .then(parseIconNameMarkdown)
      .catch(() => null);

    if (!json && !contentConfig && !iconName) return null;

    // Chat is determined by content.json, not by probing the filesystem
    const chatConfig = contentConfig?.chat || null;
    const hasChat = chatConfig !== null;

    // Check if panel has a ui/ folder with module.js
    const hasUiFolder = await fetchPanelFile(ws, panelAlias, `${panelId}/ui/module.js`)
      .then(() => true)
      .catch(() => false);

    // Check if panel ships an iframe entry point (Chunk D)
    const hasAppHtml = await fetchPanelFile(ws, panelAlias, `${panelId}/app/index.html`)
      .then(() => true)
      .catch(() => false);

    return {
      id: json?.id || panelId,
      name: registryEntry?.label || json?.label || displayLabelFromId(panelId),
      description: json?.description,
      type: contentConfig?.display || json?.type || 'placeholder',
      icon: iconName || registryEntry?.icon || json?.icon || 'folder',
      hasChat,
      chatConfig,
      layoutConfig,
      contentConfig,
      rank: registryEntry?.rank ?? json?.rank,
      category,
      hasUiFolder,
      hasAppHtml,
      settings: json || {},
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
    let finished = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('close', handleClose);
      if (timeout) clearTimeout(timeout);
    };
    const finish = (error: Error | null, panels?: string[]) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (error) reject(error); else resolve(panels ?? []);
    };
    const handleClose = () => finish(new Error(`Connection retired while discovering ${panelAlias}`));
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file_tree_response' && msg.panel === panelAlias) {
          if (msg.success) {
            const folders = (msg.nodes || [])
              .filter((n: { type: string }) => n.type === 'directory' || n.type === 'folder')
              .map((n: { name: string }) => n.name);
            finish(null, folders);
          } else {
            finish(new Error(msg.error || 'Failed to discover panels'));
          }
        }
      } catch { /* ignore */ }
    };

    ws.addEventListener('message', handleMessage);
    ws.addEventListener('close', handleClose, { once: true });
    try {
      ws.send(JSON.stringify({
        type: 'file_tree_request',
        panel: panelAlias,
        path: '',
      }));
      timeout = setTimeout(() => finish(new Error('Timeout discovering panels')), 5000);
    } catch (error) {
      finish(error instanceof Error ? error : new Error('Failed to discover panels'));
    }
  });
}

/**
 * Load all panel configs from machine-scoped System/Views (tools) and ai/apps/ (apps).
 * Returns sorted by rank within each category.
 */
export async function loadAllPanels(ws: WebSocket): Promise<PanelConfig[]> {
  const registryViews = await fetchWorkspaceViewRegistry(ws);
  const [toolIds, appIds] = await Promise.all([
    registryViews
      ? Promise.resolve(registryViews.map((view) => view.id))
      : discoverPanels(ws, '__panels__').catch(() => [] as string[]),
    discoverPanels(ws, '__apps__').catch(() => [] as string[]),
  ]);
  const registryById = new Map((registryViews || []).map((view) => [view.id, view]));

  const toolConfigs = await Promise.all(
    toolIds.map((id) => loadPanelConfig(ws, id, 'tool', registryById.get(id) || null))
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
export async function rediscoverPanels(ws: WebSocket, options: RediscoverPanelsOptions = {}): Promise<void> {
  const previousStore = usePanelStore.getState();
  const previousPanel = previousStore.currentPanel;
  const previousConfigs = previousStore.panelConfigs;
  previousStore.setPanelConfigs([]);
  const configs = await loadAllPanels(ws);
  if (options.shouldCommit && !options.shouldCommit()) return;
  usePanelStore.getState().setPanelConfigs(configs);

  if (configs.length === 0) return;

  if (options.preserveCurrent && configs.some((config) => config.id === previousPanel)) {
    return;
  }

  let nextPanelId = configs[0].id;
  if (options.chooseNearestIfMissing) {
    const previousIndex = previousConfigs.findIndex((config) => config.id === previousPanel);
    if (previousIndex !== -1) {
      let foundNearest = false;
      for (let index = previousIndex + 1; index < previousConfigs.length; index += 1) {
        const candidate = previousConfigs[index];
        if (configs.some((config) => config.id === candidate.id)) {
          nextPanelId = candidate.id;
          foundNearest = true;
          break;
        }
      }
      if (!foundNearest) {
        for (let index = previousIndex - 1; index >= 0; index -= 1) {
          const candidate = previousConfigs[index];
          if (configs.some((config) => config.id === candidate.id)) {
            nextPanelId = candidate.id;
            break;
          }
        }
      }
    }
  }

  usePanelStore.getState().setCurrentPanel(nextPanelId);
}
