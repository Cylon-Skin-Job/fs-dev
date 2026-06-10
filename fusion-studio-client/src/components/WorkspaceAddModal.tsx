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
import { useEffect, useState } from 'react';
import { FolderPicker } from './FolderPicker';
import './WorkspaceAddModal.css';

type AddModalStep = 'requirement' | 'picker';

export function WorkspaceAddModal() {
  const isOpen = useWorkspaceStore((s) => s.isAddModalOpen);
  const closeAddModal = useWorkspaceStore((s) => s.closeAddModal);
  const requestAdd = useWorkspaceStore((s) => s.requestAdd);
  const homePath = useWorkspaceStore((s) => s.homePath);
  const [step, setStep] = useState<AddModalStep>('requirement');

  useEffect(() => {
    if (isOpen) setStep('requirement');
  }, [isOpen]);

  const closeAndReset = () => {
    setStep('requirement');
    closeAddModal();
  };

  if (!isOpen) return null;

  if (step === 'requirement') {
    return (
      <div className="rv-add-modal-backdrop" role="presentation" onClick={closeAndReset}>
        <section
          className="rv-add-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rv-add-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="rv-add-modal-header">
            <h2 id="rv-add-modal-title" className="rv-add-modal-title">Add Project</h2>
          </header>
          <div className="rv-add-modal-body">
            <p className="rv-add-modal-message">
              The project must already contain an /ai folder before it can be added to Fusion Studio.
            </p>
            <p className="rv-add-modal-support">
              Cancel to abort, or continue when you are ready to choose a project folder that already has /ai.
            </p>
            <div className="rv-add-modal-actions">
              <button type="button" className="rv-add-modal-btn" onClick={closeAndReset}>
                Cancel
              </button>
              <button
                type="button"
                className="rv-add-modal-btn rv-add-modal-btn-primary"
                onClick={() => setStep('picker')}
              >
                Continue
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <FolderPicker
      open={isOpen}
      initialPath={homePath}
      onSelect={(path) => {
        requestAdd(path);
        closeAndReset();
      }}
      onCancel={closeAndReset}
    />
  );
}
