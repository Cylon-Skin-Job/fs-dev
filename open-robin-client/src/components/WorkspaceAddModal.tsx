/**
 * @module WorkspaceAddModal
 * @role Folder picker modal for adding a new workspace.
 *
 * Replaces the previous text input with a visual folder browser.
 * Delegates browsing to FolderPicker, which communicates with the
 * server via folder:browse / folder:browse_result. Starts at the
 * user's home directory (sent in workspace:init).
 *
 * See docs/FOLDER_PICKER_SPEC.md.
 */

import { useWorkspaceStore } from '../state/workspaceStore';
import { FolderPicker } from './FolderPicker';

export function WorkspaceAddModal() {
  const isOpen = useWorkspaceStore((s) => s.isAddModalOpen);
  const closeAddModal = useWorkspaceStore((s) => s.closeAddModal);
  const requestAdd = useWorkspaceStore((s) => s.requestAdd);
  const homePath = useWorkspaceStore((s) => s.homePath);

  return (
    <FolderPicker
      open={isOpen}
      initialPath={homePath}
      onSelect={(path) => {
        requestAdd(path);
        closeAddModal();
      }}
      onCancel={closeAddModal}
    />
  );
}
