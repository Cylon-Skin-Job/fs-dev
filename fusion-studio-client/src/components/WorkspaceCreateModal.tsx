/**
 * @module WorkspaceCreateModal
 * @role Minimal Create New project flow backed by view templates.
 */

import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import type { WorkspaceCreateManifest, WorkspaceTemplateProfile } from '../types';
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

function getWorkspaceTemplates(manifest: WorkspaceCreateManifest | null): WorkspaceTemplateProfile[] {
  if (manifest?.workspaceTemplates?.length) return manifest.workspaceTemplates;
  return [{
    schemaVersion: 1,
    id: 'new',
    label: 'New Workspace',
    category: 'new',
    selectedViewIds: getDefaultViewIds(manifest),
  }];
}

function getDefaultTemplateId(manifest: WorkspaceCreateManifest | null): string {
  return getWorkspaceTemplates(manifest)[0]?.id ?? 'new';
}

function getTemplateViewIds(manifest: WorkspaceCreateManifest | null, templateId: string): string[] {
  const profile = getWorkspaceTemplates(manifest).find((template) => template.id === templateId);
  return profile?.selectedViewIds?.length ? profile.selectedViewIds : getDefaultViewIds(manifest);
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
  const [selectionState, setSelectionState] = useState(() => ({
    manifest,
    workspaceTemplateId: getDefaultTemplateId(manifest),
    selectedViewIds: getTemplateViewIds(manifest, getDefaultTemplateId(manifest)),
  }));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    requestCreateManifest();
  }, [requestCreateManifest]);

  let selectedViewIds = selectionState.selectedViewIds;
  let selectedWorkspaceTemplateId = selectionState.workspaceTemplateId;
  if (selectionState.manifest !== manifest) {
    selectedWorkspaceTemplateId = getDefaultTemplateId(manifest);
    selectedViewIds = getTemplateViewIds(manifest, selectedWorkspaceTemplateId);
    setSelectionState({ manifest, workspaceTemplateId: selectedWorkspaceTemplateId, selectedViewIds });
  }
  const workspaceTemplates = getWorkspaceTemplates(manifest);
  const selectedWorkspaceTemplate = workspaceTemplates.find((template) => template.id === selectedWorkspaceTemplateId);

  const toggleView = (viewId: string) => {
    setLocalError(null);
    setCreateError(null);
    setSelectionState((current) => {
      const currentIds = current.selectedViewIds;
      return {
        ...current,
        selectedViewIds: currentIds.includes(viewId)
          ? currentIds.filter((id) => id !== viewId)
          : [...currentIds, viewId],
      };
    });
  };

  const selectWorkspaceTemplate = (workspaceTemplateId: string) => {
    setLocalError(null);
    setCreateError(null);
    setSelectionState((current) => ({
      ...current,
      workspaceTemplateId,
      selectedViewIds: getTemplateViewIds(manifest, workspaceTemplateId),
    }));
  };

  const onSubmit = () => {
    const trimmedPath = projectPath.trim();
    if (!trimmedPath || !isAbsolutePath(trimmedPath)) {
      setLocalError('Enter an absolute project path.');
      return;
    }
    if (selectedViewIds.length === 0) {
      setLocalError('Select at least one view template.');
      return;
    }
    setLocalError(null);
    setCreateError(null);
    requestCreateWorkspace(
      trimmedPath,
      label.trim() || folderNameFromPath(trimmedPath),
      selectedViewIds,
      selectedWorkspaceTemplateId
    );
  };

  const error = localError || createError;

  return (
    <div className="rv-create-modal-scrim" role="presentation">
      <section className="rv-create-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-create-title">
        <header className="rv-create-modal-header">
          <div>
            <h2 id="workspace-create-title">Create New Project</h2>
            <p>Scaffold a project with an /ai tree and selected views.</p>
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
            <label className="rv-create-modal-field">
              <span>Workspace template</span>
              <select
                value={selectedWorkspaceTemplateId}
                onChange={(event) => selectWorkspaceTemplate(event.target.value)}
                disabled={!manifest}
              >
                {workspaceTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
              {selectedWorkspaceTemplate?.description && (
                <span className="rv-create-modal-template-description">
                  {selectedWorkspaceTemplate.description}
                </span>
              )}
            </label>

            <div className="rv-create-modal-section-title">View templates</div>
            {!manifest ? (
              <div className="rv-create-modal-loading">Loading templates...</div>
            ) : (
              <div className="rv-create-modal-view-list">
                {manifest.views.map((view) => (
                  <label key={view.id} className="rv-create-modal-view-option">
                    <input
                      type="checkbox"
                      checked={selectedViewIds.includes(view.id)}
                      onChange={() => toggleView(view.id)}
                    />
                    <span className="material-symbols-outlined">{view.icon || 'widgets'}</span>
                    <span className="rv-create-modal-view-label">{view.label}</span>
                    <span className="rv-create-modal-view-meta">{view.group} / {view.status}</span>
                  </label>
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
