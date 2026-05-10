/**
 * Resource Path — resolves panel-relative paths to absolute filesystem paths.
 *
 * Used by copy-path buttons across all views.
 */

import { usePanelStore } from '../state/panelStore';
import { showToast } from './toast';

const PANEL_PREFIX: Record<string, string> = {
  'doc-viewer': 'ai/views/doc-viewer',
  'wiki-viewer': 'ai/views/wiki-viewer/content',
  'agents-viewer': 'ai/views/agents-viewer',
  'file-viewer': '',
  'issues-viewer': 'ai/views/issues-viewer',
};

export function resolveAbsolutePath(panel: string, relativePath: string): string | null {
  const root = usePanelStore.getState().projectRoot;
  if (!root) return null;
  const prefix = PANEL_PREFIX[panel] ?? `ai/views/${panel}`;
  return prefix ? `${root}/${prefix}/${relativePath}` : `${root}/${relativePath}`;
}

export function copyResourcePath(panel: string, relativePath: string): void {
  const abs = resolveAbsolutePath(panel, relativePath);
  if (!abs) {
    showToast('Path not available');
    return;
  }
  navigator.clipboard.writeText(abs);
  showToast('Path copied');
}
