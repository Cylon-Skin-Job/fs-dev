import { useEffect, useState } from 'react';
import { escapeHtml, markdownToHtml } from '../lib/transforms';
import { useFileDataStore, type FileNode } from '../state/fileDataStore';
import { usePanelStore } from '../state/panelStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import { dispatchChatAction } from '../lib/chat-action';
import { FolderPicker } from './FolderPicker';
import './SystemViewer.css';

const PANEL = 'system-viewer';
type SystemMode = 'files' | 'workspaces';
type WorkspaceCreateMode = 'new' | 'existing' | null;

function treeKey(path: string) {
  return `${PANEL}:${path}`;
}

function isMarkdown(node: FileNode) {
  return node.type === 'file' && (node.extension === 'md' || node.name.toLowerCase().endsWith('.md'));
}

function isMarkdownPath(path: string) {
  return path.toLowerCase().endsWith('.md');
}

function displayName(path: string) {
  return path.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || 'System Manager';
}

function folderName(path: string) {
  return path.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || '';
}

export const SystemViewer: React.FC = () => {
  const ws = usePanelStore((state) => state.ws);
  const trees = useFileDataStore((state) => state.trees);
  const contents = useFileDataStore((state) => state.contents);
  const treeErrors = useFileDataStore((state) => state.treeErrors);
  const fileDataGeneration = useFileDataStore((state) => state.generation);
  const requestTree = useFileDataStore((state) => state.requestTree);
  const requestContent = useFileDataStore((state) => state.requestContent);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const requestSwitch = useWorkspaceStore((state) => state.requestSwitch);
  const homePath = useWorkspaceStore((state) => state.homePath);
  const [activePath, setActivePath] = useState('');
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [mode, setMode] = useState<SystemMode>('files');
  const [isNewWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceCreateMode>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [isFolderPickerOpen, setFolderPickerOpen] = useState(false);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);

  function closeNewWorkspaceOverlay() {
    setNewWorkspaceOpen(false);
    setWorkspaceMode(null);
    setWorkspaceName('');
    setSelectedFolderPath(null);
    setFolderPickerOpen(false);
  }

  function createWorkspaceViaSystemAgent() {
    const name = workspaceName.trim();
    if (!name || !workspaceMode) return;
    if (workspaceMode === 'existing' && !selectedFolderPath) return;

    if (activeWorkspaceId !== 'system-files') {
      requestSwitch('system-files');
      return;
    }

    dispatchChatAction({
      promptId: 'workspace-manager.workspace-creation',
      variables: {
        workspaceName: name,
        sourceMode: workspaceMode === 'new' ? 'new_folder' : 'existing_folder',
        ...(selectedFolderPath ? { selectedFolderPath } : {}),
      },
      target: 'new',
      delivery: 'insert',
      threadName: `Create workspace: ${name}`,
    });
    closeNewWorkspaceOverlay();
  }

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    requestTree(PANEL, '');
  }, [fileDataGeneration, requestTree, ws]);

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !activePath) return;
    requestTree(PANEL, activePath);
  }, [activePath, fileDataGeneration, requestTree, ws]);

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeFile) return;
    requestContent(PANEL, activeFile);
  }, [activeFile, fileDataGeneration, requestContent, ws]);

  const rootNodes = trees[treeKey('')] || [];
  const sectionNodes = activePath ? trees[treeKey(activePath)] || [] : rootNodes;
  const sectionTreeError = treeErrors[treeKey(activePath)];
  const activeContent = activeFile ? contents[treeKey(activeFile)] : '';

  function openSection(path: string) {
    setMode('files');
    setActivePath(path);
    setActiveFile(null);
    requestTree(PANEL, path);
  }

  function openNode(node: FileNode) {
    setMode('files');
    if (node.type === 'folder') {
      openSection(node.path);
      return;
    }
    setActiveFile(node.path);
    requestContent(PANEL, node.path);
  }

  return (
    <div className="rv-system-viewer">
      <aside className="rv-system-sidebar">
        <div className="rv-system-sidebar-header">
          <span className="material-symbols-outlined">manufacturing</span>
          <div>
            <div className="rv-system-title">System_Manager</div>
            <div className="rv-system-subtitle">Server-resolved workspace files</div>
          </div>
        </div>

        <button
          className={`rv-system-section ${mode === 'files' ? 'active' : ''}`}
          type="button"
          onClick={() => { setMode('files'); setActivePath(''); setActiveFile(null); requestTree(PANEL, ''); }}
        >
          <span className="material-symbols-outlined">folder_open</span>
          <span>Files</span>
        </button>

        <button
          className={`rv-system-section ${mode === 'workspaces' ? 'active' : ''}`}
          type="button"
          onClick={() => { setMode('workspaces'); setActiveFile(null); }}
        >
          <span className="material-symbols-outlined">workspaces</span>
          <span>Workspaces</span>
        </button>
      </aside>

      <section className="rv-system-main">
        <header className="rv-system-main-header">
          <div>
            <div className="rv-system-main-title">
              {mode === 'workspaces' ? 'Workspaces' : activeFile ? displayName(activeFile) : displayName(activePath)}
            </div>
            <div className="rv-system-main-path">
              {mode === 'workspaces' ? `${workspaces.length} registered` : activeFile || activePath || '/'}
            </div>
          </div>
          <button className="rv-system-new-workspace" type="button" onClick={() => setNewWorkspaceOpen(true)}>
            <span>New Workspace</span>
          </button>
        </header>

        {mode === 'workspaces' ? (
          <div className="rv-system-workspaces">
            {workspaces.length === 0 ? (
              <div className="rv-system-empty">No registered workspaces.</div>
            ) : workspaces
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((workspace) => (
                <div key={workspace.id} className={`rv-system-workspace-card ${workspace.id === activeWorkspaceId ? 'active' : ''}`}>
                  <div className="rv-system-workspace-icon">
                    <span className="material-symbols-outlined">{workspace.icon || 'folder'}</span>
                  </div>
                  <div className="rv-system-workspace-body">
                    <div className="rv-system-workspace-row">
                      <span className="rv-system-workspace-label">{workspace.label}</span>
                      {workspace.id === activeWorkspaceId && <span className="rv-system-pill">active</span>}
                      {workspace.ribbonVisible === false && <span className="rv-system-pill muted">hidden</span>}
                    </div>
                    <div className="rv-system-workspace-meta">
                      <span>{workspace.id}</span>
                      <span>{workspace.type || 'code'}</span>
                      <span>order {workspace.sortOrder}</span>
                    </div>
                    <div className="rv-system-workspace-path">{workspace.repoPath}</div>
                  </div>
                </div>
              ))}
          </div>
        ) : activeFile ? (
          <article
            className="rv-system-document rv-document-content"
            dangerouslySetInnerHTML={{ __html: isMarkdownPath(activeFile) ? markdownToHtml(activeContent) : `<pre>${escapeHtml(activeContent)}</pre>` }}
          />
        ) : (
          <div className="rv-system-grid">
            {sectionNodes.length === 0 ? (
              <div className="rv-system-empty">
                {sectionTreeError ? 'Unable to load system files.' : 'Loading system files...'}
              </div>
            ) : sectionNodes.map((node) => (
              <button
                key={node.path}
                className="rv-system-card"
                type="button"
                onClick={() => openNode(node)}
              >
                <span className="material-symbols-outlined">{node.type === 'folder' ? 'folder' : isMarkdown(node) ? 'article' : 'draft'}</span>
                <span className="rv-system-card-name">{node.name}</span>
                <span className="rv-system-card-meta">{node.type}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {isNewWorkspaceOpen && (
        <div className="rv-system-new-overlay" role="dialog" aria-modal="true" aria-labelledby="rv-system-new-title">
          <button
            className="rv-system-new-exit"
            type="button"
            onClick={closeNewWorkspaceOverlay}
            aria-label="Close new workspace overlay"
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          <div className="rv-system-new-panel">
            <div className="rv-system-new-radios" role="radiogroup" aria-label="Workspace source">
              <label className="rv-system-new-radio">
                <input
                  type="radio"
                  name="rv-system-workspace-mode"
                  checked={workspaceMode === 'new'}
                  onChange={() => {
                    setWorkspaceMode('new');
                    setSelectedFolderPath(null);
                    setWorkspaceName('');
                  }}
                />
                <span>New Folder</span>
              </label>
              <label className="rv-system-new-radio">
                <input
                  type="radio"
                  name="rv-system-workspace-mode"
                  checked={workspaceMode === 'existing'}
                  onChange={() => { setWorkspaceMode('existing'); setFolderPickerOpen(true); }}
                />
                <span>Choose Existing Folder</span>
              </label>
            </div>

            {workspaceMode && (
              <input
                id="rv-system-new-name"
                className="rv-system-new-input"
                type="text"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="New Workspace Name"
                autoFocus={workspaceMode === 'new'}
              />
            )}

            {selectedFolderPath && (
              <div className="rv-system-new-selected-folder">
                <span className="material-symbols-outlined">folder_open</span>
                <span>{selectedFolderPath}</span>
              </div>
            )}

            {workspaceName.trim() && (
              <div className="rv-system-new-actions">
                <button className="rv-system-new-action" type="button" onClick={closeNewWorkspaceOverlay}>
                  Cancel
                </button>
                <button className="rv-system-new-action primary" type="button" onClick={createWorkspaceViaSystemAgent}>
                  Create
                </button>
              </div>
            )}
          </div>

          <FolderPicker
            open={isFolderPickerOpen}
            initialPath={homePath}
            onSelect={(path) => {
              setSelectedFolderPath(path);
              setWorkspaceName(folderName(path));
              setFolderPickerOpen(false);
            }}
            onCancel={() => {
              setFolderPickerOpen(false);
              setWorkspaceMode(null);
              setSelectedFolderPath(null);
              setWorkspaceName('');
            }}
          />
        </div>
      )}
    </div>
  );
};
