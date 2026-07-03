/**
 * Resource Path — resolves panel-relative paths to absolute filesystem paths.
 *
 * Uses the actual panel root stored in panelStore so the copied path always
 * matches the real filesystem location of the displayed file.
 */

import { usePanelStore } from '../state/panelStore';
import { showToast } from './toast';

export function resolveAbsolutePath(panel: string, relativePath: string): string | null {
  const panelRoot = usePanelStore.getState().panelRoots[panel];
  if (!panelRoot) return null;
  return `${panelRoot}/${relativePath}`;
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
