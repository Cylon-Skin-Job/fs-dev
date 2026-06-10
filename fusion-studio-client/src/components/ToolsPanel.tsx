import './ToolsPanel.css';
import { useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { usePanelStore } from '../state/panelStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import type { PanelConfig } from '../lib/panels';

interface ToolsPanelProps {
  currentPanel: string;
  onSwitch: (id: string) => void;
}

type ViewMenuMode = 'rename' | 'icon' | null;

interface ViewMenuState {
  viewId: string;
  x: number;
  y: number;
  mode: ViewMenuMode;
  labelDraft: string;
  iconDraft: string;
}

interface RailMenuState {
  x: number;
  y: number;
}

export function ToolsPanel({ currentPanel, onSwitch }: ToolsPanelProps) {
  const configs = usePanelStore((s) => s.panelConfigs);
  const requestViewUpdate = usePanelStore((s) => s.requestViewUpdate);
  const requestViewOptions = usePanelStore((s) => s.requestViewOptions);
  const restoreView = usePanelStore((s) => s.restoreView);
  const addView = usePanelStore((s) => s.addView);
  const hiddenViews = usePanelStore((s) => s.hiddenViews);
  const availableViewTemplates = usePanelStore((s) => s.availableViewTemplates);
  const updateError = usePanelStore((s) => s.viewRegistryUpdateError);
  const workspaceType = useWorkspaceStore((s) => s.workspaceType);
  const [viewMenu, setViewMenu] = useState<ViewMenuState | null>(null);
  const [railMenu, setRailMenu] = useState<RailMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const toolConfigs = configs.filter((config) => config.category === 'tool');
  const selectedMenuConfig = viewMenu
    ? configs.find((config) => config.id === viewMenu.viewId) || null
    : null;
  const selectedToolIndex = selectedMenuConfig
    ? toolConfigs.findIndex((config) => config.id === selectedMenuConfig.id)
    : -1;

  useEffect(() => {
    if (!viewMenu && !railMenu) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setViewMenu(null);
        setRailMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewMenu(null);
        setRailMenu(null);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [viewMenu, railMenu]);

  const openViewMenu = (event: ReactMouseEvent<HTMLButtonElement>, config: PanelConfig) => {
    if (config.category !== 'tool') return;
    event.preventDefault();
    setRailMenu(null);
    setViewMenu({
      viewId: config.id,
      x: Math.min(event.clientX, window.innerWidth - 260),
      y: Math.min(event.clientY, window.innerHeight - 320),
      mode: null,
      labelDraft: config.name,
      iconDraft: config.icon,
    });
  };

  const openRailMenu = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.rv-tool-btn')) return;
    event.preventDefault();
    setViewMenu(null);
    setRailMenu({
      x: Math.min(event.clientX, window.innerWidth - 280),
      y: Math.min(event.clientY, window.innerHeight - 360),
    });
    requestViewOptions();
  };

  const renderToolButton = (config: PanelConfig, className = '') => (
    <button
      key={config.id}
      className={`rv-tool-btn ${className} ${currentPanel === config.id ? 'active' : ''}`}
      onClick={() => onSwitch(config.id)}
      onContextMenu={(event) => openViewMenu(event, config)}
      title={config.name}
    >
      <span className="material-symbols-outlined rv-icon-xl">
        {config.icon}
      </span>
    </button>
  );

  const submitRename = (event: FormEvent) => {
    event.preventDefault();
    if (!viewMenu) return;
    const label = viewMenu.labelDraft.trim();
    if (label) {
      requestViewUpdate(viewMenu.viewId, { label });
      setViewMenu({ ...viewMenu, mode: null });
    }
  };

  const submitIcon = (event: FormEvent) => {
    event.preventDefault();
    if (!viewMenu) return;
    const icon = viewMenu.iconDraft.trim();
    if (icon) {
      requestViewUpdate(viewMenu.viewId, { icon });
      setViewMenu({ ...viewMenu, mode: null });
    }
  };

  const renderViewMenu = () => {
    if (!viewMenu || !selectedMenuConfig) return null;

    const canMoveUp = selectedToolIndex > 0;
    const canMoveDown = selectedToolIndex >= 0 && selectedToolIndex < toolConfigs.length - 1;
    const canHide = toolConfigs.length > 1;

    return (
      <div
        ref={menuRef}
        className="rv-view-context-menu"
        style={{ left: viewMenu.x, top: viewMenu.y }}
        role="menu"
      >
        <div className="rv-view-context-heading">
          <span className="material-symbols-outlined rv-view-context-icon">
            {selectedMenuConfig.icon}
          </span>
          <div className="rv-view-context-title-group">
            <span className="rv-view-context-title">{selectedMenuConfig.name}</span>
            <span className="rv-view-context-id">{selectedMenuConfig.id}</span>
          </div>
        </div>

        {viewMenu.mode === 'rename' && (
          <form className="rv-view-context-form" onSubmit={submitRename}>
            <label className="rv-view-context-label" htmlFor="rv-view-rename-input">Rename</label>
            <input
              id="rv-view-rename-input"
              className="rv-view-context-input"
              value={viewMenu.labelDraft}
              onChange={(event) => setViewMenu({ ...viewMenu, labelDraft: event.target.value })}
              autoFocus
            />
            <button className="rv-view-context-save" type="submit">Save</button>
          </form>
        )}

        {viewMenu.mode === 'icon' && (
          <form className="rv-view-context-form" onSubmit={submitIcon}>
            <label className="rv-view-context-label" htmlFor="rv-view-icon-input">Material icon</label>
            <input
              id="rv-view-icon-input"
              className="rv-view-context-input"
              value={viewMenu.iconDraft}
              onChange={(event) => setViewMenu({ ...viewMenu, iconDraft: event.target.value })}
              autoFocus
            />
            <button className="rv-view-context-save" type="submit">Save</button>
          </form>
        )}

        <button className="rv-view-context-action" type="button" onClick={() => setViewMenu({ ...viewMenu, mode: 'rename' })}>
          Rename
        </button>
        <button className="rv-view-context-action" type="button" onClick={() => setViewMenu({ ...viewMenu, mode: 'icon' })}>
          Change icon
        </button>
        <button className="rv-view-context-action" type="button" disabled={!canMoveUp} onClick={() => requestViewUpdate(viewMenu.viewId, undefined, 'up')}>
          Move up
        </button>
        <button className="rv-view-context-action" type="button" disabled={!canMoveDown} onClick={() => requestViewUpdate(viewMenu.viewId, undefined, 'down')}>
          Move down
        </button>
        <button className="rv-view-context-action rv-view-context-action--danger" type="button" disabled={!canHide} onClick={() => requestViewUpdate(viewMenu.viewId, { enabled: false })}>
          Hide view
        </button>
        {updateError && <div className="rv-view-context-error">{updateError}</div>}
      </div>
    );
  };

  const renderRailMenu = () => {
    if (!railMenu) return null;

    const hasHiddenViews = hiddenViews.length > 0;
    const hasTemplates = availableViewTemplates.length > 0;

    return (
      <div
        ref={menuRef}
        className="rv-view-context-menu rv-view-rail-menu"
        style={{ left: railMenu.x, top: railMenu.y }}
        role="menu"
      >
        <div className="rv-view-context-heading">
          <span className="material-symbols-outlined rv-view-context-icon">view_sidebar</span>
          <div className="rv-view-context-title-group">
            <span className="rv-view-context-title">Workspace Views</span>
            <span className="rv-view-context-id">Add or restore</span>
          </div>
        </div>

        {hasHiddenViews && (
          <div className="rv-view-context-section">
            <div className="rv-view-context-section-title">Restore View</div>
            {hiddenViews.map((view) => (
              <button
                key={view.id}
                className="rv-view-context-action rv-view-context-action--with-icon"
                type="button"
                onClick={() => {
                  restoreView(view.id);
                  setRailMenu(null);
                }}
              >
                <span className="material-symbols-outlined rv-view-context-action-icon">{view.icon}</span>
                <span>{view.label || view.id}</span>
              </button>
            ))}
          </div>
        )}

        {hasTemplates && (
          <div className="rv-view-context-section">
            <div className="rv-view-context-section-title">Add View</div>
            {availableViewTemplates.map((template) => (
              <button
                key={template.id}
                className="rv-view-context-action rv-view-context-action--with-icon"
                type="button"
                onClick={() => {
                  addView(template.id);
                  setRailMenu(null);
                }}
              >
                <span className="material-symbols-outlined rv-view-context-action-icon">{template.icon || 'folder'}</span>
                <span>{template.label || template.id}</span>
              </button>
            ))}
          </div>
        )}

        {!hasHiddenViews && !hasTemplates && (
          <div className="rv-view-context-empty">No hidden views or available templates.</div>
        )}

        {updateError && <div className="rv-view-context-error">{updateError}</div>}
      </div>
    );
  };

  // Code workspaces: flat list (existing behavior)
  if (workspaceType === 'code') {
    return (
      <nav className="rv-tools-panel" onContextMenu={openRailMenu}>
        {configs.map((config) => renderToolButton(config))}
        {renderViewMenu()}
        {renderRailMenu()}
      </nav>
    );
  }

  // App workspaces: two zones with divider
  const apps = configs.filter((c) => c.category === 'app');
  const tools = configs.filter((c) => c.category === 'tool');

  return (
    <nav className="rv-tools-panel rv-tools-panel--app" onContextMenu={openRailMenu}>
      {/* Apps zone — spaced out, top */}
      <div className="rv-tools-apps">
        {apps.map((config) => (
          <button
            key={config.id}
            className={`rv-tool-btn rv-tool-btn--app ${currentPanel === config.id ? 'active' : ''}`}
            onClick={() => onSwitch(config.id)}
            onContextMenu={(event) => openViewMenu(event, config)}
            title={config.name}
          >
            <span className="material-symbols-outlined rv-icon-xl">
              {config.icon}
            </span>
          </button>
        ))}
      </div>

      {/* Divider */}
      {apps.length > 0 && tools.length > 0 && (
        <hr className="rv-tools-divider" />
      )}

      {/* Tools zone — bottom */}
      <div className="rv-tools-tools">
        {tools.map((config) => renderToolButton(config, 'rv-tool-btn--tool'))}
      </div>
      {renderViewMenu()}
      {renderRailMenu()}
    </nav>
  );
}
