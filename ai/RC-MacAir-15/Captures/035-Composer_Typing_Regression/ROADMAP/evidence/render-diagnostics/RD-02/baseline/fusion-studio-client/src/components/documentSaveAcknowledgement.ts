import type { SaveReason } from '../state/fileDataStore';
import { useFileDataStore } from '../state/fileDataStore';

export type SaveFileAction = (
  panel: string,
  path: string,
  content: string,
  reason: SaveReason,
  milestone?: string,
  capturedDirtyRevision?: number,
) => Promise<void>;

export function isDocumentDirty(panel: string, path: string): boolean {
  return useFileDataStore.getState().dirtyFlags[`${panel}:${path}`] === true;
}

export function documentDirtyRevision(panel: string, path: string): number {
  return useFileDataStore.getState().dirtyRevisions[`${panel}:${path}`] ?? 0;
}

export async function saveBeforeDocumentNavigation({
  panel,
  path,
  saveCurrent,
}: {
  panel: string;
  path: string;
  saveCurrent: () => Promise<void>;
}): Promise<void> {
  // A save acknowledgement only covers the editor revision that it captured.
  // Drain later edits before allowing navigation away from the document.
  while (isDocumentDirty(panel, path)) {
    await saveCurrent();
  }
}

export async function saveAcknowledgedMilestone({
  panel,
  path,
  content,
  milestone,
  capturedDirtyRevision,
  saveFile,
  setLocalDirty,
}: {
  panel: string;
  path: string;
  content: string;
  milestone: string;
  capturedDirtyRevision?: number;
  saveFile: SaveFileAction;
  setLocalDirty: (dirty: boolean) => void;
}): Promise<void> {
  await saveFile(panel, path, content, 'milestone', milestone, capturedDirtyRevision);
  if (!isDocumentDirty(panel, path)) setLocalDirty(false);
}
