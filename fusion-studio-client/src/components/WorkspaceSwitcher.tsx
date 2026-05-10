/**
 * @module WorkspaceSwitcher
 * @role Slide-out drawer for switching, adding, and removing workspaces.
 *
 * Triggered by the menu button in the header. Overlays the left edge of
 * the viewport with a scrim behind it (does not push content). Contains
 * the workspace list sorted by sortOrder, an Add Project button at the
 * bottom, and a trash icon per row for removal.
 *
 * See docs/WORKSPACE_CLIENT_UI_SPEC.md §4.
 */

import { useEffect } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import type { Workspace } from '../types';
import './WorkspaceSwitcher.css';

export function WorkspaceSwitcher() {
  const isOpen = useWorkspaceStore((s) => s.isSwitcherOpen);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const closeSwitcher = useWorkspaceStore((s) => s.closeSwitcher);
  const openAddModal = useWorkspaceStore((s) => s.openAddModal);
  const requestSwitch = useWorkspaceStore((s) => s.requestSwitch);
  const requestRemove = useWorkspaceStore((s) => s.requestRemove);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSwitcher();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, closeSwitcher]);

  const sorted = [...workspaces].sort((a, b) => a.sortOrder - b.sortOrder);

  const onRowClick = (w: Workspace) => {
    if (w.id === activeId) {
      closeSwitcher();
      return;
    }
    requestSwitch(w.id);
  };

  const onRemoveClick = (e: React.MouseEvent, w: Workspace) => {
    e.stopPropagation();
    const ok = window.confirm(
      `Remove "${w.label}"? This won't delete any files — the repo stays on disk.`
    );
    if (ok) requestRemove(w.id);
  };

  const onAddClick = () => {
    closeSwitcher();
    openAddModal();
  };

  return (
    <>
      {isOpen && <div className="rv-switcher-scrim" onClick={closeSwitcher} />}
      <aside
        className={`rv-switcher-panel ${isOpen ? 'is-open' : ''}`}
        aria-hidden={!isOpen}
      >
        <header className="rv-switcher-header">
          <span className="rv-switcher-title">Projects</span>
        </header>
        <ul className="rv-switcher-list">
          {sorted.map((w) => (
            <li
              key={w.id}
              className={`rv-switcher-item ${w.id === activeId ? 'is-active' : ''}`}
              onClick={() => onRowClick(w)}
            >
              <span className="material-symbols-outlined rv-switcher-item-icon">
                {w.icon || 'folder'}
              </span>
              <span className="rv-switcher-item-label">{w.label}</span>
              <button
                className="rv-switcher-item-remove"
                onClick={(e) => onRemoveClick(e, w)}
                title="Remove"
                type="button"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </li>
          ))}
        </ul>
        <footer className="rv-switcher-footer">
          <button
            className="rv-switcher-add"
            onClick={onAddClick}
            type="button"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Add Project</span>
          </button>
        </footer>
      </aside>
    </>
  );
}
