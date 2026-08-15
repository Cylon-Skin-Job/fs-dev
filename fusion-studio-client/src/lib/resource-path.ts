/**
 * Resource Path — resolves panel-relative paths to filesystem resources.
 *
 * Uses the resolved panel content roots hydrated from the server. View
 * content.json is the source of truth for those roots; consumers should not
 * rebuild view-specific paths locally.
 */

import { usePanelStore } from '../state/panelStore';
import { createSendToChatAttachment } from './chat-file-links/send-to-chat-reference-label';
import type { ChatLinkAttachment } from './chat-file-links/file-link-types';
import { showToast } from './toast';

export interface ResolvedResourcePath {
  panel: string;
  panelRoot: string;
  relativePath: string;
  absolutePath: string;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

export function normalizeResourceRelativePath(relativePath: string): string {
  return trimSlashes(String(relativePath || ''));
}

export function resolvePanelRoot(panel: string): string | null {
  const panelRoot = usePanelStore.getState().panelRoots[panel];
  if (!panelRoot) return null;
  return trimSlashes(panelRoot) ? panelRoot.replace(/\/+$/g, '') : panelRoot;
}

export function resolveResourcePath(panel: string, relativePath: string): ResolvedResourcePath | null {
  const panelRoot = resolvePanelRoot(panel);
  if (!panelRoot) return null;
  const normalizedRelativePath = normalizeResourceRelativePath(relativePath);
  const absolutePath = normalizedRelativePath
    ? `${panelRoot}/${normalizedRelativePath}`
    : panelRoot;

  return {
    panel,
    panelRoot,
    relativePath: normalizedRelativePath,
    absolutePath,
  };
}

export function resolveAbsolutePath(panel: string, relativePath: string): string | null {
  return resolveResourcePath(panel, relativePath)?.absolutePath ?? null;
}

export function copyResourcePath(panel: string, relativePath: string): void {
  const resource = resolveResourcePath(panel, relativePath);
  if (!resource) {
    showToast('Path not available');
    return;
  }
  navigator.clipboard.writeText(resource.absolutePath);
  showToast('Path copied');
}

export function createResourceChatAttachment(panel: string, relativePath: string): ChatLinkAttachment | null {
  const resource = resolveResourcePath(panel, relativePath);
  if (!resource) return null;
  return createSendToChatAttachment({
    panel: resource.panel,
    relativePath: resource.relativePath,
    absolutePath: resource.absolutePath,
  });
}
