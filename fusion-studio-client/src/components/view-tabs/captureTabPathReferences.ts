import type { DocViewerTab, DocViewerTabUi } from '../../types';
import { canonicalCapturePath } from './captureTabDomain';
import { CAPTURE_PANEL, transitionCaptureTabPaths } from './captureTabsController';
import {
  removeCaptureConnectedPathReferences,
  rewriteCaptureConnectedPathReferences,
} from './captureConnectedTabs';

interface CapturePathMutation {
  sourcePanel: string;
  sourcePath: string;
  includeDescendants: boolean;
}

interface CapturePathRewrite extends CapturePathMutation {
  targetPanel: string;
  targetPath: string;
}

function matchingSuffix(path: string, source: string, includeDescendants: boolean): string | null {
  if (path === source) return '';
  if (includeDescendants && path.startsWith(`${source}/`)) return path.slice(source.length);
  return null;
}

function rewriteUi(
  ui: DocViewerTabUi,
  source: string,
  replacement: string | null,
  includeDescendants: boolean,
): { ui: DocViewerTabUi; changed: boolean } {
  let changed = false;
  const rewrite = (value: string | null): string | null => {
    if (!value) return value;
    const suffix = matchingSuffix(value, source, includeDescendants);
    if (suffix === null) return value;
    changed = true;
    return replacement ? `${replacement}${suffix}` : null;
  };
  const next: DocViewerTabUi = {
    ...ui,
    lastOpenedPath: rewrite(ui.lastOpenedPath),
    byMode: {
      active: { ...ui.byMode.active, selectedPath: rewrite(ui.byMode.active.selectedPath) },
      archive: { ...ui.byMode.archive, selectedPath: rewrite(ui.byMode.archive.selectedPath) },
    },
  };
  return { ui: changed ? next : ui, changed };
}

function transformCapturePaths(
  mutation: CapturePathMutation,
  replacement: string | null,
): boolean {
  if (mutation.sourcePanel !== CAPTURE_PANEL) return false;
  const source = canonicalCapturePath(mutation.sourcePath);
  if (!source) return false;

  return transitionCaptureTabPaths((tabs) => {
    let changed = false;
    const next: DocViewerTab[] = [];
    for (const tab of tabs) {
      if (tab.kind === 'doc') {
        const suffix = matchingSuffix(tab.path, source, mutation.includeDescendants);
        if (suffix !== null) {
          changed = true;
          if (!replacement) continue;
          const path = `${replacement}${suffix}`;
          next.push({ ...tab, path, ui: rewriteUi(tab.ui, source, replacement, mutation.includeDescendants).ui });
          continue;
        }
      }
      const uiResult = rewriteUi(tab.ui, source, replacement, mutation.includeDescendants);
      changed ||= uiResult.changed;
      next.push(uiResult.changed ? { ...tab, ui: uiResult.ui } : tab);
    }
    return changed ? next : null;
  });
}

/** Rewrite durable Capture identities after a public move/rename event. */
export function rewriteCaptureTabPathReferences(mutation: CapturePathRewrite): boolean {
  const target = mutation.targetPanel === CAPTURE_PANEL
    ? canonicalCapturePath(mutation.targetPath)
    : null;
  if (mutation.targetPanel === CAPTURE_PANEL && !target) return false;
  let changed = transformCapturePaths(mutation, target);
  // VIEW-02 Slice 3: the connected tab collection rewrites its document
  // identities too (removal when the file moved out of the Capture panel).
  if (mutation.sourcePanel === CAPTURE_PANEL) {
    const connectedChanged = target
      ? rewriteCaptureConnectedPathReferences({
        sourcePath: mutation.sourcePath,
        targetPath: mutation.targetPath,
        includeDescendants: mutation.includeDescendants,
      })
      : removeCaptureConnectedPathReferences({
        sourcePath: mutation.sourcePath,
        includeDescendants: mutation.includeDescendants,
      });
    changed = changed || connectedChanged;
  }
  return changed;
}

/** Remove durable Capture identities after a public delete event. */
export function removeCaptureTabPathReferences(mutation: CapturePathMutation): boolean {
  const changed = transformCapturePaths(mutation, null);
  const connectedChanged = mutation.sourcePanel === CAPTURE_PANEL
    ? removeCaptureConnectedPathReferences({
      sourcePath: mutation.sourcePath,
      includeDescendants: mutation.includeDescendants,
    })
    : false;
  return changed || connectedChanged;
}
