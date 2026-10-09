import { usePanelStore } from '../../state/panelStore';
import { loadFileContent } from '../file-tree';

/**
 * Open the server-acknowledged exact-member mirror path in the File Viewer.
 * The server resolved the canonical `Data/Chatlogs/threads/<threadId>.md`
 * through ThreadManager; the renderer only translates the workspace-relative
 * `ai/` path for the existing file viewer.
 */
export function openThreadMarkdown(filePath: string): void {
  const aiIdx = filePath.indexOf('ai/');
  const relPath = aiIdx >= 0 ? filePath.slice(aiIdx) : filePath;
  const panelStore = usePanelStore.getState();
  panelStore.setCurrentPanel('file-viewer');
  const name = relPath.split('/').pop() || relPath;
  loadFileContent({
    path: relPath,
    name,
    type: 'file',
    extension: 'md',
  });
}

