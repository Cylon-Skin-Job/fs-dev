/**
 * @module WorkspaceCreateModal
 * @role Minimal Create New project flow backed by view templates.
 */

import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import type { WorkspaceCreateManifest } from '../types';
import './WorkspaceCreateModal.css';

function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
}

function folderNameFromPath(value: string): string {
  return value.trim().split(/[\\/]+/).filter(Boolean).pop() || '';
}

export function WorkspaceCreateModal() {
  const isOpen = useWorkspaceStore((s) => s.isCreateModalOpen);
  if (!isOpen) return null;

  return <WorkspaceCreateModalContent />;
}

function getDefaultViewIds(manifest: WorkspaceCreateManifest | null): string[] {
  return manifest?.views.filter((view) => view.group === 'default').map((view) => view.id) ?? [];
}

function getNewWorkspaceTemplate(manifest: WorkspaceCreateManifest | null) {
  return manifest?.workspaceTemplates?.find((template) => template.id === 'new')
    || manifest?.workspaceTemplates?.find((template) => template.category === 'new')
    || null;
}

function getIncludedViewIds(manifest: WorkspaceCreateManifest | null): string[] {
  const template = getNewWorkspaceTemplate(manifest);
  return template?.selectedViewIds?.length ? template.selectedViewIds : getDefaultViewIds(manifest);
}

function getIncludedViews(manifest: WorkspaceCreateManifest | null) {
  const viewsById = new Map(manifest?.views.map((view) => [view.id, view]) ?? []);
  return getIncludedViewIds(manifest)
    .map((viewId) => viewsById.get(viewId))
    .filter((view): view is NonNullable<typeof view> => Boolean(view));
}

function WorkspaceCreateModalContent() {
  const manifest = useWorkspaceStore((s) => s.createManifest);
  const createError = useWorkspaceStore((s) => s.createError);
  const isCreating = useWorkspaceStore((s) => s.isCreatingWorkspace);
  const closeCreateModal = useWorkspaceStore((s) => s.closeCreateModal);
  const requestCreateManifest = useWorkspaceStore((s) => s.requestCreateManifest);
  const requestCreateWorkspace = useWorkspaceStore((s) => s.requestCreateWorkspace);
  const setCreateError = useWorkspaceStore((s) => s.setCreateError);

  const [projectPath, setProjectPath] = useState('');
  const [label, setLabel] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    requestCreateManifest();
  }, [requestCreateManifest]);

  const includedViews = getIncludedViews(manifest);
  const selectedWorkspaceTemplate = getNewWorkspaceTemplate(manifest);

  const onSubmit = () => {
    const trimmedPath = projectPath.trim();
    if (!trimmedPath || !isAbsolutePath(trimmedPath)) {
      setLocalError('Enter an absolute project path.');
      return;
    }
    if (!manifest) {
      setLocalError('Workspace templates are still loading.');
      return;
    }
    setLocalError(null);
    setCreateError(null);
    requestCreateWorkspace(
      trimmedPath,
      label.trim() || folderNameFromPath(trimmedPath)
    );
  };

  const error = localError || createError;

  return (
    <div className="rv-create-modal-scrim" role="presentation">
      <section className="rv-create-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-create-title">
        <header className="rv-create-modal-header">
          <div>
            <h2 id="workspace-create-title">Create New Project</h2>
            <p>Scaffold a project with the core workspace views.</p>
          </div>
          <button className="rv-create-modal-close" type="button" onClick={closeCreateModal} aria-label="Cancel create project">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="rv-create-modal-body">
          <label className="rv-create-modal-field">
            <span>Project folder path</span>
            <input
              type="text"
              autoFocus
              value={projectPath}
              onChange={(event) => setProjectPath(event.target.value)}
              placeholder="/Users/name/projects/my-project"
            />
          </label>

          <label className="rv-create-modal-field">
            <span>Display name</span>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Derived from folder name if blank"
            />
          </label>

          <div className="rv-create-modal-views">
            <div className="rv-create-modal-section-title">Included views</div>
            {selectedWorkspaceTemplate?.description && (
              <span className="rv-create-modal-template-description">
                {selectedWorkspaceTemplate.description}
              </span>
            )}
            {!manifest ? (
              <div className="rv-create-modal-loading">Loading templates...</div>
            ) : (
              <div className="rv-create-modal-view-list">
                {includedViews.map((view) => (
                  <div key={view.id} className="rv-create-modal-view-option">
                    <span className="material-symbols-outlined">{view.icon || 'widgets'}</span>
                    <span className="rv-create-modal-view-label">{view.label}</span>
                    <span className="rv-create-modal-view-meta">{view.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="rv-create-modal-error">{error}</div>}
        </div>

        <footer className="rv-create-modal-footer">
          <button className="rv-create-modal-secondary" type="button" onClick={closeCreateModal}>Cancel</button>
          <button className="rv-create-modal-primary" type="button" onClick={onSubmit} disabled={isCreating || !manifest}>
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </footer>
      </section>
    </div>
  );
}
